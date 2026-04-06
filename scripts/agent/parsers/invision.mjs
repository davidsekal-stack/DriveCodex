/**
 * invision.mjs — Parser for Invision Power Board (IPS Community Suite) forums.
 *
 * Extracts posts from <article> containers with cPost/ipsComment class patterns.
 */

import { htmlToText, cleanPostText } from './common.mjs';

// ---------------------------------------------------------------------------
// Author extraction from <article>
// ---------------------------------------------------------------------------

function extractAuthor(articleHtml) {
  const patterns = [
    /data-author=(?:"|')([^"']+)(?:"|')/i,
    /<a[^>]+href=(?:"|')[^"']*\/profile\/[^"']*(?:"|')[^>]*>([\s\S]*?)<\/a>/i,
    /<span[^>]+itemprop=(?:"|')name(?:"|')[^>]*>([\s\S]*?)<\/span>/i,
  ];
  for (const p of patterns) {
    const m = articleHtml.match(p);
    if (m?.[1]) {
      const author = htmlToText(m[1]).trim();
      if (author) return author;
    }
  }
  return '';
}

// ---------------------------------------------------------------------------
// Post ID extraction
// ---------------------------------------------------------------------------

function extractPostId(articleHtml) {
  const patterns = [
    /data-commentid=(?:"|')([^"']+)(?:"|')/i,
    /id=(?:"|')elComment_([^"']+)(?:"|')/i,
  ];
  for (const p of patterns) {
    const m = articleHtml.match(p);
    if (m?.[1]) return m[1];
  }
  return '';
}

// ---------------------------------------------------------------------------
// Timestamp extraction
// ---------------------------------------------------------------------------

function extractTimestamp(articleHtml) {
  const m = articleHtml.match(/<time\b[^>]*datetime=(?:"|')([^"']+)(?:"|')[^>]*>/i);
  return m?.[1] ?? '';
}

// ---------------------------------------------------------------------------
// Main post extractor
// ---------------------------------------------------------------------------

/**
 * Extract posts from Invision forum HTML.
 *
 * @param {string} html - Full page HTML
 * @param {object} [calibration] - Optional calibration overrides
 * @param {number} [pageNumber=1]
 * @returns {{ posts: Array<{author, postId, when, pageNumber, text}>, html: string }}
 */
export function parseInvision(html, calibration = {}, pageNumber = 1) {
  const articles = (html ?? '').toString().match(/<article\b[\s\S]*?<\/article>/gi) ?? [];
  const posts = [];

  for (const a of articles) {
    const hasContent = /commentContent/i.test(a) || /data-role=(?:"|')commentContent(?:"|')/i.test(a);
    const looksLikePost = /cPost|ipsComment|data-comment/i.test(a);
    if (!hasContent && !looksLikePost) continue;

    const author = extractAuthor(a);
    const postId = extractPostId(a);
    const when = extractTimestamp(a);

    // Strip blockquotes (quoted replies)
    const cleaned = a.replace(/<blockquote\b[\s\S]*?<\/blockquote>/gi, ' ');
    const text = cleanPostText(htmlToText(cleaned), calibration.min_post_length || 80);

    if (!text) continue;
    posts.push({ author, postId, when, pageNumber, text });
  }

  return { posts, html };
}
