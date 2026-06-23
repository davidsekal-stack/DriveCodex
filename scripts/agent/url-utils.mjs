const TRANSIENT_QUERY_PARAMS = new Set([
  'sid',
  's',
  'phpsessid',
  'session',
  'sessionid',
  'jsessionid',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
]);

const POST_POINTER_QUERY_PARAMS = new Set([
  'p',
  'pid',
  'postid',
  'post_id',
]);

export function canonicalizeTraversalUrl(input) {
  const raw = (input ?? '').toString().trim();
  if (!raw) return '';

  let url;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  url.hash = '';
  url.pathname = url.pathname.replace(/;jsessionid=[^/?#]*/i, '');

  // Some forums (phpBB) append session/query params onto the PATH with '&' and no
  // leading '?' (e.g. .../topic-123-abs&sid=XXX). Without this, those params land in
  // the pathname and never reach the query-string stripper below — so a per-visit
  // 'sid' makes every re-crawl look like a brand-new thread (duplicate floods). Move
  // everything from the first '&' in the path into the query string so it gets cleaned.
  const ampIndex = url.pathname.indexOf('&');
  if (ampIndex !== -1) {
    const glued = url.pathname.slice(ampIndex + 1);
    url.pathname = url.pathname.slice(0, ampIndex);
    url.search = url.search ? `${url.search}&${glued}` : `?${glued}`;
  }

  const rawSearch = url.search.startsWith('?') ? url.search.slice(1) : '';
  if (!rawSearch) {
    return url.href;
  }

  const rawSegments = [];
  const keyValueSegments = [];

  for (const segment of rawSearch.split('&')) {
    if (!segment) continue;

    const eqIndex = segment.indexOf('=');
    if (eqIndex === -1) {
      rawSegments.push(segment);
      continue;
    }

    const rawKey = segment.slice(0, eqIndex);
    const rawValue = segment.slice(eqIndex + 1);

    let key = rawKey;
    let value = rawValue;
    try { key = decodeURIComponent(rawKey.replace(/\+/g, '%20')); } catch {}
    try { value = decodeURIComponent(rawValue.replace(/\+/g, '%20')); } catch {}
    if (TRANSIENT_QUERY_PARAMS.has(key.toLowerCase())) continue;
    keyValueSegments.push([key, value]);
  }

  const lowerPath = url.pathname.toLowerCase();
  const normalizedKeys = new Set(keyValueSegments.map(([key]) => key.toLowerCase()));
  const hasThreadIdentity =
    /\/threads?\//i.test(lowerPath) ||
    /\/topic\//i.test(lowerPath) ||
    normalizedKeys.has('t') ||
    normalizedKeys.has('thread');

  const filteredKeyValueSegments = keyValueSegments.filter(([key]) => {
    const lowerKey = key.toLowerCase();
    if (!hasThreadIdentity) return true;
    return !POST_POINTER_QUERY_PARAMS.has(lowerKey);
  });

  filteredKeyValueSegments.sort(([aKey, aValue], [bKey, bValue]) => {
    if (aKey === bKey) return aValue.localeCompare(bValue);
    return aKey.localeCompare(bKey);
  });

  const rebuiltSearch = [
    ...rawSegments,
    ...filteredKeyValueSegments.map(([key, value]) => {
      const encodedKey = encodeURIComponent(key);
      const encodedValue = encodeURIComponent(value);
      return `${encodedKey}=${encodedValue}`;
    }),
  ].join('&');

  url.search = rebuiltSearch ? `?${rebuiltSearch}` : '';

  return url.href;
}

// Thread-position path suffixes (XenForo: /latest, /unread, /post-123,
// /page-7; Invision: /page/2/). They point INTO a thread, not at it — the
// canonical thread URL is the thread root. Stripping them also dodges WAFs
// that block the /latest jump endpoint (observed on toyotanation.com) and
// makes the parser start pagination from page 1.
const THREAD_POSITION_SUFFIXES = /\/(?:latest|unread|post-\d+|page-\d+|page\/\d+)\/?$/i;

export function canonicalizeThreadUrl(input) {
  const traversal = canonicalizeTraversalUrl(input);

  let url;
  try {
    url = new URL(traversal);
  } catch {
    return traversal;
  }

  if (/\/(threads?|topic)\//i.test(url.pathname)) {
    let previous;
    do {
      previous = url.pathname;
      url.pathname = url.pathname.replace(THREAD_POSITION_SUFFIXES, '/');
    } while (url.pathname !== previous);
  }

  return url.href;
}
