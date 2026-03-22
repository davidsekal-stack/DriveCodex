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

const DEFAULT_INPUTS = [
  "https://www.fordclub.eu/forum-kategorie/transit-obecne-22",
  "https://www.fordclub.eu/forum-kategorie/technicky-koutek-6",
  "https://www.fordclub.eu/forum-kategorie/mondeo-mk-iv-45",
  "https://www.fordclub.eu/forum-kategorie/mondeo-mk-v-46",
  "https://www.fordclub.eu/forum-kategorie/transit-tourneo-courier-88",
  "https://www.fordclub.eu/forum-kategorie/transit-tourneo-custom-78",
  "https://www.fordclub.eu/forum-kategorie/transit-connect-64",
  "https://www.fordclub.eu/forum-kategorie/transit-vii-v347-v348-68",
  "https://www.fordclub.eu/forum-kategorie/transit-viii-69",
  "https://www.fordclub.eu/forum-kategorie/fiesta-vii-52",
  "https://www.fordclub.eu/forum-kategorie/ka-ii-63",
  "https://www.fordclub.eu/forum-kategorie/c-max-ii-c344-60",
  "https://www.fordclub.eu/forum-kategorie/galaxy-iii-59",
  "https://www.fordclub.eu/forum-kategorie/galaxy-iv-86",
  "https://www.fordclub.eu/forum-kategorie/ecosport-ii-bk-85",
  "https://www.fordclub.eu/forum-kategorie/kuga-28",
  "https://www.fordclub.eu/forum-kategorie/s-max-21",
  "https://www.fordclub.eu/forum-kategorie/tourneo-26",
];

const DEFAULT_FORUM = "fordclub_eu";
const DEFAULT_USER_ID = "ai_importer";
const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_MIN_POSTS = 2;

const TOPIC_BLACKLIST = [
  /\bmanuals?\b/i,
  /\bmanu[aá]ly?\b/i,
  /\bn[aá]vod\b/i,
  /\bhow\s+to\b/i,
  /\bguide\b/i,
  /\bguides\b/i,
  /\binzerce\b/i,
  /\badvert\b/i,
  /\bprodam\b/i,
  /\bprod[aá]m\b/i,
  /\bkoup[ií]m\b/i,
  /\bbuy(?:ing)?\b/i,
  /\bsell(?:ing)?\b/i,
  /\bsraz\b/i,
  /\bmeeting\b/i,
  /\bphoto\b/i,
  /\bfotk/i,
  /\bgaler/i,
  /\bclub\b/i,
  /\bjokes?\b/i,
  /\bpokec\b/i,
];

const TECHNICAL_CORNER_GENERIC_PATTERNS = [
  /\bprogramy?\s+a\s+manu[aá]ly?\b/i,
  /\bmanu[aá]l\b.*\bodkazy\b/i,
  /\baktualizace\s+navigac[ií]\b/i,
  /\bdenso-?mapy\b/i,
  /\bautor[aá]dio\b.*\bz[aá]m[eě]ny\b/i,
  /\bautor[aá]dio\+bluetooth\b/i,
  /\bmyt[ií],?\s*čištěn[ií]\b/i,
  /\bhistorie\s+auta\s+podle\s+vin\b/i,
  /\bjak[ýy]\s+motorov[ýy]\s+olej\b/i,
  /\bv[eě]čn[eé]\s+dotazy\s+jak[ýy]\s+olej\b/i,
  /\bnab[ií]jen[ií]\s+autobaterie\b/i,
  /\bkl[ií]če\s+s\s+imobiliz[eé]rem,?\s*kopie,?\s*k[oó]dov[aá]n[ií]\b/i,
  /\bztracen[eé]\s+kl[ií]če\b/i,
  /\bdiagnostika\b(?!.*\b(p\d{4}|u\d{4}|b\d{4}|c\d{4}|chyba|error|fault|z[aá]vada)\b)/i,
  /\b(?:stk|sme)\b/i,
  /\btažn[eé]\s+za[řr][ií]zen[ií]\b/i,
];

const TOPIC_SIGNAL_PATTERNS = [
  /\b[pbcu]\d{4}\b/i,
  /\b(nejde|nestart|zhas(i|í|n)|skub|cuk|klep|hluk|hu[cč]i|p[ií]sk|nouz|probl[eé]m|z[aá]vada|chyba|kontrolka|olej|tlak|netop[ií]|sahara|ventil[aá]tor|spojka|brzd|airbag|abs|esp|emise|dpf|egr|turbo|[uú]nik|cidlo|čidlo|senzor|elektrika|vstrik|vstřik|převodovka|prevodovka|servo|altern[aá]tor|baterie|klima|vibrac|kou[rř]|smrd[ií])\b/i,
  /\b(problem|fault|issue|error|warning|leak|noise|knock|rattle|whine|squeak|vibration|misfire|jerk|judder|limp|overheat|overheating|won['’]t start|doesn['’]t start|stall|stalls|smoke|smell|oil|coolant|brake|airbag|abs|esp|dpf|egr|turbo|sensor|injector|battery|alternator|gearbox|transmission|clutch|steering|ac|climate)\b/i,
  /\b(ecoboost|ecoblue|tdci|duratec|powershift|adblue)\b/i,
  /\b\d{2,3}\s*kw\b/i,
];

