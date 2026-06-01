export const SUPABASE_CASES_TABLE = 'gearbrain_cases';
export const RESOLUTION_MIN_LENGTH = 10;
export const RESOLUTION_MAX_LENGTH = 400;

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

function symptomsSimilarity(a, b) {
  const leftValues = Array.isArray(a) ? a : (typeof a === 'string' ? [a] : []);
  const rightValues = Array.isArray(b) ? b : (typeof b === 'string' ? [b] : []);
  const left = new Set(leftValues.flatMap(normalizeDedupeTokens));
  const right = new Set(rightValues.flatMap(normalizeDedupeTokens));
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
  if (normalizeForDedupe(candidate.resolution) && normalizeForDedupe(candidate.resolution) === normalizeForDedupe(existing.resolution)) {
    return true;
  }

  const descriptionSimilarity = textSimilarity(candidate.description, existing.description);
  const symptomSimilarity = symptomsSimilarity(candidate.symptoms, existing.symptoms);
  return (
    (sameSource && resolutionSimilarity >= 0.45) ||
    resolutionSimilarity >= 0.7 ||
    (resolutionSimilarity >= 0.55 && descriptionSimilarity >= 0.45) ||
    (resolutionSimilarity >= 0.5 && symptomSimilarity >= 0.5)
  );
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
