/**
 * woltlab.mjs — Parser for WoltLab Suite (Burning Board / WBB) forums.
 *
 * WoltLab Suite HTML structure:
 *   Post list:    ol#postList  or  ol.messageList
 *   Post item:    li[data-post-id]
 *   Post content: div.messageText  (inside the post li)
 *   Author:       [data-author] attribute on the li, or .username link
 *   Pagination:   a[rel="next"]  or  .paginationNext a
 *   Thread links: .wbbThreadList a.columnSubject  or  a[href*="/thread/"]
 *
 * No external dependencies — pure regex, same pattern as other parsers.
 */

import { htmlToText, cleanPostText, extractTitle, findNextPageLink, extractThreadLinks } from './common.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripQuotes(html) {
  // Remove WoltLab quote boxes and standard blockquotes
  let h = html;
  h = h.replace(/<div\b[^>]*class=(?:"|')[^"']*\bquoteBox\b[^"']*(?:"|')[^>]*>[\s\S]*?<\/div>/gi, ' ');
  h = h.replace(/<blockquote\b[\s\S]*?<\/blockquote>/gi, ' ');
  return h;
}

function extractAuthor(postHtml) {
  // Prefer data-author attribute (most reliable in WoltLab)
  const attrMatch = postHtml.match(/data-author=(?:"|')([^"']+)(?:"|')/i);
  if (attrMatch?.[1]) return attrMatch[1].trim();

  // Fall back to .username link text
  const usernameMatch = postHtml.match(
    /<a\b[^>]*class=(?:"|')[^"']*\busername\b[^"']*(?:"|')[^>]*>([\s\S]*?)<\/a>/i
  );
  if (usernameMatch?.[1]) return htmlToText(usernameMatch[1]).trim();

  return '';
}

function extractMessageText(postHtml) {
  // Find div.messageText — look for opening tag, then take content until
  // we see a sibling-level section (messageFooter, messageAuthorContainer, etc.)
  // This is intentionally imprecise but works for the bulk of WoltLab posts.
  const start = postHtml.search(/<div\b[^>]*class=(?:"|')[^"']*\bmessageText\b/i);
  if (start === -1) return postHtml; // fall through to full text

  // Walk forward from the opening tag to find the closing tag
  // Count div depth to handle nested divs correctly
  let depth = 0;
  let i = start;
  while (i < postHtml.length) {
    const openTag = postHtml.indexOf('<div', i);
    const closeTag = postHtml.indexOf('</div', i);
    if (closeTag === -1) break;
    if (openTag !== -1 && openTag < closeTag) {
      depth++;
      i = openTag + 4;
    } else {
      depth--;
      i = closeTag + 5;
      if (depth === 0) return postHtml.slice(start, i);
    }
  }

  return postHtml.slice(start); // partial match, better than nothing
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse a WoltLab thread page.
 *
 * @param {string} html - Raw HTML of the thread page
 * @param {object} calibration - Optional calibration overrides
 * @param {number} pageNumber
 * @returns {{ posts: Array<{author, postId, when, pageNumber, text}>, html: string }}
 */
export function parseWoltlab(html, calibration = {}, pageNumber = 1) {
  const h = (html ?? '').toString();
  const minLen = calibration.min_post_length ?? 30;
  const posts = [];

  // Split HTML into individual post chunks on each <li that has data-post-id
  // This works because WoltLab's top-level post <li> elements have data-post-id
  // and they don't nest (inner lists are for replies/quotes, not the main structure)
  const parts = h.split(/<li\b/i);

  for (let idx = 1; idx < parts.length; idx++) {
    const chunk = parts[idx];

    // Only process post containers — must have data-post-id near the tag opening
    if (!/data-post-id=/i.test(chunk.slice(0, 300))) continue;

    const author = extractAuthor(chunk);

    // Strip quotes before extracting content
    const cleaned = stripQuotes(chunk);

    // Try to get just .messageText; fall back to full chunk text
    const contentHtml = extractMessageText(cleaned);
    const text = cleanPostText(htmlToText(contentHtml), minLen);
    if (!text) continue;

    const timeMatch = chunk.match(/<time\b[^>]*datetime=(?:"|')([^"']+)(?:"|')[^>]*>/i);
    const when = timeMatch?.[1] ?? '';

    posts.push({ author, postId: '', when, pageNumber, text });
  }

  return { posts, html: h };
}

// ---------------------------------------------------------------------------
// Thread link extraction from WoltLab section/board pages
// ---------------------------------------------------------------------------

/**
 * Extract thread links from a WoltLab board page.
 * Called by the generic extractThreadLinks pipeline if woltlab is detected.
 *
 * @param {string} html - Board page HTML
 * @param {string} baseUrl - Section URL (for resolving relative links)
 * @param {object} [calibration]
 * @returns {Array<{url: string, title: string}>}
 */
export function extractWoltlabThreadLinks(html, baseUrl, calibration = {}) {
  const h = (html ?? '').toString();
  const links = new Map(); // url → title

  // WoltLab thread link patterns:
  // 1. .columnSubject links inside .wbbThreadList
  // 2. Any <a href="/thread/NNN-slug/"> pattern
  const patterns = [
    /<a\b[^>]*class=(?:"|')[^"']*\bcolumnSubject\b[^"']*(?:"|')[^>]*href=(?:"|')([^"']+)(?:"|')[^>]*>([\s\S]*?)<\/a>/gi,
    /<a\b[^>]*href=(?:"|')([^"']*\/thread\/\d+[^"']*)(?:"|')[^>]*>([\s\S]*?)<\/a>/gi,
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(h)) !== null) {
      const href = m[1];
      const title = htmlToText(m[2]).trim();
      if (!href) continue;
      try {
        const abs = new URL(href, baseUrl).href.split('#')[0];
        if (/\/thread\/\d+/i.test(abs) && !links.has(abs)) {
          links.set(abs, title);
        }
      } catch { /* skip invalid */ }
    }
  }

  return [...links.entries()].map(([url, title]) => ({ url, title }));
}
