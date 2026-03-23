import { VEHICLE_CATALOG } from "./catalog.js";
import { VEHICLE_CATALOG_US } from "./catalog-us.js";

const US_BRAND_SECTION = new Set(
  VEHICLE_CATALOG_US
    .filter((entry) => entry.active)
    .map((entry) => entry.brand),
);

function compareBrandNames(a, b) {
  return a.brand.localeCompare(b.brand, "cs", { sensitivity: "base" });
}

function getBrandSection(brand) {
  return US_BRAND_SECTION.has(brand) ? "US" : "EU";
}

/** Vyhledá záznam katalogu podle značky (case-insensitive) */
export function getBrandEntry(brand) {
  if (!brand) return null;
  return VEHICLE_CATALOG.find((entry) => entry.brand.toLowerCase() === brand.toLowerCase()) ?? null;
}

/** Pouze aktivní značky — zobrazují se v GUI */
export const ACTIVE_BRANDS = VEHICLE_CATALOG.filter((entry) => entry.active);

/** Aktivní značky rozdělené pro dropdown do sekcí EU a US */
export const ACTIVE_BRAND_SECTIONS = ["EU", "US"]
  .map((section) => ({
    section,
    brands: ACTIVE_BRANDS
      .filter((entry) => getBrandSection(entry.brand) === section)
      .sort(compareBrandNames),
  }))
  .filter((entry) => entry.brands.length > 0);

/** Flat seznam option položek pro dropdown značek včetně viditelných sekcí */
export const ACTIVE_BRAND_DROPDOWN_OPTIONS = ACTIVE_BRAND_SECTIONS.flatMap((entry) => [
  { type: "separator", key: `separator-${entry.section}`, label: `\u2500\u2500 ${entry.section} \u2500\u2500` },
  ...entry.brands.map((brand) => ({
    type: "brand",
    key: `brand-${brand.brand}`,
    brand: brand.brand,
    label: brand.brand,
  })),
]);

/**
 * Flat seznam modelů aktivních značek pro <select> v GUI.
 * Pokud je aktivních značek více, přidá nadpis značky jako group separator.
 */
export const VEHICLE_MODELS = ACTIVE_BRANDS.length === 1
  ? ACTIVE_BRANDS[0].models
  : ACTIVE_BRANDS.flatMap((entry) => [{ group: entry.brand }, ...entry.models]);

/** Vrátí pole modelů pro danou značku (pro dynamický model select) */
export function getBrandModels(brand) {
  if (!brand) return [];
  const entry = getBrandEntry(brand);
  return entry?.models ?? [];
}

/** Vrátí pole dostupných výkonů pro daný model (label) */
export function getModelPowers(modelLabel) {
  if (!modelLabel) return [];

  for (const brand of VEHICLE_CATALOG) {
    const entry = brand.models.find((model) => model.label === modelLabel);
    if (entry?.powers) return entry.powers;
  }

  return [];
}
