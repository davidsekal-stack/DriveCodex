import { useI18n } from "../i18n/index.jsx";
import { useTheme } from "../contexts/ThemeContext.jsx";
import useIsMobile from "../hooks/useIsMobile.js";
import { ObdChip } from "./Chip.jsx";

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

function SourceBadge({ fault, tr }) {
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

// ── Jedna závada ──────────────────────────────────────────────────────────────

function FaultCard({ fault: f, isPrimary, tr, mobile }) {
  const { t } = useTheme();
  const sc = sourceColor(f);
  return (
    <div style={{ background: t.bgCard, border: `1px solid ${isPrimary ? sc.accent : t.border}`, padding: mobile ? "12px" : "16px", borderLeft: `4px solid ${sc.accent}`, marginBottom: 8, borderRadius: 2 }}>

      {/* Název + pravděpodobnost */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: mobile ? "1.1rem" : "1.3rem", fontWeight: 700, color: isPrimary ? sc.accent : t.text, letterSpacing: "0.04em" }}>
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
          <div style={{ fontSize: mobile ? "1.2rem" : "1.5rem", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, color: sc.accent }}>
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
        <div style={{ fontSize: "0.76rem", color: t.noteColor, fontStyle: "italic", borderLeft: `2px solid ${t.noteBorder}`, paddingLeft: 8 }}>
          {f.poznámka}
        </div>
      )}
    </div>
  );
}

// ── Hlavní komponenta ─────────────────────────────────────────────────────────

export default function DiagCard({ result, ragMatches = [] }) {
  const { t } = useTheme();
  const { tr } = useI18n();
  const mobile = useIsMobile();
  const dalsiInfo = result.další_info === "Výsledek zkrácen." ? null : result.další_info;
  const hasMeta = result.doporučené_testy?.length > 0 || result.varování || dalsiInfo;

  return (
    <div className="fade-in">
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

      {/* Závady */}
      {result.závady?.map((f, i) => (
        <FaultCard key={i} fault={f} isPrimary={i === 0} tr={tr} mobile={mobile} />
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