const MODEL_ALIAS_BY_LABEL = new Map([
  ["Fiesta MK6 (2006–2008)", ["Fiesta MK6", "Fiesta VI"]],
  ["Fiesta MK7 (2008–2017)", ["Fiesta MK7", "Fiesta VII"]],
  ["Fiesta MK8 (2017–2023)", ["Fiesta MK8", "Fiesta VIII"]],
  ["Mondeo MK4 (2007–2014)", ["Mondeo MK4", "Mondeo MK IV", "Mondeo IV"]],
  ["Mondeo MK5 (2014–2022)", ["Mondeo MK5", "Mondeo MK V", "Mondeo V"]],
  ["Kuga I (2008–2012)", ["Kuga I"]],
  ["Kuga II (2013–2019)", ["Kuga II"]],
  ["Kuga III (2020–dosud)", ["Kuga III"]],
  ["EcoSport (2014–2022)", ["EcoSport", "EcoSport II", "EcoSport II BK"]],
  ["Galaxy MK3 (2006–2015)", ["Galaxy MK3", "Galaxy III"]],
  ["Galaxy MK4 (2015–2023)", ["Galaxy MK4", "Galaxy IV"]],
  ["S-MAX I (2006–2015)", ["S-MAX I", "S MAX I"]],
  ["S-MAX II (2015–2023)", ["S-MAX II", "S MAX II"]],
  ["Ka II (2008–2016)", ["Ka II", "KA II"]],
  ["Ka+ (2016–2021)", ["Ka+", "KA+"]],
  ["C-MAX II (2010–2019)", ["C-MAX II", "C MAX II"]],
  ["Grand C-MAX (2010–2019)", ["Grand C-MAX", "Grand C MAX"]],
  ["Transit MK7 2.2 TDCi (2006–2011)", ["Transit VII 2.2 TDCi", "Transit V347 2.2 TDCi", "Transit V348 2.2 TDCi"]],
  ["Transit MK7 2.4 TDCi (2006–2011)", ["Transit VII 2.4 TDCi", "Transit V347 2.4 TDCi", "Transit V348 2.4 TDCi"]],
  ["Transit MK7 3.2 TDCi (2006–2011)", ["Transit VII 3.2 TDCi"]],
  ["Transit MK7 2.3 Duratec (2006–2011)", ["Transit VII 2.3 Duratec"]],
  ["Transit MK7 FL 2.2 TDCi (2011–2014)", ["Transit VII FL 2.2 TDCi", "Transit 2011 2.2 TDCi"]],
  ["Transit MK8 2.2 TDCi (2014–2016)", ["Transit VIII 2.2 TDCi", "Transit 2014 2.2 TDCi"]],
  ["Transit MK8 2.0 EcoBlue (2016–současnost)", ["Transit VIII 2.0 EcoBlue", "Transit 2.0 EcoBlue"]],
  ["Transit Custom I 2.2 TDCi (2012–2016)", ["Transit Custom I 2.2 TDCi", "Transit / Tourneo Custom 2.2 TDCi"]],
  ["Transit Custom I FL 2.0 EcoBlue (2016–2023)", ["Transit Custom I FL 2.0 EcoBlue", "Transit Custom 2.0 EcoBlue", "Transit / Tourneo Custom 2.0 EcoBlue"]],
  ["Transit Custom I 1.0 EcoBoost PHEV (2019–2023)", ["Transit Custom PHEV", "Transit Custom 1.0 EcoBoost PHEV"]],
  ["Transit Custom II 2.0 EcoBlue (2023–současnost)", ["Transit Custom II 2.0 EcoBlue", "Transit Custom 2023 2.0 EcoBlue"]],
  ["Transit Custom II 2.5 Duratec PHEV (2023–současnost)", ["Transit Custom II 2.5 Duratec PHEV", "Transit Custom 2023 PHEV"]],
  ["Transit Connect I 1.8 TDCi (2006–2013)", ["Transit Connect I 1.8 TDCi"]],
  ["Transit Connect II 1.6 TDCi (2013–2015)", ["Transit Connect II 1.6 TDCi"]],
  ["Transit Connect II 1.0 EcoBoost (2013–2018)", ["Transit Connect II 1.0 EcoBoost"]],
  ["Transit Connect II 1.5 TDCi (2015–2018)", ["Transit Connect II 1.5 TDCi"]],
  ["Transit Connect II FL 1.5 EcoBlue (2018–2024)", ["Transit Connect II FL 1.5 EcoBlue", "Transit Connect 1.5 EcoBlue"]],
  ["Transit Connect III 2.0 EcoBlue (2024–současnost)", ["Transit Connect III 2.0 EcoBlue"]],
  ["Transit Connect III 1.5 EcoBoost PHEV (2024–současnost)", ["Transit Connect III 1.5 EcoBoost PHEV"]],
  ["Transit Courier I 1.5/1.6 TDCi (2014–2023)", ["Transit Courier I diesel", "Transit / Tourneo Courier diesel"]],
  ["Transit Courier I 1.0 EcoBoost (2014–2023)", ["Transit Courier I 1.0 EcoBoost", "Transit / Tourneo Courier 1.0 EcoBoost"]],
  ["Transit Courier II 1.0 EcoBoost (2023–současnost)", ["Transit Courier II 1.0 EcoBoost", "Transit Courier 2023 1.0 EcoBoost"]],
  ["Transit Courier II 1.5 EcoBlue (2023–současnost)", ["Transit Courier II 1.5 EcoBlue", "Transit Courier 2023 1.5 EcoBlue"]],
  ["Tourneo Custom I 2.2 TDCi (2012–2016)", ["Tourneo Custom I 2.2 TDCi", "Transit / Tourneo Custom 2.2 TDCi"]],
  ["Tourneo Custom I FL 2.0 EcoBlue (2016–2023)", ["Tourneo Custom I FL 2.0 EcoBlue", "Tourneo Custom 2.0 EcoBlue", "Transit / Tourneo Custom 2.0 EcoBlue"]],
  ["Tourneo Custom II 2.0 EcoBlue (2023–současnost)", ["Tourneo Custom II 2.0 EcoBlue", "Tourneo Custom 2023 2.0 EcoBlue"]],
  ["Tourneo Custom II 2.5 Duratec PHEV (2023–současnost)", ["Tourneo Custom II 2.5 Duratec PHEV", "Tourneo Custom 2023 PHEV"]],
  ["Tourneo Courier I 1.5/1.6 TDCi (2014–2023)", ["Tourneo Courier I diesel", "Transit / Tourneo Courier diesel"]],
  ["Tourneo Courier I 1.0 EcoBoost (2014–2023)", ["Tourneo Courier I 1.0 EcoBoost", "Transit / Tourneo Courier 1.0 EcoBoost"]],
  ["Tourneo Courier II 1.0 EcoBoost (2023–současnost)", ["Tourneo Courier II 1.0 EcoBoost", "Tourneo Courier 2023 1.0 EcoBoost"]],
  ["Tourneo Courier II 1.5 EcoBlue (2023–současnost)", ["Tourneo Courier II 1.5 EcoBlue", "Tourneo Courier 2023 1.5 EcoBlue"]],
]);

