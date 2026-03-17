import { VEHICLE_CATALOG } from "./catalog.js"

// ── Odvozené konstanty ────────────────────────────────────────────────────────

/** Vyhledá záznam katalogu podle značky (case-insensitive) */
export function getBrandEntry(brand) {
  if (!brand) return null
  return VEHICLE_CATALOG.find(b => b.brand.toLowerCase() === brand.toLowerCase()) ?? null
}

/** Pouze aktivní značky — zobrazují se v GUI */
export const ACTIVE_BRANDS = VEHICLE_CATALOG.filter(b => b.active)

/**
 * Flat seznam modelů aktivních značek pro <select> v GUI.
 * Pokud je aktivních značek více, přidá nadpis značky jako group separator.
 */
export const VEHICLE_MODELS = ACTIVE_BRANDS.length === 1
  ? ACTIVE_BRANDS[0].models
  : ACTIVE_BRANDS.flatMap(b => [{ group: b.brand }, ...b.models])

/** Výchozí značka — buď uložená v localStorage, nebo první aktivní */
export function getDefaultBrand() {
  try {
    const saved = localStorage.getItem("gb_defaultBrand");
    if (saved && ACTIVE_BRANDS.some(b => b.brand === saved)) return saved;
  } catch (_) {}
  return ACTIVE_BRANDS[0]?.brand ?? "";
}

export function setDefaultBrand(brand) {
  try {
    if (brand) localStorage.setItem("gb_defaultBrand", brand);
    else localStorage.removeItem("gb_defaultBrand");
  } catch (_) {}
}

export function getStoredDefaultBrand() {
  try { return localStorage.getItem("gb_defaultBrand") || ""; } catch (_) { return ""; }
}

/** Prázdné vozidlo pro nový případ */
export function makeEmptyVehicle() {
  return { brand: getDefaultBrand(), model: "", mileage: "", enginePower: "", identType: "spz", identValue: "" };
}

/** @deprecated Use makeEmptyVehicle() instead — this is evaluated once at import time */
export const EMPTY_VEHICLE = makeEmptyVehicle();

/** Vrátí pole modelů pro danou značku (pro dynamický model select) */
export function getBrandModels(brand) {
  if (!brand) return []
  const entry = getBrandEntry(brand)
  return entry?.models ?? []
}

// ── VIN/SPZ local history (nikdy se neposílá do cloudu) ──────────────────────

const IDENT_KEY = "gb_vehicleIdents";

/** Načte celou mapu identifikátorů: { "ABC1234": [{ caseId, caseName, date }] } */
export function loadIdentHistory() {
  try { return JSON.parse(localStorage.getItem(IDENT_KEY) || "{}"); } catch (_) { return {}; }
}

/** Uloží identifikátor vozidla k případu */
export function saveIdent(identValue, caseId, caseName) {
  if (!identValue?.trim()) return;
  const key = identValue.trim().toUpperCase();
  const map = loadIdentHistory();
  const entries = map[key] || [];
  if (!entries.some(e => e.caseId === caseId)) {
    entries.push({ caseId, caseName, date: new Date().toISOString() });
    map[key] = entries;
    try { localStorage.setItem(IDENT_KEY, JSON.stringify(map)); } catch (_) {}
  }
}

/** Hledá historii pro daný identifikátor */
export function findIdentHistory(identValue) {
  if (!identValue?.trim()) return [];
  const key = identValue.trim().toUpperCase();
  const map = loadIdentHistory();
  return map[key] || [];
}

/** Vrátí pole dostupných výkonů pro daný model (label) */
export function getModelPowers(modelLabel) {
  if (!modelLabel) return []
  for (const brand of VEHICLE_CATALOG) {
    const entry = brand.models.find(m => m.label === modelLabel)
    if (entry?.powers) return entry.powers
  }
  return []
}
