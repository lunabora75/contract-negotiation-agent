"use client";

import { useRouter } from "next/navigation";

// ── Brand colours ────────────────────────────────────────────────────────
const C = {
  dark:   "#09131b",
  orange: "#F89738",
  gray:   "#8B8B8B",
  light:  "#F4F4F4",
  border: "#DBDBDB",
  white:  "#FFFFFF",
  orangeBg: "#FFF8F0",
  orangeBorder: "#FDDCB0",
};

const FONT_HEAD = "'Raleway', sans-serif";
const FONT_BODY = "'Montserrat', sans-serif";

// ── How it works steps ───────────────────────────────────────────────────
const STEPS = [
  {
    n: "01", icon: "📤",
    title: "Upload SOW",
    desc:  "Category Manager uploads the professional services Statement of Work (PDF, DOCX or TXT).",
  },
  {
    n: "02", icon: "🔍",
    title: "AI Analysis",
    desc:  "The agent extracts roles, rates and payment terms from the contract automatically.",
  },
  {
    n: "03", icon: "📊",
    title: "Benchmark",
    desc:  "Every rate is benchmarked against market percentiles (P25 – P90) to identify savings opportunities.",
  },
  {
    n: "04", icon: "🤝",
    title: "Negotiate",
    desc:  "The agent negotiates directly with the Vendor, targeting the market median and conceding up to P75.",
  },
  {
    n: "05", icon: "✅",
    title: "Approve",
    desc:  "Agreed terms are sent to the Category Manager for final approval or rejection with learning feedback.",
  },
];

// ── Benchmark criteria ───────────────────────────────────────────────────
const BENCHMARKS = [
  {
    label: "P25",
    subtitle: "Entry / Budget",
    color: "#4A90D9",
    bg: "#F0F6FF",
    border: "#C3D9F5",
    desc: "Only 25% of the market charges this rate or less. Typically entry-level or budget vendors. A rate here signals below-market pricing.",
    usage: "Reference only — not a negotiation target.",
  },
  {
    label: "P50",
    subtitle: "Market Median",
    color: "#16A34A",
    bg: "#F0FDF4",
    border: "#BBF7D0",
    desc: "Exactly half the market is at or below this rate. This is the true market median and the fairest benchmark for standard roles.",
    usage: "Agent's opening counter-offer target.",
  },
  {
    label: "P75",
    subtitle: "Experienced Range",
    color: C.orange,
    bg: C.orangeBg,
    border: C.orangeBorder,
    desc: "75% of the market charges this or less. Represents an experienced or senior professional. Paying above P75 puts you in the top-cost quartile.",
    usage: "Agent's walk-away limit — max acceptable rate.",
  },
  {
    label: "P90",
    subtitle: "Premium / Specialist",
    color: "#DC2626",
    bg: "#FFF4F4",
    border: "#FECACA",
    desc: "Only 10% of the market charges more. Reserved for rare niche specialists or highly sought-after skills.",
    usage: "Flag for review — requires strong justification.",
  },
];

