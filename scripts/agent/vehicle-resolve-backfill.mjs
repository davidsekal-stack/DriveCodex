/**
 * vehicle-resolve-backfill.mjs — jednorázová DETERMINISTICKÁ kanonizace ZNAČKY
 * u stávajících approved případů (casing/diakritika/alias proti katalogu), aby
 * byly v appce dohledatelné (viz vehicle-resolver.mjs).
 *
 * Model-level mezery (chassis-kódy E39, varianty S4, EV verze e-208, klasiky) se
 * ZÁMĚRNĚ NEremapují — nacpání do základního modelu by zhoršilo přesnost dat
 * (rozhodnutí majitele 2026-06: e-208 je EV, S4 jiný motor atd.). Tyto případy
 * odcházejí do Fáze 2 jako návrhy na DOPLNĚNÍ katalogu, kde si každý model udrží
 * svou identitu.
 *
 * Zápisy jsou VRATNÉ (záloha originálů). Default dry-run; --apply zapisuje.
 *
 * Usage:
 *   node --env-file=scripts/agent/.env.local scripts/agent/vehicle-resolve-backfill.mjs            # dry-run
 *   node --env-file=scripts/agent/.env.local scripts/agent/vehicle-resolve-backfill.mjs --apply
 */
import { pathToFileURL } from 'node:url';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { buildCatalogIndex, resolveVehicle, familyToken } from './vehicle-resolver.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nmvjthfezyjcwuzphiuu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const LOG_DIR = new URL('./logs/', import.meta.url);
const PROPOSAL_DIR = new URL('./logs/catalog-proposals/', import.meta.url);

function headers(extra = {}) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...extra };
}

export async function runResolve({ fetchImpl = fetch, dryRun = true } = {}) {
  const index = buildCatalogIndex();

  let rows = [], offset = 0;
  for (;;) {
    const r = await fetchImpl(`${SUPABASE_URL}/rest/v1/gearbrain_cases?select=id,vehicle_brand,vehicle_model,engine_power&status=eq.approved&limit=1000&offset=${offset}`, { headers: headers() });
    const page = await r.json(); rows = rows.concat(page);
    if (page.length < 1000) break; offset += 1000;
  }

  const recases = [];   // {id, vehicle_brand, _from} — jen kanonizace zápisu značky
  const gaps = [];      // model-level → Fáze 2 (žádný auto-remap)
  for (const c of rows) {
    const r = resolveVehicle({ vehicle_brand: c.vehicle_brand, vehicle_model: c.vehicle_model }, index);
    if (!r.matched || !r.brandActive) continue;           // chybějící/neaktivní značka — mimo záběr
    if (r.modelInCatalog) {
      if (r.brandChanged) recases.push({ id: c.id, vehicle_brand: r.canonicalBrand, _from: c.vehicle_brand });
      continue;                                           // model OK → dohledatelné
    }
    gaps.push({ brand: r.canonicalBrand, model: c.vehicle_model, family: familyToken(c.vehicle_model), engine: c.engine_power || '', id: c.id });
  }

  console.log(`approved: ${rows.length}`);
  console.log(`brand-recase (deterministicky, k zápisu): ${recases.length}`);
  console.log(`model-level mezery (→ Fáze 2): ${gaps.length}`);
  console.log('\n— recase (z → na) —');
  for (const w of recases) console.log(`  ${w._from} → ${w.vehicle_brand}  (${w.id.slice(0, 8)})`);
  const gapAgg = {};
  for (const g of gaps) { const k = `${g.brand} | ${g.family || g.model}`; gapAgg[k] = (gapAgg[k] || 0) + 1; }
  console.log('\n— model mezery pro Fázi 2 (značka | rodina × počet) —');
  for (const [k, n] of Object.entries(gapAgg).sort((a, b) => b[1] - a[1])) console.log(`  ${n}×  ${k}`);

  // Mezery vždy ulož lokálně (vstup pro Fázi 2) — není to produkční zápis.
  if (!existsSync(PROPOSAL_DIR)) mkdirSync(PROPOSAL_DIR, { recursive: true });
  writeFileSync(new URL('./gaps.json', PROPOSAL_DIR), JSON.stringify(gaps, null, 2));
  console.log(`\n(uloženo logs/catalog-proposals/gaps.json: ${gaps.length} případů)`);

  if (dryRun) { console.log('[dry-run] do DB nic nezapsáno.'); return { recases, gaps }; }

  // APPLY: záloha + PATCH jen recases
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
  const ids = recases.map(w => w.id);
  const backup = [];
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const r = await fetchImpl(`${SUPABASE_URL}/rest/v1/gearbrain_cases?id=in.(${chunk.join(',')})&select=id,vehicle_brand,vehicle_model`, { headers: headers() });
    backup.push(...await r.json());
  }
  writeFileSync(new URL('./vehicle-recase-backup.json', LOG_DIR), JSON.stringify(backup));
  let ok = 0;
  for (const w of recases) {
    const r = await fetchImpl(`${SUPABASE_URL}/rest/v1/gearbrain_cases?id=eq.${encodeURIComponent(w.id)}`, {
      method: 'PATCH', headers: headers({ Prefer: 'return=minimal' }), body: JSON.stringify({ vehicle_brand: w.vehicle_brand }),
    });
    if (r.ok) ok++; else console.error('PATCH selhal', w.id, r.status);
  }
  console.log(`\n[apply] zapsáno ${ok}/${recases.length} recase, záloha v logs/vehicle-recase-backup.json.`);
  return { recases, gaps, written: ok };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dryRun = !process.argv.includes('--apply');
  runResolve({ dryRun }).catch(e => { console.error(e); process.exit(1); });
}
