#!/usr/bin/env node
/**
 * VW Club seeding helper.
 *
 * Crawl strategy:
 * - start from the Volkswagen model hub (or a specific model forum URL)
 * - keep only model forums that plausibly map to the EU Volkswagen catalog
 * - within each model forum, follow diagnostically relevant child sections
 * - on the model root itself, keep only problem-looking thread titles
 * - read full threads and extract resolved same-user cases via LLM
 */

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
  htmlToText,
  isClassifierApproved,
  isReadyRecord,
  normalizeEvidencePosts,
  normalizeText,
  parsePostMetaFromThreadText,
  pickEnginePower,
  pickModelLabel,
  safeParseJsonArray,
  safeParseJsonObject,
  selectCatalogForMarket,
  toIsoOrNow,
  validateExtractedCaseAuthor,
  writeJsonFileUnique,
} from "./forum-seed.mjs";

const DEFAULT_ROOT_URL = "https://www.vw-club.cz/volkswagen/";
const DEFAULT_FORUM = "vw_club_cz";
const DEFAULT_USER_ID = "ai_importer";
const DEFAULT_MODEL = "deepseek-chat";

const ROOT_TOPIC_BLACKLIST = [
  /\bbazar\b/i,
  /\bprod[aá]m\b/i,
  /\bkoup[ií]m\b/i,
  /\bsh[aá]n[ií]m\b/i,
  /\bn[aá]vod\b/i,
  /\bmanual\b/i,
  /\bjak na to\b/i,
  /\bfotky\b/i,
  /\bgalerie\b/i,
  /\bpokec\b/i,
  /\btuning\b/i,
  /\bstyling\b/i,
  /\bčasopis/i,
  /\bcasopis/i,
  /\bmodely\b/i,
  /\bencykloped/i,
];

const ROOT_TOPIC_SIGNAL_PATTERNS = [
  /\b[pbcu]\d{4}\b/i,
  /\b(nejde|nestart|zhas(i|í|n)|skub|cuk|klep|hluk|hu[cč]i|p[ií]sk|nouz|probl[eé]m|z[aá]vada|chyba|kontrolka|olej|tlak|netop[ií]|sahara|ventil[aá]tor|spojka|brzdy|airbag|abs|esp|emise|dpf|egr|turbo|cidlo|čidlo|senzor|elektrika|kabel[aá][žz]|pohon|vstrik|vstřik|v[aá]cka|vačka|dsg|prevodovka|převodovka|servo|altern[aá]tor|baterie|klima)\b/i,
  /\b\d\.\d\b.*\b(tsi|tdi|fsi|mpi|tfsi|gti|bi?tdi)\b/i,
  /\b\d{2,3}\s*kw\b/i,
];

const SECTION_BLACKLIST = [
  /\bbazar\b/i,
  /\bencykloped/i,
  /\bostatn[ií]\b/i,
  /\bexteri[eé]r\b/i,
  /\bstyling\b/i,
  /\btuning\b/i,
  /\bfotk/i,
  /\bgaler/i,
  /\bpokec\b/i,
  /\bsrazy?\b/i,
  /\bzabezpe[čc]en[ií]\b/i,
  /\bhudba\b/i,
  /\bpoji[šs]t[eě]n[ií]\b/i,
];

const SECTION_KEEPERS = [
  { re: /\bmotory?\b.*\bdiesel\b|\bdiesel\b/i, kind: "motor-diesel" },
  { re: /\bmotory?\b.*\bbenzin\b|\bbenzin\b/i, kind: "motor-benzin" },
  { re: /\bmotory?\b.*\belektro\b|\belektrick[yý]\s+pohon\b/i, kind: "electric-drive" },
  { re: /\bz[aá]vady\b|\bservis/i, kind: "zavady-servis" },
  { re: /\binteri[eé]r\b.*\belektro\b|\binteri[eé]r\b.*\belektron/i, kind: "interier-elektro" },
  { re: /\belektro\b|\belektron/i, kind: "elektro" },
  { re: /\bpodvozek\b|\bkola\b|\bbrzdy\b/i, kind: "podvozek" },
  { re: /\bmechanika\b/i, kind: "mechanika" },
];

const GENERIC_URL_BLACKLIST = [
  /^\/$/,
  /^\/index\.php/i,
  /^\/faq/i,
  /^\/search/i,
  /^\/memberlist/i,
  /^\/ucp/i,
  /^\/download/i,
  /^\/app\.php/i,
  /^\/mcp/i,
];

