// ── Známé závady tohoto vozu — čisté pomocné funkce ───────────────────────────
//
// Logika panelu KnownFaultsPanel oddělená od Reactu kvůli testovatelnosti
// (tests/known-faults.test.js). Pásma nájezdu musí odpovídat SQL funkci
// mileage_band (migrace 021) a edge funkci known-faults.

export const BANDS = ["all", "0-100", "100-150", "150-200", "200+"];

/** Pásmo nájezdu pro zadané km; nevalidní/prázdný vstup → "all". */
export function bandForMileage(mileage) {
  const km = parseInt(String(mileage ?? ""), 10);
  if (!Number.isFinite(km) || km <= 0) return "all";
  if (km < 100000) return "0-100";
  if (km < 150000) return "100-150";
  if (km < 200000) return "150-200";
  return "200+";
}

/** Lokalizovaný název závady s fallbackem na angličtinu a slug. */
export function pickFaultLabel(fault, lang) {
  if (!fault) return "";
  const byLang = { cs: fault.labelCs, en: fault.labelEn, de: fault.labelDe };
  return byLang[lang] || fault.labelEn || fault.faultId || "";
}

/**
 * Lokalizovaný text opravy s fallbackem na kanonickou angličtinu (`resolution`).
 * cs/de varianty se plní při importu (push-case) a doplňují backfillem; když
 * pro daný jazyk chybí, zobrazí se anglický originál. Stejný vzor jako
 * pickFaultLabel — výběr jazyka je na klientu, edge fn vrací všechny varianty.
 */
export function localizeResolution(c, lang) {
  if (!c) return "";
  const byLang = { cs: c.resolutionCs, de: c.resolutionDe };
  return byLang[lang] || c.resolution || "";
}

/** Počet případů závady v daném pásmu ("all" = všechna pásma). */
export function countForBand(fault, band) {
  if (!fault?.counts) return 0;
  if (band === "all") return fault.counts.all ?? 0;
  return fault.counts[band] ?? 0;
}

/** Součet případů přes všechny závady pro dané pásmo (pro chipy filtru). */
export function bandTotals(faults) {
  const totals = {};
  for (const band of BANDS) {
    totals[band] = (faults ?? []).reduce((sum, f) => sum + countForBand(f, band), 0);
  }
  return totals;
}

/** Nejčastější OBD kódy napříč načtenými případy (pro předvyplnění). */
export function topObdCodes(cases, n = 3) {
  const freq = {};
  for (const c of cases ?? []) {
    for (const code of c.obdCodes ?? []) {
      const norm = String(code).toUpperCase().trim();
      if (norm) freq[norm] = (freq[norm] || 0) + 1;
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([code]) => code);
}

/** Doména zdroje (bez www.) nebo null = případ od uživatele aplikace. */
export function sourceLabelFor(threadUrl) {
  if (!threadUrl) return null;
  try {
    return new URL(threadUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
