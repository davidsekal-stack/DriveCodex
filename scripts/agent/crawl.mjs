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
import { parseWoltlab } from './parsers/woltlab.mjs';
import {
  htmlToText,
  extractTitle,
  buildThreadText,
  extractThreadLinks,
  extractThreadLinksBySelector,
  findNextPageLink,
  selectPosts,
} from './parsers/common.mjs';
import { classifyThread } from './classify.mjs';
import { extractCases } from './extract.mjs';
import { validateCase } from './validate.mjs';
import { fetchHtml } from './fetch-utils.mjs';
import { canonicalizeThreadUrl, canonicalizeTraversalUrl } from './url-utils.mjs';

// ---------------------------------------------------------------------------
// Parser dispatch
// ---------------------------------------------------------------------------

const PARSERS = {
  invision: parseInvision,
  xenforo: parseXenforo,
  phpbb: parsePhpbb,
  woltlab: parseWoltlab,
  vbulletin: parseGeneric, // vBulletin uses generic with calibration-driven selectors
  generic: parseGeneric,
};

function parseHtml(html, parserKey, calibration, pageNumber) {
  // Honor LLM-calibrated CSS selectors first — they work across every forum
  // engine (incl. JS platforms like VerticalScope "Fora" that the regex
  // engine parsers miss). Fall back to the engine parser only if selectors
  // are absent or yield too little.
  if (calibration?.post_selector) {
    const selected = selectPosts(html, calibration, pageNumber);
    if (selected.length >= 2) return { posts: selected };
  }
  const parser = PARSERS[parserKey] || PARSERS.generic;
  return parser(html, calibration, pageNumber);
}

export function isLikelyThreadUrl(url) {
  const value = (url ?? '').toString();
  return (
    /\/topic\/|(?:\/|\?)thread\/|viewtopic|showthread|\/threads\/|(?:\/|\?)t\d|\/discussion\//i.test(value) &&
    !/\/blogs?\/|\/tests?\/|\/news\/|\/articles?\/|\/reviews?\//i.test(value)
  );
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
    let html = await fetchHtml(currentUrl, { cookie: calibration.cookie });
    if (pageNumber === 1) {
      // Auto-detect forum type on first page if parser is unknown/generic
      if (!resolvedParser || resolvedParser === 'generic' || resolvedParser === 'unknown') {
        const detected = detectForumType(html);
        if (detected !== 'generic') {
          resolvedParser = detected;
        }
      }

      // JS-rendered shell: HTTP 200 but no parseable posts. Re-fetch page 1 via
      // a headless browser render once so SPA forums aren't silently discarded.
      let posts = parseHtml(html, resolvedParser, calibration, pageNumber).posts;
      if (posts.length === 0) {
        const rendered = await fetchHtml(currentUrl, { cookie: calibration.cookie, forceBrowser: true })
          .catch(() => null);
        if (rendered) {
          html = rendered;
          if (!resolvedParser || resolvedParser === 'generic' || resolvedParser === 'unknown') {
            const detected = detectForumType(html);
            if (detected !== 'generic') resolvedParser = detected;
          }
          posts = parseHtml(html, resolvedParser, calibration, pageNumber).posts;
        }
      }
      firstPageHtml = html;
      allPosts.push(...posts);
    } else {
      const { posts } = parseHtml(html, resolvedParser, calibration, pageNumber);
      allPosts.push(...posts);
    }

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

export async function enumerateThreadUrls(forum, calibration, maxThreads, sleepMs, options = {}) {
  const sections = safeJsonParse(forum.sections_json, []);
  const urls = [];
  const seen = new Set();
  const fetcher = options.fetchHtmlImpl ?? fetchHtml;
  const maxSectionPages = options.maxSectionPages ?? (Number(calibration.max_section_pages) || 10);
  const forumRootUrl = canonicalizeTraversalUrl(forum.url);

  // If no sections configured, try the forum URL itself as a section
  const sectionUrls = sections.length > 0
    ? sections.map(s => typeof s === 'string' ? s : s.url).filter(Boolean)
    : [forum.url];

  async function enumerateSection(rootSectionUrl, pageLimit = maxSectionPages) {
    if (urls.length >= maxThreads) return { hadError: false };

    let sectionUrl = canonicalizeTraversalUrl(rootSectionUrl);
    const seenSectionPages = new Set();
    let sectionPageCount = 0;
    let hadError = false;

    while (sectionUrl && urls.length < maxThreads && sectionPageCount < pageLimit) {
      if (seenSectionPages.has(sectionUrl)) break;
      seenSectionPages.add(sectionUrl);
      sectionPageCount++;

      try {
        const html = await fetcher(sectionUrl, { cookie: calibration.cookie });

        let links = [];
        if (calibration.thread_list_selector) {
          links = extractThreadLinksBySelector(html, sectionUrl, calibration.thread_list_selector);
        }
        if (links.length === 0) {
          links = extractThreadLinks(html, sectionUrl);
        }

        const threadLinks = links
          .map(link => ({
            ...link,
            url: canonicalizeThreadUrl(link.url),
          }))
          .filter(link => isLikelyThreadUrl(link.url));

        for (const link of threadLinks) {
          if (urls.length >= maxThreads) break;
          if (seen.has(link.url)) continue;
          seen.add(link.url);
          urls.push(link);
        }

        const nextSectionUrl = findNextPageLink(
          html,
          sectionUrl,
          calibration.section_pagination_selector || calibration.pagination_selector
        );
        sectionUrl = nextSectionUrl ? canonicalizeTraversalUrl(nextSectionUrl) : null;
      } catch (err) {
        console.error(`  Error enumerating ${sectionUrl}: ${err.message}`);
        hadError = true;
        break;
      }

      if (sleepMs && sectionUrl) await new Promise(r => setTimeout(r, sleepMs));
    }

    return { hadError };
  }

  let rootFallbackAttempted = false;
  for (const rootSectionUrl of sectionUrls) {
    const result = await enumerateSection(rootSectionUrl);
    if (urls.length >= maxThreads) break;

    if (
      !rootFallbackAttempted &&
      urls.length === 0 &&
      sections.length > 0 &&
      forumRootUrl &&
      canonicalizeTraversalUrl(rootSectionUrl) !== forumRootUrl &&
      result?.hadError
    ) {
      rootFallbackAttempted = true;
      console.warn(`  Section enumeration failed early for ${forum.url}; trying forum root immediately.`);
      await enumerateSection(forum.url, 1);
      if (urls.length > 0) break;
    }
  }

  if (
    urls.length === 0 &&
    !rootFallbackAttempted &&
    sections.length > 0 &&
    forumRootUrl &&
    !sectionUrls.some(url => canonicalizeTraversalUrl(url) === forumRootUrl)
  ) {
    console.warn(`  Section enumeration yielded no threads for ${forum.url}; retrying forum root.`);
    await enumerateSection(forum.url, 1);
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
 * @param {string} [opts.apiKey] - DeepSeek API key (only used for tasks
 *   routed to DeepSeek — see llm.mjs)
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
        // Keep 30K of body HTML for diagnosis — skip <head> (GDPR scripts)
        html: (() => { const b = html.indexOf('<body'); return (b !== -1 ? html.slice(b) : html).slice(0, 30_000); })(),
        threadText,
        title,
        pageCount,
      };
    },

    /**
     * Classify a thread — L2 routed-LLM classifier.
     */
    async classify(threadText) {
      if (sleepMs) await new Promise(r => setTimeout(r, sleepMs));
      return classifyThread(threadText, { apiKey });
    },

    /**
     * Extract cases from a classified thread — L3 routed-LLM extractor.
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