const { catalog: EU_CATALOG } = selectCatalogForMarket("eu");
const FORD_ENTRY = EU_CATALOG.find(entry => normalizeText(entry.brand) === "ford");

if (!FORD_ENTRY) {
  throw new Error("Ford brand entry was not found in web/src/constants/catalog.js");
}

function usage(exitCode = 1) {
  const msg = `
Usage:
  node scripts/forum-seed-ford.mjs <out_dir> [options]
  node scripts/forum-seed-ford.mjs <https://www.fordclub.eu/forum-kategorie/...> <out_dir> [options]
  node scripts/forum-seed-ford.mjs <https://www.fordclub.eu/forum-tema/...> <out_dir> [options]

Options:
  --discover-only  Only gather forum inventory and filtered thread titles
  --keep-review    Store borderline but promising cases into to_review/
  --min-posts N    Ignore topic titles with fewer than N posts on the listing page
`.trim();
  console.log(msg);
  process.exit(exitCode);
}

function computeFordReviewId({ forum, sourceUrl, threadTitle, stage }) {
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
    minPosts: DEFAULT_MIN_POSTS,
    sleepMs: 250,
    cookie: "",
    keepReview: false,
    discoverOnly: false,
    dry: false,
  };

  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === "--help" || value === "-h") usage(0);
    if (value === "--dry") { args.dry = true; continue; }
    if (value === "--keep-review") { args.keepReview = true; continue; }
    if (value === "--discover-only") { args.discoverOnly = true; continue; }
    if (value === "--forum") { args.forum = argv[++i] ?? ""; continue; }
    if (value === "--user-id") { args.userId = argv[++i] ?? ""; continue; }
    if (value === "--source-url") { args.sourceUrl = argv[++i] ?? ""; continue; }
    if (value === "--model") { args.model = argv[++i] ?? ""; continue; }
    if (value === "--cookie") { args.cookie = argv[++i] ?? ""; continue; }
    if (value === "--max-chars") { args.maxChars = clampInt(argv[++i], 5000, 200000, args.maxChars); continue; }
    if (value === "--pages") { args.pages = clampInt(argv[++i], 1, 5000, args.pages); continue; }
    if (value === "--index-pages") { args.indexPages = clampInt(argv[++i], 1, 500, args.indexPages); continue; }
    if (value === "--max-threads") { args.maxThreads = clampInt(argv[++i], 1, 200000, args.maxThreads); continue; }
    if (value === "--min-posts") { args.minPosts = clampInt(argv[++i], 0, 1000, args.minPosts); continue; }
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

