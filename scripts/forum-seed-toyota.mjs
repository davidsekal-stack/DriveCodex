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
  htmlToText,
  isClassifierApproved,
  isReviewWorthClassifier,
  isReadyRecord,
  extractedCaseUsesUnresolvedResolutionPost,
  normalizeEvidencePosts,
  normalizeText,
  parsePostMetaFromThreadText,
  parsePostTextByNumber,
  pickEnginePower,
  pickModelLabel,
  safeParseJsonArray,
  safeParseJsonObject,
  selectCatalogForMarket,
  toIsoOrNow,
  validateExtractedCaseAuthor,
  writeJsonFileUnique,
} from "./forum-seed.mjs";

const DEFAULT_ROOT_URLS = [
  "https://www.toyota-club.eu/forum",
  "https://en.toyota-club.eu/forum",
];
const DEFAULT_FORUM = "toyota_club_eu";
const DEFAULT_USER_ID = "ai_importer";
const DEFAULT_MODEL = "deepseek-chat";

const TOPIC_BLACKLIST = [
  /\bmanuals?\b/i,
  /\bmanu[aá]ly?\b/i,
  /\bn[aá]vod\b/i,
  /\bhow\s+to\b/i,
  /\bguide\b/i,
  /\bguides\b/i,
  /\btuning\b/i,
  /\badvert\b/i,
  /\binzerce\b/i,
  /\bclub\b/i,
  /\bjokes?\b/i,
  /\bwebsite\b/i,
  /\bimprovement\b/i,
  /\bcrash\s+test\b/i,
  /\bphoto\b/i,
  /\bfotk/i,
  /\bgaler/i,
  /\bshop\b/i,
];

const TOPIC_SIGNAL_PATTERNS = [
  /\b[pbcu]\d{4}\b/i,
  /\b(nejde|nestart|zhas(i|í|n)|skub|cuk|klep|hluk|hu[cč]i|p[ií]sk|nouz|probl[eé]m|z[aá]vada|chyba|kontrolka|olej|tlak|netop[ií]|sahara|ventil[aá]tor|spojka|brzd|airbag|abs|esp|emise|dpf|egr|turbo|[uú]nik|cidlo|čidlo|senzor|elektrika|kabel[aá][žz]|vstrik|vstřik|převodovka|prevodovka|servo|altern[aá]tor|baterie|klima|vibrac|kou[rř]|smrd[ií])\b/i,
  /\b(problem|fault|issue|error|warning|leak|noise|knock|rattle|whine|squeak|vibration|misfire|jerk|judder|limp|overheat|overheating|won['’]t start|doesn['’]t start|stall|stalls|smoke|smell|oil|coolant|brake|airbag|abs|esp|dpf|egr|turbo|sensor|injector|battery|alternator|gearbox|transmission|clutch|steering|ac|climate)\b/i,
  /\b\d\.\d\b.*\b(vvt-i|d-4d|hybrid|awd|turbo|boxer)\b/i,
  /\b\d{2,3}\s*kw\b/i,
];

