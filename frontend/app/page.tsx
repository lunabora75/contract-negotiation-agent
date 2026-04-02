"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const API    = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const MAX_MB = 10;
const ACCEPT = ".pdf,.docx,.txt";

// ── types ─────────────────────────────────────────────────────────────────
interface ChatMessage { role: "agent" | "user"; content: string; }
interface FeedbackForm {
  rating: number; outcome: string;
  what_worked: string; what_didnt: string; notes: string;
}

// ── helpers ───────────────────────────────────────────────────────────────
const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`;

const fileExt = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

const fileIcon = (name: string) =>
  ({ pdf: "📄", docx: "📝", doc: "📝" } as Record<string, string>)[fileExt(name)] ?? "📃";

// ── Markdown-lite renderer ────────────────────────────────────────────────
function MdContent({ text }: { text: string }) {
  return (
    <div className="space-y-1.5">
      {text.split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;

        if (/^#{2,3}\s/.test(line))
          return (
            <p key={i} className="text-green-700 font-heading text-sm font-semibold mt-3 mb-0.5">
              {line.replace(/^#+\s/, "")}
            </p>
          );

        if (/^\|.+\|$/.test(line.trim()) && !line.includes("---"))
          return (
            <p key={i} className="text-xs font-body text-gray-600 font-mono leading-relaxed">
              {line}
            </p>
          );
        if (/^\|[\s-|]+\|$/.test(line.trim())) return null;

        if (/^[\s]*[-•▸]/.test(line))
          return (
            <div key={i} className="flex gap-2 text-sm">
              <span className="text-mr-green mt-0.5 shrink-0 text-xs">▸</span>
              <span className="leading-relaxed font-body text-gray-700">
                {renderInline(line.replace(/^[\s]*[-•▸]\s*/, ""))}
              </span>
            </div>
          );

        return (
          <p key={i} className="text-sm leading-relaxed font-body text-gray-700">
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
      return <strong key={i} className="font-semibold text-mr-dark">{seg.slice(2, -2)}</strong>;
    if (seg.startsWith("`") && seg.endsWith("`"))
      return <code key={i} className="text-mr-orange font-mono text-xs bg-orange-50 px-1 py-0.5 rounded border border-orange-100">{seg.slice(1, -1)}</code>;
    return <span key={i}>{seg}</span>;
  });
}

// ── Chat bubble ───────────────────────────────────────────────────────────
function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isAgent = msg.role === "agent";
  return (
    <div className={`flex gap-3 ${isAgent ? "" : "flex-row-reverse"}`}>
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-heading font-semibold select-none ${
          isAgent ? "bg-mr-green text-mr-darker" : "bg-mr-orange text-white"
        }`}
      >
        {isAgent ? "AI" : "You"}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
          isAgent
            ? "bg-white text-gray-700 rounded-tl-sm border border-gray-200"
            : "bg-[#FFF4E5] text-gray-700 rounded-tr-sm border border-orange-100"
        }`}
      >
        <MdContent text={msg.content} />
      </div>
    </div>
  );
}

// ── Upload zone ───────────────────────────────────────────────────────────
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

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handle(f);
  };

  if (file) {
    return (
      <div className="rounded-xl border border-mr-green/40 bg-green-50 p-4 flex items-center gap-3">
        <span className="text-xl">{fileIcon(file.name)}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-heading text-mr-dark truncate">{file.name}</p>
          <p className="text-xs text-gray-500 mt-0.5 font-body">{fmtBytes(file.size)}</p>
        </div>
        <button
          onClick={() => onFile(null)}
          title="Remove"
          className="shrink-0 text-gray-400 hover:text-gray-600 text-lg leading-none transition-colors"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200 select-none ${
        dragging
          ? "border-mr-green bg-green-50 scale-[1.01]"
          : "border-mr-border hover:border-mr-green/50 hover:bg-green-50/30"
      }`}
    >
      <input ref={inputRef} type="file" accept={ACCEPT} onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = ""; }} className="hidden" />
      <div className="flex flex-col items-center gap-2">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-colors ${dragging ? "bg-green-100" : "bg-gray-100"}`}>
          ⬆
        </div>
        <div>
          <p className="text-sm font-heading text-mr-dark">{dragging ? "Drop it here" : "Upload your SOW"}</p>
          <p className="text-xs text-gray-500 mt-0.5 font-body">Drag & drop or click to browse</p>
          <p className="text-xs text-gray-400 mt-1 font-body">PDF · DOCX · TXT · max {MAX_MB} MB</p>
        </div>
      </div>
    </div>
  );
}

// ── Feedback card ─────────────────────────────────────────────────────────
function FeedbackCard({ onSubmit, onDismiss }: { onSubmit: (f: FeedbackForm) => void; onDismiss: () => void }) {
  const [form, setForm] = useState<FeedbackForm>({ rating: 0, outcome: "agreed", what_worked: "", what_didnt: "", notes: "" });
  const set = (k: keyof FeedbackForm, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="rounded-2xl border border-mr-green/30 bg-white shadow-md p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-heading text-mr-dark text-base">Session Feedback</h3>
          <p className="text-xs text-gray-500 font-body mt-0.5">
            Your rating helps the agent improve future negotiations
          </p>
        </div>
        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 text-lg leading-none mt-0.5 transition-colors">✕</button>
      </div>

      <div>
        <p className="text-[10px] font-body text-gray-500 uppercase tracking-widest mb-2">Overall rating</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => set("rating", n)}
              className={`text-2xl transition-all hover:scale-110 ${n <= form.rating ? "text-mr-orange" : "text-gray-300"}`}>
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-body text-gray-500 uppercase tracking-widest mb-2">Negotiation outcome</p>
        <div className="flex gap-2">
          {(["agreed", "partial", "no_deal"] as const).map(o => (
            <button key={o} onClick={() => set("outcome", o)}
              className={`px-3 py-1.5 rounded-lg text-xs font-body border transition-all ${
                form.outcome === o
                  ? "bg-green-50 border-mr-green/50 text-green-700"
                  : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}>
              {o === "agreed" ? "✓ Agreed" : o === "partial" ? "~ Partial" : "✕ No Deal"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {([ ["what_worked", "What worked well", "e.g. benchmark data was convincing…"],
            ["what_didnt",  "What to improve",  "e.g. more flexibility on milestone roles…"] ] as const).map(([k, label, ph]) => (
          <div key={k}>
            <label className="text-[10px] font-body text-gray-500 uppercase tracking-widest block mb-1">{label}</label>
            <textarea value={form[k]} onChange={e => set(k, e.target.value)} rows={2} placeholder={ph}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:border-mr-green/50 font-body" />
          </div>
        ))}
      </div>

      <div>
        <label className="text-[10px] font-body text-gray-500 uppercase tracking-widest block mb-1">Additional notes</label>
        <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="Any other comments…"
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:border-mr-green/50 font-body" />
      </div>

      <div className="flex gap-3">
        <button onClick={() => form.rating > 0 && onSubmit(form)} disabled={form.rating === 0}
          className={`flex-1 py-2.5 rounded-xl text-sm font-body font-semibold transition-all ${
            form.rating > 0
              ? "bg-mr-green text-mr-darker hover:bg-[#4db85e] active:scale-[0.98]"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}>
          Submit Feedback
        </button>
        <button onClick={onDismiss}
          className="px-4 py-2.5 rounded-xl text-sm font-body text-gray-500 border border-gray-200 hover:border-gray-300 transition-colors">
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
        content: `Thank you for your ${form.rating}★ feedback! It has been saved and will guide the agent in future negotiations.`,
      }]);
    } catch { /* silent */ }
  }, [sessionId]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="min-h-screen bg-mr-bg flex flex-col" style={{ fontFamily: "var(--font-body)" }}>

      {/* ── HEADER — dark MResult navbar ── */}
      <header className="sticky top-0 z-50 bg-mr-darker shadow-lg">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mresult-logo-white.png"
              alt="MResult"
              className="h-9 w-auto object-contain"
              style={{ filter: "brightness(0) invert(1)" }}
            />
            <div className="h-5 w-px bg-white/15" />
            <span className="font-body text-sm text-gray-400 tracking-wide">Contract Negotiation</span>
          </div>
          <div className="flex items-center gap-3">
            {filename && (
              <span className="hidden sm:block text-xs font-body text-gray-400 max-w-[200px] truncate">{filename}</span>
            )}
            <span className={`flex items-center gap-1.5 text-xs font-body ${online ? "text-mr-green" : "text-amber-400"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-mr-green animate-pulse" : "bg-amber-400"}`} />
              {online ? "Agent Online" : online === null ? "Connecting…" : "Backend Offline"}
            </span>
          </div>
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="flex-1 flex max-w-[1400px] mx-auto w-full" style={{ height: "calc(100vh - 64px)", overflow: "hidden" }}>

        {/* ── LEFT SIDEBAR ── */}
        <aside className="w-[300px] shrink-0 border-r border-mr-border bg-white flex flex-col overflow-y-auto">

          <div className="p-5 border-b border-mr-border">
            <p className="text-[10px] font-body text-gray-400 uppercase tracking-widest mb-3">Statement of Work</p>
            <UploadZone file={file} onFile={setFile} />
          </div>

          <div className="p-5 border-b border-mr-border">
            <button
              onClick={analyse}
              disabled={!file || analysing}
              className={`w-full py-3 rounded-xl font-body font-semibold text-sm tracking-wide transition-all duration-200 ${
                analysing
                  ? "bg-mr-green/50 text-mr-darker cursor-wait"
                  : file
                    ? "bg-mr-green text-mr-darker hover:bg-[#4db85e] active:scale-[0.98] shadow-sm"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              {analysing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-mr-darker/25 border-t-mr-darker rounded-full animate-spin" />
                  Analysing…
                </span>
              ) : "▶  Analyse & Negotiate"}
            </button>
            {!file && (
              <p className="text-center text-xs text-gray-400 mt-2 font-body">Upload a SOW to get started</p>
            )}
          </div>

          <div className="p-5 flex-1">
            <p className="text-[10px] font-body text-gray-400 uppercase tracking-widest mb-4">How it works</p>
            <div className="space-y-4">
              {[
                ["01", "📄", "Upload",    "Drop your SOW — PDF, DOCX or TXT"],
                ["02", "🔍", "Extract",   "Agent reads every role, rate & payment term"],
                ["03", "📊", "Benchmark", "Rates benchmarked against internal p25–p90 data"],
                ["04", "🤝", "Negotiate", "Interactive chat to reach fair market terms"],
                ["05", "💬", "Feedback",  "You rate the session — agent learns and improves"],
              ].map(([n, icon, title, desc]) => (
                <div key={n} className="flex items-start gap-3">
                  <div className="shrink-0 w-7 h-7 rounded-lg bg-gray-50 border border-mr-border flex items-center justify-center text-[10px] font-heading font-semibold text-mr-green">
                    {n}
                  </div>
                  <div>
                    <p className="text-sm font-heading text-mr-dark">{icon} {title}</p>
                    <p className="text-xs text-gray-500 font-body mt-0.5 leading-snug">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 border-t border-mr-border">
            <p className="text-[10px] text-gray-400 font-body text-center">
              Powered by Claude Sonnet · Single-agent with tool use
            </p>
          </div>
        </aside>

        {/* ── CHAT AREA ── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-mr-bg">

          {sessionId && (
            <div className="px-6 py-3 border-b border-mr-border bg-white flex items-center gap-3 shrink-0">
              <span className="text-lg">{fileIcon(filename)}</span>
              <div className="min-w-0">
                <p className="text-sm font-heading text-mr-dark truncate">{filename}</p>
                <p className="text-xs text-mr-green font-body">Negotiation in progress</p>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

            {messages.length === 0 && !analysing && (
              <div className="h-full flex flex-col items-center justify-center text-center py-16">
                <div className="mb-6 w-16 h-16 rounded-2xl bg-white border border-mr-border shadow-sm flex items-center justify-center text-3xl">
                  🤝
                </div>
                <h2 className="font-heading text-mr-dark text-xl mb-2">Ready to Negotiate</h2>
                <p className="text-gray-500 text-sm font-body max-w-xs leading-relaxed">
                  Upload your Statement of Work on the left and click{" "}
                  <strong className="text-mr-dark font-heading">Analyse & Negotiate</strong> to begin.
                </p>
                <div className="mt-6 flex items-center gap-5 text-xs text-gray-400 font-body">
                  <span>📄 PDF</span><span className="text-gray-300">·</span>
                  <span>📝 DOCX</span><span className="text-gray-300">·</span>
                  <span>📃 TXT</span>
                </div>
              </div>
            )}

            {analysing && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-mr-green/20 shadow-sm max-w-sm">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="typing-dot w-2 h-2 bg-mr-green rounded-full inline-block"
                      style={{ animationDelay: `${i * 0.16}s` }} />
                  ))}
                </div>
                <span className="text-sm text-green-700 font-body">Extracting and benchmarking your SOW…</span>
              </div>
            )}

            {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}

            {loading && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-mr-green flex items-center justify-center text-[10px] font-heading font-semibold text-mr-darker">AI</div>
                <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 border border-gray-200 shadow-sm flex gap-1.5 items-center">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="typing-dot w-2 h-2 bg-mr-green/60 rounded-full inline-block"
                      style={{ animationDelay: `${i * 0.16}s` }} />
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
          <div className="shrink-0 border-t border-mr-border bg-white px-6 py-4">
            <div className={`flex gap-3 items-end rounded-xl border px-4 py-3 transition-colors ${
              sessionId
                ? "border-gray-200 bg-white focus-within:border-mr-green/50 shadow-sm"
                : "border-gray-200 bg-gray-50 opacity-60"
            }`}>
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
                className="flex-1 bg-transparent text-sm text-mr-dark placeholder-gray-400 resize-none focus:outline-none font-body leading-relaxed max-h-36"
                style={{ fieldSizing: "content" } as React.CSSProperties}
              />
              <button
                onClick={send}
                disabled={!sessionId || loading || !input.trim()}
                className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  sessionId && !loading && input.trim()
                    ? "bg-mr-green text-mr-darker hover:bg-[#4db85e] active:scale-95 shadow-sm"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
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
