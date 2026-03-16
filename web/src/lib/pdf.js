import { jsPDF } from "jspdf";

// ── Black/gray professional palette (ink-efficient) ─────────────────────────
const C = {
  black:    "#000000",
  dark:     "#333333",
  mid:      "#666666",
  light:    "#999999",
  rule:     "#cccccc",
  bgLight:  "#f5f5f5",
};

const PAGE = { w: 210, h: 297, mx: 18, mt: 22, mb: 20 };
const CONTENT_W = PAGE.w - PAGE.mx * 2;

/**
 * Export diagnostic case as a professional black/gray PDF.
 * @param {object} activeCase - The case object
 * @param {string} lang - Current language code (cs/en/de)
 * @param {function} tr - Translation function
 */
export function exportCasePdf(activeCase, lang, tr) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = PAGE.mt;

  // ── Helpers ──────────────────────────────────────────────────────────────
  const maxY = () => PAGE.h - PAGE.mb;

  const checkPage = (need = 16) => {
    if (y + need > maxY()) {
      addFooter(doc, tr, lang, activeCase);
      doc.addPage();
      y = PAGE.mt;
    }
  };

  const hLine = (yy, weight = 0.3) => {
    doc.setDrawColor(C.rule);
    doc.setLineWidth(weight);
    doc.line(PAGE.mx, yy, PAGE.w - PAGE.mx, yy);
  };

  const textBlock = (text, x, maxW, fontSize, color, opts = {}) => {
    doc.setFont("helvetica", opts.style || "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(color);
    const lines = doc.splitTextToSize(String(text || ""), maxW);
    for (const line of lines) {
      checkPage(fontSize * 0.4 + 2);
      doc.text(line, x, y);
      y += fontSize * 0.4 + (opts.spacing || 0.8);
    }
  };

  const sectionTitle = (label) => {
    checkPage(14);
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(C.mid);
    doc.text(label.toUpperCase(), PAGE.mx, y);
    y += 1.5;
    hLine(y, 0.4);
    y += 4;
  };

  // ── Header ───────────────────────────────────────────────────────────────
  // Logo text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(C.black);
  doc.text("GearBrain", PAGE.mx, y);

  // Title right-aligned
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(C.mid);
  doc.text(tr("pdf.title"), PAGE.w - PAGE.mx, y, { align: "right" });
  y += 3;

  // Date + case ID
  doc.setFontSize(7);
  doc.setTextColor(C.light);
  const dateStr = new Date().toLocaleDateString(lang === "cs" ? "cs-CZ" : lang === "de" ? "de-DE" : "en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  doc.text(`${tr("pdf.generated")}: ${dateStr}  |  ID: ${activeCase.id}`, PAGE.mx, y);
  y += 2;
  hLine(y, 0.6);
  y += 6;

  // ── Vehicle info ─────────────────────────────────────────────────────────
  const v = activeCase.vehicle || {};
  sectionTitle(tr("pdf.vehicle"));

  const vehicleLines = [
    v.brand && [tr("app.vehicleBrand"), v.brand],
    v.model && [tr("app.vehicleModel"), v.model],
    v.enginePower && [tr("app.enginePower"), v.enginePower],
    v.mileage && [tr("app.mileageKm"), `${Number(v.mileage).toLocaleString()} km`],
  ].filter(Boolean);

  for (const [label, value] of vehicleLines) {
    checkPage(6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(C.light);
    doc.text(`${label}:`, PAGE.mx, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(C.dark);
    doc.text(String(value), PAGE.mx + 42, y);
    y += 4.5;
  }
  y += 2;

  // ── Messages (input + diagnosis rounds) ──────────────────────────────────
  let inputNum = 0;
  let diagNum = 0;

  for (const msg of activeCase.messages) {
    if (msg.type === "input") {
      inputNum++;
      sectionTitle(tr("pdf.inputRound", { num: inputNum }));

      // Symptoms
      if (msg.symptoms?.length > 0) {
        checkPage(8);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(C.light);
        doc.text(tr("app.userSymptoms") + ":", PAGE.mx, y);
        y += 3.5;
        doc.setFontSize(8);
        doc.setTextColor(C.dark);
        const symText = msg.symptoms.map((s) => tr(s)).join(", ");
        textBlock(symText, PAGE.mx + 2, CONTENT_W - 2, 8, C.dark);
        y += 1;
      }

      // OBD codes
      if (msg.obdCodes?.length > 0) {
        checkPage(8);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(C.light);
        doc.text(tr("app.userObd") + ":", PAGE.mx, y);
        y += 3.5;
        doc.setFont("courier", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(C.black);
        doc.text(msg.obdCodes.join("  "), PAGE.mx + 2, y);
        y += 5;
      }

      // Free text
      if (msg.text?.trim()) {
        checkPage(8);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(C.light);
        doc.text(tr("app.userMechDesc") + ":", PAGE.mx, y);
        y += 3.5;
        textBlock(msg.text.trim(), PAGE.mx + 2, CONTENT_W - 2, 8, C.dark, { style: "italic" });
      }
      y += 2;
    }

    if (msg.type === "diagnosis") {
      diagNum++;
      const r = msg.result;
      sectionTitle(tr("pdf.diagnosis", { num: diagNum }));

      // Summary
      if (r.shrnutí) {
        checkPage(10);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(C.light);
        doc.text(tr("pdf.summary") + ":", PAGE.mx, y);
        y += 3.5;
        textBlock(r.shrnutí, PAGE.mx + 2, CONTENT_W - 2, 8.5, C.dark);
        y += 3;
      }

      // Faults
      if (r.závady?.length > 0) {
        for (const f of r.závady) {
          checkPage(20);

          // Fault header: name + probability
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          doc.setTextColor(C.black);
          const probStr = `${f.pravděpodobnost}%`;
          doc.text(probStr, PAGE.w - PAGE.mx, y, { align: "right" });
          const nameW = CONTENT_W - doc.getTextWidth(probStr) - 4;
          const nameLines = doc.splitTextToSize(f.název || "", nameW);
          doc.text(nameLines[0] || "", PAGE.mx, y);
          y += 4;

          // Urgency bar
          if (f.naléhavost) {
            doc.setFontSize(6.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(C.mid);
            doc.text(f.naléhavost.toUpperCase(), PAGE.mx, y);
            // Probability bar (thin, grayscale)
            const barX = PAGE.mx + 25;
            const barW = 40;
            doc.setFillColor(230, 230, 230);
            doc.rect(barX, y - 2.5, barW, 2.5, "F");
            const fillW = barW * Math.min(f.pravděpodobnost || 0, 100) / 100;
            const gray = f.pravděpodobnost > 70 ? 50 : f.pravděpodobnost > 40 ? 100 : 150;
            doc.setFillColor(gray, gray, gray);
            doc.rect(barX, y - 2.5, fillW, 2.5, "F");
            y += 3;
          }

          // Parts
          if (f.díly?.length > 0) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(C.light);
            doc.text(f.díly.join(" · "), PAGE.mx, y);
            y += 3.5;
          }

          // Description
          if (f.popis) {
            textBlock(f.popis, PAGE.mx, CONTENT_W, 8, C.dark);
            y += 1;
          }

          // OBD codes for this fault
          if (f.obd_kódy?.length > 0) {
            checkPage(6);
            doc.setFont("courier", "bold");
            doc.setFontSize(8);
            doc.setTextColor(C.mid);
            doc.text(f.obd_kódy.join("  "), PAGE.mx, y);
            y += 4;
          }

          // Repair procedure
          if (f.postup) {
            checkPage(10);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(C.light);
            doc.text(tr("diag.repairProcedure") + ":", PAGE.mx, y);
            y += 3;
            textBlock(f.postup, PAGE.mx + 2, CONTENT_W - 2, 7.5, C.dark);
            y += 1;
          }

          // Note
          if (f.poznámka) {
            checkPage(8);
            doc.setFont("helvetica", "italic");
            doc.setFontSize(7.5);
            doc.setTextColor(C.mid);
            const noteLines = doc.splitTextToSize(f.poznámka, CONTENT_W - 4);
            for (const line of noteLines) {
              checkPage(4);
              doc.text(line, PAGE.mx + 2, y);
              y += 3.5;
            }
          }

          y += 3;
          hLine(y, 0.15);
          y += 3;
        }
      }

      // Recommended tests
      if (r.doporučené_testy?.length > 0) {
        checkPage(10);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(C.light);
        doc.text(tr("diag.recommendedTests") + ":", PAGE.mx, y);
        y += 3.5;
        for (let i = 0; i < r.doporučené_testy.length; i++) {
          checkPage(5);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(C.dark);
          const num = String(i + 1).padStart(2, "0");
          textBlock(`${num}. ${r.doporučené_testy[i]}`, PAGE.mx + 2, CONTENT_W - 4, 8, C.dark);
        }
        y += 2;
      }

      // Warning
      if (r.varování) {
        checkPage(8);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(C.dark);
        textBlock(`! ${r.varování}`, PAGE.mx, CONTENT_W, 8, C.dark, { style: "bold" });
        y += 2;
      }
    }
  }

  // ── Resolution (if closed) ───────────────────────────────────────────────
  if (activeCase.status === "uzavřený" && activeCase.resolution) {
    sectionTitle(tr("pdf.resolution"));
    if (activeCase.closedAt) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(C.light);
      const closedDate = new Date(activeCase.closedAt).toLocaleDateString(
        lang === "cs" ? "cs-CZ" : lang === "de" ? "de-DE" : "en-GB",
        { day: "2-digit", month: "2-digit", year: "numeric" }
      );
      doc.text(closedDate, PAGE.mx, y);
      y += 4;
    }
    textBlock(activeCase.resolution, PAGE.mx, CONTENT_W, 8.5, C.dark);
  }

  // ── Footer on last page ──────────────────────────────────────────────────
  addFooter(doc, tr, lang, activeCase);

  // ── Save ─────────────────────────────────────────────────────────────────
  const brand = activeCase.vehicle?.brand || "";
  const model = (activeCase.vehicle?.model || "").split(" ").slice(0, 2).join("-");
  const slug = [brand, model].filter(Boolean).join("-").replace(/[^a-zA-Z0-9-]/g, "") || "case";
  doc.save(`GearBrain-${slug}-${activeCase.id}.pdf`);
}

function addFooter(doc, tr, lang, activeCase) {
  const pageCount = doc.internal.getNumberOfPages();
  const pageNum = doc.getCurrentPageInfo().pageNumber;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(C.light);

  // Left: GearBrain
  doc.text("GearBrain", PAGE.mx, PAGE.h - 10);

  // Center: page
  const pageText = `${tr("pdf.page")} ${pageNum} / ${pageCount}`;
  doc.text(pageText, PAGE.w / 2, PAGE.h - 10, { align: "center" });

  // Right: case ID
  doc.text(activeCase.id, PAGE.w - PAGE.mx, PAGE.h - 10, { align: "right" });
}
