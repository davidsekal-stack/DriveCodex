import { ACTIVE_BRANDS } from "./catalog-helpers.js";

const DEFAULT_BRAND_KEY = "gb_defaultBrand";
const IDENT_KEY = "gb_vehicleIdents";

/** Výchozí značka — buď uložená v localStorage, nebo první aktivní */
export function getDefaultBrand() {
  try {
    const saved = localStorage.getItem(DEFAULT_BRAND_KEY);
    if (saved && ACTIVE_BRANDS.some((brand) => brand.brand === saved)) return saved;
  } catch (_) {}

  return ACTIVE_BRANDS[0]?.brand ?? "";
}

export function setDefaultBrand(brand) {
  try {
    if (brand) localStorage.setItem(DEFAULT_BRAND_KEY, brand);
    else localStorage.removeItem(DEFAULT_BRAND_KEY);
  } catch (_) {}
}

export function getStoredDefaultBrand() {
  try {
    return localStorage.getItem(DEFAULT_BRAND_KEY) || "";
  } catch (_) {
    return "";
  }
}

/** Prázdné vozidlo pro nový případ */
export function makeEmptyVehicle() {
  return { brand: getDefaultBrand(), model: "", mileage: "", enginePower: "", identType: "spz", identValue: "" };
}

/** @deprecated Use makeEmptyVehicle() instead — this is evaluated once at import time */
export const EMPTY_VEHICLE = makeEmptyVehicle();

/** Načte celou mapu identifikátorů: { "ABC1234": [{ caseId, caseName, date }] } */
export function loadIdentHistory() {
  try {
    return JSON.parse(localStorage.getItem(IDENT_KEY) || "{}");
  } catch (_) {
    return {};
  }
}

/** Uloží identifikátor vozidla k případu */
export function saveIdent(identValue, caseId, caseName) {
  if (!identValue?.trim()) return;

  const key = identValue.trim().toUpperCase();
  const map = loadIdentHistory();
  const entries = map[key] || [];

  if (!entries.some((entry) => entry.caseId === caseId)) {
    entries.push({ caseId, caseName, date: new Date().toISOString() });
    map[key] = entries;
    try {
      localStorage.setItem(IDENT_KEY, JSON.stringify(map));
    } catch (_) {}
  }
}

/** Hledá historii pro daný identifikátor */
export function findIdentHistory(identValue) {
  if (!identValue?.trim()) return [];

  const key = identValue.trim().toUpperCase();
  const map = loadIdentHistory();
  return map[key] || [];
}
