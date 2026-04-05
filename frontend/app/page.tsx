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

const STEPS = [
  { n: "01", icon: "📤", title: "Upload SOW",   desc: "Category Manager uploads the professional services SOW (PDF, DOCX or TXT)." },
  { n: "02", icon: "🔍", title: "AI Analysis",  desc: "Agent extracts roles, rates and payment terms from the contract automatically." },
  { n: "03", icon: "📊", title: "Benchmark",    desc: "Every rate is benchmarked against internal data (P25–P90) to identify savings." },
  { n: "04", icon: "🤝", title: "Negotiate",    desc: "Agent negotiates directly with the Vendor, targeting P50 and conceding up to P75." },
  { n: "05", icon: "✅", title: "Approve",      desc: "Agreed terms are sent to the Category Manager for approval with full explainability." },
];

const BENCHMARKS = [
  { label: "P25", subtitle: "Entry / Budget",      color: "#4A90D9", bg: "#F0F6FF", border: "#C3D9F5",
    desc: "25% of the benchmark data shows this rate or less. Typically entry-level or budget vendors.",
    usage: "Reference only — not a negotiation target." },
  { label: "P50", subtitle: "Benchmark Median",    color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0",
    desc: "Half the benchmark data is at or below this rate. The truest benchmark midpoint for standard roles.",
    usage: "Agent's opening counter-offer target." },
  { label: "P75", subtitle: "Experienced Range",   color: C.orange,  bg: C.orangeBg, border: C.orangeBorder,
    desc: "75% of the benchmark is at or below this rate. Paying above P75 puts you in the top-cost quartile.",
    usage: "Agent's walk-away limit — max acceptable rate." },
  { label: "P90", subtitle: "Premium / Specialist",color: "#DC2626", bg: "#FFF4F4", border: "#FECACA",
    desc: "Only 10% of the benchmark shows a higher rate. Reserved for rare niche specialists.",
    usage: "Flag for review — requires strong justification." },
];

type TabKey = "benchmarkCriteria" | null;

