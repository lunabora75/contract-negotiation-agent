"""
FastAPI backend — single-agent contract negotiation.
"""

import io
import os
import uuid
import datetime
from pathlib import Path
from typing import Dict

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from agent import NegotiationAgent

# ── app ───────────────────────────────────────────────────────────────────
app = FastAPI(title="Contract Negotiation Agent", version="3.0.0")

_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── session store ─────────────────────────────────────────────────────────
SESSIONS: Dict[str, dict] = {}

# ── file text extraction ──────────────────────────────────────────────────
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
            raise HTTPException(500, "pypdf is not installed.")

    if ext in (".docx",):
        try:
            from docx import Document
            doc   = Document(io.BytesIO(content))
            paras = [p.text for p in doc.paragraphs if p.text.strip()]
            return "\n".join(paras)
        except ImportError:
            raise HTTPException(500, "python-docx is not installed.")

    if ext in (".txt", ".md", ""):
        return content.decode("utf-8", errors="replace")

    raise HTTPException(415, f"Unsupported file type '{ext}'. Please upload PDF, DOCX, or TXT.")

# ── negotiation-complete heuristic ────────────────────────────────────────
def _negotiation_complete(reply: str) -> bool:
    markers = [
        "final agreed terms", "forwarded to the buyer", "sent to the buyer",
        "buyer for approval", "buyer for formal approval",
        "negotiation is complete", "summary of outcomes",
        "we have reached agreement", "session complete",
        "all items have been agreed", "agreement has been reached",
    ]
    low = reply.lower()
    return any(m in low for m in markers)

# ── request models ─────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str

class FeedbackRequest(BaseModel):
    rating:      int
    outcome:     str
    what_worked: str = ""
    what_didnt:  str = ""
    notes:       str = ""

class ApprovalRequest(BaseModel):
    decision:  str        # "approved" or "rejected"
    comments:  str = ""
    approver:  str = ""

# ── routes ─────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok", "model": os.getenv("MODEL", "claude-sonnet-4-5")}


@app.post("/api/sessions")
async def create_session(file: UploadFile = File(...)):
    content  = await file.read()
    filename = file.filename or "upload.txt"

    if len(content) == 0:
        raise HTTPException(400, "Uploaded file is empty.")
    if len(content) > 10 * 1024 * 1024:
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
        "approval":   None,
        "created_at": datetime.datetime.utcnow().isoformat(),
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


@app.get("/api/sessions/{session_id}/summary")
def get_summary(session_id: str):
    """Return the full negotiation transcript for the buyer approval page."""
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return {
        "session_id": session_id,
        "filename":   session.get("filename", ""),
        "chat":       session.get("chat", []),
        "approval":   session.get("approval"),
        "created_at": session.get("created_at", ""),
    }


@app.post("/api/sessions/{session_id}/approval")
def submit_approval(session_id: str, body: ApprovalRequest):
    """Buyer approves or rejects the negotiated terms. Saved for agent learning."""
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    decision = body.decision.lower()
    if decision not in ("approved", "rejected"):
        raise HTTPException(400, "decision must be 'approved' or 'rejected'")

    session["approval"] = {
        "decision":  decision,
        "comments":  body.comments,
        "approver":  body.approver,
        "timestamp": datetime.datetime.utcnow().isoformat(),
    }

    # Translate approval decision into agent feedback for learning
    rating  = 5 if decision == "approved" else 2
    outcome = "agreed" if decision == "approved" else "no_deal"
    feedback_msg = (
        f"Buyer approval decision received: {decision.upper()}. "
        f"Approver: {body.approver or 'anonymous'}. "
        f"Comments: {body.comments or 'none'}. "
        f"Please call the save_feedback tool with rating={rating}, "
        f"outcome='{outcome}', notes='{body.comments}'"
    )
    agent = NegotiationAgent()
    _, updated = agent.run_turn(
        session["messages"] + [{"role": "user", "content": feedback_msg}]
    )
    session["messages"] = updated

    return {"saved": True, "decision": decision}


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
