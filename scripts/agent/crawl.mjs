/**
 * crawl.mjs — Fetch + parse module for the autonomous crawl agent.
 *
 * Handles HTTP fetching with rate limiting, parser dispatch based on
 * forum type detection or calibration config, and thread URL enumeration.
 *
 * Usage:
 *   import { createCrawlPipeline } from './crawl.mjs';
 */

import { detectForumType } from './parsers/detect.mjs';
import { parseInvision } from './parsers/invision.mjs';
import { parseXenforo } from './parsers/xenforo.mjs';
import { parsePhpbb } from './parsers/phpbb.mjs';
import { parseGeneric } from './parsers/generic.mjs';
import {
  htmlToText,
  extractTitle,
  buildThreadText,
  extractThreadLinks,
  findNextPageLink,
} from './parsers/common.mjs';
import { classifyThread } from './classify.mjs';
import { extractCases } from './extract.mjs';
import { validateCase } from './validate.mjs';

// ---------------------------------------------------------------------------
// HTTP fetch with retries
// ---------------------------------------------------------------------------

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,cs;q=0.8,de;q=0.7',
};

async function fetchHtml(url, options = {}) {
  const maxRetries = options.maxRetries ?? 2;
  const headers = { ...DEFAULT_HEADERS };
  if (options.cookie) headers.Cookie = options.cookie;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);

      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timeout);

      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) {
          // Retry on rate limit or server error
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            continue;
          }
        }
        throw new Error(`HTTP ${res.status} fetching ${url}`);
      }

      return await res.text();
    } catch (err) {
      if (attempt >= maxRetries) throw err;
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
}

// ---------------------------------------------------------------------------
// Parser dispatch
// ---------------------------------------------------------------------------

const PARSERS = {
  invision: parseInvision,
  xenforo: parseXenforo,
  phpbb: parsePhpbb,
  vbulletin: parseGeneric, // vBulletin uses generic with calibration-driven selectors
  generic: parseGeneric,
};

function parseHtml(html, parserKey, calibration, pageNumber) {
  const parser = PARSERS[parserKey] || PARSERS.generic;
  return parser(html, calibration, pageNumber);
}

// ---------------------------------------------------------------------------
// Multi-page thread fetching
// ---------------------------------------------------------------------------

async function fetchThreadPages(url, parserKey, calibration, sleepMs) {
  const allPosts = [];
  let currentUrl = url;
  let pageNumber = 1;
  let firstPageHtml = '';
  let resolvedParser = parserKey;
  const maxPages = 10;

  while (currentUrl && pageNumber <= maxPages) {
    const html = await fetchHtml(currentUrl, { cookie: calibration.cookie });
    if (pageNumber === 1) {
      firstPageHtml = html;
      // Auto-detect forum type on first page if parser is unknown/generic
      if (!resolvedParser || resolvedParser === 'generic' || resolvedParser === 'unknown') {
        const detected = detectForumType(html);
        if (detected !== 'generic') {
          resolvedParser = detected;
        }
      }
    }

    const { posts } = parseHtml(html, resolvedParser, calibration, pageNumber);
    allPosts.push(...posts);

    // Look for next page
    const nextUrl = findNextPageLink(html, currentUrl, calibration.pagination_selector);
    if (nextUrl && nextUrl !== currentUrl) {
      currentUrl = nextUrl;
      pageNumber++;
      if (sleepMs) await new Promise(r => setTimeout(r, sleepMs));
    } else {
      break;
    }
  }

  return { posts: allPosts, html: firstPageHtml, pageCount: pageNumber };
}

// ---------------------------------------------------------------------------
// Thread URL enumeration from forum sections
// ---------------------------------------------------------------------------

async function enumerateThreadUrls(forum, calibration, maxThreads, sleepMs) {
  const sections = safeJsonParse(forum.sections_json, []);
  const urls = [];
  const seen = new Set();

  // If no sections configured, try the forum URL itself as a section
  const sectionUrls = sections.length > 0
    ? sections.map(s => typeof s === 'string' ? s : s.url).filter(Boolean)
    : [forum.url];

  for (const sectionUrl of sectionUrls) {
    if (urls.length >= maxThreads) break;

    try {
      const html = await fetchHtml(sectionUrl, { cookie: calibration.cookie });

      // Use calibrated thread list selector, or try generic link extraction
      const links = extractThreadLinks(html, sectionUrl);

      // Filter to likely thread URLs (heuristic: contain topic/thread/viewtopic keywords)
      const threadLinks = links.filter(l =>
        /\/topic\/|\/thread\/|viewtopic|\/threads\/|\/t\d|\/discussion\//i.test(l.url)
      );

      for (const link of threadLinks) {
        if (urls.length >= maxThreads) break;
        if (seen.has(link.url)) continue;
        seen.add(link.url);
        urls.push(link);
      }
    } catch (err) {
      console.error(`  Error enumerating ${sectionUrl}: ${err.message}`);
    }

    if (sleepMs) await new Promise(r => setTimeout(r, sleepMs));
  }

  return urls;
}

