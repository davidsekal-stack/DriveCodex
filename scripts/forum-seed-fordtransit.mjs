#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  appendJsonLine,
  buildThreadText,
  canonicalizeSymptoms,
  computeLocalId,
  ensureArrayOfStrings,
  extractTitleFromHtml,
  extractedCaseUsesUnresolvedResolutionPost,
  htmlToText,
  isClassifierApproved,
  isReadyRecord,
  isReviewWorthClassifier,
  normalizeEvidencePosts,
  normalizeText,
  parsePostMetaFromThreadText,
  parsePostTextByNumber,
  pickEnginePower,
  safeParseJsonArray,
  safeParseJsonObject,
  selectCatalogForMarket,
  toIsoOrNow,
  validateExtractedCaseAuthor,
  writeJsonFileUnique,
} from "./forum-seed.mjs";
import { resolveFordVehicleModel } from "./forum-seed-ford.mjs";
import { deepseekChatJson } from "./tsb-review-nhtsa-ai.mjs";

const DEFAULT_INPUTS = ["https://fordtransit.org/forum/viewforum.php?f=2"];
const DEFAULT_FORUM = "fordtransit_org";
const DEFAULT_USER_ID = "ai_importer";
const DEFAULT_MODEL = "deepseek-v4-flash";
const DEFAULT_MIN_REPLIES = 1;

const TOPIC_BLACKLIST = [
  /\bradio\s+codes?\b/i,
  /\bmanuals?\b/i,
  /\bowners?\s+manual\b/i,
  /\bforum\s+rules?\b/i,
  /\bwe\s+need\s+axle\s+info\b/i,
  /\baxle\s+info\b/i,
  /\bwhat\s+relay\b/i,
  /\bwheel\s+nut\s+size\b/i,
  /\benginecode\s*\/\s*model\b/i,
  /\bideal\s+operating\s+rpm\b/i,
  /\brepair\s+recommendations?\b/i,
  /\bwhat\s+is\s+this\b/i,
  /\bwhat\s+it\s+does\b/i,
  /\bnewbie\s+question\b/i,
  /\bthrow\s+light\s+on\s+this\b/i,
  /\breliab(?:le|ility)\b/i,
  /\bpart\s+number\b/i,
  /\bpart\s+no\.?\b/i,
  /\bcode\s+difference\b/i,
  /\bpaint\s+code\b/i,
  /\bpurpose\s+of\b/i,
  /^\s*watch\b/i,
  /\bmeasurements?\b/i,
  /\bdimensions?\b/i,
  /\btyre\s+pressures?\b/i,
  /\btow\s+capacity\b/i,
  /\broad\s+tax\b/i,
  /\bhow\s+to\b/i,
  /\bplease\s+help\b/i,
  /\bneed\s+help\b/i,
  /\broof\s+rack\b/i,
  /\bwheel\s+trims?\b/i,
  /\bretrofit\b/i,
  /\btowbar\b/i,
  /\bengine\s+swap\b/i,
  /\bgearbox\s+conversion\b/i,
  /\bseat\s+belt\s+retrofit\b/i,
  /\bcamera\s+fitting\b/i,
  /\bwet\s+belt\s+conversion\b/i,
  /\bconnector\s+removal\b/i,
  /\bremoval\s+technique\b/i,
  /\bwhat\s+alloys\s+will\s+fit\b/i,
  /\bcambelt\s+change\s+intervals?\b/i,
  /\bservicing\b/i,
  /\bhow\s+easy\s+to\s+service\b/i,
  /\bnot\s+on\s+insurance\s+databases\b/i,
  /\b\d+ps\s*(?:v|vs|vrs|-)\s*\d+ps\b/i,
];

const GENERIC_TITLE_PATTERNS = [
  /^\s*help\b/i,
  /^\s*please\b/i,
  /^\s*advice\b/i,
  /^\s*question\b/i,
  /^\s*turbo\s*$/i,
  /^\s*engine\s+problem(?:s)?\s*$/i,
  /^\s*anyone\s+know\b/i,
  /^\s*what\s+is\s+this\b/i,
];

const TITLE_SIGNAL_PATTERNS = [
  /\b[pbcu]\d{4}\b/i,
  /\bmk\s*[3-9]\b/i,
  /\b(transit|tourneo|custom|connect|courier)\b/i,
  /\b(tdci|tddi|ecoblue|duratorq|duratec|ecoboost|adblue|powershift|pinto)\b/i,
  /\b(no\s+start|won['’]t\s+start|doesn['’]t\s+start|slow\s+crank|cuts?\s+out|stall|misfire|smoke|noise|knock|rattle|vibration|judder|limp|overheat|overheating|leak|warning|fault|issue|problem|sensor|injector|turbo|dpf|egr|adblue|alternator|battery|gearbox|transmission|clutch|steering|pump|dmf|dual\s+mass)\b/i,
];

const HARD_FAULT_TITLE_PATTERNS = [
  /\b[pbcu]\d{4}\b/i,
  /\b(no\s+start|won['’]t\s+start|doesn['’]t\s+start|slow\s+crank|cuts?\s+out|stall|misfire|smoke|noise|knock|rattle|vibration|judder|limp|overheat|overheating|leak|warning|fault|issue|problem|sensor|injector|turbo|dpf|egr|adblue|alternator|battery|gearbox|transmission|clutch|steering|pump|dmf|dual\s+mass|immobili[sz]er|crank|hard\s+start|rough\s+idle|lumpy\s+idle)\b/i,
];

const TOOLING_TITLE_PATTERNS = [
  /\bforscan\b/i,
  /\bids\b/i,
  /\bscanner\b/i,
  /\bobd\s+(reader|scanner|adap(?:t|tor))\b/i,
  /\badapter\s+cable\b/i,
  /\belm327\b/i,
  /\bvlinker\b/i,
];

const QUOTE_BLOCK_PATTERNS = [
  /<blockquote\b[\s\S]*?<\/blockquote>/gi,
  /<div class="quotetitle"[\s\S]*?<\/div>/gi,
  /<div class="quotecontent"[\s\S]*?<\/div>/gi,
  /<cite>[\s\S]*?<\/cite>/gi,
];

const INLINE_NOISE_PATTERNS = [
  /<div class="inline-attachment"[\s\S]*?<\/div>/gi,
  /<div class="rules"[\s\S]*?<\/div>/gi,
];

const FORD_ENTRY = selectCatalogForMarket("eu").catalog.find((entry) => normalizeText(entry.brand) === "ford");

if (!FORD_ENTRY) {
  throw new Error("Ford brand entry was not found in web/src/constants/catalog.js");
}

function usage(exitCode = 1) {
  const msg = `
Usage:
  node scripts/forum-seed-fordtransit.mjs <out_dir> [options]
  node scripts/forum-seed-fordtransit.mjs <https://fordtransit.org/forum/viewforum.php?...> <out_dir> [options]
  node scripts/forum-seed-fordtransit.mjs <https://fordtransit.org/forum/viewtopic.php?...> <out_dir> [options]

Options:
  --discover-only  Only gather filtered thread titles and forum inventory
  --keep-review    Store borderline but promising cases into to_review/
  --signals-only   Process only signal-strong titles during the first crawl pass
  --min-replies N  Ignore topic titles with fewer than N replies on the listing page
`.trim();
  console.log(msg);
  process.exit(exitCode);
}

function clampInt(raw, min, max, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : fallback;
}

