"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const C = {
  dark: "#09131b", orange: "#F89738", gray: "#8B8B8B",
  light: "#F4F4F4", border: "#DBDBDB", white: "#FFFFFF",
  orangeBg: "#FFF8F0", orangeBorder: "#FDDCB0",
};
const FH = "'Raleway', sans-serif";
const FB = "'Montserrat', sans-serif";

// ── How it works data ─────────────────────────────────────────────────────
const STEPS = [
  { n: "01", icon: "📤", title: "Upload SOW",     desc: "Category Manager uploads the professional services Statement of Work (PDF, DOCX or TXT)." },
  { n: "02", icon: "🔍", title: "AI Analysis",    desc: "The agent extracts roles, rates and payment terms from the contract automatically." },
  { n: "03", icon: "📊", title: "Benchmark",      desc: "Every rate is benchmarked against internal benchmark data (P25–P90) to identify savings opportunities." },
  { n: "04", icon: "🤝", title: "Negotiate",      desc: "The agent negotiates directly with the Vendor, targeting the benchmark median and conceding up to P75." },
  { n: "05", icon: "✅", title: "Approve",        desc: "Agreed terms are sent to the Category Manager for final approval or rejection with learning feedback." },
];

// ── Benchmark criteria data ───────────────────────────────────────────────
const BENCHMARKS = [
  {
    label: "P25", subtitle: "Entry / Budget",
    color: "#4A90D9", bg: "#F0F6FF", border: "#C3D9F5",
    desc: "Only 25% of the benchmark data shows this rate or less. Typically entry-level or budget vendors. A rate here signals below-benchmark pricing.",
    usage: "Reference only — not a negotiation target.",
  },
  {
    label: "P50", subtitle: "Benchmark Median",
    color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0",
    desc: "Exactly half the benchmark data is at or below this rate. The truest benchmark midpoint — the fairest reference for standard roles.",
    usage: "Agent's opening counter-offer target.",
  },
  {
    label: "P75", subtitle: "Experienced Range",
    color: C.orange, bg: C.orangeBg, border: C.orangeBorder,
    desc: "75% of the benchmark data is at or below this rate. Represents an experienced or senior professional. Paying above P75 puts you in the top-cost quartile.",
    usage: "Agent's walk-away limit — max acceptable rate.",
  },
  {
    label: "P90", subtitle: "Premium / Specialist",
    color: "#DC2626", bg: "#FFF4F4", border: "#FECACA",
    desc: "Only 10% of the benchmark data shows a higher rate. Reserved for rare niche specialists or highly sought-after skills.",
    usage: "Flag for review — requires strong justification.",
  },
];

type TabKey = "howItWorks" | "benchmarkCriteria" | null;

