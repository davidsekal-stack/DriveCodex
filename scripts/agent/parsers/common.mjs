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
// Extract thread links using calibrated CSS selectors
// ---------------------------------------------------------------------------

function parseTagAttrs(attrText) {
  const attrs = new Map();
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(attrText || '')) !== null) {
    const name = m[1].toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? '';
    attrs.set(name, value);
  }
  return attrs;
}

function parseSelectorSegment(segment) {
  const trimmed = (segment ?? '').toString().trim();
  if (!trimmed || trimmed === '>' || trimmed === '+' || trimmed === '~') return null;

  const notSegments = [...trimmed.matchAll(/:not\(([^()]+)\)/g)]
    .map(m => parseSelectorSegmentBase(m[1]))
    .filter(Boolean);
  const positivePart = trimmed.replace(/:not\([^()]+\)/g, '').trim();
  const base = parseSelectorSegmentBase(positivePart);
  if (!base) {
    return notSegments.length > 0 ? { tag: null, classes: [], attrs: [], notSegments } : null;
  }
  return { ...base, notSegments };
}

function parseSelectorSegmentBase(segment) {
  const trimmed = (segment ?? '').toString().trim();
  if (!trimmed) return null;

  const selectorWithoutAttrs = trimmed.replace(/\[[^\]]+\]/g, '');
  const tagMatch = selectorWithoutAttrs.match(/^\s*([a-zA-Z][\w-]*)/);
  const tag = tagMatch ? tagMatch[1].toLowerCase() : null;
  const classes = [...selectorWithoutAttrs.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  const attrs = [...trimmed.matchAll(/\[([a-zA-Z0-9_:-]+)([*^$|~]?=)?(?:"([^"]*)"|'([^']*)')?\]/g)]
    .map(m => ({
      name: m[1].toLowerCase(),
      operator: m[2] ?? null,
      value: m[3] ?? m[4] ?? '',
    }));

  if (!tag && classes.length === 0 && attrs.length === 0) return null;
  return { tag, classes, attrs };
}

function attrsMatch(requiredAttrs, attrMap) {
  return requiredAttrs.every(req => {
    if (!attrMap.has(req.name)) return false;
    const actual = attrMap.get(req.name) ?? '';
    if (!req.operator) return true;
    if (req.operator === '=') return actual === req.value;
    if (req.operator === '*=') return actual.includes(req.value);
    if (req.operator === '^=') return actual.startsWith(req.value);
    if (req.operator === '$=') return actual.endsWith(req.value);
    if (req.operator === '~=') return actual.split(/\s+/).includes(req.value);
    if (req.operator === '|=') return actual === req.value || actual.startsWith(`${req.value}-`);
    return false;
  });
}

function segmentMatchesOpenTag(tagName, attrText, segment) {
  if (!segment) return false;
  if (!segmentMatchesPositiveSelector(tagName, attrText, segment)) return false;
  return !(segment.notSegments || []).some(notSegment =>
    segmentMatchesPositiveSelector(tagName, attrText, notSegment)
  );
}

function segmentMatchesPositiveSelector(tagName, attrText, segment) {
  if (!segment) return false;
  if (segment.tag && segment.tag !== tagName.toLowerCase()) return false;

  const attrMap = parseTagAttrs(attrText);
  const classes = new Set((attrMap.get('class') || '').split(/\s+/).filter(Boolean));
  if (!segment.classes.every(cls => classes.has(cls))) return false;
  return attrsMatch(segment.attrs, attrMap);
}

function selectorMatchesAnchor(selector, anchorAttrText, ancestorStack) {
  const parts = selector
    .split(/\s+/)
    .map(s => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return false;

  const target = parseSelectorSegment(parts.at(-1));
  if (!target) return false;
  if (target.tag && target.tag !== 'a') return false;
  if (!segmentMatchesOpenTag('a', anchorAttrText, target)) return false;

  const ancestors = parts
    .slice(0, -1)
    .map(parseSelectorSegment)
    .filter(Boolean);
  if (ancestors.length === 0) return true;

  let stackIndex = ancestorStack.length - 1;
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const ancestor = ancestors[i];
    let found = false;
    while (stackIndex >= 0) {
      const stackItem = ancestorStack[stackIndex];
      stackIndex--;
      if (!segmentMatchesOpenTag(stackItem.tagName, stackItem.attrText, ancestor)) continue;
      found = true;
      break;
    }
    if (!found) return false;
  }

  return true;
}

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'param', 'source', 'track', 'wbr',
]);

const RAW_TEXT_TAGS = new Set([
  'script', 'style', 'template', 'textarea', 'title',
]);

