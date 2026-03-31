import { useTheme } from "../contexts/ThemeContext.jsx";
import { useI18n } from "../i18n/index.jsx";
import useIsMobile from "../hooks/useIsMobile.js";

// ── ManualChapterView ────────────────────────────────────────────────────────
// Full-screen panel showing workshop manual section details.
// Receives a `section` object (from manual-lookup edge function) + onBack callback.

export default function ManualChapterView({ section, onBack }) {
  const { t } = useTheme();
  const { tr } = useI18n();
  const mobile = useIsMobile();

  if (!section) return null;

  const hasSubsections = section.subsections?.length > 0;
  const hasComponents = section.components?.length > 0;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header bar */}
      <div style={{
        padding: mobile ? "10px 12px" : "12px 20px",
        background: t.bgCard,
        borderBottom: `1px solid ${t.border}`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: `1px solid ${t.border}`,
            color: t.accent,
            padding: "6px 14px",
            borderRadius: 2,
            cursor: "pointer",
            fontSize: "0.72rem",
            fontFamily: "'IBM Plex Mono','Courier New',monospace",
            letterSpacing: "0.06em",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ fontSize: "0.9rem" }}>&larr;</span>
          {tr('diag.manualViewBack')}
        </button>
        <div style={{
          fontSize: "0.6rem",
          color: t.textFaint,
          letterSpacing: "0.15em",
          fontWeight: 600,
        }}>
          {tr('diag.manualViewTitle')}
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: mobile ? "12px" : "24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {/* Section title */}
          <div style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: mobile ? "1.3rem" : "1.6rem",
            fontWeight: 700,
            color: t.text,
            letterSpacing: "0.04em",
            marginBottom: 8,
          }}>
            {section.section}
          </div>

          {/* Manual name + page + repair group */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            marginBottom: 20,
          }}>
            <span style={{
              fontSize: "0.7rem",
              color: t.textFaint,
              background: t.bgCardAlt,
              border: `1px solid ${t.border}`,
              padding: "3px 10px",
              borderRadius: 10,
            }}>
              {section.manual}
            </span>
            {section.page != null && (
              <span style={{
                fontSize: "0.7rem",
                color: t.textFaint,
                background: t.bgCardAlt,
                border: `1px solid ${t.border}`,
                padding: "3px 10px",
                borderRadius: 10,
              }}>
                {tr('diag.manualPage')} {section.page}
              </span>
            )}
            {section.repair_group && (
              <span style={{
                fontSize: "0.7rem",
                color: t.textFaint,
                background: t.bgCardAlt,
                border: `1px solid ${t.border}`,
                padding: "3px 10px",
                borderRadius: 10,
              }}>
                {tr('diag.manualRepairGroup')} {section.repair_group}
              </span>
            )}
          </div>

          {/* Components */}
          {hasComponents && (
            <div style={{
              background: t.bgCard,
              border: `1px solid ${t.border}`,
              padding: "14px 16px",
              borderRadius: 2,
              marginBottom: 16,
            }}>
              <div style={{
                fontSize: "0.58rem",
                color: t.textFaint,
                letterSpacing: "0.12em",
                marginBottom: 8,
              }}>
                {tr('diag.manualComponents')}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {section.components.map((comp, i) => (
                  <span key={i} style={{
                    fontSize: "0.72rem",
                    color: t.accent,
                    background: `${t.accent}15`,
                    border: `1px solid ${t.accent}40`,
                    padding: "3px 10px",
                    borderRadius: 10,
                    fontWeight: 600,
                  }}>
                    {comp}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Subsections / procedures */}
          {hasSubsections && (
            <div style={{
              background: t.bgCard,
              border: `1px solid ${t.border}`,
              padding: "14px 16px",
              borderRadius: 2,
              marginBottom: 16,
            }}>
              <div style={{
                fontSize: "0.58rem",
                color: t.textFaint,
                letterSpacing: "0.12em",
                marginBottom: 10,
              }}>
                {tr('diag.manualSubsections')}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {section.subsections.map((sub, i) => (
                  <div key={i} style={{
                    display: "flex",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: i < section.subsections.length - 1 ? `1px solid ${t.border}` : "none",
                  }}>
                    <span style={{
                      fontSize: "0.74rem",
                      color: t.accent,
                      fontWeight: 700,
                      fontFamily: "'Barlow Condensed',sans-serif",
                      minWidth: 50,
                      flexShrink: 0,
                    }}>
                      {sub.number}
                    </span>
                    <span style={{
                      fontSize: "0.82rem",
                      color: t.text,
                      lineHeight: 1.5,
                    }}>
                      {sub.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Note about full content */}
          <div style={{
            fontSize: "0.74rem",
            color: t.textFaint,
            fontStyle: "italic",
            borderLeft: `2px solid ${t.border}`,
            paddingLeft: 10,
            marginTop: 8,
          }}>
            {tr('diag.manualNoContent')}
          </div>
        </div>
      </div>
    </div>
  );
}