const MODEL_ALIAS_BY_LABEL = new Map([
  ["Aygo I (2006–2014)", ["Aygo"]],
  ["Aygo II (2014–2022)", ["Aygo"]],
  ["Aygo X (2022–dosud)", ["Aygo"]],
  ["Yaris II (2006–2011)", ["Yaris"]],
  ["Yaris III (2011–2020)", ["Yaris"]],
  ["Yaris IV (2020–dosud)", ["Yaris"]],
  ["Yaris Cross (2021–dosud)", ["Yaris Cross"]],
  ["Corolla E150 (2006–2013)", ["Corolla", "Corolla E15"]],
  ["Corolla E210 (2019–dosud)", ["Corolla"]],
  ["Corolla Cross (2022–dosud)", ["Corolla Cross"]],
  ["Auris I (2006–2012)", ["Auris"]],
  ["Auris II (2012–2018)", ["Auris"]],
  ["Avensis T25 (2003–2009)", ["Avensis T25", "Avensis II"]],
  ["Avensis T27 (2009–2018)", ["Avensis T27", "Avensis III", "Avensis 3"]],
  ["Camry XV70 (2019–dosud)", ["Camry"]],
  ["Prius II (2004–2009)", ["Prius II"]],
  ["Prius III (2009–2016)", ["Prius"]],
  ["Prius IV (2016–2022)", ["Prius"]],
  ["Prius V (2023–dosud)", ["Prius"]],
  ["C-HR I (2016–2023)", ["C-HR", "CHR", "C HR"]],
  ["C-HR II (2023–dosud)", ["C-HR", "CHR", "C HR"]],
  ["RAV4 II (2000–2006)", ["RAV4 II", "Rav 4 II"]],
  ["RAV4 III (2006–2012)", ["RAV4", "Rav 4"]],
  ["RAV4 IV (2013–2018)", ["RAV4", "Rav 4"]],
  ["RAV4 V (2019–dosud)", ["RAV4", "Rav 4"]],
  ["Land Cruiser 150 (2009–dosud)", ["Land Cruiser"]],
  ["Land Cruiser 300 (2021–dosud)", ["Land Cruiser"]],
  ["Hilux VIII (2015–dosud)", ["Hilux"]],
  ["Highlander / Kluger IV (2020–dosud)", ["Highlander", "Kluger", "Highlander / Kluger"]],
  ["4Runner (2009–dosud)", ["4Runner", "4 Runner"]],
  ["Tacoma (2016–dosud)", ["Tacoma"]],
  ["Proace II (2016–dosud)", ["Proace"]],
  ["Proace City (2019–dosud)", ["Proace City"]],
  ["GT86 (2012–2021)", ["GT86", "GT 86"]],
  ["GR86 (2022–dosud)", ["GR86", "GR 86"]],
  ["Supra GR (2019–dosud)", ["Supra", "GR Supra"]],
  ["bZ4X (2022–dosud)", ["bZ4X", "BZ4X", "bZ 4X"]],
  ["Corolla Verso / Verso II (2004–2009)", ["Corolla Verso", "Verso II", "Verso 2"]],
  ["Verso (2009–2018)", ["Verso", "Verso R20", "Toyota Verso"]],
]);

const { catalog: EU_CATALOG } = selectCatalogForMarket("eu");
const TOYOTA_ENTRY = EU_CATALOG.find(entry => normalizeText(entry.brand) === "toyota");

if (!TOYOTA_ENTRY) {
  throw new Error("Toyota brand entry was not found in web/src/constants/catalog.js");
}

function usage(exitCode = 1) {
  const msg = `
Usage:
  node scripts/forum-seed-toyota.mjs <out_dir> [options]
  node scripts/forum-seed-toyota.mjs <https://www.toyota-club.eu/forum> <out_dir> [options]
  node scripts/forum-seed-toyota.mjs <https://en.toyota-club.eu/forum-category/auris-14> <out_dir> [options]
  node scripts/forum-seed-toyota.mjs <https://www.toyota-club.eu/forum-tema/...> <out_dir> [options]

Options:
  --keep-review   Store borderline but promising cases into to_review/
`.trim();
  console.log(msg);
  process.exit(exitCode);
}

