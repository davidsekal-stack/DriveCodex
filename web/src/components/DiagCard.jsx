import { useState, useEffect } from "react";
import { useI18n } from "../i18n/index.jsx";
import { useTheme } from "../contexts/ThemeContext.jsx";
import useIsMobile from "../hooks/useIsMobile.js";
import { ObdChip } from "./Chip.jsx";
import { lookupManual } from "../lib/storage-edge.js";
import { filterManualRefs, MANUAL_LOOKUP_ENABLED } from "../lib/manual-refs.js";
import { REPAIR_GUIDE_CARD_ID, isGuideForFault } from "../lib/repair-guide.js";

// ── Source-based colors ──────────────────────────────────────────────────────
// Green = from database (verified), Blue = AI-generated
const SOURCE_COLORS = {
  databáze: { accent: "#16a34a", light: "rgba(22,163,74,0.10)", border: "rgba(22,163,74,0.35)" },
  ai:       { accent: "#1a6fd8", light: "rgba(26,111,216,0.10)", border: "rgba(26,111,216,0.35)" },
};

function sourceColor(fault) {
  return SOURCE_COLORS[fault.zdroj] || SOURCE_COLORS.ai;
}

// ── Pomocné sub-komponenty ────────────────────────────────────────────────────

function SectionLabel({ children }) {
  const { t } = useTheme();
  return (
    <div style={{ fontSize: "0.58rem", color: t.textFaint, letterSpacing: "0.12em", marginBottom: 6 }}>
      {children}
    </div>
  );
}

export function SourceBadge({ fault, tr }) {
  const { t } = useTheme();
  const isDb = fault.zdroj === "databáze";
  const sc = sourceColor(fault);
  const count = fault.početShod ?? fault.shpipadů ?? 0;

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.06em",
      color: sc.accent, background: sc.light, border: `1px solid ${sc.border}`,
      padding: "2px 8px", borderRadius: 10,
    }}>
      {isDb ? `◈ ${tr('diag.sourceDb')}` : `✦ ${tr('diag.sourceAi')}`}
      {isDb && count > 0 && (
        <span style={{ fontSize: "0.55rem", opacity: 0.8 }}>
          ({tr('diag.dbCases', { count })})
        </span>
      )}
    </span>
  );
}

function getUniqueRagSources(ragMatches = []) {
  const seen = new Set();
  const unique = [];

  for (const match of ragMatches) {
    const key = [match?.sourceRef, match?.threadUrl, match?.id].filter(Boolean).join("||");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(match);
    if (unique.length >= 5) break;
  }

  return unique;
}

// ── Per-fault manual references (inline in each FaultCard) ──────────────────

