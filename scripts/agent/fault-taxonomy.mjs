/**
 * fault-taxonomy.mjs — Číselník závad: seed taxonomie + backfill klasifikace
 * případů v gearbrain_cases (canonical_fault_id, vehicle_generation).
 *
 * Podklad pro panel „Známé závady tohoto vozu" (migrace 021, edge fn
 * known-faults). Resumovatelné z principu: NULL canonical_fault_id = fronta.
 *
 * Usage:
 *   node --env-file=scripts/agent/.env.local scripts/agent/fault-taxonomy.mjs --seed [--sample 500] [--dry-run] [--force]
 *   node --env-file=scripts/agent/.env.local scripts/agent/fault-taxonomy.mjs --classify [--batch 25] [--max N] [--dry-run]
 *   node --env-file=scripts/agent/.env.local scripts/agent/fault-taxonomy.mjs --stats
 *
 * Při vyčerpání LLM kvóty končí exit kódem 75 (stejný kontrakt jako
 * orchestrator.mjs) — další běh naváže tam, kde tento skončil.
 */

import { pathToFileURL } from 'node:url';
import { runLlm } from './llm.mjs';
import { isStoppingError, formatQuotaMessage } from './quota.mjs';
import { VEHICLE_CATALOG } from '../../web/src/constants/catalog.js';
import { VEHICLE_CATALOG_US } from '../../web/src/constants/catalog-us.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nmvjthfezyjcwuzphiuu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEED_MIN = 55;
const SEED_MAX = 180;
const CATEGORIES = [
  'engine', 'fuel', 'turbo', 'exhaust', 'cooling', 'electrical', 'sensors',
  'transmission', 'clutch', 'brakes', 'suspension', 'steering', 'body',
  'hvac', 'other',
];
const OTHER_ENTRY = {
  id: 'other',
  label_cs: 'Jiná závada',
  label_en: 'Other fault',
  label_de: 'Sonstiger Defekt',
  category: 'other',
};

// ---------------------------------------------------------------------------
// Normalizace modelu — JS zrcadlo SQL funkcí z migrace 021 (musí zůstat
// v souladu: normalize_model_family / extract_model_gen / extract_model_year)
// ---------------------------------------------------------------------------

const DIACRITICS = {
  'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a', 'å': 'a',
  'č': 'c', 'ç': 'c', 'ć': 'c', 'ď': 'd',
  'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'ě': 'e',
  'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
  'ň': 'n', 'ñ': 'n',
  'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o', 'ø': 'o',
  'ř': 'r', 'š': 's', 'ś': 's', 'ť': 't',
  'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u', 'ů': 'u',
  'ý': 'y', 'ž': 'z', 'ź': 'z',
};
const ROMAN = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10' };

function modelTokens(model) {
  let s = (model || '').toLowerCase();
  s = s.replace(/[^\x00-\x7F]/g, ch => DIACRITICS[ch] ?? ' ');
  s = s.replace(/\(.*?\)/g, ' ');
  s = s.replace(/[^a-z0-9]+/g, ' ').trim();
  return s ? s.split(' ') : [];
}

function isGenToken(tok, isFirst) {
  if (tok === 'fl' || tok === 'facelift') return true;
  if (/^(mk|mark)[0-9ivxl]*$/.test(tok)) return true;
  if (isFirst) return false;
  // Rok je generační token jen jako NE-první (Peugeot 2008 jako první token = model).
  return /^(19|20)\d{2}$/.test(tok)
    || /^[ivxl]{1,4}$/.test(tok)
    || /^[a-z]$/.test(tok)
    || /^[a-z]{1,2}[0-9]{1,3}[a-z]?$/.test(tok)
    || /^[0-9]{1,2}[a-z]{1,2}$/.test(tok);
}

/**
 * Rozloží model string na { family, gen, year } — stejné identity jako
 * generované sloupce model_base / model_gen / model_year v Supabase.
 */
