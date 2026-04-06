/**
 * common.mjs — Shared HTML parsing utilities for all forum parsers.
 */

// ---------------------------------------------------------------------------
// HTML → plain text
// ---------------------------------------------------------------------------

export function htmlToText(html) {
  let s = (html ?? '').toString();
  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ');
  s = s.replace(/<(br|hr)\b[^>]*>/gi, '\n');
  s = s.replace(/<\/(p|div|li|tr|h1|h2|h3|h4|h5|h6)\b[^>]*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  s = s.replace(/&#(\d+);/g, (_, n) => {
    const code = Number(n);
    return Number.isFinite(code) ? String.fromCodePoint(code) : '';
  });
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, n) => {
    const code = parseInt(n, 16);
    return Number.isFinite(code) ? String.fromCodePoint(code) : '';
  });
  s = s.replace(/\r\n/g, '\n');
  s = s.replace(/[ \t]+\n/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.replace(/[ \t]{2,}/g, ' ');
  return s.trim();
}

// ---------------------------------------------------------------------------
// Title extraction
// ---------------------------------------------------------------------------

export function extractTitle(html) {
  const m = (html ?? '').toString().match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  const t = htmlToText(m[1]).trim();
  // Strip only the last pipe-separated segment (usually the forum name)
  const parts = t.split(/\s*\|\s*/);
  return (parts.length > 1 ? parts.slice(0, -1).join(' | ') : t).trim();
}

// ---------------------------------------------------------------------------
// Text normalization (diacritics-safe)
// ---------------------------------------------------------------------------

export function normalizeText(s) {
  return (s ?? '')
    .toString()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Noise filter for post text lines
// ---------------------------------------------------------------------------

const NOISE_PATTERNS = [
  /^(citace|quote|l[ií]b[ií] se mi|sd[ií]let|odpov[eě]d[eě]t|report|share|like|reply|přidat komentář)$/i,
  /^(re:|odp:|fw:|fwd:)/i,
  /^(#\d+|page \d+ of \d+)$/i,
];

export function isNoiseLine(line) {
  const trimmed = (line ?? '').toString().trim();
  if (!trimmed) return true;
  const norm = normalizeText(trimmed);
  return NOISE_PATTERNS.some(p => p.test(norm) || p.test(trimmed));
}

export function cleanPostText(rawText, minLength = 40) {
  const lines = (rawText ?? '')
    .toString()
    .split('\n')
    .map(x => x.trim())
    .filter(Boolean)
    .filter(x => !isNoiseLine(x));
  const text = lines.join('\n');
  return text.length >= minLength ? text : '';
}

// ---------------------------------------------------------------------------
// Thread text assembly (POST 1 | page: ... format)
// ---------------------------------------------------------------------------

export function buildThreadText({ url, title, posts, forumTitle = '', subforumTitle = '' }) {
  const lines = [];
  if (forumTitle) lines.push(`FORUM_CONTEXT: ${forumTitle}`);
  if (subforumTitle) lines.push(`SUBFORUM_TITLE: ${subforumTitle}`);
  lines.push(`THREAD_URL: ${url}`);
  if (title) lines.push(`TITLE: ${title}`);

  const threadAuthor = posts.find(p => p.author)?.author ?? '';
  if (threadAuthor) lines.push(`THREAD_AUTHOR: ${threadAuthor}`);
  lines.push('');

  let idx = 0;
  for (const p of posts) {
    idx++;
    const isThreadAuthor = threadAuthor
      ? normalizeText(p.author) === normalizeText(threadAuthor)
      : false;
    const meta = [
      `page: ${p.pageNumber ?? 1}`,
      `author: ${p.author || 'unknown'}`,
      `is_thread_author: ${isThreadAuthor ? 'true' : 'false'}`,
      p.when ? `when: ${p.when}` : '',
      p.postId ? `post_id: ${p.postId}` : '',
    ].filter(Boolean).join(' | ');
    lines.push(`POST ${idx}${meta ? ` | ${meta}` : ''}:`);
    lines.push(p.text);
    lines.push('');
  }

  return lines.join('\n').trim();
}

// ---------------------------------------------------------------------------
// Extract thread links from a section/index page
// ---------------------------------------------------------------------------

export function extractThreadLinks(html, baseUrl) {
  const links = [];
  const seen = new Set();
  const re = /<a\b[^>]*href=(?:"|')([^"']+)(?:"|')[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let href = m[1];
    // Decode HTML entities in href (e.g. &amp; → &, &#38; → &)
    href = href.replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"');
    href = href.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
    href = href.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

    const text = htmlToText(m[2]).trim();
    if (!href || !text || text.length < 5) continue;

    // Resolve relative URLs
    try {
      href = new URL(href, baseUrl).href;
    } catch {
      continue;
    }

    // Strip fragment from URL, skip pure anchors
    try {
      const parsed = new URL(href);
      parsed.hash = '';
      href = parsed.href;
    } catch { /* keep as-is */ }

    // Skip non-thread links
    if (href.includes('/login') || href.includes('/register')) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    links.push({ url: href, title: text });
  }

  return links;
}

// ---------------------------------------------------------------------------
// Pagination — find "next page" link
// ---------------------------------------------------------------------------

export function findNextPageLink(html, baseUrl, paginationSelector) {
  // Try common patterns for "next" links
  const patterns = [
    /<a\b[^>]*class=(?:"|')[^"']*\bnext\b[^"']*(?:"|')[^>]*href=(?:"|')([^"']+)(?:"|')/i,
    /<a\b[^>]*href=(?:"|')([^"']+)(?:"|')[^>]*class=(?:"|')[^"']*\bnext\b[^"']*(?:"|')/i,
    /<a\b[^>]*rel=(?:"|')next(?:"|')[^>]*href=(?:"|')([^"']+)(?:"|')/i,
    /<a\b[^>]*href=(?:"|')([^"']+)(?:"|')[^>]*rel=(?:"|')next(?:"|')/i,
    /<li\b[^>]*class=(?:"|')[^"']*\bnext\b[^"']*(?:"|')[^>]*>\s*<a\b[^>]*href=(?:"|')([^"']+)(?:"|')/i,
  ];

  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) {
      try { return new URL(m[1], baseUrl).href; } catch { /* skip */ }
    }
  }

  return null;
}
