"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const API      = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const MAX_MB   = 10;
const ACCEPT   = ".pdf,.docx,.txt";

const C = {
  dark: "#09131b", orange: "#F89738", gray: "#8B8B8B",
  light: "#F4F4F4", border: "#DBDBDB", white: "#FFFFFF",
  orangeBg: "#FFF8F0", orangeBorder: "#FDDCB0",
};
const FONT_HEAD = "'Raleway', sans-serif";
const FONT_BODY = "'Montserrat', sans-serif";

// ── Types ─────────────────────────────────────────────────────────────────
interface Session {
  session_id: string;
  filename:   string;
  status:     string;
  created_at: string;
  approval:   { decision: string; comments: string; approver: string; timestamp: string } | null;
}

// ── Status display map ─────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string; dot?: boolean }> = {
  uploaded:               { label: "Uploaded",                    color: C.gray,    bg: C.light,     border: C.border },
  sent_for_negotiation:   { label: "Sent for Negotiation",        color: C.orange,  bg: C.orangeBg,  border: C.orangeBorder },
  negotiation_in_progress:{ label: "Negotiation in Progress",     color: "#D97706", bg: "#FFFBEB",   border: "#FDE68A", dot: true },
  pending_approval:       { label: "Pending Approval",            color: C.white,   bg: C.dark,      border: C.dark },
  re_negotiate:           { label: "Re-negotiate",                color: "#4F46E5", bg: "#EEF2FF",   border: "#C7D2FE" },
  sent_for_renegotiation: { label: "Sent for Re-negotiation",     color: "#4F46E5", bg: "#EEF2FF",   border: "#C7D2FE" },
  pending_offline_review: { label: "Pending Offline Review",      color: "#D97706", bg: "#FFFBEB",   border: "#FDE68A" },
  approved:               { label: "Approved",                    color: "#16A34A", bg: "#F0FDF4",   border: "#BBF7D0" },
  rejected:               { label: "Rejected",                    color: "#DC2626", bg: "#FFF4F4",   border: "#FECACA" },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, color: C.gray, bg: C.light, border: C.border };
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ color: m.color, background: m.bg, border: `1px solid ${m.border}`, fontFamily: FONT_BODY }}>
      {m.dot && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: m.color }} />}
      {m.label}
    </span>
  );
}