export function splitModel(model) {
  const toks = modelTokens(model);
  const fam = [];
  let gen = null;
  let prev = '';
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    if (isGenToken(tok, fam.length === 0)) {
      if (/^(19|20)\d{2}$/.test(tok) || tok === 'fl' || tok === 'facelift') break;
      if (tok === 'mk' || tok === 'mark') {
        const nxt = toks[i + 1];
        gen = nxt && ROMAN[nxt] ? 'mk' + ROMAN[nxt] : null;
      } else if (/^(mk|mark)[ivxl]+$/.test(tok)) {
        // Neplatná římská číslice → null (shodně se SQL 'mk' || NULL = NULL)
        const r = ROMAN[tok.replace(/^(mk|mark)/, '')];
        gen = r ? 'mk' + r : null;
      } else if (/^mark[0-9]+$/.test(tok)) {
        gen = 'mk' + tok.replace(/^mark/, '');
      } else if (/^[ivxl]{1,4}$/.test(tok) && ROMAN[tok]) {
        gen = ROMAN[tok];
      } else {
        gen = tok;
      }
      break;
    }
    if (tok !== prev) {
      fam.push(tok);
      prev = tok;
    }
  }
  const yearMatch = (model || '').match(/\([^0-9)]*((19|20)\d{2})/);
  return {
    family: fam.join(' ') || null,
    gen,
    year: yearMatch ? yearMatch[1] : null,
  };
}

// ---------------------------------------------------------------------------
// Katalog → nabídky generací pro LLM inference
// ---------------------------------------------------------------------------

/**
 * Mapa `${brand}|${family}` → [{ value, label, powers }] z webového katalogu.
 * value = generační identita (token, jinak počáteční rok) — stejný prostor
 * hodnot jako sloupce model_gen/model_year, takže ji lze uložit do
 * vehicle_generation a SQL ji správně spáruje.
 */