export default function LandingPage() {
  const router   = useRouter();
  const [tab, setTab] = useState<TabKey>(null);

  const toggleTab = (key: TabKey) => setTab(prev => prev === key ? null : key);

  return (
    <div style={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: FB, background: C.light }}>

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <header style={{ background: C.dark, flexShrink: 0 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* MResult logo */}
            <img src="/mresult-logo-dark.png" alt="MResult" style={{ height: 36, width: "auto", display: "block" }} />
            <span style={{ background: C.orange, color: C.white, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, fontFamily: FB }}>
              Contract Negotiation
            </span>
          </div>
          {/* Reset all data button */}
          <button
            onClick={async () => {
              if (!confirm("Reset all application data? This will clear all contracts, negotiations and history.")) return;
              try {
                await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/reset`, { method: "POST" });
              } catch { /* ignore if offline */ }
              localStorage.clear();
              window.location.reload();
            }}
            style={{ fontSize: 11, fontWeight: 600, padding: "5px 14px", borderRadius: 20, background: "rgba(255,255,255,0.08)", color: C.gray, border: "1px solid #1a2733", cursor: "pointer", fontFamily: FB }}
            title="Clear all contracts, negotiations and history">
            ↺ Reset All Data
          </button>
        </div>
        <div style={{ height: 2, background: `linear-gradient(90deg, ${C.orange} 0%, ${C.dark} 100%)` }} />
      </header>

      {/* ── Main content (no scroll) ────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>

        {/* ── Hero + cards ─────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", padding: "0 24px", width: "100%", maxWidth: 860 }}>

          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.orangeBg, border: `1px solid ${C.orangeBorder}`, borderRadius: 20, padding: "4px 14px", fontSize: 11, fontWeight: 600, color: C.orange, marginBottom: 16 }}>
            ✦ AI-Powered · Benchmark-Driven · Self-Learning
          </div>

          {/* Title */}
          <h1 style={{ fontFamily: FH, fontWeight: 800, fontSize: 36, color: C.dark, margin: "0 0 8px", lineHeight: 1.2 }}>
            Intelligent Contract Negotiation Platform
          </h1>
          <p style={{ fontSize: 14, color: C.gray, margin: "0 0 28px", maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
            AI agent that reads your professional services SOW, benchmarks every rate against internal benchmark data,
            and negotiates with the vendor on your behalf.
          </p>

          {/* ── Persona cards ─────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 780, margin: "0 auto" }}>

            {/* Category Manager */}
            <div
              onClick={() => router.push("/manager")}
              style={{ background: C.white, border: `2px solid ${C.border}`, borderRadius: 16, padding: "24px 24px 20px", textAlign: "left", cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", transition: "transform 0.15s", display: "flex", flexDirection: "column", gap: 14 }}
              onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, background: C.orangeBg, border: `1px solid ${C.orangeBorder}`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📋</div>
                <div>
                  <h2 style={{ fontFamily: FH, fontWeight: 700, fontSize: 17, color: C.dark, margin: 0 }}>Category Manager</h2>
                  <p style={{ fontSize: 11, color: C.gray, margin: "2px 0 0" }}>Upload · Track · Approve</p>
                </div>
              </div>
              <p style={{ fontSize: 12, color: C.gray, margin: 0, lineHeight: 1.6 }}>
                Upload contracts, send them to the AI agent for negotiation, track status in real time, and approve or reject the final terms.
              </p>
              <button style={{ width: "100%", padding: "10px 0", background: C.dark, color: C.white, border: "none", borderRadius: 10, fontFamily: FB, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                Enter Category Manager Portal →
              </button>
            </div>

            {/* Vendor */}
            <div
              onClick={() => router.push("/vendor")}
              style={{ background: C.white, border: `2px solid ${C.border}`, borderRadius: 16, padding: "24px 24px 20px", textAlign: "left", cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", transition: "transform 0.15s", display: "flex", flexDirection: "column", gap: 14 }}
              onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, background: "#F0F6FF", border: "1px solid #C3D9F5", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🤝</div>
                <div>
                  <h2 style={{ fontFamily: FH, fontWeight: 700, fontSize: 17, color: C.dark, margin: 0 }}>Vendor</h2>
                  <p style={{ fontSize: 11, color: C.gray, margin: "2px 0 0" }}>Negotiate · Agree · Submit</p>
                </div>
              </div>
              <p style={{ fontSize: 12, color: C.gray, margin: 0, lineHeight: 1.6 }}>
                Respond to negotiation invitations, discuss rates and terms with the AI agent, and reach agreement professionally.
              </p>
              <button style={{ width: "100%", padding: "10px 0", background: C.orange, color: C.white, border: "none", borderRadius: 10, fontFamily: FB, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                Enter Vendor Portal →
              </button>
            </div>
          </div>
        </div>

        {/* ── Side tab buttons ─────────────────────────────────────────── */}
        <div style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 6, zIndex: 20 }}>
          {([
            { key: "howItWorks" as TabKey,        label: "How it Works",       icon: "⚙" },
            { key: "benchmarkCriteria" as TabKey, label: "Benchmark Criteria", icon: "📊" },
          ] as { key: TabKey; label: string; icon: string }[]).map(t => (
            <button
              key={t.key!}
              onClick={() => toggleTab(t.key)}
              style={{
                writingMode: "vertical-rl",
                textOrientation: "mixed",
                transform: "rotate(180deg)",
                padding: "16px 8px",
                background: tab === t.key ? C.orange : C.dark,
                color: C.white,
                border: "none",
                borderRadius: "8px 0 0 8px",
                cursor: "pointer",
                fontSize: 11,
                fontFamily: FB,
                fontWeight: 600,
                letterSpacing: "0.04em",
                transition: "background 0.2s",
                boxShadow: "-2px 0 8px rgba(0,0,0,0.15)",
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── Info panel overlay ───────────────────────────────────────── */}
        {tab && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setTab(null)}
              style={{ position: "absolute", inset: 0, background: "rgba(9,19,27,0.35)", zIndex: 25, backdropFilter: "blur(2px)" }}
            />
            {/* Panel */}
            <div style={{
              position: "absolute", right: 0, top: 0, bottom: 0,
              width: 400, background: C.white,
              boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
              zIndex: 30, overflowY: "auto",
              animation: "slideIn 0.22s ease",
            }}>
              {/* Panel header */}
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: C.white, zIndex: 1 }}>
                <span style={{ fontFamily: FH, fontWeight: 700, fontSize: 15, color: C.dark }}>
                  {tab === "howItWorks" ? "⚙ How it Works" : "📊 Benchmark Criteria"}
                </span>
                <button onClick={() => setTab(null)}
                  style={{ background: C.light, border: `1px solid ${C.border}`, borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 14, color: C.gray, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  ✕
                </button>
              </div>

              {/* How it Works content */}
              {tab === "howItWorks" && (
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <p style={{ fontSize: 12, color: C.gray, margin: "0 0 4px" }}>Five steps from contract upload to approved terms</p>
                  {STEPS.map(s => (
                    <div key={s.n} style={{ background: C.light, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", gap: 12 }}>
                      <div style={{ flexShrink: 0 }}>
                        <div style={{ width: 32, height: 32, background: C.orangeBg, border: `1px solid ${C.orangeBorder}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{s.icon}</div>
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: C.orange, letterSpacing: "0.08em" }}>{s.n}</span>
                          <span style={{ fontFamily: FH, fontWeight: 700, fontSize: 13, color: C.dark }}>{s.title}</span>
                        </div>
                        <p style={{ fontSize: 11, color: C.gray, margin: 0, lineHeight: 1.6 }}>{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Benchmark Criteria content */}
              {tab === "benchmarkCriteria" && (
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <p style={{ fontSize: 12, color: C.gray, margin: "0 0 4px" }}>
                    Every role rate is positioned against internal benchmark data for IT professional services
                  </p>
                  {BENCHMARKS.map(bm => (
                    <div key={bm.label} style={{ background: bm.bg, border: `1px solid ${bm.border}`, borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontFamily: FH, fontWeight: 800, fontSize: 22, color: bm.color }}>{bm.label}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: bm.color, background: C.white, border: `1px solid ${bm.border}`, borderRadius: 12, padding: "2px 8px" }}>{bm.subtitle}</span>
                      </div>
                      <p style={{ fontSize: 11, color: C.dark, margin: "0 0 8px", lineHeight: 1.6 }}>{bm.desc}</p>
                      <div style={{ borderTop: `1px solid ${bm.border}`, paddingTop: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: bm.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>Agent Usage: </span>
                        <span style={{ fontSize: 11, color: C.gray }}>{bm.usage}</span>
                      </div>
                    </div>
                  ))}
                  {/* Example */}
                  <div style={{ background: C.light, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: C.dark, margin: "0 0 10px", fontFamily: FH }}>📌 Example — Solution Architect</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                      {[["P25", "$185/hr", "Entry"], ["P50", "$208/hr", "Target ✓"], ["P75", "$232/hr", "Walk-away"], ["P90", "$260/hr", "Flag"]].map(([p, r, l]) => (
                        <div key={p} style={{ textAlign: "center" }}>
                          <p style={{ fontSize: 9, color: C.gray, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }}>{p}</p>
                          <p style={{ fontFamily: FH, fontWeight: 700, fontSize: 13, color: C.dark, margin: "0 0 1px" }}>{r}</p>
                          <p style={{ fontSize: 9, color: C.gray, margin: 0 }}>{l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Slide-in animation ───────────────────────────────────────── */}
        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={{ background: C.dark, flexShrink: 0, borderTop: "1px solid #1a2733" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 40, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: FH, fontWeight: 700, fontSize: 13, color: C.white }}>MResult</span>
          <span style={{ fontSize: 11, color: "#4a6070" }}>AI Powered Contract Negotiation</span>
        </div>
      </footer>
    </div>
  );
}
