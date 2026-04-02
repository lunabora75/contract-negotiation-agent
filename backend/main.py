"""
FastAPI backend — single-agent contract negotiation (v2).
Accepts uploaded SOW files (PDF, DOCX, TXT) for analysis.
"""

import io
import os
import uuid
from pathlib import Path
from typing import Dict

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from agent import NegotiationAgent

# ── app ──────────────────────────────────────────────────────────────────
app = FastAPI(title="Contract Negotiation Agent", version="2.0.0")

_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── session store ────────────────────────────────────────────────────────
SESSIONS: Dict[str, dict] = {}

# ── file text extraction ─────────────────────────────────────────────────
def _extract_text(filename: str, content: bytes) -> str:
    ext = Path(filename).suffix.lower()

    if ext == ".pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(content))
            pages  = [p.extract_text() or "" for p in reader.pages]
            text   = "\n\n".join(pages).strip()
            if not text:
                raise ValueError("PDF appears to be scanned/image-only — no extractable text found.")
            return text
        except ImportError:
            raise HTTPException(500, "pypdf is not installed. Run: pip install pypdf")

    if ext in (".docx",):
        try:
            from docx import Document
            doc   = Document(io.BytesIO(content))
            paras = [p.text for p in doc.paragraphs if p.text.strip()]
            return "\n".join(paras)
        except ImportError:
            raise HTTPException(500, "python-docx is not installed. Run: pip install python-docx")

    if ext in (".txt", ".md", ""):
        return content.decode("utf-8", errors="replace")

    raise HTTPException(
        415,
        f"Unsupported file type '{ext}'. Please upload a PDF, DOCX, or TXT file."
    )

# ── negotiation-complete heuristic ───────────────────────────────────────
def _negotiation_complete(reply: str) -> bool:
    markers = [
        "feedback", "rate this session", "how would you rate",
        "negotiation is complete", "summary of outcomes",
        "final terms", "we have reached agreement", "session complete",
        "please provide your feedback", "i'd welcome your feedback",
        "i would love your feedback", "would you be willing to rate",
    ]
    low = reply.lower()
    return any(m in low for m in markers)

# ── request models ────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str

class FeedbackRequest(BaseModel):
    rating:      int
    outcome:     str
    what_worked: str = ""
    what_didnt:  str = ""
    notes:       str = ""

# ── routes ────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok", "model": os.getenv("MODEL", "claude-opus-4-5")}


@app.post("/api/sessions")
async def create_session(file: UploadFile = File(...)):
    """
    Accept an uploaded SOW file (PDF / DOCX / TXT), extract its text,
    run the negotiation agent, and return the opening message.
    """
    content  = await file.read()
    filename = file.filename or "upload.txt"

    if len(content) == 0:
        raise HTTPException(400, "Uploaded file is empty.")
    if len(content) > 10 * 1024 * 1024:          # 10 MB guard
        raise HTTPException(413, "File too large. Maximum size is 10 MB.")

    sow_text = _extract_text(filename, content)

    session_id  = uuid.uuid4().hex[:10]
    agent       = NegotiationAgent()
    reply, msgs = agent.run_turn([], sow_text=sow_text)

    SESSIONS[session_id] = {
        "session_id": session_id,
        "filename":   filename,
        "messages":   msgs,
        "chat":       [{"role": "agent", "content": reply}],
    }

    return {
        "session_id":           session_id,
        "filename":             filename,
        "reply":                reply,
        "negotiation_complete": _negotiation_complete(reply),
    }


@app.post("/api/sessions/{session_id}/chat")
def chat_turn(session_id: str, body: ChatRequest):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    session["chat"].append({"role": "user", "content": body.message})

    agent       = NegotiationAgent()
    reply, msgs = agent.run_turn(
        session["messages"] + [{"role": "user", "content": body.message}]
    )
    session["messages"] = msgs
    session["chat"].append({"role": "agent", "content": reply})

    return {
        "reply":                reply,
        "negotiation_complete": _negotiation_complete(reply),
    }


@app.post("/api/sessions/{session_id}/feedback")
def submit_feedback(session_id: str, body: FeedbackRequest):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    feedback_msg = (
        f"The user has submitted their session feedback. "
        f"Please call the save_feedback tool now with: "
        f"rating={body.rating}, outcome='{body.outcome}', "
        f"what_worked={body.what_worked!r}, "
        f"what_didnt={body.what_didnt!r}, "
        f"notes={body.notes!r}"
    )
    agent = NegotiationAgent()
    reply, updated = agent.run_turn(
        session["messages"] + [{"role": "user", "content": feedback_msg}]
    )
    session["messages"] = updated

    return {"saved": True, "message": reply}