function popMatchingTag(stack, tagName) {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].tagName !== tagName) continue;
    stack.length = i;
    return;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeHtmlAttribute(value) {
  return (value ?? '')
    .toString()
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function findTagClose(html, startIndex) {
  let quote = null;
  for (let i = startIndex; i < (html || '').length; i++) {
    const ch = html[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === '\'') {
      quote = ch;
      continue;
    }
    if (ch === '>') return i;
  }
  return -1;
}

function findRawTextClosingTag(html, tagName, startIndex) {
  const re = new RegExp(`<\\/\\s*${escapeRegExp(tagName)}\\s*>`, 'ig');
  re.lastIndex = startIndex;
  const match = re.exec(html || '');
  return match ? { start: match.index, end: re.lastIndex } : null;
}

function tokenizeHtmlTags(html) {
  const tokens = [];
  let index = 0;
  const source = (html ?? '').toString();

  while (index < source.length) {
    const openIndex = source.indexOf('<', index);
    if (openIndex === -1) break;

    if (source.startsWith('<!--', openIndex)) {
      const commentEnd = source.indexOf('-->', openIndex + 4);
      index = commentEnd === -1 ? source.length : commentEnd + 3;
      continue;
    }

    if (source.startsWith('<![CDATA[', openIndex)) {
      const cdataEnd = source.indexOf(']]>', openIndex + 9);
      index = cdataEnd === -1 ? source.length : cdataEnd + 3;
      continue;
    }

    if (/^<![^-]/.test(source.slice(openIndex, openIndex + 3)) || source.startsWith('<?', openIndex)) {
      const declarationEnd = findTagClose(source, openIndex + 2);
      index = declarationEnd === -1 ? source.length : declarationEnd + 1;
      continue;
    }

    const tagEnd = findTagClose(source, openIndex + 1);
    if (tagEnd === -1) break;

    const fullTag = source.slice(openIndex, tagEnd + 1);
    const closeMatch = fullTag.match(/^<\s*\/\s*([a-zA-Z][\w:-]*)\s*>$/);
    if (closeMatch) {
      tokens.push({
        type: 'close',
        tagName: closeMatch[1].toLowerCase(),
        attrText: '',
        start: openIndex,
        end: tagEnd + 1,
      });
      index = tagEnd + 1;
      continue;
    }

    const openMatch = fullTag.match(/^<\s*([a-zA-Z][\w:-]*)\b([\s\S]*?)>$/);
    if (!openMatch) {
      index = openIndex + 1;
      continue;
    }

    const tagName = openMatch[1].toLowerCase();
    const attrText = openMatch[2] ?? '';
    const isSelfClosing = /\/\s*>$/.test(fullTag) || VOID_TAGS.has(tagName);

    tokens.push({
      type: 'open',
      tagName,
      attrText,
      isSelfClosing,
      start: openIndex,
      end: tagEnd + 1,
    });

    index = tagEnd + 1;

    if (!isSelfClosing && RAW_TEXT_TAGS.has(tagName)) {
      const closing = findRawTextClosingTag(source, tagName, index);
      if (closing) {
        tokens.push({
          type: 'close',
          tagName,
          attrText: '',
          start: closing.start,
          end: closing.end,
        });
        index = closing.end;
      } else {
        break;
      }
    }
  }

  return tokens;
}

function findMatchingAnchorClose(tokens, openIndex) {
  let depth = 0;
  for (let i = openIndex + 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.tagName !== 'a') continue;
    if (token.type === 'open' && !token.isSelfClosing) {
      depth++;
      continue;
    }
    if (token.type !== 'close') continue;
    if (depth === 0) return i;
    depth--;
  }
  return -1;
}

function collectAnchorsWithAncestors(html) {
  const anchors = [];
  const stack = [];
  const tokens = tokenizeHtmlTags(html);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const { tagName, attrText } = token;

    if (token.type === 'close') {
      popMatchingTag(stack, tagName);
      continue;
    }

    if (tagName === 'a') {
      const closeIndex = findMatchingAnchorClose(tokens, i);
      const innerHtml = closeIndex === -1
        ? ''
        : (html || '').slice(token.end, tokens[closeIndex].start);

      anchors.push({
        attrText,
        innerHtml,
        ancestorStack: stack.map(item => ({ ...item })),
      });

      if (closeIndex !== -1) i = closeIndex;
      continue;
    }

    if (!token.isSelfClosing) {
      stack.push({ tagName, attrText });
    }
  }

  return anchors;
}

export function extractThreadLinksBySelector(html, baseUrl, selectorList) {
  const selectors = (selectorList ?? '')
    .toString()
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (selectors.length === 0) return [];

  const links = [];
  const seen = new Set();
  for (const anchor of collectAnchorsWithAncestors(html)) {
    const attrs = anchor.attrText;
    if (!selectors.some(selector => selectorMatchesAnchor(selector, attrs, anchor.ancestorStack))) continue;

    const attrMap = parseTagAttrs(attrs);
    let href = attrMap.get('href') ?? '';
    href = decodeHtmlAttribute(href);

    const text = htmlToText(anchor.innerHtml).trim();
    if (!href || !text) continue;

    try {
      href = new URL(href, baseUrl).href;
    } catch {
      continue;
    }

    try {
      const parsed = new URL(href);
      parsed.hash = '';
      href = parsed.href;
    } catch { /* keep as-is */ }

    if (href.includes('/login') || href.includes('/register')) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    links.push({ url: href, title: text });
  }

  return links;
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
    href = decodeHtmlAttribute(href);

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
  const selectors = (paginationSelector ?? '')
    .toString()
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .flatMap(selector => [selector, `${selector} a`]);

  if (selectors.length > 0) {
    for (const anchor of collectAnchorsWithAncestors(html)) {
      if (!selectors.some(selector => selectorMatchesAnchor(selector, anchor.attrText, anchor.ancestorStack))) continue;
      const attrMap = parseTagAttrs(anchor.attrText);
      const href = decodeHtmlAttribute(attrMap.get('href') ?? '');
      if (!href) continue;
      try { return new URL(href, baseUrl).href; } catch { /* skip */ }
    }
  }

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
