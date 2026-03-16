import { jsPDF } from "jspdf";

// ── Shared palette (black/gray, ink-efficient) ──────────────────────────────
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

export const PDF_VARIANTS = ["service", "technical", "minimalist"];

/**
 * Export diagnostic case as PDF with selected variant.
 * @param {object} activeCase
 * @param {string} lang
 * @param {function} tr
 * @param {"service"|"technical"|"minimalist"} variant
 */
export function exportCasePdf(activeCase, lang, tr, variant = "minimalist") {
  const renderer = { service: renderService, technical: renderTechnical, minimalist: renderMinimalist }[variant];
  if (!renderer) return;
  renderer(activeCase, lang, tr);
}

// ── Shared helpers ──────────────────────────────────────────────────────────
function dateStr(lang) {
  const loc = lang === "cs" ? "cs-CZ" : lang === "de" ? "de-DE" : "en-GB";
  return new Date().toLocaleDateString(loc, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function shortDate(iso, lang) {
  if (!iso) return "";
  const loc = lang === "cs" ? "cs-CZ" : lang === "de" ? "de-DE" : "en-GB";
  return new Date(iso).toLocaleDateString(loc, { day: "2-digit", month: "2-digit", year: "numeric" });
}

function savePdf(doc, activeCase) {
  const brand = activeCase.vehicle?.brand || "";
  const model = (activeCase.vehicle?.model || "").split(" ").slice(0, 2).join("-");
  const slug = [brand, model].filter(Boolean).join("-").replace(/[^a-zA-Z0-9-]/g, "") || "case";
  doc.save(`GearBrain-${slug}-${activeCase.id}.pdf`);
}

function addPageFooter(doc, tr, activeCase, pageNum, pageCount) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(C.light);
  doc.text("GearBrain", PAGE.mx, PAGE.h - 10);
  doc.text(`${tr("pdf.page")} ${pageNum} / ${pageCount}`, PAGE.w / 2, PAGE.h - 10, { align: "center" });
  doc.text(activeCase.id, PAGE.w - PAGE.mx, PAGE.h - 10, { align: "right" });
}

function addAllFooters(doc, tr, activeCase) {
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    addPageFooter(doc, tr, activeCase, i, total);
  }
}

