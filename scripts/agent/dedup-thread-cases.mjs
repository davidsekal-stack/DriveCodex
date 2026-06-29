/**
 * dedup-thread-cases.mjs — collapse same-thread duplicate cases.
 *
 * A single forum thread is ONE discussion. When several users in it report the
 * SAME fault resolved the SAME way (e.g. three i30 owners each fitting an
 * aftermarket dual-tone horn), the extractor emits one case per owner — but to
 * the database and to the end user these are the SAME card mined several times,
 * and because they all share the thread's `source_ref` they add NO corroboration
 * (search-cases counts corroboration by distinct source_ref). So we keep exactly
 * ONE — the best-documented — and drop the rest.
 *
 * What we MUST NOT collapse: genuinely DIFFERENT repairs of the same symptom in
 * one thread — e.g. a "won't start" thread where one owner fixed a fuel filter,
 * another a camshaft sensor, another a dislodged selector rod. Those are distinct
 * and valuable, and corroboration does not apply across different repairs.
 *
 * "Same repair?" is a semantic judgement plain token similarity cannot make
 * reliably (measured on real data: paraphrased SAME fixes overlap as little as
 * 0.29 while DIFFERENT fixes reach 0.34 — the bands cross), so the LLM CLUSTERS
 * the duplicates and CODE picks the survivor (the richest case), the same
 * model-proposes / code-decides split as verify.mjs. Conservative by design: if
 * the judge is unsure, cases stay separate — we never silently lose a distinct
 * fix, and the worst case is the pre-existing behaviour (a residual duplicate).
 *
 * Usage:
 *   import { dedupeThreadCases } from './dedup-thread-cases.mjs';
 */

import { runLlm } from './llm.mjs';
import { promptField, promptList } from './prompt-sanitize.mjs';

const DEDUPE_MAX_TOKENS = 400;

// ---------------------------------------------------------------------------
// Survivor selection (deterministic — CODE decides which duplicate to keep)
// ---------------------------------------------------------------------------

/**
 * Richness key for a case: more cited evidence posts first, then a longer
 * resolution, then a longer description, then more symptom tags. Compared
 * lexicographically (descending). The richest case in a duplicate cluster is the
 * one kept; everything else in the cluster is dropped.
 */
export function caseRichnessKey(c = {}) {
  const postCount =
    (Array.isArray(c.fault_post_numbers) ? c.fault_post_numbers.length : 0) +
    (Array.isArray(c.resolution_post_numbers) ? c.resolution_post_numbers.length : 0);
  const resoLen = (c.resolution || '').toString().length;
  const descLen = (c.description || '').toString().length;
  const symCount = Array.isArray(c.symptoms) ? c.symptoms.length : 0;
  return [postCount, resoLen, descLen, symCount];
}

/** Index of the richest case among `indices` (ties → the earliest index, stable). */
export function pickSurvivorIndex(indices, cases) {
  let best = indices[0];
  let bestKey = caseRichnessKey(cases[best]);
  for (let i = 1; i < indices.length; i++) {
    const idx = indices[i];
    const key = caseRichnessKey(cases[idx]);
    if (compareKeyDesc(key, bestKey) > 0) {
      best = idx;
      bestKey = key;
    }
  }
  return best;
}

