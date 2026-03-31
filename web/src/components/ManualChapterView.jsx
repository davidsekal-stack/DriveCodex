import { useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { useI18n } from "../i18n/index.jsx";
import useIsMobile from "../hooks/useIsMobile.js";
import { fetchManualText } from "../lib/storage-edge.js";

// ── ManualChapterView ────────────────────────────────────────────────────────
// Full-screen panel showing workshop manual section details + full text.
// Fetches text on-demand from Supabase (only when user opens this view).

export default function ManualChapterView({ section, onBack }) {
  const { t } = useTheme();
  const { tr } = useI18n();
  const mobile = useIsMobile();
  const [textData, setTextData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch full text on mount
  useEffect(() => {
    if (!section) return;
    let cancelled = false;
    setLoading(true);

    // Build section ID from manual filename + repair group (matches Neo4j/Supabase ID)
    const manualId = section.manual?.replace('.pdf', '') ?? '';
    const rg = section.repair_group ?? '';
    const sectionId = rg ? `${manualId}_RG${rg}` : null;

    fetchManualText({
      sectionId,
      manual: section.manual,
      section: section.section,
    }).then((res) => {
      if (!cancelled) {
        setTextData(res.ok ? res : null);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setTextData(null);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [section?.manual, section?.section, section?.repair_group]);

  if (!section) return null;

  const hasSubsections = section.subsections?.length > 0;
  const hasComponents = section.components?.length > 0;
  const hasText = textData?.content?.length > 0;

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
            {textData?.extracted_pages && (
              <span style={{
                fontSize: "0.7rem",
                color: t.textFaint,
                background: t.bgCardAlt,
                border: `1px solid ${t.border}`,
                padding: "3px 10px",
                borderRadius: 10,
              }}>
                {textData.extracted_pages} {tr('diag.manualPages')}
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

          {/* Subsections / procedures (table of contents) */}
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

          {/* Full text content */}
          {loading && (
            <div style={{
              padding: "20px 0",
              textAlign: "center",
              color: t.textFaint,
              fontSize: "0.78rem",
              fontStyle: "italic",
            }}>
              {tr('diag.loadingManual')}
            </div>
          )}

          {!loading && hasText && (
            <div style={{
              background: t.bgCard,
              border: `1px solid ${t.border}`,
              padding: mobile ? "14px" : "20px 24px",
              borderRadius: 2,
              marginBottom: 16,
            }}>
              <div style={{
                fontSize: "0.58rem",
                color: t.textFaint,
                letterSpacing: "0.12em",
                marginBottom: 12,
              }}>
                {tr('diag.manualFullText')}
              </div>
              <ManualTextContent text={textData.content} t={t} mobile={mobile} />
            </div>
          )}

          {!loading && !hasText && (
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
          )}
        </div>
      </div>
    </div>
  );
}

// ── Render manual text with basic formatting ────────────────────────────────

function ManualTextContent({ text, t, mobile }) {
  // Split on section dividers (---) which we inserted for page breaks
  const pages = text.split('\n---\n').filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {pages.map((pageText, i) => (
        <div key={i}>
          {i > 0 && (
            <div style={{
              borderTop: `1px dashed ${t.border}`,
              marginBottom: 12,
              paddingTop: 4,
              fontSize: "0.58rem",
              color: t.textVeryFaint,
              letterSpacing: "0.1em",
            }}>
              — {i + 1} —
            </div>
          )}
          <div style={{
            fontSize: mobile ? "0.78rem" : "0.84rem",
            color: t.text,
            lineHeight: 1.8,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "'IBM Plex Mono','Courier New',monospace",
          }}>
            {pageText.trim()}
          </div>
        </div>
      ))}
    </div>
  );
}
