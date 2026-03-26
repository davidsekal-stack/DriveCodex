import { useEffect, useState } from "react";

import { MSG, CASE_STATUS } from "../constants/enums.js";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext.jsx";
import { useI18n } from "../i18n/index.jsx";
import useIsMobile from "../hooks/useIsMobile.js";
import { supabase } from "../lib/supabase.js";
import { fmtDate, fmtMileage } from "../lib/utils.js";
import { getInputRoundNumber } from "../lib/session-view.js";
import GlobalStyles from "./GlobalStyles.jsx";
import { SymptomChip, ObdChip } from "./Chip.jsx";
import DiagCard from "./DiagCard.jsx";

// ── Shared Case Page (public, read-only) ─────────────────────────────────────

function SharedCaseViewInner({ shareId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const { t, darkMode, toggleDarkMode } = useTheme();
  const { tr, lang, changeLang } = useI18n();
  const mobile = useIsMobile();

  useEffect(() => {
    async function fetchShare() {
      try {
        const { data: row, error: err } = await supabase
          .from("shared_cases")
          .select("snapshot, vehicle_summary, fault_summary, created_at")
          .eq("id", shareId)
          .single();

        if (err || !row) {
          setError(tr("share.notFound"));
          return;
        }

        setData(row);
      } catch {
        setError(tr("share.notFound"));
      } finally {
        setLoading(false);
      }
    }

    fetchShare();
  }, [shareId]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: t.bg, fontFamily: "'IBM Plex Mono','Courier New',monospace" }}>
        <GlobalStyles />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: t.accent, letterSpacing: "0.15em" }}>GEARBRAIN</div>
          <div style={{ fontSize: "0.75rem", color: t.textFaint, marginTop: 8, animation: "pulse 1.5s ease infinite" }}>{tr("share.loading")}</div>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: t.bg, fontFamily: "'IBM Plex Mono','Courier New',monospace" }}>
        <GlobalStyles />
        <div style={{ textAlign: "center", maxWidth: 400, padding: 20 }}>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: t.accent, letterSpacing: "0.15em", marginBottom: 16 }}>GEARBRAIN</div>
          <div style={{ fontSize: "0.85rem", color: "#dc2626", marginBottom: 24 }}>{error || tr("share.notFound")}</div>
          <ShareCTA tr={tr} />
        </div>
      </div>
    );
  }

  const snapshot = data.snapshot;
  const vehicle = snapshot.vehicle ?? {};
  const messages = snapshot.messages ?? [];

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'IBM Plex Mono','Courier New',monospace", transition: "background 0.2s, color 0.2s" }}>
      <GlobalStyles />

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: mobile ? "10px 12px" : "12px 24px", background: t.bgHeader, borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1rem", fontWeight: 700, color: t.accent, letterSpacing: "0.12em" }}>GEARBRAIN</span>
          <span style={{ fontSize: "0.55rem", color: t.textFaint, letterSpacing: "0.1em" }}>{tr("share.badge")}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={toggleDarkMode} style={{ background: "transparent", border: "none", color: t.textFaint, cursor: "pointer", fontSize: "0.72rem", fontFamily: "inherit" }}>
            {darkMode ? tr("app.lightMode") : tr("app.darkMode")}
          </button>
          {["cs", "en", "de"].map((code) => (
            <button key={code} onClick={() => changeLang(code)} style={{ background: lang === code ? t.accent : "transparent", color: lang === code ? "#fff" : t.textFaint, border: `1px solid ${lang === code ? t.accent : t.border}`, padding: "2px 6px", fontSize: "0.6rem", fontFamily: "inherit", cursor: "pointer", borderRadius: 2 }}>{code.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* ── Vehicle header ──────────────────────────────────────────────────── */}
      <div style={{ padding: mobile ? "14px 12px" : "18px 24px", background: t.bgHeader, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 600, color: t.text }}>{snapshot.name || data.vehicle_summary || tr("app.defaultVehicle")}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
            {vehicle.model && <span style={{ fontSize: "0.72rem", color: t.textFaint }}>{vehicle.model}</span>}
            {vehicle.enginePower && <span style={{ fontSize: "0.72rem", color: t.textVeryFaint }}>· {vehicle.enginePower}</span>}
            {vehicle.mileage && <span style={{ fontSize: "0.72rem", color: t.textVeryFaint }}>· {fmtMileage(vehicle.mileage, lang)}</span>}
            <span style={{ fontSize: "0.6rem", color: t.doneStatusColor, background: t.doneStatusBg, border: `1px solid ${t.doneStatusBorder}`, padding: "1px 6px", borderRadius: 2, letterSpacing: "0.06em" }}>{tr("share.badge")}</span>
          </div>
        </div>
      </div>

      {/* ── Timeline (reuse existing rendering logic) ───────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: mobile ? "10px" : "20px", background: t.bg }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: mobile ? 8 : 12 }}>
          {messages.map((message, index) => {
            if (message.type === MSG.INPUT) {
              const roundNo = getInputRoundNumber(messages, index);
              const hasChips = (message.symptoms?.length > 0) || (message.obdCodes?.length > 0);

              return (
                <div key={message.id || index} style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ maxWidth: mobile ? "88%" : "72%", minWidth: mobile ? 0 : 120 }}>
                    <div style={{ fontSize: "0.65rem", color: t.textFaint, textAlign: "right", marginBottom: 4, letterSpacing: "0.06em" }}>
                      {tr("app.inputRound", { num: roundNo, date: fmtDate(message.timestamp, lang) })}
                    </div>
                    <div style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRight: `3px solid ${t.accent}`, borderRadius: "8px 2px 8px 8px", padding: "10px 14px" }}>
                      {hasChips && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: message.text ? 8 : 0 }}>
                          {(message.symptoms ?? []).map((symptom) => (
                            <SymptomChip key={symptom} label={tr(symptom)} />
                          ))}
                          {(message.obdCodes ?? []).map((code) => (
                            <ObdChip key={code} code={code} />
                          ))}
                        </div>
                      )}
                      {message.text && (
                        <div style={{ fontSize: "0.85rem", color: t.text, lineHeight: 1.6 }}>{message.text}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            if (message.type === MSG.DIAGNOSIS) {
              return (
                <div key={message.id || index} style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ maxWidth: "92%" }}>
                    <div style={{ fontSize: "0.65rem", color: t.accentText, marginBottom: 4, letterSpacing: "0.06em" }}>
                      ◈ GearBrain · {fmtDate(message.timestamp, lang)}
                    </div>
                    <DiagCard result={message.result} ragMatches={[]} />
                  </div>
                </div>
              );
            }

            return null;
          })}

          {/* Resolution block */}
          {snapshot.status === CASE_STATUS.CLOSED && snapshot.resolution && (
            <div style={{ padding: "14px 16px", background: t.closedBg, border: `1px solid ${t.closedBorder}`, borderLeft: `4px solid ${t.doneStatusColor}`, borderRadius: 2, marginTop: 4 }}>
              <div style={{ fontSize: "0.68rem", color: t.doneStatusColor, letterSpacing: "0.1em", marginBottom: 6 }}>
                {tr("app.caseClosed", { date: snapshot.closedAt ? fmtDate(snapshot.closedAt, lang) : "" })}
              </div>
              <div style={{ fontSize: "0.9rem", color: t.doneStatusColor, lineHeight: 1.6 }}>{snapshot.resolution}</div>
            </div>
          )}
        </div>
      </div>

      {/* ── CTA footer ──────────────────────────────────────────────────────── */}
      <div style={{ padding: mobile ? "20px 12px" : "30px 24px", background: t.bgHeader, borderTop: `1px solid ${t.border}` }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <ShareCTA tr={tr} />
        </div>
      </div>
    </div>
  );
}

export default function SharedCaseView({ shareId }) {
  return (
    <ThemeProvider>
      <SharedCaseViewInner shareId={shareId} />
    </ThemeProvider>
  );
}

// ── CTA Component ──────────────────────────────────────────────────────────

function ShareCTA({ tr }) {
  const { t } = useTheme();
  return (
    <div style={{ textAlign: "center", padding: "16px 0" }}>
      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: t.text, marginBottom: 6, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: "0.06em" }}>
        {tr("share.cta.title")}
      </div>
      <div style={{ fontSize: "0.78rem", color: t.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
        {tr("share.cta.text")}
      </div>
      <a
        href={window.location.origin}
        style={{ display: "inline-block", background: t.accent, color: "#ffffff", padding: "10px 28px", fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.1em", fontFamily: "inherit", textDecoration: "none", borderRadius: 2, cursor: "pointer" }}
      >
        {tr("share.cta.btn")}
      </a>
    </div>
  );
}
