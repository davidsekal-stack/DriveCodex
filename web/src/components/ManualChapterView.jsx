import { useState, useEffect, useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { useI18n } from "../i18n/index.jsx";
import useIsMobile from "../hooks/useIsMobile.js";
import { fetchManualText, callAI } from "../lib/storage-edge.js";

// ── Text cleanup — strip PDF artifacts ──────────────────────────────────────

function cleanManualText(raw) {
  // Join page breaks
  let text = raw.replace(/\n---\n/g, '\n');

  // Remove repeated page headers: "Golf 2004 ➤ , Golf Plus 2005 ➤ , ..."
  text = text.replace(/^.*➤\s*,.*➤.*$/gm, '');

  // Remove edition lines: "4-cylinder diesel engine (1.9 l engine) - Edition 08.2010"
  text = text.replace(/^.*(?:cylinder|engine|gearbox).*Edition\s+\d{2}\.\d{4}.*$/gim, '');

  // Remove standalone page numbers (line is just 1-4 digits)
  text = text.replace(/^\s*\d{1,4}\s*$/gm, '');

  // Remove repeated section footer lines: "Rep. gr.XX - Title"
  text = text.replace(/^Rep\.\s*gr\.\s*\d+\s*[-–—]\s*.+$/gm, '');

  // Remove repeated chapter titles that appear as footers: "X. Chapter title" at page bottom
  // These are lines like "3. Oil filter bracket, oil pressure, engine oil cooler and oil supply line"
  // that repeat at the bottom/top of every page — only if short and followed by blank
  text = text.replace(/^\d{1,2}\.\s+[A-Z][^.]{10,80}$/gm, (match, offset) => {
    // Keep if it's the first occurrence (likely the real title)
    const before = text.slice(0, offset);
    if (before.includes(match.trim())) return '';
    return match;
  });

  // Collapse 3+ blank lines into 2
  text = text.replace(/\n{4,}/g, '\n\n\n');

  // Remove leading/trailing whitespace per line
  text = text.split('\n').map(l => l.trimEnd()).join('\n');

  return text.trim();
}

// ── Line classification ─────────────────────────────────────────────────────

const LINE_TYPE = {
  SECTION: 'section',       // "3.1 Assembly overview - oil filter bracket"
  SUBSECTION: 'subsection', // "3.4.1 Removing"
  PART: 'part',             // "1 - Oil filter bracket"
  BULLET: 'bullet',         // "❑ Renew."
  TOOL: 'tool',             // "♦ Oil pressure tester -V.A.G 1342-"
  STEP: 'step',             // "– Remove engine cover."
  WARNING: 'warning',       // "WARNING"
  NOTE: 'note',             // "Note"
  TABLE_ROW: 'table_row',   // "Component Nm" or "Radiator fan...  5"
  BLANK: 'blank',
  TEXT: 'text',
};

function classifyLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return LINE_TYPE.BLANK;
  if (/^\d{1,2}\.\d{1,2}\.\d{1,2}\s+/.test(trimmed)) return LINE_TYPE.SUBSECTION;
  if (/^\d{1,2}\.\d{1,2}\s+[A-Z]/.test(trimmed)) return LINE_TYPE.SECTION;
  if (/^\d{1,2}\s*-\s+/.test(trimmed)) return LINE_TYPE.PART;
  if (/^❑\s/.test(trimmed)) return LINE_TYPE.BULLET;
  if (/^♦\s/.test(trimmed)) return LINE_TYPE.TOOL;
  if (/^–\s/.test(trimmed)) return LINE_TYPE.STEP;
  if (/^WARNING$/i.test(trimmed)) return LINE_TYPE.WARNING;
  if (/^Note$/i.test(trimmed)) return LINE_TYPE.NOTE;
  return LINE_TYPE.TEXT;
}

// ── Parse into structured blocks ────────────────────────────────────────────

function parseBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const type = classifyLine(line);

    if (type === LINE_TYPE.BLANK) { i++; continue; }

    if (type === LINE_TYPE.SECTION || type === LINE_TYPE.SUBSECTION) {
      blocks.push({ type, text: line.trim() });
      i++;
      continue;
    }

    if (type === LINE_TYPE.WARNING) {
      // Collect warning text until blank line or next section
      const warnLines = [];
      i++;
      while (i < lines.length) {
        const t = classifyLine(lines[i]);
        if (t === LINE_TYPE.BLANK && warnLines.length > 0) break;
        if (t === LINE_TYPE.SECTION || t === LINE_TYPE.SUBSECTION) break;
        if (t !== LINE_TYPE.BLANK) warnLines.push(lines[i].trim());
        i++;
      }
      blocks.push({ type: LINE_TYPE.WARNING, text: warnLines.join(' ') });
      continue;
    }

    if (type === LINE_TYPE.NOTE) {
      const noteLines = [];
      i++;
      while (i < lines.length) {
        const t = classifyLine(lines[i]);
        if (t === LINE_TYPE.BLANK && noteLines.length > 0) break;
        if (t === LINE_TYPE.SECTION || t === LINE_TYPE.SUBSECTION) break;
        if (t === LINE_TYPE.STEP) break;
        if (t === LINE_TYPE.PART) break;
        if (t !== LINE_TYPE.BLANK) noteLines.push(lines[i].trim());
        i++;
      }
      blocks.push({ type: LINE_TYPE.NOTE, text: noteLines.join(' ') });
      continue;
    }

    if (type === LINE_TYPE.PART) {
      // Part number with possible continuation lines (bullets underneath)
      const partText = line.trim();
      const children = [];
      i++;
      while (i < lines.length) {
        const t = classifyLine(lines[i]);
        if (t === LINE_TYPE.BULLET) {
          children.push(lines[i].trim().replace(/^❑\s*/, ''));
          i++;
        } else if (t === LINE_TYPE.TEXT && children.length > 0) {
          // Continuation of previous bullet
          children[children.length - 1] += ' ' + lines[i].trim();
          i++;
        } else if (t === LINE_TYPE.BLANK) {
          i++;
          // Check if next is still a bullet continuation
          if (i < lines.length && classifyLine(lines[i]) === LINE_TYPE.BULLET) continue;
          break;
        } else {
          break;
        }
      }
      blocks.push({ type: LINE_TYPE.PART, text: partText, children });
      continue;
    }

    if (type === LINE_TYPE.TOOL) {
      // Collect consecutive tool lines
      const tools = [];
      while (i < lines.length) {
        const t = classifyLine(lines[i]);
        if (t === LINE_TYPE.TOOL) {
          // Tool might span multiple lines
          let toolText = lines[i].trim().replace(/^♦\s*/, '');
          i++;
          while (i < lines.length && classifyLine(lines[i]) === LINE_TYPE.TEXT) {
            toolText += ' ' + lines[i].trim();
            i++;
          }
          tools.push(toolText);
        } else if (t === LINE_TYPE.BLANK) {
          i++;
          if (i < lines.length && classifyLine(lines[i]) === LINE_TYPE.TOOL) continue;
          break;
        } else {
          break;
        }
      }
      blocks.push({ type: 'tools', items: tools });
      continue;
    }

    if (type === LINE_TYPE.STEP) {
      // Collect consecutive step lines
      const steps = [];
      while (i < lines.length) {
        const t = classifyLine(lines[i]);
        if (t === LINE_TYPE.STEP) {
          let stepText = lines[i].trim().replace(/^–\s*/, '');
          i++;
          // Continuation lines
          while (i < lines.length) {
            const nt = classifyLine(lines[i]);
            if (nt === LINE_TYPE.TEXT) {
              stepText += ' ' + lines[i].trim();
              i++;
            } else break;
          }
          steps.push(stepText);
        } else if (t === LINE_TYPE.BLANK) {
          i++;
          if (i < lines.length && classifyLine(lines[i]) === LINE_TYPE.STEP) continue;
          break;
        } else {
          break;
        }
      }
      blocks.push({ type: 'steps', items: steps });
      continue;
    }

    if (type === LINE_TYPE.BULLET) {
      // Standalone bullets (not under a part)
      const bullets = [];
      while (i < lines.length) {
        const t = classifyLine(lines[i]);
        if (t === LINE_TYPE.BULLET) {
          let bText = lines[i].trim().replace(/^❑\s*/, '');
          i++;
          while (i < lines.length && classifyLine(lines[i]) === LINE_TYPE.TEXT) {
            bText += ' ' + lines[i].trim();
            i++;
          }
          bullets.push(bText);
        } else if (t === LINE_TYPE.BLANK) {
          i++;
          if (i < lines.length && classifyLine(lines[i]) === LINE_TYPE.BULLET) continue;
          break;
        } else {
          break;
        }
      }
      blocks.push({ type: 'bullets', items: bullets });
      continue;
    }

    // Regular text — collect until next structural element
    const textLines = [];
    while (i < lines.length) {
      const t = classifyLine(lines[i]);
      if (t === LINE_TYPE.BLANK) {
        i++;
        break;
      }
      if (t !== LINE_TYPE.TEXT) break;
      textLines.push(lines[i].trim());
      i++;
    }
    if (textLines.length) {
      blocks.push({ type: LINE_TYPE.TEXT, text: textLines.join(' ') });
    }
  }

  return blocks;
}

