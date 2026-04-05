"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const C = {
  dark: "#09131b", orange: "#F89738", gray: "#8B8B8B",
  light: "#F4F4F4", border: "#DBDBDB", white: "#FFFFFF",
  orangeBg: "#FFF8F0", orangeBorder: "#FDDCB0",
};
const FONT_HEAD = "'Raleway', sans-serif";
const FONT_BODY = "'Montserrat', sans-serif";

// ── Types ─────────────────────────────────────────────────────────────────
interface ChatMessage { role: "agent" | "user"; content: string; }
interface ActiveSession {
  session_id: string;
  filename:   string;
  status:     string;
}

// ── Inline renderer ────────────────────────────────────────────────────────
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**"))
      return <strong key={i} className="font-semibold" style={{ color: C.dark }}>{seg.slice(2, -2)}</strong>;
    if (seg.startsWith("`") && seg.endsWith("`"))
      return <code key={i} className="font-mono text-xs px-1 py-0.5 rounded"
        style={{ color: C.orange, background: C.orangeBg, border: `1px solid ${C.orangeBorder}` }}>{seg.slice(1, -1)}</code>;
    return <span key={i}>{seg}</span>;
  });
}

// Normalise column names so legacy "Market p50" / "Delta from Market" wording
// is always shown as "Benchmark" / "Delta from Benchmark" regardless of what
// the model returns.
function normaliseHeader(h: string): string {
  return h
    .replace(/market\s*p50/gi, "Benchmark")
    .replace(/delta\s+from\s+market/gi, "Delta from Benchmark")
    .replace(/\bp50\b/gi, "Benchmark");
}

function MdTable({ lines }: { lines: string[] }) {
  const dataLines = lines.filter(l => !/^\|[\s:|-]+\|$/.test(l.trim()));
  const rows = dataLines.map(l =>
    l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim())
  );
  if (rows.length === 0) return null;
  const [rawHeaders, ...bodyRows] = rows;
  const headers = rawHeaders.map(normaliseHeader);
  return (
    <div className="overflow-x-auto my-2 rounded-lg" style={{ border: `1px solid ${C.border}` }}>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ background: C.orangeBg }}>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold whitespace-nowrap"
                style={{ color: C.dark, borderBottom: `2px solid ${C.orange}`, fontFamily: FONT_HEAD }}>
                {renderInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? C.white : "#FAFAFA" }}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 whitespace-nowrap"
                  style={{ color: C.dark, borderBottom: `1px solid ${C.border}`, fontFamily: FONT_BODY }}>
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MdContent({ text }: { text: string }) {
  type Block = { type: "table"; lines: string[] } | { type: "line"; content: string };
  const blocks: Block[] = [];
  const rawLines = text.split("\n");
  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    if (/^\|.+\|/.test(line.trim())) {
      const tableLines: string[] = [];
      while (i < rawLines.length && /^\|.+\|/.test(rawLines[i].trim())) {
        tableLines.push(rawLines[i]); i++;
      }
      blocks.push({ type: "table", lines: tableLines });
    } else {
      blocks.push({ type: "line", content: line }); i++;
    }
  }
  return (
    <div className="space-y-1">
      {blocks.map((block, bi) => {
        if (block.type === "table") return <MdTable key={bi} lines={block.lines} />;
        const line = block.content;
        if (!line.trim()) return <div key={bi} className="h-1" />;
        // Skip bare separator lines like "--" or "---" — render as thin spacer
        if (/^[\s]*-{2,}\s*$/.test(line)) return <div key={bi} className="h-2" />;
        if (/^#{2,3}\s/.test(line))
          return <p key={bi} className="font-bold text-sm mt-3 mb-1" style={{ color: C.dark, fontFamily: FONT_HEAD }}>
            {line.replace(/^#+\s/, "")}
          </p>;
        // Require a whitespace after the bullet char so "--" is never treated as a bullet
        if (/^[\s]*[-•▸]\s/.test(line))
          return (
            <div key={bi} className="flex gap-2 text-sm">
              <span className="shrink-0 mt-0.5 text-xs" style={{ color: C.orange }}>▸</span>
              <span className="leading-relaxed" style={{ color: C.dark, fontFamily: FONT_BODY }}>
                {renderInline(line.replace(/^[\s]*[-•▸]\s*/, ""))}
              </span>
            </div>
          );
        return <p key={bi} className="text-sm leading-relaxed" style={{ color: C.dark, fontFamily: FONT_BODY }}>
          {renderInline(line)}
        </p>;
      })}
    </div>
  );
}

// ── Chat bubble ────────────────────────────────────────────────────────────
function Bubble({ msg }: { msg: ChatMessage }) {
  const isAgent = msg.role === "agent";
  return (
    <div className={`flex gap-3 ${isAgent ? "" : "flex-row-reverse"}`}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5"
        style={{ background: isAgent ? C.orange : C.dark }}>
        {isAgent ? "AI" : "You"}
      </div>
      <div className="max-w-[78%] rounded-2xl px-4 py-3"
        style={{
          background: isAgent ? C.white : C.dark,
          border:     isAgent ? `1px solid ${C.border}` : "none",
          borderRadius: isAgent ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
        }}>
        {isAgent ? <MdContent text={msg.content} /> : (
          <p className="text-sm leading-relaxed" style={{ color: C.white, fontFamily: FONT_BODY }}>{msg.content}</p>
        )}
      </div>
    </div>
  );
}

// ── Typing indicator ───────────────────────────────────────────────────────
function Typing() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
        style={{ background: C.orange }}>AI</div>
      <div className="rounded-2xl px-4 py-3 flex items-center gap-1"
        style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: "4px 18px 18px 18px" }}>
        {[0, 1, 2].map(d => (
          <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
            style={{ background: C.orange, animationDelay: `${d * 150}ms` }} />
        ))}
      </div>
    </div>
  );
}