function computeToyotaReviewId({ forum, sourceUrl, threadTitle, stage }) {
  const input = JSON.stringify({
    forum: forum ?? "",
    source_url: sourceUrl ?? "",
    thread_title: threadTitle ?? "",
    stage: stage ?? "",
  });
  const hash = crypto.createHash("sha256").update(input, "utf8").digest("hex").slice(0, 16);
  return `review_${hash}`;
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
    keepReview: false,
    dry: false,
  };

  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === "--help" || value === "-h") usage(0);
    if (value === "--dry") { args.dry = true; continue; }
    if (value === "--keep-review") { args.keepReview = true; continue; }
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
    if (value.startsWith("--")) usage(1);
    positional.push(value);
  }

  if (positional.length === 1) {
    args.inputs = [...DEFAULT_ROOT_URLS];
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
    "User-Agent": "Mozilla/5.0 (compatible; GearBrainToyotaSeed/1.0; +https://example.invalid)",
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

function escapeRegExp(value) {
  return (value ?? "").toString().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeToyotaForumMatchText(value) {
  let text = (value ?? "").toString();
  const replacements = [
    [/\brav[\s-]?4\b/gi, "RAV4"],
    [/\bc[\s-]?hr\b/gi, "C-HR"],
    [/\bgt[\s-]?86\b/gi, "GT86"],
    [/\bgr[\s-]?86\b/gi, "GR86"],
    [/\b4[\s-]?runner\b/gi, "4Runner"],
    [/\bbz[\s-]?4x\b/gi, "bZ4X"],
    [/\blandcruiser\b/gi, "Land Cruiser"],
    [/\bverso\s+ii\b/gi, "Corolla Verso"],
    [/\bverso\s+2\b/gi, "Corolla Verso"],
    [/\bverso\s+r20\b/gi, "Verso"],
  ];
  for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);
  return text;
}

function parseToyotaLabelYearRange(label) {
  const match = (label ?? "").toString().match(/\((\d{4})[–-](\d{4}|dosud)\)/i);
  if (!match) return null;
  const start = Number(match[1]);
  const end = /^dosud$/i.test(match[2]) ? new Date().getFullYear() : Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start, end };
}

function extractExplicitYears(text) {
  return [...new Set(
    ((text ?? "").toString().match(/\b(19|20)\d{2}\b/g) ?? [])
      .map(Number)
      .filter(year => Number.isFinite(year) && year >= 1990 && year <= new Date().getFullYear() + 1)
  )];
}

function bestToyotaModelMatch(rawText) {
  const models = (TOYOTA_ENTRY.models ?? []).filter(model => model?.label);
  return bestByScore(models, model => scoreModelLabel(model.label, normalizeToyotaForumMatchText(rawText)));
}

function getToyotaExplicitAliasLabels(rawText) {
  const normalized = normalizeToyotaForumMatchText(rawText);
  if (!normalized?.trim()) return [];

  const models = (TOYOTA_ENTRY.models ?? []).filter(model => model?.label);
  const matches = [];

  for (const model of models) {
    for (const alias of getModelAliasTexts(model.label).map(normalizeToyotaForumMatchText).filter(Boolean)) {
      const regex = new RegExp(`(^|\\b)${escapeRegExp(alias)}(\\b|$)`, "i");
      if (!regex.test(normalized)) continue;
      matches.push({
        label: model.label,
        alias,
        aliasTokens: alias.split(/\s+/).filter(Boolean).length,
        aliasLength: alias.length,
      });
    }
  }

  if (matches.length === 0) return [];

  matches.sort((a, b) => (
    b.aliasTokens - a.aliasTokens ||
    b.aliasLength - a.aliasLength ||
    a.label.localeCompare(b.label)
  ));

  const best = matches[0];
  const tied = matches.filter(match => match.aliasTokens === best.aliasTokens && match.aliasLength === best.aliasLength);
  return [...new Set(tied.map(match => match.label))];
}

function pickToyotaModelLabelByExplicitAlias(rawText) {
  const distinctLabels = getToyotaExplicitAliasLabels(rawText);
  if (distinctLabels.length !== 1) return null;
  return distinctLabels[0];
}

function pickToyotaModelLabel(rawText) {
  const normalized = normalizeToyotaForumMatchText(rawText);
  if (!normalized?.trim()) return null;

  const explicitAliasLabel = pickToyotaModelLabelByExplicitAlias(normalized);
  if (explicitAliasLabel) return explicitAliasLabel;

  const models = (TOYOTA_ENTRY.models ?? []).filter(model => model?.label);
  const best = bestByScore(models, model => scoreModelLabel(model.label, normalized));
  if (!best || best.score < 0.30) return null;

  const epsilon = 0.03;
  const near = models
    .map(model => ({ model, score: scoreModelLabel(model.label, normalized) }))
    .filter(item => Math.abs(item.score - best.score) <= epsilon)
    .sort((a, b) => b.score - a.score);
  if (near.length >= 2) return null;

  return best.it.label;
}

