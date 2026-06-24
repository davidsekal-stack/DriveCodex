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

// Deterministická pojistka proti záměně generace: pokud kandidát obsahuje
// chassis-kód (B8, E39, E92, W202, 6L…) a ověřený label ho NEMÁ, jde o konflikt
// generace → podržet (nepřeznačovat reálné případy na jinou generaci).
const GEN_TOKEN_RE = /\b(?:[ef]\d{2,3}|w\d{3}|b[3-9]|c[4-8]|\d[a-z])\b/gi;
export function genConflict(candidateModel, label) {
  const labN = norm(label);
  const toks = norm(candidateModel).match(GEN_TOKEN_RE) || [];
  return toks.find((t) => !labN.includes(t)) || null;
}

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
    model: c.models.filter(Boolean).sort((a, b) => a.length - b.length)[0] || c.models[0], // nejkratší = čistý základ (ne trim)
    examples: [...new Set(c.models)].slice(0, 6),     // varianty z případů (disambiguace generace + trimů)
    engine: c.engines.find(Boolean) || '',            // motor z případů (disambiguace generace)
    family: c.family,
    caseIds: c.caseIds,
  }));
}

export async function run({ dryRun = true, limit = Infinity } = {}) {
  const gaps = JSON.parse(readFileSync(GAPS, 'utf8'));
  const modelById = new Map(gaps.map((g) => [g.id, g.model]));
  const existing = buildExisting();
  const cands = candidates(gaps).slice(0, limit);
  console.log(`kandidátů (značka×rodina): ${cands.length} (z ${gaps.length} mezerových případů)`);

  const toAdd = [];     // catalog-auto položky
  const relabels = [];  // {ids, label}
  const held = [];
  let genHeld = 0;      // cases podržené per-case kvůli generačnímu konfliktu
  for (const c of cands) {
    await new Promise((r) => setTimeout(r, 1200)); // pacing — méně bušení do API
    const v = await verifyVehicle({ brand: c.brand, model: c.model, market: c.market, engine: c.engine, examples: c.examples });
    if (!v.confirmed) { held.push({ ...c, reason: v.reason }); console.log(`  ⏸ ${c.brand} / ${c.model} — ${v.reason}`); continue; }
    const conflict = genConflict(c.model, v.model_label || '');
    if (conflict) { held.push({ ...c, reason: `gen conflict (label nemá '${conflict}')` }); console.log(`  ⏸ ${c.brand} / ${c.model} — generační konflikt: "${v.model_label}" nemá "${conflict}"`); continue; }
    const label = v.model_label || c.model;
    // per-case pojistka: přeštítkuj jen cases, jejichž vlastní model NEní v
    // generačním konfliktu s labelem (rodina může mít víc generací, např. S4 C4+B8).
    const eligible = c.caseIds.filter((id) => !genConflict(modelById.get(id) || '', label));
    const genHeldN = c.caseIds.length - eligible.length;
    if (genHeldN) genHeld += genHeldN;
    relabels.push({ ids: eligible, label, brand: c.brand });
    const suffix = genHeldN ? ` (${genHeldN} podrženo: jiná generace)` : '';
    if (existing.labels.has(norm(label))) {
      console.log(`  ✓ ${c.brand} / ${c.model} → "${label}" (label v katalogu — přeštítkovat ${eligible.length}${suffix})`);
    } else {
      toAdd.push({ brand: c.brand, market: c.market, added: null, sources: v.independentDomains, model: { label, powers: v.powers || [] } });
      console.log(`  ✅ ${c.brand} / ${c.model} → PŘIDAT "${label}" [${(v.powers || []).length} motorů, zdroje: ${v.independentDomains.join(', ')}] + přeštítkovat ${eligible.length}${suffix}`);
    }
  }

  console.log(`\n— souhrn — přidat: ${toAdd.length} | přeštítkovat: ${relabels.reduce((s, r) => s + r.ids.length, 0)} případů | gen-konflikt podržen: ${genHeld} | nepotvrzeno: ${held.length}`);
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

/**
 * Aplikuje JIŽ OVĚŘENÝ plán (logs/catalog-proposals/auto-add-plan.json) bez
 * opakované verifikace: zapíše catalog-auto.js (build-gate), přeštítkuje
 * per-case gen-konzistentní případy (záloha pro revert). Žádný push.
 */
export async function runFromPlan({ fetchImpl = fetch } = {}) {
  const plan = JSON.parse(readFileSync(new URL('./catalog-proposals/auto-add-plan.json', LOG_DIR), 'utf8'));
  const gaps = JSON.parse(readFileSync(GAPS, 'utf8'));
  const modelById = new Map(gaps.map((g) => [g.id, g.model]));
  const stamp = new Date().toISOString().slice(0, 10);

  // 1) zápis catalog-auto.js + build-gate (rozbitý zápis se nesmí dostat dál)
  const merged = [...VEHICLE_CATALOG_AUTO, ...plan.toAdd.map((e) => ({ ...e, added: stamp }))];
  writeFileSync(AUTO_FILE, renderAutoFile(merged));
  try {
    execSync('npm --prefix web run build', { stdio: 'pipe' });
  } catch {
    console.error('BUILD SELHAL — vracím catalog-auto.js zpět.');
    writeFileSync(AUTO_FILE, renderAutoFile(VEHICLE_CATALOG_AUTO));
    process.exit(1);
  }
  console.log(`catalog-auto.js +${plan.toAdd.length} položek (build OK).`);

  // 2) per-case přeštítkování (gen pojistka) + záloha
  const ops = [];
  for (const r of plan.relabels) for (const id of r.ids) {
    if (genConflict(modelById.get(id) || '', r.label)) continue; // jiná generace → nepřeštítkovat
    ops.push({ id, brand: r.brand, label: r.label });
  }
  const totalIds = plan.relabels.reduce((s, r) => s + r.ids.length, 0);
  const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
  const backup = [];
  for (let i = 0; i < ops.length; i += 80) {
    const chunk = ops.slice(i, i + 80).map((o) => o.id);
    const res = await fetchImpl(`${SUPABASE_URL}/rest/v1/gearbrain_cases?id=in.(${chunk.join(',')})&select=id,vehicle_brand,vehicle_model`, { headers: H });
    backup.push(...await res.json());
  }
  writeFileSync(new URL('./auto-relabel-backup.json', LOG_DIR), JSON.stringify(backup));
  let rel = 0;
  for (const o of ops) {
    const res = await fetchImpl(`${SUPABASE_URL}/rest/v1/gearbrain_cases?id=eq.${encodeURIComponent(o.id)}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ vehicle_brand: o.brand, vehicle_model: o.label }) });
    if (res.ok) rel++;
  }
  console.log(`přeštítkováno ${rel}/${ops.length} případů (gen-konflikt podržen: ${totalIds - ops.length}). Záloha: logs/auto-relabel-backup.json. Žádný push.`);
  return { added: plan.toAdd.length, relabeled: rel, genHeld: totalIds - ops.length };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--from-plan')) {
    runFromPlan().catch((e) => { console.error(e); process.exit(1); });
  } else {
    const limArg = process.argv.find((a) => a.startsWith('--limit='));
    const limit = limArg ? Number(limArg.split('=')[1]) : Infinity;
    run({ dryRun: !process.argv.includes('--apply'), limit }).catch((e) => { console.error(e); process.exit(1); });
  }
}