export default function LandingPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(null);

  return (
    <div style={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: FB, background: C.light }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{ background: C.white, flexShrink: 0, boxShadow: "0 1px 0 #DBDBDB" }}>
        <div style={{ padding: "0 40px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* LEFT: logo only */}
          <img src="/mresult-logo.png" alt="MResult" style={{ height: 36, width: "auto", display: "block" }} />

          {/* RIGHT: badge + reset */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ background: C.dark, color: C.orange, fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, fontFamily: FB }}>
              Contract Negotiation
            </span>
            <button
              onClick={async () => {
                if (!confirm("Reset all application data? This will clear all contracts, negotiations and history.")) return;
                try { await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/reset`, { method: "POST" }); } catch { /* ignore */ }
                localStorage.clear();
                window.location.reload();
              }}
              style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 20, background: C.light, color: C.gray, border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: FB }}>
              ↺ Reset
            </button>
          </div>
        </div>
        <div style={{ height: 2, background: `linear-gradient(90deg, ${C.orange} 0%, ${C.dark} 100%)` }} />
      </header>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: "hidden", display: "flex", position: "relative" }}>

        {/* ── LEFT COLUMN: hero + persona cards (~52%) ─────────────────── */}
        <div style={{ width: "52%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "28px 32px 28px 40px", gap: 20 }}>

          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.orangeBg, border: `1px solid ${C.orangeBorder}`, borderRadius: 20, padding: "4px 14px", fontSize: 11, fontWeight: 600, color: C.orange, alignSelf: "flex-start" }}>
            ✦ AI-Powered · Benchmark-Driven · Self-Learning
          </div>

          {/* Title */}
          <div>
            <h1 style={{ fontFamily: FH, fontWeight: 800, fontSize: 32, color: C.dark, margin: "0 0 8px", lineHeight: 1.2 }}>
              Intelligent Contract<br />Negotiation Platform
            </h1>
            <p style={{ fontSize: 13, color: C.gray, margin: 0, lineHeight: 1.7, maxWidth: 440 }}>
              AI agent that reads your professional services SOW, benchmarks every rate against internal data, and negotiates with the vendor on your behalf — from upload to approved terms.
            </p>
          </div>

          {/* Persona cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

            {/* Category Manager */}
            <div onClick={() => router.push("/manager")}
              style={{ background: C.white, border: `2px solid ${C.border}`, borderRadius: 14, padding: "18px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 10, transition: "all 0.15s", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.dark; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateY(0)"; }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 38, height: 38, background: C.orangeBg, border: `1px solid ${C.orangeBorder}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📋</div>
                <div>
                  <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 14, color: C.dark }}>Category Manager</div>
                  <div style={{ fontSize: 10, color: C.gray }}>Upload · Track · Approve</div>
                </div>
              </div>
              <p style={{ fontSize: 11, color: C.gray, margin: 0, lineHeight: 1.6 }}>
                Upload contracts, trigger AI negotiation, track status and approve final terms.
              </p>
              <button style={{ width: "100%", padding: "9px 0", background: C.dark, color: C.white, border: "none", borderRadius: 8, fontFamily: FB, fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
                Enter Category Manager Portal →
              </button>
            </div>

            {/* Vendor */}
            <div onClick={() => router.push("/vendor")}
              style={{ background: C.white, border: `2px solid ${C.border}`, borderRadius: 14, padding: "18px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 10, transition: "all 0.15s", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.orange; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateY(0)"; }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 38, height: 38, background: "#F0F6FF", border: "1px solid #C3D9F5", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🤝</div>
                <div>
                  <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 14, color: C.dark }}>Vendor</div>
                  <div style={{ fontSize: 10, color: C.gray }}>Negotiate · Agree · Submit</div>
                </div>
              </div>
              <p style={{ fontSize: 11, color: C.gray, margin: 0, lineHeight: 1.6 }}>
                Respond to negotiation invitations, discuss rates and reach agreement professionally.
              </p>
              <button style={{ width: "100%", padding: "9px 0", background: C.orange, color: C.white, border: "none", borderRadius: 8, fontFamily: FB, fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
                Enter Vendor Portal →
              </button>
            </div>
          </div>

          {/* Stats strip */}
          <div style={{ display: "flex", gap: 0, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            {[
              { value: "< 1 hr", label: "Time to Agreement" },
              { value: "P50→P75", label: "Negotiation Range" },
              { value: "100%", label: "Audit Trail" },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, padding: "10px 16px", borderRight: i < 2 ? `1px solid ${C.border}` : "none", textAlign: "center" }}>
                <div style={{ fontFamily: FH, fontWeight: 800, fontSize: 16, color: C.orange }}>{s.value}</div>
                <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT COLUMN: How it Works (~48%) ────────────────────────── */}
        <div style={{ width: "48%", display: "flex", flexDirection: "column", padding: "28px 40px 28px 24px", gap: 12, justifyContent: "center" }}>

          {/* Section header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontFamily: FH, fontWeight: 700, fontSize: 16, color: C.dark, margin: 0 }}>⚙ How it Works</h2>
              <p style={{ fontSize: 11, color: C.gray, margin: "3px 0 0" }}>Five steps from upload to approved terms</p>
            </div>
            <button
              onClick={() => setTab(prev => prev === "benchmarkCriteria" ? null : "benchmarkCriteria")}
              style={{ padding: "6px 14px", background: tab ? C.orange : C.dark, color: C.white, border: "none", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FB }}>
              📊 Benchmark Criteria
            </button>
          </div>

          {/* Steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, justifyContent: "center" }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 34, height: 34, background: C.orangeBg, border: `1px solid ${C.orangeBorder}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{s.icon}</div>
                  {i < STEPS.length - 1 && <div style={{ width: 1, height: 6, background: C.orangeBorder }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: C.orange, letterSpacing: "0.08em" }}>{s.n}</span>
                    <span style={{ fontFamily: FH, fontWeight: 700, fontSize: 13, color: C.dark }}>{s.title}</span>
                  </div>
                  <p style={{ fontSize: 11, color: C.gray, margin: 0, lineHeight: 1.5 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Vertical divider ─────────────────────────────────────────── */}
        <div style={{ position: "absolute", left: "52%", top: 24, bottom: 24, width: 1, background: C.border }} />

        {/* ── Benchmark Criteria slide-over panel ──────────────────────── */}
        {tab && (
          <>
            <div onClick={() => setTab(null)} style={{ position: "absolute", inset: 0, background: "rgba(9,19,27,0.3)", zIndex: 25, backdropFilter: "blur(2px)" }} />
            <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 400, background: C.white, boxShadow: "-4px 0 24px rgba(0,0,0,0.12)", zIndex: 30, overflowY: "auto", animation: "slideIn 0.22s ease" }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: C.white }}>
                <span style={{ fontFamily: FH, fontWeight: 700, fontSize: 14, color: C.dark }}>📊 Benchmark Criteria</span>
                <button onClick={() => setTab(null)} style={{ background: C.light, border: `1px solid ${C.border}`, borderRadius: 6, width: 26, height: 26, cursor: "pointer", fontSize: 13, color: C.gray, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
              <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 11, color: C.gray, margin: "0 0 4px" }}>Rates are positioned against internal benchmark data for IT professional services</p>
                {BENCHMARKS.map(bm => (
                  <div key={bm.label} style={{ background: bm.bg, border: `1px solid ${bm.border}`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontFamily: FH, fontWeight: 800, fontSize: 20, color: bm.color }}>{bm.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: bm.color, background: C.white, border: `1px solid ${bm.border}`, borderRadius: 12, padding: "2px 8px" }}>{bm.subtitle}</span>
                    </div>
                    <p style={{ fontSize: 11, color: C.dark, margin: "0 0 6px", lineHeight: 1.6 }}>{bm.desc}</p>
                    <div style={{ borderTop: `1px solid ${bm.border}`, paddingTop: 5 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: bm.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>Agent Usage: </span>
                      <span style={{ fontSize: 11, color: C.gray }}>{bm.usage}</span>
                    </div>
                  </div>
                ))}
                <div style={{ background: C.light, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: C.dark, margin: "0 0 8px", fontFamily: FH }}>📌 Example — Solution Architect</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                    {[["P25","$185/hr","Entry"],["P50","$208/hr","Target ✓"],["P75","$232/hr","Walk-away"],["P90","$260/hr","Flag"]].map(([p,r,l]) => (
                      <div key={p} style={{ textAlign: "center" }}>
                        <p style={{ fontSize: 9, color: C.gray, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }}>{p}</p>
                        <p style={{ fontFamily: FH, fontWeight: 700, fontSize: 13, color: C.dark, margin: "0 0 1px" }}>{r}</p>
                        <p style={{ fontSize: 9, color: C.gray, margin: 0 }}>{l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer style={{ background: C.white, flexShrink: 0, borderTop: `1px solid ${C.border}` }}>
        <div style={{ padding: "0 40px", height: 38, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: FH, fontWeight: 700, fontSize: 12, color: C.dark }}>MResult Confidential</span>
          <span style={{ fontSize: 11, color: C.gray }}>AI Powered Contract Negotiation</span>
        </div>
      </footer>
    </div>
  );
}