const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`;
const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export default function ManagerPage() {
  const router = useRouter();

  // Upload state
  const [file,        setFile]        = useState<File | null>(null);
  const [dragging,    setDragging]    = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Sessions state
  const [sessions,   setSessions]   = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [triggeringId,    setTriggeringId]    = useState<string | null>(null);

  // Filter
  const [filter, setFilter] = useState<string>("all");

  // Offline notes modal
  interface NoteEntry { notes: string; timestamp: string; }
  const [offlineModal,     setOfflineModal]     = useState<{ session_id: string; filename: string } | null>(null);
  const [offlineNotes,     setOfflineNotes]     = useState("");
  const [offlineHistory,   setOfflineHistory]   = useState<NoteEntry[]>([]);
  const [offlineSaving,    setOfflineSaving]    = useState(false);

  const openOfflineModal = async (s: Session) => {
    setOfflineModal({ session_id: s.session_id, filename: s.filename });
    setOfflineNotes("");
    // Load existing notes history
    try {
      const res  = await fetch(`${API}/api/sessions/${s.session_id}/notes`);
      const data = await res.json();
      setOfflineHistory(data.notes ?? []);
    } catch { setOfflineHistory([]); }
  };
  const closeOfflineModal = () => { setOfflineModal(null); setOfflineNotes(""); setOfflineHistory([]); };

  const saveOfflineNotes = async () => {
    if (!offlineModal || !offlineNotes.trim() || offlineSaving) return;
    setOfflineSaving(true);
    try {
      await fetch(`${API}/api/sessions/${offlineModal.session_id}/notes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: offlineNotes }),
      });
      // Refresh history, keep modal open
      const res  = await fetch(`${API}/api/sessions/${offlineModal.session_id}/notes`);
      const data = await res.json();
      setOfflineHistory(data.notes ?? []);
      setOfflineNotes("");
    } catch { alert("Failed to save notes."); }
    finally { setOfflineSaving(false); }
  };

  const approveFromOffline = async () => {
    if (!offlineModal || !offlineNotes.trim() || offlineSaving) return;
    setOfflineSaving(true);
    try {
      await fetch(`${API}/api/sessions/${offlineModal.session_id}/approval`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "approved", comments: offlineNotes, approver: "Offline Review" }),
      });
      closeOfflineModal();
      await loadSessions();
    } catch { alert("Failed to approve."); }
    finally { setOfflineSaving(false); }
  };

  const loadSessions = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/api/sessions`);
      const data = await res.json();
      setSessions(data);
    } catch { /* ignore */ }
    setLoadingSessions(false);
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Auto-refresh every 10s to catch vendor progress
  useEffect(() => {
    const iv = setInterval(loadSessions, 10000);
    return () => clearInterval(iv);
  }, [loadSessions]);

  // ── File pick / drag ────────────────────────────────────────────────────
  const pickFile = (f: File) => {
    setUploadError("");
    if (f.size > MAX_MB * 1024 * 1024) { setUploadError(`File too large. Max ${MAX_MB} MB.`); return; }
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "docx", "txt"].includes(ext)) { setUploadError("Only PDF, DOCX or TXT files are accepted."); return; }
    setFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  };

  // ── Upload ───────────────────────────────────────────────────────────────
  const upload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setUploadError("");
    try {
      const fd  = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/api/sessions`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail);
      }
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await loadSessions();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  // ── Trigger negotiation ──────────────────────────────────────────────────
  const trigger = async (session_id: string) => {
    setTriggeringId(session_id);
    try {
      const res = await fetch(`${API}/api/sessions/${session_id}/trigger`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to send");
      await loadSessions();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to send for negotiation.");
    } finally {
      setTriggeringId(null);
    }
  };

  // ── Filtered sessions ────────────────────────────────────────────────────
  const filtered = filter === "all" ? sessions : sessions.filter(s => s.status === filter);

  const statusCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ minHeight: "100vh", background: C.light, fontFamily: FONT_BODY }}>

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <header style={{ background: C.dark }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="text-sm transition-opacity hover:opacity-70"
              style={{ color: C.orange, fontFamily: FONT_BODY }}>← Home</button>
            <div className="w-px h-4" style={{ background: "#1a2733" }} />
            <span className="font-bold text-xl tracking-tight" style={{ color: C.white, fontFamily: FONT_HEAD }}>MResult</span>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ background: "rgba(248,151,56,0.15)", color: C.orange, border: "1px solid rgba(248,151,56,0.3)" }}>
              Category Manager
            </span>
          </div>
          <button onClick={loadSessions}
            className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70"
            style={{ background: "#1a2733", color: C.gray, fontFamily: FONT_BODY }}>
            ↻ Refresh
          </button>
        </div>
        <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${C.orange} 0%, ${C.dark} 100%)` }} />
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── Contract Source Integration — compact horizontal layout ─── */}
        <section>
          <div className="flex items-baseline gap-3 mb-3">
            <h2 className="font-bold text-lg" style={{ color: C.dark, fontFamily: FONT_HEAD }}>Contract Source Integration</h2>
            <span className="text-xs" style={{ color: C.gray, fontFamily: FONT_BODY }}>Ingest contracts from any source</span>
          </div>

          <div className="flex gap-4 items-stretch">

            {/* ── Left: Active File Upload (≈40%) ─────────────────────── */}
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ width: "40%", flexShrink: 0, background: C.white, border: `2px solid ${C.orange}` }}>
              <div className="flex items-center gap-2">
                <span>📁</span>
                <span className="font-bold text-sm" style={{ color: C.dark, fontFamily: FONT_HEAD }}>File Upload</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: C.orangeBg, color: C.orange, border: `1px solid ${C.orangeBorder}` }}>Active</span>
              </div>

              {/* Compact drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => !file && fileRef.current?.click()}
                className="rounded-xl border-2 border-dashed p-4 text-center transition-all cursor-pointer flex-1 flex items-center justify-center"
                style={{ borderColor: dragging ? C.orange : file ? C.orange : C.border, background: dragging ? C.orangeBg : file ? C.orangeBg : C.light }}>
                <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />
                {file ? (
                  <div className="space-y-1">
                    <div className="text-2xl">📄</div>
                    <p className="font-semibold text-xs" style={{ color: C.dark }}>{file.name}</p>
                    <p className="text-[10px]" style={{ color: C.gray }}>{fmtBytes(file.size)}</p>
                    <button onClick={e => { e.stopPropagation(); setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                      className="text-[10px] underline" style={{ color: C.gray }}>Remove</button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-2xl">📁</div>
                    <p className="text-xs" style={{ color: C.dark }}>Drop SOW or <span style={{ color: C.orange }}>browse</span></p>
                    <p className="text-[10px]" style={{ color: C.gray }}>PDF, DOCX, TXT · Max {MAX_MB} MB</p>
                  </div>
                )}
              </div>
              {uploadError && (
                <p className="text-[10px] px-2 py-1.5 rounded-lg" style={{ background: "#FFF4F4", color: "#DC2626", border: "1px solid #FECACA" }}>
                  ⚠️ {uploadError}
                </p>
              )}
              <button onClick={upload} disabled={!file || uploading}
                className="py-2.5 rounded-xl font-semibold text-xs transition-all"
                style={{ background: file ? C.dark : C.border, color: file ? C.white : C.gray, cursor: file ? "pointer" : "not-allowed", fontFamily: FONT_BODY }}>
                {uploading ? "Uploading…" : "Upload Contract"}
              </button>
            </div>

            {/* ── Right: Connector placeholders (≈60%) ─────────────────── */}
            <div className="flex-1 grid grid-cols-3 gap-3">
              {[
                { icon: "🔷", name: "SAP Ariba",    desc: "ERP procurement" },
                { icon: "🟠", name: "ORO Labs",     desc: "Procurement platform" },
                { icon: "📂", name: "SharePoint",   desc: "Microsoft 365" },
                { icon: "💾", name: "OneDrive",     desc: "File storage" },
                { icon: "🟢", name: "Google Drive", desc: "Cloud storage" },
                { icon: "☁️", name: "AWS S3",       desc: "Object storage" },
              ].map(c => (
                <div key={c.name}
                  className="rounded-xl p-3 flex flex-col items-center text-center gap-1.5 cursor-not-allowed select-none"
                  style={{ background: C.white, border: `1px solid ${C.border}`, opacity: 0.55 }}>
                  <span className="text-xl">{c.icon}</span>
                  <p className="font-semibold text-[11px]" style={{ color: C.dark, fontFamily: FONT_HEAD }}>{c.name}</p>
                  <p className="text-[9px]" style={{ color: C.gray, fontFamily: FONT_BODY }}>{c.desc}</p>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: C.light, color: C.border, border: `1px solid ${C.border}`, fontFamily: FONT_BODY }}>
                    Connect
                  </span>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ── All Contracts table ───────────────────────────────────────── */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="font-bold text-lg" style={{ color: C.dark, fontFamily: FONT_HEAD }}>My Contracts</h2>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-2">
              {[
                ["all",                    `All (${sessions.length})`],
                ["uploaded",               `Uploaded (${statusCounts.uploaded || 0})`],
                ["sent_for_negotiation",   `Sent (${statusCounts.sent_for_negotiation || 0})`],
                ["negotiation_in_progress",`In Progress (${statusCounts.negotiation_in_progress || 0})`],
                ["pending_approval",         `Pending Approval (${statusCounts.pending_approval || 0})`],
                ["sent_for_renegotiation",  `Re-negotiating (${statusCounts.sent_for_renegotiation || 0})`],
                ["pending_offline_review",  `Offline Review (${statusCounts.pending_offline_review || 0})`],
                ["approved",               `Approved (${statusCounts.approved || 0})`],
                ["rejected",               `Rejected (${statusCounts.rejected || 0})`],
              ].map(([val, label]) => (
                <button key={val} onClick={() => setFilter(val)}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all"
                  style={{
                    background: filter === val ? C.dark : C.white,
                    color:      filter === val ? C.white : C.gray,
                    border:     `1px solid ${filter === val ? C.dark : C.border}`,
                    fontFamily: FONT_BODY,
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
            {loadingSessions ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-3"
                  style={{ borderColor: C.border, borderTopColor: C.orange }} />
                <p className="text-sm" style={{ color: C.gray }}>Loading contracts…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-3xl mb-3">📂</p>
                <p className="font-semibold text-sm" style={{ color: C.dark }}>No contracts found</p>
                <p className="text-xs mt-1" style={{ color: C.gray }}>
                  {filter === "all" ? "Upload your first SOW above to get started." : "No contracts match this filter."}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ background: C.light, borderBottom: `1px solid ${C.border}` }}>
                    {["Contract / SOW", "Uploaded", "Status", "Actions"].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: C.gray, fontFamily: FONT_BODY }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => (
                    <tr key={s.session_id}
                      style={{ background: i % 2 === 0 ? C.white : "#FAFAFA", borderBottom: `1px solid ${C.border}` }}>

                      {/* File name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base shrink-0">📄</span>
                          <span className="font-semibold text-sm truncate max-w-[200px]"
                            style={{ color: C.dark, fontFamily: FONT_BODY }}>{s.filename}</span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4">
                        <span className="text-xs" style={{ color: C.gray }}>{fmtDate(s.created_at)}</span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4"><StatusBadge status={s.status} /></td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {s.status === "uploaded" && (
                            <button onClick={() => trigger(s.session_id)} disabled={triggeringId === s.session_id}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
                              style={{ background: C.orange, color: C.white, fontFamily: FONT_BODY, opacity: triggeringId === s.session_id ? 0.6 : 1 }}>
                              {triggeringId === s.session_id ? "Sending…" : "Send to AI Agent for Negotiation →"}
                            </button>
                          )}
                          {s.status === "sent_for_negotiation" && (
                            <span className="text-xs" style={{ color: C.gray }}>Awaiting vendor…</span>
                          )}
                          {s.status === "sent_for_renegotiation" && (
                            <span className="text-xs font-semibold" style={{ color: "#4F46E5" }}>Awaiting Vendor…</span>
                          )}
                          {s.status === "negotiation_in_progress" && (
                            <span className="text-xs" style={{ color: "#D97706" }}>Negotiation active</span>
                          )}
                          {s.status === "pending_approval" && (
                            <button onClick={() => router.push(`/approval/${s.session_id}`)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                              style={{ background: C.orange, color: C.white, fontFamily: FONT_BODY }}>
                              Review & Approve →
                            </button>
                          )}
                          {s.status === "pending_offline_review" && (
                            <button onClick={() => openOfflineModal(s)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                              style={{ background: C.orange, color: C.white, fontFamily: FONT_BODY }}>
                              Add Offline Notes →
                            </button>
                          )}
                          {(s.status === "approved" || s.status === "rejected") && (
                            <button onClick={() => router.push(`/approval/${s.session_id}`)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                              style={{ background: C.light, color: C.gray, border: `1px solid ${C.border}`, fontFamily: FONT_BODY }}>
                              View Transcript
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="mt-12" style={{ background: C.dark, borderTop: "1px solid #1a2733" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-bold text-sm" style={{ color: C.white, fontFamily: FONT_HEAD }}>MResult</span>
          <span className="text-xs" style={{ color: "#4a6070" }}>AI Powered Contract Negotiation</span>
        </div>
      </footer>

      {/* ── Offline Notes Modal ──────────────────────────────────────────── */}
      {offlineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(9,19,27,0.55)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: C.white, border: `1px solid ${C.border}` }}>

            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between"
              style={{ background: C.dark, borderBottom: `2px solid ${C.orange}` }}>
              <div>
                <p className="font-bold text-sm" style={{ color: C.white, fontFamily: FONT_HEAD }}>Offline Review Notes</p>
                <p className="text-[11px] mt-0.5 truncate max-w-xs" style={{ color: C.gray }}>{offlineModal.filename}</p>
              </div>
              <button onClick={closeOfflineModal}
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-opacity hover:opacity-70"
                style={{ background: "#1a2733", color: C.gray }}>✕</button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">

              {/* Previous notes history */}
              {offlineHistory.length > 0 && (
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                  <div className="px-3 py-2 flex items-center gap-2" style={{ background: C.light, borderBottom: `1px solid ${C.border}` }}>
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.gray, fontFamily: FONT_BODY }}>
                      Previous Notes ({offlineHistory.length})
                    </span>
                  </div>
                  <div className="divide-y divide-gray-200 max-h-40 overflow-y-auto">
                    {offlineHistory.map((n, i) => (
                      <div key={i} className="px-3 py-2.5" style={{ background: i % 2 === 0 ? C.white : "#FAFAFA" }}>
                        <p className="text-[10px] mb-1" style={{ color: C.gray, fontFamily: FONT_BODY }}>
                          {new Date(n.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p className="text-xs leading-relaxed" style={{ color: C.dark, fontFamily: FONT_BODY }}>{n.notes}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New note */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-2"
                  style={{ color: C.gray, fontFamily: FONT_BODY }}>
                  {offlineHistory.length > 0 ? "Add New Note" : "Notes / Findings from Offline Review"}
                </label>
                <textarea
                  value={offlineNotes}
                  onChange={e => setOfflineNotes(e.target.value)}
                  rows={5}
                  placeholder="Document your findings, clarifications or conditions from the offline review…"
                  className="w-full rounded-xl p-3 text-sm resize-none outline-none"
                  style={{ background: C.light, border: `1px solid ${C.border}`, color: C.dark, fontFamily: FONT_BODY }}
                />
              </div>
              <p className="text-[10px]" style={{ color: C.gray, fontFamily: FONT_BODY }}>
                <strong>Save</strong> records the note and keeps the contract in Offline Review (modal stays open).&nbsp;
                <strong>Approve</strong> marks the contract as approved using your latest note as the approval comment.
              </p>
            </div>

            {/* Footer buttons */}
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={closeOfflineModal}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold flex-1"
                style={{ background: C.light, color: C.gray, border: `1px solid ${C.border}`, fontFamily: FONT_BODY }}>
                Close
              </button>
              <button
                onClick={saveOfflineNotes}
                disabled={!offlineNotes.trim() || offlineSaving}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold flex-1 transition-all"
                style={{ background: !offlineNotes.trim() ? C.border : C.dark, color: !offlineNotes.trim() ? C.gray : C.white, cursor: !offlineNotes.trim() ? "not-allowed" : "pointer", fontFamily: FONT_BODY }}>
                {offlineSaving ? "Saving…" : "Save Notes"}
              </button>
              <button
                onClick={approveFromOffline}
                disabled={!offlineNotes.trim() || offlineSaving}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold flex-1 transition-all"
                style={{ background: !offlineNotes.trim() ? C.border : C.orange, color: !offlineNotes.trim() ? C.gray : C.white, cursor: !offlineNotes.trim() ? "not-allowed" : "pointer", fontFamily: FONT_BODY }}>
                {offlineSaving ? "Approving…" : "Approve →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