// ── Helper: wrap text and track Y ───────────────────────────────────────────
function makeCtx(doc) {
  let y = PAGE.mt;
  const maxY = () => PAGE.h - PAGE.mb;

  const checkPage = (need = 12) => {
    if (y + need > maxY()) { doc.addPage(); y = PAGE.mt; }
  };

  const hLine = (yy, weight = 0.3) => {
    doc.setDrawColor(C.rule); doc.setLineWidth(weight);
    doc.line(PAGE.mx, yy, PAGE.w - PAGE.mx, yy);
  };

  const text = (str, x, maxW, fontSize, color, opts = {}) => {
    doc.setFont("helvetica", opts.style || "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(color);
    const lines = doc.splitTextToSize(String(str || ""), maxW);
    const lh = fontSize * 0.4 + (opts.spacing || 0.8);
    for (const line of lines) { checkPage(lh + 2); doc.text(line, x, y); y += lh; }
  };

  return { get y() { return y; }, set y(v) { y = v; }, checkPage, hLine, text, maxY };
}

// ═════════════════════════════════════════════════════════════════════════════
// VARIANT A — SERVISNÍ PROTOKOL
// ═════════════════════════════════════════════════════════════════════════════
function renderService(activeCase, lang, tr) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = makeCtx(doc);

  // ── Header ──
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(C.black);
  doc.text("GearBrain", PAGE.mx, ctx.y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(C.mid);
  doc.text(tr("pdf.title"), PAGE.w - PAGE.mx, ctx.y, { align: "right" });
  ctx.y += 3;
  doc.setFontSize(7); doc.setTextColor(C.light);
  doc.text(`${tr("pdf.generated")}: ${dateStr(lang)}  |  ID: ${activeCase.id}`, PAGE.mx, ctx.y);
  ctx.y += 2;
  ctx.hLine(ctx.y, 0.6);
  ctx.y += 5;

  // ── Vehicle box ──
  const v = activeCase.vehicle || {};
  const boxY = ctx.y;
  const boxH = 22;
  doc.setFillColor(245, 245, 245);
  doc.rect(PAGE.mx, boxY, CW, boxH, "F");
  doc.setDrawColor(C.rule); doc.setLineWidth(0.3);
  doc.rect(PAGE.mx, boxY, CW, boxH, "S");

  // Section label inside box
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(C.mid);
  doc.text(tr("pdf.vehicle"), PAGE.mx + 3, boxY + 4.5);
  ctx.hLine(boxY + 6.5, 0.2);

  // Vehicle data 2-column inside box
  const fields = [
    [tr("app.vehicleBrand"), v.brand], [tr("app.vehicleModel"), v.model],
    [tr("app.enginePower"), v.enginePower], [tr("app.mileageKm"), v.mileage ? `${Number(v.mileage).toLocaleString()} km` : ""],
  ].filter(([, val]) => val);
  const col1X = PAGE.mx + 3; const col2X = PAGE.mx + CW / 2 + 2;
  let fy = boxY + 10;
  for (let i = 0; i < fields.length; i++) {
    const x = i % 2 === 0 ? col1X : col2X;
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(C.light);
    doc.text(fields[i][0] + ":", x, fy);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(C.dark);
    doc.text(String(fields[i][1]), x + 28, fy);
    if (i % 2 === 1) fy += 5;
  }
  if (fields.length % 2 === 1) fy += 5;
  ctx.y = boxY + boxH + 6;

  // ── Messages ──
  let inputNum = 0, diagNum = 0;
  for (const msg of activeCase.messages) {
    if (msg.type === "input") {
      inputNum++;
      ctx.checkPage(14);
      ctx.y += 2;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(C.black);
      doc.text(tr("pdf.inputRound", { num: inputNum }), PAGE.mx, ctx.y);
      ctx.y += 1.5; ctx.hLine(ctx.y, 0.4); ctx.y += 4;

      if (msg.symptoms?.length > 0) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(C.light);
        doc.text(tr("app.userSymptoms") + ":", PAGE.mx, ctx.y); ctx.y += 3.5;
        ctx.text(msg.symptoms.map(s => tr(s)).join(", "), PAGE.mx + 2, CW - 2, 8, C.dark);
        ctx.y += 1;
      }
      if (msg.obdCodes?.length > 0) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(C.light);
        doc.text(tr("app.userObd") + ":", PAGE.mx, ctx.y); ctx.y += 3.5;
        doc.setFont("courier", "bold"); doc.setFontSize(8.5); doc.setTextColor(C.black);
        doc.text(msg.obdCodes.join("  "), PAGE.mx + 2, ctx.y); ctx.y += 5;
      }
      if (msg.text?.trim()) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(C.light);
        doc.text(tr("app.userMechDesc") + ":", PAGE.mx, ctx.y); ctx.y += 3.5;
        ctx.text(msg.text.trim(), PAGE.mx + 2, CW - 2, 8, C.dark, { style: "italic" });
      }
      ctx.y += 2;
    }

    if (msg.type === "diagnosis") {
      diagNum++;
      ctx.checkPage(14);
      ctx.y += 2;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(C.black);
      doc.text(tr("pdf.diagnosis", { num: diagNum }), PAGE.mx, ctx.y);
      ctx.y += 1.5; ctx.hLine(ctx.y, 0.4); ctx.y += 4;

      const r = msg.result;
      if (r.shrnutí) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(C.light);
        doc.text(tr("pdf.summary") + ":", PAGE.mx, ctx.y); ctx.y += 3.5;
        ctx.text(r.shrnutí, PAGE.mx + 2, CW - 2, 8.5, C.dark);
        ctx.y += 3;
      }

      // Faults with left accent stripe
      if (r.závady?.length > 0) {
        for (let fi = 0; fi < r.závady.length; fi++) {
          const f = r.závady[fi];
          ctx.checkPage(22);

          const stripeX = PAGE.mx;
          const stripeTop = ctx.y - 1;

          // Fault number + name + probability
          doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(C.black);
          doc.text(`${fi + 1}.`, stripeX + 4, ctx.y);
          const nameLines = doc.splitTextToSize(f.název || "", CW - 35);
          doc.text(nameLines[0] || "", stripeX + 12, ctx.y);
          doc.setTextColor(C.mid);
          doc.text(`${f.pravděpodobnost}%`, PAGE.w - PAGE.mx, ctx.y, { align: "right" });
          ctx.y += 4;

          // Urgency + probability bar
          if (f.naléhavost) {
            doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(C.mid);
            doc.text(f.naléhavost.toUpperCase(), stripeX + 4, ctx.y);
            const barX = stripeX + 28, barW = 36;
            doc.setFillColor(230, 230, 230); doc.rect(barX, ctx.y - 2.5, barW, 2.5, "F");
            const fillW = barW * Math.min(f.pravděpodobnost || 0, 100) / 100;
            const gray = f.pravděpodobnost > 70 ? 50 : f.pravděpodobnost > 40 ? 100 : 150;
            doc.setFillColor(gray, gray, gray); doc.rect(barX, ctx.y - 2.5, fillW, 2.5, "F");
            ctx.y += 3;
          }

          if (f.díly?.length > 0) {
            doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(C.light);
            doc.text(f.díly.join(" · "), stripeX + 4, ctx.y); ctx.y += 3.5;
          }

          if (f.popis) { ctx.text(f.popis, stripeX + 4, CW - 6, 8, C.dark); ctx.y += 1; }

          if (f.obd_kódy?.length > 0) {
            ctx.checkPage(6);
            doc.setFont("courier", "bold"); doc.setFontSize(7.5); doc.setTextColor(C.mid);
            doc.text(f.obd_kódy.join("  "), stripeX + 4, ctx.y); ctx.y += 4;
          }

          // Repair procedure in gray box
          if (f.postup) {
            ctx.checkPage(12);
            const procY = ctx.y;
            const procLines = doc.splitTextToSize(f.postup, CW - 12);
            const procH = procLines.length * 3.5 + 8;
            doc.setFillColor(248, 248, 248); doc.rect(stripeX + 2, procY - 2, CW - 4, procH, "F");
            doc.setDrawColor(C.rule); doc.setLineWidth(0.2); doc.rect(stripeX + 2, procY - 2, CW - 4, procH, "S");
            doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.setTextColor(C.mid);
            doc.text(tr("diag.repairProcedure"), stripeX + 5, ctx.y + 1);
            ctx.y += 4.5;
            doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(C.dark);
            for (const line of procLines) { doc.text(line, stripeX + 5, ctx.y); ctx.y += 3.5; }
            ctx.y += 2;
          }

          if (f.poznámka) {
            ctx.checkPage(6);
            doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(C.mid);
            const nLines = doc.splitTextToSize(f.poznámka, CW - 8);
            for (const line of nLines) { ctx.checkPage(4); doc.text(line, stripeX + 4, ctx.y); ctx.y += 3.5; }
          }

          // Draw left accent stripe
          const stripeBottom = ctx.y;
          const stripeGray = f.pravděpodobnost > 70 ? 60 : f.pravděpodobnost > 40 ? 120 : 180;
          doc.setFillColor(stripeGray, stripeGray, stripeGray);
          doc.rect(stripeX, stripeTop, 1.5, stripeBottom - stripeTop, "F");

          ctx.y += 3;
          if (fi < r.závady.length - 1) { ctx.hLine(ctx.y, 0.15); ctx.y += 3; }
        }
      }

      // Tests
      if (r.doporučené_testy?.length > 0) {
        ctx.checkPage(10); ctx.y += 2;
        doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(C.mid);
        doc.text(tr("diag.recommendedTests"), PAGE.mx, ctx.y); ctx.y += 4;
        for (let i = 0; i < r.doporučené_testy.length; i++) {
          ctx.checkPage(5);
          ctx.text(`${String(i + 1).padStart(2, "0")}. ${r.doporučené_testy[i]}`, PAGE.mx + 2, CW - 4, 8, C.dark);
        }
        ctx.y += 2;
      }

      // Warning
      if (r.varování) {
        ctx.checkPage(8);
        ctx.text(`⚠ ${r.varování}`, PAGE.mx, CW, 8, C.dark, { style: "bold" }); ctx.y += 2;
      }
    }
  }

  // ── Resolution ──
  renderResolution(doc, ctx, activeCase, lang, tr);

  addAllFooters(doc, tr, activeCase);
  savePdf(doc, activeCase);
}

