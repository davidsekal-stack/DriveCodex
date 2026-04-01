import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { useI18n } from "../i18n/index.jsx";
import useIsMobile from "../hooks/useIsMobile.js";
import { fetchManualText } from "../lib/storage-edge.js";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const SUPABASE_URL = "https://nmvjthfezyjcwuzphiuu.supabase.co";

// ── Filename to storage key (strip diacritics) ─────────────────────────────

function toAsciiKey(filename) {
  return filename.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function getPdfUrl(manualFilename) {
  const key = toAsciiKey(manualFilename);
  return `${SUPABASE_URL}/storage/v1/object/public/manuals/${encodeURIComponent(key)}`;
}

// ── ManualChapterView ────────────────────────────────────────────────────────

export default function ManualChapterView({ section, onBack }) {
  const { t } = useTheme();
  const { tr } = useI18n();
  const mobile = useIsMobile();

  const [pageCount, setPageCount] = useState(null);
  const [pdfError, setPdfError] = useState(false);
  const [scale, setScale] = useState(mobile ? 0.6 : 1.0);
  const [totalPdfPages, setTotalPdfPages] = useState(null);
  const [resolvedStartPage, setResolvedStartPage] = useState(section?.page ?? 1);
  const containerRef = useRef(null);

  // Fetch section metadata to get page_count and authoritative pdf_page
  useEffect(() => {
    if (!section) return;
    let cancelled = false;

    setResolvedStartPage(section?.page ?? 1);

    const manualId = section.manual?.replace(".pdf", "") ?? "";
    const rg = section.repair_group ?? "";
    const sectionId = rg ? `${manualId}_RG${rg}` : null;

    fetchManualText({ sectionId, manual: section.manual, section: section.section })
      .then((res) => {
        if (!cancelled && res.ok) {
          setPageCount(res.page_count || res.extracted_pages || 10);
          if (res.pdf_page && res.pdf_page > 0) {
            setResolvedStartPage(res.pdf_page);
          }
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [section?.manual, section?.section, section?.repair_group]);

  const startPage = resolvedStartPage;
  const endPage = pageCount ? Math.min(startPage + pageCount - 1, totalPdfPages || 9999) : startPage + 9;
  const pages = [];
  for (let p = startPage; p <= endPage; p++) pages.push(p);

  const pdfUrl = section?.manual ? getPdfUrl(section.manual) : null;

  const onDocLoadSuccess = useCallback(({ numPages }) => {
    setTotalPdfPages(numPages);
  }, []);

  const onDocLoadError = useCallback(() => {
    setPdfError(true);
  }, []);

  const zoomIn = () => setScale(s => Math.min(s + 0.2, 2.5));
  const zoomOut = () => setScale(s => Math.max(s - 0.2, 0.3));
  const zoomReset = () => setScale(mobile ? 0.6 : 1.0);

  if (!section) return null;

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

        {/* Zoom controls */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
          <button onClick={zoomOut} style={zoomBtnStyle(t)} title="Zoom out">&minus;</button>
          <button onClick={zoomReset} style={{ ...zoomBtnStyle(t), minWidth: 42 }}>
            {Math.round(scale * 100)}%
          </button>
          <button onClick={zoomIn} style={zoomBtnStyle(t)} title="Zoom in">+</button>
        </div>
      </div>

      {/* Section info */}
      <div style={{
        padding: mobile ? "10px 12px" : "10px 20px",
        background: t.bg,
        borderBottom: `1px solid ${t.border}`,
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: "'Rajdhani',sans-serif",
          fontSize: mobile ? "1.1rem" : "1.3rem", fontWeight: 700,
          color: t.text, letterSpacing: "0.04em",
        }}>
          {section.section}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
          {[
            section.manual,
            resolvedStartPage != null && `${tr('diag.manualPage')} ${resolvedStartPage}`,
            section.repair_group && `${tr('diag.manualRepairGroup')} ${section.repair_group}`,
            pageCount && `${pageCount} ${tr('diag.manualPages')}`,
          ].filter(Boolean).map((label, i) => (
            <span key={i} style={{
              fontSize: "0.65rem", color: t.textFaint, background: t.bgCardAlt,
              border: `1px solid ${t.border}`, padding: "2px 8px", borderRadius: 10,
            }}>
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* PDF content */}
      <div ref={containerRef} style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "auto",
        background: "#525659",
        padding: mobile ? "8px 0" : "16px 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}>
        {pdfError && (
          <div style={{
            padding: 40, textAlign: "center", color: "#fff",
            fontSize: "0.8rem", opacity: 0.7,
          }}>
            {tr('diag.manualNoContent')}
          </div>
        )}

        {pdfUrl && !pdfError && (
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocLoadSuccess}
            onLoadError={onDocLoadError}
            loading={
              <div style={{ padding: 40, color: "#fff", fontSize: "0.78rem", opacity: 0.6 }}>
                {tr('diag.loadingManual')}
              </div>
            }
          >
            {pages.map((pageNum) => (
              <div key={pageNum} style={{
                marginBottom: mobile ? 4 : 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                position: "relative",
              }}>
                <Page
                  pageNumber={pageNum}
                  scale={scale}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  loading={
                    <div style={{
                      width: Math.round(595 * scale), height: Math.round(842 * scale),
                      background: "#fff", display: "flex", alignItems: "center",
                      justifyContent: "center", color: "#999", fontSize: "0.7rem",
                    }}>
                      {pageNum}...
                    </div>
                  }
                />
                {/* Page number badge */}
                <div style={{
                  position: "absolute", bottom: 8, right: 12,
                  background: "rgba(0,0,0,0.6)", color: "#fff",
                  fontSize: "0.6rem", padding: "2px 8px", borderRadius: 10,
                }}>
                  {pageNum}{totalPdfPages ? ` / ${totalPdfPages}` : ""}
                </div>
              </div>
            ))}
          </Document>
        )}
      </div>
    </div>
  );
}

function zoomBtnStyle(t) {
  return {
    background: "none",
    border: `1px solid ${t.border}`,
    color: t.textFaint,
    padding: "3px 8px",
    borderRadius: 2,
    cursor: "pointer",
    fontSize: "0.72rem",
    fontFamily: "'IBM Plex Mono','Courier New',monospace",
  };
}
