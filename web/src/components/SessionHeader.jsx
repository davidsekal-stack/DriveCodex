import { useEffect, useState } from "react";

import { CASE_STATUS } from "../constants/enums.js";
import { CASE_TOKEN_LIMIT } from "../lib/ai.js";
import { exportCasePdf, PDF_VARIANTS } from "../lib/pdf.js";
import { createShareLink } from "../lib/storage-edge.js";
import { fmtMileage } from "../lib/utils.js";
import { getTokenUsageMeta, hasDiagnoses } from "../lib/session-view.js";
import StatusBadge from "./StatusBadge.jsx";

function getUsageColor(tone, t) {
  if (tone === "danger") return "#dc2626";
  if (tone === "warning") return "#d97706";
  return t.textVeryFaint;
}

export default function SessionHeader({
  activeCase,
  lang,
  mobile,
  onRequestCloseCase,
  onRequestDelete,
  t,
  tr,
}) {
  const [pdfMenu, setPdfMenu] = useState(false);
  const [shareState, setShareState] = useState("idle"); // idle | loading | copied | error

  useEffect(() => {
    setPdfMenu(false);
    setShareState("idle");
  }, [activeCase?.id]);

  if (!activeCase) return null;

  const usageMeta = getTokenUsageMeta(activeCase.tokenCount, CASE_TOKEN_LIMIT);
  const showPdfMenu = hasDiagnoses(activeCase.messages);

  const handleShare = async () => {
    setShareState("loading");
    try {
      const result = await createShareLink(activeCase);
      if (result.url) {
        await navigator.clipboard.writeText(result.url);
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 3000);
      } else {
        setShareState("error");
        setTimeout(() => setShareState("idle"), 3000);
      }
    } catch {
      setShareState("error");
      setTimeout(() => setShareState("idle"), 3000);
    }
  };

  const shareLabel = shareState === "loading" ? "..."
    : shareState === "copied" ? tr("share.copied")
    : shareState === "error" ? "✕"
    : tr("share.btn");

  return (
    <div style={{ padding: mobile ? "6px 10px" : "0 18px", minHeight: 52, background: t.bgHeader, borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, gap: 8 }}>
      <div style={{ overflow: "hidden", flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.9rem", color: t.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeCase.name}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "nowrap", overflow: "hidden" }}>
          {activeCase.vehicle?.model && <span style={{ fontSize: "0.68rem", color: t.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeCase.vehicle.model}</span>}
          {!mobile && activeCase.vehicle?.enginePower && <span style={{ fontSize: "0.68rem", color: t.textVeryFaint }}>· {activeCase.vehicle.enginePower}</span>}
          {!mobile && activeCase.vehicle?.mileage && <span style={{ fontSize: "0.68rem", color: t.textVeryFaint }}>· {fmtMileage(activeCase.vehicle.mileage, lang)}</span>}
          <StatusBadge status={activeCase.status} t={t} tr={tr} />
          {activeCase.status === CASE_STATUS.OPEN && (
            <span title={`${(activeCase.tokenCount ?? 0).toLocaleString()} / ${CASE_TOKEN_LIMIT.toLocaleString()} tokens`}
              style={{ fontSize: "0.62rem", color: getUsageColor(usageMeta.tone, t), letterSpacing: "0.04em" }}>
              {usageMeta.label}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {showPdfMenu && (
          <button onClick={handleShare} disabled={shareState === "loading"}
            style={{ background: shareState === "copied" ? t.doneStatusBg : t.bgCard, border: `1px solid ${shareState === "copied" ? t.doneStatusBorder : t.border}`, color: shareState === "copied" ? t.doneStatusColor : shareState === "error" ? "#dc2626" : t.textMuted, padding: "6px 14px", fontSize: "0.75rem", letterSpacing: "0.06em", cursor: shareState === "loading" ? "wait" : "pointer", fontFamily: "inherit", borderRadius: 2, transition: "all 0.2s" }}>
            {shareLabel}
          </button>
        )}
        {showPdfMenu && (
          <div style={{ position: "relative" }}>
            <button onClick={() => setPdfMenu((open) => !open)}
              style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textMuted, padding: "6px 14px", fontSize: "0.75rem", letterSpacing: "0.06em", cursor: "pointer", fontFamily: "inherit", borderRadius: 2 }}>
              PDF ▾
            </button>
            {pdfMenu && (
              <>
                <div onClick={() => setPdfMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 59 }} />
                <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 4, boxShadow: "0 4px 16px rgba(0,0,0,0.25)", zIndex: 60, minWidth: 180, overflow: "hidden" }}>
                  {PDF_VARIANTS.map((variant) => (
                    <button key={variant} onClick={() => {
                      setPdfMenu(false);
                      exportCasePdf(activeCase, lang, tr, variant).catch((cause) => console.error("PDF export failed:", cause));
                    }}
                      style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", borderBottom: `1px solid ${t.border}`, color: t.text, padding: "9px 14px", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}
                      onMouseEnter={(event) => { event.currentTarget.style.background = t.bgSelected; }}
                      onMouseLeave={(event) => { event.currentTarget.style.background = "transparent"; }}>
                      <div style={{ fontWeight: 600, marginBottom: 1 }}>{tr(`pdf.variant.${variant}`)}</div>
                      <div style={{ fontSize: "0.67rem", color: t.textFaint }}>{tr(`pdf.variant.${variant}.desc`)}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {activeCase.status === CASE_STATUS.OPEN && (
          <button onClick={onRequestCloseCase}
            style={{ background: t.doneStatusBg, border: `1px solid ${t.doneStatusBorder}`, color: t.doneStatusColor, padding: "6px 14px", fontSize: "0.75rem", letterSpacing: "0.06em", cursor: "pointer", fontFamily: "inherit", borderRadius: 2 }}>
            {tr("app.closeBtn")}
          </button>
        )}
        <button onClick={() => onRequestDelete(activeCase.id)}
          style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.3)", color: "#dc2626", padding: "6px 14px", fontSize: "0.75rem", letterSpacing: "0.06em", cursor: "pointer", fontFamily: "inherit", borderRadius: 2 }}>
          {tr("app.deleteLabel")}
        </button>
      </div>
    </div>
  );
}