export default function VendorPage() {
  const router = useRouter();

  // Session selection
  const [availableSessions, setAvailableSessions] = useState<ActiveSession[]>([]);
  const [newNegSessions,    setNewNegSessions]    = useState<ActiveSession[]>([]);
  const [reNegSessions,     setReNegSessions]     = useState<ActiveSession[]>([]);
  const [loadingList,        setLoadingList]        = useState(true);
  const [activeSession,      setActiveSession]      = useState<ActiveSession | null>(null);
  const [connectingId,       setConnectingId]       = useState<string | null>(null);

  // Chat
  const [messages,         setMessages]         = useState<ChatMessage[]>([]);
  const [input,            setInput]            = useState("");
  const [loading,          setLoading]          = useState(false);
  const [negotiationDone,  setNegotiationDone]  = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // ── Load available sessions ─────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/api/sessions`);
      const data: ActiveSession[] = await res.json();
      const newNegotiations = data.filter(s =>
        s.status === "sent_for_negotiation" || s.status === "negotiation_in_progress"
      );
      const reNegotiations = data.filter(s =>
        s.status === "sent_for_renegotiation"
      );
      setAvailableSessions([...newNegotiations, ...reNegotiations]);
      setNewNegSessions(newNegotiations);
      setReNegSessions(reNegotiations);
    } catch { /* ignore */ }
    setLoadingList(false);
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Auto-refresh if no active session yet
  useEffect(() => {
    if (activeSession) return;
    const iv = setInterval(loadSessions, 8000);
    return () => clearInterval(iv);
  }, [activeSession, loadSessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Connect to a session (initiate) ────────────────────────────────────
  const connectToSession = async (session: ActiveSession) => {
    setConnectingId(session.session_id);
    try {
      const res  = await fetch(`${API}/api/sessions/${session.session_id}/initiate`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to initiate negotiation");
      const data = await res.json();
      setActiveSession(session);
      setMessages(data.chat || []);
      if (data.negotiation_complete) setNegotiationDone(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to connect.");
    } finally {
      setConnectingId(null);
    }
  };

  // ── Send a message ──────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const msg = input.trim();
    if (!msg || !activeSession || loading || negotiationDone) return;
    setInput("");
    setMessages(p => [...p, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/sessions/${activeSession.session_id}/chat`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: msg }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages(p => [...p, { role: "agent", content: data.reply }]);
      if (data.negotiation_complete) setNegotiationDone(true);
    } catch (e) {
      setMessages(p => [...p, { role: "agent", content: `⚠️ ${e instanceof Error ? e.message : "Error"}` }]);
    } finally {
      setLoading(false);
    }
  }, [input, activeSession, loading, negotiationDone]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: C.light, fontFamily: FONT_BODY }}>

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <header style={{ background: C.white, flexShrink: 0 }}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="text-sm transition-opacity hover:opacity-70"
              style={{ color: C.orange, fontFamily: FONT_BODY }}>← Home</button>
            <div className="w-px h-4" style={{ background: C.border }} />
            <img src="/mresult-logo.png" alt="MResult" style={{ height: 34, width: "auto", display: "block" }} />
            <span className="text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ background: C.dark, color: C.orange, border: `1px solid ${C.orange}`, fontFamily: FONT_BODY }}>
              Vendor Portal
            </span>
          </div>
          {activeSession && (
            <div className="flex items-center gap-2">
              <span className="text-xs truncate max-w-[180px]" style={{ color: C.gray }}>
                📄 {activeSession.filename}
              </span>
              {!negotiationDone && (
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.orange }} />
              )}
            </div>
          )}
        </div>
        <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${C.orange} 0%, ${C.dark} 100%)` }} />
      </header>

      {/* ── No active session — picker ──────────────────────────────────── */}
      {!activeSession && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-lg">
            {loadingList ? (
              <div className="text-center">
                <div className="w-10 h-10 border-2 rounded-full animate-spin mx-auto mb-4"
                  style={{ borderColor: C.border, borderTopColor: C.orange }} />
                <p className="text-sm" style={{ color: C.gray }}>Checking for active negotiations…</p>
              </div>
            ) : availableSessions.length === 0 ? (
              <div className="text-center rounded-2xl p-10"
                style={{ background: C.white, border: `1px solid ${C.border}` }}>
                <div className="text-5xl mb-4">📭</div>
                <h2 className="font-bold text-xl mb-2" style={{ color: C.dark, fontFamily: FONT_HEAD }}>
                  No Active Negotiations
                </h2>
                <p className="text-sm mb-6" style={{ color: C.gray }}>
                  The Category Manager has not yet sent a contract for negotiation. Please check back shortly.
                </p>
                <button onClick={loadSessions}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm"
                  style={{ background: C.light, color: C.dark, border: `1px solid ${C.border}`, fontFamily: FONT_BODY }}>
                  ↻ Check Again
                </button>
              </div>
            ) : (
              <div className="space-y-6">

                {/* Section 1: Ready for Negotiation */}
                {newNegSessions.length > 0 && (
                  <div>
                    <h2 className="font-bold text-lg mb-1" style={{ color: C.dark, fontFamily: FONT_HEAD }}>
                      Ready for Negotiation
                    </h2>
                    <p className="text-sm mb-4" style={{ color: C.gray }}>
                      Select a contract to begin or continue negotiation
                    </p>
                    <div className="space-y-3">
                      {newNegSessions.map(s => (
                        <div key={s.session_id}
                          className="rounded-xl overflow-hidden flex items-center justify-between gap-4"
                          style={{ background: C.white, border: `2px solid ${C.orange}` }}>
                          <div className="w-1 self-stretch shrink-0" style={{ background: C.orange }} />
                          <div className="flex items-center gap-3 flex-1 py-5 pr-2">
                            <span className="text-2xl">📄</span>
                            <div>
                              <p className="font-semibold text-sm" style={{ color: C.dark }}>{s.filename}</p>
                              <p className="text-xs mt-0.5" style={{ color: C.gray }}>
                                {s.status === "negotiation_in_progress" ? "Negotiation in progress" : "Ready to start"}
                              </p>
                            </div>
                          </div>
                          <div className="py-5 pr-5">
                            <button
                              onClick={() => connectToSession(s)}
                              disabled={connectingId !== null}
                              className="px-4 py-2 rounded-lg font-semibold text-sm shrink-0"
                              style={{ background: C.orange, color: C.white, fontFamily: FONT_BODY, opacity: connectingId === s.session_id ? 0.6 : 1 }}>
                              {connectingId === s.session_id ? "Connecting…" : "Start Negotiation →"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 2: Pending Re-negotiation */}
                {reNegSessions.length > 0 && (
                  <div>
                    <h2 className="font-bold text-lg mb-1" style={{ color: C.dark, fontFamily: FONT_HEAD }}>
                      Pending Re-negotiation
                    </h2>
                    <p className="text-sm mb-4" style={{ color: C.gray }}>
                      Contracts returned for re-negotiation by the Category Manager
                    </p>
                    <div className="space-y-3">
                      {reNegSessions.map(s => (
                        <div key={s.session_id}
                          className="rounded-xl overflow-hidden flex items-center justify-between gap-4"
                          style={{ background: C.white, border: "2px solid #6366F1" }}>
                          <div className="w-1 self-stretch shrink-0" style={{ background: "#6366F1" }} />
                          <div className="flex items-center gap-3 flex-1 py-5 pr-2">
                            <span className="text-2xl">📄</span>
                            <div>
                              <p className="font-semibold text-sm" style={{ color: C.dark }}>{s.filename}</p>
                              <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1"
                                style={{ background: "#EEF2FF", color: "#4F46E5", border: "1px solid #C7D2FE" }}>
                                Re-negotiation Requested by Category Manager
                              </span>
                            </div>
                          </div>
                          <div className="py-5 pr-5">
                            <button
                              onClick={() => connectToSession(s)}
                              disabled={connectingId !== null}
                              className="px-4 py-2 rounded-lg font-semibold text-sm shrink-0"
                              style={{ background: "#4F46E5", color: C.white, fontFamily: FONT_BODY, opacity: connectingId === s.session_id ? 0.6 : 1 }}>
                              {connectingId === s.session_id ? "Connecting…" : "Resume Re-negotiation →"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Active chat ─────────────────────────────────────────────────── */}
      {activeSession && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

              {/* Opening context pill */}
              <div className="text-center">
                <span className="inline-block text-xs px-4 py-1.5 rounded-full"
                  style={{ background: C.orangeBg, color: C.orange, border: `1px solid ${C.orangeBorder}` }}>
                  🤝 Negotiating: {activeSession.filename}
                </span>
              </div>

              {messages.map((m, i) => <Bubble key={i} msg={m} />)}
              {loading && <Typing />}

              {/* Negotiation complete banner */}
              {negotiationDone && (
                <div className="rounded-xl p-5 text-center"
                  style={{ background: C.orangeBg, border: `2px solid ${C.orangeBorder}` }}>
                  <p className="text-2xl mb-2">✅</p>
                  <p className="font-bold text-sm mb-1" style={{ color: C.dark, fontFamily: FONT_HEAD }}>
                    Negotiation Complete
                  </p>
                  <p className="text-xs" style={{ color: C.gray }}>
                    The agreed terms have been sent to the Category Manager for approval.
                    You will be notified of their decision.
                  </p>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* ── Input bar ──────────────────────────────────────────────── */}
          <div style={{ flexShrink: 0, background: C.white, borderTop: `1px solid ${C.border}` }}>
            <div className="max-w-5xl mx-auto px-6 py-4">
              {negotiationDone ? (
                <p className="text-center text-sm py-2" style={{ color: C.gray }}>
                  This negotiation is complete. The Category Manager is reviewing the agreed terms.
                </p>
              ) : (
                <div className="flex gap-3 items-end">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={onKey}
                    placeholder="Type your response to the agent… (Enter to send, Shift+Enter for new line)"
                    rows={2}
                    className="flex-1 resize-none rounded-xl px-4 py-3 text-sm focus:outline-none"
                    style={{
                      background: C.light,
                      border: `1px solid ${input.trim() ? C.orange : C.border}`,
                      color: C.dark,
                      fontFamily: FONT_BODY,
                      transition: "border-color 0.15s",
                    }}
                  />
                  <button
                    onClick={send}
                    disabled={!input.trim() || loading}
                    className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-all"
                    style={{
                      background: input.trim() && !loading ? C.orange : C.border,
                      color: C.white,
                    }}>
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : "↑"}
                  </button>
                </div>
              )}
              <p className="text-[10px] text-center mt-2" style={{ color: C.border }}>
                AI Powered Contract Negotiation · All negotiations are recorded for audit purposes
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
