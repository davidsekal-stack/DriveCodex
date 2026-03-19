#!/usr/bin/env node
/**
 * Minimal forum-thread seeding helper.
 *
 * Usage:
 *   node scripts/forum-seed.mjs <input.txt|-> <out_dir> [--forum skodaforum] [--user-id <id>] [--source-url <url>] [--dry]
 *   node scripts/forum-seed.mjs <https://thread.url> <out_dir> [--forum skodaforum] [--user-id <id>] [--dry]
 *   node scripts/forum-seed.mjs <input1> <input2> ... <out_dir> [options]
 *
 * Output:
 *   <out_dir>/ready/*.json
 *   <out_dir>/discarded.jsonl
 *
 * Notes:
 * - Extracts RAW fields via LLM (DeepSeek API) unless --dry is set.
 * - Maps `vehicle_brand`, `vehicle_model`, `engine_power` ONLY to values present in the built-in catalog:
 *   `web/src/constants/catalog.js`
 * - Only strict READY cases are stored; uncertain cases are discarded with an audit log entry.
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

import { VEHICLE_CATALOG } from "../web/src/constants/catalog.js";
import { SYMPTOM_CATEGORIES } from "../web/src/constants/symptoms.js";
import { strings as EN_STRINGS } from "../web/src/i18n/en.js";

const DEFAULT_FORUM = "forum_seed";
const DEFAULT_USER_ID = "ai_importer";
const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_MARKET = "eu";
const DEFAULT_PRESET = "";

const PRESET_INPUTS = {
  "skoda-mega": [
    "https://forum.skodahome.cz/forum/327-motor/",
    "https://forum.skodahome.cz/forum/326-elektrika/",
    "https://forum.skodahome.cz/forum/328-podvozek/",
    "https://forum.skodahome.cz/forum/535-elektrika/",
    "https://forum.skodahome.cz/forum/549-motor/",
    "https://forum.skodahome.cz/forum/537-podvozek/",
    "https://forum.skodahome.cz/forum/206-superb-ii/",
    "https://forum.skodahome.cz/forum/406-superb-lll/",
    "https://forum.skodahome.cz/forum/631-superb-4/",
    "https://forum.skodahome.cz/forum/216-%C5%A1koda-yeti/",
    "https://forum.skodahome.cz/forum/421-%C5%A1koda-kodiaq/",
    "https://forum.skodahome.cz/forum/615-%C5%A1koda-kodiaq-ii/",
    "https://forum.skodahome.cz/forum/454-%C5%A1koda-karoq/",
    "https://forum.skodahome.cz/forum/578-%C5%A1koda-enyaq-%F0%9D%97%B6v/",
    "https://forum.skodahome.cz/forum/649-%C5%A1koda-elroq/",
    "https://forum.skodahome.cz/forum/299-%C5%A1koda-rapid-od-roku-2012/",
    "https://forum.skodahome.cz/forum/510-%C5%A1koda-scala/",
  ],
};

let ACTIVE_MARKET = DEFAULT_MARKET;
let ACTIVE_CATALOG = VEHICLE_CATALOG;

// Symptom catalog lives in the app as i18n keys `sym.*`.
// For seeding we canonicalize to the English labels (so `search-cases` string matching works).
const SYMPTOM_KEYS = [...new Set((SYMPTOM_CATEGORIES ?? []).flatMap(c => c.symptoms ?? []))];
const SYMPTOM_LABEL_BY_KEY = Object.fromEntries(
  SYMPTOM_KEYS
    .map(k => [k, (EN_STRINGS?.[k] ?? "").toString().trim()])
    .filter(([, v]) => v)
);
const SYMPTOM_LABELS = [...new Set(Object.values(SYMPTOM_LABEL_BY_KEY))];

function usage(exitCode = 1) {
  const msg = `
Usage:
  node scripts/forum-seed.mjs <input.txt|-> <out_dir> [options]
  node scripts/forum-seed.mjs <https://thread.url> <out_dir> [options]
  node scripts/forum-seed.mjs <input1> <input2> ... <out_dir> [options]
  node scripts/forum-seed.mjs --preset skoda-mega <out_dir> [options]

Args:
  input.txt  Path to a text file with the thread content. Use "-" to read from stdin.
  thread.url If an input starts with http(s), the script will fetch it and extract plain text.
  input1..N  One or more thread URLs, forum section URLs, or text files.
  out_dir    Output directory (will create ready/ and a discarded.jsonl audit log).

Options:
  --forum <name>        Used for deterministic local_id hashing. Default: ${DEFAULT_FORUM}
  --user-id <id>        Stored into user_id. Default: ${DEFAULT_USER_ID} (alias resolved during cloud import)
  --preset <name>       Built-in input preset. Available: ${Object.keys(PRESET_INPUTS).join(", ")}
  --source-url <url>    Optional source pointer (used in local_id hashing only). If input is a URL, it is used by default.
  --model <name>        DeepSeek model. Default: ${DEFAULT_MODEL}
  --market <eu|us|all>  Vehicle catalog market to use. Default: ${DEFAULT_MARKET}
  --max-chars <n>       Max characters sent to the LLM. Default: 60000
  --pages <n>           Max thread pages to read sequentially. Default: 999 (effectively whole thread)
  --crawl               Treat input URL(s) as forum sections and process relevant subforums/threads under them.
  --index-pages <n>     Max pages to read for the parent forum and each subforum listing. Default: 10
  --max-threads <n>     When --crawl is used, process at most N threads. Default: 30
  --sleep-ms <n>        Delay between HTTP requests in crawl mode. Default: 600
  --cookie <value>      Optional Cookie header value for fetching a URL (uses your own logged-in session).
  --keep-review         Also store borderline candidates into to_review/. Default: off
  --dry                 Do not call LLM; write a single discarded placeholder log entry.
  --help                Show help.

Env:
  DEEPSEEK_API_KEY      Required unless --dry is used.
  FORUM_COOKIE          Optional Cookie header value (used if --cookie is not provided).
`.trim();
  console.log(msg);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    inputs: [],
    outDir: null,
    forum: DEFAULT_FORUM,
    userId: DEFAULT_USER_ID,
    preset: DEFAULT_PRESET,
    sourceUrl: "",
    model: DEFAULT_MODEL,
    market: DEFAULT_MARKET,
    maxChars: 60000,
    pages: 999,
    cookie: "",
    crawl: false,
    indexPages: 10,
    maxThreads: 30,
    sleepMs: 600,
    keepReview: false,
    dry: false,
  };

  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") usage(0);
    if (a === "--dry") {
      args.dry = true;
      continue;
    }
    if (a === "--forum") {
      args.forum = argv[++i] ?? "";
      continue;
    }
    if (a === "--user-id") {
      args.userId = argv[++i] ?? "";
      continue;
    }
    if (a === "--preset") {
      args.preset = (argv[++i] ?? "").toString().trim().toLowerCase();
      continue;
    }
    if (a === "--source-url") {
      args.sourceUrl = argv[++i] ?? "";
      continue;
    }
    if (a === "--model") {
      args.model = argv[++i] ?? "";
      continue;
    }
    if (a === "--market") {
      args.market = (argv[++i] ?? "").toString().trim().toLowerCase();
      continue;
    }
    if (a === "--max-chars") {
      const raw = argv[++i] ?? "";
      const n = Number(raw);
      args.maxChars = Number.isFinite(n) ? Math.max(5000, Math.trunc(n)) : args.maxChars;
      continue;
    }
    if (a === "--pages") {
      const raw = argv[++i] ?? "";
      const n = Number(raw);
      args.pages = Number.isFinite(n) ? Math.max(1, Math.min(5000, Math.trunc(n))) : args.pages;
      continue;
    }
    if (a === "--cookie") {
      args.cookie = argv[++i] ?? "";
      continue;
    }
    if (a === "--keep-review") {
      args.keepReview = true;
      continue;
    }
    if (a === "--crawl") {
      args.crawl = true;
      continue;
    }
    if (a === "--index-pages") {
      const raw = argv[++i] ?? "";
      const n = Number(raw);
      args.indexPages = Number.isFinite(n) ? Math.max(1, Math.min(20, Math.trunc(n))) : args.indexPages;
      continue;
    }
    if (a === "--max-threads") {
      const raw = argv[++i] ?? "";
      const n = Number(raw);
      args.maxThreads = Number.isFinite(n) ? Math.max(1, Math.min(2000, Math.trunc(n))) : args.maxThreads;
      continue;
    }
    if (a === "--sleep-ms") {
      const raw = argv[++i] ?? "";
      const n = Number(raw);
      args.sleepMs = Number.isFinite(n) ? Math.max(0, Math.min(30_000, Math.trunc(n))) : args.sleepMs;
      continue;
    }
    if (a.startsWith("--")) {
      console.error(`Unknown option: ${a}`);
      usage(1);
    }
    positional.push(a);
  }

  if (positional.length >= 2) {
    args.inputs = positional.slice(0, -1);
    args.outDir = positional[positional.length - 1] ?? null;
  } else if (positional.length === 1 && args.preset) {
    args.inputs = [...(PRESET_INPUTS[args.preset] ?? [])];
    args.outDir = positional[0] ?? null;
  }
  return args;
}

function entryHasUnit(entry, unit) {
  for (const m of entry?.models ?? []) {
    for (const p of m?.powers ?? []) {
      const s = (p ?? "").toString();
      if (s.toLowerCase().includes(unit.toLowerCase())) return true;
    }
  }
  return false;
}

function isLikelyEUEntry(entry) {
  return !entry.brand.includes("(US)") && entryHasUnit(entry, "kW");
}

function isLikelyUSEntry(entry) {
  return entryHasUnit(entry, "hp") && !entryHasUnit(entry, "kW");
}

function selectCatalogForMarket(market) {
  if (market === "all") return { market: "all", catalog: VEHICLE_CATALOG };
  if (market === "us")  return { market: "us",  catalog: VEHICLE_CATALOG.filter(isLikelyUSEntry) };
  return { market: "eu", catalog: VEHICLE_CATALOG.filter(isLikelyEUEntry) };
}

async function readInputText(inputPath) {
  if (!inputPath) usage(1);
  if (inputPath === "-") {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    return Buffer.concat(chunks).toString("utf8");
  }
  if (/^https?:\/\//i.test(inputPath)) {
    if (typeof fetch !== "function") {
      throw new Error("Global fetch() is not available in this Node version. Use a newer Node (>=18) or paste text into a file.");
    }
    const fetched = await fetchThreadAsText({ url: inputPath });
    return fetched.text;
  }
  return await fs.readFile(inputPath, "utf8");
}

function defaultHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (compatible; GearBrainSeed/1.0; +https://example.invalid)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };
}

function safeHostnameFromUrl(u) {
  try {
    const host = new URL(u).hostname;
    return host.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
  } catch {
    return "";
  }
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

function logProgress(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function extractTitleFromHtml(html) {
  const m = (html ?? "").toString().match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return "";
  const t = htmlToText(m[1]).trim();
  return t.replace(/\s*\|\s*.*$/g, "").trim(); // drop " | Forum name" suffixes
}

function extractAuthorFromInvisionArticle(articleHtml) {
  const patterns = [
    /data-author=(?:"|')([^"']+)(?:"|')/i,
    /<a[^>]+href=(?:"|')[^"']*\/profile\/[^"']*(?:"|')[^>]*>([\s\S]*?)<\/a>/i,
    /<span[^>]+itemprop=(?:"|')name(?:"|')[^>]*>([\s\S]*?)<\/span>/i,
  ];
  for (const pattern of patterns) {
    const match = (articleHtml ?? "").toString().match(pattern);
    const author = htmlToText(match?.[1] ?? "").trim();
    if (author && author.length <= 120) return author;
  }
  return "";
}

function extractPostIdFromInvisionArticle(articleHtml) {
  const patterns = [
    /data-commentid=(?:"|')([^"']+)(?:"|')/i,
    /id=(?:"|')elComment_([^"']+)(?:"|')/i,
  ];
  for (const pattern of patterns) {
    const match = (articleHtml ?? "").toString().match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function extractPostsFromInvision(html, pageNumber = 1) {
  const articles = (html ?? "").toString().match(/<article\b[\s\S]*?<\/article>/gi) ?? [];
  const posts = [];
  for (const a of articles) {
    const hasContent = /commentContent/i.test(a) || /data-role=(?:"|')commentContent(?:"|')/i.test(a);
    const looksLikePost = /cPost|ipsComment|data-comment/i.test(a);
    if (!hasContent && !looksLikePost) continue;
    const author = extractAuthorFromInvisionArticle(a);
    const postId = extractPostIdFromInvisionArticle(a);
    const when = (() => {
      const tm = a.match(/<time\b[^>]*datetime=(?:"|')([^"']+)(?:"|')[^>]*>/i);
      return tm?.[1] ?? "";
    })();
    // Strip quotes blocks a bit (Invision quotes can be huge).
    const cleaned = a.replace(/<blockquote\b[\s\S]*?<\/blockquote>/gi, " ");
    const text = htmlToText(cleaned);
    // Heuristic: discard nav-ish artifacts.
    const t = text
      .split("\n")
      .map(x => x.trim())
      .filter(Boolean)
      .filter(x => !/^(citace|quote|l[ií]b[ií] se mi|sd[ií]let|odpov[eě]d[eě]t|report|share)$/i.test(normalizeText(x)))
      .join("\n");
    if (t.length < 80) continue;
    posts.push({ when, author, postId, pageNumber, text: t });
  }
  return posts;
}

function buildThreadText({ url, title, posts, forumTitle = "", subforumName = "", subforumTitle = "" }) {
  const lines = [];
  if (forumTitle) lines.push(`FORUM_CONTEXT: ${forumTitle}`);
  if (subforumTitle) lines.push(`SUBFORUM_TITLE: ${subforumTitle}`);
  if (subforumName) lines.push(`SUBFORUM_NAME: ${subforumName}`);
  lines.push(`THREAD_URL: ${url}`);
  if (title) lines.push(`TITLE: ${title}`);
  const threadAuthor = posts.find(p => p.author)?.author ?? "";
  if (threadAuthor) lines.push(`THREAD_AUTHOR: ${threadAuthor}`);
  lines.push("");
  let idx = 0;
  for (const p of posts) {
    idx++;
    const isThreadAuthor = threadAuthor
      ? normalizeText(p.author) === normalizeText(threadAuthor)
      : false;
    const meta = [
      `page: ${p.pageNumber ?? 1}`,
      `author: ${p.author || "unknown"}`,
      `is_thread_author: ${isThreadAuthor ? "true" : "false"}`,
      p.when ? `when: ${p.when}` : "",
      p.postId ? `post_id: ${p.postId}` : "",
    ].filter(Boolean).join(" | ");
    lines.push(`POST ${idx}${meta ? ` | ${meta}` : ""}:`);
    lines.push(p.text);
    lines.push("");
  }
  return lines.join("\n").trim();
}

function extractThreadTitleFromText(threadText) {
  const match = (threadText ?? "").toString().match(/^TITLE:\s*(.+)$/m);
  return match?.[1]?.trim() ?? "";
}

function urlWithPage(u, page) {
  const url = new URL(u);
  if (page <= 1) return url.toString();
  url.searchParams.set("page", String(page));
  return url.toString();
}

async function fetchUrl(url, cookie) {
  const headers = defaultHeaders();
  const c = (cookie ?? "").toString().trim();
  if (c) headers["Cookie"] = c;
  const res = await fetch(url, { method: "GET", headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch URL (${res.status}): ${body.slice(0, 200)}`);
  }
  return await res.text();
}

function detectTotalPages(html) {
  const text = htmlToText(html);
  const match = text.match(/\bPage\s+\d+\s+of\s+(\d+)\b/i);
  const count = Number(match?.[1] ?? 1);
  return Number.isFinite(count) && count > 0 ? count : 1;
}

function selectThreadPages(totalPages, maxPages) {
  const upper = Math.max(1, Math.min(totalPages, maxPages));
  return Array.from({ length: upper }, (_, idx) => idx + 1);
}

async function fetchThreadAsText({ url, pages = 999, cookie = "", forumTitle = "", subforumName = "", subforumTitle = "" }) {
  const host = safeHostnameFromUrl(url);
  const allPosts = [];
  const firstHtml = await fetchUrl(url, cookie);
  const title = extractTitleFromHtml(firstHtml);
  const totalPages = detectTotalPages(firstHtml);
  const pageNumbers = selectThreadPages(totalPages, pages);
  const htmlByPage = new Map([[1, firstHtml]]);

  for (const pageNumber of pageNumbers) {
    const html = htmlByPage.get(pageNumber) ?? await fetchUrl(urlWithPage(url, pageNumber), cookie);
    htmlByPage.set(pageNumber, html);

    if (host === "forum_skodahome_cz") {
      const posts = extractPostsFromInvision(html, pageNumber);
      allPosts.push(...posts);
    } else {
      const text = htmlToText(html);
      allPosts.push({ when: "", author: "", postId: "", pageNumber, text });
    }
  }

  if (allPosts.length === 0) {
    return { text: htmlToText(firstHtml), title, totalPages };
  }
  return {
    text: buildThreadText({ url, title, posts: allPosts, forumTitle, subforumName, subforumTitle }),
    title,
    totalPages,
  };
}

function isForumSectionUrl(u) {
  try { return new URL(u).pathname.toLowerCase().includes("/forum/"); } catch { return false; }
}

function isTopicUrl(u) {
  try { return new URL(u).pathname.toLowerCase().includes("/topic/"); } catch { return false; }
}

function toAbsoluteUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return "";
  }
}

function extractAnchorObjects(html, baseUrl, pattern) {
  const out = [];
  const re = new RegExp(`<a\\b[^>]*href=(?:"|')([^"'#\\s>]*${pattern}[^"'#\\s>]*)[^>]*>([\\s\\S]*?)<\\/a>`, "gi");
  for (const m of (html ?? "").toString().matchAll(re)) {
    const url = toAbsoluteUrl(m[1], baseUrl);
    const text = htmlToText(m[2] ?? "").replace(/\s+/g, " ").trim();
    if (!url || !text) continue;
    out.push({ url, text });
  }
  return out;
}

function uniqPreserveOrder(urls) {
  const out = [];
  const seen = new Set();
  for (const u of urls) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function uniqByKey(items, keyFn) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getForumSectionKind(baseUrl) {
  try {
    const pathname = decodeURIComponent(new URL(baseUrl).pathname).toLowerCase();
    if (pathname.includes("-motor")) return "motor";
    if (pathname.includes("-elektrika")) return "elektrika";
    if (pathname.includes("-podvozek")) return "podvozek";
    if (pathname.includes("elektricky") && pathname.includes("pohon")) return "electric-drive";
  } catch {}
  return "";
}

function looksLikeTargetSectionLabel(label) {
  const raw = (label ?? "").toString().trim();
  if (!raw) return false;
  const text = normalizeText(raw);
  return /^(motor|elektrika|podvozek|elektricky pohon)\b/.test(text);
}

function looksLikeMotorSubforumLabel(label) {
  const raw = (label ?? "").toString().trim();
  if (!raw) return false;
  const text = normalizeText(raw);
  return !!(
    /^motor\b/.test(text) ||
    /\b(tsi|tdi|fsi|mpi|g tec|cr|dsg|cng|lpg)\b/.test(text) ||
    /\b\d\.\d\b/.test(text) ||
    /\b\d{2,3}\s*kw\b/i.test(raw)
  );
}

function extractTargetChildSections(html, baseUrl) {
  const baseHost = safeHostnameFromUrl(baseUrl);
  if (getForumSectionKind(baseUrl)) return [];
  const anchors = extractAnchorObjects(html, baseUrl, "\\/forum\\/[0-9]+");
  return uniqByKey(
    anchors
      .filter(a => safeHostnameFromUrl(a.url) === baseHost)
      .filter(a => isForumSectionUrl(a.url))
      .filter(a => a.url !== baseUrl)
      .filter(a => {
        const pathname = decodeURIComponent(new URL(a.url).pathname).toLowerCase();
        return (
          pathname.includes("-motor") ||
          pathname.includes("-elektrika") ||
          pathname.includes("-podvozek") ||
          (pathname.includes("elektricky") && pathname.includes("pohon")) ||
          looksLikeTargetSectionLabel(a.text)
        );
      })
      .map(a => ({
        url: a.url,
        name: a.text.replace(/\s+/g, " ").trim(),
        kind: getForumSectionKind(a.url) || normalizeText(a.text).split(/\s+/)[0] || "",
      })),
    item => item.url
  );
}

function extractRelevantSubforums(html, baseUrl) {
  const baseHost = safeHostnameFromUrl(baseUrl);
  const sectionKind = getForumSectionKind(baseUrl);
  if (sectionKind !== "motor") return [];
  const anchors = extractAnchorObjects(html, baseUrl, "\\/forum\\/[0-9]+");
  return uniqByKey(
    anchors
      .filter(a => safeHostnameFromUrl(a.url) === baseHost)
      .filter(a => isForumSectionUrl(a.url))
      .filter(a => a.url !== baseUrl)
      .filter(a => {
        const pathname = new URL(a.url).pathname.toLowerCase();
        return pathname.includes("-motor-") || looksLikeMotorSubforumLabel(a.text);
      })
      .map(a => ({
        url: a.url,
        name: a.text.replace(/\s+/g, " ").trim(),
      })),
    item => item.url
  );
}

function isUsefulTopicTitle(title) {
  const t = (title ?? "").trim();
  if (!t) return false;
  if (t.length < 6) return false;
  const n = normalizeText(t);
  if (!n) return false;
  if (/^(prev|next|sort by|recently updated|title|start date|most viewed|most replies|custom|start new topic)$/.test(n)) return false;
  if (/^\d+$/.test(n)) return false;
  if (/(^ctete\b|^pravidla\b|\bpravidla sekce\b|\bobecna diskuse\b|\bvyber motoru\b|\bvyber\b|\bchipovani\b|\bdoporuc(te|it)\b|\bco koupit\b)/.test(n)) return false;
  return true;
}

function extractTopicEntriesFromForumPage(html, baseUrl) {
  const baseHost = safeHostnameFromUrl(baseUrl);
  const anchors = extractAnchorObjects(html, baseUrl, "\\/topic\\/[0-9]+");
  return uniqByKey(
    anchors
      .filter(a => safeHostnameFromUrl(a.url) === baseHost)
      .filter(a => isTopicUrl(a.url))
      .filter(a => isUsefulTopicTitle(a.text))
      .map(a => ({
        url: a.url,
        title: a.text.replace(/\s+/g, " ").trim(),
      })),
    item => item.url
  );
}

function shouldExpandMotorSubforums(sectionKind, motorSubforumDepth) {
  return sectionKind === "motor" && motorSubforumDepth < 1;
}

async function discoverForumListings({ forumUrl, indexPages = 1, cookie = "", sleepMs = 0, motorSubforumDepth = 0 }) {
  const firstHtml = await fetchUrl(forumUrl, cookie);
  const parentForumTitle = extractTitleFromHtml(firstHtml);
  const totalPages = Math.min(detectTotalPages(firstHtml), indexPages);
  const targetSections = [];
  const subforums = [];
  const sectionKind = getForumSectionKind(forumUrl);

  logProgress(`Discovery start: ${forumUrl} (${totalPages} listing page(s) max)`);

  for (let p = 1; p <= totalPages; p++) {
    logProgress(`Discovery page ${p}/${totalPages}: ${forumUrl}`);
    const html = p === 1 ? firstHtml : await fetchUrl(urlWithPage(forumUrl, p), cookie);
    targetSections.push(...extractTargetChildSections(html, forumUrl));
    if (shouldExpandMotorSubforums(sectionKind, motorSubforumDepth)) {
      subforums.push(...extractRelevantSubforums(html, forumUrl));
    }
    if (sleepMs > 0) await sleep(sleepMs);
  }

  const relevantSections = uniqByKey(targetSections, item => item.url);
  if (relevantSections.length > 0) {
    logProgress(`Discovery done: ${forumUrl} -> ${relevantSections.length} target child section(s)`);
    return { parentForumTitle, listings: relevantSections };
  }

  const listings = subforums.length > 0
    ? uniqByKey(subforums, item => item.url)
    : [{ url: forumUrl, name: parentForumTitle || "Forum", kind: getForumSectionKind(forumUrl) }];

  logProgress(`Discovery done: ${forumUrl} -> ${listings.length} listing(s)`);

  return { parentForumTitle, listings };
}

async function discoverForumThreads({ forumUrl, indexPages = 1, cookie = "", sleepMs = 0, motorSubforumDepth = 0 }) {
  const { parentForumTitle, listings } = await discoverForumListings({
    forumUrl,
    indexPages,
    cookie,
    sleepMs,
    motorSubforumDepth,
  });

  const threads = [];
  for (const listing of listings) {
    const firstHtml = await fetchUrl(listing.url, cookie);
    const subforumTitle = extractTitleFromHtml(firstHtml) || listing.name;
    const listingKind = listing.kind || getForumSectionKind(listing.url);
    logProgress(`Listing start: ${listing.name} (${listingKind || "root"})`);

    if (!listingKind) {
      const nested = await discoverForumThreads({
        forumUrl: listing.url,
        indexPages,
        cookie,
        sleepMs,
        motorSubforumDepth: 0,
      });
      threads.push(...nested.threads);
      continue;
    }

    if (listingKind === "motor" && listing.url !== forumUrl) {
      const nested = await discoverForumThreads({
        forumUrl: listing.url,
        indexPages,
        cookie,
        sleepMs,
        motorSubforumDepth: 1,
      });
      threads.push(...nested.threads);
      continue;
    }

    const totalPages = Math.min(detectTotalPages(firstHtml), indexPages);
    logProgress(`Listing scan: ${listing.url} (${totalPages} page(s) max)`);

    for (let p = 1; p <= totalPages; p++) {
      logProgress(`Listing page ${p}/${totalPages}: ${listing.url}`);
      const html = p === 1 ? firstHtml : await fetchUrl(urlWithPage(listing.url, p), cookie);
      const topics = extractTopicEntriesFromForumPage(html, listing.url).map(topic => ({
        ...topic,
        subforumName: listing.name,
        subforumTitle,
        subforumUrl: listing.url,
        parentForumTitle,
      }));
      threads.push(...topics);
      if (sleepMs > 0) await sleep(sleepMs);
    }
  }

  return {
    parentForumTitle,
    subforums: listings,
    threads: uniqByKey(threads, item => item.url),
  };
}

function htmlToText(html) {
  let s = (html ?? "").toString();
  // Drop scripts/styles early.
  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ");
  // Newlines for common block tags.
  s = s.replace(/<(br|hr)\b[^>]*>/gi, "\n");
  s = s.replace(/<\/(p|div|li|tr|h1|h2|h3|h4|h5|h6)\b[^>]*>/gi, "\n");
  // Remove all remaining tags.
  s = s.replace(/<[^>]+>/g, " ");
  // Decode a few common entities.
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");
  // Decode numeric entities.
  s = s.replace(/&#(\d+);/g, (_, n) => {
    const code = Number(n);
    return Number.isFinite(code) ? String.fromCodePoint(code) : "";
  });
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, n) => {
    const code = parseInt(n, 16);
    return Number.isFinite(code) ? String.fromCodePoint(code) : "";
  });
  // Collapse whitespace.
  s = s.replace(/\r\n/g, "\n");
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/[ \t]{2,}/g, " ");
  return s.trim();
}

function normalizeText(s) {
  return (s ?? "")
    .toString()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(s) {
  const n = normalizeText(s);
  if (!n) return [];
  const rawTokens = n.split(/\s+/g).filter(Boolean);
  const expanded = [];
  for (const token of rawTokens) {
    expanded.push(token);

    const numberPrefix = token.match(/^(\d+)([a-z]+)$/);
    if (numberPrefix) {
      expanded.push(numberPrefix[1], numberPrefix[2]);
      continue;
    }

    const numberSuffix = token.match(/^([a-z]+)(\d+)$/);
    if (numberSuffix) {
      expanded.push(numberSuffix[1], numberSuffix[2]);
    }
  }
  return expanded;
}

function tokenOverlapScore(query, candidate) {
  const q = new Set(tokenize(query));
  const c = new Set(tokenize(candidate));
  if (q.size === 0 || c.size === 0) return 0;
  let inter = 0;
  for (const t of q) if (c.has(t)) inter++;
  const union = q.size + c.size - inter;
  return union ? inter / union : 0;
}

function bestByScore(items, scoreFn) {
  let best = null;
  for (const it of items) {
    const score = scoreFn(it);
    if (!best || score > best.score) best = { it, score };
  }
  return best;
}

function getCatalogBrands() {
  return ACTIVE_CATALOG.map(b => b.brand);
}

function getBrandEntryCanonical(brandRaw) {
  if (!brandRaw?.trim()) return null;
  const brands = ACTIVE_CATALOG;
  const best = bestByScore(brands, b => tokenOverlapScore(brandRaw, b.brand));
  if (!best || best.score < 0.34) return null;

  // Reject ambiguous ties (within epsilon)
  const epsilon = 0.02;
  const topScore = best.score;
  const near = brands
    .map(b => ({ b, score: tokenOverlapScore(brandRaw, b.brand) }))
    .filter(x => Math.abs(x.score - topScore) <= epsilon)
    .sort((a, b) => b.score - a.score);
  if (near.length >= 2) return null;

  return best.it;
}

function getBrandModelsCanonical(brandEntry) {
  const models = brandEntry?.models ?? [];
  return models.filter(m => m && typeof m.label === "string" && m.label.trim().length > 0);
}

function pickModelLabel(brandEntry, modelRaw) {
  if (!brandEntry) return null;
  if (!modelRaw?.trim()) return null;
  const models = getBrandModelsCanonical(brandEntry);
  const best = bestByScore(models, m => tokenOverlapScore(modelRaw, m.label));
  if (!best || best.score < 0.30) return null;

  const epsilon = 0.03;
  const topScore = best.score;
  const near = models
    .map(m => ({ m, score: tokenOverlapScore(modelRaw, m.label) }))
    .filter(x => Math.abs(x.score - topScore) <= epsilon)
    .sort((a, b) => b.score - a.score);
  if (near.length >= 2) return null;

  return best.it.label;
}

function parseKw(engineRaw) {
  const m = (engineRaw ?? "").toString().match(/(\d{2,3})\s*k\s*w/i);
  if (!m) return null;
  const kw = Number(m[1]);
  return Number.isFinite(kw) ? kw : null;
}

function parseHp(engineRaw) {
  const m = (engineRaw ?? "").toString().match(/(\d{2,3})\s*h\s*p/i);
  if (!m) return null;
  const hp = Number(m[1]);
  return Number.isFinite(hp) ? hp : null;
}

function pickEnginePower(brandEntry, modelLabel, engineRaw) {
  if (!brandEntry || !modelLabel) return null;
  const models = getBrandModelsCanonical(brandEntry);
  const model = models.find(m => m.label === modelLabel) ?? null;
  const powers = model?.powers ?? null;
  if (!Array.isArray(powers) || powers.length === 0) return null;

  const kw = parseKw(engineRaw);
  if (kw) {
    const candidates = powers.filter(p => tokenize(p).includes(String(kw)));
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) {
      const best = bestByScore(candidates, p => tokenOverlapScore(engineRaw, p));
      if (best && best.score >= 0.34) {
        const epsilon = 0.03;
        const near = candidates
          .map(p => ({ p, score: tokenOverlapScore(engineRaw, p) }))
          .filter(x => Math.abs(x.score - best.score) <= epsilon)
          .sort((a, b) => b.score - a.score);
        if (near.length === 1) return best.it;
      }
      return null;
    }
  }

  // Token-based match (e.g., "2.0 tdi cr" -> matches "110 kW – 2.0 TDI")
  const hp = parseHp(engineRaw);
  if (hp && (ACTIVE_MARKET === "us" || ACTIVE_MARKET === "all")) {
    const candidates = powers.filter(p => {
      const toks = tokenize(p);
      return toks.includes(String(hp)) && toks.includes("hp");
    });
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) {
      const best = bestByScore(candidates, p => tokenOverlapScore(engineRaw, p));
      if (best && best.score >= 0.34) {
        const epsilon = 0.03;
        const near = candidates
          .map(p => ({ p, score: tokenOverlapScore(engineRaw, p) }))
          .filter(x => Math.abs(x.score - best.score) <= epsilon)
          .sort((a, b) => b.score - a.score);
        if (near.length === 1) return best.it;
      }
      return null;
    }
  }

  const best = bestByScore(powers, p => tokenOverlapScore(engineRaw, p));
  if (!best || best.score < 0.34) return null;

  const epsilon = 0.03;
  const topScore = best.score;
  const near = powers
    .map(p => ({ p, score: tokenOverlapScore(engineRaw, p) }))
    .filter(x => Math.abs(x.score - topScore) <= epsilon)
    .sort((a, b) => b.score - a.score);
  if (near.length >= 2) return null;

  return best.it;
}

function stripJsonFences(s) {
  const t = (s ?? "").toString().trim();
  // Remove ```json ... ``` fences if present
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : t;
}

function safeParseJsonArray(text) {
  const raw = stripJsonFences(text);
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("LLM did not return a JSON array.");
  }
  const slice = raw.slice(start, end + 1);
  const parsed = JSON.parse(slice);
  if (!Array.isArray(parsed)) throw new Error("Parsed JSON is not an array.");
  return parsed;
}

function safeParseJsonObject(text) {
  const raw = stripJsonFences(text);
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("LLM did not return a JSON object.");
  }
  const slice = raw.slice(start, end + 1);
  const parsed = JSON.parse(slice);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Parsed JSON is not an object.");
  }
  return parsed;
}

function normalizeEvidencePosts(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .map(v => Number(v))
      .filter(v => Number.isInteger(v) && v > 0)
  )].sort((a, b) => a - b);
}

function isClassifierApproved(result) {
  return !!(
    result &&
    result.should_seed === true &&
    result.is_relevant === true &&
    result.has_explicit_fault === true &&
    result.has_confirmed_resolution === true &&
    (result.same_user_confirms_resolution === true || result.confirmed_by_thread_author === true) &&
    normalizeEvidencePosts(result.evidence_post_numbers).length > 0
  );
}

async function deepseekChatJson({ apiKey, model, messages, maxTokens = 1400 }) {
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages,
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DeepSeek API error ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = await res.json();
  const content = (data?.choices?.[0]?.message?.content ?? "").toString();
  return content;
}

function toIsoOrNow(s) {
  const t = (s ?? "").toString().trim();
  if (!t) return new Date().toISOString();
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function ensureArrayOfStrings(v) {
  if (!Array.isArray(v)) return [];
  return v.map(x => (x ?? "").toString()).map(x => x.trim()).filter(Boolean);
}

function canonicalizeSymptomLabel(sym) {
  const s = (sym ?? "").toString().trim();
  if (!s) return null;

  // If it's already a known i18n key, map to EN label.
  if (s in SYMPTOM_LABEL_BY_KEY) return SYMPTOM_LABEL_BY_KEY[s];
  const key = SYMPTOM_KEYS.find(k => k.toLowerCase() === s.toLowerCase());
  if (key && key in SYMPTOM_LABEL_BY_KEY) return SYMPTOM_LABEL_BY_KEY[key];

  // Map free text to closest known EN label.
  if (SYMPTOM_LABELS.length > 0) {
    const best = bestByScore(SYMPTOM_LABELS, label => tokenOverlapScore(s, label));
    if (best && best.score >= 0.45) return best.it;
  }
  return s;
}

function canonicalizeSymptoms(list) {
  const out = [];
  for (const x of ensureArrayOfStrings(list)) {
    const c = canonicalizeSymptomLabel(x);
    if (c) out.push(c);
  }
  return [...new Set(out)];
}

function parseMileage(v) {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  const s = (v ?? "").toString().trim();
  if (!s) return null;
  const n = Number(s.replace(/[^\d]+/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function computeLocalId({ forum, sourceUrl, item, canonical }) {
  const parts = {
    forum: forum ?? "",
    source_url: sourceUrl ?? "",
    case_author: (item.case_author ?? "").toString(),
    brand_raw: (item.brand_raw ?? "").toString(),
    model_raw: (item.model_raw ?? "").toString(),
    engine_raw: (item.engine_raw ?? "").toString(),
    fault_post_numbers: normalizeEvidencePosts(item.fault_post_numbers),
    resolution_post_numbers: normalizeEvidencePosts(item.resolution_post_numbers),
    obd_codes: ensureArrayOfStrings(item.obd_codes),
    resolution: (item.resolution ?? "").toString(),
    vehicle_brand: canonical.vehicle_brand ?? "",
    vehicle_model: canonical.vehicle_model ?? "",
    engine_power: canonical.engine_power ?? "",
  };
  const input = JSON.stringify(parts);
  const hash = crypto.createHash("sha256").update(input, "utf8").digest("hex").slice(0, 16);
  return `seed_${hash}`;
}

function isCompleteRecord(rec) {
  // User's strict requirements for "ready":
  // - canonical vehicle_brand and vehicle_model must be present
  // - engine_power is nice-to-have, not required
  // - symptoms must be non-empty
  // - description and resolution must be non-empty strings
  // - obd_codes array exists (can be empty)
  if (!rec.vehicle_brand) return false;
  if (!rec.vehicle_model) return false;
  if (!Array.isArray(rec.symptoms) || rec.symptoms.length === 0) return false;
  if (!Array.isArray(rec.obd_codes)) return false;
  if (!rec.description || !rec.description.trim()) return false;
  if (!rec.resolution || !rec.resolution.trim()) return false;
  return true;
}

const UNRESOLVED_RESOLUTION_PATTERNS = [
  /\bnap[ií][sš]u\b.{0,50}\b(?:jak|az|až)\b.{0,40}\bdopadlo\b/i,
  /\b(?:z[ií]tra|tomorrow)\b.{0,60}\b(?:bude|by mělo být|should be|will be)\b.{0,20}\bok\b/i,
  /\b(?:dnes|today)\b.{0,60}\b(?:odvezl|odvezla|took it in|taken in)\b.{0,80}\b(?:opravu|repair)\b/i,
  /\b(?:pl[aá]nuj(?:i|e)|planning to|plan to)\b.{0,80}\b(?:servis|service|electrician|repair|opravu)\b/i,
  /\b(?:will|nap[ií][sš]u)\b.{0,40}\b(?:update|let you know|report back)\b/i,
];

function hasUnresolvedResolutionLanguage(resolution) {
  const text = (resolution ?? "").toString().trim();
  if (!text) return false;
  return UNRESOLVED_RESOLUTION_PATTERNS.some(pattern => pattern.test(text));
}

function extractedCaseUsesUnresolvedResolutionPost(item, postTextByNumber) {
  if (!(postTextByNumber instanceof Map) || postTextByNumber.size === 0) return false;
  const resolutionPosts = normalizeEvidencePosts(item?.resolution_post_numbers);
  if (resolutionPosts.length === 0) return false;
  return resolutionPosts.some(postNumber => {
    const text = postTextByNumber.get(postNumber) ?? "";
    return hasUnresolvedResolutionLanguage(text);
  });
}

function isReadyRecord(rec, classifier) {
  return (
    isCompleteRecord(rec) &&
    isClassifierApproved(classifier) &&
    !hasUnresolvedResolutionLanguage(rec?.resolution)
  );
}

function isReviewWorthClassifier(result) {
  return !!(
    result &&
    result.is_relevant === true &&
    result.has_explicit_fault === true
  );
}

function deriveContextVehicle(parentForumTitle, subforumTitle) {
  const context = [parentForumTitle, subforumTitle].filter(Boolean).join(" | ");
  const brandEntry = getBrandEntryCanonical(context);
  if (!brandEntry) {
    return { brandEntry: null, vehicle_brand: null, vehicle_model: null };
  }
  const vehicle_model = pickModelLabel(brandEntry, context);
  return {
    brandEntry,
    vehicle_brand: brandEntry.brand,
    vehicle_model: vehicle_model ?? null,
  };
}

function buildEngineMatchText(engineRaw, threadTitle, subforumName, subforumTitle) {
  return [engineRaw, threadTitle, subforumName, subforumTitle]
    .map(x => (x ?? "").toString().trim())
    .filter(Boolean)
    .join(" | ");
}

function parsePostMetaFromThreadText(threadText) {
  const map = new Map();
  for (const line of (threadText ?? "").toString().split(/\r?\n/)) {
    const match = line.match(/^POST\s+(\d+)\s*\|\s*(.+):\s*$/);
    if (!match) continue;
    const postNumber = Number(match[1]);
    const meta = match[2] ?? "";
    const authorMatch = meta.match(/\bauthor:\s*([^|]+?)(?=\s*\||$)/i);
    const isThreadAuthorMatch = meta.match(/\bis_thread_author:\s*(true|false)/i);
    if (!Number.isInteger(postNumber) || postNumber <= 0) continue;
    map.set(postNumber, {
      author: authorMatch?.[1]?.trim() ?? "",
      is_thread_author: isThreadAuthorMatch?.[1] === "true",
    });
  }
  return map;
}

function parsePostTextByNumber(threadText) {
  const map = new Map();
  let currentPostNumber = null;
  let buffer = [];

  const flush = () => {
    if (!Number.isFinite(currentPostNumber)) return;
    map.set(currentPostNumber, buffer.join("\n").trim());
  };

  for (const line of (threadText ?? "").toString().split(/\r?\n/)) {
    const match = line.match(/^POST\s+(\d+)\s*\|/);
    if (match) {
      flush();
      currentPostNumber = Number(match[1]);
      buffer = [];
      continue;
    }
    if (Number.isFinite(currentPostNumber)) buffer.push(line);
  }

  flush();
  return map;
}

function validateExtractedCaseAuthor(item, postMetaByNumber) {
  let caseAuthor = (item?.case_author ?? "").toString().trim();
  const faultPosts = normalizeEvidencePosts(item?.fault_post_numbers);
  const resolutionPosts = normalizeEvidencePosts(item?.resolution_post_numbers);
  if (faultPosts.length === 0) {
    return { ok: false, reason: "Missing fault_post_numbers for extracted case." };
  }
  if (resolutionPosts.length === 0) {
    return { ok: false, reason: "Missing resolution_post_numbers for extracted case." };
  }
  if (!(postMetaByNumber instanceof Map) || postMetaByNumber.size === 0) {
    if (!caseAuthor) return { ok: false, reason: "Missing case_author for extracted case." };
    return { ok: true, caseAuthor };
  }

  if (!caseAuthor) {
    const derivedAuthors = [...new Set(
      [...faultPosts, ...resolutionPosts]
        .map(postNumber => postMetaByNumber.get(postNumber)?.author ?? "")
        .map(author => author.trim())
        .filter(Boolean)
    )];
    if (derivedAuthors.length === 1) {
      caseAuthor = derivedAuthors[0];
    }
  }

  if (!caseAuthor) {
    return { ok: false, reason: "Missing case_author for extracted case." };
  }

  const expected = normalizeText(caseAuthor);
  const authoredFaultPosts = faultPosts.filter(postNumber => {
    const meta = postMetaByNumber.get(postNumber);
    return meta?.author ? normalizeText(meta.author) === expected : false;
  });
  const authoredResolutionPosts = resolutionPosts.filter(postNumber => {
    const meta = postMetaByNumber.get(postNumber);
    return meta?.author ? normalizeText(meta.author) === expected : false;
  });

  if (authoredFaultPosts.length > 0 && authoredFaultPosts.length !== faultPosts.length) {
    return { ok: false, reason: "Fault posts do not consistently belong to case_author." };
  }
  if (authoredResolutionPosts.length > 0 && authoredResolutionPosts.length !== resolutionPosts.length) {
    return { ok: false, reason: "Resolution posts do not consistently belong to case_author." };
  }

  return { ok: true, caseAuthor };
}

function computeReviewId({ forum, sourceUrl, threadTitle, stage }) {
  const input = JSON.stringify({
    forum: forum ?? "",
    source_url: sourceUrl ?? "",
    thread_title: threadTitle ?? "",
    stage: stage ?? "",
  });
  const hash = crypto.createHash("sha256").update(input, "utf8").digest("hex").slice(0, 16);
  return `review_${hash}`;
}

async function writeJsonFileUnique(dir, baseName, obj) {
  await fs.mkdir(dir, { recursive: true });
  const safe = baseName.replace(/[^a-zA-Z0-9._-]/g, "_");
  let filePath = path.join(dir, `${safe}.json`);
  for (let i = 2; ; i++) {
    try {
      await fs.writeFile(filePath, JSON.stringify(obj, null, 2), { encoding: "utf8", flag: "wx" });
      return filePath;
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && e.code === "EEXIST") {
        filePath = path.join(dir, `${safe}-${i}.json`);
        continue;
      }
      throw e;
    }
  }
}

async function appendJsonLine(filePath, obj) {
  await fs.appendFile(filePath, JSON.stringify(obj) + "\n", "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!Array.isArray(args.inputs) || args.inputs.length === 0 || !args.outDir) usage(1);

  const sel = selectCatalogForMarket(args.market);
  ACTIVE_MARKET = sel.market;
  ACTIVE_CATALOG = sel.catalog;

  if (args.crawl && args.inputs.some(input => !/^https?:\/\//i.test(input))) {
    console.error("--crawl requires all inputs to be URLs.");
    process.exit(2);
  }

  // If input is a URL, auto-derive forum name from hostname (to reduce friction).
  if (args.forum === DEFAULT_FORUM && /^https?:\/\//i.test(args.inputs[0] ?? "")) {
    const host = safeHostnameFromUrl(args.inputs[0]);
    if (host) args.forum = host;
  }
  if (!args.forum.trim()) {
    console.error("Missing --forum value.");
    usage(1);
  }
  if (!args.userId.trim()) {
    console.error("Missing --user-id value.");
    usage(1);
  }

  const outReady = path.join(args.outDir, "ready");
  const outReview = path.join(args.outDir, "to_review");
  const discardedPath = path.join(args.outDir, "discarded.jsonl");
  await fs.mkdir(outReady, { recursive: true });
  if (args.keepReview) {
    await fs.mkdir(outReview, { recursive: true });
  }

  // If input is a URL, use it as default source_url (for hashing) unless explicitly set.
  if (!args.sourceUrl && args.inputs.length === 1 && /^https?:\/\//i.test(args.inputs[0])) {
    args.sourceUrl = args.inputs[0];
  }
  if (!args.cookie) args.cookie = process.env.FORUM_COOKIE ?? "";

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

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error("Missing DEEPSEEK_API_KEY (or use --dry).");
    process.exit(2);
  }

  async function processOneThread({
    threadUrl,
    threadTitle = "",
    threadTextRaw,
    parentForumTitle = "",
    subforumName = "",
    subforumTitle = "",
    subforumUrl = "",
  }) {
    const rawThreadText = typeof threadTextRaw === "string"
      ? threadTextRaw
      : (threadTextRaw?.text ?? "");
    const normalizedThreadTitle = threadTitle
      || (typeof threadTextRaw === "object" ? threadTextRaw?.title ?? "" : "")
      || extractThreadTitleFromText(rawThreadText);
    const text = (args.maxChars && rawThreadText.length > args.maxChars)
      ? rawThreadText.slice(0, args.maxChars) + "\n\n[TRUNCATED]"
      : rawThreadText;
    const postMetaByNumber = parsePostMetaFromThreadText(rawThreadText);
    const postTextByNumber = parsePostTextByNumber(rawThreadText);

    const sourceUrl = threadUrl || args.sourceUrl;
    const brands = getCatalogBrands();
    const standardSymptoms = SYMPTOM_LABELS.length > 0
      ? `Prefer standardized symptoms such as: ${SYMPTOM_LABELS.join(", ")}`
      : "";

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

      const reviewId = computeReviewId({
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

    const classifierPrompt = [
      "You are an automotive forum thread classifier for seed data quality control.",
      "Return ONLY one JSON object, no other text.",
      "",
      "Rules:",
      "- Do not guess or infer missing facts.",
      "- Approve the thread if it contains at least one extractable resolved automotive case.",
      "- A valid case means one forum user explicitly describes their own vehicle fault/symptoms and later confirms the successful repair for that same case.",
      "- The confirming user does NOT need to be the original thread author.",
      "- A thread may contain multiple independent resolved cases from different users. That is allowed.",
      "- Ignore unresolved side discussions, guesses, or advice-only replies if at least one valid case exists.",
      "- same_user_confirms_resolution must be true only if at least one valid case has the same reporting user and confirming user.",
      "",
      "JSON schema:",
      '{"should_seed":false,"is_relevant":false,"has_explicit_fault":false,"has_confirmed_resolution":false,"same_user_confirms_resolution":false,"has_required_fields":false,"reason":"","evidence_post_numbers":[]}',
      "",
      "Definitions:",
      "- should_seed should focus on whether the thread contains at least one usable resolved case.",
      "- has_required_fields means forum context plus thread text explicitly contain enough information for at least one case: brand, model, engine, symptoms, description, and confirmed resolution.",
      "- evidence_post_numbers should list the post numbers that support at least one valid case.",
      "",
      "Forum thread text:",
      text,
    ].filter(Boolean).join("\n");

    const classifierContent = await deepseekChatJson({
      apiKey,
      model: args.model,
      maxTokens: 900,
      messages: [{ role: "user", content: classifierPrompt }],
    });
    const classifier = safeParseJsonObject(classifierContent);
    classifier.evidence_post_numbers = normalizeEvidencePosts(classifier.evidence_post_numbers);

    if (!isClassifierApproved(classifier)) {
      if (isReviewWorthClassifier(classifier)) {
        const kept = await writeReview("classifier", classifier.reason || "Thread looks like a real diagnostic case but did not pass READY gate.", {
          classifier,
        });
        return { ready: 0, review: kept ? 1 : 0, discarded: kept ? 0 : 1, empty: false };
      }
      await logDiscard("classifier", classifier.reason || "Thread did not pass strict seed gate.", {
        classifier,
      });
      return { ready: 0, review: 0, discarded: 1, empty: false };
    }

    const evidencePosts = classifier.evidence_post_numbers.join(", ");
    const extractorPrompt = [
      "You extract one or more high-confidence resolved automotive diagnostic cases from a forum thread.",
      "Return ONLY a JSON array, no other text.",
      "",
      "Rules:",
      "- Do not guess or infer missing facts.",
      "- Each case must belong to one forum user: the same user must explicitly describe the fault/symptoms and later confirm the successful repair for that same case.",
      "- The case author does NOT need to be the original thread author.",
      "- A thread may contain multiple independent resolved cases from different users. Return all qualifying cases.",
      "- Ignore advice-only replies, guesses, or cases where another user suggests a fix but the reporting user never confirms it.",
      "- Use classifier evidence posts as hints, but you may use other posts if they clearly form a valid same-user case.",
      "- If any required field is ambiguous for one case, omit that case but continue extracting other clear cases.",
      "- If there are no clear cases, return [].",
      "- Translate symptoms, description, and resolution to English.",
      "- If mileage is explicitly mentioned, extract it as an integer number of kilometers (e.g., 185000).",
      "- Normalize OBD codes to uppercase format like P0401. If none are present, use [].",
      "",
      "Output schema:",
      `[{"case_author":"","fault_post_numbers":[],"resolution_post_numbers":[],"brand_raw":"","model_raw":"","engine_raw":"","engine_code_raw":"","mileage":null,"symptoms":[],"obd_codes":[],"description":"","resolution":"","closed_at":""}]`,
      "",
      "Notes:",
      `- brand_raw should be one of these if possible: ${brands.join(", ")}`,
      ACTIVE_MARKET === "eu"
        ? "- engine_raw can be something like '2.0 TDI CR' or include kW if present."
        : "- engine_raw can be something like '2.0 TDI CR' or include kW/hp if present.",
      "- engine_code_raw can be codes like 'CUNA' if present, otherwise ''.",
      "- closed_at should be the date of the resolving post if present, otherwise ''.",
      standardSymptoms ? `- ${standardSymptoms}` : "",
      `- Classifier evidence post numbers: ${evidencePosts}`,
      "",
      "Forum thread text:",
      text,
    ].filter(Boolean).join("\n");

    const extractorContent = await deepseekChatJson({
      apiKey,
      model: args.model,
      maxTokens: 2600,
      messages: [{ role: "user", content: extractorPrompt }],
    });
    const extracted = safeParseJsonArray(extractorContent);

    if (!Array.isArray(extracted) || extracted.length < 1) {
      const kept = await writeReview("extractor", `Expected one or more clear extracted cases, got ${Array.isArray(extracted) ? extracted.length : 0}.`, {
        classifier,
        extracted_count: Array.isArray(extracted) ? extracted.length : 0,
      });
      return { ready: 0, review: kept ? 1 : 0, discarded: kept ? 0 : 1, empty: true };
    }

    let readyCount = 0;
    let reviewCount = 0;
    let discardedCount = 0;

    for (const item of extracted) {
      const authorValidation = validateExtractedCaseAuthor(item, postMetaByNumber);
      if (!authorValidation.ok) {
        const kept = await writeReview("record", authorValidation.reason || "Extracted case failed same-user author validation.", {
          classifier,
          extracted_raw: item ?? null,
        });
        if (kept) reviewCount++;
        else discardedCount++;
        continue;
      }
      const normalizedItem = {
        ...(item ?? {}),
        case_author: authorValidation.caseAuthor ?? (item?.case_author ?? ""),
      };
      if (extractedCaseUsesUnresolvedResolutionPost(normalizedItem, postTextByNumber)) {
        const kept = await writeReview("record", "Resolution post still uses future or uncertain language in the source thread.", {
          classifier,
          extracted_raw: normalizedItem ?? null,
        });
        if (kept) reviewCount++;
        else discardedCount++;
        continue;
      }

      const brandRaw = (normalizedItem?.brand_raw ?? "").toString();
      const modelRaw = (normalizedItem?.model_raw ?? "").toString();
      const engineRaw = (normalizedItem?.engine_raw ?? "").toString();
      const engineCodeRaw = (normalizedItem?.engine_code_raw ?? "").toString().trim();

      const contextVehicle = deriveContextVehicle(parentForumTitle, subforumTitle);
      const brandEntry = getBrandEntryCanonical(brandRaw) ?? contextVehicle.brandEntry;
      const vehicle_brand = brandEntry?.brand ?? contextVehicle.vehicle_brand ?? null;
      const vehicle_model = brandEntry
        ? (pickModelLabel(brandEntry, modelRaw) ?? contextVehicle.vehicle_model ?? null)
        : null;
      const engineMatchText = buildEngineMatchText(engineRaw, normalizedThreadTitle, subforumName, subforumTitle);
      const engine_power = brandEntry ? pickEnginePower(brandEntry, vehicle_model, engineMatchText) : null;

      const canonical = { vehicle_brand, vehicle_model, engine_power };
      const local_id = computeLocalId({ forum: args.forum, sourceUrl, item: normalizedItem, canonical });

      let description = (normalizedItem?.description ?? "").toString();
      if (engineCodeRaw && !normalizeText(description).includes(normalizeText(engineCodeRaw))) {
        description = description?.trim()
          ? `${description.trim()} Engine code: ${engineCodeRaw}.`
          : `Engine code: ${engineCodeRaw}.`;
      }

      const rec = {
        local_id,
        user_id: args.userId,
        vehicle_brand,
        vehicle_model,
        mileage: parseMileage(normalizedItem?.mileage),
        engine_power,
        symptoms: canonicalizeSymptoms(normalizedItem?.symptoms),
        obd_codes: ensureArrayOfStrings(normalizedItem?.obd_codes).map(c => c.toUpperCase()),
        description,
        resolution: (normalizedItem?.resolution ?? "").toString(),
        closed_at: toIsoOrNow(normalizedItem?.closed_at),
      };

      const isReady = isReadyRecord(rec, classifier);
      if (!isReady) {
        const kept = await writeReview("record", "Extracted case looks promising but failed strict READY validation.", {
          classifier,
          candidate: rec,
          extracted_raw: normalizedItem ?? null,
        });
        if (kept) reviewCount++;
        else discardedCount++;
        continue;
      }

      await writeJsonFileUnique(outReady, rec.local_id, rec);
      readyCount++;
    }

    return { ready: readyCount, review: reviewCount, discarded: discardedCount, empty: false };
  }

  if (args.crawl) {
    let totalReady = 0;
    let totalReview = 0;
    let totalDiscarded = 0;
    let totalProcessedThreads = 0;

    for (let inputIndex = 0; inputIndex < args.inputs.length; inputIndex++) {
      const input = args.inputs[inputIndex];
      logProgress(`Input ${inputIndex + 1}/${args.inputs.length} start: ${input}`);
      if (!isForumSectionUrl(input) && !isTopicUrl(input)) {
        console.error(`Input URL does not look like an Invision forum (/forum/...) or topic (/topic/...): ${input}`);
        continue;
      }

      // If a topic URL is passed with --crawl, treat it as a single-thread run.
      if (isTopicUrl(input)) {
        const raw = await fetchThreadAsText({ url: input, pages: args.pages, cookie: args.cookie });
        const res = await processOneThread({ threadUrl: input, threadTextRaw: raw });
        totalReady += res.ready;
        totalReview += res.review;
        totalDiscarded += res.discarded;
        totalProcessedThreads += 1;
        continue;
      }

      const inputStem = makeInputStem(input);
      const discoveredPath = path.join(args.outDir, `discovered_threads_${inputStem}.jsonl`);
      const donePath = path.join(args.outDir, `done_threads_${inputStem}.txt`);
      const errPath = path.join(args.outDir, `errors_${inputStem}.txt`);

      let doneSet = new Set();
      try {
        const doneTxt = await fs.readFile(donePath, "utf8");
        doneSet = new Set(doneTxt.split(/\r?\n/).map(x => x.trim()).filter(Boolean));
      } catch (_) {}

      const { threads } = await discoverForumThreads({
        forumUrl: input,
        indexPages: args.indexPages,
        cookie: args.cookie,
        sleepMs: args.sleepMs,
      });
      logProgress(`Input ${inputIndex + 1}/${args.inputs.length} discovered ${threads.length} thread(s): ${input}`);

      await fs.writeFile(
        discoveredPath,
        threads.map(thread => JSON.stringify(thread)).join("\n") + (threads.length ? "\n" : ""),
        "utf8"
      );

      const toProcess = threads.filter(thread => !doneSet.has(thread.url)).slice(0, args.maxThreads);
      logProgress(`Input ${inputIndex + 1}/${args.inputs.length} processing ${toProcess.length} new thread(s): ${input}`);

      for (let threadIndex = 0; threadIndex < toProcess.length; threadIndex++) {
        const thread = toProcess[threadIndex];
        try {
          logProgress(`Thread ${threadIndex + 1}/${toProcess.length}: ${thread.title || thread.url}`);
          const raw = await fetchThreadAsText({
            url: thread.url,
            pages: args.pages,
            cookie: args.cookie,
            forumTitle: thread.parentForumTitle || "",
            subforumName: thread.subforumName || "",
            subforumTitle: thread.subforumTitle || "",
          });
          const res = await processOneThread({
            threadUrl: thread.url,
            threadTitle: thread.title,
            threadTextRaw: raw,
            parentForumTitle: thread.parentForumTitle || "",
            subforumName: thread.subforumName || "",
            subforumTitle: thread.subforumTitle || "",
            subforumUrl: thread.subforumUrl || "",
          });
          totalReady += res.ready;
          totalReview += res.review;
          totalDiscarded += res.discarded;
          totalProcessedThreads++;
          await fs.appendFile(donePath, thread.url + "\n", "utf8");
        } catch (e) {
          const msg = e?.stack || String(e);
          await fs.appendFile(errPath, `[${new Date().toISOString()}] ${thread.url}\n${msg}\n\n`, "utf8");
        }
        if (args.sleepMs > 0) await sleep(args.sleepMs);
      }
      logProgress(`Input ${inputIndex + 1}/${args.inputs.length} done: ${input}`);
    }

    if (args.keepReview) {
      console.log(`Processed ${totalProcessedThreads} thread(s). Wrote ${totalReady} ready record(s), ${totalReview} review item(s) and discarded ${totalDiscarded} item(s) into: ${args.outDir}`);
    } else {
      console.log(`Processed ${totalProcessedThreads} thread(s). Wrote ${totalReady} ready record(s) and discarded ${totalDiscarded} item(s) into: ${args.outDir}`);
    }
    return;
  }

  // Single-thread mode (URL or file), supports multiple inputs.
  let totalReady = 0;
  let totalReview = 0;
  let totalDiscarded = 0;

  for (const input of args.inputs) {
    const threadSource = /^https?:\/\//i.test(input)
      ? await fetchThreadAsText({ url: input, pages: args.pages, cookie: args.cookie })
      : await readInputText(input);

    const sourceUrl = /^https?:\/\//i.test(input)
      ? input
      : (args.inputs.length === 1 ? args.sourceUrl : input);
    const res = await processOneThread({ threadUrl: sourceUrl, threadTextRaw: threadSource });
    totalReady += res.ready;
    totalReview += res.review;
    totalDiscarded += res.discarded;
  }

  if (args.keepReview) {
    console.log(`Wrote ${totalReady} ready record(s), ${totalReview} review item(s) and discarded ${totalDiscarded} item(s) into: ${args.outDir}`);
  } else {
    console.log(`Wrote ${totalReady} ready record(s) and discarded ${totalDiscarded} item(s) into: ${args.outDir}`);
  }
  return;

}

const entryArg = process.argv[1];
const isDirectRun = entryArg
  ? import.meta.url === pathToFileURL(path.resolve(entryArg)).href
  : false;

if (isDirectRun) {
  main().catch((e) => {
    console.error(e?.stack || String(e));
    process.exit(1);
  });
}

export {
  appendJsonLine,
  canonicalizeSymptoms,
  buildThreadText,
  computeLocalId,
  ensureArrayOfStrings,
  extractTargetChildSections,
  extractTitleFromHtml,
  extractPostsFromInvision,
  htmlToText,
  isClassifierApproved,
  isCompleteRecord,
  normalizeText,
  parsePostMetaFromThreadText,
  parsePostTextByNumber,
  pickModelLabel,
  pickEnginePower,
  isReviewWorthClassifier,
  isReadyRecord,
  extractedCaseUsesUnresolvedResolutionPost,
  normalizeEvidencePosts,
  safeParseJsonArray,
  safeParseJsonObject,
  selectThreadPages,
  selectCatalogForMarket,
  shouldExpandMotorSubforums,
  toIsoOrNow,
  validateExtractedCaseAuthor,
  writeJsonFileUnique,
};
