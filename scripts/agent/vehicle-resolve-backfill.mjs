/**
 * vehicle-resolve-backfill.mjs — jednorázová kanonizace vozidla u stávajících
 * approved případů, aby byly v appce dohledatelné (viz vehicle-resolver.mjs).
 *
 * Dvě vrstvy:
 *   1. DETERMINISTICKY: kanonizace značky (casing/diakritika/alias) — bez LLM.
 *   2. LLM (po značkách): případy, jejichž modelová rodina není katalogová
 *      (chassis-kódy E39, varianty S4, klasiky), namapuje na EXISTUJÍCÍ katalogový
 *      model NEBO označí jako skutečnou mezeru (→ Fáze 2 návrhy).
 *
 * Zápisy jsou VRATNÉ (záloha originálů). Default dry-run; --apply zapisuje.
 *
 * Usage:
 *   node --env-file=scripts/agent/.env.local scripts/agent/vehicle-resolve-backfill.mjs            # dry-run
 *   node --env-file=scripts/agent/.env.local scripts/agent/vehicle-resolve-backfill.mjs --apply
 */
import { pathToFileURL } from 'node:url';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { runLlm } from './llm.mjs';
import { VEHICLE_CATALOG } from '../../web/src/constants/catalog.js';
import { VEHICLE_CATALOG_US } from '../../web/src/constants/catalog-us.js';
import { buildCatalogIndex, resolveVehicle, normVehicle, familyToken } from './vehicle-resolver.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nmvjthfezyjcwuzphiuu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const LOG_DIR = new URL('./logs/', import.meta.url);
const PROPOSAL_DIR = new URL('./logs/catalog-proposals/', import.meta.url);

function headers(extra = {}) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...extra };
}

/** AKTIVNÍ značky → katalogové model labely (k LLM nabídce + remapu). */
export function buildBrandLabels(catalogs = [VEHICLE_CATALOG, VEHICLE_CATALOG_US]) {
  const map = new Map();
  for (const cat of catalogs) {
    for (const entry of cat) {
      if (!entry.active) continue;
      const key = normVehicle(entry.brand);
      if (!map.has(key)) map.set(key, { canonicalBrand: entry.brand, labels: [] });
      const rec = map.get(key);
      for (const m of entry.models ?? []) {
        if (m.label && !rec.labels.includes(m.label)) rec.labels.push(m.label);
      }
    }
  }
  return map;
}

export function buildBrandResolvePrompt(brand, labels, cases) {
  return `You map forum-extracted vehicles to an app's vehicle catalog for the brand "${brand}".

CATALOG MODELS for ${brand} (you may ONLY return one of these EXACT label strings, or null):
${labels.map(l => `- ${l}`).join('\n')}

For each CASE, return a catalog label ONLY when it is the SAME vehicle of the SAME generation. A performance or body variant of that EXACT generation counts (e.g. "S4" → the "A4" of the same chassis; "E92"/"E93" are the coupe/convertible of the "E90" generation; "e-208" → the "208" generation that offers the electric version). Return null when the case is a DIFFERENT generation than every catalog label for this model (e.g. an older "E36"/"E39" while the catalog lists only "E90"/"E60"), or the model line is absent entirely — that is a genuine catalog gap. NEVER map to a wrong generation just to find something close.

CASES:
${JSON.stringify(cases.map(c => ({ id: c.id, model: c.vehicle_model, engine: c.engine_power || '' })))}

Reply with ONLY a JSON array, nothing else:
[{"id":"<case id>","label":"<exact catalog label or null>"}]`;
}

function parseArray(raw) {
  const t = (raw || '').trim();
  const s = t.indexOf('['); const e = t.lastIndexOf(']');
  if (s === -1 || e <= s) return null;
  try { const a = JSON.parse(t.slice(s, e + 1)); return Array.isArray(a) ? a : null; } catch { return null; }
}