function FaultManualRef({ vehicle, fault, tr, onOpenManual }) {
  // Feature flag — disabled until licensing and data pipeline are ready.
  // Flip MANUAL_LOOKUP_ENABLED in manual-refs.js to re-enable without any
  // other code changes needed.
  if (!MANUAL_LOOKUP_ENABLED) return null;

  const { t } = useTheme();
  const [refs, setRefs] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!vehicle?.brand) return;

    const components = (fault.díly || []).filter(Boolean);
    const faultNames = [fault.název].filter(Boolean);
    if (components.length === 0 && faultNames.length === 0) return;

    let cancelled = false;
    setLoading(true);

    lookupManual({
      brand: vehicle.brand,
      model: vehicle.model,
      enginePower: vehicle.enginePower,
      components,
      faultNames,
    }).then((res) => {
      if (!cancelled) {
        setRefs(res.ok ? res.results : []);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setRefs([]);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [vehicle?.brand, vehicle?.model, vehicle?.enginePower, fault.název]);

  if (!vehicle?.model) return null;
  // Only show if results are vehicle-constrained (model or engine matched).
  // Tiers 1d/2/3/4 drop all vehicle filters — result may be from a different car's manual.
  const relevantRefs = filterManualRefs(refs);
  if (relevantRefs !== null && relevantRefs.length === 0 && !loading) return null;

  return (
    <div style={{
      background: t.bgCardAlt,
      border: `1px solid ${t.border}`,
      padding: "10px 12px",
      borderRadius: 2,
      marginTop: 10,
    }}>
      <SectionLabel>{tr('diag.workshopManual')}</SectionLabel>
      {loading && (
        <div style={{ fontSize: "0.72rem", color: t.textFaint, fontStyle: "italic" }}>
          {tr('diag.loadingManual')}
        </div>
      )}
      {relevantRefs && relevantRefs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {relevantRefs.slice(0, 3).map((ref, i) => (
            <div
              key={i}
              onClick={() => onOpenManual?.(ref)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onOpenManual?.(ref)}
              style={{
                borderLeft: `2px solid ${t.accent}`,
                paddingLeft: 10,
                cursor: onOpenManual ? "pointer" : "default",
                borderRadius: 2,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { if (onOpenManual) e.currentTarget.style.background = `${t.accent}10`; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <div style={{ fontSize: "0.74rem", color: t.text, fontWeight: 600, flex: 1 }}>
                  {ref.section}
                </div>
                {onOpenManual && (
                  <span style={{
                    fontSize: "0.62rem",
                    color: t.accent,
                    textDecoration: "underline",
                    flexShrink: 0,
                  }}>
                    {tr('diag.openProcedure')} &rarr;
                  </span>
                )}
              </div>
              <div style={{ fontSize: "0.64rem", color: t.textFaint, marginTop: 2 }}>
                {ref.manual} {ref.page != null ? `· ${tr('diag.manualPage')} ${ref.page}` : ""}
              </div>
              {ref.subsections?.length > 0 && (
                <div style={{ marginTop: 3 }}>
                  {ref.subsections.slice(0, 3).map((sub, j) => (
                    <div key={j} style={{ fontSize: "0.68rem", color: t.textMuted, padding: "1px 0" }}>
                      {sub.number} {sub.title}
                    </div>
                  ))}
                  {ref.subsections.length > 3 && (
                    <div style={{ fontSize: "0.62rem", color: t.textFaint }}>
                      +{ref.subsections.length - 3} {tr('diag.moreProcedures')}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Jedna závada ──────────────────────────────────────────────────────────────

function FaultCard({ fault: f, isPrimary, tr, mobile, vehicle, onOpenManual, onStartRepair, guideActive }) {
  const { t } = useTheme();
  const sc = sourceColor(f);

  const handleRepairClick = () => {
    if (guideActive) {
      document.getElementById(REPAIR_GUIDE_CARD_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    onStartRepair?.();
  };

  return (
    <div style={{ background: t.bgCard, border: `2px solid ${isPrimary ? sc.accent : t.border}`, padding: mobile ? "12px" : "16px", borderLeft: `5px solid ${sc.accent}`, marginBottom: 16, borderRadius: 3 }}>

      {/* Název + pravděpodobnost */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: mobile ? "1.1rem" : "1.3rem", fontWeight: 700, color: isPrimary ? sc.accent : t.text, letterSpacing: "0.04em" }}>
            {isPrimary && "◈ "}{f.název}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            <SourceBadge fault={f} tr={tr} />
            {f.díly?.length > 0 && (
              <span style={{ fontSize: "0.66rem", color: t.textFaint }}>
                {f.díly.join(" · ")}
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: mobile ? "1.2rem" : "1.5rem", fontFamily: "'Exo 2',sans-serif", fontWeight: 800, color: sc.accent }}>
            {f.pravděpodobnost}%
          </div>
          <div style={{ fontSize: "0.5rem", color: t.textFaint, letterSpacing: "0.08em" }}>{tr('diag.probability')}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: t.probBarBg, marginBottom: 12, borderRadius: 2 }}>
        <div style={{ height: "100%", width: `${f.pravděpodobnost}%`, background: sc.accent, borderRadius: 2, transition: "width 1s ease" }} />
      </div>

      <div style={{ fontSize: "0.84rem", color: t.textMuted, lineHeight: 1.7, marginBottom: 10 }}>
        {f.popis}
      </div>

      {/* OBD kódy */}
      {f.obd_kódy?.length > 0 && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
          {f.obd_kódy.map((c) => <ObdChip key={c} code={c} />)}
        </div>
      )}

      {/* Postup opravy */}
      {f.postup && (
        <div style={{ background: t.postupBg, border: `1px solid ${t.postupBorder}`, padding: "10px 14px", marginBottom: 8, borderRadius: 2 }}>
          <SectionLabel>{tr('diag.repairProcedure')}</SectionLabel>
          <div style={{ fontSize: "0.8rem", color: t.textMuted, lineHeight: 1.8 }}>{f.postup}</div>
        </div>
      )}

      {/* Poznámka */}
      {f.poznámka && (
        <div style={{ fontSize: "0.76rem", color: t.noteColor, fontStyle: "italic", borderLeft: `2px solid ${t.noteBorder}`, paddingLeft: 8, marginBottom: 8 }}>
          {f.poznámka}
        </div>
      )}

      {/* Zahájení průvodce opravou */}
      {onStartRepair && f.řešení?.length > 0 && (
        <button
          data-testid="start-repair-guide"
          onClick={handleRepairClick}
          style={{
            background: guideActive ? "transparent" : sc.accent,
            border: `1px solid ${sc.accent}`,
            color: guideActive ? sc.accent : "#fff",
            padding: "8px 18px", fontSize: "0.76rem", fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", borderRadius: 2,
            letterSpacing: "0.04em", marginTop: 2,
          }}>
          {guideActive ? `▾ ${tr("guide.continue")}` : `▸ ${tr("guide.start")}`}
        </button>
      )}

      {/* Workshop Manual Reference — per-fault, interactive */}
      {vehicle && (
        <FaultManualRef vehicle={vehicle} fault={f} tr={tr} onOpenManual={onOpenManual} />
      )}
    </div>
  );
}

// ── Hlavní komponenta ─────────────────────────────────────────────────────────

export default function DiagCard({ result, ragMatches = [], vehicle, onOpenManual, onStartRepair, repairGuide, messageId }) {
  const { t } = useTheme();
  const { tr } = useI18n();
  const mobile = useIsMobile();
  const dalsiInfo = result.další_info === "Výsledek zkrácen." ? null : result.další_info;
  const hasMeta = result.doporučené_testy?.length > 0 || result.varování || dalsiInfo;
  const ragSources = getUniqueRagSources(ragMatches).filter((match) => match?.sourceRef || match?.threadUrl);

  return (
    <div className="fade-in" data-testid="diagnosis-result">
      {/* Shrnutí */}
      <div style={{ padding: "14px 16px", background: t.bgCardAlt, border: `1px solid ${t.borderAccent}`, borderLeft: `3px solid ${t.accent}`, marginBottom: 12, borderRadius: 2 }}>
        <div style={{ fontSize: "0.62rem", color: t.textFaint, letterSpacing: "0.15em", marginBottom: 5 }}>{tr('diag.title')}</div>
        <div style={{ fontSize: "0.88rem", color: t.diagText, lineHeight: 1.6 }}>{result.shrnutí}</div>
        {ragMatches.length > 0 && (
          <div style={{ marginTop: 6, fontSize: "0.7rem", color: t.doneStatusColor }}>
            {tr('diag.ragInfo', { count: ragMatches.length })}
          </div>
        )}
      </div>

      {ragSources.length > 0 && (
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, padding: "12px", borderRadius: 2, marginBottom: 12 }}>
          <SectionLabel t={t}>{tr('diag.databaseSources')}</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ragSources.map((match, index) => {
              const vehicleLabel = [match.vehicle?.brand, match.vehicle?.model].filter(Boolean).join(" ");
              const resolutionPreview = typeof match.resolution === "string" ? match.resolution.slice(0, 120) : "";

              return (
                <div key={`${match.sourceRef || "source"}-${index}`} style={{ borderLeft: `2px solid ${t.borderAccent}`, paddingLeft: 10 }}>
                  <div style={{ fontSize: "0.76rem", color: t.text, fontWeight: 600 }}>
                    {match.sourceRef || tr('diag.databaseSourceFallback')}
                  </div>
                  {vehicleLabel && (
                    <div style={{ fontSize: "0.7rem", color: t.textFaint, marginTop: 2 }}>
                      {vehicleLabel}
                    </div>
                  )}
                  {resolutionPreview && (
                    <div style={{ fontSize: "0.72rem", color: t.textMuted, marginTop: 2, lineHeight: 1.5 }}>
                      {resolutionPreview}{match.resolution?.length > 120 ? "..." : ""}
                    </div>
                  )}
                  {match.threadUrl && (
                    <a
                      href={match.threadUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "inline-block", marginTop: 4, fontSize: "0.72rem", color: t.accent, textDecoration: "underline" }}
                    >
                      {tr('diag.openSource')}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Závady — each with its own manual reference */}
      {result.závady?.map((f, i) => (
        <FaultCard
          key={i}
          fault={f}
          isPrimary={i === 0}
          tr={tr}
          mobile={mobile}
          vehicle={vehicle}
          onOpenManual={onOpenManual}
          onStartRepair={onStartRepair ? () => onStartRepair(i) : undefined}
          guideActive={isGuideForFault(repairGuide, messageId, i) && !repairGuide?.completedAt}
        />
      ))}

      {/* Doporučené testy + poznámky */}
      {hasMeta && (
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 8, marginTop: 8 }}>
          {result.doporučené_testy?.length > 0 && (
            <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, padding: "12px", borderRadius: 2 }}>
              <SectionLabel>{tr('diag.recommendedTests')}</SectionLabel>
              {result.doporučené_testy.map((test, i) => (
                <div key={i} style={{ fontSize: "0.78rem", color: t.textMuted, padding: "3px 0", borderBottom: `1px solid ${t.border}`, display: "flex", gap: 6 }}>
                  <span style={{ color: t.accent }}>{String(i + 1).padStart(2, "0")}.</span>
                  {test}
                </div>
              ))}
            </div>
          )}
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, padding: "12px", borderRadius: 2 }}>
            <SectionLabel>{tr('diag.notes')}</SectionLabel>
            {result.varování && (
              <div style={{ fontSize: "0.76rem", color: "#dc2626", background: "rgba(220,38,38,0.07)", padding: "6px 8px", marginBottom: 6, borderLeft: "2px solid #dc2626", borderRadius: 2 }}>
                ⚠ {result.varování}
              </div>
            )}
            {dalsiInfo && (
              <div style={{ fontSize: "0.76rem", color: t.obdText, background: t.obdBg, padding: "6px 8px", borderLeft: `2px solid ${t.borderAccent}`, borderRadius: 2 }}>
                ℹ {dalsiInfo}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
