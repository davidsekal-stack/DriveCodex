/**
 * discover.mjs — Live forum discovery (Phase 1).
 *
 * Finds automotive fault-discussion forums via Claude web search, triages them
 * cheaply in the same call, de-duplicates against the online registry + local
 * state, and queues the survivors as `discovered` forums. The existing
 * calibration phase then does the deep accessibility/structure analysis.
 *
 * Cost is bounded: only a few (brand × language) queries run per invocation,
 * rotated via an agent_meta cursor so coverage spreads over time instead of
 * re-querying the same brand. Discovery is biased to EU/CZ forums, which are
 * the real value-add (friendlier to read, and not covered by NHTSA).
 */

import { runLlm } from './llm.mjs';
import { fetchKnownDomains, upsertForum, forumDomain } from './forum-registry.mjs';

// EU-first brand list; the matrix is brand × language group.
export const DISCOVERY_BRANDS = [
  'Škoda', 'Volkswagen', 'Audi', 'BMW', 'Mercedes-Benz', 'Opel', 'Ford',
  'Peugeot', 'Citroën', 'Renault', 'Dacia', 'Fiat', 'SEAT', 'Toyota',
  'Hyundai', 'Kia', 'Nissan', 'Volvo', 'Mazda', 'Suzuki', 'Honda', 'Mitsubishi',
];

export const DISCOVERY_LANGUAGE_GROUPS = [
  { label: 'Czech/Slovak', codes: ['cs', 'sk'] },
  { label: 'German', codes: ['de'] },
  { label: 'Polish', codes: ['pl'] },
  { label: 'English (EU/UK)', codes: ['en'] },
];

const DISCOVER_TIMEOUT_MS = 300_000; // multi-turn web search is slow; match the CLI default
const DEFAULT_MAX_QUERIES = 2;   // queries per run (each is a web search → bounded cost)
const DEFAULT_MAX_ADD = 8;       // forums queued per run

export function buildDiscoveryPrompt(brand, languageGroup) {
  return `You are scouting the web for online forums where owners of ${brand} cars discuss and RESOLVE technical faults, in ${languageGroup.label} (language codes: ${languageGroup.codes.join(', ')}).

Use web search to find real, currently-active forums. A good target:
- is a discussion forum (phpBB / XenForo / Invision / WoltLab / vBulletin), NOT a shop, blog, news site, marketplace, or Facebook group
- has threads where users describe a fault and others/them confirm a fix
- is readable WITHOUT login/registration
- covers ${brand} (brand-specific or a multi-brand forum with a strong ${brand} section)

Return ONLY a JSON array (no prose). Each element:
{"root_url":"https://...","name":"forum name","brands":["${brand}"],"language":"cs|sk|de|pl|en|...","engine":"phpbb|xenforo|invision|woltlab|vbulletin|generic|unknown","public_readable":true,"why":"one short sentence of evidence"}

Rules:
- Only include forums you actually found via search with a real reachable URL.
- Prefer the forum ROOT or its main technical board URL, not a single thread.
- Omit anything behind a login wall, dead/archived, or non-automotive.
- Return [] if you find nothing solid. Maximum 6 entries.
- Your FINAL output must be the JSON array and nothing after it.`;
}

// Collect every balanced, string-aware top-level [...] span that parses as an
// array. Robust to surrounding prose, markdown fences, and stray brackets like
// "[3]" — we pick the candidate array (most object elements) afterwards.
function collectJsonArrays(text) {
  const arrays = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '[') continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) {
          try {
            const a = JSON.parse(text.slice(i, j + 1));
            if (Array.isArray(a)) arrays.push(a);
          } catch { /* not valid JSON, ignore */ }
          break;
        }
      }
    }
  }
  return arrays;
}

export function parseDiscoveryResponse(text) {
  const raw = (text ?? '').toString().trim();
  if (!raw) return [];

  const arrays = collectJsonArrays(raw);
  if (arrays.length === 0) return [];
  // The forum list is the array with the most object elements; "[3]" / "[1]"
  // footnotes have none and lose.
  const objectCount = a => a.filter(x => x && typeof x === 'object' && !Array.isArray(x)).length;
  const parsed = arrays.reduce((best, a) => (objectCount(a) > objectCount(best) ? a : best), arrays[0]);
  if (objectCount(parsed) === 0) return [];

  const out = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const root = (item.root_url || item.url || '').toString().trim();
    if (!/^https?:\/\//i.test(root)) continue;
    out.push({
      root_url: root,
      name: (item.name || '').toString().trim() || null,
      brands: Array.isArray(item.brands) ? item.brands.map(String) : [],
      language: (item.language || '').toString().trim() || null,
      engine: (item.engine || 'unknown').toString().trim().toLowerCase(),
      public_readable: item.public_readable === true,
      why: (item.why || '').toString().slice(0, 200),
    });
  }
  return out;
}