export function buildCatalogGenerations(catalogs = [VEHICLE_CATALOG, VEHICLE_CATALOG_US]) {
  const map = new Map();
  for (const catalog of catalogs) {
    for (const entry of catalog) {
      for (const m of entry.models ?? []) {
        if (!m.label) continue;
        const { family, gen, year } = splitModel(m.label);
        const value = gen ?? year;
        if (!family || !value) continue;
        const key = `${entry.brand}|${family}`;
        if (!map.has(key)) map.set(key, []);
        const list = map.get(key);
        if (list.some(g => g.value === value)) continue;
        list.push({
          value,
          label: m.label,
          powers: (m.powers ?? []).slice(0, 8).join(', '),
        });
      }
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Seed: návrh taxonomie z vzorku resolutions
// ---------------------------------------------------------------------------

export function buildSeedPrompt(samplesByBrand) {
  const blocks = Object.entries(samplesByBrand)
    .map(([brand, list]) => `${brand}:\n${list.map(r => `- ${r}`).join('\n')}`)
    .join('\n\n');

  return `You are designing a canonical fault taxonomy for an automotive diagnostic database of confirmed repair cases (mixed EU and US vehicles, all fuel types incl. diesel DPF/EGR/AdBlue and EV).

Below are real confirmed-repair resolution texts sampled from the database, grouped by vehicle brand. Design a taxonomy of 70-90 canonical fault entries that covers these resolutions AND standard automotive failure modes. Entries must describe the ROOT CAUSE component/failure (e.g. "EGR valve clogged or faulty"), not symptoms.

Rules:
- Return ONLY a compact minified JSON array on a single line — no markdown code fences, no newlines, no indentation, no other text. (The full array MUST fit in the output; compactness is essential.)
- Each entry: {"id":"<slug>","label_cs":"<Czech label>","label_en":"<English label>","label_de":"<German label>","category":"<one of: ${CATEGORIES.join(', ')}>"}
- id: lowercase kebab-case slug, max 60 chars, stable and descriptive (e.g. "egr-valve-failure", "dual-mass-flywheel-worn", "dpf-clogged").
- Labels: short noun phrases a mechanic instantly understands, max 80 chars, properly localized (not machine-transliterated).
- Granularity: one entry per distinct root cause a mechanic would act on. Do not split hairs (no per-cylinder variants), do not lump whole systems into one entry.
- Do NOT include a generic catch-all entry; "other" is added automatically by the caller.
- 70-90 entries total. Do NOT exceed 90 — a complete array that fits matters more than coverage.

SAMPLED RESOLUTIONS:
${blocks}`;
}

export function parseSeedResponse(raw) {
  const text = (raw || '').trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end <= start) return { entries: null, error: 'No JSON array in response' };

  let parsed;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch (err) {
    return { entries: null, error: `JSON parse failed: ${err.message}` };
  }
  if (!Array.isArray(parsed)) return { entries: null, error: 'Response is not an array' };

  const seen = new Set();
  const entries = [];
  for (const e of parsed) {
    if (!e || typeof e !== 'object') continue;
    const id = typeof e.id === 'string' ? e.id.trim() : '';
    if (!SLUG_RE.test(id) || id.length > 60 || id === 'other' || seen.has(id)) continue;
    const labels = [e.label_cs, e.label_en, e.label_de];
    if (!labels.every(l => typeof l === 'string' && l.trim() && l.length <= 80)) continue;
    seen.add(id);
    entries.push({
      id,
      label_cs: e.label_cs.trim(),
      label_en: e.label_en.trim(),
      label_de: e.label_de.trim(),
      category: CATEGORIES.includes(e.category) ? e.category : 'other',
    });
  }

  if (entries.length < SEED_MIN || entries.length > SEED_MAX) {
    return { entries: null, error: `Got ${entries.length} valid entries, expected ${SEED_MIN}-${SEED_MAX}` };
  }
  return { entries, error: null };
}

// ---------------------------------------------------------------------------
// Classify: dávková klasifikace případů
// ---------------------------------------------------------------------------

function truncate(s, n) {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

/**
 * @param {Array<{id,label_en,category}>} taxonomy
 * @param {Array} items - případy obohacené o needsGen/genOptions (viz prepareBatchItems)
 */
export function buildClassifyPrompt(taxonomy, items) {
  const taxLines = taxonomy
    .filter(t => t.id !== 'other')
    .map(t => `${t.id} — ${t.label_en}`)
    .join('\n');

  const caseBlocks = items.map((c, i) => {
    const lines = [
      `#${i + 1} id=${c.id}`,
      `vehicle: ${c.vehicle_brand ?? '?'} ${c.vehicle_model ?? '?'}${c.engine_power ? ` | engine: ${c.engine_power}` : ''}${c.mileage ? ` | mileage: ${c.mileage} km` : ''}${c.closed_at ? ` | closed: ${String(c.closed_at).slice(0, 4)}` : ''}`,
    ];
    if (c.symptoms?.length) lines.push(`symptoms: ${c.symptoms.slice(0, 6).join('; ')}`);
    if (c.obd_codes?.length) lines.push(`obd: ${c.obd_codes.slice(0, 8).join(', ')}`);
    if (c.description) lines.push(`problem: ${truncate(c.description, 200)}`);
    lines.push(`fix: ${truncate(c.resolution, 300)}`);
    if (c.needsGen && c.genOptions?.length) {
      lines.push(`GENERATION OPTIONS: ${c.genOptions.map(g => `value "${g.value}" = ${g.label}${g.powers ? ` [engines: ${truncate(g.powers, 110)}]` : ''}`).join(' | ')}`);
    }
    return lines.join('\n');
  }).join('\n\n');

  return `You are classifying confirmed automotive repair cases into a fixed fault taxonomy.
Return ONLY a JSON array, no other text. One object per case:
{"id":"<case id>","fault":"<taxonomy id or other>","generation":"<option value or null>"}

Rules:
- "fault": the single taxonomy id best matching the CONFIRMED ROOT CAUSE in the fix text (not the symptom). Use exactly one id from the taxonomy below, or "other" if nothing fits. Never invent ids.
- "generation": only for cases that list GENERATION OPTIONS — pick the option value matching the vehicle using its engine, mileage, dates and text; use null when uncertain. For cases without options always use null.

TAXONOMY:
${taxLines}

CASES:
${caseBlocks}`;
}

export function parseClassifyResponse(raw, items, slugSet) {
  const text = (raw || '').trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end <= start) return [];

  let parsed;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const byId = new Map(items.map(c => [c.id, c]));
  const out = [];
  const used = new Set();
  for (const e of parsed) {
    if (!e || typeof e !== 'object') continue;
    const item = byId.get(e.id);
    if (!item || used.has(e.id)) continue;
    const fault = typeof e.fault === 'string' && (slugSet.has(e.fault) || e.fault === 'other') ? e.fault : null;
    if (!fault) continue;
    let generation = null;
    if (item.needsGen && typeof e.generation === 'string') {
      const g = e.generation.trim().toLowerCase();
      if (item.genOptions?.some(o => o.value === g)) generation = g;
    }
    used.add(e.id);
    out.push({ id: e.id, fault, generation });
  }
  return out;
}

/** Obohatí řádky z DB o needsGen/genOptions podle katalogu. */
export function prepareBatchItems(rows, catalogGens) {
  return rows.map(row => {
    const { family, gen, year } = splitModel(row.vehicle_model);
    const needsGen = !gen && !year && !row.vehicle_generation;
    const genOptions = needsGen && family
      ? (catalogGens.get(`${row.vehicle_brand}|${family}`) ?? [])
      : [];
    return { ...row, needsGen: needsGen && genOptions.length > 0, genOptions };
  });
}

// ---------------------------------------------------------------------------
// Supabase REST helpery
// ---------------------------------------------------------------------------

function restHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    ...extra,
  };
}