// ── Inline formatting (torque values, page refs) ────────────────────────────

function FormatInline({ text, t }) {
  // Highlight torque values and page references
  const parts = text.split(/(\d+\s*Nm(?:\s*\+\s*turn\s*\([^)]+\))?|⇒\s*page\s*\d+)/g);
  return parts.map((part, i) => {
    if (/^\d+\s*Nm/.test(part)) {
      return <span key={i} style={{ color: t.accent, fontWeight: 700 }}>{part}</span>;
    }
    if (/^⇒\s*page/.test(part)) {
      return <span key={i} style={{ color: t.textFaint, fontSize: "0.85em" }}>{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Block renderers ─────────────────────────────────────────────────────────

function BlockRenderer({ block, t, mobile }) {
  const base = { fontSize: mobile ? "0.78rem" : "0.84rem", lineHeight: 1.7, color: t.text };

  switch (block.type) {
    case LINE_TYPE.SECTION:
      return (
        <div style={{
          fontFamily: "'Barlow Condensed',sans-serif",
          fontSize: mobile ? "1.1rem" : "1.25rem",
          fontWeight: 700,
          color: t.accent,
          letterSpacing: "0.03em",
          marginTop: 24,
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: `2px solid ${t.accent}30`,
        }}>
          {block.text}
        </div>
      );

    case LINE_TYPE.SUBSECTION:
      return (
        <div style={{
          fontFamily: "'Barlow Condensed',sans-serif",
          fontSize: mobile ? "0.95rem" : "1.05rem",
          fontWeight: 600,
          color: t.text,
          letterSpacing: "0.02em",
          marginTop: 18,
          marginBottom: 6,
          paddingLeft: 8,
          borderLeft: `3px solid ${t.accent}50`,
        }}>
          {block.text}
        </div>
      );

    case LINE_TYPE.PART:
      return (
        <div style={{
          ...base,
          background: `${t.accent}08`,
          border: `1px solid ${t.border}`,
          borderLeft: `3px solid ${t.accent}60`,
          padding: "8px 12px",
          marginBottom: 4,
          borderRadius: 2,
        }}>
          <div style={{ fontWeight: 600 }}>
            <FormatInline text={block.text} t={t} />
          </div>
          {block.children?.length > 0 && (
            <div style={{ paddingLeft: 12, marginTop: 4 }}>
              {block.children.map((c, j) => (
                <div key={j} style={{ ...base, fontSize: "0.78rem", color: t.textMuted, padding: "1px 0", display: "flex", gap: 6 }}>
                  <span style={{ color: t.textFaint, flexShrink: 0 }}>&#9656;</span>
                  <span><FormatInline text={c} t={t} /></span>
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case LINE_TYPE.WARNING:
      return (
        <div style={{
          ...base,
          background: "rgba(220,38,38,0.06)",
          border: "1px solid rgba(220,38,38,0.25)",
          borderLeft: "4px solid #dc2626",
          padding: "10px 14px",
          borderRadius: 2,
          marginTop: 8,
          marginBottom: 8,
        }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#dc2626", letterSpacing: "0.1em", marginBottom: 4 }}>WARNING</div>
          <div style={{ color: t.text }}><FormatInline text={block.text} t={t} /></div>
        </div>
      );

    case LINE_TYPE.NOTE:
      return (
        <div style={{
          ...base,
          background: `${t.accent}08`,
          borderLeft: `3px solid ${t.accent}60`,
          padding: "8px 14px",
          borderRadius: 2,
          marginTop: 6,
          marginBottom: 6,
          fontStyle: "italic",
          color: t.textMuted,
        }}>
          <FormatInline text={block.text} t={t} />
        </div>
      );

    case 'tools':
      return (
        <div style={{
          background: t.bgCardAlt,
          border: `1px solid ${t.border}`,
          padding: "10px 14px",
          borderRadius: 2,
          marginTop: 6,
          marginBottom: 6,
        }}>
          <div style={{ fontSize: "0.6rem", color: t.textFaint, letterSpacing: "0.1em", marginBottom: 6 }}>TOOLS REQUIRED</div>
          {block.items.map((tool, j) => (
            <div key={j} style={{ ...base, fontSize: "0.78rem", color: t.textMuted, padding: "2px 0", display: "flex", gap: 6 }}>
              <span style={{ color: t.accent, flexShrink: 0 }}>&#9830;</span>
              <span>{tool}</span>
            </div>
          ))}
        </div>
      );

    case 'steps':
      return (
        <div style={{ marginTop: 6, marginBottom: 6 }}>
          {block.items.map((step, j) => (
            <div key={j} style={{
              ...base,
              padding: "5px 0 5px 12px",
              borderBottom: j < block.items.length - 1 ? `1px solid ${t.border}` : 'none',
              display: "flex",
              gap: 8,
            }}>
              <span style={{ color: t.accent, fontWeight: 700, flexShrink: 0, fontFamily: "'Barlow Condensed',sans-serif" }}>{String(j + 1).padStart(2, '0')}</span>
              <span><FormatInline text={step} t={t} /></span>
            </div>
          ))}
        </div>
      );

    case 'bullets':
      return (
        <div style={{ marginTop: 4, marginBottom: 4, paddingLeft: 8 }}>
          {block.items.map((b, j) => (
            <div key={j} style={{ ...base, fontSize: "0.8rem", color: t.textMuted, padding: "2px 0", display: "flex", gap: 6 }}>
              <span style={{ color: t.textFaint, flexShrink: 0 }}>&#9656;</span>
              <span><FormatInline text={b} t={t} /></span>
            </div>
          ))}
        </div>
      );

    case LINE_TYPE.TEXT:
    default:
      return (
        <div style={{ ...base, color: t.textMuted, marginBottom: 4 }}>
          <FormatInline text={block.text} t={t} />
        </div>
      );
  }
}

// ── ManualChapterView ────────────────────────────────────────────────────────

export default function ManualChapterView({ section, onBack }) {
  const { t } = useTheme();
  const { tr } = useI18n();
  const mobile = useIsMobile();
  const [textData, setTextData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!section) return;
    let cancelled = false;
    setLoading(true);
    setAiText(null);

    const manualId = section.manual?.replace('.pdf', '') ?? '';
    const rg = section.repair_group ?? '';
    const sectionId = rg ? `${manualId}_RG${rg}` : null;

    fetchManualText({ sectionId, manual: section.manual, section: section.section })
      .then((res) => {
        if (!cancelled) {
          setTextData(res.ok ? res : null);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) { setTextData(null); setLoading(false); } });

    return () => { cancelled = true; };
  }, [section?.manual, section?.section, section?.repair_group]);

  const cleanedText = useMemo(() => {
    if (!textData?.content) return '';
    return cleanManualText(textData.content);
  }, [textData?.content]);

  const blocks = useMemo(() => {
    const source = aiText || cleanedText;
    return source ? parseBlocks(source) : [];
  }, [cleanedText, aiText]);

  const handleAiFormat = async () => {
    if (!cleanedText || aiLoading) return;
    setAiLoading(true);

    // Send first ~8000 chars to DeepSeek to avoid huge token cost
    const chunk = cleanedText.slice(0, 8000);
    try {
      const res = await callAI({
        systemPrompt: `You are a workshop manual formatter. Rewrite the provided raw text from a VW workshop manual into clean, well-structured text. Rules:
- Keep ALL technical content, torque values, part numbers, tool references, and step instructions exactly as-is
- Remove duplicate headers, page numbers, and repetitive boilerplate
- Use clear section headers with the original numbering (e.g. "3.1 Assembly overview")
- Format part lists cleanly: "1 - Part name" followed by bullet points for instructions
- Format step-by-step procedures with "–" prefix
- Keep WARNING and Note blocks clearly marked
- Do NOT add any information that wasn't in the original
- Do NOT translate - keep the original English text
- Output plain text, no markdown syntax`,
        userMessage: chunk,
        maxTokens: 4000,
      });
      if (res?.choices?.[0]?.message?.content) {
        setAiText(res.choices[0].message.content);
      }
    } catch {
      // Silently fail — user still has the regex-cleaned version
    }
    setAiLoading(false);
  };

  if (!section) return null;
  const hasSubsections = section.subsections?.length > 0;
  const hasComponents = section.components?.length > 0;
  const hasText = blocks.length > 0;

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
        <button onClick={onBack} style={{
          background: "none", border: `1px solid ${t.border}`, color: t.accent,
          padding: "6px 14px", borderRadius: 2, cursor: "pointer", fontSize: "0.72rem",
          fontFamily: "'IBM Plex Mono','Courier New',monospace", letterSpacing: "0.06em",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ fontSize: "0.9rem" }}>&larr;</span>
          {tr('diag.manualViewBack')}
        </button>
        <div style={{ fontSize: "0.6rem", color: t.textFaint, letterSpacing: "0.15em", fontWeight: 600 }}>
          {tr('diag.manualViewTitle')}
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: mobile ? "12px" : "24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {/* Section title */}
          <div style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: mobile ? "1.3rem" : "1.6rem", fontWeight: 700,
            color: t.text, letterSpacing: "0.04em", marginBottom: 8,
          }}>
            {section.section}
          </div>

          {/* Metadata badges */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 20 }}>
            {[
              section.manual,
              section.page != null && `${tr('diag.manualPage')} ${section.page}`,
              section.repair_group && `${tr('diag.manualRepairGroup')} ${section.repair_group}`,
              textData?.extracted_pages && `${textData.extracted_pages} ${tr('diag.manualPages')}`,
            ].filter(Boolean).map((label, i) => (
              <span key={i} style={{
                fontSize: "0.7rem", color: t.textFaint, background: t.bgCardAlt,
                border: `1px solid ${t.border}`, padding: "3px 10px", borderRadius: 10,
              }}>
                {label}
              </span>
            ))}
          </div>

          {/* Components */}
          {hasComponents && (
            <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, padding: "14px 16px", borderRadius: 2, marginBottom: 16 }}>
              <div style={{ fontSize: "0.58rem", color: t.textFaint, letterSpacing: "0.12em", marginBottom: 8 }}>
                {tr('diag.manualComponents')}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {section.components.map((comp, i) => (
                  <span key={i} style={{
                    fontSize: "0.72rem", color: t.accent, background: `${t.accent}15`,
                    border: `1px solid ${t.accent}40`, padding: "3px 10px", borderRadius: 10, fontWeight: 600,
                  }}>{comp}</span>
                ))}
              </div>
            </div>
          )}

          {/* Subsections TOC */}
          {hasSubsections && (
            <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, padding: "14px 16px", borderRadius: 2, marginBottom: 16 }}>
              <div style={{ fontSize: "0.58rem", color: t.textFaint, letterSpacing: "0.12em", marginBottom: 10 }}>
                {tr('diag.manualSubsections')}
              </div>
              {section.subsections.map((sub, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < section.subsections.length - 1 ? `1px solid ${t.border}` : "none" }}>
                  <span style={{ fontSize: "0.74rem", color: t.accent, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", minWidth: 50, flexShrink: 0 }}>{sub.number}</span>
                  <span style={{ fontSize: "0.82rem", color: t.text, lineHeight: 1.5 }}>{sub.title}</span>
                </div>
              ))}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ padding: "20px 0", textAlign: "center", color: t.textFaint, fontSize: "0.78rem", fontStyle: "italic" }}>
              {tr('diag.loadingManual')}
            </div>
          )}

          {/* Full text content — parsed and formatted */}
          {!loading && hasText && (
            <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, padding: mobile ? "14px" : "20px 24px", borderRadius: 2, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: "0.58rem", color: t.textFaint, letterSpacing: "0.12em" }}>
                  {tr('diag.manualFullText')}
                </div>
                {!aiText && (
                  <button
                    onClick={handleAiFormat}
                    disabled={aiLoading}
                    style={{
                      background: aiLoading ? t.bgCardAlt : `${t.accent}12`,
                      border: `1px solid ${t.accent}40`,
                      color: t.accent,
                      padding: "4px 12px",
                      borderRadius: 2,
                      cursor: aiLoading ? "wait" : "pointer",
                      fontSize: "0.65rem",
                      fontFamily: "'IBM Plex Mono','Courier New',monospace",
                      letterSpacing: "0.04em",
                      opacity: aiLoading ? 0.6 : 1,
                    }}
                  >
                    {aiLoading ? tr('diag.aiFormatting') : tr('diag.aiFormat')}
                  </button>
                )}
                {aiText && (
                  <span style={{ fontSize: "0.6rem", color: t.doneStatusColor, letterSpacing: "0.06em" }}>
                    AI
                  </span>
                )}
              </div>
              {blocks.map((block, i) => (
                <BlockRenderer key={i} block={block} t={t} mobile={mobile} />
              ))}
            </div>
          )}

          {!loading && !hasText && (
            <div style={{
              fontSize: "0.74rem", color: t.textFaint, fontStyle: "italic",
              borderLeft: `2px solid ${t.border}`, paddingLeft: 10, marginTop: 8,
            }}>
              {tr('diag.manualNoContent')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