const MODEL_ALIAS_BY_LABEL = new Map([
  ["Golf V (2006–2008)", ["Golf 5", "Golf V / Jetta", "Golf Mk5"]],
  ["Golf VI (2008–2012)", ["Golf 6", "Golf VI / Jetta", "Golf Mk6"]],
  ["Golf VII (2012–2020)", ["Golf 7", "Golf Mk7"]],
  ["Golf VIII (2020–dosud)", ["Golf 8", "Golf Mk8"]],
  ["Jetta V (2006–2010)", ["Jetta 5", "Golf V / Jetta"]],
  ["Jetta VI (2010–2018)", ["Jetta 6", "Golf VI / Jetta"]],
  ["Jetta VII (2018–dosud)", ["Jetta 7"]],
  ["Passat B6 (2006–2010)", ["Passat 3C", "Passat 3C / CC", "Passat CC"]],
  ["Passat B7 (2010–2014)", ["Passat 36", "Passat 3AA"]],
  ["Passat B8 (2014–2023)", ["Passat 3G", "Passat 3G8"]],
  ["Transporter T5 (2006–2015)", ["Transporter V", "Multivan V", "T5"]],
  ["Transporter T6 (2015–2019)", ["Transporter VI", "Multivan VI", "T6"]],
  ["Transporter T6.1 (2019–dosud)", ["T6.1", "Transporter T6.1"]],
  ["ID.3 (2020–dosud)", ["ID3", "ID 3"]],
  ["ID.4 (2020–dosud)", ["ID4", "ID 4"]],
  ["ID.5 (2021–dosud)", ["ID5", "ID 5"]],
  ["ID.7 (2023–dosud)", ["ID7", "ID 7"]],
]);

const { catalog: EU_CATALOG } = selectCatalogForMarket("eu");
const VOLKSWAGEN_ENTRY = EU_CATALOG.find(entry => normalizeText(entry.brand) === "volkswagen");

if (!VOLKSWAGEN_ENTRY) {
  throw new Error("Volkswagen brand entry was not found in web/src/constants/catalog.js");
}