function resolveToyotaVehicleModel({ modelRaw = "", threadTitle = "", parentForumTitle = "" }) {
  const combined = normalizeToyotaForumMatchText([modelRaw, threadTitle, parentForumTitle].filter(Boolean).join(" | "));
  const explicitYears = extractExplicitYears(combined);
  const models = (TOYOTA_ENTRY.models ?? []).filter(model => model?.label);

  if (explicitYears.length > 0) {
    const yearCandidates = models.filter(model => {
      if (scoreModelLabel(model.label, combined) < 0.12) return false;
      const range = parseToyotaLabelYearRange(model.label);
      return range && explicitYears.some(year => year >= range.start && year <= range.end);
    });

    if (yearCandidates.length === 1) return yearCandidates[0].label;
    if (yearCandidates.length > 1) {
      const best = bestByScore(yearCandidates, model => scoreModelLabel(model.label, combined));
      if (best && best.score >= 0.12) return best.it.label;
    }
  }

  const disambiguatingContexts = [
    threadTitle,
    parentForumTitle,
    [threadTitle, parentForumTitle].filter(Boolean).join(" | "),
  ]
    .map(value => normalizeToyotaForumMatchText(value))
    .filter(Boolean);

  for (const context of disambiguatingContexts) {
    const label = pickToyotaModelLabelByExplicitAlias(context);
    if (label) return label;
  }

  if (getToyotaExplicitAliasLabels(modelRaw).length > 1) {
    return null;
  }

  const contexts = [
    modelRaw,
    threadTitle,
    parentForumTitle,
    [modelRaw, threadTitle].filter(Boolean).join(" | "),
    [modelRaw, parentForumTitle].filter(Boolean).join(" | "),
    [modelRaw, parentForumTitle, threadTitle].filter(Boolean).join(" | "),
  ]
    .map(value => normalizeToyotaForumMatchText(value))
    .filter(Boolean);

  for (const context of contexts) {
    const label = pickToyotaModelLabel(context) ?? pickModelLabel(TOYOTA_ENTRY, context);
    if (label) return label;
  }

  return null;
}

