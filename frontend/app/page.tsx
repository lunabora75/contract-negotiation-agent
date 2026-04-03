"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const API    = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const MAX_MB = 10;
const ACCEPT = ".pdf,.docx,.txt";

// ── types ──────────────────────────────────────────────────────────────────
interface ChatMessage { role: "agent" | "user"; content: string; }
interface FeedbackForm {
  rating: number; outcome: string;
  what_worked: string; what_didnt: string; notes: string;
}

// ── helpers ────────────────────────────────────────────────────────────────
const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`;

const fileExt = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

// ── MResult logo SVG (inline, brand-compliant full-color) ──────────────────
function MResultLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 60" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="MResult">
      {/* Left wing */}
      <path d="M18 44 C8 44 4 36 8 28 C12 20 22 18 26 26 Z" fill="#1a1a1a" />
      {/* Right wing */}
      <path d="M38 44 C48 44 52 36 48 28 C44 20 34 18 30 26 Z" fill="#1a1a1a" />
      {/* Orange circle */}
      <circle cx="28" cy="20" r="10" fill="#F89738" />
      {/* M — gray */}
      <text x="58" y="42" fontFamily="'Raleway', sans-serif" fontWeight="700" fontSize="28" fill="#8B8B8B">M</text>
      {/* Result — black */}
      <text x="84" y="42" fontFamily="'Raleway', sans-serif" fontWeight="700" fontSize="28" fill="#1a1a1a">Result</text>
      {/* ® mark */}
      <text x="200" y="20" fontFamily="sans-serif" fontSize="10" fill="#8B8B8B">®</text>
    </svg>
  );
}

// ── Markdown-lite renderer ─────────────────────────────────────────────────
function MdContent({ text }: { text: string }) {
  return (
    <div className="space-y-1.5">
      {text.split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;

        if (/^#{2,3}\s/.test(line))
          return (
            <p key={i} className="font-heading text-sm font-bold mt-3 mb-0.5" style={{ color: "#09131b" }}>
              {line.replace(/^#+\s/, "")}
            </p>
          );

        if (/^\|.+\|$/.test(line.trim()) && !line.includes("---"))
          return (
            <p key={i} className="text-xs font-body font-mono leading-relaxed" style={{ color: "#8B8B8B" }}>
              {line}
            </p>
          );
        if (/^\|[\s-|]+\|$/.test(line.trim())) return null;

        if (/^[\s]*[-•▸]/.test(line))
          return (
            <div key={i} className="flex gap-2 text-sm">
              <span className="shrink-0 mt-0.5 text-xs" style={{ color: "#F89738" }}>▸</span>
              <span className="leading-relaxed font-body" style={{ color: "#09131b" }}>
                {renderInline(line.replace(/^[\s]*[-•▸]\s*/, ""))}
              </span>
            </div>
          );

        return (
          <p key={i} className="text-sm leading-relaxed font-body" style={{ color: "#09131b" }}>
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**"))
      return <strong key={i} className="font-semibold" style={{ color: "#09131b" }}>{seg.slice(2, -2)}</strong>;
    if (seg.startsWith("`") && seg.endsWith("`"))
      return (
        <code key={i} className="font-mono text-xs px-1 py-0.5 rounded"
          style={{ color: "#F89738", background: "#FFF4E5", border: "1px solid #FDDCB0" }}>
          {seg.slice(1, -1)}
        </code>
      );
    return <span key={i}>{seg}</span>;
  });
}

// ── Chat bubble ────────────────────────────────────────────────────────────
function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isAgent = msg.role === "agent";
  return (
    <div className={`flex gap-3 ${isAgent ? "" : "flex-row-reverse"}`}>
      {/* Avatar */}
      <div
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-heading font-bold select-none"
        style={{
          background: isAgent ? "#F89738" : "#09131b",
          color: "#ffffff",
        }}
      >
        {isAgent ? "AI" : "You"}
      </div>
      {/* Bubble */}
      <div
        className="max-w-[80%] rounded-2xl px-4 py-3"
        style={{
          background: isAgent ? "#FFFFFF" : "#FFF4E5",
          border: isAgent ? "1px solid #DBDBDB" : "1px solid #FDDCB0",
          borderTopLeftRadius: isAgent ? "4px" : undefined,
          borderTopRightRadius: !isAgent ? "4px" : undefined,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <MdContent text={msg.content} />
      </div>
    </div>
  );
}

// ── Upload zone ────────────────────────────────────────────────────────────
function UploadZone({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (f: File): string | null => {
    if (!["pdf", "docx", "txt"].includes(fileExt(f.name)))
      return "Please upload a PDF, DOCX or TXT file.";
    if (f.size > MAX_MB * 1024 ** 2) return `Maximum file size is ${MAX_MB} MB.`;
    return null;
  };

  const handle = (f: File) => {
    const err = validate(f);
    if (err) { alert(err); return; }
    onFile(f);
  };

  if (file) {
    return (
      <div className="rounded-lg p-4 flex items-center gap-3"
        style={{ border: "1px solid #F89738", background: "#FFF8F0" }}>
        <span className="text-xl">
          {fileExt(file.name) === "pdf" ? "📄" : fileExt(file.name) === "docx" ? "📝" : "📃"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-heading font-bold truncate" style={{ color: "#09131b" }}>{file.name}</p>
          <p className="text-xs mt-0.5 font-body" style={{ color: "#8B8B8B" }}>{fmtBytes(file.size)}</p>
        </div>
        <button
          onClick={() => onFile(null)}
          title="Remove"
          className="shrink-0 text-lg leading-none transition-colors"
          style={{ color: "#BBBBBB" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#8B8B8B")}
          onMouseLeave={e => (e.currentTarget.style.color = "#BBBBBB")}
        >✕</button>
      </div>
    );
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handle(f); }}
      onClick={() => inputRef.current?.click()}
      className="rounded-lg p-6 text-center cursor-pointer transition-all duration-200 select-none"
      style={{
        border: `2px dashed ${dragging ? "#F89738" : "#DBDBDB"}`,
        background: dragging ? "#FFF8F0" : "#FFFFFF",
      }}
    >
      <input
        ref={inputRef} type="file" accept={ACCEPT}
        onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = ""; }}
        className="hidden"
      />
      <div className="flex flex-col items-center gap-2">
        <div className="w-11 h-11 rounded-lg flex items-center justify-center text-xl"
          style={{ background: dragging ? "#FFF0DC" : "#F4F4F4" }}>
          ⬆
        </div>
        <div>
          <p className="text-sm font-heading font-bold" style={{ color: "#09131b" }}>
            {dragging ? "Drop it here" : "Upload your SOW"}
          </p>
          <p className="text-xs mt-0.5 font-body" style={{ color: "#8B8B8B" }}>
            Drag & drop or click to browse
          </p>
          <p className="text-xs mt-1 font-body" style={{ color: "#BBBBBB" }}>
            PDF · DOCX · TXT · max {MAX_MB} MB
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Feedback card ──────────────────────────────────────────────────────────
function FeedbackCard({ onSubmit, onDismiss }: { onSubmit: (f: FeedbackForm) => void; onDismiss: () => void }) {
  const [form, setForm] = useState<FeedbackForm>({
    rating: 0, outcome: "agreed", what_worked: "", what_didnt: "", notes: ""
  });
  const set = (k: keyof FeedbackForm, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  const inputStyle = {
    width: "100%",
    background: "#F4F4F4",
    border: "1px solid #DBDBDB",
    borderRadius: "6px",
    padding: "8px 12px",
    fontSize: "13px",
    color: "#09131b",
    fontFamily: "'Montserrat', sans-serif",
    resize: "none" as const,
    outline: "none",
  };

  return (
    <div className="rounded-xl p-5 space-y-4"
      style={{ background: "#FFFFFF", border: "1px solid #DBDBDB", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-heading text-base font-bold" style={{ color: "#09131b" }}>Session Feedback</h3>
          <p className="text-xs font-body mt-0.5" style={{ color: "#8B8B8B" }}>
            Your rating helps the agent improve future negotiations
          </p>
        </div>
        <button onClick={onDismiss} className="text-lg leading-none transition-colors mt-0.5"
          style={{ color: "#BBBBBB" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#8B8B8B")}
          onMouseLeave={e => (e.currentTarget.style.color = "#BBBBBB")}>✕</button>
      </div>

      {/* Star rating */}
      <div>
        <p className="text-[10px] font-body uppercase tracking-widest mb-2" style={{ color: "#8B8B8B" }}>Overall rating</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => set("rating", n)}
              className="text-2xl transition-all hover:scale-110"
              style={{ color: n <= form.rating ? "#F89738" : "#DBDBDB" }}>★</button>
          ))}
        </div>
      </div>

      {/* Outcome */}
      <div>
        <p className="text-[10px] font-body uppercase tracking-widest mb-2" style={{ color: "#8B8B8B" }}>Negotiation outcome</p>
        <div className="flex gap-2">
          {(["agreed", "partial", "no_deal"] as const).map(o => (
            <button key={o} onClick={() => set("outcome", o)}
              className="px-3 py-1.5 rounded-lg text-xs font-body transition-all"
              style={{
                border: form.outcome === o ? "1px solid #F89738" : "1px solid #DBDBDB",
                background: form.outcome === o ? "#FFF8F0" : "#FFFFFF",
                color: form.outcome === o ? "#F89738" : "#8B8B8B",
                fontWeight: form.outcome === o ? "600" : "400",
              }}>
              {o === "agreed" ? "✓ Agreed" : o === "partial" ? "~ Partial" : "✕ No deal"}
            </button>
          ))}
        </div>
      </div>

      {/* Text fields */}
      <div className="grid grid-cols-2 gap-3">
        {([
          ["what_worked", "What worked well", "e.g. benchmark data was persuasive…"],
          ["what_didnt",  "What to improve",  "e.g. more flexibility on milestone roles…"],
        ] as const).map(([k, label, ph]) => (
          <div key={k}>
            <label className="text-[10px] font-body uppercase tracking-widest block mb-1" style={{ color: "#8B8B8B" }}>{label}</label>
            <textarea value={form[k]} onChange={e => set(k, e.target.value)} rows={2} placeholder={ph} style={inputStyle} />
          </div>
        ))}
      </div>

      <div>
        <label className="text-[10px] font-body uppercase tracking-widest block mb-1" style={{ color: "#8B8B8B" }}>Additional notes</label>
        <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="Any other comments…" style={inputStyle} />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => form.rating > 0 && onSubmit(form)}
          disabled={form.rating === 0}
          className="flex-1 py-2.5 rounded-lg text-sm font-body font-semibold transition-all"
          style={{
            background: form.rating > 0 ? "#F89738" : "#F4F4F4",
            color: form.rating > 0 ? "#FFFFFF" : "#BBBBBB",
            cursor: form.rating > 0 ? "pointer" : "not-allowed",
          }}
          onMouseEnter={e => { if (form.rating > 0) e.currentTarget.style.background = "#e07e20"; }}
          onMouseLeave={e => { if (form.rating > 0) e.currentTarget.style.background = "#F89738"; }}
        >
          Submit Feedback
        </button>
        <button onClick={onDismiss}
          className="px-4 py-2.5 rounded-lg text-sm font-body transition-colors"
          style={{ border: "1px solid #DBDBDB", color: "#8B8B8B", background: "#FFFFFF" }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "#BBBBBB")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "#DBDBDB")}
        >
          Skip
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function Home() {
  const [file, setFile]                 = useState<File | null>(null);
  const [sessionId, setSessionId]       = useState<string | null>(null);
  const [filename, setFilename]         = useState("");
  const [messages, setMessages]         = useState<ChatMessage[]>([]);
  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [analysing, setAnalysing]       = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [online, setOnline]             = useState<boolean | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`${API}/api/health`)
      .then(r => setOnline(r.ok))
      .catch(() => setOnline(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, showFeedback]);

  const analyse = useCallback(async () => {
    if (!file || analysing) return;
    setAnalysing(true);
    setMessages([]);
    setSessionId(null);
    setShowFeedback(false);
    setFeedbackDone(false);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch(`${API}/api/sessions`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail);
      }
      const data = await res.json();
      setSessionId(data.session_id);
      setFilename(data.filename);
      setMessages([{ role: "agent", content: data.reply }]);
      if (data.negotiation_complete) setShowFeedback(true);
    } catch (e) {
      setMessages([{ role: "agent", content: `⚠️ ${e instanceof Error ? e.message : "Unknown error"}` }]);
    } finally {
      setAnalysing(false);
    }
  }, [file, analysing]);

  const send = useCallback(async () => {
    const msg = input.trim();
    if (!msg || !sessionId || loading) return;
    setInput("");
    setMessages(p => [...p, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/sessions/${sessionId}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      setMessages(p => [...p, { role: "agent", content: data.reply }]);
      if (data.negotiation_complete && !feedbackDone) setShowFeedback(true);
    } catch {
      setMessages(p => [...p, { role: "agent", content: "⚠️ Network error — please try again." }]);
    } finally {
      setLoading(false);
    }
  }, [input, sessionId, loading, feedbackDone]);

  const submitFeedback = useCallback(async (form: FeedbackForm) => {
    setShowFeedback(false);
    setFeedbackDone(true);
    if (!sessionId) return;
    try {
      await fetch(`${API}/api/sessions/${sessionId}/feedback`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setMessages(p => [...p, {
        role: "agent",
        content: `Thank you for your ${form.rating}★ feedback — it has been saved and will guide the agent in future negotiations.`,
      }]);
    } catch { /* silent */ }
  }, [sessionId]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F4F4F4", fontFamily: "'Montserrat', sans-serif" }}>

      {/* ══════════════════════════════════════════════════════
          HEADER — white background, full-colour logo on left
          ══════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50" style={{ background: "#FFFFFF", borderBottom: "1px solid #DBDBDB" }}>
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">

          {/* Left: Logo + app name */}
          <div className="flex items-center gap-4">
            <MResultLogo className="h-9 w-auto" />
            <div className="h-5 w-px" style={{ background: "#DBDBDB" }} />
            <div>
              <span className="font-heading font-bold text-base" style={{ color: "#09131b" }}>
                Contract Negotiation
              </span>
              <span className="hidden sm:inline text-xs font-body ml-2" style={{ color: "#8B8B8B" }}>
                SOW Intelligence
              </span>
            </div>
          </div>

          {/* Right: status */}
          <div className="flex items-center gap-3">
            {filename && (
              <span className="hidden sm:block text-xs font-body max-w-[200px] truncate" style={{ color: "#8B8B8B" }}>
                {filename}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-xs font-body"
              style={{ color: online ? "#F89738" : online === null ? "#8B8B8B" : "#BBBBBB" }}>
              <span className="w-2 h-2 rounded-full"
                style={{
                  background: online ? "#F89738" : online === null ? "#DBDBDB" : "#BBBBBB",
                  animation: online ? "pulse 2s infinite" : "none",
                }} />
              {online ? "Agent Online" : online === null ? "Connecting…" : "Backend Offline"}
            </span>
          </div>
        </div>

        {/* Orange accent line */}
        <div className="h-0.5" style={{ background: "linear-gradient(90deg, #F89738 0%, #FFFFFF 100%)" }} />
      </header>

      {/* ══════════════════════════════════════════════════════
          BODY
          ══════════════════════════════════════════════════════ */}
      <div className="flex-1 flex max-w-[1400px] mx-auto w-full" style={{ height: "calc(100vh - 68px)", overflow: "hidden" }}>

        {/* ── LEFT SIDEBAR ── */}
        <aside className="w-[300px] shrink-0 flex flex-col overflow-y-auto"
          style={{ background: "#FFFFFF", borderRight: "1px solid #DBDBDB" }}>

          {/* Upload section */}
          <div className="p-5" style={{ borderBottom: "1px solid #DBDBDB" }}>
            <p className="text-[10px] font-body uppercase tracking-widest mb-3" style={{ color: "#8B8B8B" }}>
              Statement of Work
            </p>
            <UploadZone file={file} onFile={setFile} />
          </div>

          {/* Analyse button */}
          <div className="p-5" style={{ borderBottom: "1px solid #DBDBDB" }}>
            <button
              onClick={analyse}
              disabled={!file || analysing}
              className="w-full py-3 rounded-lg font-body font-semibold text-sm tracking-wide transition-all duration-200"
              style={{
                background: analysing ? "#FDD9A8" : file ? "#F89738" : "#F4F4F4",
                color: analysing ? "#09131b" : file ? "#FFFFFF" : "#BBBBBB",
                cursor: !file || analysing ? "not-allowed" : "pointer",
              }}
              onMouseEnter={e => { if (file && !analysing) e.currentTarget.style.background = "#e07e20"; }}
              onMouseLeave={e => { if (file && !analysing) e.currentTarget.style.background = "#F89738"; }}
            >
              {analysing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 rounded-full animate-spin"
                    style={{ borderColor: "#09131b33", borderTopColor: "#09131b" }} />
                  Analysing…
                </span>
              ) : "Analyse & Negotiate"}
            </button>
            {!file && (
              <p className="text-center text-xs mt-2 font-body" style={{ color: "#BBBBBB" }}>
                Upload a SOW to get started
              </p>
            )}
          </div>

          {/* How it works */}
          <div className="p-5 flex-1">
            <p className="text-[10px] font-body uppercase tracking-widest mb-4" style={{ color: "#8B8B8B" }}>
              How it works
            </p>
            <div className="space-y-4">
              {[
                ["01", "Upload",      "Upload your SOW — PDF, DOCX or TXT"],
                ["02", "Extract",     "Agent reads every role, rate and payment term"],
                ["03", "Benchmark",   "Rates benchmarked against industry standard data"],
                ["04", "Negotiate",   "Interactive chat to reach fair market terms"],
                ["05", "Feedback",    "Rate the session — agent learns and improves"],
              ].map(([n, title, desc]) => (
                <div key={n} className="flex items-start gap-3">
                  <div className="shrink-0 w-7 h-7 rounded flex items-center justify-center text-[10px] font-heading font-bold"
                    style={{ background: "#FFF4E5", border: "1px solid #FDDCB0", color: "#F89738" }}>
                    {n}
                  </div>
                  <div>
                    <p className="text-sm font-heading font-bold" style={{ color: "#09131b" }}>{title}</p>
                    <p className="text-xs mt-0.5 font-body leading-snug" style={{ color: "#8B8B8B" }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4" style={{ borderTop: "1px solid #DBDBDB" }}>
            <p className="text-[10px] text-center font-body" style={{ color: "#BBBBBB" }}>
              Powered by Claude Sonnet · MResult AI
            </p>
          </div>
        </aside>

        {/* ── CHAT AREA ── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: "#F4F4F4" }}>

          {/* Session bar */}
          {sessionId && (
            <div className="px-6 py-3 flex items-center gap-3 shrink-0"
              style={{ background: "#FFFFFF", borderBottom: "1px solid #DBDBDB" }}>
              <span className="text-lg">📄</span>
              <div className="min-w-0">
                <p className="text-sm font-heading font-bold truncate" style={{ color: "#09131b" }}>{filename}</p>
                <p className="text-xs font-body" style={{ color: "#F89738" }}>Negotiation in progress</p>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

            {/* Empty state */}
            {messages.length === 0 && !analysing && (
              <div className="h-full flex flex-col items-center justify-center text-center py-16">
                <div className="mb-6 w-16 h-16 rounded-xl flex items-center justify-center text-3xl"
                  style={{ background: "#FFFFFF", border: "1px solid #DBDBDB" }}>
                  🤝
                </div>
                <h2 className="font-heading font-bold text-xl mb-2" style={{ color: "#09131b" }}>
                  Ready to Negotiate
                </h2>
                <p className="text-sm font-body max-w-xs leading-relaxed" style={{ color: "#8B8B8B" }}>
                  Upload your Statement of Work and click{" "}
                  <strong className="font-semibold" style={{ color: "#09131b" }}>Analyse & Negotiate</strong>{" "}
                  to begin benchmarking and negotiating.
                </p>
                <div className="mt-6 flex items-center gap-5 text-xs font-body" style={{ color: "#BBBBBB" }}>
                  <span>📄 PDF</span>
                  <span style={{ color: "#DBDBDB" }}>·</span>
                  <span>📝 DOCX</span>
                  <span style={{ color: "#DBDBDB" }}>·</span>
                  <span>📃 TXT</span>
                </div>
              </div>
            )}

            {/* Analysing indicator */}
            {analysing && (
              <div className="flex items-center gap-3 p-4 rounded-lg max-w-sm"
                style={{ background: "#FFFFFF", border: "1px solid #FDDCB0" }}>
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="typing-dot w-2 h-2 rounded-full inline-block"
                      style={{ background: "#F89738", animationDelay: `${i * 0.16}s` }} />
                  ))}
                </div>
                <span className="text-sm font-body" style={{ color: "#09131b" }}>
                  Extracting and benchmarking your SOW…
                </span>
              </div>
            )}

            {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}

            {/* Agent thinking */}
            {loading && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-heading font-bold text-white"
                  style={{ background: "#F89738" }}>AI</div>
                <div className="rounded-2xl px-4 py-3 flex gap-1.5 items-center"
                  style={{ background: "#FFFFFF", border: "1px solid #DBDBDB", borderTopLeftRadius: "4px" }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} className="typing-dot w-2 h-2 rounded-full inline-block"
                      style={{ background: "#F89738", animationDelay: `${i * 0.16}s` }} />
                  ))}
                </div>
              </div>
            )}

            {showFeedback && !feedbackDone && (
              <FeedbackCard
                onSubmit={submitFeedback}
                onDismiss={() => { setShowFeedback(false); setFeedbackDone(true); }}
              />
            )}

            <div ref={bottomRef} />
          </div>

          {/* ── Input bar ── */}
          <div className="shrink-0 px-6 py-4" style={{ background: "#FFFFFF", borderTop: "1px solid #DBDBDB" }}>
            <div className="flex gap-3 items-end rounded-lg px-4 py-3 transition-colors"
              style={{
                border: sessionId ? "1px solid #DBDBDB" : "1px solid #F4F4F4",
                background: sessionId ? "#FFFFFF" : "#F4F4F4",
                opacity: sessionId ? 1 : 0.6,
              }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={!sessionId || loading}
                rows={1}
                placeholder={
                  sessionId
                    ? "Type your response… (Enter to send · Shift+Enter for new line)"
                    : "Upload and analyse a SOW to begin negotiating"
                }
                className="flex-1 bg-transparent text-sm resize-none focus:outline-none font-body leading-relaxed max-h-36"
                style={{ color: "#09131b" }}
              />
              <button
                onClick={send}
                disabled={!sessionId || loading || !input.trim()}
                className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                style={{
                  background: sessionId && !loading && input.trim() ? "#F89738" : "#F4F4F4",
                  color: sessionId && !loading && input.trim() ? "#FFFFFF" : "#BBBBBB",
                  cursor: sessionId && !loading && input.trim() ? "pointer" : "not-allowed",
                }}
                onMouseEnter={e => { if (sessionId && !loading && input.trim()) e.currentTarget.style.background = "#e07e20"; }}
                onMouseLeave={e => { if (sessionId && !loading && input.trim()) e.currentTarget.style.background = "#F89738"; }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
