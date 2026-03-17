import { jsPDF } from "jspdf";

// ── Font loading (Roboto from jsDelivr CDN, cached in memory) ────────────────
const FONT_FILES = {
  "Roboto-Regular": "https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmT.ttf",
  "Roboto-Bold":    "https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYjammT.ttf",
  "Roboto-Italic":  "https://fonts.gstatic.com/s/roboto/v51/KFOKCnqEu92Fr1Mu53ZEC9_Vu3r1gIhOszmOClHrs6ljXfMMLoHQiA8.ttf",
};

let _fontCache = null; // { "Roboto-Regular": base64, ... }

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function loadFonts() {
  if (_fontCache) return _fontCache;
  const entries = Object.entries(FONT_FILES);
  const results = await Promise.all(
    entries.map(async ([name, url]) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Font fetch failed: ${name}`);
      const buf = await res.arrayBuffer();
      return [name, arrayBufferToBase64(buf)];
    })
  );
  _fontCache = Object.fromEntries(results);
  return _fontCache;
}

function registerFonts(doc, fonts) {
  // Register Regular
  doc.addFileToVFS("Roboto-Regular.ttf", fonts["Roboto-Regular"]);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  // Register Bold
  doc.addFileToVFS("Roboto-Bold.ttf", fonts["Roboto-Bold"]);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
  // Register Italic
  doc.addFileToVFS("Roboto-Italic.ttf", fonts["Roboto-Italic"]);
  doc.addFont("Roboto-Italic.ttf", "Roboto", "italic");
  doc.setFont("Roboto", "normal");
}

// ── Shared palette ───────────────────────────────────────────────────────────
const C = {
  black:   "#000000",
  dark:    "#333333",
  mid:     "#666666",
  light:   "#999999",
  rule:    "#cccccc",
  bgLight: "#f5f5f5",
};

const PAGE = { w: 210, h: 297, mx: 18, mt: 22, mb: 20 };
const CW = PAGE.w - PAGE.mx * 2;

// ── Font sizes ───────────────────────────────────────────────────────────────
const FS = {
  title: 14,
  subtitle: 10,
  section: 9,
  body: 8.5,
  small: 7.5,
  tiny: 6.5,
  footer: 6.5,
};

// ── Line heights ─────────────────────────────────────────────────────────────
const LH = {
  body: 4.0,
  small: 3.5,
  tiny: 3.0,
  section: 5.0,
};

export const PDF_VARIANTS = ["service", "technical", "minimalist"];

/**
 * Export diagnostic case as PDF with selected variant.
 * Async because font loading happens on first call.
 */
export async function exportCasePdf(activeCase, lang, tr, variant = "minimalist") {
  const renderer = { service: renderService, technical: renderTechnical, minimalist: renderMinimalist }[variant];
  if (!renderer) return;

  let fonts;
  try {
    fonts = await loadFonts();
  } catch (e) {
    console.warn("Font loading failed, PDF will use fallback Helvetica:", e);
    fonts = null;
  }

  renderer(activeCase, lang, tr, fonts);
}

// ── Shared helpers ───────────────────────────────────────────────────────────
function dateStr(lang) {
  const loc = lang === "cs" ? "cs-CZ" : lang === "de" ? "de-DE" : "en-GB";
  return new Date().toLocaleDateString(loc, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function shortDate(iso, lang) {
  if (!iso) return "";
  const loc = lang === "cs" ? "cs-CZ" : lang === "de" ? "de-DE" : "en-GB";
  return new Date(iso).toLocaleDateString(loc, { day: "2-digit", month: "2-digit", year: "numeric" });
}

function safeTxt(str) {
  // Replace special unicode chars that even Roboto may not have with ASCII equivalents
  return String(str || "")
    .replace(/▪/g, "-")
    .replace(/→/g, "->")
    .replace(/⚠/g, "/!\\");
}

/** Translate urgency values (always Czech from AI) to selected language */
const URGENCY_MAP = {
  cs: { "nízká": "NÍZKÁ", "střední": "STŘEDNÍ", "vysoká": "VYSOKÁ", "kritická": "KRITICKÁ" },
  en: { "nízká": "LOW", "střední": "MEDIUM", "vysoká": "HIGH", "kritická": "CRITICAL" },
  de: { "nízká": "NIEDRIG", "střední": "MITTEL", "vysoká": "HOCH", "kritická": "KRITISCH" },
};
function trUrgency(val, lang) {
  if (!val) return "";
  return (URGENCY_MAP[lang] || URGENCY_MAP.cs)[val.toLowerCase()] || val.toUpperCase();
}

function initDoc(fonts) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  if (fonts) {
    registerFonts(doc, fonts);
  }
  return doc;
}

/** Font family name based on whether custom fonts loaded */
function ff(fonts) {
  return fonts ? "Roboto" : "helvetica";
}

function savePdf(doc, activeCase) {
  const brand = activeCase.vehicle?.brand || "";
  const model = (activeCase.vehicle?.model || "").split(" ").slice(0, 2).join("-");
  const slug = [brand, model].filter(Boolean).join("-").replace(/[^a-zA-Z0-9-]/g, "") || "case";
  doc.save(`GearBrain-${slug}-${activeCase.id}.pdf`);
}

function addPageFooter(doc, tr, activeCase, pageNum, pageCount, font) {
  doc.setFont(font, "normal");
  doc.setFontSize(FS.footer);
  doc.setTextColor(C.light);
  doc.text("GearBrain", PAGE.mx, PAGE.h - 10);
  doc.text(`${tr("pdf.page")} ${pageNum} / ${pageCount}`, PAGE.w / 2, PAGE.h - 10, { align: "center" });
  doc.text(activeCase.id, PAGE.w - PAGE.mx, PAGE.h - 10, { align: "right" });
}

function addAllFooters(doc, tr, activeCase, font) {
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    addPageFooter(doc, tr, activeCase, i, total, font);
  }
}

// ── Context helper: wrap text and track Y ────────────────────────────────────
function makeCtx(doc, font) {
  let y = PAGE.mt;
  const maxY = () => PAGE.h - PAGE.mb;

  let pageAtStart = 1; // track which page we started a section on

  const checkPage = (need = 12) => {
    if (y + need > maxY()) { doc.addPage(); y = PAGE.mt; }
  };

  const hLine = (yy, weight = 0.3) => {
    doc.setDrawColor(C.rule); doc.setLineWidth(weight);
    doc.line(PAGE.mx, yy, PAGE.w - PAGE.mx, yy);
  };

  const text = (str, x, maxW, fontSize, color, opts = {}) => {
    doc.setFont(font, opts.style || "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(color);
    const lines = doc.splitTextToSize(safeTxt(str), maxW);
    const lh = fontSize <= 7 ? LH.tiny : fontSize <= 7.5 ? LH.small : LH.body;
    for (const line of lines) {
      checkPage(lh + 2);
      doc.text(line, x, y);
      y += lh;
    }
  };

  /** Mark start of a striped section */
  const markStart = () => { pageAtStart = doc.internal.getNumberOfPages(); };

  /** Draw a vertical stripe from markStart to current y, spanning pages */
  const drawStripe = (x, w, color) => {
    const endPage = doc.internal.getNumberOfPages();
    const curY = y;
    doc.setFillColor(...color);
    for (let p = pageAtStart; p <= endPage; p++) {
      doc.setPage(p);
      const top = p === pageAtStart ? PAGE.mt : PAGE.mt;
      const bot = p === endPage ? curY : PAGE.h - PAGE.mb;
      doc.rect(x, top, w, bot - top, "F");
    }
    // Restore to current page
    doc.setPage(endPage);
  };

  return { get y() { return y; }, set y(v) { y = v; }, checkPage, hLine, text, maxY, markStart, drawStripe };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT A — SERVISNI PROTOKOL
// ═══════════════════════════════════════════════════════════════════════════════
function renderService(activeCase, lang, tr, fonts) {
  const doc = initDoc(fonts);
  const F = ff(fonts);
  const ctx = makeCtx(doc, F);

  // ── Header ──
  doc.setFont(F, "bold"); doc.setFontSize(16); doc.setTextColor(C.black);
  doc.text("GearBrain", PAGE.mx, ctx.y);
  doc.setFont(F, "normal"); doc.setFontSize(FS.subtitle); doc.setTextColor(C.mid);
  doc.text(tr("pdf.title"), PAGE.w - PAGE.mx, ctx.y, { align: "right" });
  ctx.y += 4;
  doc.setFontSize(FS.small); doc.setTextColor(C.light);
  doc.text(safeTxt(`${tr("pdf.generated")}: ${dateStr(lang)}  |  ID: ${activeCase.id}`), PAGE.mx, ctx.y);
  ctx.y += 2;
  ctx.hLine(ctx.y, 0.6);
  ctx.y += 6;

  // ── Vehicle box ──
  const v = activeCase.vehicle || {};
  const boxY = ctx.y;
  const boxH = 24;
  doc.setFillColor(245, 245, 245);
  doc.rect(PAGE.mx, boxY, CW, boxH, "F");
  doc.setDrawColor(C.rule); doc.setLineWidth(0.3);
  doc.rect(PAGE.mx, boxY, CW, boxH, "S");

  doc.setFont(F, "bold"); doc.setFontSize(FS.small); doc.setTextColor(C.mid);
  doc.text(tr("pdf.vehicle"), PAGE.mx + 3, boxY + 5);
  ctx.hLine(boxY + 7, 0.2);

  const fields = [
    [tr("app.vehicleBrand"), v.brand], [tr("app.vehicleModel"), v.model],
    [tr("app.enginePower"), v.enginePower], [tr("app.mileageKm"), v.mileage ? `${Number(v.mileage).toLocaleString()} km` : ""],
  ].filter(([, val]) => val);

  const col1X = PAGE.mx + 3;
  const col2X = PAGE.mx + CW / 2 + 2;
  let fy = boxY + 11;
  for (let i = 0; i < fields.length; i++) {
    const x = i % 2 === 0 ? col1X : col2X;
    doc.setFont(F, "normal"); doc.setFontSize(FS.small); doc.setTextColor(C.light);
    doc.text(safeTxt(fields[i][0]) + ":", x, fy);
    doc.setFont(F, "bold"); doc.setFontSize(FS.body); doc.setTextColor(C.dark);
    doc.text(safeTxt(fields[i][1]), x + 30, fy);
    if (i % 2 === 1) fy += 5.5;
  }
  if (fields.length % 2 === 1) fy += 5.5;
  ctx.y = boxY + boxH + 6;

  // ── Messages ──
  renderMessages(doc, ctx, activeCase, lang, tr, F, "service");

  // ── Resolution ──
  renderResolution(doc, ctx, activeCase, lang, tr, F);

  addAllFooters(doc, tr, activeCase, F);
  savePdf(doc, activeCase);
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT B — TECHNICKA ZPRAVA
// ═══════════════════════════════════════════════════════════════════════════════
function renderTechnical(activeCase, lang, tr, fonts) {
  const doc = initDoc(fonts);
  const F = ff(fonts);
  const ctx = makeCtx(doc, F);

  // ── Header ──
  doc.setFont(F, "bold"); doc.setFontSize(FS.title); doc.setTextColor(C.black);
  doc.text("GearBrain", PAGE.mx, ctx.y);
  ctx.y += 5.5;
  doc.setFont(F, "normal"); doc.setFontSize(FS.subtitle); doc.setTextColor(C.mid);
  doc.text(tr("pdf.title"), PAGE.mx, ctx.y);
  ctx.y += 4.5;
  doc.setFontSize(FS.small); doc.setTextColor(C.light);
  doc.text(safeTxt(`${tr("pdf.generated")}: ${dateStr(lang)}  |  ID: ${activeCase.id}`), PAGE.mx, ctx.y);
  ctx.y += 2;
  ctx.hLine(ctx.y, 0.6); ctx.y += 6;

  // ── Vehicle table ──
  const v = activeCase.vehicle || {};
  const rows = [
    [tr("app.vehicleBrand"), v.brand], [tr("app.vehicleModel"), v.model],
    [tr("app.enginePower"), v.enginePower], [tr("app.mileageKm"), v.mileage ? `${Number(v.mileage).toLocaleString()} km` : ""],
  ].filter(([, val]) => val);

  if (rows.length > 0) {
    const labelCol = 42;
    const tableX = PAGE.mx;
    const tableW = CW;
    const rowH = 6.5;

    // Table header
    doc.setFillColor(240, 240, 240);
    doc.rect(tableX, ctx.y - 3.5, tableW, rowH, "F");
    doc.setDrawColor(C.rule); doc.setLineWidth(0.3);
    doc.rect(tableX, ctx.y - 3.5, tableW, rowH, "S");
    doc.line(tableX + labelCol, ctx.y - 3.5, tableX + labelCol, ctx.y - 3.5 + rowH);
    doc.setFont(F, "bold"); doc.setFontSize(FS.small); doc.setTextColor(C.mid);
    doc.text(tr("pdf.vehicle"), tableX + 2, ctx.y);
    ctx.y += rowH - 3.5;

    for (const [label, value] of rows) {
      doc.setDrawColor(C.rule); doc.setLineWidth(0.15);
      doc.rect(tableX, ctx.y, tableW, rowH, "S");
      doc.line(tableX + labelCol, ctx.y, tableX + labelCol, ctx.y + rowH);
      doc.setFont(F, "normal"); doc.setFontSize(FS.small); doc.setTextColor(C.light);
      doc.text(safeTxt(label), tableX + 2, ctx.y + 4.5);
      doc.setFont(F, "bold"); doc.setTextColor(C.dark);
      doc.text(safeTxt(value), tableX + labelCol + 3, ctx.y + 4.5);
      ctx.y += rowH;
    }
    ctx.y += 6;
  }

  // ── Messages ──
  renderMessages(doc, ctx, activeCase, lang, tr, F, "technical");

  renderResolution(doc, ctx, activeCase, lang, tr, F);
  addAllFooters(doc, tr, activeCase, F);
  savePdf(doc, activeCase);
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT C — MINIMALISTICKY
// ═══════════════════════════════════════════════════════════════════════════════
function renderMinimalist(activeCase, lang, tr, fonts) {
  const doc = initDoc(fonts);
  const F = ff(fonts);
  const ctx = makeCtx(doc, F);

  // ── Header ──
  doc.setFont(F, "bold"); doc.setFontSize(11); doc.setTextColor(C.black);
  doc.text("GEARBRAIN", PAGE.mx, ctx.y);
  ctx.y += 5;
  doc.setFont(F, "normal"); doc.setFontSize(FS.body); doc.setTextColor(C.mid);
  doc.text(tr("pdf.title"), PAGE.mx, ctx.y);
  ctx.y += 4.5;
  doc.setFontSize(FS.small); doc.setTextColor(C.light);
  doc.text(safeTxt(`${dateStr(lang)}  ·  ${activeCase.id}`), PAGE.mx, ctx.y);
  ctx.y += 2;
  ctx.hLine(ctx.y, 0.4); ctx.y += 7;

  // ── Vehicle — inline ──
  const v = activeCase.vehicle || {};
  const vParts = [v.brand, v.model].filter(Boolean);
  if (vParts.length > 0) {
    doc.setFont(F, "bold"); doc.setFontSize(9.5); doc.setTextColor(C.black);
    doc.text(safeTxt(vParts.join(" ")), PAGE.mx, ctx.y);
    ctx.y += 4.5;
    const details = [v.enginePower, v.mileage ? `${Number(v.mileage).toLocaleString()} km` : ""].filter(Boolean);
    if (details.length > 0) {
      doc.setFont(F, "normal"); doc.setFontSize(FS.body); doc.setTextColor(C.mid);
      doc.text(safeTxt(details.join("  ·  ")), PAGE.mx, ctx.y);
      ctx.y += 4.5;
    }
    ctx.y += 4;
  }

  // ── Messages ──
  renderMessages(doc, ctx, activeCase, lang, tr, F, "minimalist");

  renderResolution(doc, ctx, activeCase, lang, tr, F);

  // Minimalist footer
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(C.rule); doc.setLineWidth(0.3);
    doc.line(PAGE.mx, PAGE.h - 13, PAGE.w - PAGE.mx, PAGE.h - 13);
    doc.setFont(F, "normal"); doc.setFontSize(FS.footer); doc.setTextColor(C.light);
    doc.text(`GearBrain  ·  ${i}/${total}  ·  ${activeCase.id}`, PAGE.w / 2, PAGE.h - 9, { align: "center" });
  }

  savePdf(doc, activeCase);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared: render all messages (inputs + diagnoses)
// ═══════════════════════════════════════════════════════════════════════════════
function renderMessages(doc, ctx, activeCase, lang, tr, F, variant) {
  let inputNum = 0, diagNum = 0;

  for (const msg of activeCase.messages) {
    if (msg.type === "input") {
      inputNum++;
      renderInput(doc, ctx, msg, inputNum, tr, F, variant);
    }
    if (msg.type === "diagnosis") {
      diagNum++;
      renderDiagnosis(doc, ctx, msg, diagNum, lang, tr, F, variant);
    }
  }
}

function renderInput(doc, ctx, msg, num, tr, F, variant) {
  ctx.checkPage(14);
  ctx.y += 3;

  // Section heading
  const prefix = variant === "technical" ? "# " : "";
  doc.setFont(F, "bold"); doc.setFontSize(FS.section); doc.setTextColor(C.black);
  doc.text(safeTxt(`${prefix}${tr("pdf.inputRound", { num })}`), PAGE.mx, ctx.y);
  ctx.y += 2;
  ctx.hLine(ctx.y, variant === "service" ? 0.4 : 0.3);
  ctx.y += 4.5;

  // Symptoms
  if (msg.symptoms?.length > 0) {
    doc.setFont(F, "normal"); doc.setFontSize(FS.small); doc.setTextColor(C.light);
    doc.text(safeTxt(tr("app.userSymptoms")) + ":", PAGE.mx, ctx.y);
    ctx.y += LH.small;
    ctx.text(msg.symptoms.map(s => tr(s)).join(", "), PAGE.mx, CW, FS.body, C.dark);
    ctx.y += 2;
  }

  // OBD codes
  if (msg.obdCodes?.length > 0) {
    doc.setFont(F, "normal"); doc.setFontSize(FS.small); doc.setTextColor(C.light);
    doc.text(safeTxt(tr("app.userObd")) + ":", PAGE.mx, ctx.y);
    ctx.y += LH.small;
    doc.setFont(F, "bold"); doc.setFontSize(FS.body); doc.setTextColor(C.black);
    doc.text(msg.obdCodes.join("  "), PAGE.mx, ctx.y);
    ctx.y += LH.section;
  }

  // Free text
  if (msg.text?.trim()) {
    doc.setFont(F, "normal"); doc.setFontSize(FS.small); doc.setTextColor(C.light);
    doc.text(safeTxt(tr("app.userMechDesc")) + ":", PAGE.mx, ctx.y);
    ctx.y += LH.small;
    ctx.text(msg.text.trim(), PAGE.mx, CW, FS.body, C.dark, { style: "italic" });
  }
  ctx.y += 3;
}

function renderDiagnosis(doc, ctx, msg, num, lang, tr, F, variant) {
  ctx.checkPage(14);
  ctx.y += 3;

  const prefix = variant === "technical" ? "# " : "";
  doc.setFont(F, "bold"); doc.setFontSize(FS.section); doc.setTextColor(C.black);
  doc.text(safeTxt(`${prefix}${tr("pdf.diagnosis", { num })}`), PAGE.mx, ctx.y);
  ctx.y += 2;
  ctx.hLine(ctx.y, variant === "service" ? 0.4 : 0.3);
  ctx.y += 4.5;

  const r = msg.result;

  // Summary
  if (r.shrnutí) {
    doc.setFont(F, "normal"); doc.setFontSize(FS.small); doc.setTextColor(C.light);
    doc.text(safeTxt(tr("pdf.summary")) + ":", PAGE.mx, ctx.y);
    ctx.y += LH.small;
    ctx.text(r.shrnutí, PAGE.mx, CW, FS.body, C.dark);
    ctx.y += 4;
  }

  // Faults
  if (r.závady?.length > 0) {
    for (let fi = 0; fi < r.závady.length; fi++) {
      const f = r.závady[fi];
      ctx.checkPage(22);

      if (variant === "service") {
        renderFaultService(doc, ctx, f, fi, tr, F, lang);
      } else if (variant === "technical") {
        renderFaultTechnical(doc, ctx, f, fi, tr, F, lang);
      } else {
        renderFaultMinimalist(doc, ctx, f, fi, tr, F, lang);
      }

      ctx.y += 3;
      // Separator between faults
      if (fi < r.závady.length - 1) {
        if (variant === "minimalist") {
          doc.setFont(F, "normal"); doc.setFontSize(FS.small); doc.setTextColor(C.rule);
          doc.text("·", PAGE.w / 2, ctx.y, { align: "center" });
          ctx.y += 4;
        } else {
          ctx.hLine(ctx.y, 0.15); ctx.y += 3;
        }
      }
    }
  }

  // Recommended tests
  if (r.doporučené_testy?.length > 0) {
    ctx.checkPage(10); ctx.y += 3;
    doc.setFont(F, "bold"); doc.setFontSize(FS.small); doc.setTextColor(C.mid);
    doc.text(safeTxt(tr("diag.recommendedTests")), PAGE.mx, ctx.y);
    ctx.y += 4.5;
    for (let i = 0; i < r.doporučené_testy.length; i++) {
      ctx.checkPage(5);
      ctx.text(`${String(i + 1).padStart(2, "0")}. ${r.doporučené_testy[i]}`, PAGE.mx + 2, CW - 4, FS.body, C.dark);
    }
    ctx.y += 2;
  }

  // Warning
  if (r.varování) {
    ctx.checkPage(8);
    ctx.text(`/!\\ ${r.varování}`, PAGE.mx, CW, FS.body, C.dark, { style: "bold" });
    ctx.y += 2;
  }
}

// ── Fault renderers per variant ──────────────────────────────────────────────

function renderFaultService(doc, ctx, f, fi, tr, F, lang) {
  const stripeW = 2;                    // left accent stripe width
  const gap = 2;                        // gap between stripe and text
  const x0 = PAGE.mx + stripeW + gap;   // text starts after stripe
  const textW = CW - stripeW - gap;     // available text width
  ctx.markStart();

  // Name + probability
  doc.setFont(F, "bold"); doc.setFontSize(FS.section); doc.setTextColor(C.black);
  doc.text(`${fi + 1}.`, x0, ctx.y);
  const nameLines = doc.splitTextToSize(safeTxt(f.název || ""), textW - 30);
  doc.text(nameLines[0] || "", x0 + 8, ctx.y);
  doc.setTextColor(C.mid);
  doc.text(`${f.pravděpodobnost}%`, PAGE.w - PAGE.mx, ctx.y, { align: "right" });
  ctx.y += 4.5;

  // Urgency (text only, no bar)
  if (f.naléhavost) {
    doc.setFontSize(FS.tiny); doc.setFont(F, "normal"); doc.setTextColor(C.mid);
    doc.text(trUrgency(f.naléhavost, lang), x0, ctx.y);
    ctx.y += 3.5;
  }

  // Parts
  if (f.díly?.length > 0) {
    doc.setFont(F, "normal"); doc.setFontSize(FS.small); doc.setTextColor(C.light);
    doc.text(safeTxt(f.díly.join(" · ")), x0, ctx.y); ctx.y += LH.small;
  }

  // Description
  if (f.popis) { ctx.text(f.popis, x0, textW, FS.body, C.dark); ctx.y += 1; }

  // OBD codes
  if (f.obd_kódy?.length > 0) {
    ctx.checkPage(6);
    doc.setFont(F, "bold"); doc.setFontSize(FS.small); doc.setTextColor(C.mid);
    doc.text(f.obd_kódy.join("  "), x0, ctx.y); ctx.y += 4;
  }

  // Repair procedure box — measure first, then draw as single block
  if (f.postup) {
    const boxPad = 4;
    doc.setFont(F, "normal"); doc.setFontSize(FS.small);
    const procLines = doc.splitTextToSize(safeTxt(f.postup), textW - boxPad * 2);
    const labelH = 5;
    const textH = procLines.length * LH.small;
    const padTop = 3, padBot = 3;
    const boxH = padTop + labelH + textH + padBot;

    // Ensure the entire box fits on one page (or start fresh page)
    ctx.checkPage(boxH + 2);

    const boxY = ctx.y;
    doc.setFillColor(248, 248, 248); doc.rect(x0, boxY, textW, boxH, "F");
    doc.setDrawColor(C.rule); doc.setLineWidth(0.2); doc.rect(x0, boxY, textW, boxH, "S");

    ctx.y = boxY + padTop;
    doc.setFont(F, "bold"); doc.setFontSize(FS.tiny); doc.setTextColor(C.mid);
    doc.text(safeTxt(tr("diag.repairProcedure")), x0 + boxPad, ctx.y + 2);
    ctx.y += labelH;

    doc.setFont(F, "normal"); doc.setFontSize(FS.small); doc.setTextColor(C.dark);
    for (const line of procLines) { doc.text(line, x0 + boxPad, ctx.y); ctx.y += LH.small; }
    ctx.y = boxY + boxH + 2;
  }

  // Note
  if (f.poznámka) {
    ctx.checkPage(6);
    doc.setFont(F, "italic"); doc.setFontSize(FS.small); doc.setTextColor(C.mid);
    const nLines = doc.splitTextToSize(safeTxt(f.poznámka), textW);
    for (const line of nLines) { ctx.checkPage(4); doc.text(line, x0, ctx.y); ctx.y += LH.small; }
  }

  // Left accent stripe (drawn in margin, spans pages if needed)
  const g = f.pravděpodobnost > 70 ? 60 : f.pravděpodobnost > 40 ? 120 : 180;
  ctx.drawStripe(PAGE.mx, stripeW, [g, g, g]);
}

function renderFaultTechnical(doc, ctx, f, fi, tr, F, lang) {
  const cardY = ctx.y;
  const innerX = PAGE.mx + 4;
  const innerW = CW - 8;
  ctx.y += 3.5;

  // Name + probability
  doc.setFont(F, "bold"); doc.setFontSize(FS.section); doc.setTextColor(C.black);
  const nameLines = doc.splitTextToSize(safeTxt(f.název || ""), innerW - 25);
  doc.text(nameLines[0] || "", innerX, ctx.y);
  doc.text(`${f.pravděpodobnost}%`, PAGE.w - PAGE.mx - 4, ctx.y, { align: "right" });
  ctx.y += 4.5;

  if (f.naléhavost) {
    doc.setFont(F, "normal"); doc.setFontSize(FS.tiny); doc.setTextColor(C.mid);
    doc.text(safeTxt(`${tr("diag.probability")}: ${trUrgency(f.naléhavost, lang)}`), innerX, ctx.y);
    ctx.y += LH.small;
  }

  // Divider inside card
  doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.15);
  doc.line(innerX, ctx.y, PAGE.w - PAGE.mx - 4, ctx.y);
  ctx.y += 3.5;

  if (f.popis) { ctx.text(f.popis, innerX, innerW, FS.body, C.dark); ctx.y += 1; }

  if (f.díly?.length > 0) {
    doc.setFont(F, "normal"); doc.setFontSize(FS.small); doc.setTextColor(C.light);
    doc.text(safeTxt(f.díly.join(" · ")), innerX, ctx.y); ctx.y += 4;
  }

  if (f.postup) {
    doc.setFont(F, "normal"); doc.setFontSize(FS.small); doc.setTextColor(C.light);
    doc.text(safeTxt(tr("diag.repairProcedure")) + ":", innerX, ctx.y); ctx.y += 3.5;
    ctx.text(f.postup, innerX + 2, innerW - 4, FS.small, C.dark);
    ctx.y += 1;
  }

  if (f.obd_kódy?.length > 0) {
    doc.setFont(F, "bold"); doc.setFontSize(FS.small); doc.setTextColor(C.mid);
    doc.text(f.obd_kódy.join("  "), innerX, ctx.y); ctx.y += 4;
  }

  if (f.poznámka) {
    doc.setFont(F, "italic"); doc.setFontSize(FS.small); doc.setTextColor(C.mid);
    const nLines = doc.splitTextToSize(safeTxt(f.poznámka), innerW - 4);
    for (const line of nLines) { ctx.checkPage(4); doc.text(line, innerX, ctx.y); ctx.y += LH.small; }
  }

  ctx.y += 2;

  // Card border
  const cardH = ctx.y - cardY;
  doc.setDrawColor(C.rule); doc.setLineWidth(0.4);
  doc.rect(PAGE.mx, cardY, CW, cardH, "S");
  // Top accent line
  doc.setDrawColor(C.dark); doc.setLineWidth(0.8);
  doc.line(PAGE.mx, cardY, PAGE.w - PAGE.mx, cardY);
}

function renderFaultMinimalist(doc, ctx, f, fi, tr, F, lang) {
  // Name + percentage
  doc.setFont(F, "bold"); doc.setFontSize(FS.section); doc.setTextColor(C.black);
  const nameLines = doc.splitTextToSize(safeTxt(f.název || ""), CW - 30);
  doc.text(nameLines[0] || "", PAGE.mx, ctx.y);
  doc.setTextColor(C.mid);
  doc.text(`${f.pravděpodobnost}%`, PAGE.w - PAGE.mx, ctx.y, { align: "right" });
  ctx.y += 4.5;

  // Meta items
  const metaItems = [];
  if (f.naléhavost) metaItems.push(trUrgency(f.naléhavost, lang));
  if (f.díly?.length > 0) metaItems.push(f.díly.join(" · "));
  for (const item of metaItems) {
    doc.setFont(F, "normal"); doc.setFontSize(FS.small); doc.setTextColor(C.mid);
    doc.text(safeTxt(`-  ${item}`), PAGE.mx, ctx.y); ctx.y += LH.small;
  }

  if (f.popis) { ctx.text(f.popis, PAGE.mx, CW, FS.body, C.dark); ctx.y += 1; }

  if (f.postup) {
    doc.setFont(F, "normal"); doc.setFontSize(FS.small); doc.setTextColor(C.light);
    doc.text(safeTxt(tr("diag.repairProcedure")) + ":", PAGE.mx, ctx.y); ctx.y += 3.5;
    ctx.text(f.postup, PAGE.mx + 2, CW - 4, FS.small, C.dark);
    ctx.y += 1;
  }

  if (f.obd_kódy?.length > 0) {
    doc.setFont(F, "bold"); doc.setFontSize(FS.small); doc.setTextColor(C.mid);
    doc.text(safeTxt("->  " + f.obd_kódy.join("  ")), PAGE.mx, ctx.y); ctx.y += 4;
  }

  if (f.poznámka) {
    doc.setFont(F, "italic"); doc.setFontSize(FS.small); doc.setTextColor(C.mid);
    ctx.text(`(${f.poznámka})`, PAGE.mx, CW, FS.small, C.mid, { style: "italic" });
  }
}

// ── Shared: resolution block ─────────────────────────────────────────────────
function renderResolution(doc, ctx, activeCase, lang, tr, F) {
  if (activeCase.status !== "uzavřený" || !activeCase.resolution) return;
  ctx.checkPage(14);
  ctx.y += 4;
  doc.setFont(F, "bold"); doc.setFontSize(FS.body); doc.setTextColor(C.mid);
  doc.text(safeTxt(tr("pdf.resolution").toUpperCase()), PAGE.mx, ctx.y);
  ctx.y += 2;
  ctx.hLine(ctx.y, 0.3);
  ctx.y += 4.5;

  if (activeCase.closedAt) {
    doc.setFont(F, "normal"); doc.setFontSize(FS.small); doc.setTextColor(C.light);
    doc.text(shortDate(activeCase.closedAt, lang), PAGE.mx, ctx.y); ctx.y += 4;
  }
  ctx.text(activeCase.resolution, PAGE.mx, CW, FS.body, C.dark);
}