function parseToyotaForumYearRange(text) {
  const head = (text ?? "").toString().slice(0, 2000);
  const match = head.match(/\b(19|20)\d{2}\s+-\s+(\d{2,4}|dosud|soucasnost|současnost|20\.\.|present|current)\b/i);
  if (!match) return null;
  const start = Number(match[0].slice(0, 4));
  const endToken = (match[2] ?? "").toString().trim().toLowerCase();
  let end = start;
  if (/^(dosud|soucasnost|současnost|20\.\.|present|current)$/.test(endToken)) {
    end = new Date().getFullYear();
  } else if (/^\d{2}$/.test(endToken)) {
    end = Math.floor(start / 100) * 100 + Number(endToken);
  } else if (/^\d{4}$/.test(endToken)) {
    end = Number(endToken);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (end < start) return null;
  return { start, end, text: `${start}-${endToken}` };
}

function shouldKeepToyotaModelForum({ title, url, yearRange }) {
  let slug = "";
  try {
    slug = decodeURIComponent(new URL(url).pathname)
      .replace(/^\/forum-(category|kategorie)\//i, "")
      .replace(/-\d+\/?$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
  } catch {}
  const best = bestToyotaModelMatch([title, slug, yearRange?.text ?? ""].join(" | "));
  if (!best || best.score < 0.2) return false;
  if (yearRange && yearRange.end <= 2006) return false;
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

function isToyotaCategoryUrl(url) {
  try {
    return /^\/forum-(category|kategorie)\/[^/?#]+-\d+\/?$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function isToyotaTopicUrl(url) {
  try {
    return /^\/forum-(topic|tema)\/[^/?#]+-\d+\/?$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function canonicalToyotaListingUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = parsed.pathname.replace(/\/+$/g, "");
    return parsed.toString();
  } catch {
    return url;
  }
}

function canonicalToyotaTopicUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = parsed.pathname.replace(/\/+$/g, "");
    return parsed.toString();
  } catch {
    return url;
  }
}

function getToyotaTopicIdFromUrl(url) {
  try {
    return new URL(url).pathname.match(/-(\d+)\/?$/)?.[1] ?? "";
  } catch {
    return "";
  }
}

function getToyotaPageOrderFromUrl(url) {
  try {
    const parsed = new URL(url);
    const page = parsed.searchParams.get("page");
    if (page) return Number(page) || 1;
    const start = parsed.searchParams.get("start");
    if (start) return Number(start) || 1;
    const str = parsed.searchParams.get("str");
    if (str) return Number(str) || 1;
    const offset = parsed.searchParams.get("offset");
    if (offset) return Number(offset) || 1;
    return 1;
  } catch {
    return 1;
  }
}

function extractToyotaModelForumsFromRoot(rootHtml, rootUrl) {
  return uniqByKey(
    extractAllAnchors(rootHtml, rootUrl)
      .filter(anchor => safeHostnameFromUrl(anchor.url) === safeHostnameFromUrl(rootUrl))
      .filter(anchor => isToyotaCategoryUrl(anchor.url))
      .filter(anchor => anchor.text && anchor.text.length >= 2)
      .filter(anchor => {
        const best = bestToyotaModelMatch(anchor.text);
        return !!best && best.score >= 0.28;
      }),
    anchor => canonicalToyotaListingUrl(anchor.url)
  ).map(anchor => ({
    url: canonicalToyotaListingUrl(anchor.url),
    label: anchor.text,
  }));
}

function looksLikeProblemTopicTitle(title) {
  return TOPIC_SIGNAL_PATTERNS.some(pattern => pattern.test(title));
}

function looksLikeUsefulToyotaTopicTitle(title) {
  const raw = (title ?? "").toString().trim();
  if (!raw || raw.length < 4) return false;
  if (TOPIC_BLACKLIST.some(pattern => pattern.test(raw))) return false;
  return looksLikeProblemTopicTitle(raw);
}

function extractToyotaTopicEntriesFromForumPage(html, listingUrl) {
  const host = safeHostnameFromUrl(listingUrl);
  return uniqByKey(
    extractAllAnchors(html, listingUrl)
      .filter(anchor => safeHostnameFromUrl(anchor.url) === host)
      .filter(anchor => isToyotaTopicUrl(anchor.url))
      .filter(anchor => looksLikeUsefulToyotaTopicTitle(anchor.text))
      .map(anchor => ({
        url: canonicalToyotaTopicUrl(anchor.url),
        title: anchor.text.replace(/\s+/g, " ").trim(),
      })),
    topic => topic.url
  );
}

function discoverToyotaListingPageUrls(firstHtml, baseUrl, maxPages) {
  const canonicalBase = canonicalToyotaListingUrl(baseUrl);
  const anchors = extractAllAnchors(firstHtml, baseUrl)
    .map(anchor => anchor.url)
    .filter(url => canonicalToyotaListingUrl(url) === canonicalBase);
  return uniqPreserveOrder(
    [canonicalBase, ...anchors]
      .sort((a, b) => getToyotaPageOrderFromUrl(a) - getToyotaPageOrderFromUrl(b))
      .slice(0, Math.max(1, maxPages))
  );
}

function discoverToyotaTopicPageUrls(firstHtml, topicUrl, maxPages) {
  const topicId = getToyotaTopicIdFromUrl(topicUrl);
  const canonicalBase = canonicalToyotaTopicUrl(topicUrl);
  const anchors = extractAllAnchors(firstHtml, topicUrl)
    .map(anchor => anchor.url)
    .filter(url => getToyotaTopicIdFromUrl(url) === topicId);
  return uniqPreserveOrder(
    [canonicalBase, ...anchors]
      .sort((a, b) => getToyotaPageOrderFromUrl(a) - getToyotaPageOrderFromUrl(b))
      .slice(0, Math.max(1, maxPages))
  );
}

function isToyotaTimestamp(line) {
  return /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test((line ?? "").toString().trim());
}

function normalizeToyotaAuthor(line) {
  return (line ?? "")
    .toString()
    .replace(/\bImage\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isToyotaNoiseLine(line) {
  const text = normalizeText(line);
  if (!text) return true;
  return /^(reply|odpovedet|odpovědět|forum|fórum|manuals|manualy|manuály|advert|inzerce|model|new topic|nove tema|nové téma|on-line|online)$/i.test(text);
}

function sanitizeToyotaPostText(lines) {
  const out = [];
  for (const line of lines) {
    const trimmed = (line ?? "").toString().trim();
    if (!trimmed) continue;
    if (/^(Reply|Odpovědět|New topic|Nov[eé]\s+t[eé]ma|On-Line:?)$/i.test(trimmed)) break;
    if (/(Did my advice help you|Get VIP membership|Pomohla Ti m[aá] rada|Z[ií]skej VIP [čc]lenstv[ií]|owner_register|manuals\?ddlb_model|manualy\?ddlb_model)/i.test(trimmed)) continue;
    if (/^(Image|iframe)$/i.test(trimmed)) continue;
    out.push(trimmed);
  }
  return out.join("\n").trim();
}

function extractPostsFromToyotaText(html, pageNumber = 1) {
  const prepared = (html ?? "")
    .toString()
    .replace(/<blockquote\b[\s\S]*?<\/blockquote>/gi, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ");

  const lines = htmlToText(prepared)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const posts = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isToyotaTimestamp(lines[i])) continue;
    const when = lines[i];

    let author = "";
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
      if (isToyotaNoiseLine(lines[j])) continue;
      author = normalizeToyotaAuthor(lines[j]);
      if (author) break;
    }
    if (!author) continue;

    const body = [];
    let k = i + 1;
    for (; k < lines.length; k++) {
      if (isToyotaTimestamp(lines[k])) break;
      body.push(lines[k]);
    }

    const text = sanitizeToyotaPostText(body);
    if (text.length >= 10) {
      posts.push({ author, when, postId: "", pageNumber, text });
    }

    i = k - 1;
  }

  return posts;
}

async function fetchToyotaThreadAsText({ url, pages = 999, cookie = "", forumTitle = "" }) {
  const firstHtml = await fetchUrl(url, cookie);
  const title = extractTitleFromHtml(firstHtml);
  const pageUrls = discoverToyotaTopicPageUrls(firstHtml, url, pages);
  const posts = [];

  for (let i = 0; i < pageUrls.length; i++) {
    const pageUrl = pageUrls[i];
    const html = i === 0 ? firstHtml : await fetchUrl(pageUrl, cookie);
    posts.push(...extractPostsFromToyotaText(html, i + 1));
  }

  if (posts.length === 0) {
    return { text: htmlToText(firstHtml), title, totalPages: pageUrls.length };
  }

  return {
    text: buildThreadText({ url, title, posts, forumTitle, subforumName: "", subforumTitle: "" }),
    title,
    totalPages: pageUrls.length,
  };
}

async function discoverToyotaModelForums({ rootUrl, cookie = "", sleepMs = 0 }) {
  const rootHtml = await fetchUrl(rootUrl, cookie);
  const candidates = extractToyotaModelForumsFromRoot(rootHtml, rootUrl);
  const models = [];

  logProgress(`Model discovery start: ${rootUrl} (${candidates.length} candidate forum(s))`);
  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index];
    try {
      logProgress(`Model candidate ${index + 1}/${candidates.length}: ${candidate.label || candidate.url}`);
      const firstHtml = await fetchUrl(candidate.url, cookie);
      const title = extractTitleFromHtml(firstHtml);
      const yearRange = parseToyotaForumYearRange(htmlToText(firstHtml));
      if (!shouldKeepToyotaModelForum({ title, url: candidate.url, yearRange })) continue;
      models.push({ url: candidate.url, title, yearRange, firstHtml });
    } catch {
      // ignore non-model candidates
    }
    if (sleepMs > 0) await sleep(sleepMs);
  }

  logProgress(`Model discovery done: kept ${models.length} model forum(s)`);
  return uniqByKey(models, model => model.url);
}

async function discoverThreadsFromToyotaModelForum({ forumUrl, firstHtml = "", indexPages = 25, cookie = "", sleepMs = 0 }) {
  const forumHtml = firstHtml || await fetchUrl(forumUrl, cookie);
  const modelForumTitle = extractTitleFromHtml(forumHtml);
  const pageUrls = discoverToyotaListingPageUrls(forumHtml, forumUrl, indexPages);
  const threads = [];

  logProgress(`Listing start: ${modelForumTitle || forumUrl}`);
  for (let pageIndex = 0; pageIndex < pageUrls.length; pageIndex++) {
    const pageUrl = pageUrls[pageIndex];
    logProgress(`Listing page ${pageIndex + 1}/${pageUrls.length}: ${pageUrl}`);
    const html = pageIndex === 0 ? forumHtml : await fetchUrl(pageUrl, cookie);
    const topics = extractToyotaTopicEntriesFromForumPage(html, forumUrl).map(topic => ({
      ...topic,
      parentForumTitle: modelForumTitle,
      subforumName: "",
      subforumTitle: modelForumTitle,
      subforumUrl: forumUrl,
    }));
    threads.push(...topics);
    if (sleepMs > 0) await sleep(sleepMs);
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

async function processThreadFactory({ args, apiKey, outReady, outReview, discardedPath }) {
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

      const reviewId = computeToyotaReviewId({
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
      "- Forum context (model forum title) may contain the vehicle model or generation. You may use that context, but only when explicit.",
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
        return { ready: 0, review: kept ? 1 : 0, discarded: kept ? 0 : 1 };
      }
      await logDiscard("classifier", classifier.reason || "Thread did not pass strict seed gate.", { classifier });
      return { ready: 0, review: 0, discarded: 1 };
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
      "- Use forum context if it explicitly identifies the Toyota model or generation.",
      "- If any required field is ambiguous for one case, omit that case but continue extracting other clear cases.",
      "- If there are no clear cases, return [].",
      "- Translate symptoms, description, and resolution to English.",
      "- If mileage is explicitly mentioned, extract it as an integer number of kilometers (e.g., 185000).",
      "- Normalize OBD codes to uppercase format like P0401. If none are present, use [].",
      "",
      "Output schema:",
      '[{"case_author":"","fault_post_numbers":[],"resolution_post_numbers":[],"brand_raw":"Toyota","model_raw":"","engine_raw":"","engine_code_raw":"","mileage":null,"symptoms":[],"obd_codes":[],"description":"","resolution":"","closed_at":""}]',
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
      return { ready: 0, review: kept ? 1 : 0, discarded: kept ? 0 : 1 };
    }

    let readyCount = 0;
    let reviewCount = 0;
    let discardedCount = 0;

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
        const kept = await writeReview("record", "Resolution post still uses future/uncertain language in the source thread.", {
          classifier,
          extracted_raw: normalizedItem ?? null,
        });
        if (kept) reviewCount++;
        else discardedCount++;
        continue;
      }

      const vehicle_brand = "Toyota";
      const vehicle_model = resolveToyotaVehicleModel({
        modelRaw: normalizedItem?.model_raw ?? "",
        threadTitle: normalizedThreadTitle,
        parentForumTitle,
      }) ?? null;
      const engine_power = vehicle_model
        ? pickEnginePower(
            TOYOTA_ENTRY,
            vehicle_model,
            [
              normalizedItem?.engine_raw ?? "",
              normalizedThreadTitle,
              parentForumTitle,
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
        const kept = await writeReview("record", "Extracted case failed strict READY validation.", {
          classifier,
          candidate: record,
          extracted_raw: normalizedItem ?? null,
        });
        if (kept) reviewCount++;
        else discardedCount++;
        continue;
      }

      await writeJsonFileUnique(outReady, record.local_id, record);
      readyCount++;
    }

    return { ready: readyCount, review: reviewCount, discarded: discardedCount };
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!Array.isArray(args.inputs) || args.inputs.length === 0 || !args.outDir) usage(1);
  if (!args.cookie) args.cookie = process.env.FORUM_COOKIE ?? "";

  const outReady = path.join(args.outDir, "ready");
  const outReview = path.join(args.outDir, "to_review");
  const discardedPath = path.join(args.outDir, "discarded.jsonl");
  await fs.mkdir(outReady, { recursive: true });
  if (args.keepReview) {
    await fs.mkdir(outReview, { recursive: true });
  }

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

  const processOneThread = await processThreadFactory({ args, apiKey, outReady, outReview, discardedPath });
  let totalReady = 0;
  let totalReview = 0;
  let totalDiscarded = 0;
  let totalProcessedThreads = 0;

  for (let inputIndex = 0; inputIndex < args.inputs.length; inputIndex++) {
    const input = args.inputs[inputIndex];
    logProgress(`Input ${inputIndex + 1}/${args.inputs.length} start: ${input}`);

    if (isToyotaTopicUrl(input)) {
      const raw = await fetchToyotaThreadAsText({ url: input, pages: args.pages, cookie: args.cookie });
      const res = await processOneThread({ threadUrl: input, threadTextRaw: raw });
      totalReady += res.ready;
      totalReview += res.review;
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
    if (isToyotaCategoryUrl(input)) {
      const firstHtml = await fetchUrl(input, args.cookie);
      modelForums = [{ url: canonicalToyotaListingUrl(input), title: extractTitleFromHtml(firstHtml), firstHtml }];
    } else {
      modelForums = await discoverToyotaModelForums({ rootUrl: input, cookie: args.cookie, sleepMs: args.sleepMs });
    }

    const discoveredThreads = [];
    for (const modelForum of modelForums) {
      const { threads } = await discoverThreadsFromToyotaModelForum({
        forumUrl: modelForum.url,
        firstHtml: modelForum.firstHtml,
        indexPages: args.indexPages,
        cookie: args.cookie,
        sleepMs: args.sleepMs,
      });
      discoveredThreads.push(...threads);
    }

    const uniqueThreads = uniqByKey(discoveredThreads, thread => thread.url);
    for (const thread of uniqueThreads) {
      await appendJsonLine(discoveredPath, thread);
    }

    const toProcess = uniqueThreads
      .filter(thread => !doneSet.has(thread.url))
      .slice(0, args.maxThreads);

    logProgress(`Discovered ${uniqueThreads.length} unique thread(s), processing ${toProcess.length}.`);

    for (let threadIndex = 0; threadIndex < toProcess.length; threadIndex++) {
      const thread = toProcess[threadIndex];
      try {
        logProgress(`Thread ${threadIndex + 1}/${toProcess.length}: ${thread.title || thread.url}`);
        const raw = await fetchToyotaThreadAsText({
          url: thread.url,
          pages: args.pages,
          cookie: args.cookie,
          forumTitle: thread.parentForumTitle || "",
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
        await fs.appendFile(donePath, `${thread.url}\n`, "utf8");
      } catch (error) {
        await fs.appendFile(errPath, `[${new Date().toISOString()}] ${thread.url}\n${error?.stack || String(error)}\n\n`, "utf8");
      }
      if (args.sleepMs > 0) await sleep(args.sleepMs);
    }
  }

  if (args.keepReview) {
    console.log(`Processed ${totalProcessedThreads} thread(s). Wrote ${totalReady} ready record(s), ${totalReview} review item(s) and discarded ${totalDiscarded} item(s) into: ${args.outDir}`);
  } else {
    console.log(`Processed ${totalProcessedThreads} thread(s). Wrote ${totalReady} ready record(s) and discarded ${totalDiscarded} item(s) into: ${args.outDir}`);
  }
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
  extractPostsFromToyotaText,
  extractToyotaModelForumsFromRoot,
  extractToyotaTopicEntriesFromForumPage,
  looksLikeUsefulToyotaTopicTitle,
  parseArgs,
  parseToyotaForumYearRange,
  resolveToyotaVehicleModel,
  shouldKeepToyotaModelForum,
};