// ═════════════════════════════════════════════════════════════════════════════
// VARIANT B — TECHNICKÁ ZPRÁVA
// ═════════════════════════════════════════════════════════════════════════════
function renderTechnical(activeCase, lang, tr) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = makeCtx(doc);

  // ── Header ──
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(C.black);
  doc.text("GearBrain", PAGE.mx, ctx.y);
  ctx.y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(C.mid);
  doc.text(tr("pdf.title"), PAGE.mx, ctx.y);
  ctx.y += 4;
  doc.setFontSize(7); doc.setTextColor(C.light);
  doc.text(`${tr("pdf.generated")}: ${dateStr(lang)}  |  ID: ${activeCase.id}`, PAGE.mx, ctx.y);
  ctx.y += 2;
  ctx.hLine(ctx.y, 0.6); ctx.y += 6;

  // ── Vehicle table ──
  const v = activeCase.vehicle || {};
  const rows = [
    [tr("app.vehicleBrand"), v.brand], [tr("app.vehicleModel"), v.model],
    [tr("app.enginePower"), v.enginePower], [tr("app.mileageKm"), v.mileage ? `${Number(v.mileage).toLocaleString()} km` : ""],
  ].filter(([, val]) => val);

  if (rows.length > 0) {
    const labelCol = 40;
    const tableX = PAGE.mx;
    const tableW = CW;
    const rowH = 6;

    // Table header
    doc.setFillColor(240, 240, 240);
    doc.rect(tableX, ctx.y - 3.5, tableW, rowH, "F");
    doc.setDrawColor(C.rule); doc.setLineWidth(0.3);
    doc.rect(tableX, ctx.y - 3.5, tableW, rowH, "S");
    doc.line(tableX + labelCol, ctx.y - 3.5, tableX + labelCol, ctx.y - 3.5 + rowH);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(C.mid);
    doc.text(tr("pdf.vehicle"), tableX + 2, ctx.y);
    ctx.y += rowH - 3.5;

    // Table rows
    for (const [label, value] of rows) {
      doc.setDrawColor(C.rule); doc.setLineWidth(0.15);
      doc.rect(tableX, ctx.y, tableW, rowH, "S");
      doc.line(tableX + labelCol, ctx.y, tableX + labelCol, ctx.y + rowH);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(C.light);
      doc.text(label, tableX + 2, ctx.y + 4);
      doc.setFont("helvetica", "bold"); doc.setTextColor(C.dark);
      doc.text(String(value), tableX + labelCol + 3, ctx.y + 4);
      ctx.y += rowH;
    }
    ctx.y += 6;
  }

  // ── Messages ──
  let inputNum = 0, diagNum = 0;
  for (const msg of activeCase.messages) {
    if (msg.type === "input") {
      inputNum++;
      ctx.checkPage(14); ctx.y += 2;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(C.black);
      doc.text(`■ ${tr("pdf.inputRound", { num: inputNum })}`, PAGE.mx, ctx.y);
      ctx.y += 4;

      if (msg.symptoms?.length > 0) {
        ctx.text(`${tr("app.userSymptoms")}: ${msg.symptoms.map(s => tr(s)).join(", ")}`, PAGE.mx + 2, CW - 4, 8, C.dark);
        ctx.y += 1;
      }
      if (msg.obdCodes?.length > 0) {
        doc.setFont("courier", "bold"); doc.setFontSize(8); doc.setTextColor(C.black);
        doc.text(`OBD: ${msg.obdCodes.join("  ")}`, PAGE.mx + 2, ctx.y); ctx.y += 5;
      }
      if (msg.text?.trim()) {
        ctx.text(msg.text.trim(), PAGE.mx + 2, CW - 4, 8, C.dark, { style: "italic" });
      }
      ctx.y += 3;
    }

    if (msg.type === "diagnosis") {
      diagNum++;
      ctx.checkPage(14); ctx.y += 2;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(C.black);
      doc.text(`■ ${tr("pdf.diagnosis", { num: diagNum })}`, PAGE.mx, ctx.y);
      ctx.y += 4;

      const r = msg.result;
      if (r.shrnutí) {
        ctx.text(r.shrnutí, PAGE.mx + 2, CW - 4, 8.5, C.dark); ctx.y += 3;
      }

      // Faults as bordered cards
      if (r.závady?.length > 0) {
        for (const f of r.závady) {
          ctx.checkPage(24);
          const cardY = ctx.y;

          // Card content (measure first, draw border after)
          const innerX = PAGE.mx + 4;
          const innerW = CW - 8;
          ctx.y += 3;

          // Name + probability
          doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(C.black);
          const nameLines = doc.splitTextToSize(f.název || "", innerW - 25);
          doc.text(nameLines[0] || "", innerX, ctx.y);
          doc.text(`${f.pravděpodobnost}%`, PAGE.w - PAGE.mx - 4, ctx.y, { align: "right" });
          ctx.y += 4;

          if (f.naléhavost) {
            doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(C.mid);
            doc.text(`${tr("diag.probability")}: ${f.naléhavost.toUpperCase()}`, innerX, ctx.y);
            ctx.y += 3.5;
          }

          // Thin divider inside card
          doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.15);
          doc.line(innerX, ctx.y, PAGE.w - PAGE.mx - 4, ctx.y);
          ctx.y += 3;

          if (f.popis) { ctx.text(f.popis, innerX, innerW, 8, C.dark); ctx.y += 1; }

          if (f.díly?.length > 0) {
            doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(C.light);
            doc.text(`${f.díly.join(" · ")}`, innerX, ctx.y); ctx.y += 4;
          }

          if (f.postup) {
            doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(C.light);
            doc.text(tr("diag.repairProcedure") + ":", innerX, ctx.y); ctx.y += 3;
            ctx.text(f.postup, innerX + 2, innerW - 4, 7.5, C.dark);
            ctx.y += 1;
          }

          if (f.obd_kódy?.length > 0) {
            doc.setFont("courier", "bold"); doc.setFontSize(7.5); doc.setTextColor(C.mid);
            doc.text(f.obd_kódy.join("  "), innerX, ctx.y); ctx.y += 4;
          }

          if (f.poznámka) {
            doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(C.mid);
            const nLines = doc.splitTextToSize(f.poznámka, innerW - 4);
            for (const line of nLines) { ctx.checkPage(4); doc.text(line, innerX, ctx.y); ctx.y += 3.5; }
          }

          ctx.y += 2;

          // Draw card border
          const cardH = ctx.y - cardY;
          doc.setDrawColor(C.rule); doc.setLineWidth(0.4);
          doc.rect(PAGE.mx, cardY, CW, cardH, "S");
          // Top accent line
          doc.setDrawColor(C.dark); doc.setLineWidth(0.8);
          doc.line(PAGE.mx, cardY, PAGE.w - PAGE.mx, cardY);

          ctx.y += 4;
        }
      }

      // Tests
      if (r.doporučené_testy?.length > 0) {
        ctx.checkPage(10);
        doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(C.mid);
        doc.text(tr("diag.recommendedTests"), PAGE.mx, ctx.y); ctx.y += 4;
        for (let i = 0; i < r.doporučené_testy.length; i++) {
          ctx.checkPage(5);
          ctx.text(`${String(i + 1).padStart(2, "0")}. ${r.doporučené_testy[i]}`, PAGE.mx + 2, CW - 4, 8, C.dark);
        }
        ctx.y += 2;
      }

      if (r.varování) {
        ctx.checkPage(8);
        ctx.text(`⚠ ${r.varování}`, PAGE.mx, CW, 8, C.dark, { style: "bold" }); ctx.y += 2;
      }
    }
  }

  renderResolution(doc, ctx, activeCase, lang, tr);
  addAllFooters(doc, tr, activeCase);
  savePdf(doc, activeCase);
}