function parseArgs(argv) {
  const args = {
    inputs: [],
    outDir: null,
    forum: DEFAULT_FORUM,
    userId: DEFAULT_USER_ID,
    sourceUrl: "",
    model: DEFAULT_MODEL,
    maxChars: 60000,
    pages: 999,
    indexPages: 500,
    maxThreads: 50000,
    minReplies: DEFAULT_MIN_REPLIES,
    sleepMs: 250,
    cookie: "",
    keepReview: false,
    discoverOnly: false,
    signalsOnly: false,
    dry: false,
  };

  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === "--help" || value === "-h") usage(0);
    if (value === "--dry") { args.dry = true; continue; }
    if (value === "--keep-review") { args.keepReview = true; continue; }
    if (value === "--discover-only") { args.discoverOnly = true; continue; }
    if (value === "--signals-only") { args.signalsOnly = true; continue; }
    if (value === "--forum") { args.forum = argv[++i] ?? ""; continue; }
    if (value === "--user-id") { args.userId = argv[++i] ?? ""; continue; }
    if (value === "--source-url") { args.sourceUrl = argv[++i] ?? ""; continue; }
    if (value === "--model") { args.model = argv[++i] ?? ""; continue; }
    if (value === "--cookie") { args.cookie = argv[++i] ?? ""; continue; }
    if (value === "--max-chars") { args.maxChars = clampInt(argv[++i], 5000, 200000, args.maxChars); continue; }
    if (value === "--pages") { args.pages = clampInt(argv[++i], 1, 5000, args.pages); continue; }
    if (value === "--index-pages") { args.indexPages = clampInt(argv[++i], 1, 1000, args.indexPages); continue; }
    if (value === "--max-threads") { args.maxThreads = clampInt(argv[++i], 1, 200000, args.maxThreads); continue; }
    if (value === "--min-replies") { args.minReplies = clampInt(argv[++i], 0, 1000, args.minReplies); continue; }
    if (value === "--sleep-ms") { args.sleepMs = clampInt(argv[++i], 0, 30000, args.sleepMs); continue; }
    if (value.startsWith("--")) usage(1);
    positional.push(value);
  }

  if (positional.length === 1) {
    args.inputs = [...DEFAULT_INPUTS];
    args.outDir = positional[0] ?? null;
  } else if (positional.length >= 2) {
    args.inputs = positional.slice(0, -1);
    args.outDir = positional[positional.length - 1] ?? null;
  }

  return args;
}