function nextCursor(state, total) {
  let cursor = 0;
  try { cursor = Number(state.getMeta?.('discover_cursor')) || 0; } catch { /* ignore */ }
  if (!Number.isFinite(cursor) || cursor < 0) cursor = 0;
  return cursor % Math.max(1, total);
}

/**
 * Run one discovery pass.
 *
 * @param {import('./state.mjs').AgentState} state
 * @param {object} [opts]
 * @param {number} [opts.maxQueries]
 * @param {number} [opts.maxAdd]
 * @param {Function} [opts.runLlmImpl] - injected for tests
 * @param {Function} [opts.fetchKnownDomainsImpl]
 * @param {Function} [opts.upsertForumImpl]
 * @param {Function} [opts.log]
 * @returns {Promise<{queries:number, found:number, added:number, skipped:number, registryOnline:boolean}>}
 */
export async function discoverCandidates(state, opts = {}) {
  const maxQueries = opts.maxQueries ?? DEFAULT_MAX_QUERIES;
  const maxAdd = opts.maxAdd ?? DEFAULT_MAX_ADD;
  const runLlmImpl = opts.runLlmImpl ?? ((task, prompt, o) => runLlm(task, prompt, o));
  const fetchKnown = opts.fetchKnownDomainsImpl ?? fetchKnownDomains;
  const upsert = opts.upsertForumImpl ?? upsertForum;
  const log = opts.log ?? (() => {});

  // Known domains: registry (cross-machine) ∪ local state.
  const registry = await fetchKnown({ env: opts.env });
  const known = new Set(registry.domains);
  try {
    for (const f of (state.getAllForums?.() ?? [])) {
      const d = forumDomain(f.url);
      if (d) known.add(d);
    }
  } catch { /* ignore */ }

  // Rotate the language × brand matrix so each run covers new ground.
  // Language-outer / brand-inner means consecutive queries hit DIFFERENT
  // brands (better spread) and the EU/CZ language group is front-loaded.
  const matrix = [];
  for (const group of DISCOVERY_LANGUAGE_GROUPS) {
    for (const brand of DISCOVERY_BRANDS) matrix.push({ brand, group });
  }
  const startCursor = nextCursor(state, matrix.length);

  let queries = 0;
  let found = 0;
  let added = 0;
  let skipped = 0;
  const addedThisRun = new Set();

  for (let i = 0; i < matrix.length && queries < maxQueries && added < maxAdd; i++) {
    const { brand, group } = matrix[(startCursor + i) % matrix.length];
    queries++;
    let candidates = [];
    try {
      const text = await runLlmImpl('discover', buildDiscoveryPrompt(brand, group), {
        allowedTools: ['WebSearch'],
        timeoutMs: opts.timeoutMs ?? DISCOVER_TIMEOUT_MS,
      });
      candidates = parseDiscoveryResponse(text);
    } catch (err) {
      if (err?.name === 'QuotaError' || err?.name === 'AuthError') throw err;
      log(`  discover ${brand}/${group.label} failed: ${err.message}`);
      continue;
    }

    found += candidates.length;
    for (const c of candidates) {
      if (added >= maxAdd) break;
      const domain = forumDomain(c.root_url);
      if (!domain || known.has(domain) || addedThisRun.has(domain)) { skipped++; continue; }
      if (!c.public_readable) { skipped++; continue; }

      addedThisRun.add(domain);
      try {
        state.addForum({
          url: c.root_url,
          name: c.name,
          brand: c.brands.join(', '),
          language: c.language || group.codes[0],
          parser: c.engine && c.engine !== 'unknown' ? c.engine : 'unknown',
        });
        await upsert({
          domain,
          root_url: c.root_url,
          name: c.name,
          brands: c.brands,
          language: c.language || group.codes[0],
          engine: c.engine,
          status: 'discovered',
          discovered_via: `search:${brand}/${group.label}`,
          public_readable: c.public_readable,
          notes: c.why,
          // ignore-duplicates: insert only new domains; never reset an existing
          // forum's advanced status (active/calibrated) on re-discovery.
        }, { env: opts.env, mode: 'ignore' });
        added++;
        log(`  + ${c.name || c.root_url} (${domain}) [${brand}/${group.label}]`);
      } catch (err) {
        log(`  could not queue ${domain}: ${err.message}`);
      }
    }
  }

  try { state.setMeta?.('discover_cursor', String(startCursor + queries)); } catch { /* ignore */ }

  log(`  Discovery: ${queries} queries, ${found} found, ${added} queued, ${skipped} skipped (registry ${registry.ok ? 'online' : 'local-only'}).`);
  return { queries, found, added, skipped, registryOnline: registry.ok };
}
