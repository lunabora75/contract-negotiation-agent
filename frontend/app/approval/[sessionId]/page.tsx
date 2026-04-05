"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const C = {
  dark: "#09131b", orange: "#F89738", gray: "#8B8B8B",
  light: "#F4F4F4", border: "#DBDBDB", white: "#FFFFFF",
  orangeBg: "#FFF8F0", orangeBorder: "#FDDCB0",
};
const FH = "'Raleway', sans-serif";
const FB = "'Montserrat', sans-serif";

// ── Types ─────────────────────────────────────────────────────────────────
interface ChatMessage { role: "agent" | "user"; content: string; }

interface SessionSummary {
  session_id: string;
  filename:   string;
  chat:       ChatMessage[];
  status:     string;
  approval:   { decision: string; comments: string; approver: string; timestamp: string } | null;
  created_at: string;
}

interface ExtractionRole {
  title:       string;
  level?:      string;
  fte_count?:  number;
  hourly_rate: number;
  confidence:  number;
}

interface RoleComparison {
  title:                  string;
  matched_benchmark?:     string;
  proposed_rate:          number;
  matched:                boolean;
  p25?:                   number;
  p50?:                   number;
  p75?:                   number;
  p90?:                   number;
  market_position?:       string;
  delta_from_median_pct?: number;
  target_rate?:           number;
  walk_away_rate?:        number;
  monthly_cost_exposure?: number;
}

interface AnalysisData {
  extract_sow_data?: {
    client_name?:    string;
    contract_value?: number;
    duration_months?: number;
    roles:           ExtractionRole[];
    payment_terms:   { schedule: string; type?: string; confidence: number };
    key_clauses?:    { ip_ownership?: string; termination?: string; liability_cap?: string; governing_law?: string };
    extraction_notes?: string;
  };
  lookup_benchmarks?: {
    role_comparisons:         RoleComparison[];
    total_monthly_cost_exposure?: number;
    payment_terms_assessment?: { proposed: string; preferred: string; status: string; note?: string };
  };
}

// ── Helper components ─────────────────────────────────────────────────────

function ConfidenceBadge({ score }: { score: number }) {
  const pct   = Math.round(score * 100);
  const high  = score >= 0.9;
  const med   = score >= 0.7;
  const color = high ? "#16A34A" : med ? "#D97706" : "#DC2626";
  const bg    = high ? "#F0FDF4" : med ? "#FFFBEB" : "#FFF4F4";
  const border= high ? "#BBF7D0" : med ? "#FDE68A" : "#FECACA";
  const label = high ? "High"    : med ? "Medium"  : "Low";
  return (
    <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 12, padding: "2px 8px", fontSize: 10, fontWeight: 700, fontFamily: FB, whiteSpace: "nowrap" }}>
      {label} {pct}%
    </span>
  );
}

function PositionBadge({ position }: { position?: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    below_market:       { label: "Below Benchmark",      color: "#4A90D9", bg: "#F0F6FF", border: "#C3D9F5" },
    at_market:          { label: "At Benchmark",          color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
    above_market:       { label: "Above Benchmark",       color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
    significantly_above:{ label: "Well Above Benchmark",  color: "#DC2626", bg: "#FFF4F4", border: "#FECACA" },
  };
  const m = map[position ?? ""] ?? { label: position ?? "Unknown", color: C.gray, bg: C.light, border: C.border };
  return (
    <span style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}`, borderRadius: 12, padding: "2px 9px", fontSize: 10, fontWeight: 700, fontFamily: FB, whiteSpace: "nowrap" }}>
      {m.label}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    acceptable:   { color: "#16A34A", bg: "#F0FDF4" },
    flagged:      { color: "#DC2626", bg: "#FFF4F4" },
    non_standard: { color: "#D97706", bg: "#FFFBEB" },
  };
  const m = map[status] ?? { color: C.gray, bg: C.light };
  return (
    <span style={{ background: m.bg, color: m.color, borderRadius: 12, padding: "2px 8px", fontSize: 10, fontWeight: 700, fontFamily: FB }}>
      {status.replace("_", " ")}
    </span>
  );
}

// ── Section header ────────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle, badge }: { icon: string; title: string; subtitle?: string; badge?: React.ReactNode }) {
  return (
    <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, background: C.white, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div>
          <p style={{ fontFamily: FH, fontWeight: 700, fontSize: 14, color: C.dark, margin: 0 }}>{title}</p>
          {subtitle && <p style={{ fontSize: 11, color: C.gray, margin: "2px 0 0", fontFamily: FB }}>{subtitle}</p>}
        </div>
      </div>
      {badge}
    </div>
  );
}

// ── Table helpers ─────────────────────────────────────────────────────────
function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: "8px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap", fontFamily: FB, background: C.light, borderBottom: `1px solid ${C.border}` }}>{children}</th>;
}
function Td({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return <td style={{ padding: "10px 14px", fontSize: 12, color: highlight ? C.orange : C.dark, fontWeight: highlight ? 700 : 400, fontFamily: FB, borderBottom: `1px solid ${C.border}`, verticalAlign: "middle" }}>{children}</td>;
}

// ── Plain text renderer for transcript ───────────────────────────────────
function PlainText({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {text.split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 4 }} />;
        const clean = line
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/`([^`]+)`/g, "$1")
          .replace(/^#{1,3}\s/, "")
          .replace(/^[-•▸]\s*/, "• ");
        return <p key={i} style={{ fontSize: 13, lineHeight: 1.6, color: C.dark, margin: 0, fontFamily: FB }}>{clean}</p>;
      })}
    </div>
  );
}