function logProgress(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (compatible; DriveCodexFordTransitSeed/1.0; +https://example.invalid)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };
}

async function fetchUrl(url, cookie) {
  const headers = defaultHeaders();
  const c = (cookie ?? "").toString().trim();
  if (c) headers.Cookie = c;
  const res = await fetch(url, { method: "GET", headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch URL (${res.status}): ${body.slice(0, 200)}`);
  }
  return await res.text();
}

function makeSafeStem(value) {
  return (value ?? "")
    .toString()
    .replace(/^https?:\/\//i, "")
    .replace(/[^a-z0-9._-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "input";
}

function makeInputStem(input) {
  try {
    const url = new URL(input);
    return makeSafeStem(`${url.hostname}${url.pathname}`);
  } catch {
    return makeSafeStem(path.basename((input ?? "").toString()));
  }
}

function uniqByKey(items, keyFn) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function stripHtmlText(value) {
  return htmlToText((value ?? "").toString()).replace(/\s+/g, " ").trim();
}

function normalizeThreadTitle(value) {
  const text = (value ?? "").toString().trim();
  return text
    .replace(/^Ford Transit Forum\s*[•|]\s*View topic\s*-\s*/i, "")
    .replace(/^Ford Transit Forum\s*[•|]\s*View forum\s*-\s*/i, "")
    .trim();
}

function resolveUrl(baseUrl, href) {
  try {
    return new URL((href ?? "").toString().replace(/&amp;/gi, "&"), baseUrl).toString();
  } catch {
    return "";
  }
}

function extractAllAnchors(html, baseUrl) {
  const out = [];
  const regex = /<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(regex)) {
    const url = resolveUrl(baseUrl, match[2] ?? "");
    if (!url) continue;
    out.push({ url, text: stripHtmlText(match[3] ?? "") });
  }
  return out;
}

function isTopicUrl(url) {
  return /\/viewtopic\.php\b/i.test((url ?? "").toString());
}

function isListingUrl(url) {
  return /\/viewforum\.php\b/i.test((url ?? "").toString());
}

function canonicalTopicUrl(url) {
  const parsed = new URL(url, "https://fordtransit.org/forum/");
  const f = parsed.searchParams.get("f");
  const t = parsed.searchParams.get("t");
  parsed.protocol = "https:";
  parsed.hash = "";
  parsed.search = "";
  if (f) parsed.searchParams.set("f", f);
  if (t) parsed.searchParams.set("t", t);
  return parsed.toString();
}

function canonicalTopicPageUrl(url) {
  const parsed = new URL(url, "https://fordtransit.org/forum/");
  const f = parsed.searchParams.get("f");
  const t = parsed.searchParams.get("t");
  const start = Number(parsed.searchParams.get("start") ?? "0") || 0;
  parsed.protocol = "https:";
  parsed.hash = "";
  parsed.search = "";
  if (f) parsed.searchParams.set("f", f);
  if (t) parsed.searchParams.set("t", t);
  if (start > 0) parsed.searchParams.set("start", String(start));
  return parsed.toString();
}

function canonicalListingUrl(url) {
  const parsed = new URL(url, "https://fordtransit.org/forum/");
  const f = parsed.searchParams.get("f");
  const start = Number(parsed.searchParams.get("start") ?? "0") || 0;
  parsed.protocol = "https:";
  parsed.hash = "";
  parsed.search = "";
  if (f) parsed.searchParams.set("f", f);
  if (start > 0) parsed.searchParams.set("start", String(start));
  return parsed.toString();
}

function getStartOffset(url) {
  try {
    return Number(new URL(url).searchParams.get("start") ?? "0") || 0;
  } catch {
    return 0;
  }
}

function extractNextPageUrl(html, currentUrl, pageKind = "listing") {
  const current = new URL(currentUrl);
  const currentStart = Number(current.searchParams.get("start") ?? "0") || 0;
  const key = pageKind === "topic" ? "t" : "f";
  const expected = current.searchParams.get(key);
  const candidates = [];

  const relNext = (html ?? "").toString().match(/<link\b[^>]*rel=(["'])next\1[^>]*href=(["'])(.*?)\2/i);
  if (relNext?.[3]) {
    const resolved = resolveUrl(currentUrl, relNext[3]);
    if (resolved) candidates.push(resolved);
  }

  for (const anchor of extractAllAnchors(html, currentUrl)) {
    if (pageKind === "topic" && !isTopicUrl(anchor.url)) continue;
    if (pageKind === "listing" && !isListingUrl(anchor.url)) continue;
    try {
      const parsed = new URL(anchor.url);
      if (parsed.searchParams.get(key) !== expected) continue;
      if ((Number(parsed.searchParams.get("start") ?? "0") || 0) <= currentStart) continue;
      candidates.push(anchor.url);
    } catch {}
  }

  const normalized = uniqByKey(candidates, (candidate) => {
    try {
      const parsed = new URL(candidate);
      return pageKind === "topic" ? canonicalTopicPageUrl(parsed.toString()) : canonicalListingUrl(parsed.toString());
    } catch {
      return candidate;
    }
  });

  normalized.sort((a, b) => getStartOffset(a) - getStartOffset(b));
  if (normalized.length < 1) return "";
  return pageKind === "topic" ? canonicalTopicPageUrl(normalized[0]) : canonicalListingUrl(normalized[0]);
}

async function collectPages({ firstHtml, firstUrl, maxPages, cookie, sleepMs, pageKind }) {
  const canonicalize = pageKind === "topic" ? canonicalTopicPageUrl : canonicalListingUrl;
  const pages = [];
  const seen = new Set();
  let currentUrl = canonicalize(firstUrl);
  let currentHtml = firstHtml;

  while (currentUrl && currentHtml && pages.length < maxPages && !seen.has(currentUrl)) {
    pages.push({ url: currentUrl, html: currentHtml });
    seen.add(currentUrl);
    const nextUrl = extractNextPageUrl(currentHtml, currentUrl, pageKind);
    if (!nextUrl || seen.has(nextUrl)) break;
    if (sleepMs > 0) await sleep(sleepMs);
    currentUrl = nextUrl;
    currentHtml = await fetchUrl(currentUrl, cookie);
  }

  return pages;
}

function classifyTopicEntry({ title, replies, rowClass = "", minReplies = DEFAULT_MIN_REPLIES }) {
  const normalizedTitle = normalizeText(title);
  const signal = TITLE_SIGNAL_PATTERNS.some((pattern) => pattern.test(title));
  const hardFaultSignal = HARD_FAULT_TITLE_PATTERNS.some((pattern) => pattern.test(title));
  const sticky = /\bsticky\b|\bannounce\b/i.test(rowClass);

  if (sticky) return { keep: false, signal, reason: "Sticky or announcement thread." };
  if (!normalizedTitle) return { keep: false, signal, reason: "Missing topic title." };
  if ((replies ?? 0) < minReplies) {
    return { keep: false, signal, reason: `Only ${replies ?? 0} replies on listing page.` };
  }
  if (TOPIC_BLACKLIST.some((pattern) => pattern.test(title))) {
    return { keep: false, signal, reason: "Likely non-diagnostic or lookup-only thread." };
  }
  if (TOOLING_TITLE_PATTERNS.some((pattern) => pattern.test(title)) && !hardFaultSignal) {
    return { keep: false, signal, reason: "Likely tooling or diagnostic-device thread." };
  }
  if (GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(title)) && !signal) {
    return { keep: false, signal, reason: "Generic title without a diagnostic signal." };
  }

  const tokenCount = normalizedTitle.split(/\s+/g).filter(Boolean).length;
  if (!signal && tokenCount < 3) {
    return { keep: false, signal, reason: "Too little technical signal in the title." };
  }

  return { keep: true, signal, reason: "" };
}

function extractTopicEntriesFromForumPage(html, listingUrl, minReplies = DEFAULT_MIN_REPLIES) {
  const rows = (html ?? "").toString().match(/<li class="row\b[\s\S]*?<\/li>/gi) ?? [];
  const topics = [];

  for (const row of rows) {
    if (!/class="topictitle"/i.test(row)) continue;
    const rowClass = row.match(/<li class="([^"]+)"/i)?.[1] ?? "";
    const titleMatch = row.match(/<a\b[^>]*href=(["'])(.*?)\1[^>]*class="topictitle"[^>]*>([\s\S]*?)<\/a>/i);
    const href = titleMatch?.[2] ?? "";
    const title = stripHtmlText(titleMatch?.[3] ?? "");
    const url = canonicalTopicUrl(resolveUrl(listingUrl, href));
    const replies = Number(stripHtmlText(row.match(/<dd class="posts">([\s\S]*?)<dfn/i)?.[1] ?? "")) || 0;
    const views = Number(stripHtmlText(row.match(/<dd class="views">([\s\S]*?)<dfn/i)?.[1] ?? "")) || 0;
    const author = stripHtmlText(row.match(/<br\s*\/?>\s*by\s+([\s\S]*?)\s*&raquo;/i)?.[1] ?? "");
    const startedAt = stripHtmlText(row.match(/&raquo;\s*([^<]+)<\/dt>/i)?.[1] ?? "");
    const lastPostAt = stripHtmlText(row.match(/<br\s*\/>([^<]+)<\/span>\s*<\/dd>/i)?.[1] ?? "");
    const decision = classifyTopicEntry({ title, replies, rowClass, minReplies });

    if (!decision.keep && replies < minReplies) {
      topics.push({
        url,
        title,
        replies,
        views,
        author,
        started_at_text: startedAt,
        last_post_at_text: lastPostAt,
        row_class: rowClass,
        keep: false,
        signal: decision.signal,
        discard_reason: `Only ${replies} replies on listing page.`,
      });
      continue;
    }

    topics.push({
      url,
      title,
      replies,
      views,
      author,
      started_at_text: startedAt,
      last_post_at_text: lastPostAt,
      row_class: rowClass,
      keep: decision.keep,
      signal: decision.signal,
      discard_reason: decision.reason,
    });
  }

  return topics;
}

function sanitizePostContentHtml(contentHtml) {
  let cleaned = (contentHtml ?? "").toString();
  for (const pattern of QUOTE_BLOCK_PATTERNS) cleaned = cleaned.replace(pattern, " ");
  for (const pattern of INLINE_NOISE_PATTERNS) cleaned = cleaned.replace(pattern, " ");
  return cleaned;
}

function sanitizePostText(text) {
  return (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(Sent from my .+ using Tapatalk|Top)$/i.test(line))
    .filter((line) => !/^[^\s]+\.(jpg|jpeg|png|gif|webp)$/i.test(line))
    .join("\n")
    .trim();
}

function extractBalancedDivHtml(block, marker) {
  const source = (block ?? "").toString();
  const start = source.indexOf(marker);
  if (start === -1) return "";
  const contentStart = source.indexOf(">", start);
  if (contentStart === -1) return "";

  let depth = 1;
  let index = contentStart + 1;
  const tagRegex = /<\/?div\b[^>]*>/gi;
  tagRegex.lastIndex = index;

  while (depth > 0) {
    const match = tagRegex.exec(source);
    if (!match) return "";
    if (match[0].startsWith("</div")) depth--;
    else depth++;
    if (depth === 0) return source.slice(contentStart + 1, match.index);
    index = tagRegex.lastIndex;
  }

  return "";
}

function extractPostsFromPhpbb(html, pageNumber = 1) {
  const posts = [];
  const blocks = [...(html ?? "").toString().matchAll(
    /<div id="p(\d+)" class="post\b[\s\S]*?(?=<div id="p\d+" class="post\b|<div class="topic-actions"|<div id="page-footer"|$)/gi,
  )];

  for (const blockMatch of blocks) {
    const block = blockMatch[0] ?? "";
    const postId = (blockMatch[1] ?? "").trim();
    const author = stripHtmlText(block.match(/<p class="author">[\s\S]*?by\s+<strong>(?:<a[^>]*>)?([^<]+)(?:<\/a>)?<\/strong>/i)?.[1] ?? "");
    const when = stripHtmlText(block.match(/<p class="author">[\s\S]*?&raquo;\s*([^<]+)<\/p>/i)?.[1] ?? "");
    const contentHtml = extractBalancedDivHtml(block, '<div class="content">');
    const text = sanitizePostText(htmlToText(sanitizePostContentHtml(contentHtml)));
    if (!text) continue;
    posts.push({ author, when, postId, pageNumber, text });
  }

  return posts;
}

async function fetchThreadAsText({ url, pages = 999, cookie = "", forumTitle = "", sleepMs = 0 }) {
  const firstHtml = await fetchUrl(url, cookie);
  const title = normalizeThreadTitle(extractTitleFromHtml(firstHtml));
  const pageItems = await collectPages({
    firstHtml,
    firstUrl: url,
    maxPages: pages,
    cookie,
    sleepMs,
    pageKind: "topic",
  });

  const posts = [];
  for (let i = 0; i < pageItems.length; i++) posts.push(...extractPostsFromPhpbb(pageItems[i].html, i + 1));

  if (posts.length === 0) {
    return { text: htmlToText(firstHtml), title, totalPages: pageItems.length };
  }

  return {
    text: buildThreadText({
      url: canonicalTopicUrl(url),
      title,
      posts: uniqByKey(posts, (post) => post.postId || `${post.author}|${post.when}|${post.text}`),
      forumTitle,
      subforumName: "",
      subforumTitle: forumTitle,
    }),
    title,
    totalPages: pageItems.length,
  };
}

async function discoverThreadsFromForum({ forumUrl, firstHtml = "", indexPages = 500, minReplies = DEFAULT_MIN_REPLIES, cookie = "", sleepMs = 0 }) {
  const forumHtml = firstHtml || await fetchUrl(forumUrl, cookie);
  const forumTitle = extractTitleFromHtml(forumHtml);
  const listingPages = await collectPages({
    firstHtml: forumHtml,
    firstUrl: forumUrl,
    maxPages: indexPages,
    cookie,
    sleepMs,
    pageKind: "listing",
  });

  const discovered = [];
  logProgress(`Listing start: ${forumTitle || forumUrl}`);
  for (let pageIndex = 0; pageIndex < listingPages.length; pageIndex++) {
    const page = listingPages[pageIndex];
    logProgress(`Listing page ${pageIndex + 1}/${listingPages.length}: ${page.url}`);
    const topics = extractTopicEntriesFromForumPage(page.html, page.url, minReplies).map((topic) => ({
      ...topic,
      parentForumTitle: forumTitle,
      subforumName: "",
      subforumTitle: forumTitle,
      subforumUrl: canonicalListingUrl(forumUrl),
    }));
    discovered.push(...topics);
  }

  return {
    forumTitle,
    listingPages: listingPages.length,
    threads: uniqByKey(discovered, (item) => item.url),
  };
}

function buildCatalogReviewId({ forum, sourceUrl, threadTitle, modelRaw }) {
  const input = JSON.stringify({
    forum: forum ?? "",
    source_url: sourceUrl ?? "",
    thread_title: threadTitle ?? "",
    model_raw: modelRaw ?? "",
  });
  return `catalog_${crypto.createHash("sha256").update(input, "utf8").digest("hex").slice(0, 16)}`;
}

function buildReviewId({ forum, sourceUrl, threadTitle, stage }) {
  const input = JSON.stringify({
    forum: forum ?? "",
    source_url: sourceUrl ?? "",
    thread_title: threadTitle ?? "",
    stage: stage ?? "",
  });
  return `review_${crypto.createHash("sha256").update(input, "utf8").digest("hex").slice(0, 16)}`;
}

function detectPotentialCatalogHints(text) {
  const raw = (text ?? "").toString();
  const hints = [];

  if (/\be[- ]?tourneo\s+custom\b/i.test(raw)) hints.push("E-Tourneo Custom Elektro (2024–současnost)");
  if (/\be[- ]?tourneo\s+courier\b/i.test(raw)) hints.push("E-Tourneo Courier Elektro (2024–současnost)");
  if (/\btourneo\s+connect\b/i.test(raw) && /\bphev|plug[- ]?in|hybrid\b/i.test(raw)) {
    hints.push("Tourneo Connect III 1.5 EcoBoost PHEV (2022–současnost)");
  }
  if (/\btourneo\s+connect\b/i.test(raw) && /\becoboost\b/i.test(raw)) {
    hints.push("Tourneo Connect III 1.5 EcoBoost (2022–současnost)");
  }
  if (/\btourneo\s+connect\b/i.test(raw) && /\becoblue|tdci|tdi|diesel\b/i.test(raw)) {
    hints.push("Tourneo Connect III 2.0 EcoBlue (2022–současnost)");
  }
  if (/\btourneo\s+connect\b/i.test(raw) && hints.length < 1) {
    hints.push(
      "Tourneo Connect III 1.5 EcoBoost (2022–současnost)",
      "Tourneo Connect III 2.0 EcoBlue (2022–současnost)",
      "Tourneo Connect III 1.5 EcoBoost PHEV (2022–současnost)",
    );
  }
  if (/\bmk\s*6\b/i.test(raw)) hints.push("Transit Mk6 family mentioned in thread; verify official Ford historical naming before cataloguing.");
  if (/\bmk\s*5\b/i.test(raw)) hints.push("Transit Mk5 family mentioned in thread; verify official Ford historical naming before cataloguing.");
  if (/\bmk\s*[34]\b/i.test(raw)) hints.push("Older Transit generation mentioned in thread; verify before adding to catalog.");

  return [...new Set(hints)];
}

function resolveTransitFamilyVehicleModel({ modelRaw = "", threadTitle = "", parentForumTitle = "", extraText = "" }) {
  const combined = normalizeText([modelRaw, threadTitle, parentForumTitle, extraText].filter(Boolean).join(" | "));
  if (!combined || !/\b(transit|tourneo|connect|custom|courier|t(?:260|280|300|330|350|430)|mk\s*[1-8])\b/.test(combined)) return null;

  const fallbackResolved = sanitizeResolvedTransitModel(resolveFordVehicleModel({
    modelRaw,
    threadTitle,
    parentForumTitle,
  }), combined);

  const has22 = /\b2[\s.]*2(?!\d)/.test(combined);
  const has24 = /\b2[\s.]*4(?!\d)/.test(combined);
  const has32 = /\b3[\s.]*2(?!\d)/.test(combined);
  const has23 = /\b2[\s.]*3(?!\d)/.test(combined);
  const has20 = /\b2[\s.]*0(?!\d)/.test(combined);
  const has25 = /\b2[\s.]*5(?!\d)/.test(combined);
  const has18 = /\b1[\s.]*8(?!\d)/.test(combined);
  const hasEcoblue = /\becoblue\b/.test(combined);
  const hasConnect = /\bconnect\b/.test(combined);
  const hasCustom = /\bcustom\b/.test(combined);
  const hasTourneo = /\btourneo\b/.test(combined);
  const hasCourier = /\bcourier\b/.test(combined);
  const hasDiesel = /\b(diesel|tdci|tddi|duratorq)\b/.test(combined);
  const hasPetrol = /\b(petrol|duratec|ecoboost)\b/.test(combined);
  const hasEpic = /\bepic\b/.test(combined);
  const hasEsos = /\besos\b/.test(combined);
  const hasEso = /\beso\b/.test(combined) || /\belectronic switch off\b/.test(combined);
  const hasBanana = /\bbanana\b/.test(combined);
  const hasSmiley = /\bsmiley\b/.test(combined);
  const hasP1170 = /\bp1170\b/.test(combined);
  const hasMk1 = /\bmk\s*1\b/.test(combined);
  const hasMk2 = /\bmk\s*2\b/.test(combined);
  const hasMk3 = /\bmk\s*3\b/.test(combined);
  const hasMk4 = /\bmk\s*4\b/.test(combined);
  const hasT260Family = /\bt(?:260|280|300|330|350|430)\b/.test(combined);
  const hasOldPayloadCode = /\b(?:80|100|120|150|160|190)\s*[a-z]?\b/.test(combined);
  const hasPinto = /\bpinto\b/.test(combined);
  const hasDi = /\b2[\s.]*5\s*d[i1]\b/.test(combined) || /\bdi\b/.test(combined);
  const plateMatch = combined.match(/\b([a-z]|\d{2})\s*plate\b/);
  const plateToken = plateMatch?.[1] ?? "";
  const years = [...combined.matchAll(/\b(20\d{2})\b/g)]
    .map((match) => Number(match[1]))
    .filter((year) => Number.isFinite(year));
  const minYear = years.length ? Math.min(...years) : null;
  const maxYear = years.length ? Math.max(...years) : null;
  const looksLegacyTransit = hasSmiley || hasBanana || hasEpic || hasEsos || hasEso || hasP1170 || hasOldPayloadCode || /\b190d\b/.test(combined);
  const looksMk6Transit = hasT260Family || /\b(2000|2001|2002|2003|2004|2005|2006)\b/.test(combined);
  const looksMk7Transit = /\b(2007|2008|2009|2010|2011)\b/.test(combined);
  const looksMk7FlTransit = /\b(2011|2012|2013|2014)\b/.test(combined);
  const looksMk8Transit = /\b(2014|2015|2016)\b/.test(combined);
  const looksModernTransit = /\b(2016|2017|2018|2019|2020|2021|2022|2023|2024|2025|2026)\b/.test(combined);
  const has2018PlusPlate = /\b(18|68|19|69|20|70|21|71|22|72|23|73|24|74|25|75|26|76)\s*plate\b/.test(combined);
  const has2013To2017Plate = /\b(13|63|14|64|15|65|16|66|17|67)\s*plate\b/.test(combined);
  const hasOldConnectYearPrefix = /\b0[2-9]\s+connect\b|\b1[0-3]\s+connect\b/.test(combined);
  const hasConnect15 = /\b1[\s.]*5(?!\d)\b/.test(combined);
  const hasConnect16 = /\b1[\s.]*6(?!\d)\b/.test(combined);

  const plateYearBand = (() => {
    const token = plateToken.toLowerCase();
    if (!token) return "";
    if (["r", "s", "t", "v", "w", "x", "y"].includes(token)) return "mk5";
    if (["51", "02", "52", "03", "53", "04", "54", "05", "55", "06"].includes(token)) return "mk6";
    if (["56", "57", "08", "58", "09", "59", "10", "60"].includes(token)) return "mk7";
    if (["11", "61", "12", "62", "13", "63"].includes(token)) return "mk7fl";
    if (["14", "64", "15", "65"].includes(token)) return "mk8";
    if (["16", "66", "17", "67", "18", "68", "19", "69", "20", "70", "21", "71", "22", "72", "23", "73", "24", "74", "25", "75", "26", "76"].includes(token)) return "mk8_ecoblue";
    return "";
  })();

  if (hasConnect) {
    if ((minYear !== null && minYear >= 2018) || has2018PlusPlate) {
      if (hasTourneo) {
        if ((minYear !== null && minYear >= 2022) || /\b(22|72|23|73|24|74|25|75|26|76)\s*plate\b/.test(combined)) {
          if (/\bphev|plug[- ]?in|hybrid\b/.test(combined)) return "Tourneo Connect III 1.5 EcoBoost PHEV (2022–současnost)";
          if (hasEcoblue || (hasConnect15 && hasDiesel)) return "Tourneo Connect III 2.0 EcoBlue (2022–současnost)";
          if (hasPetrol) return "Tourneo Connect III 1.5 EcoBoost (2022–současnost)";
          return "Tourneo Connect III (2022–současnost)";
        }
        return "Tourneo Connect II (2013–2022)";
      }
      if ((minYear !== null && minYear >= 2024) || /\b(24|74|25|75|26|76)\s*plate\b/.test(combined)) {
        if (/\bphev|plug[- ]?in|hybrid\b/.test(combined)) return "Transit Connect III 1.5 EcoBoost PHEV (2024–současnost)";
        if (hasEcoblue || (hasConnect15 && hasDiesel)) return "Transit Connect III 2.0 EcoBlue (2024–současnost)";
      }
      if (hasEcoblue || (hasConnect15 && hasDiesel)) return "Transit Connect II FL 1.5 EcoBlue (2018–2024)";
      return "Transit Connect II FL (2018–2024)";
    }
    if ((minYear !== null && minYear >= 2013) || has2013To2017Plate) {
      if (hasConnect16 && hasDiesel) return "Transit Connect II 1.6 TDCi (2013–2015)";
      if (hasConnect15 && hasDiesel) return "Transit Connect II 1.5 TDCi (2015–2018)";
      if (hasPetrol) {
        return hasTourneo
          ? "Tourneo Connect II (2013–2022)"
          : "Transit Connect II 1.0 EcoBoost (2013–2018)";
      }
      return hasTourneo
        ? "Tourneo Connect II (2013–2022)"
        : "Transit Connect II (2013–2018)";
    }
    if ((has18 && hasDiesel) || ((has18 || hasDiesel) && ((minYear !== null && minYear <= 2013) || hasOldConnectYearPrefix || /\b(04|05|54|55|56|57|58|59)\s*plate\b/.test(combined)))) {
      return hasTourneo
        ? "Tourneo Connect I (2002–2013)"
        : "Transit Connect I 1.8 TDDi/TDCi (2002–2013)";
    }
    if ((minYear !== null && minYear <= 2013) || hasOldConnectYearPrefix || /\b(02|52|03|53|04|54|05|55|06|56|07|57|08|58|09|59|10|60|11|61|12|62|13|63)\s*plate\b/.test(combined)) {
      return hasTourneo
        ? "Tourneo Connect I (2002–2013)"
        : "Transit Connect I (2002–2013)";
    }
  }

  if (hasCustom) {
    if (hasTourneo) {
      if (/\be[- ]?tourneo\s+custom\b/.test(combined)) return "E-Tourneo Custom Elektro (2024–současnost)";
      if (hasEcoblue || has20) {
        if ((minYear !== null && minYear >= 2023) || /\b(23|73|24|74|25|75|26|76)\s*plate\b/.test(combined)) {
          return "Tourneo Custom II 2.0 EcoBlue (2023–současnost)";
        }
        return "Tourneo Custom I FL 2.0 EcoBlue (2016–2023)";
      }
      if (has22 || hasDiesel) return "Tourneo Custom I 2.2 TDCi (2012–2016)";
    } else {
      if (hasEcoblue || has20) {
        if ((minYear !== null && minYear >= 2023) || /\b(23|73|24|74|25|75|26|76)\s*plate\b/.test(combined)) {
          return "Transit Custom II 2.0 EcoBlue (2023–současnost)";
        }
        return "Transit Custom I FL 2.0 EcoBlue (2016–2023)";
      }
      if (has22 || hasDiesel) return "Transit Custom I 2.2 TDCi (2012–2016)";
    }
  }

  if (hasTourneo && !hasConnect && !hasCustom && !hasCourier) {
    if (hasMk1 || hasMk2 || hasMk3 || hasMk4) return null;

    if ((has20 && hasDiesel) || /\bd3fa\b/.test(combined) || /\bduratorq\s+di\b/.test(combined)) {
      return "Transit MK6 2.0/2.4 Diesel (2000–2006)";
    }

    if (/\bmk\s*6\b/.test(combined) || plateYearBand === "mk6" || (minYear !== null && maxYear !== null && minYear >= 2000 && maxYear <= 2006)) {
      if (hasPetrol || has23 || hasPinto) return "Transit MK6 2.3 Duratec (2001–2006)";
      if (hasDiesel || has20 || has24 || hasT260Family) return "Transit MK6 2.0/2.4 Diesel (2000–2006)";
      return "Transit / Tourneo MK6 (2000–2006)";
    }
    if (/\bmk\s*5\b/.test(combined) || plateYearBand === "mk5" || looksLegacyTransit || has25 || hasDi) {
      if (hasDiesel || has25 || hasDi || looksLegacyTransit) return "Transit MK5 2.5 Diesel (1994–2000)";
      return "Transit / Tourneo MK5 (1994–2000)";
    }
    if (/\bmk\s*7\b/.test(combined) || plateYearBand === "mk7" || (minYear !== null && maxYear !== null && minYear >= 2006 && maxYear <= 2011)) {
      if (has32) return "Transit MK7 3.2 TDCi (2006–2011)";
      if (has24) return "Transit MK7 2.4 TDCi (2006–2011)";
      if (has23 || (hasPetrol && !hasEcoblue)) return "Transit MK7 2.3 Duratec (2006–2011)";
      if (has22 || hasDiesel) return "Transit MK7 2.2 TDCi (2006–2011)";
      return "Transit / Tourneo MK7 (2006–2011)";
    }
    if (plateYearBand === "mk7fl" || (minYear !== null && maxYear !== null && minYear >= 2011 && maxYear <= 2014)) {
      if (has22 || hasDiesel) return "Transit MK7 FL 2.2 TDCi (2011–2014)";
      return "Transit / Tourneo MK7 FL (2011–2014)";
    }
    if (plateYearBand === "mk8" || plateYearBand === "mk8_ecoblue" || (minYear !== null && maxYear !== null && minYear >= 2014)) {
      if (has20 || hasEcoblue) return "Transit MK8 2.0 EcoBlue (2016–současnost)";
      if (has22 || hasDiesel) return "Transit MK8 2.2 TDCi (2014–2016)";
      return "Transit / Tourneo MK8 (2014–současnost)";
    }
  }

  if (!hasCustom && !hasConnect && !hasTourneo) {
    if (hasMk1 || hasMk2 || hasMk3 || hasMk4) {
      return null;
    }

    if (/\bmk\s*6\b/.test(combined)) {
      if (hasPetrol || has23 || hasPinto) return "Transit MK6 2.3 Duratec (2001–2006)";
      return "Transit MK6 2.0/2.4 Diesel (2000–2006)";
    }

    if (/\bmk\s*5\b/.test(combined) || has25 || looksLegacyTransit || hasDi) {
      return "Transit MK5 2.5 Diesel (1994–2000)";
    }

    if (minYear !== null && maxYear !== null) {
      if (maxYear < 2000 && (hasDiesel || has25 || looksLegacyTransit)) {
        return "Transit MK5 2.5 Diesel (1994–2000)";
      }

      if (minYear >= 2000 && maxYear <= 2006) {
        if (hasPetrol || has23 || hasPinto) return "Transit MK6 2.3 Duratec (2001–2006)";
        if (hasDiesel || has20 || has24 || hasT260Family || looksMk6Transit) {
          return "Transit MK6 2.0/2.4 Diesel (2000–2006)";
        }
      }

      if (minYear >= 2006 && maxYear <= 2011) {
        if (has32) return "Transit MK7 3.2 TDCi (2006–2011)";
        if (has24) return "Transit MK7 2.4 TDCi (2006–2011)";
        if (has23 || (hasPetrol && !hasEcoblue)) return "Transit MK7 2.3 Duratec (2006–2011)";
        if (has22 || hasDiesel || hasT260Family || looksMk7Transit) return "Transit MK7 2.2 TDCi (2006–2011)";
      }
    }

    if (plateYearBand === "mk5" && (hasDiesel || has25 || looksLegacyTransit)) {
      return "Transit MK5 2.5 Diesel (1994–2000)";
    }
    if (plateYearBand === "mk6") {
      if (hasPetrol || has23 || hasPinto) return "Transit MK6 2.3 Duratec (2001–2006)";
      return "Transit MK6 2.0/2.4 Diesel (2000–2006)";
    }
    if (plateYearBand === "mk7") {
      if (has32) return "Transit MK7 3.2 TDCi (2006–2011)";
      if (has24) return "Transit MK7 2.4 TDCi (2006–2011)";
      if (has23 || (hasPetrol && !hasEcoblue)) return "Transit MK7 2.3 Duratec (2006–2011)";
      return "Transit MK7 2.2 TDCi (2006–2011)";
    }
    if (plateYearBand === "mk7fl") {
      return "Transit MK7 FL 2.2 TDCi (2011–2014)";
    }
    if (plateYearBand === "mk8") {
      if (has22 || hasDiesel || hasT260Family || looksMk8Transit) return "Transit MK8 2.2 TDCi (2014–2016)";
    }
    if (plateYearBand === "mk8_ecoblue") {
      if (has22) return "Transit MK8 2.2 TDCi (2014–2016)";
      if (has20 || hasEcoblue) return "Transit MK8 2.0 EcoBlue (2016–současnost)";
    }
  }

  if (/\bmk\s*7\b/.test(combined)) {
    if (has24) return "Transit MK7 2.4 TDCi (2006–2011)";
    if (has32) return "Transit MK7 3.2 TDCi (2006–2011)";
    if (has23) return "Transit MK7 2.3 Duratec (2006–2011)";
    if (has22) return "Transit MK7 2.2 TDCi (2006–2011)";
  }

  if (has22 && minYear !== null && maxYear !== null) {
    if (minYear >= 2011 && maxYear <= 2014) return "Transit MK7 FL 2.2 TDCi (2011–2014)";
    if (minYear >= 2014 && maxYear <= 2016) return "Transit MK8 2.2 TDCi (2014–2016)";
  }

  if (!hasCustom && !hasConnect && !hasTourneo) {
    if ((has24 || has20 || hasT260Family || looksMk6Transit) && maxYear !== null && maxYear <= 2006) {
      return "Transit MK6 2.0/2.4 Diesel (2000–2006)";
    }
    if ((has24 || has22 || has32 || hasT260Family || looksMk7Transit) && minYear !== null && minYear >= 2006 && maxYear !== null && maxYear <= 2011) {
      if (has32) return "Transit MK7 3.2 TDCi (2006–2011)";
      if (has24) return "Transit MK7 2.4 TDCi (2006–2011)";
      return "Transit MK7 2.2 TDCi (2006–2011)";
    }
    if ((has22 || looksMk7FlTransit) && minYear !== null && minYear >= 2011 && maxYear !== null && maxYear <= 2014) {
      return "Transit MK7 FL 2.2 TDCi (2011–2014)";
    }
    if ((has22 || hasDiesel || looksMk8Transit) && minYear !== null && minYear >= 2014 && maxYear !== null && maxYear <= 2016) {
      return "Transit MK8 2.2 TDCi (2014–2016)";
    }
    if ((has20 || hasEcoblue) && (maxYear !== null && maxYear >= 2016 || looksModernTransit)) {
      return "Transit MK8 2.0 EcoBlue (2016–současnost)";
    }
  }

  if ((has20 || hasEcoblue) && maxYear !== null && maxYear >= 2016) {
    return "Transit MK8 2.0 EcoBlue (2016–současnost)";
  }

  return fallbackResolved ?? null;
}

function sanitizeResolvedTransitModel(vehicleModel, contextText = "") {
  if (!vehicleModel) return null;

  const model = normalizeText(vehicleModel);
  const context = normalizeText(contextText);
  if (!context) return vehicleModel;

  const saysDiesel = /\b(diesel|ecoblue|tdci|tddi|duratorq)\b/.test(context);
  const saysPetrol = /\b(petrol|gasoline|ecoboost|duratec|pinto)\b/.test(context);
  const saysPhev = /\b(phev|plug in|plug-in|hybrid)\b/.test(context);
  const saysElectric = /\b(electric|elektro|ev)\b/.test(context);

  if (saysDiesel && /\b(ecoboost|phev|elektro)\b/.test(model)) return null;
  if (saysPetrol && /\b(ecoblue|tdci|tddi|diesel)\b/.test(model)) return null;
  if (saysPhev && !/\b(phev|hybrid)\b/.test(model)) return null;
  if (saysElectric && !/\belektro\b/.test(model)) return null;

  return vehicleModel;
}

function buildCatalogMapping({ modelRaw = "", threadTitle = "", parentForumTitle = "", vehicleModel = null }) {
  const context = [modelRaw, threadTitle, parentForumTitle].filter(Boolean).join(" | ");
  return {
    resolved: Boolean(vehicleModel),
    model_raw: modelRaw || null,
    thread_title: threadTitle || null,
    parent_forum_title: parentForumTitle || null,
    candidate_hints: vehicleModel ? [] : detectPotentialCatalogHints(context),
  };
}

function inferForumInventory({ forumUrl, forumTitle }) {
  return {
    forum_url: canonicalListingUrl(forumUrl),
    forum_title: forumTitle || "Technical Problems & Questions",
    normalized_title: normalizeText(forumTitle || "Technical Problems & Questions"),
    forum_type: "shared",
    resolved_model: null,
    candidate_models: [
      "Transit MK7 2.2 TDCi (2006–2011)",
      "Transit MK8 2.0 EcoBlue (2016–současnost)",
      "Transit Custom I FL 2.0 EcoBlue (2016–2023)",
      "Transit Custom II 2.0 EcoBlue (2023–současnost)",
      "Tourneo Custom I FL 2.0 EcoBlue (2016–2023)",
      "Tourneo Custom II 2.0 EcoBlue (2023–současnost)",
      "Transit Connect II FL 1.5 EcoBlue (2018–2024)",
      "Transit Connect III 2.0 EcoBlue (2024–současnost)",
      "Tourneo Connect III 2.0 EcoBlue (2022–současnost)",
      "Transit Courier II 1.0 EcoBoost (2023–současnost)",
      "Tourneo Courier II 1.0 EcoBoost (2023–současnost)",
      "E-Tourneo Custom Elektro (2024–současnost)",
      "E-Tourneo Courier Elektro (2024–současnost)",
    ],
    note: "Shared phpBB forum for Transit, Tourneo, Custom, Connect and Courier threads. Model must be resolved per thread.",
    keep: true,
    skip_reason: "",
  };
}

async function processThreadFactory({ args, apiKey, outReady, outReview, outCatalogReview, discardedPath }) {
  return async function processOneThread({
    threadUrl,
    threadTitle = "",
    threadTextRaw,
    parentForumTitle = "",
    subforumName = "",
    subforumTitle = "",
    subforumUrl = "",
  }) {
    const rawThreadText = typeof threadTextRaw === "string" ? threadTextRaw : (threadTextRaw?.text ?? "");
    const normalizedThreadTitle = normalizeThreadTitle(
      threadTitle
      || (typeof threadTextRaw === "object" ? threadTextRaw?.title ?? "" : "")
      || ((rawThreadText.match(/^TITLE:\s*(.+)$/m) ?? [])[1] ?? "")
    );

    const text = args.maxChars && rawThreadText.length > args.maxChars
      ? `${rawThreadText.slice(0, args.maxChars)}\n\n[TRUNCATED]`
      : rawThreadText;

    const sourceUrl = threadUrl || args.sourceUrl;
    const postMetaByNumber = parsePostMetaFromThreadText(rawThreadText);
    const postTextByNumber = parsePostTextByNumber(rawThreadText);

    const logDiscard = async (stage, reason, extra = {}) => {
      await appendJsonLine(discardedPath, {
        stage,
        reason,
        thread_url: sourceUrl || null,
        thread_title: normalizedThreadTitle || null,
        parent_forum_title: parentForumTitle || null,
        subforum_name: subforumName || null,
        subforum_title: subforumTitle || null,
        subforum_url: subforumUrl || null,
        created_at: new Date().toISOString(),
        ...extra,
      });
    };

    const writeReview = async (stage, reason, extra = {}) => {
      const payload = {
        stage,
        reason,
        thread_url: sourceUrl || null,
        thread_title: normalizedThreadTitle || null,
        parent_forum_title: parentForumTitle || null,
        subforum_name: subforumName || null,
        subforum_title: subforumTitle || null,
        subforum_url: subforumUrl || null,
        created_at: new Date().toISOString(),
        ...extra,
      };

      if (!args.keepReview) {
        await logDiscard(stage, reason, { review_candidate: payload });
        return false;
      }

      const reviewId = buildReviewId({
        forum: args.forum,
        sourceUrl,
        threadTitle: normalizedThreadTitle,
        stage,
      });
      await writeJsonFileUnique(outReview, reviewId, {
        review_id: reviewId,
        ...payload,
      });
      return true;
    };

    const writeCatalogReview = async (catalogMapping, extractedRaw, classifier) => {
      const reviewId = buildCatalogReviewId({
        forum: args.forum,
        sourceUrl,
        threadTitle: normalizedThreadTitle,
        modelRaw: extractedRaw?.model_raw ?? "",
      });
      await writeJsonFileUnique(outCatalogReview, reviewId, {
        review_id: reviewId,
        stage: "catalog_mapping",
        thread_url: sourceUrl || null,
        thread_title: normalizedThreadTitle || null,
        parent_forum_title: parentForumTitle || null,
        subforum_name: subforumName || null,
        subforum_title: subforumTitle || null,
        subforum_url: subforumUrl || null,
        created_at: new Date().toISOString(),
        catalog_mapping: catalogMapping,
        classifier,
        extracted_raw: extractedRaw ?? null,
      });
    };

    const classifierPrompt = [
      "You are an automotive forum thread classifier for seed data quality control.",
      "Return ONLY one JSON object, no other text.",
      "",
      "Rules:",
      "- Do not guess or infer missing facts.",
      "- Approve the thread if it contains at least one extractable resolved automotive case.",
      "- A valid case means one forum user explicitly describes their own vehicle fault or symptoms and later confirms the successful repair for that same case.",
      "- The confirming user does NOT need to be the original thread author.",
      "- A thread may contain multiple independent resolved cases from different users. That is allowed.",
      "- Ignore unresolved side discussions, guesses, lookup-only replies, or advice-only replies if at least one valid case exists.",
      "- Forum context is broad Transit forum context only. Use model information only when explicit in the thread.",
      "",
      "JSON schema:",
      '{"should_seed":false,"is_relevant":false,"has_explicit_fault":false,"has_confirmed_resolution":false,"same_user_confirms_resolution":false,"has_required_fields":false,"reason":"","evidence_post_numbers":[]}',
      "",
      "Forum thread text:",
      text,
    ].join("\n");

    const classifier = safeParseJsonObject(await deepseekChatJson({
      apiKey,
      model: args.model,
      maxTokens: 900,
      messages: [{ role: "user", content: classifierPrompt }],
    }));
    classifier.evidence_post_numbers = normalizeEvidencePosts(classifier.evidence_post_numbers);

    if (!isClassifierApproved(classifier)) {
      if (isReviewWorthClassifier(classifier)) {
        const kept = await writeReview("classifier", classifier.reason || "Thread looks like a real diagnostic case but did not pass READY gate.", {
          classifier,
        });
        return { ready: 0, review: kept ? 1 : 0, discarded: kept ? 0 : 1, catalogReview: 0 };
      }
      await logDiscard("classifier", classifier.reason || "Thread did not pass strict seed gate.", { classifier });
      return { ready: 0, review: 0, discarded: 1, catalogReview: 0 };
    }

    const extractorPrompt = [
      "You extract one or more high-confidence resolved automotive diagnostic cases from a forum thread.",
      "Return ONLY a JSON array, no other text.",
      "",
      "Rules:",
      "- Do not guess or infer missing facts.",
      "- Each case must belong to one forum user: the same user must explicitly describe the fault or symptoms and later confirm the successful repair for that same case.",
      "- The case author does NOT need to be the original thread author.",
      "- A thread may contain multiple independent resolved cases from different users. Return all qualifying cases.",
      "- Ignore advice-only replies, guesses, or cases where another user suggests a fix but the reporting user never confirms it.",
      "- Use model information only when explicit in the thread.",
      "- If any required field is ambiguous for one case, omit that case but continue extracting other clear cases.",
      "- If there are no clear cases, return [].",
      "- Translate symptoms, description, and resolution to English.",
      "- If mileage is explicitly mentioned, extract it as an integer number of kilometers.",
      "- Normalize OBD codes to uppercase format like P0401. If none are present, use [].",
      "",
      "Output schema:",
      '[{"case_author":"","fault_post_numbers":[],"resolution_post_numbers":[],"brand_raw":"Ford","model_raw":"","engine_raw":"","engine_code_raw":"","mileage":null,"symptoms":[],"obd_codes":[],"description":"","resolution":"","closed_at":""}]',
      "",
      `- Classifier evidence post numbers: ${classifier.evidence_post_numbers.join(", ")}`,
      "",
      "Forum thread text:",
      text,
    ].join("\n");

    const extracted = safeParseJsonArray(await deepseekChatJson({
      apiKey,
      model: args.model,
      maxTokens: 2600,
      messages: [{ role: "user", content: extractorPrompt }],
    }));

    if (!Array.isArray(extracted) || extracted.length < 1) {
      const kept = await writeReview("extractor", `Expected one or more clear extracted cases, got ${Array.isArray(extracted) ? extracted.length : 0}.`, {
        classifier,
        extracted_count: Array.isArray(extracted) ? extracted.length : 0,
      });
      return { ready: 0, review: kept ? 1 : 0, discarded: kept ? 0 : 1, catalogReview: 0 };
    }

    let readyCount = 0;
    let reviewCount = 0;
    let discardedCount = 0;
    let catalogReviewCount = 0;

    for (const item of extracted) {
      const authorValidation = validateExtractedCaseAuthor(item, postMetaByNumber);
      if (!authorValidation.ok) {
        const kept = await writeReview("record", authorValidation.reason || "Author validation failed.", {
          classifier,
          extracted_raw: item ?? null,
        });
        if (kept) reviewCount++;
        else discardedCount++;
        continue;
      }

      const normalizedItem = { ...(item ?? {}), case_author: authorValidation.caseAuthor ?? (item?.case_author ?? "") };
      if (extractedCaseUsesUnresolvedResolutionPost(normalizedItem, postTextByNumber)) {
        const kept = await writeReview("record", "Resolution post still uses future or uncertain language in the source thread.", {
          classifier,
          extracted_raw: normalizedItem ?? null,
        });
        if (kept) reviewCount++;
        else discardedCount++;
        continue;
      }

      const vehicle_brand = "Ford";
      const modelContext = [
        normalizedThreadTitle,
        normalizedItem?.engine_raw ?? "",
        normalizedItem?.engine_code_raw ?? "",
        normalizedItem?.description ?? "",
      ].filter(Boolean).join(" | ");
      const resolvedVehicleModel = resolveTransitFamilyVehicleModel({
        modelRaw: normalizedItem?.model_raw ?? "",
        threadTitle: normalizedThreadTitle,
        parentForumTitle,
        extraText: modelContext,
      }) ?? null;
      const vehicle_model = sanitizeResolvedTransitModel(resolvedVehicleModel, modelContext);
      const engine_power = vehicle_model
        ? pickEnginePower(
            FORD_ENTRY,
            vehicle_model,
            [
              normalizedItem?.engine_raw ?? "",
              modelContext,
              parentForumTitle,
            ].filter(Boolean).join(" | ")
          )
        : null;

      let description = (normalizedItem?.description ?? "").toString();
      const engineCodeRaw = (normalizedItem?.engine_code_raw ?? "").toString().trim();
      if (engineCodeRaw && !normalizeText(description).includes(normalizeText(engineCodeRaw))) {
        description = description.trim()
          ? `${description.trim()} Engine code: ${engineCodeRaw}.`
          : `Engine code: ${engineCodeRaw}.`;
      }

      const metadata = {
        source_type: "forum_fordtransit_org",
        source_ref: "fordtransit.org/forum/viewforum.php?f=2",
        thread_title: normalizedThreadTitle || null,
        case_author: normalizedItem.case_author || null,
      };
      const catalogMapping = buildCatalogMapping({
        modelRaw: normalizedItem?.model_raw ?? "",
        threadTitle: normalizedThreadTitle,
        parentForumTitle,
        vehicleModel: vehicle_model,
      });
      metadata.catalog_mapping = catalogMapping;

      const canonical = { vehicle_brand, vehicle_model, engine_power };
      const local_id = computeLocalId({ forum: args.forum, sourceUrl, item: normalizedItem, canonical });
      const record = {
        local_id,
        user_id: args.userId,
        thread_url: sourceUrl || null,
        vehicle_brand,
        vehicle_model,
        mileage: typeof normalizedItem?.mileage === "number" ? Math.trunc(normalizedItem.mileage) : null,
        engine_power,
        symptoms: canonicalizeSymptoms(normalizedItem?.symptoms),
        obd_codes: ensureArrayOfStrings(normalizedItem?.obd_codes).map((code) => code.toUpperCase()),
        description,
        resolution: (normalizedItem?.resolution ?? "").toString(),
        closed_at: toIsoOrNow(normalizedItem?.closed_at),
        metadata,
      };

      if (!catalogMapping.resolved) {
        await writeCatalogReview(catalogMapping, normalizedItem, classifier);
        catalogReviewCount++;
      }

      if (!isReadyRecord(record, classifier)) {
        const kept = await writeReview("record", catalogMapping.resolved
          ? "Extracted case failed strict READY validation."
          : "Extracted case looks usable, but the Ford model could not be mapped to the current catalog.",
        {
          classifier,
          candidate_seed: record,
          extracted_raw: normalizedItem ?? null,
        });
        if (kept) reviewCount++;
        else discardedCount++;
        continue;
      }

      await writeJsonFileUnique(outReady, record.local_id, record);
      readyCount++;
    }

    return { ready: readyCount, review: reviewCount, discarded: discardedCount, catalogReview: catalogReviewCount };
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!Array.isArray(args.inputs) || args.inputs.length < 1 || !args.outDir) usage(1);
  if (!args.cookie) args.cookie = process.env.FORUM_COOKIE ?? "";

  const outReady = path.join(args.outDir, "ready");
  const outReview = path.join(args.outDir, "to_review");
  const outCatalogReview = path.join(args.outDir, "catalog_review");
  const discardedPath = path.join(args.outDir, "discarded.jsonl");
  const inventoryPath = path.join(args.outDir, "forum_inventory.json");
  await fs.mkdir(outReady, { recursive: true });
  if (args.keepReview) await fs.mkdir(outReview, { recursive: true });
  await fs.mkdir(outCatalogReview, { recursive: true });

  if (args.dry) {
    await appendJsonLine(discardedPath, {
      stage: "dry_run",
      thread_url: args.sourceUrl || null,
      reason: "Dry run placeholder. No seed was stored.",
      created_at: new Date().toISOString(),
    });
    console.log(`Wrote 0 ready record(s) and discarded 1 placeholder item into: ${args.outDir}`);
    return;
  }

  let processOneThread = null;
  if (!args.discoverOnly) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error("Missing DEEPSEEK_API_KEY (or use --discover-only / --dry).");
      process.exit(2);
    }
    processOneThread = await processThreadFactory({
      args,
      apiKey,
      outReady,
      outReview,
      outCatalogReview,
      discardedPath,
    });
  }

  const inventory = [];
  let totalDiscovered = 0;
  let totalKept = 0;
  let totalDropped = 0;
  let totalReady = 0;
  let totalReview = 0;
  let totalDiscarded = 0;
  let totalCatalogReview = 0;
  let totalProcessedThreads = 0;

  for (let inputIndex = 0; inputIndex < args.inputs.length; inputIndex++) {
    const input = args.inputs[inputIndex];
    logProgress(`Input ${inputIndex + 1}/${args.inputs.length} start: ${input}`);

    if (isTopicUrl(input)) {
      if (args.discoverOnly) {
        totalDiscovered++;
        totalKept++;
        continue;
      }

      const raw = await fetchThreadAsText({
        url: input,
        pages: args.pages,
        cookie: args.cookie,
        forumTitle: "Technical Problems & Questions",
        sleepMs: args.sleepMs,
      });
      const res = await processOneThread({ threadUrl: input, threadTextRaw: raw, parentForumTitle: "Technical Problems & Questions" });
      totalReady += res.ready;
      totalReview += res.review;
      totalDiscarded += res.discarded;
      totalCatalogReview += res.catalogReview;
      totalProcessedThreads++;
      continue;
    }

    if (!isListingUrl(input)) {
      await appendJsonLine(discardedPath, {
        stage: "input",
        reason: "Unsupported Ford Transit input URL. Expected forum listing or topic URL.",
        thread_url: input,
        created_at: new Date().toISOString(),
      });
      totalDiscarded++;
      continue;
    }

    const inputStem = makeInputStem(input);
    const discoveredAllPath = path.join(args.outDir, `discovered_threads_all_${inputStem}.jsonl`);
    const discoveredKeptPath = path.join(args.outDir, `discovered_threads_kept_${inputStem}.jsonl`);
    const donePath = path.join(args.outDir, `done_threads_${inputStem}.txt`);
    const errPath = path.join(args.outDir, `errors_${inputStem}.txt`);

    let doneSet = new Set();
    if (!args.discoverOnly) {
      try {
        const doneText = await fs.readFile(donePath, "utf8");
        doneSet = new Set(doneText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
      } catch {}
    }

    const firstHtml = await fetchUrl(input, args.cookie);
    const forumTitle = extractTitleFromHtml(firstHtml);
    inventory.push(inferForumInventory({ forumUrl: input, forumTitle }));

    const discovered = await discoverThreadsFromForum({
      forumUrl: input,
      firstHtml,
      indexPages: args.indexPages,
      minReplies: args.minReplies,
      cookie: args.cookie,
      sleepMs: args.sleepMs,
    });

    const uniqueThreads = uniqByKey(discovered.threads, (thread) => thread.url);
    const keptThreads = uniqueThreads.filter((thread) => thread.keep);
    const droppedThreads = uniqueThreads.length - keptThreads.length;

    totalDiscovered += uniqueThreads.length;
    totalKept += keptThreads.length;
    totalDropped += droppedThreads;

    for (const thread of uniqueThreads) await appendJsonLine(discoveredAllPath, thread);
    for (const thread of keptThreads) await appendJsonLine(discoveredKeptPath, thread);

    if (args.discoverOnly) continue;

    const toProcess = keptThreads
      .filter((thread) => !doneSet.has(thread.url))
      .filter((thread) => !args.signalsOnly || thread.signal)
      .slice(0, args.maxThreads);

    logProgress(`Discovered ${uniqueThreads.length} thread(s), kept ${keptThreads.length}, processing ${toProcess.length}.`);

    for (let threadIndex = 0; threadIndex < toProcess.length; threadIndex++) {
      const thread = toProcess[threadIndex];
      try {
        logProgress(`Thread ${threadIndex + 1}/${toProcess.length}: ${thread.title || thread.url}`);
        const raw = await fetchThreadAsText({
          url: thread.url,
          pages: args.pages,
          cookie: args.cookie,
          forumTitle: thread.parentForumTitle || forumTitle,
          sleepMs: args.sleepMs,
        });
        const res = await processOneThread({
          threadUrl: thread.url,
          threadTitle: thread.title,
          threadTextRaw: raw,
          parentForumTitle: thread.parentForumTitle || forumTitle,
          subforumName: thread.subforumName || "",
          subforumTitle: thread.subforumTitle || forumTitle,
          subforumUrl: thread.subforumUrl || canonicalListingUrl(input),
        });
        totalReady += res.ready;
        totalReview += res.review;
        totalDiscarded += res.discarded;
        totalCatalogReview += res.catalogReview;
        totalProcessedThreads++;
        await fs.appendFile(donePath, `${thread.url}\n`, "utf8");
      } catch (error) {
        await fs.appendFile(errPath, `[${new Date().toISOString()}] ${thread.url}\n${error?.stack || String(error)}\n\n`, "utf8");
      }
      if (args.sleepMs > 0) await sleep(args.sleepMs);
    }
  }

  await fs.writeFile(inventoryPath, JSON.stringify(inventory, null, 2), "utf8");

  if (args.discoverOnly) {
    console.log(`Discovery complete. Found ${totalDiscovered} thread title(s), kept ${totalKept} and dropped ${totalDropped} into: ${args.outDir}`);
    return;
  }

  if (args.keepReview) {
    console.log(`Processed ${totalProcessedThreads} thread(s). Wrote ${totalReady} ready record(s), ${totalReview} review item(s), ${totalCatalogReview} catalog review item(s) and discarded ${totalDiscarded} item(s) into: ${args.outDir}`);
  } else {
    console.log(`Processed ${totalProcessedThreads} thread(s). Wrote ${totalReady} ready record(s), ${totalCatalogReview} catalog review item(s) and discarded ${totalDiscarded} item(s) into: ${args.outDir}`);
  }
}

const entryArg = process.argv[1];
const isDirectRun = entryArg
  ? import.meta.url === pathToFileURL(path.resolve(entryArg)).href
  : false;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}

export {
  canonicalListingUrl,
  canonicalTopicUrl,
  classifyTopicEntry,
  detectPotentialCatalogHints,
  extractNextPageUrl,
  extractPostsFromPhpbb,
  extractTopicEntriesFromForumPage,
  inferForumInventory,
  normalizeThreadTitle,
  parseArgs,
  resolveTransitFamilyVehicleModel,
  sanitizeResolvedTransitModel,
};
