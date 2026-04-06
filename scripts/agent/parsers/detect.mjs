/**
 * detect.mjs — Auto-detect forum software type from HTML.
 *
 * Returns a parser key: 'invision', 'phpbb', 'xenforo', 'vbulletin', or 'generic'.
 */

const SIGNATURES = [
  {
    key: 'invision',
    patterns: [
      /ips(?:Community|\.?suite)/i,
      /cPost/i,
      /data-role=(?:"|')commentContent(?:"|')/i,
      /elComment_/i,
      /ipsComment/i,
    ],
    minMatches: 2,
  },
  {
    key: 'xenforo',
    patterns: [
      /xenforo/i,
      /class=(?:"|')message-content/i,
      /data-author=/i,
      /class=(?:"|')bbWrapper/i,
      /js-post/i,
    ],
    minMatches: 2,
  },
  {
    key: 'phpbb',
    patterns: [
      /phpbb/i,
      /class=(?:"|')postbody/i,
      /class=(?:"|')post\s/i,
      /id=(?:"|')p\d+(?:"|')/i,
      /viewtopic\.php/i,
    ],
    minMatches: 2,
  },
  {
    key: 'vbulletin',
    patterns: [
      /vbulletin/i,
      /class=(?:"|')postcontent/i,
      /id=(?:"|')post_message_\d+(?:"|')/i,
      /showthread\.php/i,
      /class=(?:"|')bigusername/i,
    ],
    minMatches: 2,
  },
];

/**
 * Detect forum software type from a page's HTML.
 *
 * @param {string} html - Raw HTML of a forum page
 * @returns {string} - Parser key
 */
export function detectForumType(html) {
  const h = (html || '').toString();
  if (h.length < 100) return 'generic';

  for (const sig of SIGNATURES) {
    const matches = sig.patterns.filter(p => p.test(h)).length;
    if (matches >= sig.minMatches) return sig.key;
  }

  return 'generic';
}
