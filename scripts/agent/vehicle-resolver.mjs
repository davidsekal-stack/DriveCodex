/**
 * vehicle-resolver.mjs — mapuje vozidlo případu na KANONICKÝ katalog aplikace
 * (web/src/constants/catalog.js + catalog-us.js), aby byl případ v appce
 * DOHLEDATELNÝ.
 *
 * Proč: search-cases filtruje case'y `.eq('vehicle_brand', <katalogová značka>)`
 * (přesná shoda) a `.ilike('vehicle_model', '<první-token>%')`, kde značku i model
 * dodává PICKER, který nabízí jen AKTIVNÍ značky/modely z katalogu. Když tedy
 * uložená značka/model nesedí na katalog (jiný zápis, diakritika, neaktivní
 * značka, chassis-kód místo marketingového jména), je případ neviditelný.
 *
 * Tento modul je DETERMINISTICKÁ vrstva (čisté funkce, žádné I/O):
 *   - kanonizace ZNAČKY proti katalogu (casing/diakritika/aliasy),
 *   - kontrola, zda MODELOVÁ RODINA (první token) už katalogová je.
 * Co deterministika nevyřeší (chassis-kódy E39→5 Series, varianty S4→A4),
 * dostane příznak needsModelResolution → řeší LLM krok zvlášť (zrcadlo
 * fault-taxonomy --classify) nebo je to skutečná mezera pro Fázi 2.
 */

import { VEHICLE_CATALOG } from '../../web/src/constants/catalog.js';
import { VEHICLE_CATALOG_US } from '../../web/src/constants/catalog-us.js';

/** NFKD + bez diakritiky + lowercase + jen alfanum oddělené mezerou. */
export function normVehicle(s) {
  return (s ?? '')
    .toString()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** První token (rodina) — tak, jak ji search používá pro `ilike '<token>%'`. */
export function familyToken(model) {
  return normVehicle(model).split(' ').filter(Boolean)[0] || '';
}

/**
 * Drobné, bezpečné aliasy značek (normalizovaný tvar → normalizovaný katalogový
 * klíč). Záměrně malé — většina značek sedne přímou normalizací. Market-suffix
 * „(US)" NEodstraňujeme: katalog rozlišuje např. „Ford" vs „Ford (US)".
 */
export const BRAND_ALIASES = new Map([
  ['vw', 'volkswagen'],
  ['mercedes', 'mercedes benz'],
  ['merc', 'mercedes benz'],
  ['chevy', 'chevrolet'],
]);

/**
 * Index katalogu: normalizovaná značka → { canonicalBrand, active, families }.
 * families = množina prvních tokenů všech model labelů/group dané značky.
 */
export function buildCatalogIndex(catalogs = [VEHICLE_CATALOG, VEHICLE_CATALOG_US]) {
  const byBrand = new Map();
  for (const cat of catalogs) {
    for (const entry of cat) {
      const key = normVehicle(entry.brand);
      if (!key) continue;
      if (!byBrand.has(key)) {
        byBrand.set(key, { canonicalBrand: entry.brand, active: false, families: new Set() });
      }
      const rec = byBrand.get(key);
      if (entry.active) {
        rec.active = true;
        rec.canonicalBrand = entry.brand; // preferuj zápis AKTIVNÍ varianty
      }
      for (const m of entry.models ?? []) {
        const fam = familyToken(m.group || m.label || '');
        if (fam) rec.families.add(fam);
      }
    }
  }
  return byBrand;
}

function lookupBrand(brandRaw, index) {
  const bnorm = normVehicle(brandRaw);
  if (index.has(bnorm)) return index.get(bnorm);
  const alias = BRAND_ALIASES.get(bnorm);
  if (alias && index.has(alias)) return index.get(alias);
  return null;
}

/**
 * Vyřeš vozidlo proti katalogu (deterministicky).
 * @returns {{
 *   matched: boolean,           // značka nalezena v katalogu
 *   canonicalBrand: string|null,
 *   brandActive: boolean,       // false → značka v katalogu je, ale neaktivní (nutná aktivace)
 *   brandChanged: boolean,      // uložená značka ≠ kanonická (zápis k opravě)
 *   modelFamily: string,
 *   modelInCatalog: boolean,    // rodina už je katalogová → model-dohledatelný
 *   needsModelResolution: boolean, // !modelInCatalog → LLM/alias nebo skutečná mezera
 *   changes: { vehicle_brand?: string }
 * }}
 */
export function resolveVehicle(vehicle, index = buildCatalogIndex()) {
  const rawBrand = vehicle.vehicle_brand ?? vehicle.brand ?? vehicle.brand_raw ?? '';
  const rawModel = vehicle.vehicle_model ?? vehicle.model ?? vehicle.model_raw ?? '';

  const rec = lookupBrand(rawBrand, index);
  if (!rec) {
    return {
      matched: false, canonicalBrand: null, brandActive: false, brandChanged: false,
      modelFamily: familyToken(rawModel), modelInCatalog: false, needsModelResolution: true, changes: {},
    };
  }

  const canonicalBrand = rec.canonicalBrand;
  const brandChanged = canonicalBrand !== rawBrand;
  const fam = familyToken(rawModel);
  const modelInCatalog = fam ? rec.families.has(fam) : false;

  const changes = {};
  if (brandChanged) changes.vehicle_brand = canonicalBrand;

  return {
    matched: true,
    canonicalBrand,
    brandActive: rec.active,
    brandChanged,
    modelFamily: fam,
    modelInCatalog,
    needsModelResolution: !modelInCatalog,
    changes,
  };
}