// ---------------------------------------------------------------------------
// Pipeline factory — used by orchestrator and calibration
// ---------------------------------------------------------------------------

/**
 * Create a complete crawl pipeline with all stages wired.
 *
 * @param {object} opts
 * @param {number} [opts.sleepMs=600] - Delay between HTTP requests
 * @param {string} [opts.apiKey] - DeepSeek API key
 * @param {string} [opts.model] - DeepSeek model name
 * @returns {object} Pipeline functions for orchestrator/calibration
 */
export function createCrawlPipeline(opts = {}) {
  const sleepMs = opts.sleepMs ?? 600;
  const apiKey = opts.apiKey || process.env.DEEPSEEK_API_KEY;

  return {
    /**
     * Sample thread URLs from a forum for calibration probing.
     */
    async sampleThreadUrls(forum, count) {
      const calibration = safeJsonParse(forum.calibration_json);
      const allUrls = await enumerateThreadUrls(forum, calibration, count * 3, sleepMs);
      // Shuffle and take `count`
      const shuffled = allUrls.sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count).map(l => l.url);
    },

    /**
     * Fetch a thread URL and parse it into structured data.
     */
    async fetchAndParse(url, calibration = {}) {
      const parserKey = calibration.parser || 'generic';
      const { posts, html, pageCount } = await fetchThreadPages(url, parserKey, calibration, sleepMs);
      const title = extractTitle(html);
      const threadText = buildThreadText({ url, title, posts });

      return {
        posts,
        html: html.slice(0, 5000), // Keep first 5K for diagnosis
        threadText,
        title,
        pageCount,
      };
    },

    /**
     * Classify a thread — L2 DeepSeek classifier.
     */
    async classify(threadText) {
      if (sleepMs) await new Promise(r => setTimeout(r, sleepMs));
      return classifyThread(threadText, { apiKey });
    },

    /**
     * Extract cases from a classified thread — L3 DeepSeek extractor.
     */
    async extract(threadText, classifierResult) {
      if (sleepMs) await new Promise(r => setTimeout(r, sleepMs));
      return extractCases(threadText, classifierResult, { apiKey });
    },

    /**
     * Validate extracted case — L4 deterministic gates.
     */
    validate(caseData, threadText) {
      return validateCase(caseData, { threadText });
    },
  };
}

// ---------------------------------------------------------------------------
// Full thread processing — fetch → parse → classify → extract → validate
// ---------------------------------------------------------------------------

/**
 * Process a single thread URL through the full pipeline.
 *
 * @param {string} url
 * @param {object} calibration
 * @param {object} pipeline - From createCrawlPipeline()
 * @returns {Promise<{ threadText, title, cases: Array<{case, validation}>, skipped: string|null }>}
 */
export async function processThread(url, calibration, pipeline) {
  // Fetch & parse
  const parseResult = await pipeline.fetchAndParse(url, calibration);
  if (!parseResult.posts || parseResult.posts.length < 2) {
    return { threadText: '', title: '', cases: [], skipped: 'Too few posts' };
  }

  // Classify
  const classification = await pipeline.classify(parseResult.threadText);
  if (!classification.approved) {
    return {
      threadText: parseResult.threadText,
      title: parseResult.title,
      cases: [],
      skipped: `Classifier rejected: ${classification.reason}`,
    };
  }

  // Extract
  const rawCases = await pipeline.extract(parseResult.threadText, classification);
  if (!rawCases || rawCases.length === 0) {
    return {
      threadText: parseResult.threadText,
      title: parseResult.title,
      cases: [],
      skipped: 'Extractor returned no cases',
    };
  }

  // Validate each case
  const cases = rawCases.map(c => ({
    case: c,
    validation: pipeline.validate(c, parseResult.threadText),
  }));

  return {
    threadText: parseResult.threadText,
    title: parseResult.title,
    cases,
    skipped: null,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeJsonParse(str, fallback = {}) {
  try {
    return JSON.parse(str || JSON.stringify(fallback)) || fallback;
  } catch {
    return fallback;
  }
}