// ═════════════════════════════════════════════════════════════════════════════
// VARIANT C — MINIMALISTICKÝ
// ═════════════════════════════════════════════════════════════════════════════
function renderMinimalist(activeCase, lang, tr) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = makeCtx(doc);

  // ── Header — very clean ──
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(C.black);
  doc.text("GEARBRAIN", PAGE.mx, ctx.y);
  ctx.y += 4.5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(C.mid);
  doc.text(tr("pdf.title"), PAGE.mx, ctx.y);
  ctx.y += 4;
  doc.setFontSize(7); doc.setTextColor(C.light);
  doc.text(`${dateStr(lang)}  ·  ${activeCase.id}`, PAGE.mx, ctx.y);
  ctx.y += 2;
  ctx.hLine(ctx.y, 0.4); ctx.y += 7;

  // ── Vehicle — inline, no box ──
  const v = activeCase.vehicle || {};
  const vParts = [v.brand, v.model].filter(Boolean);
  if (vParts.length > 0) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(C.black);
    doc.text(vParts.join(" "), PAGE.mx, ctx.y);
    ctx.y += 4;
    const details = [v.enginePower, v.mileage ? `${Number(v.mileage).toLocaleString()} km` : ""].filter(Boolean);
    if (details.length > 0) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(C.mid);
      doc.text(details.join("  ·  "), PAGE.mx, ctx.y);
      ctx.y += 4;
    }
    ctx.y += 4;
  }

  // ── Messages ──
  let inputNum = 0, diagNum = 0;
  for (const msg of activeCase.messages) {
    if (msg.type === "input") {
      inputNum++;
      ctx.checkPage(12); ctx.y += 2;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(C.black);
      doc.text(tr("pdf.inputRound", { num: inputNum }), PAGE.mx, ctx.y);
      ctx.y += 1.5; ctx.hLine(ctx.y, 0.3); ctx.y += 4;

      if (msg.symptoms?.length > 0) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(C.dark);
        ctx.text(msg.symptoms.map(s => tr(s)).join(", "), PAGE.mx, CW, 8, C.dark);
        ctx.y += 1;
      }
      if (msg.obdCodes?.length > 0) {
        doc.setFont("courier", "bold"); doc.setFontSize(8.5); doc.setTextColor(C.black);
        doc.text(msg.obdCodes.join("  "), PAGE.mx, ctx.y); ctx.y += 5;
      }
      if (msg.text?.trim()) {
        doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(C.dark);
        doc.text(`"`, PAGE.mx, ctx.y);
        ctx.text(msg.text.trim(), PAGE.mx + 2, CW - 4, 8, C.dark, { style: "italic" });
        ctx.y += 1;
      }
      ctx.y += 2;
    }

    if (msg.type === "diagnosis") {
      diagNum++;
      ctx.checkPage(12); ctx.y += 2;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(C.black);
      doc.text(tr("pdf.diagnosis", { num: diagNum }), PAGE.mx, ctx.y);
      ctx.y += 1.5; ctx.hLine(ctx.y, 0.3); ctx.y += 4;

      const r = msg.result;
      if (r.shrnutí) {
        ctx.text(r.shrnutí, PAGE.mx, CW, 8.5, C.dark); ctx.y += 4;
      }

      if (r.závady?.length > 0) {
        for (let fi = 0; fi < r.závady.length; fi++) {
          const f = r.závady[fi];
          ctx.checkPage(16);

          // Name + percentage, right-aligned
          doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(C.black);
          const nameLines = doc.splitTextToSize(f.název || "", CW - 30);
          doc.text(nameLines[0] || "", PAGE.mx, ctx.y);
          doc.setTextColor(C.mid);
          doc.text(`${f.pravděpodobnost}%`, PAGE.w - PAGE.mx, ctx.y, { align: "right" });
          ctx.y += 4;

          // Bullet-point meta
          const metaItems = [];
          if (f.naléhavost) metaItems.push(f.naléhavost);
          if (f.díly?.length > 0) metaItems.push(f.díly.join(" · "));
          for (const item of metaItems) {
            doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(C.mid);
            doc.text(`▪  ${item}`, PAGE.mx, ctx.y); ctx.y += 3.5;
          }

          if (f.popis) { ctx.text(f.popis, PAGE.mx, CW, 8, C.dark); ctx.y += 1; }

          if (f.postup) {
            doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(C.light);
            doc.text(tr("diag.repairProcedure") + ":", PAGE.mx, ctx.y); ctx.y += 3;
            ctx.text(f.postup, PAGE.mx + 2, CW - 4, 7.5, C.dark);
            ctx.y += 1;
          }

          if (f.obd_kódy?.length > 0) {
            doc.setFont("courier", "normal"); doc.setFontSize(7.5); doc.setTextColor(C.mid);
            doc.text(`→  ${f.obd_kódy.join("  ")}`, PAGE.mx, ctx.y); ctx.y += 4;
          }

          if (f.poznámka) {
            doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(C.mid);
            ctx.text(`(${f.poznámka})`, PAGE.mx, CW, 7, C.mid, { style: "italic" });
          }

          ctx.y += 2;
          // Centered dot separator between faults
          if (fi < r.závady.length - 1) {
            doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(C.rule);
            doc.text("·", PAGE.w / 2, ctx.y, { align: "center" });
            ctx.y += 4;
          }
        }
      }

      // Tests
      if (r.doporučené_testy?.length > 0) {
        ctx.checkPage(10); ctx.y += 2;
        doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(C.light);
        doc.text(tr("diag.recommendedTests") + ":", PAGE.mx, ctx.y); ctx.y += 4;
        for (let i = 0; i < r.doporučené_testy.length; i++) {
          ctx.checkPage(5);
          ctx.text(`${i + 1}. ${r.doporučené_testy[i]}`, PAGE.mx, CW, 8, C.dark);
        }
        ctx.y += 2;
      }

      if (r.varování) {
        ctx.checkPage(8);
        ctx.text(`⚠ ${r.varování}`, PAGE.mx, CW, 8, C.dark, { style: "bold" }); ctx.y += 2;
      }
    }
  }

  renderResolution(doc, ctx, activeCase, lang, tr);

  // Minimalist footer: just a thin line and text
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(C.rule); doc.setLineWidth(0.3);
    doc.line(PAGE.mx, PAGE.h - 13, PAGE.w - PAGE.mx, PAGE.h - 13);
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(C.light);
    doc.text(`GearBrain  ·  ${i}/${total}  ·  ${activeCase.id}`, PAGE.w / 2, PAGE.h - 9, { align: "center" });
  }

  savePdf(doc, activeCase);
}

// ── Shared: resolution block ────────────────────────────────────────────────
function renderResolution(doc, ctx, activeCase, lang, tr) {
  if (activeCase.status !== "uzavřený" || !activeCase.resolution) return;
  ctx.checkPage(14);
  ctx.y += 3;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(C.mid);
  doc.text(tr("pdf.resolution").toUpperCase(), PAGE.mx, ctx.y);
  ctx.y += 1.5; ctx.hLine(ctx.y, 0.3); ctx.y += 4;

  if (activeCase.closedAt) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(C.light);
    doc.text(shortDate(activeCase.closedAt, lang), PAGE.mx, ctx.y); ctx.y += 4;
  }
  ctx.text(activeCase.resolution, PAGE.mx, CW, 8.5, C.dark);
}
