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

// Renault root contains a mix of legacy pre-2000 lines, general sections and
// post-2000 model/generation forums. Keep the default crawl conservative:
// only generation-specific or clearly post-2000 model forums are included.
// Generic older lines such as Kangoo / Trafic / Master are left out for now
// because their shared categories span pre-2000 generations.
const DEFAULT_INPUTS = [
  "https://cs.renault-club.cz/forum-kategorie/scenic-ii-48",
  "https://cs.renault-club.cz/forum-kategorie/scenic-iii-82",
  "https://cs.renault-club.cz/forum-kategorie/scenic-iv-114",
  "https://cs.renault-club.cz/forum-kategorie/megane-ii-27",
  "https://cs.renault-club.cz/forum-kategorie/megane-iii-79",
  "https://cs.renault-club.cz/forum-kategorie/megane-iv-105",
  "https://cs.renault-club.cz/forum-kategorie/laguna-ii-37",
  "https://cs.renault-club.cz/forum-kategorie/laguna-iii-77",
  "https://cs.renault-club.cz/forum-kategorie/espace-iv-96",
  "https://cs.renault-club.cz/forum-kategorie/espace-v-101",
  "https://cs.renault-club.cz/forum-kategorie/espace-vi-122",
  "https://cs.renault-club.cz/forum-kategorie/clio-iii-73",
  "https://cs.renault-club.cz/forum-kategorie/clio-iv-74",
  "https://cs.renault-club.cz/forum-kategorie/clio-v-113",
  "https://cs.renault-club.cz/forum-kategorie/twingo-ii-75",
  "https://cs.renault-club.cz/forum-kategorie/twingo-iii-99",
  "https://cs.renault-club.cz/forum-kategorie/thalia-ii-83",
  "https://cs.renault-club.cz/forum-kategorie/koleos-i-57",
  "https://cs.renault-club.cz/forum-kategorie/koleos-ii-112",
  "https://cs.renault-club.cz/forum-kategorie/5-2023-118",
  "https://cs.renault-club.cz/forum-kategorie/alaskan-116",
  "https://cs.renault-club.cz/forum-kategorie/arkana-115",
  "https://cs.renault-club.cz/forum-kategorie/austral-121",
  "https://cs.renault-club.cz/forum-kategorie/captur-66",
  "https://cs.renault-club.cz/forum-kategorie/fluence-39",
  "https://cs.renault-club.cz/forum-kategorie/kadjar-103",
  "https://cs.renault-club.cz/forum-kategorie/latitude-58",
  "https://cs.renault-club.cz/forum-kategorie/modus-40",
  "https://cs.renault-club.cz/forum-kategorie/talisman-104",
  "https://cs.renault-club.cz/forum-kategorie/twizy-111",
  "https://cs.renault-club.cz/forum-kategorie/vel-satis-51",
  "https://cs.renault-club.cz/forum-kategorie/wind-67",
];

const DEFAULT_FORUM = "renaultclub_cz";
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
  /\btuning\b/i,
  /\bwebsite\b/i,
  /\bimprovement\b/i,
  /\bcrash\s+test\b/i,
  /\bshop\b/i,
];

const TITLE_NOISE_PATTERNS = [
  /\bfoto\b/i,
  /\bč[ií]slo\s+d[ií]lu\b/i,
  /\butahovac[ií]\s+momenty\b/i,
  /\bled\s+[žz]iarovk/i,
  /\baku\s+bater/i,
  /\bdiagnostika\b.*\bkraj/i,
  /\bv[ýy]m[eě]na\s+volantu\b/i,
  /\bčeln[eé]\s+sklo\b/i,
  /\btest\s+tlmi[čc]ov\b/i,
];

const TOPIC_SIGNAL_PATTERNS = [
  /\b[pbcu]\d{4}\b/i,
  /\b(nejde|nestart|zhas(i|í|n)|skub|cuk|klep|hluk|hu[cč]i|p[ií]sk|nouz|probl[eé]m|z[aá]vada|chyba|kontrolka|olej|tlak|netop[ií]|sahara|termostat|ventil[aá]tor|spojka|brzd|airbag|abs|esp|emise|fap|dpf|egr|turbo|[uú]nik|cidlo|čidlo|senzor|elektrika|vstrik|vstřik|převodovka|prevodovka|servo|altern[aá]tor|baterie|klima|vibrac|kou[rř]|smrd[ií])\b/i,
  /\b(problem|fault|issue|error|warning|leak|noise|knock|rattle|whine|squeak|vibration|misfire|jerk|judder|limp|overheat|overheating|won['’]t start|doesn['’]t start|stall|stalls|smoke|smell|oil|coolant|brake|airbag|abs|esp|fap|dpf|egr|turbo|sensor|injector|battery|alternator|gearbox|transmission|clutch|steering|ac|climate|thermostat|fan)\b/i,
  /\b(dci|blue\s*dci|tce|sce|edc|e-?tech|adblue|4control)\b/i,
  /\b\d{2,3}\s*kw\b/i,
];

