export const SUPABASE_CASES_TABLE = 'gearbrain_cases';
export const RESOLUTION_MIN_LENGTH = 10;
export const RESOLUTION_MAX_LENGTH = 400;
// Cross-source dedup threshold: how near-verbatim two resolutions from DIFFERENT
// sources must be before we treat them as the same write-up copied around (one
// person pasting the same advice on several forums) rather than two independent
// reports. Kept high on purpose — independent reports of a common fault routinely
// share standard repair wording (~0.5–0.75) and MUST be preserved as corroboration
// (see HANDOVER §0a). Only an almost-identical token set should trip this.
export const NEAR_VERBATIM_SIMILARITY = 0.95;

export function normalizeForDedupe(value) {
  return (value ?? '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 100);
}

function normalizeDedupeTokens(value) {
  const normalized = (value ?? '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!normalized) return [];
  return normalized.split(/\s+/).filter(token => token.length >= 3);
}

export function textSimilarity(a, b) {
  const left = new Set(normalizeDedupeTokens(a));
  const right = new Set(normalizeDedupeTokens(b));
  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection++;
  }
  return intersection / Math.max(left.size, right.size);
}

function postgrestIlikeContains(value) {
  const safe = (value ?? '').toString().replace(/[,*()]/g, ' ').replace(/\s+/g, ' ').trim();
  return safe ? `ilike.*${safe}*` : '';
}

export function normalizeImportText(value) {
  return (value ?? '')
    .toString()
    .replace(/\s+/g, ' ')
    .trim();
}

export function clampResolutionForImport(value, maxLength = RESOLUTION_MAX_LENGTH) {
  const text = normalizeImportText(value);
  if (text.length <= maxLength) return text;

  const ellipsis = '...';
  const budget = Math.max(0, maxLength - ellipsis.length);
  if (budget === 0) return ellipsis.slice(0, maxLength);

  const sample = text.slice(0, budget + 1);
  const minBoundary = Math.max(0, Math.floor(budget * 0.6));
  const sentenceCuts = ['. ', '! ', '? '];
  const clauseCuts = ['; ', ': ', ', '];

  let cut = findPreferredCut(sample, sentenceCuts, minBoundary, 1);
  if (cut === -1) cut = findPreferredCut(sample, clauseCuts, minBoundary, 1);
  if (cut === -1) {
    const wordCut = sample.lastIndexOf(' ');
    if (wordCut >= minBoundary) cut = wordCut;
  }
  if (cut === -1) cut = budget;

  const trimmed = sample.slice(0, cut).trimEnd();
  return `${trimmed}${ellipsis}`;
}

function findPreferredCut(sample, separators, minBoundary, extraLength) {
  for (const separator of separators) {
    const index = sample.lastIndexOf(separator);
    if (index >= minBoundary) return index + extraLength;
  }
  return -1;
}

export function buildCasesRestUrl(supabaseUrl, params = {}) {
  const url = new URL(`/rest/v1/${SUPABASE_CASES_TABLE}`, ensureTrailingSlash(supabaseUrl));
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function resolveSupabaseReadKey(env = process.env, defaults = {}) {
  return env.SUPABASE_SERVICE_KEY || env.SUPABASE_ANON_KEY || defaults.readKey || '';
}

export function resolveSupabaseFunctionKey(env = process.env, defaults = {}) {
  return env.SUPABASE_SERVICE_KEY || env.SUPABASE_FUNCTION_KEY || defaults.functionKey || '';
}

export function isLikelySupabaseDuplicate(candidate, existing) {
  const candidateThreadUrl = normalizeImportText(candidate.thread_url || candidate.source_url || '');
  const existingThreadUrl = normalizeImportText(existing.thread_url || existing.source_url || '');
  const candidateSource = normalizeImportText(candidate.source_ref || '');
  const existingSource = normalizeImportText(existing.source_ref || '');
  const sameSource = Boolean(
    (candidateThreadUrl && existingThreadUrl && candidateThreadUrl === existingThreadUrl) ||
    (candidateSource && existingSource && candidateSource === existingSource)
  );
  const resolutionSimilarity = textSimilarity(candidate.resolution, existing.resolution);

  // Same write-up, regardless of source: exact normalized match, or near-verbatim
  // token overlap. This catches one person copying the same advice onto several
  // forums (a real duplicate) without merging two genuinely independent reports.
  const candidateResolutionKey = normalizeForDedupe(candidate.resolution);
  if (candidateResolutionKey && candidateResolutionKey === normalizeForDedupe(existing.resolution)) {
    return true;
  }
  if (resolutionSimilarity >= NEAR_VERBATIM_SIMILARITY) {
    return true;
  }

  // Across DIFFERENT sources, mere textual similarity is NOT a duplicate — two users
  // on different forums hitting the same fault with similar repair wording are
  // independent corroboration and must both be kept (RAG rewards this; see HANDOVER
  // §0a). The looser similarity branches below only apply WITHIN the same source
  // (same thread / source_ref), e.g. a re-crawled thread already imported earlier.
  if (!sameSource) {
    return false;
  }

  // Within the same source, a moderate resolution overlap is enough — it's the same
  // thread re-imported, not a new contributor.
  return resolutionSimilarity >= 0.45;
}

export async function crosscheckCaseAgainstSupabase({
  supabaseUrl,
  supabaseKey,
  brand,
  model,
  resolution,
  payload,
  limit = 200,
  fetchImpl = fetch,
}) {
  const candidate = payload || {
    vehicle_brand: brand,
    vehicle_model: model,
    resolution,
  };
  const candidateBrand = candidate.vehicle_brand || candidate.brand_raw || brand || '';

  const url = buildCasesRestUrl(supabaseUrl, {
    vehicle_brand: postgrestIlikeContains(candidateBrand) || undefined,
    select: 'id,vehicle_brand,vehicle_model,symptoms,description,resolution,thread_url,source_ref,created_at',
    order: 'created_at.desc',
    limit: String(limit),
  });

  const res = await fetchImpl(url, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return {
      status: 'error',
      httpStatus: res.status,
      reviewNote: `Crosscheck HTTP ${res.status}: ${body.slice(0, 200)}`,
    };
  }

  const existing = await res.json();
  const isDuplicate = existing.some(entry => isLikelySupabaseDuplicate(candidate, entry));

  return {
    status: isDuplicate ? 'duplicate' : 'clear',
    comparedAgainst: existing.length,
  };
}

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`;
}

/**
 * Reversibly flip the LIVE status of one imported case in gearbrain_cases, keyed by
 * its agent-side local_id (== the agent case id push-case wrote as local_id). Used by
 * the alert-agent to quarantine a wrongly-accepted case (status → 'rejected', so it
 * leaves search/review) and by apply-proposal --revert to restore it.
 *
 * The agent does NOT know IMPORTER_USER_ID, so we resolve the row by local_id, then
 * PATCH by its own primary-key id (unambiguous). The service key bypasses RLS. The
 * `expectStatuses` guard is a TRUE atomic compare-and-swap: the expected status is
 * pushed into the PATCH filter itself (status=in.(…)), so if a human/engine changes the
 * row in the lookup→PATCH window the write simply matches 0 rows and is reported
 * skipped — a human decision in between is never clobbered. Returns {ok, found, skipped,
 * updated, previousStatus, httpStatus}. Never throws on a clean miss — a case not (yet)
 * in the live DB returns {ok:true, found:false}.
 */
export async function setLiveCaseStatusByLocalId({ supabaseUrl, serviceKey, localId, patch, expectStatuses = null, fetchImpl = fetch }) {
  if (!supabaseUrl || !serviceKey || !localId || !patch) {
    return { ok: false, found: false, reason: 'missing supabaseUrl/serviceKey/localId/patch' };
  }
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  let row;
  try {
    const lookup = new URL(`rest/v1/${SUPABASE_CASES_TABLE}`, ensureTrailingSlash(supabaseUrl));
    lookup.searchParams.set('local_id', `eq.${localId}`);
    lookup.searchParams.set('select', 'id,status,review_reason');
    lookup.searchParams.set('limit', '1');
    const res = await fetchImpl(lookup.toString(), { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, found: false, httpStatus: res.status, reason: `lookup HTTP ${res.status}: ${body.slice(0, 160)}` };
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return { ok: true, found: false };
    row = rows[0];
  } catch (e) {
    return { ok: false, found: false, reason: `lookup failed: ${e.message}` };
  }

  if (Array.isArray(expectStatuses) && !expectStatuses.includes(row.status)) {
    return { ok: true, found: true, skipped: true, previousStatus: row.status };
  }

  try {
    const patchUrl = new URL(`rest/v1/${SUPABASE_CASES_TABLE}`, ensureTrailingSlash(supabaseUrl));
    patchUrl.searchParams.set('id', `eq.${row.id}`);
    // Atomic CAS: constrain the write to the expected status so a change in the
    // lookup→PATCH window matches 0 rows instead of clobbering it. return=representation
    // lets us count the rows actually updated.
    if (Array.isArray(expectStatuses) && expectStatuses.length > 0) {
      patchUrl.searchParams.set('status', `in.(${expectStatuses.join(',')})`);
    }
    const res = await fetchImpl(patchUrl.toString(), {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, found: true, httpStatus: res.status, previousStatus: row.status, reason: `patch HTTP ${res.status}: ${body.slice(0, 160)}` };
    }
    const updatedRows = await res.json().catch(() => null);
    const count = Array.isArray(updatedRows) ? updatedRows.length : (updatedRows ? 1 : 0);
    if (count === 0) return { ok: true, found: true, skipped: true, previousStatus: row.status }; // superseded in the window
    return { ok: true, found: true, updated: true, previousStatus: row.status };
  } catch (e) {
    return { ok: false, found: true, previousStatus: row.status, reason: `patch failed: ${e.message}` };
  }
}

/**
 * Read a batch of live gearbrain_cases rows by status (service key, bypasses RLS).
 * Used by the intake triage to pull the next `pending` cases (oldest first) to judge.
 * Returns {ok, rows} or {ok:false, reason}. Never throws.
 */
export async function fetchLiveCasesByStatus({ supabaseUrl, serviceKey, status = 'pending', limit = 50, offset = 0, order = 'created_at.asc', select = 'id,local_id,vehicle_brand,vehicle_model,engine_power,symptoms,obd_codes,description,resolution,thread_url,source_ref,status,created_at', fetchImpl = fetch }) {
  if (!supabaseUrl || !serviceKey) return { ok: false, rows: [], reason: 'missing supabaseUrl/serviceKey' };
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  try {
    const url = new URL(`rest/v1/${SUPABASE_CASES_TABLE}`, ensureTrailingSlash(supabaseUrl));
    url.searchParams.set('status', `eq.${status}`);
    url.searchParams.set('select', select);
    url.searchParams.set('order', order);
    url.searchParams.set('limit', String(limit));
    if (offset > 0) url.searchParams.set('offset', String(offset));
    const res = await fetchImpl(url.toString(), { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, rows: [], httpStatus: res.status, reason: `list HTTP ${res.status}: ${body.slice(0, 160)}` };
    }
    const rows = await res.json();
    return { ok: true, rows: Array.isArray(rows) ? rows : [] };
  } catch (e) {
    return { ok: false, rows: [], reason: `list failed: ${e.message}` };
  }
}

/** Upsert one row into crawl_review_queue (PK case_local_id) — a disputable case + its evidence. */
export async function upsertReviewQueueRow({ supabaseUrl, serviceKey, row, fetchImpl = fetch }) {
  if (!supabaseUrl || !serviceKey || !row?.case_local_id) return { ok: false, reason: 'missing supabaseUrl/serviceKey/row' };
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  try {
    const url = new URL(`rest/v1/crawl_review_queue`, ensureTrailingSlash(supabaseUrl));
    url.searchParams.set('on_conflict', 'case_local_id');
    const res = await fetchImpl(url.toString(), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([row]),
    });
    if (!res.ok) { const b = await res.text().catch(() => ''); return { ok: false, httpStatus: res.status, reason: `upsert HTTP ${res.status}: ${b.slice(0, 160)}` }; }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: `upsert failed: ${e.message}` };
  }
}

/** Case ids already sitting UNRESOLVED in the review queue — triage skips re-judging them. */
export async function fetchOpenReviewQueueIds({ supabaseUrl, serviceKey, fetchImpl = fetch }) {
  if (!supabaseUrl || !serviceKey) return { ok: false, ids: [], reason: 'missing supabaseUrl/serviceKey' };
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  try {
    const url = new URL(`rest/v1/crawl_review_queue`, ensureTrailingSlash(supabaseUrl));
    url.searchParams.set('resolved_at', 'is.null');
    url.searchParams.set('select', 'case_local_id');
    url.searchParams.set('limit', '5000');
    const res = await fetchImpl(url.toString(), { headers });
    if (!res.ok) { const b = await res.text().catch(() => ''); return { ok: false, ids: [], httpStatus: res.status, reason: `queue ids HTTP ${res.status}: ${b.slice(0, 160)}` }; }
    const rows = await res.json();
    return { ok: true, ids: (Array.isArray(rows) ? rows : []).map(r => r.case_local_id).filter(Boolean) };
  } catch (e) {
    return { ok: false, ids: [], reason: `queue ids failed: ${e.message}` };
  }
}

/** Remove a crawl_review_queue row (e.g. a case that triage now finds CLEAR and auto-approves). */
export async function deleteReviewQueueRow({ supabaseUrl, serviceKey, localId, fetchImpl = fetch }) {
  if (!supabaseUrl || !serviceKey || !localId) return { ok: false, reason: 'missing supabaseUrl/serviceKey/localId' };
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  try {
    const url = new URL(`rest/v1/crawl_review_queue`, ensureTrailingSlash(supabaseUrl));
    url.searchParams.set('case_local_id', `eq.${localId}`);
    const res = await fetchImpl(url.toString(), { method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' } });
    if (!res.ok) { const b = await res.text().catch(() => ''); return { ok: false, httpStatus: res.status, reason: `delete HTTP ${res.status}: ${b.slice(0, 160)}` }; }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: `delete failed: ${e.message}` };
  }
}
