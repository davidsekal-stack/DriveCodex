/**
 * phpbb.mjs — Parser for phpBB forums.
 *
 * phpBB uses <div class="postbody"> containers inside <div class="post">.
 */

import { htmlToText, cleanPostText } from './common.mjs';

function extractAuthor(postHtml) {
  const patterns = [
    /<a\b[^>]*class=(?:"|')[^"']*\busername\b[^"']*(?:"|')[^>]*>([\s\S]*?)<\/a>/i,
    /<span\b[^>]*class=(?:"|')[^"']*\busername\b[^"']*(?:"|')[^>]*>([\s\S]*?)<\/span>/i,
  ];
  for (const p of patterns) {
    const m = postHtml.match(p);
    if (m?.[1]) {
      const author = htmlToText(m[1]).trim();
      if (author) return author;
    }
  }
  return '';
}

function extractPostId(postHtml) {
  const m = postHtml.match(/id=(?:"|')p(\d+)(?:"|')/i)
    || postHtml.match(/id=(?:"|')post_content(\d+)(?:"|')/i);
  return m?.[1] ?? '';
}

function extractTimestamp(postHtml) {
  // phpBB often uses <time datetime="...">
  const m = postHtml.match(/<time\b[^>]*datetime=(?:"|')([^"']+)(?:"|')[^>]*>/i);
  if (m) return m[1];
  // Fallback: look for datestring in post details
  return '';
}

/**
 * Extract posts from phpBB forum HTML.
 */
export function parsePhpbb(html, calibration = {}, pageNumber = 1) {
  // phpBB wraps each post in <div class="post ..."> or <div id="pNNNN">
  const containers = (html ?? '').toString().match(/<div\b[^>]*(?:class=(?:"|')[^"']*\bpost\b[^"']*(?:"|')|id=(?:"|')p\d+(?:"|'))[\s\S]*?(?=<div\b[^>]*(?:class=(?:"|')[^"']*\bpost\b|id=(?:"|')p\d+)|<\/div>\s*<!--\s*\/post|$)/gi) ?? [];

  const posts = [];

  for (const container of containers) {
    // Must contain postbody
    if (!/postbody/i.test(container)) continue;

    const author = extractAuthor(container);
    const postId = extractPostId(container);
    const when = extractTimestamp(container);

    // Extract postbody content
    let bodyHtml = container;
    const bodyMatch = container.match(/<div\b[^>]*class=(?:"|')[^"']*\bpostbody\b[^"']*(?:"|')[^>]*>([\s\S]*)/i);
    if (bodyMatch) bodyHtml = bodyMatch[1];

    // Strip quotes
    bodyHtml = bodyHtml.replace(/<blockquote\b[\s\S]*?<\/blockquote>/gi, ' ');
    const text = cleanPostText(htmlToText(bodyHtml), calibration.min_post_length || 80);

    if (!text) continue;
    posts.push({ author, postId, when, pageNumber, text });
  }

  return { posts, html };
}