const MODEL_ALIAS_BY_LABEL = new Map([
  ["Scenic II (2003–2009)", ["Scenic II", "Grand Scenic II", "Scenic 2"]],
  ["Scenic III (2009–2016)", ["Scenic III", "Grand Scenic III", "Scenic 3"]],
  ["Scenic IV (2016–2022)", ["Scenic IV", "Grand Scenic IV", "Scenic 4"]],
  ["Megane II (2002–2009)", ["Megane II", "Mégane II", "Megane 2"]],
  ["Megane III (2008–2016)", ["Megane III", "Mégane III", "Megane 3"]],
  ["Megane IV (2016–2022)", ["Megane IV", "Mégane IV", "Megane 4"]],
  ["Laguna II (2001–2007)", ["Laguna II", "Laguna 2"]],
  ["Laguna III (2007–2015)", ["Laguna III", "Laguna 3"]],
  ["Espace IV (2002–2014)", ["Espace IV", "Espace 4"]],
  ["Espace V (2015–2023)", ["Espace V", "Espace 5"]],
  ["Espace VI (2023–dosud)", ["Espace VI", "Espace 6"]],
  ["Clio III (2006–2012)", ["Clio III", "Clio 3"]],
  ["Clio IV (2012–2019)", ["Clio IV", "Clio 4"]],
  ["Clio V (2019–dosud)", ["Clio V", "Clio 5"]],
  ["Twingo II (2007–2014)", ["Twingo II", "Twingo 2"]],
  ["Twingo III (2014–dosud)", ["Twingo III", "Twingo 3"]],
  ["Thalia II (2008–2013)", ["Thalia II", "Thalia 2", "Symbol II", "Symbol 2"]],
  ["Koleos I (2008–2016)", ["Koleos I", "Koleos 1"]],
  ["Koleos II (2017–dosud)", ["Koleos II", "Koleos 2"]],
  ["Renault 5 E-Tech Electric (2024–dosud)", ["Renault 5", "R5", "5 E-Tech", "R5 E-Tech"]],
  ["Alaskan (2017–2021)", ["Alaskan"]],
  ["Arkana (2021–dosud)", ["Arkana"]],
  ["Austral (2022–dosud)", ["Austral"]],
  ["Captur I (2013–2019)", ["Captur I", "Captur"]],
  ["Captur II (2019–dosud)", ["Captur II", "Captur"]],
  ["Fluence (2009–2016)", ["Fluence"]],
  ["Kadjar (2015–2022)", ["Kadjar"]],
  ["Latitude (2011–2015)", ["Latitude"]],
  ["Modus / Grand Modus (2004–2012)", ["Modus", "Grand Modus"]],
  ["Talisman (2015–2022)", ["Talisman"]],
  ["Twizy (2011–dosud)", ["Twizy"]],
  ["Vel Satis (2001–2009)", ["Vel Satis"]],
  ["Wind (2010–2013)", ["Wind"]],
]);

