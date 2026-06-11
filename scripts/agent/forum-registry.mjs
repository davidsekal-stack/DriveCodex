/**
 * forum-registry.mjs — Online forum registry (Supabase crawl_forums table).
 *
 * The "online list" of crawl targets + when each was last scraped. Used for
 * cross-machine de-duplication during discovery and as a durable record of
 * forum state. The local SQLite agent.db remains the working store.
 *
 * All functions degrade gracefully: with no Supabase credentials (or before
 * the 020_crawl_forums migration is applied) they become no-ops and the agent
 * runs in local-only mode. Nothing here is allowed to abort a crawl.
 */

const REGISTRY_TABLE = 'crawl_forums';

export function forumDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function registryConfig(env = process.env) {
  const supabaseUrl = env.SUPABASE_URL || 'https://nmvjthfezyjcwuzphiuu.supabase.co';
  // Writing/reading operator infra requires the service key specifically.
  const supabaseKey = env.SUPABASE_SERVICE_KEY || '';
  if (!supabaseKey) return null;
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ''), supabaseKey };
}

/**
 * Fetch the set of known forum domains from the registry.
 * Returns { ok, domains: Set<string> }. ok=false ⇒ registry unavailable
 * (no creds / table missing / network) and the caller should use local dedup only.
 */
export async function fetchKnownDomains(opts = {}) {
  const config = opts.config ?? registryConfig(opts.env);
  if (!config) return { ok: false, domains: new Set() };
  const fetchImpl = opts.fetchImpl ?? fetch;

  const url = `${config.supabaseUrl}/rest/v1/${REGISTRY_TABLE}?select=domain`;
  try {
    const res = await fetchImpl(url, {
      headers: { apikey: config.supabaseKey, Authorization: `Bearer ${config.supabaseKey}` },
    });
    if (!res.ok) return { ok: false, domains: new Set() };
    const rows = await res.json();
    return { ok: true, domains: new Set(rows.map(r => (r.domain || '').toLowerCase()).filter(Boolean)) };
  } catch {
    return { ok: false, domains: new Set() };
  }
}

/**
 * Upsert a forum row keyed by domain (Prefer: resolution=merge-duplicates).
 * Best-effort: returns { ok } and never throws.
 */
export async function upsertForum(forum, opts = {}) {
  const config = opts.config ?? registryConfig(opts.env);
  if (!config) return { ok: false, skipped: 'no-credentials' };
  const fetchImpl = opts.fetchImpl ?? fetch;

  const domain = forum.domain || forumDomain(forum.root_url || forum.url);
  if (!domain) return { ok: false, skipped: 'no-domain' };

  const row = {
    domain,
    root_url: forum.root_url || forum.url || '',
    name: forum.name ?? null,
    brands: Array.isArray(forum.brands) ? forum.brands : undefined,
    language: forum.language ?? null,
    engine: forum.engine ?? forum.parser ?? null,
    status: forum.status ?? null,
    discovered_via: forum.discovered_via ?? null,
    public_readable: forum.public_readable ?? null,
    threads_crawled: forum.threads_crawled ?? undefined,
    cases_total: forum.cases_total ?? undefined,
    yield_rate: forum.yield_rate ?? undefined,
    last_crawled_at: forum.last_crawled_at ?? undefined,
    last_calibrated_at: forum.last_calibrated_at ?? undefined,
    notes: forum.notes ?? undefined,
    updated_at: opts.now ?? undefined,
  };
  for (const k of Object.keys(row)) if (row[k] === undefined) delete row[k];

  const url = `${config.supabaseUrl}/rest/v1/${REGISTRY_TABLE}?on_conflict=domain`;
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(row),
    });
    return { ok: res.ok, httpStatus: res.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
