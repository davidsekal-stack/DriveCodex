/**
 * generic.mjs — Fallback parser using calibration CSS selector hints.
 *
 * When no specific forum software is detected, this parser uses
 * calibration config (from Codex diagnosis) to extract posts.
 * If no calibration exists, it falls back to simple heuristic extraction.
 */

import { htmlToText, cleanPostText } from './common.mjs';

// ---------------------------------------------------------------------------
// Regex-based CSS selector simulation
// ---------------------------------------------------------------------------

/**
 * Extract HTML elements matching a simple CSS class selector.
 * Supports: .classname, tag.classname, tag[attr="val"]
 */
function selectByClass(html, className) {
  if (!className) return [];
  // Escape special regex chars in class name
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<(\\w+)\\b[^>]*class=(?:"|')[^"']*\\b${escaped}\\b[^"']*(?:"|')[^>]*>[\\s\\S]*?<\\/\\1>`,
    'gi'
  );
  return [...(html || '').matchAll(re)].map(m => m[0]);
}

/**
 * Extract text from elements matching a simple selector within a container.
 */
function extractTextBySelector(html, selector) {
  if (!selector) return '';
  // Handle simple class-based selectors: .foo or div.foo
  const classMatch = selector.match(/(?:\w+)?\.([a-zA-Z0-9_-]+)/);
  if (classMatch) {
    const elements = selectByClass(html, classMatch[1]);
    return elements.map(el => htmlToText(el).trim()).filter(Boolean).join('\n');
  }
  // Handle attribute selectors: [data-role="commentContent"]
  const attrMatch = selector.match(/\[([a-zA-Z-]+)=(?:"|')([^"']+)(?:"|')\]/);
  if (attrMatch) {
    const re = new RegExp(
      `<(\\w+)\\b[^>]*${attrMatch[1]}=(?:"|')${attrMatch[2]}(?:"|')[^>]*>([\\s\\S]*?)<\\/\\1>`,
      'gi'
    );
    return [...(html || '').matchAll(re)].map(m => htmlToText(m[2]).trim()).filter(Boolean).join('\n');
  }
  return '';
}

// ---------------------------------------------------------------------------
// Heuristic post extraction (no calibration)
// ---------------------------------------------------------------------------

function heuristicExtract(html, pageNumber) {
  const posts = [];

  // Try common post container patterns
  const containers =
    html.match(/<div\b[^>]*class=(?:"|')[^"']*\bpost(?:body|content|_content)\b[^"']*(?:"|')[\s\S]*?<\/div>/gi) ||
    html.match(/<article\b[\s\S]*?<\/article>/gi) ||
    [];

  for (const container of containers) {
    const stripped = container.replace(/<blockquote\b[\s\S]*?<\/blockquote>/gi, ' ');
    const text = cleanPostText(htmlToText(stripped), 80);
    if (!text) continue;

    // Try to find author
    const authorMatch = container.match(/data-author=(?:"|')([^"']+)(?:"|')/i)
      || container.match(/<a\b[^>]*class=(?:"|')[^"']*\busername\b[^"']*(?:"|')[^>]*>([\s\S]*?)<\/a>/i);
    const author = authorMatch ? htmlToText(authorMatch[1]).trim() : '';

    const timeMatch = container.match(/<time\b[^>]*datetime=(?:"|')([^"']+)(?:"|')[^>]*>/i);
    const when = timeMatch?.[1] ?? '';

    posts.push({ author, postId: '', when, pageNumber, text });
  }

  return posts;
}

// ---------------------------------------------------------------------------
// Calibration-driven extraction
// ---------------------------------------------------------------------------

function calibratedExtract(html, calibration, pageNumber) {
  const postSelector = calibration.post_selector;
  const contentSelector = calibration.content_selector;
  const authorSelector = calibration.author_selector;
  const quoteSelector = calibration.quote_selector;
  const dateSelector = calibration.date_selector;
  const minLen = calibration.min_post_length || 80;

  if (!postSelector) return heuristicExtract(html, pageNumber);

  // Extract post containers
  const classMatch = postSelector.match(/(?:\w+)?\.([a-zA-Z0-9_-]+)/);
  let containers = [];
  if (classMatch) {
    containers = selectByClass(html, classMatch[1]);
  }
  if (containers.length === 0) return heuristicExtract(html, pageNumber);

  const posts = [];
  for (const container of containers) {
    // Strip quotes
    let bodyHtml = container;
    if (quoteSelector) {
      const qClass = quoteSelector.match(/(?:\w+)?\.([a-zA-Z0-9_-]+)/);
      if (qClass) {
        const qRe = new RegExp(
          `<\\w+\\b[^>]*class=(?:"|')[^"']*\\b${qClass[1]}\\b[^"']*(?:"|')[^>]*>[\\s\\S]*?<\\/\\w+>`,
          'gi'
        );
        bodyHtml = bodyHtml.replace(qRe, ' ');
      }
    } else {
      bodyHtml = bodyHtml.replace(/<blockquote\b[\s\S]*?<\/blockquote>/gi, ' ');
    }

    // Extract content
    let text = '';
    if (contentSelector) {
      text = extractTextBySelector(bodyHtml, contentSelector);
    }
    if (!text) text = htmlToText(bodyHtml);
    text = cleanPostText(text, minLen);
    if (!text) continue;

    // Author
    let author = '';
    if (authorSelector) author = extractTextBySelector(container, authorSelector);
    if (!author) {
      const am = container.match(/data-author=(?:"|')([^"']+)(?:"|')/i);
      if (am) author = htmlToText(am[1]).trim();
    }

    // Timestamp
    let when = '';
    if (dateSelector) when = extractTextBySelector(container, dateSelector);
    if (!when) {
      const tm = container.match(/<time\b[^>]*datetime=(?:"|')([^"']+)(?:"|')[^>]*>/i);
      when = tm?.[1] ?? '';
    }

    posts.push({ author, postId: '', when, pageNumber, text });
  }

  return posts.length > 0 ? posts : heuristicExtract(html, pageNumber);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generic forum parser — uses calibration config or falls back to heuristics.
 */
export function parseGeneric(html, calibration = {}, pageNumber = 1) {
  const posts = Object.keys(calibration).length > 1
    ? calibratedExtract(html, calibration, pageNumber)
    : heuristicExtract(html, pageNumber);

  return { posts, html };
}
