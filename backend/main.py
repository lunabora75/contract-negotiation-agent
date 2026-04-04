"""
FastAPI backend — Contract Negotiation Agent v4
Status flow: uploaded → sent_for_negotiation → negotiation_in_progress → pending_approval → approved/rejected
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
app = FastAPI(title="Contract Negotiation Agent", version="4.0.0")

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

# ── status constants ──────────────────────────────────────────────────────
S_UPLOADED         = "uploaded"
S_SENT_FOR_NEG     = "sent_for_negotiation"
S_NEG_IN_PROGRESS  = "negotiation_in_progress"
S_PENDING_APPROVAL = "pending_approval"
S_APPROVED         = "approved"
S_REJECTED         = "rejected"
S_RENEGOTIATE      = "re_negotiate"
S_PENDING_OFFLINE  = "pending_offline_review"

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
        "sent to the category manager", "forwarded to the category manager",
        "category manager for approval", "pending category manager approval",
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


@app.get("/api/sessions")
def list_sessions():
    """List all sessions with status — used by both CM and Vendor portals."""
    return [
        {
            "session_id": s["session_id"],
            "filename":   s["filename"],
            "status":     s.get("status", S_UPLOADED),
            "created_at": s.get("created_at", ""),
            "approval":   s.get("approval"),
        }
        for s in sorted(
            SESSIONS.values(),
            key=lambda x: x.get("created_at", ""),
            reverse=True,
        )
    ]


@app.post("/api/sessions")
async def create_session(file: UploadFile = File(...)):
    """
    Upload a contract SOW. Extracts text and stores session with status=uploaded.
    The agent does NOT run at this point — Category Manager must trigger it.
    """
    content  = await file.read()
    filename = file.filename or "upload.txt"

    if len(content) == 0:
        raise HTTPException(400, "Uploaded file is empty.")
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(413, "File too large. Maximum size is 10 MB.")

    sow_text   = _extract_text(filename, content)
    session_id = uuid.uuid4().hex[:10]

    SESSIONS[session_id] = {
        "session_id": session_id,
        "filename":   filename,
        "sow_text":   sow_text,
        "messages":   [],
        "chat":       [],
        "status":     S_UPLOADED,
        "approval":   None,
        "created_at": datetime.datetime.utcnow().isoformat(),
    }

    return {
        "session_id": session_id,
        "filename":   filename,
        "status":     S_UPLOADED,
    }


@app.post("/api/sessions/{session_id}/trigger")
def trigger_negotiation(session_id: str):
    """Category Manager sends the contract to the Agent for negotiation or re-negotiation."""
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session.get("status") not in (S_UPLOADED, S_SENT_FOR_NEG, S_RENEGOTIATE):
        raise HTTPException(400, f"Cannot trigger from status: {session.get('status')}")
    # For re-negotiation: reset prior chat so agent starts fresh with the CM reason as context
    if session.get("status") == S_RENEGOTIATE:
        session["messages"] = []
        session["chat"]     = []
        session["approval"] = None
    session["status"] = S_SENT_FOR_NEG
    return {"session_id": session_id, "status": S_SENT_FOR_NEG}


@app.post("/api/sessions/{session_id}/initiate")
def initiate_negotiation(session_id: str):
    """
    Vendor opens the negotiation chat.
    If status is sent_for_negotiation, runs the agent's opening turn.
    If already in_progress, returns existing chat history.
    """
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session.get("status") not in (S_SENT_FOR_NEG, S_NEG_IN_PROGRESS):
        raise HTTPException(400, f"Session not ready for negotiation. Current status: {session.get('status')}")

    if session.get("status") == S_SENT_FOR_NEG:
        agent       = NegotiationAgent()
        reply, msgs = agent.run_turn(
            [],
            sow_text           = session["sow_text"],
            renegotiate_reason = session.get("renegotiate_reason"),
        )
        session["messages"] = msgs
        session["chat"]     = [{"role": "agent", "content": reply}]
        session["status"]   = S_NEG_IN_PROGRESS
        # Store extraction + benchmark data for explainability on approval page
        if agent.captured_tools:
            session["analysis"] = agent.captured_tools

    last_msg = session["chat"][-1]["content"] if session.get("chat") else ""
    return {
        "session_id":           session_id,
        "filename":             session["filename"],
        "chat":                 session.get("chat", []),
        "status":               session["status"],
        "negotiation_complete": _negotiation_complete(last_msg),
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

    complete = _negotiation_complete(reply)
    if complete and session.get("status") == S_NEG_IN_PROGRESS:
        session["status"] = S_PENDING_APPROVAL

    return {
        "reply":                reply,
        "negotiation_complete": complete,
        "status":               session["status"],
    }


@app.get("/api/sessions/{session_id}/analysis")
def get_analysis(session_id: str):
    """Return extraction + benchmark analysis for the explainability panel on the approval page."""
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    analysis = session.get("analysis")
    if not analysis:
        raise HTTPException(404, "No analysis data available — negotiation may not have started yet.")
    return analysis


@app.get("/api/sessions/{session_id}/summary")
def get_summary(session_id: str):
    """Full negotiation transcript — used by approval page."""
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return {
        "session_id": session_id,
        "filename":   session.get("filename", ""),
        "chat":       session.get("chat", []),
        "status":     session.get("status", S_UPLOADED),
        "approval":   session.get("approval"),
        "created_at": session.get("created_at", ""),
    }


@app.post("/api/sessions/{session_id}/approval")
def submit_approval(session_id: str, body: ApprovalRequest):
    """Category Manager approves, requests re-negotiation, or sends for offline review."""
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    decision = body.decision.lower()
    if decision not in ("approved", "renegotiate", "offline_review"):
        raise HTTPException(400, "decision must be 'approved', 'renegotiate', or 'offline_review'")

    session["approval"] = {
        "decision":  decision,
        "comments":  body.comments,
        "approver":  body.approver,
        "timestamp": datetime.datetime.utcnow().isoformat(),
    }

    if decision == "approved":
        session["status"] = S_APPROVED
        rating, outcome = 5, "agreed"
    elif decision == "renegotiate":
        session["status"]              = S_RENEGOTIATE
        session["renegotiate_reason"]  = body.comments
        rating, outcome = 2, "no_deal"
    else:  # offline_review
        session["status"] = S_PENDING_OFFLINE
        rating, outcome = 3, "partial"

    # Feed the decision back to the agent for self-learning
    feedback_msg = (
        f"Category Manager decision: {decision.upper()}. "
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

    return {"saved": True, "decision": decision, "status": session["status"]}


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