async function restGet(path, fetchImpl) {
  const res = await fetchImpl(`${SUPABASE_URL}/rest/v1/${path}`, { headers: restHeaders() });
  if (!res.ok) throw new Error(`Supabase GET ${path} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function fetchAllApproved(select, fetchImpl) {
  const all = [];
  for (let offset = 0; ; offset += 1000) {
    const batch = await restGet(
      `gearbrain_cases?select=${select}&status=eq.approved&order=created_at.asc&limit=1000&offset=${offset}`,
      fetchImpl,
    );
    all.push(...batch);
    if (batch.length < 1000) break;
  }
  return all;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Běhy
// ---------------------------------------------------------------------------

export async function runSeed({ llm = runLlm, fetchImpl = fetch, sample = 500, dryRun = false, force = false } = {}) {
  const existing = await restGet('gearbrain_fault_taxonomy?select=id&limit=1', fetchImpl);
  if (existing.length > 0 && !force) {
    console.error('Taxonomie už není prázdná — opakovaný seed by vytvořil duplicitní slugy. Použij --force, pokud to opravdu chceš.');
    return { ok: false };
  }

  console.log('Stahuji vzorek resolutions…');
  const rows = await fetchAllApproved('vehicle_brand,resolution', fetchImpl);
  const byBrand = {};
  for (const r of rows) {
    const b = r.vehicle_brand || '?';
    (byBrand[b] ??= []).push(r.resolution);
  }
  const samples = {};
  let total = 0;
  // Max 3 vzorky na značku: ~150 reprezentativních oprav napříč značkami stačí
  // (model čerpá i z obecných znalostí) a výstup se bezpečně vejde do limitu.
  const PER_BRAND = 3;
  for (const [brand, list] of Object.entries(byBrand)) {
    const take = Math.min(PER_BRAND, list.length);
    const step = list.length / take;
    samples[brand] = Array.from({ length: take }, (_, i) => truncate(list[Math.floor(i * step)], 220));
    total += take;
  }
  // Ořež na cílový počet, ale nech každé značce min. 5. Když už nelze ubrat
  // (sample < 5 × počet značek), zastav — jinak by smyčka běžela donekonečna.
  let progressed = true;
  while (total > sample && progressed) {
    progressed = false;
    for (const brand of Object.keys(samples)) {
      if (total <= sample) break;
      if (samples[brand].length > 5) { samples[brand].pop(); total--; progressed = true; }
    }
  }
  console.log(`Vzorek: ${total} resolutions z ${Object.keys(samples).length} značek. Volám LLM (taxonomy-seed)…`);

  const raw = await llm('taxonomy-seed', buildSeedPrompt(samples), { maxTokens: 8000, timeoutMs: 150_000 });
  const { entries, error } = parseSeedResponse(raw);
  if (!entries) {
    console.error(`Seed selhal: ${error}`);
    return { ok: false };
  }
  entries.push(OTHER_ENTRY);
  console.log(`Navrženo ${entries.length} položek (včetně 'other').`);

  if (dryRun) {
    for (const e of entries) console.log(`  ${e.id}  [${e.category}]  cs="${e.label_cs}" en="${e.label_en}" de="${e.label_de}"`);
    console.log('[dry-run] Nic se nezapsalo.');
    return { ok: true, entries };
  }

  const res = await fetchImpl(`${SUPABASE_URL}/rest/v1/gearbrain_fault_taxonomy?on_conflict=id`, {
    method: 'POST',
    headers: restHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(entries),
  });
  if (!res.ok) {
    console.error(`Upsert taxonomie selhal (${res.status}): ${(await res.text()).slice(0, 300)}`);
    return { ok: false };
  }
  console.log(`✓ Taxonomie uložena (${entries.length} položek).`);
  return { ok: true, entries };
}

export async function runClassify({ llm = runLlm, fetchImpl = fetch, batchSize = 25, max = Infinity, dryRun = false } = {}) {
  const taxonomy = await restGet('gearbrain_fault_taxonomy?select=id,label_en,category&order=id.asc&limit=1000', fetchImpl);
  if (taxonomy.length === 0) {
    console.error('Taxonomie je prázdná — nejdřív spusť --seed.');
    return { ok: false };
  }
  const slugSet = new Set(taxonomy.map(t => t.id));
  const catalogGens = buildCatalogGenerations();

  let processed = 0;
  let classified = 0;
  let failedSoFar = 0;

  for (;;) {
    if (processed >= max) break;
    const limit = Math.min(batchSize, max - processed);
    const rows = await restGet(
      `gearbrain_cases?select=id,vehicle_brand,vehicle_model,vehicle_generation,engine_power,mileage,closed_at,symptoms,obd_codes,description,resolution&status=eq.approved&canonical_fault_id=is.null&order=created_at.asc,id.asc&limit=${limit}&offset=${failedSoFar}`,
      fetchImpl,
    );
    if (rows.length === 0) break;

    const items = prepareBatchItems(rows, catalogGens);
    const raw = await llm('taxonomy-classify', buildClassifyPrompt(taxonomy, items), { maxTokens: 3000, timeoutMs: 300_000 });
    const verdicts = parseClassifyResponse(raw, items, slugSet);
    const byId = new Map(verdicts.map(v => [v.id, v]));

    let patched = 0;
    for (const item of items) {
      const v = byId.get(item.id);
      processed++;
      if (!v) {
        console.log(`  ✗ ${item.id.slice(0, 8)} ${item.vehicle_brand} ${truncate(item.vehicle_model, 30)} — bez verdiktu, zůstává NULL`);
        continue;
      }
      const patch = { canonical_fault_id: v.fault };
      if (v.generation) patch.vehicle_generation = v.generation;
      if (dryRun) {
        console.log(`  [dry-run] ${item.id.slice(0, 8)} ${item.vehicle_brand} ${truncate(item.vehicle_model, 30)} → ${v.fault}${v.generation ? ` (gen ${v.generation})` : ''}`);
        patched++;
        continue;
      }
      const res = await fetchImpl(`${SUPABASE_URL}/rest/v1/gearbrain_cases?id=eq.${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: restHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        patched++;
        classified++;
      } else {
        console.log(`  ✗ PATCH ${item.id.slice(0, 8)} selhal (${res.status}): ${(await res.text()).slice(0, 150)}`);
      }
    }

    if (dryRun) {
      console.log(`[dry-run] Dávka hotova (${patched}/${items.length}), končím po první dávce.`);
      break;
    }
    failedSoFar += items.length - patched;
    console.log(`Dávka: ${patched}/${items.length} klasifikováno (celkem ${classified}, přeskočeno ${failedSoFar}).`);
    await sleep(300);
  }

  console.log(`\nHotovo: zpracováno ${processed}, klasifikováno ${classified}, bez verdiktu ${failedSoFar}.`);
  return { ok: true, processed, classified };
}