const FORUM_HINTS = new Map([
  ["scenic-ii", { forum_type: "model", resolved_model: "Scenic II (2003–2009)", candidate_models: [] }],
  ["scenic-iii", { forum_type: "model", resolved_model: "Scenic III (2009–2016)", candidate_models: [] }],
  ["scenic-iv", { forum_type: "model", resolved_model: "Scenic IV (2016–2022)", candidate_models: [] }],
  ["megane-ii", { forum_type: "model", resolved_model: "Megane II (2002–2009)", candidate_models: [] }],
  ["megane-iii", { forum_type: "model", resolved_model: "Megane III (2008–2016)", candidate_models: [] }],
  ["megane-iv", { forum_type: "model", resolved_model: "Megane IV (2016–2022)", candidate_models: [] }],
  ["laguna-ii", { forum_type: "model", resolved_model: "Laguna II (2001–2007)", candidate_models: [] }],
  ["laguna-iii", { forum_type: "model", resolved_model: "Laguna III (2007–2015)", candidate_models: [] }],
  ["espace-iv", { forum_type: "model", resolved_model: "Espace IV (2002–2014)", candidate_models: [] }],
  ["espace-v", { forum_type: "model", resolved_model: "Espace V (2015–2023)", candidate_models: [] }],
  ["espace-vi", { forum_type: "model", resolved_model: "Espace VI (2023–dosud)", candidate_models: [] }],
  ["clio-iii", { forum_type: "model", resolved_model: "Clio III (2006–2012)", candidate_models: [] }],
  ["clio-iv", { forum_type: "model", resolved_model: "Clio IV (2012–2019)", candidate_models: [] }],
  ["clio-v", { forum_type: "model", resolved_model: "Clio V (2019–dosud)", candidate_models: [] }],
  ["twingo-ii", { forum_type: "model", resolved_model: "Twingo II (2007–2014)", candidate_models: [] }],
  ["twingo-iii", { forum_type: "model", resolved_model: "Twingo III (2014–dosud)", candidate_models: [] }],
  ["thalia-ii", { forum_type: "model", resolved_model: "Thalia II (2008–2013)", candidate_models: [] }],
  ["koleos-i", { forum_type: "model", resolved_model: "Koleos I (2008–2016)", candidate_models: [] }],
  ["koleos-ii", { forum_type: "model", resolved_model: "Koleos II (2017–dosud)", candidate_models: [] }],
  ["5-2023", { forum_type: "model", resolved_model: "Renault 5 E-Tech Electric (2024–dosud)", candidate_models: [], note: "Forum is the new Renault 5 E-Tech category." }],
  ["alaskan", { forum_type: "model", resolved_model: "Alaskan (2017–2021)", candidate_models: [] }],
  ["arkana", { forum_type: "model", resolved_model: "Arkana (2021–dosud)", candidate_models: [] }],
  ["austral", { forum_type: "model", resolved_model: "Austral (2022–dosud)", candidate_models: [] }],
  ["captur", { forum_type: "model_family", resolved_model: null, candidate_models: ["Captur I (2013–2019)", "Captur II (2019–dosud)"], note: "Forum covers multiple Captur generations." }],
  ["fluence", { forum_type: "model", resolved_model: "Fluence (2009–2016)", candidate_models: [] }],
  ["kadjar", { forum_type: "model", resolved_model: "Kadjar (2015–2022)", candidate_models: [] }],
  ["latitude", { forum_type: "model", resolved_model: "Latitude (2011–2015)", candidate_models: [] }],
  ["modus", { forum_type: "model", resolved_model: "Modus / Grand Modus (2004–2012)", candidate_models: [] }],
  ["talisman", { forum_type: "model", resolved_model: "Talisman (2015–2022)", candidate_models: [] }],
  ["twizy", { forum_type: "model", resolved_model: "Twizy (2011–dosud)", candidate_models: [] }],
  ["vel-satis", { forum_type: "model", resolved_model: "Vel Satis (2001–2009)", candidate_models: [] }],
  ["wind", { forum_type: "model", resolved_model: "Wind (2010–2013)", candidate_models: [] }],
]);

const { catalog: EU_CATALOG } = selectCatalogForMarket("eu");
const RENAULT_ENTRY = EU_CATALOG.find(entry => normalizeText(entry.brand) === "renault");

if (!RENAULT_ENTRY) {
  throw new Error("Renault brand entry was not found in web/src/constants/catalog.js");
}