// ── Extract final agreed terms from chat ─────────────────────────────────
function extractFinalTerms(chat: ChatMessage[]): string | null {
  for (let i = chat.length - 1; i >= 0; i--) {
    const msg = chat[i];
    if (msg.role === "agent") {
      const lc = msg.content.toLowerCase();
      if (lc.includes("final agreed terms") || lc.includes("agreed terms") || lc.includes("summary of outcomes")) {
        return msg.content;
      }
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────
export default function ApprovalPage() {
  const params    = useParams();
  const router    = useRouter();
  const sessionId = params?.sessionId as string;

  const [summary,    setSummary]    = useState<SessionSummary | null>(null);
  const [analysis,   setAnalysis]   = useState<AnalysisData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [decision,   setDecision]   = useState<"approved" | "renegotiate" | "offline_review" | null>(null);
  const [comments,   setComments]   = useState("");
  const [approver,   setApprover]   = useState("");
  const [submitted,  setSubmitted]  = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Collapsible sections — all collapsed by default; CM decision is always visible in the sticky right panel
  const [showIntelligence, setShowIntelligence] = useState(false);
  const [showBenchmark,    setShowBenchmark]    = useState(false);
  const [showFinalTerms,   setShowFinalTerms]   = useState(false);
  const [showTranscript,   setShowTranscript]   = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    // Fetch summary and analysis in parallel
    Promise.all([
      fetch(`${API}/api/sessions/${sessionId}/summary`).then(r => { if (!r.ok) throw new Error("Session not found"); return r.json(); }),
      fetch(`${API}/api/sessions/${sessionId}/analysis`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([sum, ana]) => {
      setSummary(sum);
      setAnalysis(ana);
      setLoading(false);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, [sessionId]);

  const handleSubmit = async () => {
    if (!decision || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/sessions/${sessionId}/approval`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comments, approver }),
      });
      if (!res.ok) throw new Error("Failed to submit");
      setSubmitted(true);
      setTimeout(() => router.push("/manager"), 2000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / Error / Submitted screens ─────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.light }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: `2px solid ${C.border}`, borderTopColor: C.orange, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ fontSize: 13, color: C.gray, fontFamily: FB }}>Loading negotiation review…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.light }}>
      <div style={{ textAlign: "center", padding: 32, borderRadius: 16, background: C.white, border: `1px solid ${C.border}`, maxWidth: 360 }}>
        <p style={{ fontSize: 28, margin: "0 0 8px" }}>⚠️</p>
        <p style={{ fontFamily: FH, fontWeight: 700, color: C.dark, margin: "0 0 4px" }}>Session Not Found</p>
        <p style={{ fontSize: 13, color: C.gray, fontFamily: FB }}>{error}</p>
      </div>
    </div>
  );

  const decisionMeta = {
    approved:       { icon: "✓", title: "Terms Approved",           msg: "Negotiated terms approved and saved.",                                           iconBg: C.orangeBg,  iconBorder: C.orange },
    renegotiate:    { icon: "↩", title: "Sent for Re-negotiation",  msg: "The contract has been returned to the AI Agent for re-negotiation with the vendor.", iconBg: "#EEF2FF",   iconBorder: "#6366F1" },
    offline_review: { icon: "🔎", title: "Sent for Offline Review",  msg: "The contract is pending offline review. It will remain in your approvals queue.",   iconBg: C.light,     iconBorder: C.border  },
  };

  if (submitted) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.light }}>
      <div style={{ textAlign: "center", padding: 40, borderRadius: 20, background: C.white, border: `1px solid ${C.border}`, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", maxWidth: 400 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: decisionMeta[decision! as keyof typeof decisionMeta]?.iconBg ?? C.light, border: `2px solid ${decisionMeta[decision! as keyof typeof decisionMeta]?.iconBorder ?? C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px" }}>
          {decisionMeta[decision! as keyof typeof decisionMeta]?.icon ?? "✓"}
        </div>
        <h2 style={{ fontFamily: FH, fontWeight: 700, fontSize: 20, color: C.dark, margin: "0 0 8px" }}>
          {decisionMeta[decision! as keyof typeof decisionMeta]?.title ?? "Decision Recorded"}
        </h2>
        <p style={{ fontSize: 13, color: C.gray, fontFamily: FB, margin: "0 0 8px" }}>
          {decisionMeta[decision! as keyof typeof decisionMeta]?.msg}
        </p>
        {comments && <p style={{ fontSize: 12, background: C.light, borderRadius: 8, padding: "8px 12px", color: C.gray, fontFamily: FB, margin: "8px 0 0" }}>"{comments}"</p>}
        <p style={{ fontSize: 11, color: C.border, fontFamily: FB, marginTop: 16 }}>Returning to Category Manager portal…</p>
      </div>
    </div>
  );

  const existingApproval = summary?.approval;
  const ext   = analysis?.extract_sow_data;
  const bench = analysis?.lookup_benchmarks;
  const finalTermsMsg = summary?.chat ? extractFinalTerms(summary.chat) : null;

  // Total potential savings
  const totalSavings = bench?.total_monthly_cost_exposure ?? 0;

  return (
    <div style={{ minHeight: "100vh", background: C.light, fontFamily: FB, display: "flex", flexDirection: "column" }}>

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <header style={{ background: C.white, position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 0 #DBDBDB" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* LEFT: logo only */}
          <img src="/mresult-logo.png" alt="MResult" style={{ height: 30, width: "auto", display: "block" }} />

          {/* RIGHT: nav + badge + status + profile */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => router.push("/manager")}
              style={{ fontSize: 12, color: C.gray, background: "none", border: "none", cursor: "pointer", fontFamily: FB }}>
              ← Manager
            </button>
            <div style={{ width: 1, height: 16, background: C.border }} />
            <span style={{ fontSize: 11, fontWeight: 600, background: C.dark, color: C.orange, borderRadius: 20, padding: "3px 10px", fontFamily: FB }}>
              Contract Approval
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, fontFamily: FB,
              background: existingApproval ? (existingApproval.decision === "approved" ? C.orangeBg : C.light) : C.light,
              color: existingApproval ? (existingApproval.decision === "approved" ? C.orange : C.gray) : C.gray,
              border: `1px solid ${existingApproval ? (existingApproval.decision === "approved" ? C.orangeBorder : C.border) : C.border}`,
            }}>
              {existingApproval ? existingApproval.decision.toUpperCase() : "PENDING APPROVAL"}
            </span>
            {/* User profile avatar */}
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.orangeBg, border: `2px solid ${C.orangeBorder}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              title="Category Manager">
              <span style={{ fontSize: 10, fontWeight: 700, color: C.orange, fontFamily: FB }}>CM</span>
            </div>
          </div>
        </div>
        <div style={{ height: 2, background: `linear-gradient(90deg, ${C.orange} 0%, ${C.dark} 100%)` }} />
      </header>

      {/* ── Main content wrapper ─────────────────────────────────────────── */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 24px", width: "100%", boxSizing: "border-box", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Document info bar — full width ───────────────────────────── */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>📄</span>
            <div>
              <h1 style={{ fontFamily: FH, fontWeight: 700, fontSize: 16, color: C.dark, margin: 0 }}>{summary?.filename}</h1>
              <p style={{ fontSize: 11, color: C.gray, margin: "3px 0 0", fontFamily: FB }}>
                Negotiation Session · {summary?.created_at ? new Date(summary.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : ""}
                {ext?.client_name && ` · Client: ${ext.client_name}`}
                {ext?.duration_months && ` · ${ext.duration_months} months`}
              </p>
            </div>
          </div>
          {totalSavings > 0 && (
            <div style={{ textAlign: "right", background: C.orangeBg, border: `1px solid ${C.orangeBorder}`, borderRadius: 10, padding: "8px 14px" }}>
              <p style={{ fontSize: 10, color: C.orange, fontWeight: 700, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Monthly Savings Potential</p>
              <p style={{ fontFamily: FH, fontWeight: 800, fontSize: 18, color: C.orange, margin: 0 }}>
                ${totalSavings.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* ── Two-column row ───────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

          {/* ── LEFT COLUMN: scrollable sections ──────────────────────── */}
          <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* ── CONTRACT INTELLIGENCE (collapsible) ─────────────────── */}
            {ext && (
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
                <button
                  onClick={() => setShowIntelligence(v => !v)}
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                  <SectionHeader
                    icon="🔍"
                    title="Contract Intelligence"
                    subtitle="Roles, rates and payment terms extracted from the SOW"
                    badge={
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, background: C.light, color: C.gray, border: `1px solid ${C.border}`, borderRadius: 20, padding: "3px 10px", fontFamily: FB }}>
                          AI Extracted
                        </span>
                        <span style={{ fontSize: 13, color: C.gray }}>{showIntelligence ? "▲" : "▼"}</span>
                      </div>
                    }
                  />
                </button>

                {showIntelligence && (
                  <>
                    {/* Roles table */}
                    {ext.roles && ext.roles.length > 0 && (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                          <thead>
                            <tr>
                              <Th>Role Title</Th>
                              <Th>Level</Th>
                              <Th>FTE</Th>
                              <Th>Proposed Rate ($/hr)</Th>
                              <Th>Extraction Confidence</Th>
                            </tr>
                          </thead>
                          <tbody>
                            {ext.roles.map((role, i) => (
                              <tr key={i} style={{ background: i % 2 === 0 ? C.white : "#FAFAFA" }}>
                                <Td><strong style={{ fontFamily: FH }}>{role.title}</strong></Td>
                                <Td>{role.level || "—"}</Td>
                                <Td>{role.fte_count ?? "—"}</Td>
                                <Td highlight>${role.hourly_rate}/hr</Td>
                                <Td><ConfidenceBadge score={role.confidence} /></Td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Payment terms */}
                    <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: C.gray, fontFamily: FB }}>Payment Terms:</span>
                        <span style={{ fontFamily: FH, fontWeight: 700, fontSize: 13, color: C.dark }}>{ext.payment_terms?.schedule || "—"}</span>
                        {ext.payment_terms?.type && <span style={{ fontSize: 11, color: C.gray }}>({ext.payment_terms.type})</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: C.gray, fontFamily: FB }}>Confidence:</span>
                        <ConfidenceBadge score={ext.payment_terms?.confidence ?? 0} />
                      </div>
                    </div>

                    {/* Key clauses */}
                    {ext.key_clauses && Object.values(ext.key_clauses).some(v => v) && (
                      <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}`, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px 24px" }}>
                        {Object.entries(ext.key_clauses).filter(([, v]) => v).map(([k, v]) => (
                          <div key={k}>
                            <span style={{ fontSize: 9, color: C.gray, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              {k.replace(/_/g, " ")}:{" "}
                            </span>
                            <span style={{ fontSize: 11, color: C.dark, fontFamily: FB }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Extraction notes */}
                    {ext.extraction_notes && (
                      <div style={{ padding: "10px 20px", borderTop: `1px solid ${C.border}`, background: C.light }}>
                        <p style={{ fontSize: 11, color: C.gray, margin: 0, fontFamily: FB }}>
                          <strong>Note:</strong> {ext.extraction_notes}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── BENCHMARK ANALYSIS (collapsible) ────────────────────── */}
            {bench && bench.role_comparisons.length > 0 && (
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
                <button
                  onClick={() => setShowBenchmark(v => !v)}
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                  <SectionHeader
                    icon="📊"
                    title="Benchmark Analysis"
                    subtitle="How each proposed rate compares to internal benchmark data"
                    badge={
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {totalSavings > 0 ? (
                          <span style={{ fontSize: 11, fontWeight: 700, background: C.orangeBg, color: C.orange, border: `1px solid ${C.orangeBorder}`, borderRadius: 20, padding: "3px 10px", fontFamily: FB }}>
                            ${totalSavings.toLocaleString()} /mo potential savings
                          </span>
                        ) : null}
                        <span style={{ fontSize: 13, color: C.gray }}>{showBenchmark ? "▲" : "▼"}</span>
                      </div>
                    }
                  />
                </button>

                {showBenchmark && (
                  <>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                        <thead>
                          <tr>
                            <Th>Role</Th>
                            <Th>Vendor Rate</Th>
                            <Th>Benchmark (P50)</Th>
                            <Th>P75 Walk-away</Th>
                            <Th>Position</Th>
                            <Th>Delta vs Benchmark</Th>
                            <Th>Monthly Exposure</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {bench.role_comparisons.map((rc, i) => {
                            const delta = rc.delta_from_median_pct ?? 0;
                            const deltaColor = delta > 0 ? "#DC2626" : "#16A34A";
                            return (
                              <tr key={i} style={{ background: i % 2 === 0 ? C.white : "#FAFAFA" }}>
                                <Td><strong style={{ fontFamily: FH }}>{rc.matched_benchmark || rc.title}</strong></Td>
                                <Td highlight>${rc.proposed_rate}/hr</Td>
                                <Td>{rc.p50 ? `$${rc.p50}/hr` : "—"}</Td>
                                <Td>{rc.walk_away_rate ? `$${rc.walk_away_rate}/hr` : "—"}</Td>
                                <Td><PositionBadge position={rc.market_position} /></Td>
                                <Td>
                                  {delta !== 0 ? (
                                    <span style={{ fontSize: 12, fontWeight: 700, color: deltaColor, fontFamily: FB }}>
                                      {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
                                    </span>
                                  ) : "At benchmark"}
                                </Td>
                                <Td>
                                  {(rc.monthly_cost_exposure ?? 0) > 0
                                    ? <span style={{ color: "#DC2626", fontWeight: 700, fontFamily: FB }}>${(rc.monthly_cost_exposure!).toLocaleString()}</span>
                                    : <span style={{ color: "#16A34A" }}>—</span>}
                                </Td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Payment terms benchmark */}
                    {bench.payment_terms_assessment && (
                      <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, color: C.gray, fontFamily: FB }}>Payment Terms:</span>
                          <span style={{ fontFamily: FH, fontWeight: 700, fontSize: 13, color: C.dark }}>{bench.payment_terms_assessment.proposed}</span>
                          <span style={{ fontSize: 11, color: C.gray }}>(preferred: {bench.payment_terms_assessment.preferred})</span>
                        </div>
                        <PaymentStatusBadge status={bench.payment_terms_assessment.status} />
                        {bench.payment_terms_assessment.note && (
                          <span style={{ fontSize: 11, color: C.gray, fontFamily: FB }}>{bench.payment_terms_assessment.note}</span>
                        )}
                      </div>
                    )}

                    {/* Benchmark legend */}
                    <div style={{ padding: "10px 20px", borderTop: `1px solid ${C.border}`, background: C.light, display: "flex", gap: 20, flexWrap: "wrap" }}>
                      {[
                        { label: "P50 — Benchmark median (agent's opening target)", color: "#16A34A" },
                        { label: "P75 — Experienced range (agent's walk-away limit)", color: C.orange },
                      ].map(l => (
                        <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color }} />
                          <span style={{ fontSize: 10, color: C.gray, fontFamily: FB }}>{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── FINAL NEGOTIATED TERMS (collapsible) ────────────────── */}
            {finalTermsMsg && (
              <div style={{ background: C.white, border: `2px solid ${C.orangeBorder}`, borderRadius: 14, overflow: "hidden" }}>
                <button
                  onClick={() => setShowFinalTerms(v => !v)}
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                  <SectionHeader
                    icon="✅"
                    title="Final Negotiated Terms"
                    subtitle="Agreed terms extracted from the end of the negotiation"
                    badge={
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, background: C.orangeBg, color: C.orange, border: `1px solid ${C.orangeBorder}`, borderRadius: 20, padding: "3px 10px", fontFamily: FB }}>
                          Ready for Approval
                        </span>
                        <span style={{ fontSize: 13, color: C.gray }}>{showFinalTerms ? "▲" : "▼"}</span>
                      </div>
                    }
                  />
                </button>
                {showFinalTerms && (
                  <div style={{ padding: "16px 20px" }}>
                    <PlainText text={finalTermsMsg} />
                  </div>
                )}
              </div>
            )}

            {/* ── NEGOTIATION TRANSCRIPT (collapsible) ────────────────── */}
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
              <button
                onClick={() => setShowTranscript(v => !v)}
                style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                <SectionHeader
                  icon="💬"
                  title="Full Negotiation Transcript"
                  subtitle={`${summary?.chat.length ?? 0} messages — click to ${showTranscript ? "collapse" : "expand"}`}
                  badge={
                    <span style={{ fontSize: 13, color: C.gray }}>{showTranscript ? "▲" : "▼"}</span>
                  }
                />
              </button>
              {showTranscript && (
                <div style={{ maxHeight: 480, overflowY: "auto" }}>
                  {summary?.chat.map((msg, i) => (
                    <div key={i} style={{ padding: "14px 20px", background: msg.role === "agent" ? C.white : "#FAFAFA", borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ width: 24, height: 24, borderRadius: "50%", background: msg.role === "agent" ? C.orange : C.dark, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: C.white, flexShrink: 0 }}>
                          {msg.role === "agent" ? "AI" : "V"}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.gray, fontFamily: FB }}>
                          {msg.role === "agent" ? "Negotiation Agent" : "Vendor"}
                        </span>
                      </div>
                      <div style={{ paddingLeft: 32 }}>
                        <PlainText text={msg.content} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>{/* end left column */}

          {/* ── RIGHT COLUMN: sticky approval form ────────────────────── */}
          <div style={{ width: 340, flexShrink: 0, position: "sticky", top: 72, alignSelf: "flex-start" }}>

            {/* ── APPROVAL FORM ──────────────────────────────────────── */}
            {!existingApproval ? (
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: "22px", display: "flex", flexDirection: "column", gap: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                {/* Visual header */}
                <div style={{ borderBottom: `2px solid ${C.orange}`, paddingBottom: 14 }}>
                  <h2 style={{ fontFamily: FH, fontWeight: 700, fontSize: 15, color: C.dark, margin: "0 0 4px" }}>Category Manager Decision</h2>
                  <p style={{ fontSize: 11, color: C.gray, margin: 0, fontFamily: FB }}>Review the analysis on the left, then approve or reject</p>
                </div>

                {/* Name */}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: C.gray, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: FB }}>
                    Your Name <span style={{ color: C.orange }}>*</span>
                  </label>
                  <input type="text" value={approver} onChange={e => setApprover(e.target.value)}
                    placeholder="e.g. Jane Smith"
                    style={{ width: "100%", background: C.light, border: `1px solid ${!approver.trim() ? "#FDDCB0" : C.border}`, borderRadius: 8, padding: "9px 13px", fontSize: 12, color: C.dark, fontFamily: FB, outline: "none", boxSizing: "border-box" }} />
                  {!approver.trim() && (
                    <p style={{ fontSize: 10, color: C.orange, margin: "4px 0 0", fontFamily: FB }}>Name is required</p>
                  )}
                </div>

                {/* Decision — 3 options */}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: C.gray, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: FB }}>Decision</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {([
                      { key: "approved",       label: "✓ Approve Terms",          bg: C.orangeBg, color: C.orange,  border: C.orange,  activeBg: C.orangeBg },
                      { key: "renegotiate",    label: "↩ Re-negotiate Terms",     bg: "#EEF2FF",  color: "#4F46E5", border: "#6366F1", activeBg: "#EEF2FF" },
                      { key: "offline_review", label: "🔎 Offline Review",         bg: C.light,    color: C.dark,    border: C.dark,    activeBg: C.light   },
                    ] as const).map(opt => (
                      <button key={opt.key} onClick={() => setDecision(opt.key)}
                        style={{
                          padding: "12px 16px", borderRadius: 10, fontFamily: FB, fontWeight: 700, fontSize: 13,
                          cursor: "pointer", textAlign: "left",
                          background: decision === opt.key ? opt.activeBg : C.white,
                          color:      decision === opt.key ? opt.color : C.gray,
                          border:     `2px solid ${decision === opt.key ? opt.border : C.border}`,
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comments — mandatory for all decisions */}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: C.gray, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: FB }}>
                    Comments <span style={{ color: "#DC2626" }}>*</span> <span style={{ fontWeight: 400, textTransform: "none" }}>(required — used by the AI agent to learn)</span>
                  </label>
                  <textarea value={comments} onChange={e => setComments(e.target.value)} rows={4}
                    placeholder={
                      decision === "renegotiate"    ? "Explain what needs to be re-negotiated — the agent will use this to re-open with the vendor…" :
                      decision === "offline_review" ? "Provide context for the offline review…" :
                      "Provide feedback for the AI agent to learn from for future negotiations…"
                    }
                    style={{ width: "100%", background: C.light, border: `1px solid ${!comments.trim() && decision ? "#DC2626" : C.border}`, borderRadius: 8, padding: "9px 13px", fontSize: 12, color: C.dark, fontFamily: FB, resize: "none", outline: "none", boxSizing: "border-box" }} />
                  {!comments.trim() && decision && (
                    <p style={{ fontSize: 10, color: "#DC2626", margin: "4px 0 0", fontFamily: FB }}>Comments are required</p>
                  )}
                </div>

                {/* Submit */}
                <button onClick={handleSubmit}
                  disabled={!decision || !comments.trim() || !approver.trim() || submitting}
                  style={{
                    width: "100%", padding: "13px 0", borderRadius: 12, border: "none",
                    fontFamily: FB, fontWeight: 700, fontSize: 13,
                    cursor: (decision && comments.trim() && approver.trim()) ? "pointer" : "not-allowed",
                    background: (decision && comments.trim() && approver.trim()) ? (decision === "renegotiate" ? C.dark : C.orange) : C.border,
                    color:      (decision && comments.trim() && approver.trim()) ? C.white : C.gray,
                  }}>
                  {submitting ? "Submitting…" :
                   decision === "approved"       ? "Confirm Approval" :
                   decision === "renegotiate"    ? "Send for Re-negotiation" :
                   decision === "offline_review" ? "Move to Offline Review" :
                   "Select a Decision Above"}
                </button>

                <p style={{ fontSize: 11, color: C.border, textAlign: "center", margin: 0, fontFamily: FB }}>
                  Your decision and comments are saved and used to improve future AI negotiations
                </p>
              </div>
            ) : (
              /* Already decided */
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: "22px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: existingApproval.decision === "approved" ? C.orangeBg : C.light, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                    {existingApproval.decision === "approved" ? "✓" : "✕"}
                  </div>
                  <div>
                    <p style={{ fontFamily: FH, fontWeight: 700, fontSize: 14, color: C.dark, margin: 0 }}>
                      Terms {existingApproval.decision === "approved" ? "Approved" : "Rejected"}
                    </p>
                    <p style={{ fontSize: 11, color: C.gray, margin: "2px 0 0", fontFamily: FB }}>
                      {existingApproval.approver && `By ${existingApproval.approver} · `}
                      {new Date(existingApproval.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                {existingApproval.comments && (
                  <p style={{ fontSize: 12, background: C.light, borderRadius: 8, padding: "10px 14px", color: C.dark, margin: 0, fontFamily: FB }}>
                    "{existingApproval.comments}"
                  </p>
                )}
              </div>
            )}

          </div>{/* end right column */}

        </div>{/* end two-column row */}

        {/* Footer */}
        <p style={{ textAlign: "center", fontSize: 11, color: C.border, fontFamily: FB, paddingBottom: 8 }}>
          MResult Confidential · AI Powered Contract Negotiation
        </p>

      </div>
    </div>
  );
}