export async function runStats({ fetchImpl = fetch } = {}) {
  const rows = await fetchAllApproved('canonical_fault_id,model_gen,model_year,vehicle_generation', fetchImpl);
  const total = rows.length;
  const classified = rows.filter(r => r.canonical_fault_id != null).length;
  const other = rows.filter(r => r.canonical_fault_id === 'other').length;
  const genKnown = rows.filter(r => r.model_gen || r.model_year || r.vehicle_generation).length;

  console.log(`Approved případů:      ${total}`);
  console.log(`Klasifikováno:         ${classified} (${(100 * classified / Math.max(total, 1)).toFixed(1)} %)`);
  console.log(`  z toho 'other':      ${other}`);
  console.log(`Zbývá (NULL):          ${total - classified}`);
  console.log(`Generace určena:       ${genKnown} (${(100 * genKnown / Math.max(total, 1)).toFixed(1)} %)`);

  const bySlug = {};
  for (const r of rows) {
    if (r.canonical_fault_id) bySlug[r.canonical_fault_id] = (bySlug[r.canonical_fault_id] || 0) + 1;
  }
  console.log('\nTop 20 závad:');
  for (const [slug, n] of Object.entries(bySlug).sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${String(n).padStart(5)}  ${slug}`);
  }
  return { total, classified, other };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function argValue(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1 || i === process.argv.length - 1) return fallback;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) ? n : fallback;
}

async function main() {
  if (!SUPABASE_KEY) {
    console.error('ERROR: SUPABASE_SERVICE_KEY není nastaven (spusť s --env-file=scripts/agent/.env.local).');
    process.exit(1);
  }
  const dryRun = process.argv.includes('--dry-run');

  try {
    if (process.argv.includes('--seed')) {
      const r = await runSeed({ sample: argValue('--sample', 500), dryRun, force: process.argv.includes('--force') });
      process.exit(r.ok ? 0 : 1);
    } else if (process.argv.includes('--classify')) {
      const r = await runClassify({ batchSize: argValue('--batch', 25), max: argValue('--max', Infinity), dryRun });
      process.exit(r.ok ? 0 : 1);
    } else if (process.argv.includes('--stats')) {
      await runStats();
      process.exit(0);
    } else {
      console.log('Usage: fault-taxonomy.mjs --seed [--sample N] [--dry-run] [--force] | --classify [--batch N] [--max N] [--dry-run] | --stats');
      process.exit(1);
    }
  } catch (err) {
    if (isStoppingError(err)) {
      console.log(formatQuotaMessage(err));
      process.exit(75);
    }
    throw err;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
