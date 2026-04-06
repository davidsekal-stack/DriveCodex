/**
 * xenforo.mjs — Parser for XenForo forums.
 *
 * XenForo uses article.message containers with data-author attributes
 * and .message-content / .bbWrapper for post body.
 */

import { htmlToText, cleanPostText } from './common.mjs';

function extractAuthor(articleHtml) {
  const m = articleHtml.match(/data-author=(?:"|')([^"']+)(?:"|')/i);
  return m ? htmlToText(m[1]).trim() : '';
}

function extractPostId(articleHtml) {
  const patterns = [
    /data-content=(?:"|')post-(\d+)(?:"|')/i,
    /id=(?:"|')(?:post-|js-post-)(\d+)(?:"|')/i,
  ];
  for (const p of patterns) {
    const m = articleHtml.match(p);
    if (m?.[1]) return m[1];
  }
  return '';
}

function extractTimestamp(articleHtml) {
  const m = articleHtml.match(/<time\b[^>]*datetime=(?:"|')([^"']+)(?:"|')[^>]*>/i);
  return m?.[1] ?? '';
}

/**
 * Extract posts from XenForo forum HTML.
 */
export function parseXenforo(html, calibration = {}, pageNumber = 1) {
  // XenForo wraps posts in <article class="message ..."> or <div class="message ...">
  const containers = (html ?? '').toString().match(/<article\b[^>]*class=(?:"|')[^"']*\bmessage\b[^"']*(?:"|')[\s\S]*?<\/article>/gi)
    ?? (html ?? '').toString().match(/<div\b[^>]*class=(?:"|')[^"']*\bmessage\b[^"']*(?:"|')[\s\S]*?<\/div>\s*(?=<div\b[^>]*class=(?:"|')[^"']*\bmessage\b|$)/gi)
    ?? [];

  const posts = [];

  for (const container of containers) {
    // Skip non-post messages (alerts, notices)
    if (/\bmessage--notice\b|\balert\b/i.test(container)) continue;

    const author = extractAuthor(container);
    const postId = extractPostId(container);
    const when = extractTimestamp(container);

    // Find content body — bbWrapper or message-content
    let bodyHtml = container;
    const bbMatch = container.match(/<div\b[^>]*class=(?:"|')[^"']*\bbbWrapper\b[^"']*(?:"|')[^>]*>([\s\S]*?)<\/div>/i);
    if (bbMatch) bodyHtml = bbMatch[1];

    // Strip quotes
    bodyHtml = bodyHtml.replace(/<blockquote\b[\s\S]*?<\/blockquote>/gi, ' ');
    const text = cleanPostText(htmlToText(bodyHtml), calibration.min_post_length || 80);

    if (!text) continue;
    posts.push({ author, postId, when, pageNumber, text });
  }

  return { posts, html };
}
