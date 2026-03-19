import { VEHICLE_CATALOG } from "./catalog.js";

/** Vyhledá záznam katalogu podle značky (case-insensitive) */
export function getBrandEntry(brand) {
  if (!brand) return null;
  return VEHICLE_CATALOG.find((entry) => entry.brand.toLowerCase() === brand.toLowerCase()) ?? null;
}

/** Pouze aktivní značky — zobrazují se v GUI */
export const ACTIVE_BRANDS = VEHICLE_CATALOG.filter((entry) => entry.active);

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