function usage(exitCode = 1) {
  const msg = `
Usage:
  node scripts/forum-seed-vw.mjs <out_dir> [options]
  node scripts/forum-seed-vw.mjs <https://www.vw-club.cz/volkswagen/> <out_dir> [options]
  node scripts/forum-seed-vw.mjs <https://www.vw-club.cz/golf-v-jetta/> <out_dir> [options]
  node scripts/forum-seed-vw.mjs <https://www.vw-club.cz/...-t123456.html> <out_dir> [options]

Options:
  --forum <name>      Deterministic local_id namespace. Default: ${DEFAULT_FORUM}
  --user-id <id>      Stored into user_id. Default: ${DEFAULT_USER_ID} (alias resolved during cloud import)
  --source-url <url>  Optional source pointer for hashing.
  --model <name>      DeepSeek model. Default: ${DEFAULT_MODEL}
  --max-chars <n>     Max characters sent to the LLM. Default: 60000
  --pages <n>         Max thread pages to read. Default: 999
  --index-pages <n>   Max pages to read per forum listing. Default: 25
  --max-threads <n>   Max threads processed per input URL. Default: 20000
  --sleep-ms <n>      Delay between HTTP requests. Default: 250
  --cookie <value>    Optional Cookie header value.
  --dry               Do not call LLM.
  --help              Show help.

Env:
  DEEPSEEK_API_KEY    Required unless --dry is used.
  FORUM_COOKIE        Optional Cookie header value (used if --cookie is not provided).
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
    sourceUrl: "",
    model: DEFAULT_MODEL,
    maxChars: 60000,
    pages: 999,
    indexPages: 25,
    maxThreads: 20000,
    sleepMs: 250,
    cookie: "",
    dry: false,
  };

  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === "--help" || value === "-h") usage(0);
    if (value === "--dry") { args.dry = true; continue; }
    if (value === "--forum") { args.forum = argv[++i] ?? ""; continue; }
    if (value === "--user-id") { args.userId = argv[++i] ?? ""; continue; }
    if (value === "--source-url") { args.sourceUrl = argv[++i] ?? ""; continue; }
    if (value === "--model") { args.model = argv[++i] ?? ""; continue; }
    if (value === "--cookie") { args.cookie = argv[++i] ?? ""; continue; }
    if (value === "--max-chars") { args.maxChars = clampInt(argv[++i], 5000, 200000, args.maxChars); continue; }
    if (value === "--pages") { args.pages = clampInt(argv[++i], 1, 5000, args.pages); continue; }
    if (value === "--index-pages") { args.indexPages = clampInt(argv[++i], 1, 500, args.indexPages); continue; }
    if (value === "--max-threads") { args.maxThreads = clampInt(argv[++i], 1, 200000, args.maxThreads); continue; }
    if (value === "--sleep-ms") { args.sleepMs = clampInt(argv[++i], 0, 30000, args.sleepMs); continue; }
    if (value.startsWith("--")) {
      console.error(`Unknown option: ${value}`);
      usage(1);
    }
    positional.push(value);
  }

  if (positional.length === 1) {
    args.inputs = [DEFAULT_ROOT_URL];
    args.outDir = positional[0] ?? null;
  } else if (positional.length >= 2) {
    args.inputs = positional.slice(0, -1);
    args.outDir = positional[positional.length - 1] ?? null;
  }

  return args;
}

function clampInt(raw, min, max, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : fallback;
}

function logProgress(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function defaultHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (compatible; DriveCodexVWSeed/1.0; +https://example.invalid)",
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function tokenize(value) {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(/\s+/g).filter(Boolean) : [];
}

function tokenOverlapScore(query, candidate) {
  const q = new Set(tokenize(query));
  const c = new Set(tokenize(candidate));
  if (q.size === 0 || c.size === 0) return 0;
  let intersection = 0;
  for (const token of q) if (c.has(token)) intersection++;
  const union = q.size + c.size - intersection;
  return union ? intersection / union : 0;
}

function bestByScore(items, scoreFn) {
  let best = null;
  for (const item of items) {
    const score = scoreFn(item);
    if (!best || score > best.score) best = { it: item, score };
  }
  return best;
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

function uniqPreserveOrder(values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function stripYears(label) {
  return (label ?? "").toString().replace(/\s*\([^)]*\)\s*$/g, "").trim();
}

function getModelAliasTexts(modelLabel) {
  return uniqPreserveOrder([
    stripYears(modelLabel),
    ...(MODEL_ALIAS_BY_LABEL.get(modelLabel) ?? []),
  ]);
}

function scoreModelLabel(modelLabel, rawText) {
  return Math.max(...getModelAliasTexts(modelLabel).map(alias => tokenOverlapScore(rawText, alias)), 0);
}

function normalizeModelForumMatchText(value) {
  let text = (value ?? "").toString();
  const replacements = [
    [/\bpassat\s+3c\s*\/\s*cc\b/gi, "Passat B6"],
    [/\bpassat\s+3c\b/gi, "Passat B6"],
    [/\bpassat\s+cc\b/gi, "Passat B6"],
    [/\bgolf\s+5\b/gi, "Golf V"],
    [/\bgolf\s+6\b/gi, "Golf VI"],
    [/\bgolf\s+7\b/gi, "Golf VII"],
    [/\bgolf\s+8\b/gi, "Golf VIII"],
    [/\bjetta\s+5\b/gi, "Jetta V"],
    [/\bjetta\s+6\b/gi, "Jetta VI"],
    [/\bjetta\s+7\b/gi, "Jetta VII"],
  ];
  for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);
  return text;
}

function bestVwModelMatch(rawText) {
  const models = (VOLKSWAGEN_ENTRY.models ?? []).filter(model => model?.label);
  return bestByScore(models, model => scoreModelLabel(model.label, normalizeModelForumMatchText(rawText)));
}

function resolveVwVehicleModel({ modelRaw = "", threadTitle = "", subforumTitle = "", parentForumTitle = "" }) {
  const rawModelText = normalizeModelForumMatchText(modelRaw);
  const forumContextText = normalizeModelForumMatchText([parentForumTitle, subforumTitle].filter(Boolean).join(" | "));
  const derivedHints = [];

  if (/\bjetta\b/i.test(rawModelText)) {
    if (/\bgolf\s+v\b/i.test(forumContextText)) derivedHints.push("Jetta V");
    if (/\bgolf\s+vi\b/i.test(forumContextText)) derivedHints.push("Jetta VI");
    if (/\bgolf\s+vii\b/i.test(forumContextText)) derivedHints.push("Jetta VII");
  }

  if (/\bgolf\b/i.test(rawModelText)) {
    if (/\bgolf\s+v\b/i.test(forumContextText)) derivedHints.push("Golf V");
    if (/\bgolf\s+vi\b/i.test(forumContextText)) derivedHints.push("Golf VI");
    if (/\bgolf\s+vii\b/i.test(forumContextText)) derivedHints.push("Golf VII");
    if (/\bgolf\s+viii\b/i.test(forumContextText)) derivedHints.push("Golf VIII");
  }

  const contexts = [
    ...derivedHints,
    modelRaw,
    threadTitle,
    subforumTitle,
    [modelRaw, threadTitle].filter(Boolean).join(" | "),
    [modelRaw, subforumTitle].filter(Boolean).join(" | "),
    [modelRaw, parentForumTitle, subforumTitle, threadTitle].filter(Boolean).join(" | "),
  ]
    .map(value => normalizeModelForumMatchText(value))
    .filter(Boolean);

  for (const context of contexts) {
    const label = pickModelLabel(VOLKSWAGEN_ENTRY, context);
    if (label) return label;
  }

  return null;
}

function parseForumYearRange(text) {
  const head = (text ?? "").toString().slice(0, 2000);
  const match = head.match(/\b(19|20)\d{2}\s*-\s*(\d{2,4}|dosud|soucasnost|současnost|20\.\.)/i);
  if (!match) return null;
  const start = Number(match[0].slice(0, 4));
  const endToken = (match[2] ?? "").toString().trim().toLowerCase();
  let end = start;
  if (/^(dosud|soucasnost|současnost|20\.\.)$/.test(endToken)) {
    end = new Date().getFullYear();
  } else if (/^\d{2}$/.test(endToken)) {
    end = Math.floor(start / 100) * 100 + Number(endToken);
  } else if (/^\d{4}$/.test(endToken)) {
    end = Number(endToken);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start, end, text: `${start}-${endToken}` };
}

function hasKnownVwGroup(title) {
  const text = normalizeText(title);
  const groups = uniqPreserveOrder(
    [
      ...(VOLKSWAGEN_ENTRY.models ?? []).map(model => stripYears(model.label ?? model.group ?? "")),
    ]
      .map(item => normalizeText(item))
      .filter(Boolean)
      .flatMap(item => {
        const parts = item.split(/\s+/);
        return [parts.slice(0, 1).join(" "), parts.slice(0, 2).join(" ")];
      })
      .filter(Boolean)
  );
  return groups.some(group => group && text.includes(group));
}

function shouldKeepVwModelForum({ title, url, yearRange }) {
  const best = bestVwModelMatch([title, decodeURIComponent(new URL(url).pathname), yearRange?.text ?? ""].join(" | "));
  if (!best || best.score < 0.28) return false;
  if (!hasKnownVwGroup(title)) return false;
  if (yearRange && yearRange.end < 2006) return false;
  return true;
}

function safeHostnameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
  } catch {
    return "";
  }
}

function toAbsoluteUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return "";
  }
}

function extractAllAnchors(html, baseUrl) {
  const out = [];
  const regex = /<a\b[^>]*href=(?:"|')([^"'#\s>]+(?:#[^"']*)?)[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of (html ?? "").toString().matchAll(regex)) {
    const url = toAbsoluteUrl(match[1], baseUrl);
    if (!url) continue;
    out.push({
      url,
      text: htmlToText(match[2] ?? "").replace(/\s+/g, " ").trim(),
      index: match.index ?? 0,
    });
  }
  return out;
}

function sliceHtmlBeforeMarkers(html, markers) {
  const source = (html ?? "").toString();
  let end = source.length;
  for (const marker of markers) {
    const match = source.match(marker);
    if (match && typeof match.index === "number") end = Math.min(end, match.index);
  }
  return source.slice(0, end);
}

function isVwTopicUrl(url) {
  try {
    return /-t\d+(?:-\d+)?\.html$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function canonicalVwTopicUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = parsed.pathname.replace(/-t(\d+)(?:-\d+)?\.html$/i, "-t$1.html");
    return parsed.toString();
  } catch {
    return url;
  }
}

function canonicalVwListingUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = parsed.pathname.replace(/\/page\d+\.html$/i, "/");
    return parsed.toString();
  } catch {
    return url;
  }
}

function getTopicIdFromUrl(url) {
  try {
    return new URL(url).pathname.match(/-t(\d+)/i)?.[1] ?? "";
  } catch {
    return "";
  }
}

function getPageOrderFromUrl(url) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    const listingMatch = pathname.match(/\/page(\d+)\.html$/i);
    if (listingMatch) return Number(listingMatch[1]) || 1;
    const topicOffsetMatch = pathname.match(/-t\d+-(\d+)\.html$/i);
    if (topicOffsetMatch) return Number(topicOffsetMatch[1]) || 1;
    const start = parsed.searchParams.get("start");
    return start ? Number(start) || 1 : 1;
  } catch {
    return 1;
  }
}

function isLikelyVwModelCandidateUrl(url) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    if (parsed.hostname !== "www.vw-club.cz") return false;
    if (!pathname.endsWith("/")) return false;
    if (pathname === "/volkswagen/") return false;
    if (/\/page\d+\.html$/i.test(pathname)) return false;
    if (GENERIC_URL_BLACKLIST.some(pattern => pattern.test(pathname))) return false;
    if (/(motor|diesel|benzin|podvozek|kola|elektro|servis|bazar|tuning|styling|ostatni|encykloped)/i.test(pathname)) return false;
    return pathname.split("/").filter(Boolean).length === 1;
  } catch {
    return false;
  }
}

function extractVwModelForumsFromRoot(rootHtml, rootUrl) {
  const region = sliceHtmlBeforeMarkers(rootHtml, [
    /<select[^>]+id="jumpbox"/i,
    /Přejít na/i,
  ]);

  return uniqByKey(
    extractAllAnchors(region, rootUrl)
      .filter(anchor => safeHostnameFromUrl(anchor.url) === safeHostnameFromUrl(rootUrl))
      .filter(anchor => isLikelyVwModelCandidateUrl(anchor.url))
      .filter(anchor => anchor.text && anchor.text.length >= 3),
    anchor => canonicalVwListingUrl(anchor.url)
  ).map(anchor => ({
    url: canonicalVwListingUrl(anchor.url),
    label: anchor.text,
  }));
}

function classifyVwSection(label, url = "") {
  const combined = `${normalizeText(label)} ${normalizeText(decodeURIComponent(new URL(url, DEFAULT_ROOT_URL).pathname))}`.trim();
  if (!combined) return { keep: false, kind: "" };
  if (SECTION_BLACKLIST.some(pattern => pattern.test(combined))) return { keep: false, kind: "" };
  for (const { re, kind } of SECTION_KEEPERS) {
    if (re.test(combined)) return { keep: true, kind };
  }
  return { keep: false, kind: "" };
}

function extractVwRelevantSections(modelHtml, modelUrl) {
  const region = sliceHtmlBeforeMarkers(modelHtml, [
    /Nov[eé]\s*t[eé]ma/i,
    /<div[^>]+class="topic-actions"/i,
    /<div[^>]+class="action-bar"/i,
  ]);

  return uniqByKey(
    extractAllAnchors(region, modelUrl)
      .filter(anchor => safeHostnameFromUrl(anchor.url) === safeHostnameFromUrl(modelUrl))
      .filter(anchor => canonicalVwListingUrl(anchor.url) !== canonicalVwListingUrl(modelUrl))
      .filter(anchor => !isLikelyVwModelCandidateUrl(anchor.url))
      .filter(anchor => !isVwTopicUrl(anchor.url))
      .map(anchor => {
        const classified = classifyVwSection(anchor.text, anchor.url);
        return {
          url: canonicalVwListingUrl(anchor.url),
          name: anchor.text.replace(/\s+/g, " ").trim(),
          kind: classified.kind,
          keep: classified.keep,
        };
      })
      .filter(section => section.keep),
    section => section.url
  );
}

function looksLikeProblemTopicTitle(title) {
  return ROOT_TOPIC_SIGNAL_PATTERNS.some(pattern => pattern.test(title));
}

function looksLikeUsefulVwTopicTitle(title, { kind = "root" } = {}) {
  const raw = (title ?? "").toString().trim();
  if (!raw || raw.length < 6) return false;
  const normalized = normalizeText(raw);
  if (!normalized) return false;
  if (/^(prev|next|dalsi|predchozi|nov[eé]\s*t[eé]ma|zobrazit posledni prispevek|odpovedet)$/i.test(normalized)) return false;
  if (ROOT_TOPIC_BLACKLIST.some(pattern => pattern.test(raw))) return false;
  return kind === "root" ? looksLikeProblemTopicTitle(raw) : true;
}

function extractVwTopicEntriesFromForumPage(html, listingUrl, { kind = "root" } = {}) {
  const host = safeHostnameFromUrl(listingUrl);
  return uniqByKey(
    extractAllAnchors(html, listingUrl)
      .filter(anchor => safeHostnameFromUrl(anchor.url) === host)
      .filter(anchor => isVwTopicUrl(anchor.url))
      .filter(anchor => looksLikeUsefulVwTopicTitle(anchor.text, { kind }))
      .map(anchor => ({
        url: canonicalVwTopicUrl(anchor.url),
        title: anchor.text.replace(/\s+/g, " ").trim(),
      })),
    topic => topic.url
  );
}

function discoverVwListingPageUrls(firstHtml, baseUrl, maxPages) {
  const canonicalBase = canonicalVwListingUrl(baseUrl);
  const anchors = extractAllAnchors(firstHtml, baseUrl)
    .map(anchor => anchor.url)
    .filter(url => canonicalVwListingUrl(url) === canonicalBase)
    .filter(url => url === canonicalBase || /\/page\d+\.html$/i.test(new URL(url).pathname));
  return uniqPreserveOrder(
    [canonicalBase, ...anchors]
      .sort((a, b) => getPageOrderFromUrl(a) - getPageOrderFromUrl(b))
      .slice(0, Math.max(1, maxPages))
  );
}

function discoverVwTopicPageUrls(firstHtml, topicUrl, maxPages) {
  const topicId = getTopicIdFromUrl(topicUrl);
  const canonicalBase = canonicalVwTopicUrl(topicUrl);
  const anchors = extractAllAnchors(firstHtml, topicUrl)
    .map(anchor => anchor.url)
    .filter(url => getTopicIdFromUrl(url) === topicId);
  return uniqPreserveOrder(
    [canonicalBase, ...anchors]
      .sort((a, b) => getPageOrderFromUrl(a) - getPageOrderFromUrl(b))
      .slice(0, Math.max(1, maxPages))
  );
}

function extractPostsFromVwText(html, pageNumber = 1) {
  const prepared = (html ?? "")
    .toString()
    .replace(/<blockquote\b[\s\S]*?<\/blockquote>/gi, " ")
    .replace(/<div\b[^>]*class=(?:"|')[^"']*signature[^"']*(?:"|')[\s\S]*?<\/div>/gi, " ");

  const lines = htmlToText(prepared)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const posts = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    const text = current.lines
      .filter(line => !/^(Nahoru|Citovat|Odpovědět|Odpovedet|Verze pro tisk|\* \* \*)$/i.test(line))
      .filter(line => !/^(Příspěvky|Prispevky|Registrován|Registrovan|Bydliště|Bydliste|Pohlaví|Pohlavi|Věk|Vek|Práce|Prace|Auto|Motor):/i.test(line))
      .join("\n")
      .trim();
    if (text.length >= 10) {
      posts.push({ author: current.author, when: current.when, postId: current.postId, pageNumber, text });
    }
    current = null;
  };

  for (const line of lines) {
    const header = line.match(/^P(?:ř|r)[ií]sp[eě]vek od\s+(.+?)\s+»\s+(.+)$/i);
    if (header) {
      flush();
      current = { author: header[1].trim(), when: header[2].trim(), postId: "", lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }

  flush();
  return posts;
}

async function fetchVwThreadAsText({ url, pages = 999, cookie = "", forumTitle = "", subforumName = "", subforumTitle = "" }) {
  const firstHtml = await fetchUrl(url, cookie);
  const title = extractTitleFromHtml(firstHtml);
  const pageUrls = discoverVwTopicPageUrls(firstHtml, url, pages);
  const posts = [];

  for (let i = 0; i < pageUrls.length; i++) {
    const pageUrl = pageUrls[i];
    const html = i === 0 ? firstHtml : await fetchUrl(pageUrl, cookie);
    posts.push(...extractPostsFromVwText(html, i + 1));
  }

  if (posts.length === 0) {
    return { text: htmlToText(firstHtml), title, totalPages: pageUrls.length };
  }

  return {
    text: buildThreadText({ url, title, posts, forumTitle, subforumName, subforumTitle }),
    title,
    totalPages: pageUrls.length,
  };
}

async function discoverVwModelForums({ rootUrl, cookie = "", sleepMs = 0 }) {
  const rootHtml = await fetchUrl(rootUrl, cookie);
  const candidates = extractVwModelForumsFromRoot(rootHtml, rootUrl);
  const models = [];

  logProgress(`Model discovery start: ${rootUrl} (${candidates.length} candidate forum(s))`);
  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index];
    try {
      logProgress(`Model candidate ${index + 1}/${candidates.length}: ${candidate.label || candidate.url}`);
      const firstHtml = await fetchUrl(candidate.url, cookie);
      const title = extractTitleFromHtml(firstHtml);
      const yearRange = parseForumYearRange(htmlToText(firstHtml));
      if (!shouldKeepVwModelForum({ title, url: candidate.url, yearRange })) continue;
      models.push({ url: candidate.url, title, yearRange, firstHtml });
    } catch {
      // ignore non-model candidates
    }
    if (sleepMs > 0) await sleep(sleepMs);
  }

  logProgress(`Model discovery done: kept ${models.length} model forum(s)`);
  return uniqByKey(models, model => model.url);
}

async function discoverThreadsFromVwModelForum({ forumUrl, firstHtml = "", indexPages = 25, cookie = "", sleepMs = 0 }) {
  const forumHtml = firstHtml || await fetchUrl(forumUrl, cookie);
  const modelForumTitle = extractTitleFromHtml(forumHtml);
  const relevantSections = extractVwRelevantSections(forumHtml, forumUrl);
  const listings = [{ url: canonicalVwListingUrl(forumUrl), name: modelForumTitle || "Root topics", kind: "root" }, ...relevantSections];
  const threads = [];

  for (const listing of listings) {
    logProgress(`Listing start: ${modelForumTitle} -> ${listing.name} (${listing.kind})`);
    const listingFirstHtml = listing.url === canonicalVwListingUrl(forumUrl) ? forumHtml : await fetchUrl(listing.url, cookie);
    const listingTitle = extractTitleFromHtml(listingFirstHtml) || listing.name;
    const pageUrls = discoverVwListingPageUrls(listingFirstHtml, listing.url, indexPages);
    logProgress(`Listing scan: ${listing.url} (${pageUrls.length} page(s) max)`);

    for (let pageIndex = 0; pageIndex < pageUrls.length; pageIndex++) {
      const pageUrl = pageUrls[pageIndex];
      logProgress(`Listing page ${pageIndex + 1}/${pageUrls.length}: ${pageUrl}`);
      const html = pageIndex === 0 ? listingFirstHtml : await fetchUrl(pageUrl, cookie);
      const topics = extractVwTopicEntriesFromForumPage(html, listing.url, { kind: listing.kind }).map(topic => ({
        ...topic,
        parentForumTitle: modelForumTitle,
        subforumName: listing.kind === "root" ? "" : listing.name,
        subforumTitle: listing.kind === "root" ? "" : listingTitle,
        subforumUrl: listing.kind === "root" ? "" : listing.url,
      }));
      threads.push(...topics);
      if (sleepMs > 0) await sleep(sleepMs);
    }
  }

  return { parentForumTitle: modelForumTitle, threads: uniqByKey(threads, thread => thread.url) };
}

async function deepseekChatJson({ apiKey, model, messages, maxTokens = 1400 }) {
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
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
  return (data?.choices?.[0]?.message?.content ?? "").toString();
}

async function processThreadFactory({ args, apiKey, outReady, discardedPath }) {
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
    const normalizedThreadTitle = threadTitle
      || (typeof threadTextRaw === "object" ? threadTextRaw?.title ?? "" : "")
      || ((rawThreadText.match(/^TITLE:\s*(.+)$/m) ?? [])[1] ?? "");

    const text = args.maxChars && rawThreadText.length > args.maxChars
      ? `${rawThreadText.slice(0, args.maxChars)}\n\n[TRUNCATED]`
      : rawThreadText;

    const sourceUrl = threadUrl || args.sourceUrl;
    const postMetaByNumber = parsePostMetaFromThreadText(rawThreadText);
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
      "- Forum context (model forum title / child section title) may contain the vehicle model or generation. You may use that context, but only when explicit.",
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
      await logDiscard("classifier", classifier.reason || "Thread did not pass strict seed gate.", { classifier });
      return { ready: 0, discarded: 1 };
    }

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
      "- Use forum context if it explicitly identifies the Volkswagen model or generation.",
      "- If any required field is ambiguous for one case, omit that case but continue extracting other clear cases.",
      "- If there are no clear cases, return [].",
      "- Translate symptoms, description, and resolution to English.",
      "- If mileage is explicitly mentioned, extract it as an integer number of kilometers (e.g., 185000).",
      "- Normalize OBD codes to uppercase format like P0401. If none are present, use [].",
      "",
      "Output schema:",
      '[{"case_author":"","fault_post_numbers":[],"resolution_post_numbers":[],"brand_raw":"Volkswagen","model_raw":"","engine_raw":"","engine_code_raw":"","mileage":null,"symptoms":[],"obd_codes":[],"description":"","resolution":"","closed_at":""}]',
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
      await logDiscard("extractor", "Extractor did not return any clear case.", { classifier });
      return { ready: 0, discarded: 1 };
    }

    let readyCount = 0;
    let discardedCount = 0;

    for (const item of extracted) {
      const authorValidation = validateExtractedCaseAuthor(item, postMetaByNumber);
      if (!authorValidation.ok) {
        await logDiscard("record", authorValidation.reason || "Author validation failed.", {
          classifier,
          extracted_raw: item ?? null,
        });
        discardedCount++;
        continue;
      }

      const normalizedItem = { ...(item ?? {}), case_author: authorValidation.caseAuthor ?? (item?.case_author ?? "") };

      const vehicle_brand = "Volkswagen";
      const vehicle_model = resolveVwVehicleModel({
        modelRaw: normalizedItem?.model_raw ?? "",
        threadTitle: normalizedThreadTitle,
        subforumTitle,
        parentForumTitle,
      }) ?? null;
      const engine_power = vehicle_model
        ? pickEnginePower(
            VOLKSWAGEN_ENTRY,
            vehicle_model,
            [
              normalizedItem?.engine_raw ?? "",
              normalizedThreadTitle,
              subforumName,
              subforumTitle,
            ].filter(Boolean).join(" | ")
          )
        : null;

      const canonical = { vehicle_brand, vehicle_model, engine_power };
      const local_id = computeLocalId({ forum: args.forum, sourceUrl, item: normalizedItem, canonical });

      let description = (normalizedItem?.description ?? "").toString();
      const engineCodeRaw = (normalizedItem?.engine_code_raw ?? "").toString().trim();
      if (engineCodeRaw && !normalizeText(description).includes(normalizeText(engineCodeRaw))) {
        description = description.trim()
          ? `${description.trim()} Engine code: ${engineCodeRaw}.`
          : `Engine code: ${engineCodeRaw}.`;
      }

      const record = {
        local_id,
        user_id: args.userId,
        thread_url: sourceUrl || null,
        vehicle_brand,
        vehicle_model,
        mileage: typeof normalizedItem?.mileage === "number" ? Math.trunc(normalizedItem.mileage) : null,
        engine_power,
        symptoms: canonicalizeSymptoms(normalizedItem?.symptoms),
        obd_codes: ensureArrayOfStrings(normalizedItem?.obd_codes).map(code => code.toUpperCase()),
        description,
        resolution: (normalizedItem?.resolution ?? "").toString(),
        closed_at: toIsoOrNow(normalizedItem?.closed_at),
      };

      if (!isReadyRecord(record, classifier)) {
        await logDiscard("record", "Extracted case failed strict READY validation.", {
          classifier,
          candidate: record,
          extracted_raw: normalizedItem ?? null,
        });
        discardedCount++;
        continue;
      }

      await writeJsonFileUnique(outReady, record.local_id, record);
      readyCount++;
    }

    return { ready: readyCount, discarded: discardedCount };
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!Array.isArray(args.inputs) || args.inputs.length === 0 || !args.outDir) usage(1);
  if (!args.cookie) args.cookie = process.env.FORUM_COOKIE ?? "";

  const outReady = path.join(args.outDir, "ready");
  const discardedPath = path.join(args.outDir, "discarded.jsonl");
  await fs.mkdir(outReady, { recursive: true });

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

  const processOneThread = await processThreadFactory({ args, apiKey, outReady, discardedPath });
  let totalReady = 0;
  let totalDiscarded = 0;
  let totalProcessedThreads = 0;

  for (let inputIndex = 0; inputIndex < args.inputs.length; inputIndex++) {
    const input = args.inputs[inputIndex];
    logProgress(`Input ${inputIndex + 1}/${args.inputs.length} start: ${input}`);

    if (isVwTopicUrl(input)) {
      const raw = await fetchVwThreadAsText({ url: input, pages: args.pages, cookie: args.cookie });
      const res = await processOneThread({ threadUrl: input, threadTextRaw: raw });
      totalReady += res.ready;
      totalDiscarded += res.discarded;
      totalProcessedThreads++;
      continue;
    }

    const inputStem = makeInputStem(input);
    const discoveredPath = path.join(args.outDir, `discovered_threads_${inputStem}.jsonl`);
    const donePath = path.join(args.outDir, `done_threads_${inputStem}.txt`);
    const errPath = path.join(args.outDir, `errors_${inputStem}.txt`);

    let doneSet = new Set();
    try {
      const doneText = await fs.readFile(donePath, "utf8");
      doneSet = new Set(doneText.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
    } catch {}

    let modelForums = [];
    if (canonicalVwListingUrl(input) === canonicalVwListingUrl(DEFAULT_ROOT_URL)) {
      modelForums = await discoverVwModelForums({ rootUrl: input, cookie: args.cookie, sleepMs: args.sleepMs });
    } else {
      const firstHtml = await fetchUrl(input, args.cookie);
      modelForums = [{
        url: canonicalVwListingUrl(input),
        title: extractTitleFromHtml(firstHtml),
        yearRange: parseForumYearRange(htmlToText(firstHtml)),
        firstHtml,
      }];
    }

    const allThreads = [];
    for (let modelIndex = 0; modelIndex < modelForums.length; modelIndex++) {
      const modelForum = modelForums[modelIndex];
      logProgress(`Model ${modelIndex + 1}/${modelForums.length}: ${modelForum.title || modelForum.url}`);
      try {
        const discovered = await discoverThreadsFromVwModelForum({
          forumUrl: modelForum.url,
          firstHtml: modelForum.firstHtml,
          indexPages: args.indexPages,
          cookie: args.cookie,
          sleepMs: args.sleepMs,
        });
        allThreads.push(...discovered.threads);
      } catch (error) {
        await fs.appendFile(errPath, `[${new Date().toISOString()}] ${modelForum.url}\n${error?.stack || String(error)}\n\n`, "utf8");
      }
    }

    const threads = [...new Map(allThreads.map(thread => [thread.url, thread])).values()];
    await fs.writeFile(
      discoveredPath,
      threads.map(thread => JSON.stringify(thread)).join("\n") + (threads.length ? "\n" : ""),
      "utf8"
    );

    logProgress(`Input ${inputIndex + 1}/${args.inputs.length} discovered ${threads.length} thread(s): ${input}`);
    const toProcess = threads.filter(thread => !doneSet.has(thread.url)).slice(0, args.maxThreads);
    logProgress(`Input ${inputIndex + 1}/${args.inputs.length} processing ${toProcess.length} new thread(s): ${input}`);

    for (let threadIndex = 0; threadIndex < toProcess.length; threadIndex++) {
      const thread = toProcess[threadIndex];
      try {
        logProgress(`Thread ${threadIndex + 1}/${toProcess.length}: ${thread.title || thread.url}`);
        const raw = await fetchVwThreadAsText({
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
        totalDiscarded += res.discarded;
        totalProcessedThreads++;
        await fs.appendFile(donePath, `${thread.url}\n`, "utf8");
      } catch (error) {
        await fs.appendFile(errPath, `[${new Date().toISOString()}] ${thread.url}\n${error?.stack || String(error)}\n\n`, "utf8");
      }
      if (args.sleepMs > 0) await sleep(args.sleepMs);
    }
  }

  console.log(`Processed ${totalProcessedThreads} thread(s). Wrote ${totalReady} ready record(s) and discarded ${totalDiscarded} item(s) into: ${args.outDir}`);
}

const entryArg = process.argv[1];
const isDirectRun = entryArg
  ? import.meta.url === pathToFileURL(path.resolve(entryArg)).href
  : false;

if (isDirectRun) {
  main().catch(error => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}

export {
  classifyVwSection,
  extractPostsFromVwText,
  extractVwModelForumsFromRoot,
  extractVwRelevantSections,
  extractVwTopicEntriesFromForumPage,
  looksLikeUsefulVwTopicTitle,
  parseForumYearRange,
  resolveVwVehicleModel,
  shouldKeepVwModelForum,
};
