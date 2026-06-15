/**
 * backfill-resolution-i18n.mjs — doplnění lokalizovaných textů oprav
 * (gearbrain_cases.resolution_cs / resolution_de / resolution_lang) u už
 * uložených případů. Podklad pro panel „Známé závady tohoto vozu" (migrace
 * 022), aby se text opravy zobrazoval v jazyce aplikace, ne jen anglicky.
 *
 * Překlad jede ZÁMĚRNĚ přes Claude (router llm.mjs, task `translate` →
 * claude:haiku, předplatné), ne přes DeepSeek — na rozdíl od edge fn push-case,
 * která běží v cloudu a Claude tam nemá. Detekuje jazyk originálu a do
 * shodného jazyka nepřekládá (uloží původní text). Kanonický anglický
 * `resolution` se NIKDY nemění (RAG na něm závisí).
 *
 * Resumovatelné z principu: fronta = approved případy s resolution_lang IS NULL.
 * Při vyčerpání LLM kvóty končí exit kódem 75 (stejný kontrakt jako
 * orchestrator.mjs / fault-taxonomy.mjs) — další běh naváže.
 *
 * Usage:
 *   node --env-file=scripts/agent/.env.local scripts/agent/backfill-resolution-i18n.mjs [--batch 15] [--max N] [--dry-run]
 */

import { pathToFileURL } from 'node:url';
import { runLlm } from './llm.mjs';
import { isStoppingError, formatQuotaMessage } from './quota.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nmvjthfezyjcwuzphiuu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

const LANGS = new Set(['cs', 'en', 'de']);

// ---------------------------------------------------------------------------
// Čistá logika přiřazení (testovatelná) — sdílí sémantiku s push-case:
// do jazyka shodného s originálem se nepřekládá, uloží se původní text.
// Angličtina nemá vlastní sloupec (kanonickou EN verzí je `resolution`).
// ---------------------------------------------------------------------------

function clean(s) {
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '';
}

/**
 * @param {{ original: string, lang: string, cs: string, de: string }} v
 * @returns {{ resolution_cs: string|null, resolution_de: string|null, resolution_lang: string }}
 */
export function assignTranslations({ original, lang, cs, de }) {
  const orig = clean(original);
  const normLang = LANGS.has(String(lang).toLowerCase()) ? String(lang).toLowerCase() : 'other';
  let resCs = clean(cs);
  let resDe = clean(de);
  // Shodný jazyk → původní text (autentický, bez zpětného překladu).
  if (normLang === 'cs') resCs = orig;
  if (normLang === 'de') resDe = orig;
  return {
    resolution_cs: resCs || null,
    resolution_de: resDe || null,
    resolution_lang: normLang,
  };
}

// ---------------------------------------------------------------------------
// Prompt + parser
// ---------------------------------------------------------------------------

function truncate(s, n) {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

export function buildTranslatePrompt(items) {
  const blocks = items
    .map((c, i) => `#${i + 1} id=${c.id}\ntext: ${truncate(c.resolution, 400)}`)
    .join('\n\n');

  return `You localize confirmed automotive repair texts. For each case, detect the source language of "text" and produce Czech and German versions.
Return ONLY a JSON array, one object per case, no other text:
[{"id":"<case id>","lang":"cs|en|de|other","cs":"<Czech text>","de":"<German text>"}]

Rules:
- "lang": the source language of the original text.
- "cs": the text in Czech. If the source is already Czech, return it verbatim.
- "de": the text in German. If the source is already German, return it verbatim.
- Keep OBD codes (e.g. P0401), part numbers, and measurements unchanged.
- Preserve the technical meaning precisely; do not add or omit information. Keep it concise.

CASES:
${blocks}`;
}

export function parseTranslateResponse(raw, items) {
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
  const used = new Set();
  const out = [];
  for (const e of parsed) {
    if (!e || typeof e !== 'object') continue;
    const item = byId.get(e.id);
    if (!item || used.has(e.id)) continue;
    used.add(e.id);
    out.push({
      id: e.id,
      ...assignTranslations({ original: item.resolution, lang: e.lang, cs: e.cs, de: e.de }),
    });
  }
  return out;
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Běh
// ---------------------------------------------------------------------------

export async function runBackfill({ llm = runLlm, fetchImpl = fetch, batchSize = 15, max = Infinity, dryRun = false } = {}) {
  let processed = 0;
  let patchedTotal = 0;
  let failedSoFar = 0;

  for (;;) {
    if (processed >= max) break;
    const limit = Math.min(batchSize, max - processed);
    const rows = await restGet(
      `gearbrain_cases?select=id,resolution&status=eq.approved&resolution_lang=is.null&order=created_at.asc,id.asc&limit=${limit}&offset=${failedSoFar}`,
      fetchImpl,
    );
    if (rows.length === 0) break;

    const items = rows.filter(r => (r.resolution || '').trim().length > 0);
    // Prázdné/whitespace resolution (nemělo by existovat — push-case i agent
    // vynucují minimální délku) přeskoč a posuň kurzor ZA ně. Bez tohohle by
    // odfiltrovaný řádek zůstal v čele fronty (nikdy se nepatchne → drží
    // resolution_lang NULL) a smyčka by se na něm zacyklila a volala LLM
    // s prázdným promptem.
    if (items.length === 0) {
      failedSoFar += rows.length;
      continue;
    }
    const raw = await llm('translate', buildTranslatePrompt(items), { maxTokens: 4000, timeoutMs: 300_000 });
    const verdicts = parseTranslateResponse(raw, items);
    const byId = new Map(verdicts.map(v => [v.id, v]));

    let patched = 0;
    for (const item of items) {
      const v = byId.get(item.id);
      processed++;
      if (!v) {
        console.log(`  ✗ ${item.id.slice(0, 8)} — bez verdiktu, zůstává NULL`);
        continue;
      }
      const patch = {
        resolution_cs: v.resolution_cs,
        resolution_de: v.resolution_de,
        resolution_lang: v.resolution_lang,
      };
      if (dryRun) {
        console.log(`  [dry-run] ${item.id.slice(0, 8)} lang=${v.resolution_lang} cs="${truncate(v.resolution_cs, 50)}" de="${truncate(v.resolution_de, 50)}"`);
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
        patchedTotal++;
      } else {
        console.log(`  ✗ PATCH ${item.id.slice(0, 8)} selhal (${res.status}): ${(await res.text()).slice(0, 150)}`);
      }
    }

    if (dryRun) {
      console.log(`[dry-run] Dávka hotova (${patched}/${items.length}), končím po první dávce.`);
      break;
    }
    // Kurzor posuň o VŠECHNY řádky, které zůstaly ve frontě (odfiltrované
    // prázdné + bez verdiktu) — patchnuté řádky frontu opustí (resolution_lang
    // != NULL), takže se počítají jen ty zbylé. Jinak by se na nepatchnutém
    // řádku v čele okna smyčka zacyklila.
    failedSoFar += rows.length - patched;
    console.log(`Dávka: ${patched}/${items.length} přeloženo (celkem ${patchedTotal}, přeskočeno ${failedSoFar}).`);
    await sleep(300);
  }

  console.log(`\nHotovo: zpracováno ${processed}, přeloženo ${patchedTotal}, bez verdiktu ${failedSoFar}.`);
  return { ok: true, processed, patched: patchedTotal };
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
    const r = await runBackfill({ batchSize: argValue('--batch', 15), max: argValue('--max', Infinity), dryRun });
    process.exit(r.ok ? 0 : 1);
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