function clampInt(raw, min, max, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : fallback;
}

function logProgress(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function defaultHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (compatible; GearBrainFordSeed/1.0; +https://example.invalid)",
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
    if (!Number.isFinite(score)) continue;
    if (!best || score > best.score) best = { it: item, score };
  }
  return best;
}

function safeHostnameFromUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function resolveUrl(baseUrl, href) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return "";
  }
}

function stripHtmlText(value) {
  return htmlToText((value ?? "").toString()).replace(/\s+/g, " ").trim();
}

function extractAllAnchors(html, baseUrl) {
  const out = [];
  const regex = /<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(regex)) {
    const url = resolveUrl(baseUrl, match[2] ?? "");
    if (!url) continue;
    const text = stripHtmlText(match[3] ?? "");
    out.push({ url, text });
  }
  return out;
}

function isFordTopicUrl(url) {
  return /\/forum-(tema|topic)\//i.test((url ?? "").toString());
}

function isFordCategoryUrl(url) {
  return /\/forum-(kategorie|category)\//i.test((url ?? "").toString());
}

function getFordTopicIdFromUrl(url) {
  const match = (url ?? "").toString().match(/-(\d+)(?:[/?#]|$)/);
  return match ? match[1] : "";
}

function canonicalFordTopicUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return (url ?? "").toString();
  }
}

function canonicalFordListingUrl(url) {
  try {
    const parsed = new URL(url);
    const keep = parsed.searchParams.get("kols");
    parsed.search = "";
    if (keep && Number(keep) > 1) parsed.searchParams.set("kols", String(Number(keep)));
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return (url ?? "").toString();
  }
}

function extractRelNextUrl(html, baseUrl, pageKind = "listing") {
  const accepts = pageKind === "topic" ? isFordTopicUrl : isFordCategoryUrl;
  const match = (html ?? "").toString().match(/<link\b[^>]*rel=(["'])next\1[^>]*href=(["'])(.*?)\2/i);
  if (match?.[3]) {
    const resolved = resolveUrl(baseUrl, match[3]);
    if (accepts(resolved)) return resolved;
  }

  const anchors = extractAllAnchors(html, baseUrl)
    .filter(anchor => accepts(anchor.url))
    .filter(anchor => anchor.url.includes("kols="));
  const next = bestByScore(anchors, anchor => {
    const current = getFordPageOrderFromUrl(baseUrl);
    const page = getFordPageOrderFromUrl(anchor.url);
    return page > current ? 1 / page : -1;
  });
  return next && getFordPageOrderFromUrl(next.it.url) > getFordPageOrderFromUrl(baseUrl) ? next.it.url : "";
}

function getFordPageOrderFromUrl(url) {
  try {
    const parsed = new URL(url);
    const kols = parsed.searchParams.get("kols");
    if (kols) return Number(kols) || 1;
    const page = parsed.searchParams.get("page");
    if (page) return Number(page) || 1;
    return 1;
  } catch {
    return 1;
  }
}

function normalizeFordForumMatchText(value) {
  let text = (value ?? "").toString();
  const replacements = [
    [/\bmondeo\s+mk\s*iv\b/gi, "Mondeo MK4"],
    [/\bmondeo\s+iv\b/gi, "Mondeo MK4"],
    [/\bmondeo\s+mk\s*v\b/gi, "Mondeo MK5"],
    [/\bmondeo\s+v\b/gi, "Mondeo MK5"],
    [/\bfiesta\s+vii\b/gi, "Fiesta MK7"],
    [/\bfiesta\s+viii\b/gi, "Fiesta MK8"],
    [/\bgalaxy\s+iii\b/gi, "Galaxy MK3"],
    [/\bgalaxy\s+iv\b/gi, "Galaxy MK4"],
    [/\bc[\s-]*max\s+ii\b/gi, "C-MAX II"],
    [/\bs[\s-]*max\s+i\b/gi, "S-MAX I"],
    [/\bs[\s-]*max\s+ii\b/gi, "S-MAX II"],
    [/\bka\s+ii\b/gi, "Ka II"],
    [/\btransit\s+vii\b/gi, "Transit MK7"],
    [/\btransit\s+viii\b/gi, "Transit MK8"],
    [/\bv347\b/gi, "Transit MK7"],
    [/\bv348\b/gi, "Transit MK7"],
    [/\becosport\s+ii\s+bk\b/gi, "EcoSport"],
    [/\becosport\s+ii\b/gi, "EcoSport"],
    [/\btransit\s*\/\s*tourneo\s+courier\b/gi, "Transit Tourneo Courier"],
    [/\btransit\s*\/\s*tourneo\s+custom\b/gi, "Transit Tourneo Custom"],
  ];
  for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);
  return normalizeText(text);
}

function normalizeFordLabelText(label) {
  return normalizeFordForumMatchText(
    (label ?? "")
      .toString()
      .replace(/\(\d{4}[–-](\d{4}|dosud|sou[čc]asnost)\)/gi, " ")
  );
}

function parseFordLabelYearRange(label) {
  const match = (label ?? "").toString().match(/\((\d{4})[–-](\d{4}|dosud|současnost|soucasnost)\)/i);
  if (!match) return null;
  const start = Number(match[1]);
  const end = /^(dosud|současnost|soucasnost)$/i.test(match[2]) ? new Date().getFullYear() : Number(match[2]);
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

function getModelAliasTexts(label) {
  return [...new Set([label, ...(MODEL_ALIAS_BY_LABEL.get(label) ?? [])])];
}

function escapeRegExp(value) {
  return (value ?? "").toString().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreModelLabel(label, query) {
  const normalizedLabel = normalizeFordLabelText(label);
  const normalizedQuery = normalizeFordForumMatchText(query);
  if (!normalizedLabel || !normalizedQuery) return 0;

  const direct = tokenOverlapScore(normalizedLabel, normalizedQuery) + (normalizedQuery.includes(normalizedLabel) ? 0.35 : 0);
  const aliasScores = getModelAliasTexts(label)
    .map(alias => normalizeFordForumMatchText(alias))
    .filter(Boolean)
    .map(alias => tokenOverlapScore(alias, normalizedQuery) + (normalizedQuery.includes(alias) ? 0.35 : 0));
  return Math.max(direct, 0, ...aliasScores);
}

function restrictFordFamilyCandidates(models, rawText) {
  const normalized = normalizeFordForumMatchText(rawText);
  if (!normalized) return models;

  const wantsTourneo = /\btourneo\b/.test(normalized);
  const wantsTransit = /\btransit\b/.test(normalized);

  if (wantsTourneo && !wantsTransit) {
    const filtered = models.filter(model => /\btourneo\b/i.test(model.label));
    return filtered.length > 0 ? filtered : models;
  }

  if (wantsTransit && !wantsTourneo) {
    const filtered = models.filter(model => /\btransit\b/i.test(model.label));
    return filtered.length > 0 ? filtered : models;
  }

  return models;
}

function pickFordModelLabelByExplicitAlias(rawText) {
  const normalized = normalizeFordForumMatchText(rawText);
  if (!normalized?.trim()) return null;

  const models = (FORD_ENTRY.models ?? []).filter(model => model?.label);
  const matches = [];

  for (const model of models) {
    for (const alias of getModelAliasTexts(model.label).map(normalizeFordForumMatchText).filter(Boolean)) {
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

  if (matches.length === 0) return null;

  matches.sort((a, b) => (
    b.aliasTokens - a.aliasTokens ||
    b.aliasLength - a.aliasLength ||
    a.label.localeCompare(b.label)
  ));

  const best = matches[0];
  const tied = matches.filter(match => match.aliasTokens === best.aliasTokens && match.aliasLength === best.aliasLength);
  const distinctLabels = [...new Set(tied.map(match => match.label))];
  if (distinctLabels.length !== 1) return null;

  return best.label;
}

function pickFordModelLabel(rawText) {
  const normalized = normalizeFordForumMatchText(rawText);
  if (!normalized?.trim()) return null;

  const explicitAliasLabel = pickFordModelLabelByExplicitAlias(normalized);
  if (explicitAliasLabel) return explicitAliasLabel;

  const models = restrictFordFamilyCandidates(
    (FORD_ENTRY.models ?? []).filter(model => model?.label),
    normalized
  );
  const best = bestByScore(models, model => scoreModelLabel(model.label, normalized));
  if (!best || best.score < 0.28) return null;

  const epsilon = 0.03;
  const near = models
    .map(model => ({ model, score: scoreModelLabel(model.label, normalized) }))
    .filter(item => Math.abs(item.score - best.score) <= epsilon)
    .sort((a, b) => b.score - a.score);
  if (near.length >= 2) return null;

  return best.it.label;
}

function resolveFordVehicleModel({ modelRaw = "", threadTitle = "", parentForumTitle = "" }) {
  const combined = normalizeFordForumMatchText([modelRaw, threadTitle, parentForumTitle].filter(Boolean).join(" | "));
  const explicitYears = extractExplicitYears(combined);
  const familyContext = normalizeFordForumMatchText([modelRaw, threadTitle].filter(Boolean).join(" | ")) || combined;
  const models = restrictFordFamilyCandidates(
    (FORD_ENTRY.models ?? []).filter(model => model?.label),
    familyContext
  );

  if (explicitYears.length > 0) {
    const yearCandidates = models.filter(model => {
      if (scoreModelLabel(model.label, combined) < 0.15) return false;
      const range = parseFordLabelYearRange(model.label);
      return range && explicitYears.some(year => year >= range.start && year <= range.end);
    });

    if (yearCandidates.length === 1) return yearCandidates[0].label;
    if (yearCandidates.length > 1) {
      const best = bestByScore(yearCandidates, model => scoreModelLabel(model.label, combined));
      if (best && best.score >= 0.15) return best.it.label;
    }
  }

  const contexts = [
    modelRaw,
    threadTitle,
    parentForumTitle,
    [modelRaw, threadTitle].filter(Boolean).join(" | "),
    [modelRaw, parentForumTitle].filter(Boolean).join(" | "),
    [modelRaw, parentForumTitle, threadTitle].filter(Boolean).join(" | "),
  ]
    .map(value => normalizeFordForumMatchText(value))
    .filter(Boolean);

  for (const context of contexts) {
    const label = pickFordModelLabel(context);
    if (label) return label;
  }

  return null;
}

function listFordCatalogMatches(rawText, limit = 8) {
  const normalized = normalizeFordForumMatchText(rawText);
  if (!normalized) return [];
  return (FORD_ENTRY.models ?? [])
    .filter(model => model?.label)
    .map(model => ({ label: model.label, score: scoreModelLabel(model.label, normalized) }))
    .filter(item => item.score >= 0.16)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map(item => item.label);
}

function normalizeFordForumTitle(title) {
  return (title ?? "")
    .toString()
    .replace(/\s*-\s*F[oó]rum\s*-\s*Ford klub\s*$/i, "")
    .trim();
}

function inferFordForumInventory({ forumUrl, forumTitle }) {
  const cleanTitle = normalizeFordForumTitle(forumTitle);
  const candidates = listFordCatalogMatches(cleanTitle, 12);
  const resolvedModel = resolveFordVehicleModel({
    modelRaw: cleanTitle,
    threadTitle: cleanTitle,
    parentForumTitle: cleanTitle,
  });

  let forumType = "model";
  let note = "";
  if (/technick[ýy]\s+koutek/i.test(cleanTitle)) {
    forumType = "general";
    note = "Shared technical forum across multiple Ford models.";
  } else if (/transit\b.*obecn[ěe]/i.test(cleanTitle) || /^tourneo$/i.test(cleanTitle)) {
    forumType = "shared";
    note = "Shared forum, not one exact catalog model.";
  } else if (/transit\s*\/\s*tourneo/i.test(cleanTitle)) {
    forumType = "shared";
    note = "Forum covers both Transit and Tourneo variants.";
  }

  return {
    forum_url: forumUrl,
    forum_title: forumTitle,
    normalized_title: cleanTitle,
    forum_type: forumType,
    resolved_model: resolvedModel,
    candidate_models: candidates,
    note,
  };
}

function isFordTechnicalCornerListing(listingUrl) {
  return /\/forum-kategorie\/technicky-koutek-6\b/i.test((listingUrl ?? "").toString());
}

function classifyFordTopicEntry({ title, postCount, minPosts = DEFAULT_MIN_POSTS, listingUrl = "" }) {
  const raw = (title ?? "").toString().trim();
  const count = Number(postCount) || 0;
  if (!raw || raw.length < 4) return { keep: false, reason: "Title too short", signal: false };
  if (count < minPosts) return { keep: false, reason: `Only ${count} post(s)`, signal: false };
  if (TOPIC_BLACKLIST.some(pattern => pattern.test(raw))) {
    return { keep: false, reason: "Clearly non-diagnostic topic", signal: false };
  }
  if (isFordTechnicalCornerListing(listingUrl) && TECHNICAL_CORNER_GENERIC_PATTERNS.some(pattern => pattern.test(raw))) {
    return { keep: false, reason: "Generic technical-corner topic", signal: false };
  }
  return {
    keep: true,
    reason: "Passed mild prefilter",
    signal: TOPIC_SIGNAL_PATTERNS.some(pattern => pattern.test(raw)),
  };
}

function extractFordTopicEntriesFromForumPage(html, listingUrl, minPosts = DEFAULT_MIN_POSTS) {
  const rows = (html ?? "").toString().match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
  const host = safeHostnameFromUrl(listingUrl);
  const entries = [];

  for (const row of rows) {
    const topicAnchors = [...row.matchAll(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)]
      .map(match => ({
        url: resolveUrl(listingUrl, match[2] ?? ""),
        title: stripHtmlText(match[3] ?? ""),
      }))
      .filter(item => safeHostnameFromUrl(item.url) === host)
      .filter(item => isFordTopicUrl(item.url))
      .filter(item => !/[?&]select=/i.test(item.url));

    if (topicAnchors.length === 0) continue;

    const topic = topicAnchors[0];
    const canonicalUrl = canonicalFordTopicUrl(topic.url);
    const postCountMatch = row.match(/<td\b[^>]*align=(["'])right\1[^>]*>\s*(\d+)\s*<\/td>/i)
      || row.match(/<td\b[^>]*align=right[^>]*>\s*(\d+)\s*<\/td>/i);
    const postCount = Number(postCountMatch?.[2] ?? postCountMatch?.[1] ?? 0) || 0;
    const classification = classifyFordTopicEntry({ title: topic.title, postCount, minPosts, listingUrl });

    entries.push({
      url: canonicalUrl,
      title: topic.title.replace(/\s+/g, " ").trim(),
      post_count: postCount,
      keep: classification.keep,
      discard_reason: classification.keep ? "" : classification.reason,
      signal: classification.signal,
    });
  }

  return uniqByKey(entries, entry => entry.url);
}

function isFordTimestamp(line) {
  return /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test((line ?? "").toString().trim());
}

function normalizeFordAuthor(line) {
  return (line ?? "")
    .toString()
    .replace(/\bImage\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isFordNoiseLine(line) {
  const text = normalizeText(line);
  if (!text) return true;
  return /^(reply|odpovedet|odpovědět|forum|fórum|manuals|manualy|manuály|advert|inzerce|model|new topic|nove tema|nové téma|on-line|online)$/i.test(text);
}

function sanitizeFordPostText(lines) {
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

function extractPostsFromFordText(html, pageNumber = 1) {
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
    if (!isFordTimestamp(lines[i])) continue;
    const when = lines[i];

    let author = "";
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
      if (isFordNoiseLine(lines[j])) continue;
      author = normalizeFordAuthor(lines[j]);
      if (author) break;
    }
    if (!author) continue;

    const body = [];
    let k = i + 1;
    for (; k < lines.length; k++) {
      if (isFordTimestamp(lines[k])) break;
      body.push(lines[k]);
    }

    const text = sanitizeFordPostText(body);
    if (text.length >= 10) posts.push({ author, when, postId: "", pageNumber, text });
    i = k - 1;
  }

  return posts;
}

async function collectFordPages({ firstHtml, firstUrl, maxPages, cookie = "", sleepMs = 0, canonicalize, pageKind = "listing" }) {
  const pages = [{ url: canonicalize(firstUrl), html: firstHtml }];
  const seen = new Set([canonicalize(firstUrl)]);

  while (pages.length < Math.max(1, maxPages)) {
    const current = pages[pages.length - 1];
    const nextUrl = extractRelNextUrl(current.html, current.url, pageKind);
    if (!nextUrl) break;
    const canonicalNext = canonicalize(nextUrl);
    if (!canonicalNext || seen.has(canonicalNext)) break;
    const html = await fetchUrl(canonicalNext, cookie);
    pages.push({ url: canonicalNext, html });
    seen.add(canonicalNext);
    if (sleepMs > 0) await sleep(sleepMs);
  }

  return pages;
}

async function fetchFordThreadAsText({ url, pages = 999, cookie = "", forumTitle = "", sleepMs = 0 }) {
  const firstHtml = await fetchUrl(url, cookie);
  const title = extractTitleFromHtml(firstHtml);
  const pageItems = await collectFordPages({
    firstHtml,
    firstUrl: url,
    maxPages: pages,
    cookie,
    sleepMs,
    canonicalize: canonicalFordTopicUrl,
    pageKind: "topic",
  });

  const posts = [];
  for (let i = 0; i < pageItems.length; i++) posts.push(...extractPostsFromFordText(pageItems[i].html, i + 1));

  if (posts.length === 0) {
    return { text: htmlToText(firstHtml), title, totalPages: pageItems.length };
  }

  return {
    text: buildThreadText({ url, title, posts, forumTitle, subforumName: "", subforumTitle: "" }),
    title,
    totalPages: pageItems.length,
  };
}

async function discoverFordThreadsFromForum({ forumUrl, firstHtml = "", indexPages = 25, minPosts = DEFAULT_MIN_POSTS, cookie = "", sleepMs = 0 }) {
  const forumHtml = firstHtml || await fetchUrl(forumUrl, cookie);
  const forumTitle = extractTitleFromHtml(forumHtml);
  const listingPages = await collectFordPages({
    firstHtml: forumHtml,
    firstUrl: forumUrl,
    maxPages: indexPages,
    cookie,
    sleepMs,
    canonicalize: canonicalFordListingUrl,
    pageKind: "listing",
  });

  const discovered = [];
  logProgress(`Listing start: ${forumTitle || forumUrl}`);
  for (let pageIndex = 0; pageIndex < listingPages.length; pageIndex++) {
    const page = listingPages[pageIndex];
    logProgress(`Listing page ${pageIndex + 1}/${listingPages.length}: ${page.url}`);
    const topics = extractFordTopicEntriesFromForumPage(page.html, page.url, minPosts).map(topic => ({
      ...topic,
      parentForumTitle: forumTitle,
      subforumName: "",
      subforumTitle: forumTitle,
      subforumUrl: forumUrl,
    }));
    discovered.push(...topics);
  }

  return {
    forumTitle,
    listingPages: listingPages.length,
    threads: uniqByKey(discovered, item => item.url),
  };
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

      const reviewId = computeFordReviewId({
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
      "- Forum context (model forum title) may contain the Ford model or generation. You may use that context, but only when explicit.",
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
      "- Use forum context if it explicitly identifies the Ford model or generation.",
      "- If any required field is ambiguous for one case, omit that case but continue extracting other clear cases.",
      "- If there are no clear cases, return [].",
      "- Translate symptoms, description, and resolution to English.",
      "- If mileage is explicitly mentioned, extract it as an integer number of kilometers (e.g., 185000).",
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

      const vehicle_brand = "Ford";
      const vehicle_model = resolveFordVehicleModel({
        modelRaw: normalizedItem?.model_raw ?? "",
        threadTitle: normalizedThreadTitle,
        parentForumTitle,
      }) ?? null;
      const engine_power = vehicle_model
        ? pickEnginePower(
            FORD_ENTRY,
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
  const inventoryPath = path.join(args.outDir, "forum_inventory.json");
  await fs.mkdir(outReady, { recursive: true });
  if (args.keepReview) await fs.mkdir(outReview, { recursive: true });

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

  const inventory = [];

  let processOneThread = null;
  if (!args.discoverOnly) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error("Missing DEEPSEEK_API_KEY (or use --discover-only / --dry).");
      process.exit(2);
    }
    processOneThread = await processThreadFactory({ args, apiKey, outReady, outReview, discardedPath });
  }

  let totalDiscovered = 0;
  let totalKept = 0;
  let totalDropped = 0;
  let totalReady = 0;
  let totalReview = 0;
  let totalDiscarded = 0;
  let totalProcessedThreads = 0;

  for (let inputIndex = 0; inputIndex < args.inputs.length; inputIndex++) {
    const input = args.inputs[inputIndex];
    logProgress(`Input ${inputIndex + 1}/${args.inputs.length} start: ${input}`);

    if (isFordTopicUrl(input)) {
      if (args.discoverOnly) {
        totalDiscovered++;
        totalKept++;
        continue;
      }
      const raw = await fetchFordThreadAsText({ url: input, pages: args.pages, cookie: args.cookie, sleepMs: args.sleepMs });
      const res = await processOneThread({ threadUrl: input, threadTextRaw: raw });
      totalReady += res.ready;
      totalReview += res.review;
      totalDiscarded += res.discarded;
      totalProcessedThreads++;
      continue;
    }

    if (!isFordCategoryUrl(input)) {
      await appendJsonLine(discardedPath, {
        stage: "input",
        reason: "Unsupported Ford input URL. Expected forum category or forum topic URL.",
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
        doneSet = new Set(doneText.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
      } catch {}
    }

    const firstHtml = await fetchUrl(input, args.cookie);
    const forumTitle = extractTitleFromHtml(firstHtml);
    inventory.push(inferFordForumInventory({ forumUrl: input, forumTitle }));

    const discovered = await discoverFordThreadsFromForum({
      forumUrl: input,
      firstHtml,
      indexPages: args.indexPages,
      minPosts: args.minPosts,
      cookie: args.cookie,
      sleepMs: args.sleepMs,
    });

    const uniqueThreads = uniqByKey(discovered.threads, thread => thread.url);
    const keptThreads = uniqueThreads.filter(thread => thread.keep);
    const droppedThreads = uniqueThreads.length - keptThreads.length;

    totalDiscovered += uniqueThreads.length;
    totalKept += keptThreads.length;
    totalDropped += droppedThreads;

    for (const thread of uniqueThreads) await appendJsonLine(discoveredAllPath, thread);
    for (const thread of keptThreads) await appendJsonLine(discoveredKeptPath, thread);

    if (args.discoverOnly) continue;

    const toProcess = keptThreads
      .filter(thread => !doneSet.has(thread.url))
      .slice(0, args.maxThreads);

    logProgress(`Discovered ${uniqueThreads.length} thread(s), kept ${keptThreads.length}, processing ${toProcess.length}.`);

    for (let threadIndex = 0; threadIndex < toProcess.length; threadIndex++) {
      const thread = toProcess[threadIndex];
      try {
        logProgress(`Thread ${threadIndex + 1}/${toProcess.length}: ${thread.title || thread.url}`);
        const raw = await fetchFordThreadAsText({
          url: thread.url,
          pages: args.pages,
          cookie: args.cookie,
          forumTitle: thread.parentForumTitle || "",
          sleepMs: args.sleepMs,
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

  await fs.writeFile(inventoryPath, JSON.stringify(inventory, null, 2), "utf8");

  if (args.discoverOnly) {
    console.log(`Discovery complete. Found ${totalDiscovered} thread title(s), kept ${totalKept} and dropped ${totalDropped} into: ${args.outDir}`);
    return;
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
  classifyFordTopicEntry,
  extractRelNextUrl,
  extractFordTopicEntriesFromForumPage,
  inferFordForumInventory,
  parseArgs,
  resolveFordVehicleModel,
};