function compareKeyDesc(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Judge prompt + parsing (LLM only CLUSTERS; it never decides what to keep)
// ---------------------------------------------------------------------------

/**
 * Build the clustering prompt. `cases` are presented 1-indexed in the order
 * given; the model returns 1-based groups. All fields are sanitized because they
 * are untrusted forum-extracted text (a crafted post must not steer the judge).
 */
export function buildDedupePrompt(cases) {
  const blocks = cases.map((c, i) => {
    const author = promptField(c.case_author || 'unknown', 80);
    const symptoms = promptList(c.symptoms, 60);
    const reso = promptField(c.resolution, 600);
    return `CASE ${i + 1} (author: ${author})\n  symptoms: ${symptoms}\n  repair: ${reso}`;
  }).join('\n\n');

  return `You are de-duplicating automotive repair cases that were all extracted from ONE forum thread (one discussion).

Group together the cases that describe the SAME underlying fault AND were fixed by the SAME repair (the same part replaced/repaired, or the same action/procedure). Several forum members reporting that they did the same fix to the same problem = ONE group.

Keep cases SEPARATE (do NOT group) when the repair is genuinely DIFFERENT, even if the symptom is similar. Example: in a "won't start" thread, "replaced the fuel filter", "replaced the camshaft sensor", and "reseated a dislodged gear selector rod" are THREE different repairs — never group them. Wording may differ for the same repair (e.g. "fitted an aftermarket dual-tone horn" vs "installed a Stebel twin-horn with relay" = the same repair → group). Different cost or different car variant does NOT make a repair different.

Be conservative: only group cases you are confident are the same repair. When in doubt, leave them separate.

CASES:
${blocks}

Respond with ONE JSON object and NOTHING else — no markdown, no commentary:
{"duplicate_groups": [[1,2]]}
Each inner array lists the 1-based CASE numbers that are the same fault+repair. Include ONLY groups with 2 or more cases. If every case is distinct, return {"duplicate_groups": []}.`;
}

/**
 * Parse the judge output into clusters of 0-based indices. Every returned group
 * is validated: numbers must be in range and a case may appear in at most one
 * group (first wins). Malformed output → [] (fail open: keep all cases).
 *
 * @param {string} raw - model output
 * @param {number} caseCount - number of cases that were sent
 * @returns {number[][]} clusters of 0-based indices, each of length >= 2
 */
export function parseDedupeClusters(raw, caseCount) {
  const text = (raw || '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return [];

  let obj;
  try {
    obj = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!obj || !Array.isArray(obj.duplicate_groups)) return [];

  const seen = new Set();
  const clusters = [];
  for (const group of obj.duplicate_groups) {
    if (!Array.isArray(group)) continue;
    const idx = [];
    for (const n of group) {
      const zero = Number(n) - 1;
      if (!Number.isInteger(zero) || zero < 0 || zero >= caseCount) continue;
      if (seen.has(zero)) continue; // a case can only belong to one cluster
      seen.add(zero);
      idx.push(zero);
    }
    if (idx.length >= 2) clusters.push(idx);
  }
  return clusters;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Ask the routed LLM to cluster duplicate cases. Returns 0-based clusters.
 * Separated so the orchestrator's wrapper can decide error handling (quota must
 * propagate; everything else fails open).
 *
 * @param {object[]} cases - case payloads (raw extractor shape)
 * @param {object} [options]
 * @returns {Promise<number[][]>}
 */
export async function judgeDuplicateClusters(cases, options = {}) {
  const prompt = buildDedupePrompt(cases);
  const raw = await runLlm('dedupe', prompt, {
    maxTokens: DEDUPE_MAX_TOKENS,
    temperature: 0,
    timeoutMs: options.timeoutMs,
  });
  return parseDedupeClusters(raw, cases.length);
}

/**
 * Collapse same-thread duplicate cases, keeping the richest per duplicate cluster.
 *
 * Operates on the orchestrator's `{ case, validation }[]` shape. Only VALID cases
 * are de-duplicated; invalid cases are passed through untouched (they are skipped
 * at save time anyway). When fewer than two valid cases exist, the input is
 * returned unchanged WITHOUT calling the judge.
 *
 * @param {Array<{case: object, validation: object}>} entries
 * @param {object} [options]
 * @param {function} [options.judge] - async (cases[]) => clusters[][]; defaults to
 *   judgeDuplicateClusters. Injected in tests.
 * @returns {Promise<{ entries: Array<{case, validation}>, merged: number }>}
 */
export async function dedupeThreadCases(entries, options = {}) {
  const valid = [];
  const validPos = []; // index back into `entries`
  entries.forEach((e, i) => {
    if (e?.validation?.valid) {
      valid.push(e.case);
      validPos.push(i);
    }
  });

  if (valid.length < 2) return { entries, merged: 0 };

  const judge = options.judge || judgeDuplicateClusters;
  const clusters = await judge(valid, options);
  if (!clusters.length) return { entries, merged: 0 };

  // For each duplicate cluster, keep the richest valid case; mark the rest dropped.
  const dropped = new Set(); // positions into `entries`
  let merged = 0;
  for (const cluster of clusters) {
    const survivor = pickSurvivorIndex(cluster, valid);
    for (const vi of cluster) {
      if (vi === survivor) continue;
      dropped.add(validPos[vi]);
      merged++;
    }
  }

  if (!dropped.size) return { entries, merged: 0 };
  return { entries: entries.filter((_, i) => !dropped.has(i)), merged };
}
