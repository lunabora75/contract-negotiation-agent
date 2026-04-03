"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface ChatMessage { role: "agent" | "user"; content: string; }

interface SessionSummary {
  session_id: string;
  filename:   string;
  chat:       ChatMessage[];
  approval:   { decision: string; comments: string; approver: string; timestamp: string } | null;
  created_at: string;
}

// ── Simple text renderer (strips markdown symbols for clean approval view) ─
function PlainText({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const clean = line
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/`([^`]+)`/g, "$1")
          .replace(/^#{1,3}\s/, "")
          .replace(/^[-•▸]\s*/, "• ");
        return (
          <p key={i} className="text-sm leading-relaxed" style={{ color: "#09131b", fontFamily: "'Montserrat', sans-serif" }}>
            {clean}
          </p>
        );
      })}
    </div>
  );
}

export default function ApprovalPage() {
  const params    = useParams();
  const sessionId = params?.sessionId as string;

  const [summary,   setSummary]   = useState<SessionSummary | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [decision,  setDecision]  = useState<"approved" | "rejected" | "">("");
  const [comments,  setComments]  = useState("");
  const [approver,  setApprover]  = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting,setSubmitting]= useState(false);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`${API}/api/sessions/${sessionId}/summary`)
      .then(r => {
        if (!r.ok) throw new Error("Session not found");
        return r.json();
      })
      .then(data => { setSummary(data); setLoading(false); })
      .catch(e  => { setError(e.message); setLoading(false); });
  }, [sessionId]);

  const handleSubmit = async () => {
    if (!decision || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/sessions/${sessionId}/approval`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ decision, comments, approver }),
      });
      if (!res.ok) throw new Error("Failed to submit");
      setSubmitted(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F4F4F4" }}>
      <div className="text-center">
        <div className="w-10 h-10 border-2 rounded-full animate-spin mx-auto mb-3"
          style={{ borderColor: "#DBDBDB", borderTopColor: "#F89738" }} />
        <p className="text-sm font-body" style={{ color: "#8B8B8B", fontFamily: "'Montserrat', sans-serif" }}>
          Loading negotiation summary…
        </p>
      </div>
    </div>
  );

  // ── Error ──
  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F4F4F4" }}>
      <div className="text-center p-8 rounded-xl max-w-sm" style={{ background: "#FFFFFF", border: "1px solid #DBDBDB" }}>
        <p className="text-2xl mb-3">⚠️</p>
        <p className="font-heading font-bold mb-1" style={{ color: "#09131b", fontFamily: "'Raleway', sans-serif" }}>Session Not Found</p>
        <p className="text-sm" style={{ color: "#8B8B8B", fontFamily: "'Montserrat', sans-serif" }}>{error}</p>
      </div>
    </div>
  );

  // ── Already submitted ──
  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F4F4F4" }}>
      <div className="text-center p-10 rounded-xl max-w-md" style={{ background: "#FFFFFF", border: "1px solid #DBDBDB", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-5"
          style={{ background: decision === "approved" ? "#FFF8F0" : "#FFF4F4", border: `2px solid ${decision === "approved" ? "#F89738" : "#DBDBDB"}` }}>
          {decision === "approved" ? "✓" : "✕"}
        </div>
        <h2 className="font-heading font-bold text-xl mb-2"
          style={{ color: "#09131b", fontFamily: "'Raleway', sans-serif" }}>
          {decision === "approved" ? "Terms Approved" : "Terms Rejected"}
        </h2>
        <p className="text-sm mb-1" style={{ color: "#8B8B8B", fontFamily: "'Montserrat', sans-serif" }}>
          {decision === "approved"
            ? "The negotiated terms have been approved. The vendor will be notified."
            : "The negotiated terms have been rejected. The agent will use your feedback to improve."}
        </p>
        {comments && (
          <p className="text-xs mt-3 p-3 rounded-lg" style={{ background: "#F4F4F4", color: "#8B8B8B", fontFamily: "'Montserrat', sans-serif" }}>
            "{comments}"
          </p>
        )}
      </div>
    </div>
  );

  // ── Already has an approval decision stored ──
  const existingApproval = summary?.approval;

  return (
    <div className="min-h-screen" style={{ background: "#F4F4F4", fontFamily: "'Montserrat', sans-serif" }}>

      {/* Header */}
      <header style={{ background: "#FFFFFF", borderBottom: "1px solid #DBDBDB" }}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-bold text-xl" style={{ fontFamily: "'Raleway', sans-serif", color: "#09131b" }}>
              MResult
            </span>
            <div className="h-5 w-px" style={{ background: "#DBDBDB" }} />
            <span className="text-sm font-semibold" style={{ color: "#09131b" }}>Buyer Approval</span>
          </div>
          <span className="text-xs px-3 py-1 rounded-full font-semibold"
            style={{
              background: existingApproval
                ? (existingApproval.decision === "approved" ? "#FFF8F0" : "#FFF4F4")
                : "#F4F4F4",
              color: existingApproval
                ? (existingApproval.decision === "approved" ? "#F89738" : "#8B8B8B")
                : "#8B8B8B",
              border: `1px solid ${existingApproval ? (existingApproval.decision === "approved" ? "#FDDCB0" : "#DBDBDB") : "#DBDBDB"}`,
            }}>
            {existingApproval ? existingApproval.decision.toUpperCase() : "PENDING APPROVAL"}
          </span>
        </div>
        <div className="h-0.5" style={{ background: "linear-gradient(90deg, #F89738 0%, #FFFFFF 100%)" }} />
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Document info */}
        <div className="rounded-xl p-5" style={{ background: "#FFFFFF", border: "1px solid #DBDBDB" }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">📄</span>
            <div>
              <h1 className="font-bold text-base" style={{ fontFamily: "'Raleway', sans-serif", color: "#09131b" }}>
                {summary?.filename}
              </h1>
              <p className="text-xs mt-0.5" style={{ color: "#8B8B8B" }}>
                Negotiation Session · {summary?.created_at ? new Date(summary.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Negotiation transcript */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #DBDBDB" }}>
          <div className="px-5 py-4 flex items-center gap-2" style={{ background: "#FFFFFF", borderBottom: "1px solid #DBDBDB" }}>
            <span className="text-sm font-bold" style={{ fontFamily: "'Raleway', sans-serif", color: "#09131b" }}>
              Negotiation Transcript
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#FFF8F0", color: "#F89738", border: "1px solid #FDDCB0" }}>
              {summary?.chat.length} messages
            </span>
          </div>
          <div className="divide-y divide-gray-200 overflow-y-auto max-h-[480px]">
            {summary?.chat.map((msg, i) => (
              <div key={i} className="px-5 py-4" style={{ background: msg.role === "agent" ? "#FFFFFF" : "#FAFAFA" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ background: msg.role === "agent" ? "#F89738" : "#09131b", flexShrink: 0 }}>
                    {msg.role === "agent" ? "AI" : "You"}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "#8B8B8B" }}>
                    {msg.role === "agent" ? "Negotiation Agent" : "Vendor / User"}
                  </span>
                </div>
                <div className="pl-8">
                  <PlainText text={msg.content} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Approval form — only show if not yet decided */}
        {!existingApproval ? (
          <div className="rounded-xl p-6 space-y-5" style={{ background: "#FFFFFF", border: "1px solid #DBDBDB", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <div>
              <h2 className="font-bold text-base" style={{ fontFamily: "'Raleway', sans-serif", color: "#09131b" }}>
                Buyer Decision
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "#8B8B8B" }}>
                Review the negotiation above and approve or reject the agreed terms
              </p>
            </div>

            {/* Approver name */}
            <div>
              <label className="text-[10px] uppercase tracking-widest block mb-1.5" style={{ color: "#8B8B8B" }}>
                Your Name (optional)
              </label>
              <input
                type="text"
                value={approver}
                onChange={e => setApprover(e.target.value)}
                placeholder="e.g. Jane Smith"
                className="w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none"
                style={{ background: "#F4F4F4", border: "1px solid #DBDBDB", color: "#09131b", fontFamily: "'Montserrat', sans-serif" }}
              />
            </div>

            {/* Decision buttons */}
            <div>
              <label className="text-[10px] uppercase tracking-widest block mb-2" style={{ color: "#8B8B8B" }}>
                Decision
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDecision("approved")}
                  className="py-4 rounded-xl font-semibold text-sm transition-all"
                  style={{
                    border: decision === "approved" ? "2px solid #F89738" : "2px solid #DBDBDB",
                    background: decision === "approved" ? "#FFF8F0" : "#FFFFFF",
                    color: decision === "approved" ? "#F89738" : "#8B8B8B",
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  ✓ Approve Terms
                </button>
                <button
                  onClick={() => setDecision("rejected")}
                  className="py-4 rounded-xl font-semibold text-sm transition-all"
                  style={{
                    border: decision === "rejected" ? "2px solid #09131b" : "2px solid #DBDBDB",
                    background: decision === "rejected" ? "#F4F4F4" : "#FFFFFF",
                    color: decision === "rejected" ? "#09131b" : "#8B8B8B",
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  ✕ Reject Terms
                </button>
              </div>
            </div>

            {/* Comments */}
            <div>
              <label className="text-[10px] uppercase tracking-widest block mb-1.5" style={{ color: "#8B8B8B" }}>
                Comments {decision === "rejected" ? "(required)" : "(optional)"}
              </label>
              <textarea
                value={comments}
                onChange={e => setComments(e.target.value)}
                rows={4}
                placeholder={
                  decision === "rejected"
                    ? "Please explain why the terms are being rejected and what changes are needed…"
                    : "Any comments or conditions for approval…"
                }
                className="w-full rounded-lg px-4 py-3 text-sm resize-none focus:outline-none"
                style={{
                  background: "#F4F4F4",
                  border: "1px solid #DBDBDB",
                  color: "#09131b",
                  fontFamily: "'Montserrat', sans-serif",
                }}
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!decision || (decision === "rejected" && !comments.trim()) || submitting}
              className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: decision && !(decision === "rejected" && !comments.trim()) ? "#F89738" : "#F4F4F4",
                color: decision && !(decision === "rejected" && !comments.trim()) ? "#FFFFFF" : "#BBBBBB",
                cursor: decision && !(decision === "rejected" && !comments.trim()) ? "pointer" : "not-allowed",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              {submitting ? "Submitting…" : decision === "approved" ? "Confirm Approval" : decision === "rejected" ? "Submit Rejection" : "Select a Decision Above"}
            </button>

            <p className="text-xs text-center" style={{ color: "#BBBBBB" }}>
              Your decision will be recorded and used to improve future negotiations
            </p>
          </div>
        ) : (
          /* Already decided — show decision summary */
          <div className="rounded-xl p-6" style={{ background: "#FFFFFF", border: "1px solid #DBDBDB" }}>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                style={{ background: existingApproval.decision === "approved" ? "#FFF8F0" : "#F4F4F4" }}>
                {existingApproval.decision === "approved" ? "✓" : "✕"}
              </span>
              <div>
                <p className="font-bold text-sm" style={{ fontFamily: "'Raleway', sans-serif", color: "#09131b" }}>
                  Terms {existingApproval.decision === "approved" ? "Approved" : "Rejected"}
                </p>
                <p className="text-xs" style={{ color: "#8B8B8B" }}>
                  {existingApproval.approver && `By ${existingApproval.approver} · `}
                  {new Date(existingApproval.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
            {existingApproval.comments && (
              <p className="text-sm p-3 rounded-lg" style={{ background: "#F4F4F4", color: "#09131b" }}>
                "{existingApproval.comments}"
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