export async function runResolve({ llm = runLlm, fetchImpl = fetch, dryRun = true } = {}) {
  const index = buildCatalogIndex();
  const brandLabels = buildBrandLabels();

  // stáhni approved (id, brand, model, engine)
  let rows = [], offset = 0;
  for (;;) {
    const r = await fetchImpl(`${SUPABASE_URL}/rest/v1/gearbrain_cases?select=id,vehicle_brand,vehicle_model,engine_power&status=eq.approved&limit=1000&offset=${offset}`, { headers: headers() });
    const page = await r.json(); rows = rows.concat(page);
    if (page.length < 1000) break; offset += 1000;
  }

  const directWrites = [];        // {id, vehicle_brand} — jen recase značky
  const llmByBrand = new Map();   // canonicalBrandNorm → [case rows]
  for (const c of rows) {
    const r = resolveVehicle({ vehicle_brand: c.vehicle_brand, vehicle_model: c.vehicle_model }, index);
    if (!r.matched || !r.brandActive) continue;          // chybějící/neaktivní značka — mimo záběr backfillu
    if (r.modelInCatalog) {
      if (r.brandChanged) directWrites.push({ id: c.id, vehicle_brand: r.canonicalBrand, _from: c.vehicle_brand });
      continue;                                          // model OK → dohledatelné
    }
    // needsModelResolution → LLM po značkách
    const key = normVehicle(r.canonicalBrand);
    if (!llmByBrand.has(key)) llmByBrand.set(key, { canonicalBrand: r.canonicalBrand, cases: [] });
    llmByBrand.get(key).cases.push(c);
  }

  const remaps = [];   // {id, vehicle_brand, vehicle_model, _from}
  const gaps = [];     // {brand, model, family, engine, id}
  for (const [key, { canonicalBrand, cases }] of llmByBrand) {
    const labelsRec = brandLabels.get(key);
    const labels = labelsRec ? labelsRec.labels : [];
    if (!labels.length) { for (const c of cases) gaps.push({ brand: canonicalBrand, model: c.vehicle_model, family: familyToken(c.vehicle_model), engine: c.engine_power, id: c.id }); continue; }
    const raw = await llm('vehicle-resolve', buildBrandResolvePrompt(canonicalBrand, labels, cases), { maxTokens: 1500, timeoutMs: 180000 });
    const arr = parseArray(raw) || [];
    const byId = new Map(arr.map(x => [x.id, x.label]));
    const labelSet = new Set(labels);
    for (const c of cases) {
      const label = byId.get(c.id);
      if (label && typeof label === 'string' && labelSet.has(label)) {
        remaps.push({ id: c.id, vehicle_brand: canonicalBrand, vehicle_model: label, _from: `${c.vehicle_brand} / ${c.vehicle_model}` });
      } else {
        gaps.push({ brand: canonicalBrand, model: c.vehicle_model, family: familyToken(c.vehicle_model), engine: c.engine_power, id: c.id });
      }
    }
  }

  // report
  console.log(`approved: ${rows.length}`);
  console.log(`brand-recase (deterministicky): ${directWrites.length}`);
  console.log(`model remap (LLM našel katalogový model): ${remaps.length}`);
  console.log(`skutečné mezery (→ Fáze 2): ${gaps.length}`);
  console.log('\n— ukázky remap (z → na) —');
  for (const m of remaps.slice(0, 20)) console.log(`  ${m._from}  →  ${m.vehicle_brand} / ${m.vehicle_model}`);
  const gapAgg = {};
  for (const g of gaps) { const k = `${g.brand} | ${g.family || g.model}`; gapAgg[k] = (gapAgg[k] || 0) + 1; }
  console.log('\n— mezery pro Fázi 2 (značka | rodina × počet) —');
  for (const [k, n] of Object.entries(gapAgg).sort((a, b) => b[1] - a[1])) console.log(`  ${n}×  ${k}`);

  if (dryRun) { console.log('\n[dry-run] nic nezapsáno.'); return { directWrites, remaps, gaps }; }

  // APPLY: záloha + zápis
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
  if (!existsSync(PROPOSAL_DIR)) mkdirSync(PROPOSAL_DIR, { recursive: true });
  const allWrites = [...directWrites, ...remaps];
  const ids = allWrites.map(w => w.id);
  // záloha originálů
  const backup = [];
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const r = await fetchImpl(`${SUPABASE_URL}/rest/v1/gearbrain_cases?id=in.(${chunk.join(',')})&select=id,vehicle_brand,vehicle_model`, { headers: headers() });
    backup.push(...await r.json());
  }
  writeFileSync(new URL('./vehicle-resolve-backup.json', LOG_DIR), JSON.stringify(backup));
  let ok = 0;
  for (const w of allWrites) {
    const patch = w.vehicle_model ? { vehicle_brand: w.vehicle_brand, vehicle_model: w.vehicle_model } : { vehicle_brand: w.vehicle_brand };
    const r = await fetchImpl(`${SUPABASE_URL}/rest/v1/gearbrain_cases?id=eq.${encodeURIComponent(w.id)}`, { method: 'PATCH', headers: headers({ Prefer: 'return=minimal' }), body: JSON.stringify(patch) });
    if (r.ok) ok++; else console.error('PATCH selhal', w.id, r.status);
  }
  writeFileSync(new URL(`./gaps-${backup.length}.json`, PROPOSAL_DIR), JSON.stringify(gaps, null, 2));
  console.log(`\n[apply] zapsáno ${ok}/${allWrites.length}, záloha + gaps uloženy.`);
  return { directWrites, remaps, gaps, written: ok };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dryRun = !process.argv.includes('--apply');
  runResolve({ dryRun }).catch(e => { console.error(e); process.exit(1); });
}