function usage(exitCode = 1) {
  const msg = `
Usage:
  node scripts/forum-seed-renault.mjs <out_dir> [options]
  node scripts/forum-seed-renault.mjs <https://cs.renault-club.cz/forum-kategorie/...> <out_dir> [options]
  node scripts/forum-seed-renault.mjs <https://cs.renault-club.cz/forum-tema/...> <out_dir> [options]

Options:
  --discover-only  Only gather forum inventory and filtered thread titles
  --keep-review    Store borderline but promising cases into to_review/
  --signals-only   Process only signal-strong titles during the first crawl pass
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
    "User-Agent": "Mozilla/5.0 (compatible; GearBrainRenaultSeed/1.0; +https://example.invalid)",
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
    [/\bmegane\s+ii\b/gi, "Megane II"],
    [/\bm[eé]gane\s+ii\b/gi, "Megane II"],
    [/\bmegane\s+iii\b/gi, "Megane III"],
    [/\bm[eé]gane\s+iii\b/gi, "Megane III"],
    [/\bmegane\s+iv\b/gi, "Megane IV"],
    [/\bm[eé]gane\s+iv\b/gi, "Megane IV"],
    [/\bscenic\s+ii\b/gi, "Scenic II"],
    [/\bsc[eé]nic\s+ii\b/gi, "Scenic II"],
    [/\bscenic\s+iii\b/gi, "Scenic III"],
    [/\bsc[eé]nic\s+iii\b/gi, "Scenic III"],
    [/\bscenic\s+iv\b/gi, "Scenic IV"],
    [/\bsc[eé]nic\s+iv\b/gi, "Scenic IV"],
    [/\blaguna\s+ii\b/gi, "Laguna II"],
    [/\blaguna\s+iii\b/gi, "Laguna III"],
    [/\bespace\s+iv\b/gi, "Espace IV"],
    [/\bespace\s+v\b/gi, "Espace V"],
    [/\bespace\s+vi\b/gi, "Espace VI"],
    [/\bclio\s+iii\b/gi, "Clio III"],
    [/\bclio\s+iv\b/gi, "Clio IV"],
    [/\bclio\s+v\b/gi, "Clio V"],
    [/\btwingo\s+ii\b/gi, "Twingo II"],
    [/\btwingo\s+iii\b/gi, "Twingo III"],
    [/\bthalia\s+ii\b/gi, "Thalia II"],
    [/\bkoleos\s+i\b/gi, "Koleos I"],
    [/\bkoleos\s+ii\b/gi, "Koleos II"],
    [/\bcaptur\s+i\b/gi, "Captur I"],
    [/\bcaptur\s+ii\b/gi, "Captur II"],
    [/\bgrand\s+modus\b/gi, "Modus / Grand Modus"],
    [/\br5\s+e-?tech\b/gi, "Renault 5 E-Tech"],
    [/\brenault\s+5\s+e-?tech\b/gi, "Renault 5 E-Tech"],
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

  const wantsTraveller = /\btraveller\b/.test(normalized);
  const wantsExpert = /\bexpert\b/.test(normalized);

  if (wantsTraveller && !wantsExpert) {
    const filtered = models.filter(model => /\btraveller\b/i.test(model.label));
    return filtered.length > 0 ? filtered : models;
  }

  if (wantsExpert && !wantsTraveller) {
    const filtered = models.filter(model => /\bexpert\b/i.test(model.label));
    return filtered.length > 0 ? filtered : models;
  }

  return models;
}

function pickFordModelLabelByExplicitAlias(rawText) {
  const normalized = normalizeFordForumMatchText(rawText);
  if (!normalized?.trim()) return null;

  const models = (RENAULT_ENTRY.models ?? []).filter(model => model?.label);
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
    (RENAULT_ENTRY.models ?? []).filter(model => model?.label),
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

function resolveFamilyModelFromYears(candidateLabels, explicitYears, combined) {
  if (!Array.isArray(candidateLabels) || candidateLabels.length === 0) return null;
  if (!Array.isArray(explicitYears) || explicitYears.length === 0) return null;

  const matches = candidateLabels.filter(label => {
    const range = parseFordLabelYearRange(label);
    return range && explicitYears.some(year => year >= range.start && year <= range.end);
  });

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const best = bestByScore(matches, label => scoreModelLabel(label, combined));
    return best && best.score >= 0.15 ? best.it : null;
  }
  return null;
}

function getCategorySlug(forumUrl) {
  try {
    const parsed = new URL(forumUrl);
    const segment = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
    return segment.replace(/-\d+$/g, "").toLowerCase();
  } catch {
    return "";
  }
}

function resolveFordVehicleModel({ modelRaw = "", threadTitle = "", parentForumTitle = "", subforumUrl = "" }) {
  const forumHint = FORUM_HINTS.get(getCategorySlug(subforumUrl)) ?? null;
  const combined = normalizeFordForumMatchText([modelRaw, threadTitle, parentForumTitle].filter(Boolean).join(" | "));
  const explicitYears = extractExplicitYears(combined);
  const familyContext = normalizeFordForumMatchText([modelRaw, threadTitle].filter(Boolean).join(" | ")) || combined;
  const models = restrictFordFamilyCandidates(
    (RENAULT_ENTRY.models ?? []).filter(model => model?.label),
    familyContext
  );

  if (forumHint?.resolved_model && forumHint.forum_type === "model") return forumHint.resolved_model;

  if (forumHint?.forum_type === "model_family") {
    const yearMatch = resolveFamilyModelFromYears(forumHint.candidate_models, explicitYears, combined);
    if (yearMatch) return yearMatch;
    return null;
  }

  if (forumHint?.forum_type === "shared") {
    if (forumHint.resolved_model && forumHint.candidate_models.length <= 1) return forumHint.resolved_model;
    if (forumHint.candidate_models.length > 1) {
      const yearMatch = resolveFamilyModelFromYears(forumHint.candidate_models, explicitYears, combined);
      if (yearMatch) return yearMatch;
      const filtered = restrictFordFamilyCandidates(
        forumHint.candidate_models.map(label => ({ label })),
        combined
      );
      if (filtered.length === 1) return filtered[0].label;
      return null;
    }
  }

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
  return (RENAULT_ENTRY.models ?? [])
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
    .replace(/\s*-\s*F[oó]rum\s*-\s*Renault klub\s*$/i, "")
    .trim();
}

function inferFordForumInventory({ forumUrl, forumTitle }) {
  const cleanTitle = normalizeFordForumTitle(forumTitle);
  const hint = FORUM_HINTS.get(getCategorySlug(forumUrl)) ?? null;
  const candidates = listFordCatalogMatches(cleanTitle, 12);
  const resolvedModel = hint?.resolved_model ?? resolveFordVehicleModel({
    modelRaw: cleanTitle,
    threadTitle: cleanTitle,
    parentForumTitle: cleanTitle,
    subforumUrl: forumUrl,
  });

  return {
    forum_url: forumUrl,
    forum_title: forumTitle,
    normalized_title: cleanTitle,
    forum_type: hint?.forum_type ?? "model",
    resolved_model: resolvedModel,
    candidate_models: hint?.candidate_models ?? candidates,
    note: hint?.note ?? "",
  };
}

function classifyFordTopicEntry({ title, postCount, minPosts = DEFAULT_MIN_POSTS, listingUrl = "" }) {
  const raw = (title ?? "").toString().trim();
  const count = Number(postCount) || 0;
  if (!raw || raw.length < 4) return { keep: false, reason: "Title too short", signal: false };
  if (count < minPosts) return { keep: false, reason: `Only ${count} post(s)`, signal: false };
  if (TOPIC_BLACKLIST.some(pattern => pattern.test(raw))) {
    return { keep: false, reason: "Clearly non-diagnostic topic", signal: false };
  }
  if (TITLE_NOISE_PATTERNS.some(pattern => pattern.test(raw))) {
    return { keep: false, reason: "Low-value title noise", signal: false };
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
      "- Forum context (model forum title) may contain the Renault model or generation. You may use that context, but only when explicit.",
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
      "- Use forum context if it explicitly identifies the Renault model or generation.",
      "- If any required field is ambiguous for one case, omit that case but continue extracting other clear cases.",
      "- If there are no clear cases, return [].",
      "- Translate symptoms, description, and resolution to English.",
      "- If mileage is explicitly mentioned, extract it as an integer number of kilometers (e.g., 185000).",
      "- Normalize OBD codes to uppercase format like P0401. If none are present, use [].",
      "",
      "Output schema:",
      '[{"case_author":"","fault_post_numbers":[],"resolution_post_numbers":[],"brand_raw":"Renault","model_raw":"","engine_raw":"","engine_code_raw":"","mileage":null,"symptoms":[],"obd_codes":[],"description":"","resolution":"","closed_at":""}]',
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

      const vehicle_brand = "Renault";
      const vehicle_model = resolveFordVehicleModel({
        modelRaw: normalizedItem?.model_raw ?? "",
        threadTitle: normalizedThreadTitle,
        parentForumTitle,
        subforumUrl,
      }) ?? null;
      const engine_power = vehicle_model
        ? pickEnginePower(
            RENAULT_ENTRY,
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
  let totalThreadErrors = 0;

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
        reason: "Unsupported Renault input URL. Expected forum category or forum topic URL.",
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
      .filter(thread => !args.signalsOnly || thread.signal)
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
        totalThreadErrors++;
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
    console.log(`Processed ${totalProcessedThreads} thread(s). Wrote ${totalReady} ready record(s), ${totalReview} review item(s), discarded ${totalDiscarded} item(s) and hit ${totalThreadErrors} thread error(s) into: ${args.outDir}`);
  } else {
    console.log(`Processed ${totalProcessedThreads} thread(s). Wrote ${totalReady} ready record(s), discarded ${totalDiscarded} item(s) and hit ${totalThreadErrors} thread error(s) into: ${args.outDir}`);
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
  classifyFordTopicEntry as classifyRenaultTopicEntry,
  extractRelNextUrl,
  extractFordTopicEntriesFromForumPage as extractRenaultTopicEntriesFromForumPage,
  inferFordForumInventory as inferRenaultForumInventory,
  parseArgs,
  resolveFordVehicleModel as resolveRenaultVehicleModel,
};
