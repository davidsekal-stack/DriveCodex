/**
 * vehicle-auto-add.mjs — Fáze 2: spojí detekci mezer + Claude+web verifikátor +
 * zápis do ODDĚLENÉHO web/src/constants/catalog-auto.js.
 *
 * Tok: gaps.json (model-level mezery) → kandidáti (značka × rodina) → verifikace
 * (vehicle-web-verify, ≥2 nezávislé oficiální zdroje) → POTVRZENÉ:
 *   (a) položka do catalog-auto.js (aby šel vůz vybrat v pickeru),
 *   (b) přeštítkování případů té mezery na kanonický label (aby je search našel —
 *       jinak by vůz v pickeru byl, ale bez nálezů).
 * Dedup proti katalogu, build-gate. NEpotvrzené se podrží + zalogují.
 *
 * Default DRY-RUN (nic nezapíše). --apply zapíše catalog-auto.js + přeštítkuje
 * případy + ověří build. Push na produkci je až Fáze 3.
 */
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { verifyVehicle } from './vehicle-web-verify.mjs';
import { familyToken } from './vehicle-resolver.mjs';
import { VEHICLE_CATALOG } from '../../web/src/constants/catalog.js';
import { VEHICLE_CATALOG_US } from '../../web/src/constants/catalog-us.js';
import { VEHICLE_CATALOG_AUTO } from '../../web/src/constants/catalog-auto.js';

const GAPS = new URL('./logs/catalog-proposals/gaps.json', import.meta.url);
const AUTO_FILE = new URL('../../web/src/constants/catalog-auto.js', import.meta.url);
const LOG_DIR = new URL('./logs/', import.meta.url);
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nmvjthfezyjcwuzphiuu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

const US_BRANDS = new Set(VEHICLE_CATALOG_US.map((b) => b.brand));
const norm = (s) => (s || '').toString().normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Existující labely + rodiny v katalogu (statický + auto) pro dedup.
function buildExisting() {
  const labels = new Set(), families = new Map(); // families: brand-norm → Set(familyToken)
  const addBrand = (b) => {
    const key = norm(b.brand);
    if (!families.has(key)) families.set(key, new Set());
    for (const m of b.models || []) {
      const s = m.label || m.group; if (!s) continue;
      if (m.label) labels.add(norm(m.label));
      families.get(key).add(familyToken(s));
    }
  };
  [...VEHICLE_CATALOG, ...VEHICLE_CATALOG_US].forEach(addBrand);
  for (const a of VEHICLE_CATALOG_AUTO) { if (a.model?.label) labels.add(norm(a.model.label)); }
  return { labels, families };
}

// gaps → kandidáti seskupení podle (značka × rodina); reprezentativní model = nejdelší.
function candidates(gaps) {
  const byKey = new Map();
  for (const g of gaps) {
    const key = `${g.brand}||${g.family || norm(g.model)}`;
    if (!byKey.has(key)) byKey.set(key, { brand: g.brand, family: g.family, models: [], caseIds: [], engines: [] });
    const c = byKey.get(key);
    c.models.push(g.model); c.caseIds.push(g.id); if (g.engine) c.engines.push(g.engine);
  }
  return [...byKey.values()].map((c) => ({
    brand: c.brand,
    market: US_BRANDS.has(c.brand) ? 'US' : 'EU',
    model: c.models.sort((a, b) => (b || '').length - (a || '').length)[0],
    examples: [...new Set(c.models)].slice(0, 6),     // varianty z případů (disambiguace)
    engine: c.engines.find(Boolean) || '',            // motor z případů (disambiguace generace)
    family: c.family,
    caseIds: c.caseIds,
  }));
}

export async function run({ dryRun = true, limit = Infinity } = {}) {
  const gaps = JSON.parse(readFileSync(GAPS, 'utf8'));
  const existing = buildExisting();
  const cands = candidates(gaps).slice(0, limit);
  console.log(`kandidátů (značka×rodina): ${cands.length} (z ${gaps.length} mezerových případů)`);

  const toAdd = [];     // catalog-auto položky
  const relabels = [];  // {ids, label}
  const held = [];
  for (const c of cands) {
    await new Promise((r) => setTimeout(r, 1200)); // pacing — méně bušení do API
    const v = await verifyVehicle({ brand: c.brand, model: c.model, market: c.market, engine: c.engine, examples: c.examples });
    if (!v.confirmed) { held.push({ ...c, reason: v.reason }); console.log(`  ⏸ ${c.brand} / ${c.model} — ${v.reason}`); continue; }
    const label = v.model_label || c.model;
    relabels.push({ ids: c.caseIds, label, brand: c.brand });
    if (existing.labels.has(norm(label))) {
      console.log(`  ✓ ${c.brand} / ${c.model} → "${label}" (label už v katalogu — jen přeštítkovat ${c.caseIds.length})`);
    } else {
      toAdd.push({ brand: c.brand, market: c.market, added: null, sources: v.independentDomains, model: { label, powers: v.powers || [] } });
      console.log(`  ✅ ${c.brand} / ${c.model} → PŘIDAT "${label}" [${(v.powers || []).length} motorů, zdroje: ${v.independentDomains.join(', ')}] + přeštítkovat ${c.caseIds.length}`);
    }
  }

  console.log(`\n— souhrn — přidat: ${toAdd.length} | přeštítkovat skupin: ${relabels.length} (${relabels.reduce((s, r) => s + r.ids.length, 0)} případů) | podrženo: ${held.length}`);
  writeFileSync(new URL('./catalog-proposals/auto-add-plan.json', LOG_DIR), JSON.stringify({ toAdd, relabels, held }, null, 2));
  console.log('(plán uložen: logs/catalog-proposals/auto-add-plan.json)');

  if (dryRun) { console.log('\n[dry-run] catalog-auto.js ani DB se neměnily.'); return { toAdd, relabels, held }; }

  // APPLY — razítko data se doplní až zde (Date není v dry-run determinismu potřeba)
  const stamp = new Date().toISOString().slice(0, 10);
  const merged = [...VEHICLE_CATALOG_AUTO, ...toAdd.map((e) => ({ ...e, added: stamp }))];
  writeFileSync(AUTO_FILE, renderAutoFile(merged));
  // build-gate: rozbitý zápis se nesmí dostat dál
  try { execSync('npm --prefix web run build', { cwd: new URL('../../', import.meta.url).pathname.replace(/^\//, ''), stdio: 'pipe' }); }
  catch (e) { console.error('BUILD SELHAL — vracím catalog-auto.js zpět.'); writeFileSync(AUTO_FILE, renderAutoFile(VEHICLE_CATALOG_AUTO)); process.exit(1); }
  // přeštítkování případů
  const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  let rel = 0;
  for (const r of relabels) for (const id of r.ids) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/gearbrain_cases?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: H, body: JSON.stringify({ vehicle_brand: r.brand, vehicle_model: r.label }) });
    if (res.ok) rel++;
  }
  console.log(`\n[apply] catalog-auto.js +${toAdd.length}, build OK, přeštítkováno ${rel} případů. (Push = Fáze 3.)`);
  return { toAdd, relabels, held, relabeled: rel };
}

function renderAutoFile(entries) {
  const head = readFileSync(AUTO_FILE, 'utf8').split('export const VEHICLE_CATALOG_AUTO')[0];
  return `${head}export const VEHICLE_CATALOG_AUTO = ${JSON.stringify(entries, null, 2)};\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const limArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limArg ? Number(limArg.split('=')[1]) : Infinity;
  run({ dryRun: !process.argv.includes('--apply'), limit }).catch((e) => { console.error(e); process.exit(1); });
}
