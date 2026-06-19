/**
 * Admin Review Panel — zobrazí pending případy k revizi
 * Admin může schválit nebo zamítnout jednotlivé případy (approve/reject)
 */

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { fmtDate } from "../lib/utils.js";
import { FONT, SMALL, TINY } from "../constants/typography.js";

// Rejection reason codes — map 1:1 to the verifier's 6 conditions (see verify.mjs /
// migration 024), so the rejections become diagnostic labels for Phase-4 gate tuning.
const REJECT_REASONS = ["not_a_fault", "no_repair", "unconfirmed", "vehicle_mismatch", "not_car", "vague", "other"];

function Badge({ label, bg, color, border }) {
  return (
    <span style={{ padding: "2px 7px", fontSize: TINY, fontWeight: 600, background: bg, color, border: `1px solid ${border}`, borderRadius: 2, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function CaseCard({ c, lang, tr, onApprove, onReject, busy }) {
  const { t } = useTheme();
  const [rejecting, setRejecting] = useState(false);
  const symptoms = c.symptoms ?? [];
  const codes = c.obd_codes ?? [];

  return (
    <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 4, padding: "16px 18px", marginBottom: 10 }}>
      {/* Header: vehicle + meta */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 600, color: t.text, marginBottom: 3 }}>
            {c.vehicle_brand} {c.vehicle_model}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: SMALL, color: t.textFaint }}>
            {c.engine_power && <span>{c.engine_power}</span>}
            {c.mileage && <span>· {Number(c.mileage).toLocaleString()} km</span>}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: SMALL, color: t.textFaint }}>{c.user_email || "—"}</div>
          <div style={{ fontSize: TINY, color: t.textVeryFaint, marginTop: 2 }}>
            {c.closed_at ? fmtDate(c.closed_at, lang) : "—"}
          </div>
        </div>
      </div>

      {/* Symptoms + OBD codes */}
      {(symptoms.length > 0 || codes.length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
          {symptoms.map((s, i) => (
            <Badge key={`s${i}`} label={s} bg={t.sympBg} color={t.sympText} border={t.sympBorder} />
          ))}
          {codes.map((c, i) => (
            <Badge key={`c${i}`} label={c} bg={t.obdBg} color={t.obdText} border={t.obdBorder} />
          ))}
        </div>
      )}

      {/* Description */}
      {c.description && (
        <div style={{ fontSize: FONT, color: t.textMuted, marginBottom: 10, lineHeight: 1.6, fontStyle: "italic" }}>
          {c.description.length > 200 ? c.description.slice(0, 200) + "…" : c.description}
        </div>
      )}

      {/* Resolution */}
      <div style={{ padding: "10px 12px", background: t.bgMuted, border: `1px solid ${t.border}`, borderLeft: `3px solid ${t.doneStatusColor}`, borderRadius: 2, marginBottom: 12 }}>
        <div style={{ fontSize: TINY, color: t.doneStatusColor, letterSpacing: "0.08em", marginBottom: 4 }}>
          {tr("review.resolution")}
        </div>
        <div style={{ fontSize: FONT, color: t.text, lineHeight: 1.6 }}>
          {c.resolution}
        </div>
      </div>

      {/* Action buttons */}
      {!rejecting ? (
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            disabled={busy}
            onClick={() => setRejecting(true)}
            style={{
              background: "rgba(220,38,38,0.07)",
              border: "1px solid rgba(220,38,38,0.3)",
              color: "#dc2626",
              padding: "7px 18px",
              fontSize: FONT,
              cursor: busy ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              borderRadius: 2,
              opacity: busy ? 0.5 : 1,
            }}
          >
            ✕ {tr("review.reject")}
          </button>
          <button
            disabled={busy}
            onClick={() => onApprove(c.id)}
            style={{
              background: t.doneStatusColor,
              border: `1px solid ${t.doneStatusColor}`,
              color: "#fff",
              padding: "7px 18px",
              fontSize: FONT,
              fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              borderRadius: 2,
              opacity: busy ? 0.5 : 1,
            }}
          >
            ✓ {tr("review.approve")}
          </button>
        </div>
      ) : (
        /* Reason chooser — one click on a reason rejects with that label */
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: SMALL, color: t.textMuted, fontWeight: 600 }}>{tr("review.rejectReasonPrompt")}</span>
            <button
              disabled={busy}
              onClick={() => setRejecting(false)}
              style={{ background: "none", border: "none", color: t.textFaint, fontSize: SMALL, cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit", textDecoration: "underline" }}
            >
              {tr("review.cancel")}
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
            {REJECT_REASONS.map((r) => (
              <button
                key={r}
                disabled={busy}
                onClick={() => onReject(c.id, r)}
                style={{
                  background: "rgba(220,38,38,0.07)",
                  border: "1px solid rgba(220,38,38,0.3)",
                  color: "#dc2626",
                  padding: "6px 12px",
                  fontSize: SMALL,
                  cursor: busy ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  borderRadius: 2,
                  opacity: busy ? 0.5 : 1,
                }}
              >
                {tr(`review.reason.${r}`)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReviewPanel({ lang, tr, fetchCases, updateStatus }) {
  const { t } = useTheme();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyIds, setBusyIds] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCases();
      setCases(data.cases ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fetchCases]);

  useEffect(() => { load(); }, [load]);

  const handleAction = useCallback(async (id, status, reason) => {
    setBusyIds((s) => new Set([...s, id]));
    try {
      await updateStatus(id, status, reason);
      setCases((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyIds((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }, [updateStatus]);

  const approveAll = useCallback(async () => {
    const ids = cases.map((c) => c.id);
    if (!ids.length) return;
    setBusyIds(new Set(ids));
    try {
      await updateStatus(ids, "approved");
      setCases([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyIds(new Set());
    }
  }, [cases, updateStatus]);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px", background: t.bg }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: "1.5rem", fontWeight: 700, color: t.accent, letterSpacing: "0.05em" }}>
              {tr("review.title")}
            </div>
            <div style={{ fontSize: SMALL, color: t.textFaint, marginTop: 2 }}>
              {loading ? tr("review.loading") : tr("review.count", { count: cases.length })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={load} disabled={loading}
              style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textMuted, padding: "7px 14px", fontSize: FONT, cursor: "pointer", fontFamily: "inherit", borderRadius: 2 }}>
              ↻ {tr("review.refresh")}
            </button>
            {cases.length > 1 && (
              <button onClick={approveAll} disabled={busyIds.size > 0}
                style={{ background: t.doneStatusColor, border: `1px solid ${t.doneStatusColor}`, color: "#fff", padding: "7px 14px", fontSize: FONT, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", borderRadius: 2 }}>
                ✓ {tr("review.approveAll")}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 14, padding: "10px 13px", background: "rgba(220,38,38,0.08)", border: "1px solid #dc2626", color: "#dc2626", fontSize: FONT, borderRadius: 2 }}>
            ⚠ {error}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: t.textFaint, fontSize: FONT }}>
            {tr("review.loading")}
          </div>
        )}

        {!loading && cases.length === 0 && !error && (
          <div style={{ textAlign: "center", padding: "60px 0", color: t.textVeryFaint, fontSize: FONT, letterSpacing: "0.08em" }}>
            {tr("review.empty")}
          </div>
        )}

        {cases.map((c) => (
          <CaseCard
            key={c.id}
            c={c}
            lang={lang}
            tr={tr}
            busy={busyIds.has(c.id)}
            onApprove={(id) => handleAction(id, "approved")}
            onReject={(id, reason) => handleAction(id, "rejected", reason)}
          />
        ))}
      </div>
    </div>
  );
}