export default function LandingPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: "100vh", background: C.light, fontFamily: FONT_BODY }}>

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <header style={{ background: C.dark }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-3">
          <span className="font-bold text-2xl tracking-tight" style={{ color: C.white, fontFamily: FONT_HEAD }}>
            MResult
          </span>
          <span className="text-sm font-medium px-3 py-1 rounded-full" style={{ background: C.orange, color: C.white, fontFamily: FONT_BODY }}>
            Contract Negotiation
          </span>
        </div>
        <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${C.orange} 0%, ${C.dark} 100%)` }} />
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-14 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
          style={{ background: C.orangeBg, color: C.orange, border: `1px solid ${C.orangeBorder}` }}>
          ✦ AI-Powered · Benchmark-Driven · Self-Learning
        </div>
        <h1 className="font-bold text-4xl md:text-5xl leading-tight mb-4"
          style={{ color: C.dark, fontFamily: FONT_HEAD }}>
          Intelligent Contract<br />Negotiation Platform
        </h1>
        <p className="text-base max-w-xl mx-auto mb-12" style={{ color: C.gray }}>
          AI agent that reads your professional services SOW, benchmarks every rate against market data,
          and negotiates with the vendor — so you don&apos;t have to.
        </p>

        {/* ── Persona cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">

          {/* Category Manager */}
          <div className="rounded-2xl p-8 text-left flex flex-col gap-5 cursor-pointer transition-transform hover:-translate-y-1"
            style={{ background: C.white, border: `2px solid ${C.border}`, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}
            onClick={() => router.push("/manager")}>
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
              style={{ background: C.orangeBg, border: `1px solid ${C.orangeBorder}` }}>📋</div>
            <div>
              <h2 className="font-bold text-xl mb-1" style={{ color: C.dark, fontFamily: FONT_HEAD }}>Category Manager</h2>
              <p className="text-sm leading-relaxed" style={{ color: C.gray }}>
                Upload contracts, track negotiation status, review agreed terms and approve or reject with feedback.
              </p>
            </div>
            <ul className="space-y-1.5">
              {["Upload & manage SOW contracts", "Send contracts for AI negotiation", "Track status in real time", "Approve or reject final terms"].map(a => (
                <li key={a} className="flex items-center gap-2 text-sm" style={{ color: C.dark }}>
                  <span style={{ color: C.orange }}>▸</span>{a}
                </li>
              ))}
            </ul>
            <button
              className="mt-auto w-full py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: C.dark, color: C.white, fontFamily: FONT_BODY }}>
              Enter Category Manager Portal →
            </button>
          </div>

          {/* Vendor */}
          <div className="rounded-2xl p-8 text-left flex flex-col gap-5 cursor-pointer transition-transform hover:-translate-y-1"
            style={{ background: C.white, border: `2px solid ${C.border}`, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}
            onClick={() => router.push("/vendor")}>
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
              style={{ background: "#F0F6FF", border: "1px solid #C3D9F5" }}>🤝</div>
            <div>
              <h2 className="font-bold text-xl mb-1" style={{ color: C.dark, fontFamily: FONT_HEAD }}>Vendor</h2>
              <p className="text-sm leading-relaxed" style={{ color: C.gray }}>
                Respond to negotiation invitations, discuss rates and terms with the AI agent, and reach agreement professionally.
              </p>
            </div>
            <ul className="space-y-1.5">
              {["Receive negotiation invitations", "Chat with AI negotiation agent", "Discuss roles, rates & payment terms", "Submit agreed terms for approval"].map(a => (
                <li key={a} className="flex items-center gap-2 text-sm" style={{ color: C.dark }}>
                  <span style={{ color: C.orange }}>▸</span>{a}
                </li>
              ))}
            </ul>
            <button
              className="mt-auto w-full py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: C.orange, color: C.white, fontFamily: FONT_BODY }}>
              Enter Vendor Portal →
            </button>
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section style={{ background: C.white, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div className="max-w-5xl mx-auto px-6 py-14">
          <h2 className="font-bold text-3xl text-center mb-2" style={{ color: C.dark, fontFamily: FONT_HEAD }}>How It Works</h2>
          <p className="text-sm text-center mb-10" style={{ color: C.gray }}>Five steps from upload to approved terms</p>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-xl p-5 flex flex-col gap-3"
                style={{ background: C.light, border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{s.icon}</span>
                  <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: C.orange }}>{s.n}</span>
                </div>
                <p className="font-bold text-sm" style={{ color: C.dark, fontFamily: FONT_HEAD }}>{s.title}</p>
                <p className="text-xs leading-relaxed" style={{ color: C.gray }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benchmark criteria ─────────────────────────────────────────── */}
      <section>
        <div className="max-w-5xl mx-auto px-6 py-14">
          <h2 className="font-bold text-3xl text-center mb-2" style={{ color: C.dark, fontFamily: FONT_HEAD }}>Benchmark Criteria</h2>
          <p className="text-sm text-center mb-2" style={{ color: C.gray }}>
            Every role rate is positioned against market percentiles for IT professional services
          </p>
          <p className="text-xs text-center mb-10" style={{ color: C.border.replace("#", "#") }}>
            Benchmarks based on internal market data (hourly rates, USD)
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {BENCHMARKS.map((bm) => (
              <div key={bm.label} className="rounded-xl p-5 flex flex-col gap-3"
                style={{ background: bm.bg, border: `1px solid ${bm.border}` }}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-2xl" style={{ color: bm.color, fontFamily: FONT_HEAD }}>{bm.label}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: C.white, color: bm.color, border: `1px solid ${bm.border}` }}>
                    {bm.subtitle}
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: C.dark }}>{bm.desc}</p>
                <div className="pt-2 mt-auto" style={{ borderTop: `1px solid ${bm.border}` }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: bm.color }}>Agent Usage</p>
                  <p className="text-[11px]" style={{ color: C.gray }}>{bm.usage}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Rate example */}
          <div className="mt-8 rounded-xl p-5" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <p className="text-xs font-semibold mb-3" style={{ color: C.dark, fontFamily: FONT_HEAD }}>
              📌 Example — Solution Architect
            </p>
            <div className="grid grid-cols-4 gap-3">
              {[["P25", "$185/hr", "Entry"], ["P50", "$208/hr", "Target ✓"], ["P75", "$232/hr", "Walk-away"], ["P90", "$260/hr", "Flag"]].map(([p, r, l]) => (
                <div key={p} className="text-center">
                  <p className="text-[10px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: C.gray }}>{p}</p>
                  <p className="font-bold text-base" style={{ color: C.dark, fontFamily: FONT_HEAD }}>{r}</p>
                  <p className="text-[10px]" style={{ color: C.gray }}>{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer style={{ background: C.dark, borderTop: `1px solid #1a2733` }}>
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="font-bold text-base" style={{ color: C.white, fontFamily: FONT_HEAD }}>MResult</span>
          <span className="text-xs" style={{ color: "#4a6070" }}>Powered by Claude Sonnet · AI Contract Negotiation</span>
        </div>
      </footer>
    </div>
  );
}
