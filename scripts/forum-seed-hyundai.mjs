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
  safeParseJsonArray,
  safeParseJsonObject,
  selectCatalogForMarket,
  toIsoOrNow,
  validateExtractedCaseAuthor,
  writeJsonFileUnique,
} from "./forum-seed.mjs";
import { deepseekChatJson, OFFLINE_DEEPSEEK_MODEL } from "./agent/deepseek.mjs";

const DEFAULT_ROOT_URLS = ["https://www.hyundai-club.eu/forums/"];
const DEFAULT_FORUM = "hyundai_club_eu";
const DEFAULT_USER_ID = "ai_importer";
const DEFAULT_MODEL = OFFLINE_DEEPSEEK_MODEL;

const TOPIC_BLACKLIST = [
  /\bmanuale\b/i,
  /\bmanuali\b/i,
  /\bowners?\s+manual\b/i,
  /\bscheda\s+tagliandi\b/i,
  /\btagliandi\b/i,
  /\bordini\b/i,
  /\bconsegne\b/i,
  /\ballestimenti\b/i,
  /\boptional\b/i,
  /\baccessori\b/i,
  /\btuning\b/i,
  /\bnews\b/i,
  /\bstampa\b/i,
  /\bfoto\b/i,
  /\bvideo\b/i,
  /\bguide\b/i,
  /\btutorial\b/i,
  /\bautoradio\b/i,
  /\brecensioni?\b/i,
  /\btest\s*drive\b/i,
  /\bvendo\b/i,
  /\bacquisto\b/i,
  /\boff[- ]?topic\b/i,
];

const TOPIC_NOISE_PATTERNS = [
  /^\s*(ciao|salve|eccomi|presentazione|mi presento)\b/i,
  /\bquale\s+olio\b/i,
  /\bwhat\s+oil\b/i,
  /\bcinghia\s+o\s+catena\b/i,
  /\blibretto\s+uso\b/i,
  /\blunghi\s+tragitti\b/i,
  /\bsostituzione\s+olio\s+del\s+cambio\b/i,
  /\bmanutenzione\s+ordinaria\b/i,
];

const TOPIC_SIGNAL_PATTERNS = [
  /\b[pbcu]\d{4}\b/i,
  /\b(problema|problemi|difetto|difetti|guasto|errore|errori|anomalia|anomalie|spia|spie|non\s+parte|non\s+va|non\s+entra|non\s+sale|non\s+funziona|rumore|rumori|vibrazione|vibrazioni|perdita|perde|pressione|compress(?:ione)?|frizione|catena|cinghia|egr|dpf|fap|iniettori?|turbo|turbina|abs|airbag|eps|esc|esp|stufa|aria\s+calda|ventola|ventilatore|alternatore|batteria|sensore|sonda|blocc|sterzo|cambio|clima|raffreddamento|minimo|misfire|accensioni?)\b/i,
  /\b(issue|fault|error|warning|leak|noise|knock|rattle|vibration|misfire|stall|stalls|smoke|smell|jerk|judder|limp|overheat|doesn['’]t start|won['’]t start|no[- ]start)\b/i,
  /\b(crdi|gdi|t-gdi|tgdi|mpi|hev|phev|ev|bev|dct|n-line|n\b)\b/i,
  /\b\d{2,3}\s*kw\b/i,
];

const MODEL_ALIAS_BY_LABEL = new Map([
  ["i10 I PA (2008–2013)", ["i10", "i10 I", "i10 PA", "i10 2008", "i10 2011"]],
  ["i10 II BA (2013–2019)", ["i10", "i10 II", "i10 2014", "i10 2018"]],
  ["i10 III AC3 (2019–)", ["i10", "i10 III", "i10 2020", "i10 2024"]],
  ["i20 I PB (2008–2014)", ["i20", "i20 I", "i20 PB", "i20 2008", "i20 2012", "i20 2014"]],
  ["i20 II GB (2014–2020)", ["i20", "i20 II", "i20 GB", "i20 Coupe", "i20 2015", "i20 2019"]],
  ["i20 III BC3 (2020–)", ["i20", "i20 III", "i20 BC3", "i20 N", "i20 2020", "i20 2024"]],
  ["i30 I FD (2007–2012)", ["i30", "i30 I", "i30 FD", "i30 2007", "i30 2011"]],
  ["i30 II GD (2012–2017)", ["i30", "i30 II", "i30 GD", "i30 2012", "i30 2016"]],
  ["i30 III PD (2017–)", ["i30", "i30 III", "i30 PD", "i30 N", "Fastback N", "i30 Fastback", "i30 2017"]],
  ["i40 (2011–2019)", ["i40"]],
  ["ix20 (2010–2019)", ["ix20"]],
  ["Genesis Coupe BK (2008–2012)", ["Genesis Coupe", "Genesis Coupe BK"]],
  ["Genesis Sportlimousine DH (2015–2016)", ["Genesis", "Genesis DH", "Genesis Sedan"]],
  ["Veloster I FS (2011–2018)", ["Veloster", "Veloster FS"]],
  ["Tucson I JM (2004–2010)", ["Tucson", "Tucson I", "Tucson JM", "Tucson 2004", "Tucson 2009"]],
  ["Tucson II LM / ix35 (2009–2015)", ["Tucson II", "ix35", "Tucson LM", "Tucson 2010", "Tucson 2014"]],
  ["Tucson III TL (2015–2020)", ["Tucson III", "Tucson TL", "Tucson 2015", "Tucson 2020"]],
  ["Tucson IV NX4 (2021–)", ["Tucson IV", "Tucson NX4", "Tucson 2021", "Tucson 2024", "Tucson Facelift 2024"]],
  ["Santa Fe I SM (2000–2006)", ["Santa Fe I", "Santa Fe SM", "Santa Fe 2000", "Santa Fe 2006"]],
  ["Santa Fe II CM (2006–2012)", ["Santa Fe II", "Santa Fe CM", "Santa Fe 2007", "Santa Fe 2011"]],
  ["Santa Fe III DM (2012–2018)", ["Santa Fe III", "Santa Fe DM", "Santa Fe 2012", "Santa Fe 2016"]],
  ["Santa Fe IV TM (2018–2024)", ["Santa Fe IV", "Santa Fe TM", "Santa Fe 2019", "Santa Fe 2021", "Santa Fe Hybrid"]],
  ["Santa Fe V MX5 (2024–)", ["Santa Fe V", "Santa Fe MX5", "Santa Fe 2024", "Santa Fe 2025"]],
  ["Kona I OS (2017–2023)", ["Kona", "Kona I", "Kona OS", "Kona EV", "Kona 2019", "Kona 2022"]],
  ["Kona II SX2 (2023–)", ["Kona", "Kona II", "Kona SX2", "Kona EV", "Kona 2023", "Kona 2025"]],
  ["Bayon (2021–dosud)", ["Bayon"]],
  ["IONIQ AE (2016–2022)", ["Ioniq", "IONIQ", "Ioniq Hybrid", "Ioniq Electric"]],
  ["IONIQ 5 NE (2021–)", ["Ioniq 5", "IONIQ 5", "Ioniq 5 N", "IONIQ 5 N"]],
  ["IONIQ 6 CE (2022–)", ["Ioniq 6", "IONIQ 6"]],
  ["INSTER (2024–)", ["Inster", "INSTER", "Inster EV"]],
]);

const { catalog: EU_CATALOG } = selectCatalogForMarket("eu");
const HYUNDAI_ENTRY = EU_CATALOG.find(entry => normalizeText(entry.brand) === "hyundai");

if (!HYUNDAI_ENTRY) {
  throw new Error("Hyundai brand entry was not found in web/src/constants/catalog.js");
}

function usage(exitCode = 1) {
  const msg = `
Usage:
  node scripts/forum-seed-hyundai.mjs <out_dir> [options]
  node scripts/forum-seed-hyundai.mjs <https://www.hyundai-club.eu/forums/> <out_dir> [options]

Options:
  --discover-only  Only collect forum inventory + thread title shortlist.
  --signals-only   Keep only strong fault-looking topic titles.
  --keep-review    Store borderline but promising cases into to_review/.
  --min-posts <n>  Drop topics with fewer than n replies. Default: 2
`.trim();
  console.log(msg);
  process.exit(exitCode);
}

function computeHyundaiReviewId({ forum, sourceUrl, threadTitle, stage }) {
  const input = JSON.stringify({
    forum: forum ?? "",
    source_url: sourceUrl ?? "",
    thread_title: threadTitle ?? "",
    stage: stage ?? "",
  });
  const hash = crypto.createHash("sha256").update(input, "utf8").digest("hex").slice(0, 16);
  return `review_${hash}`;
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
    indexPages: 25,
    maxThreads: 20000,
    sleepMs: 250,
    cookie: "",
    minPosts: 2,
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
    if (value === "--discover-only") { args.discoverOnly = true; continue; }
    if (value === "--signals-only") { args.signalsOnly = true; continue; }
    if (value === "--keep-review") { args.keepReview = true; continue; }
    if (value === "--forum") { args.forum = argv[++i] ?? ""; continue; }
    if (value === "--user-id") { args.userId = argv[++i] ?? ""; continue; }
    if (value === "--source-url") { args.sourceUrl = argv[++i] ?? ""; continue; }
    if (value === "--model") { args.model = argv[++i] ?? ""; continue; }
    if (value === "--cookie") { args.cookie = argv[++i] ?? ""; continue; }
    if (value === "--max-chars") { args.maxChars = clampInt(argv[++i], 5000, 200000, args.maxChars); continue; }
    if (value === "--pages") { args.pages = clampInt(argv[++i], 1, 5000, args.pages); continue; }
    if (value === "--index-pages") { args.indexPages = clampInt(argv[++i], 1, 999, args.indexPages); continue; }
    if (value === "--max-threads") { args.maxThreads = clampInt(argv[++i], 1, 200000, args.maxThreads); continue; }
    if (value === "--sleep-ms") { args.sleepMs = clampInt(argv[++i], 0, 30000, args.sleepMs); continue; }
    if (value === "--min-posts") { args.minPosts = clampInt(argv[++i], 0, 99999, args.minPosts); continue; }
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

function logProgress(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function defaultHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (compatible; DriveCodexHyundaiSeed/1.0; +https://example.invalid)",
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

function escapeRegExp(value) {
  return (value ?? "").toString().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function normalizeHyundaiForumMatchText(value) {
  let text = (value ?? "").toString();
  const replacements = [
    [/\bioniq[\s-]?5n\b/gi, "IONIQ 5 N"],
    [/\bioniq[\s-]?5\b/gi, "IONIQ 5"],
    [/\bioniq[\s-]?6\b/gi, "IONIQ 6"],
    [/\bi20[\s-]?n\b/gi, "i20 N"],
    [/\bi30[\s-]?n\b/gi, "i30 N"],
    [/\bfastback[\s-]?n\b/gi, "Fastback N"],
    [/\bsanta[\s-]?fe\b/gi, "Santa Fe"],
    [/\bix[\s-]?35\b/gi, "ix35"],
    [/\bgenesis[\s-]?coupe\b/gi, "Genesis Coupe"],
    [/\binster[\s-]?ev\b/gi, "Inster EV"],
    [/\bkona[\s-]?ev\b/gi, "Kona EV"],
    [/\bt[-\s]?gdi\b/gi, "T-GDi"],
    [/\bcrdi\b/gi, "CRDi"],
  ];
  for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);
  return text;
}

function parseHyundaiLabelYearRange(label) {
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

function bestHyundaiModelMatch(rawText) {
  const models = (HYUNDAI_ENTRY.models ?? []).filter(model => model?.label);
  return bestByScore(models, model => scoreModelLabel(model.label, normalizeHyundaiForumMatchText(rawText)));
}

function pickHyundaiModelLabelByExplicitAlias(rawText, candidates = null) {
  const normalized = normalizeHyundaiForumMatchText(rawText);
  if (!normalized?.trim()) return null;

  const pool = (candidates ?? (HYUNDAI_ENTRY.models ?? []).map(model => model.label)).filter(Boolean);
  const matches = [];

  for (const label of pool) {
    for (const alias of getModelAliasTexts(label).map(normalizeHyundaiForumMatchText).filter(Boolean)) {
      const regex = new RegExp(`(^|\\b)${escapeRegExp(alias)}(\\b|$)`, "i");
      if (!regex.test(normalized)) continue;
      matches.push({
        label,
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

function pickHyundaiModelLabel(rawText, candidates = null) {
  const normalized = normalizeHyundaiForumMatchText(rawText);
  if (!normalized?.trim()) return null;

  const explicitAliasLabel = pickHyundaiModelLabelByExplicitAlias(normalized, candidates);
  if (explicitAliasLabel) return explicitAliasLabel;

  const labels = (candidates ?? (HYUNDAI_ENTRY.models ?? []).map(model => model.label)).filter(Boolean);
  const best = bestByScore(labels, label => scoreModelLabel(label, normalized));
  if (!best || best.score < 0.30) return null;

  const epsilon = 0.03;
  const near = labels
    .map(label => ({ label, score: scoreModelLabel(label, normalized) }))
    .filter(item => Math.abs(item.score - best.score) <= epsilon)
    .sort((a, b) => b.score - a.score);
  if (near.length >= 2) return null;

  return best.it;
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

function isHyundaiRootUrl(url) {
  try {
    const parsed = new URL(url);
    return /^\/forums\/?$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function isHyundaiForumUrl(url) {
  try {
    const parsed = new URL(url);
    return /^\/forums\/(?!$)[^/?#]+\/?$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function isHyundaiThreadUrl(url) {
  try {
    const parsed = new URL(url);
    return /^\/threads\/(?!$)[^/?#]+\/?(page-\d+)?$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function canonicalHyundaiForumUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = parsed.pathname.replace(/\/page-\d+\/?$/i, "/").replace(/\/+$/g, "/");
    return parsed.toString();
  } catch {
    return url;
  }
}

function canonicalHyundaiThreadUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = parsed.pathname.replace(/\/page-\d+\/?$/i, "/").replace(/\/+$/g, "/");
    return parsed.toString();
  } catch {
    return url;
  }
}

function getHyundaiPageOrderFromUrl(url) {
  try {
    const parsed = new URL(url);
    const pathMatch = parsed.pathname.match(/\/page-(\d+)\/?$/i);
    if (pathMatch) return Number(pathMatch[1]) || 1;
    const page = parsed.searchParams.get("page");
    if (page) return Number(page) || 1;
    return 1;
  } catch {
    return 1;
  }
}

function slugFromForumUrl(url) {
  try {
    return new URL(url).pathname
      .replace(/^\/forums\//i, "")
      .replace(/\/+$/g, "")
      .replace(/\.\d+$/i, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

const ROOT_SKIP_PATTERNS = [
  /regolamento/i,
  /presentazione/i,
  /concessionarie/i,
  /comunicazioni/i,
  /raduni/i,
  /iscritti/i,
  /commerciali/i,
  /concept/i,
  /sponsor/i,
  /domande frequenti/i,
  /elettrico/i,
  /hyundai motor risponde/i,
  /discussioni generiche/i,
  /epoca/i,
  /editoriale/i,
  /off-road/i,
  /codice della strada/i,
  /gpl/i,
  /metano/i,
  /detailing/i,
  /english/i,
  /altre auto/i,
  /off-topic/i,
  /vendo/i,
  /acquisto/i,
];

const ROOT_NOISE_PATTERNS = [
  /allestimenti/i,
  /ordini/i,
  /consegne/i,
  /optional/i,
  /accessori/i,
  /foto/i,
  /video/i,
  /stampa/i,
  /news/i,
  /recensioni/i,
  /test drive/i,
  /tuning/i,
  /guide/i,
  /tutorial/i,
  /fai da te/i,
  /autoradio/i,
];

function makeModelHint(resolved_model, candidate_models = [], forum_type = "model", note = "") {
  return { keep: true, forum_type, resolved_model, candidate_models, note };
}

function classifyHyundaiForumEntry({ url = "", title = "" }) {
  const slug = slugFromForumUrl(url);
  const text = normalizeHyundaiForumMatchText([slug, title].join(" | "));

  if (!slug) {
    return { keep: false, forum_type: "unknown", resolved_model: null, candidate_models: [], note: "" };
  }

  if (ROOT_SKIP_PATTERNS.some(pattern => pattern.test(text))) {
    return { keep: false, forum_type: "unknown", resolved_model: null, candidate_models: [], note: "" };
  }

  if (/^coupe-rd-gk(?:-|$)/i.test(slug)) {
    return { keep: false, forum_type: "unknown", resolved_model: null, candidate_models: [], note: "Mixed pre-2000 Coupe RD and post-2000 Coupe GK forum." };
  }
  if (/^genesis-xg30-i50(?:-|$)/i.test(slug)) {
    return { keep: false, forum_type: "unknown", resolved_model: null, candidate_models: [], note: "Mixed Genesis/XG30/i50 forum is too broad for safe post-2000 Hyundai mapping." };
  }
  if (/^s-coupe(?:-|$)/i.test(slug)) {
    return { keep: false, forum_type: "unknown", resolved_model: null, candidate_models: [], note: "" };
  }

  if (ROOT_NOISE_PATTERNS.some(pattern => pattern.test(text))) {
    return { keep: false, forum_type: "noise", resolved_model: null, candidate_models: [], note: "" };
  }

  if (/^i10-2008(?:-2013|-13)?(?:-|$)/i.test(slug)) return makeModelHint("i10 I PA (2008–2013)");
  if (/^i10-2014(?:-|$)/i.test(slug)) return makeModelHint("i10 II BA (2013–2019)");
  if (/^i10-2020-oggi(?:-|$)/i.test(slug)) return makeModelHint("i10 III AC3 (2019–)");
  if (/^i10$/i.test(slug)) return makeModelHint(null, ["i10 I PA (2008–2013)", "i10 II BA (2013–2019)", "i10 III AC3 (2019–)"], "model_family");

  if (/^i20-2008-2011(?:-|$)|^i20-2012-14(?:-|$)/i.test(slug)) return makeModelHint("i20 I PB (2008–2014)");
  if (/^i20-2015-2020(?:-|$)/i.test(slug)) return makeModelHint("i20 II GB (2014–2020)");
  if (/^i20-2020-oggi(?:-|$)|^i20-n(?:-|$)/i.test(slug)) return makeModelHint("i20 III BC3 (2020–)");
  if (/^i20-(allestimenti|pregi|optional|motore|elettronica|pneumatici|carrozzeria|foto|fai-da-te|tuning)(?:-|$)/i.test(slug)) {
    return makeModelHint("i20 I PB (2008–2014)");
  }
  if (/^i20$/i.test(slug)) return makeModelHint(null, ["i20 I PB (2008–2014)", "i20 II GB (2014–2020)", "i20 III BC3 (2020–)"], "model_family");

  if (/^i30-2007-2012(?:-|$)/i.test(slug)) return makeModelHint("i30 I FD (2007–2012)");
  if (/^i30-2011-2016(?:-|$)|^i30-2012(?:-|$)/i.test(slug)) return makeModelHint("i30 II GD (2012–2017)");
  if (/^i30-2016-oggi(?:-|$)|^i30-2017(?:-|$)|^i30-n-fastback-n(?:-|$)/i.test(slug)) return makeModelHint("i30 III PD (2017–)");
  if (/^i30-(allestimenti|pregi|optional|motore|elettronica|pneumatici|carrozzeria|news|foto|fai-da-te|tuning|autoradio)(?:-|$)/i.test(slug)) {
    return makeModelHint("i30 I FD (2007–2012)");
  }
  if (/^i30$/i.test(slug)) return makeModelHint(null, ["i30 I FD (2007–2012)", "i30 II GD (2012–2017)", "i30 III PD (2017–)"], "model_family");

  if (/^i40(?:-|$)/i.test(slug)) return makeModelHint("i40 (2011–2019)");
  if (/^ix20(?:-|$)/i.test(slug)) return makeModelHint("ix20 (2010–2019)");

  if (/^genesis-coupe(?:-|$)/i.test(slug)) return makeModelHint("Genesis Coupe BK (2008–2012)");
  if (/^veloster(?:-|$)/i.test(slug)) return makeModelHint("Veloster I FS (2011–2018)");

  if (/^bayon(?:-|$)/i.test(slug)) return makeModelHint("Bayon (2021–dosud)");
  if (/^kona-ev-2019-2025(?:-|$)/i.test(slug)) return makeModelHint(null, ["Kona I OS (2017–2023)", "Kona II SX2 (2023–)"], "model_family", "Kona EV forum mixes first and second generation EV discussions.");
  if (/^kona(?:-|$)/i.test(slug)) return makeModelHint(null, ["Kona I OS (2017–2023)", "Kona II SX2 (2023–)"], "model_family");

  if (/^ioniq-5(?:-|$)|^ioniq-5-5n(?:-|$)/i.test(slug)) return makeModelHint("IONIQ 5 NE (2021–)");
  if (/^ioniq-6(?:-|$)/i.test(slug)) return makeModelHint("IONIQ 6 CE (2022–)");
  if (/^ioniq(?:-|$)/i.test(slug)) return makeModelHint("IONIQ AE (2016–2022)");
  if (/^inster-ev(?:-|$)/i.test(slug)) return makeModelHint("INSTER (2024–)");

  if (/^tucson-2004-2009(?:-|$)/i.test(slug)) return makeModelHint("Tucson I JM (2004–2010)");
  if (/^tucson-2015(?:-|$)/i.test(slug)) return makeModelHint("Tucson III TL (2015–2020)");
  if (/^tucson-2021(?:-|$)|^tucson-facelift-2024(?:-|$)/i.test(slug)) return makeModelHint("Tucson IV NX4 (2021–)");
  if (/^tucson-ix35(?:-|$)/i.test(slug)) {
    return makeModelHint(null, ["Tucson I JM (2004–2010)", "Tucson II LM / ix35 (2009–2015)", "Tucson III TL (2015–2020)", "Tucson IV NX4 (2021–)"], "model_family");
  }

  if (/^santa-fe-modelli-2000-2012(?:-|$)/i.test(slug)) {
    return makeModelHint(null, ["Santa Fe I SM (2000–2006)", "Santa Fe II CM (2006–2012)"], "model_family");
  }
  if (/^santa-fe-2012(?:-|$)/i.test(slug)) return makeModelHint("Santa Fe III DM (2012–2018)");
  if (/^santa-fe-2018-2024(?:-|$)/i.test(slug)) return makeModelHint("Santa Fe IV TM (2018–2024)");
  if (/^santa-fe-2024-oggi(?:-|$)/i.test(slug)) return makeModelHint("Santa Fe V MX5 (2024–)");
  if (/^santa-fe(?:-|$)/i.test(slug)) {
    return makeModelHint(null, [
      "Santa Fe I SM (2000–2006)",
      "Santa Fe II CM (2006–2012)",
      "Santa Fe III DM (2012–2018)",
      "Santa Fe IV TM (2018–2024)",
      "Santa Fe V MX5 (2024–)",
    ], "model_family");
  }

  const best = bestHyundaiModelMatch(text);
  if (best && best.score >= 0.30) return makeModelHint(best.it.label);

  return { keep: false, forum_type: "unknown", resolved_model: null, candidate_models: [], note: "" };
}

function extractHyundaiForumEntriesFromHtml(rootHtml, rootUrl) {
  return uniqByKey(
    extractAllAnchors(rootHtml, rootUrl)
      .filter(anchor => safeHostnameFromUrl(anchor.url) === safeHostnameFromUrl(rootUrl))
      .filter(anchor => isHyundaiForumUrl(anchor.url))
      .filter(anchor => !isHyundaiRootUrl(anchor.url))
      .filter(anchor => anchor.text && anchor.text.length >= 2)
      .map(anchor => ({
        forum_url: canonicalHyundaiForumUrl(anchor.url),
        forum_title: anchor.text,
      })),
    entry => entry.forum_url
  );
}

function inferHyundaiForumInventory({ rootUrl, rootHtml }) {
  return extractHyundaiForumEntriesFromHtml(rootHtml, rootUrl).map((entry) => {
    const decision = classifyHyundaiForumEntry({
      url: entry.forum_url,
      title: entry.forum_title,
    });
    return {
      ...entry,
      ...decision,
    };
  });
}

function looksLikeProblemTopicTitle(title) {
  return TOPIC_SIGNAL_PATTERNS.some(pattern => pattern.test(title));
}

function looksLikeUsefulHyundaiTopicTitle(title, { signalsOnly = false } = {}) {
  const raw = htmlToText((title ?? "").toString()).replace(/\s+/g, " ").trim();
  if (!raw || raw.length < 4) return false;
  if (TOPIC_BLACKLIST.some(pattern => pattern.test(raw))) return false;
  if (TOPIC_NOISE_PATTERNS.some(pattern => pattern.test(raw))) return false;
  if (signalsOnly) return looksLikeProblemTopicTitle(raw);
  return true;
}

function classifyHyundaiTopicEntry({ title = "", postCount = 0, minPosts = 2, signalsOnly = false }) {
  const cleanTitle = htmlToText(title).replace(/\s+/g, " ").trim();
  if (!cleanTitle) return { keep: false, reason: "empty_title", title: cleanTitle, postCount };
  if (postCount < minPosts) return { keep: false, reason: "low_post_count", title: cleanTitle, postCount };
  if (!looksLikeUsefulHyundaiTopicTitle(cleanTitle, { signalsOnly })) {
    return { keep: false, reason: signalsOnly ? "missing_fault_signal" : "title_noise", title: cleanTitle, postCount };
  }
  return { keep: true, reason: "ok", title: cleanTitle, postCount };
}

function extractRawHyundaiTopicEntriesFromForumPage(html, listingUrl) {
  const out = [];
  const itemRegex = /<div class="structItem structItem--thread\b[\s\S]*?(?=<div class="structItem structItem--thread\b|$)/gi;
  for (const match of (html ?? "").toString().matchAll(itemRegex)) {
    const block = match[0] ?? "";
    const urlMatch = block.match(/<div class="structItem-title">[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!urlMatch) continue;
    const url = toAbsoluteUrl(urlMatch[1], listingUrl);
    if (!url || !isHyundaiThreadUrl(url)) continue;
    const title = htmlToText(urlMatch[2] ?? "").replace(/\s+/g, " ").trim();
    if (!title) continue;
    const replyMatch = block.match(/<dt>\s*Risposte\s*<\/dt>\s*<dd>(\d+)<\/dd>/i)
      ?? block.match(/<dt>\s*Replies\s*<\/dt>\s*<dd>(\d+)<\/dd>/i);
    const postCount = Number(replyMatch?.[1] ?? "0") || 0;
    out.push({
      url: canonicalHyundaiThreadUrl(url),
      title,
      postCount,
    });
  }
  return uniqByKey(out, item => item.url);
}

function extractHyundaiTopicEntriesFromForumPage(html, listingUrl, options = {}) {
  return extractRawHyundaiTopicEntriesFromForumPage(html, listingUrl).map((item) => ({
    ...item,
    ...classifyHyundaiTopicEntry({
      title: item.title,
      postCount: item.postCount,
      minPosts: options.minPosts ?? 2,
      signalsOnly: options.signalsOnly ?? false,
    }),
  }));
}

function discoverHyundaiListingPageUrls(firstHtml, baseUrl, maxPages) {
  const canonicalBase = canonicalHyundaiForumUrl(baseUrl);
  const anchors = extractAllAnchors(firstHtml, baseUrl)
    .map(anchor => anchor.url)
    .filter(url => canonicalHyundaiForumUrl(url) === canonicalBase || url.startsWith(`${canonicalBase}page-`));
  return uniqPreserveOrder(
    [canonicalBase, ...anchors]
      .sort((a, b) => getHyundaiPageOrderFromUrl(a) - getHyundaiPageOrderFromUrl(b))
      .slice(0, Math.max(1, maxPages))
  );
}

function discoverHyundaiTopicPageUrls(firstHtml, topicUrl, maxPages) {
  const canonicalBase = canonicalHyundaiThreadUrl(topicUrl);
  const anchors = extractAllAnchors(firstHtml, topicUrl)
    .map(anchor => anchor.url)
    .filter(url => canonicalHyundaiThreadUrl(url) === canonicalBase || url.startsWith(`${canonicalBase}page-`));
  return uniqPreserveOrder(
    [canonicalBase, ...anchors]
      .sort((a, b) => getHyundaiPageOrderFromUrl(a) - getHyundaiPageOrderFromUrl(b))
      .slice(0, Math.max(1, maxPages))
  );
}

function sanitizeHyundaiPostText(text) {
  return htmlToText((text ?? "").toString())
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractPostsFromHyundaiThreadHtml(html, pageNumber = 1) {
  const prepared = (html ?? "")
    .toString()
    .replace(/<blockquote\b[\s\S]*?<\/blockquote>/gi, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ");

  const chunks = prepared.split(/<article class="message message--post\b/gi).slice(1);
  const posts = [];

  for (const chunk of chunks) {
    const block = `<article class="message message--post${chunk}`;
    const author = htmlToText((block.match(/data-author="([^"]+)"/i)?.[1] ?? "")).trim();
    const postId = (block.match(/data-content="post-(\d+)"/i)?.[1] ?? "").trim();
    const when = (block.match(/<time[^>]*datetime="([^"]+)"/i)?.[1] ?? "").trim();
    const bodyHtml =
      block.match(/<div class="bbWrapper">([\s\S]*?)<\/div>\s*(?=<div class="js-selectToQuoteEnd"|<\/article>)/i)?.[1]
      ?? block.match(/<div class="bbWrapper">([\s\S]*?)<\/div>/i)?.[1]
      ?? "";
    const text = sanitizeHyundaiPostText(bodyHtml);
    if (!author || text.length < 10) continue;
    posts.push({ author, when, postId, pageNumber, text });
  }

  return posts;
}

async function fetchHyundaiThreadAsText({ url, pages = 999, cookie = "", forumTitle = "" }) {
  const firstHtml = await fetchUrl(url, cookie);
  const title = extractTitleFromHtml(firstHtml);
  const pageUrls = discoverHyundaiTopicPageUrls(firstHtml, url, pages);
  const posts = [];

  for (let i = 0; i < pageUrls.length; i++) {
    const pageUrl = pageUrls[i];
    const html = i === 0 ? firstHtml : await fetchUrl(pageUrl, cookie);
    posts.push(...extractPostsFromHyundaiThreadHtml(html, i + 1));
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

function pickBestHyundaiCandidate(candidates, rawText) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const explicitYears = extractExplicitYears(rawText);
  if (explicitYears.length > 0) {
    const yearCandidates = candidates.filter((label) => {
      const range = parseHyundaiLabelYearRange(label);
      return range && explicitYears.some(year => year >= range.start && year <= range.end);
    });
    if (yearCandidates.length === 1) return yearCandidates[0];
    if (yearCandidates.length > 1) {
      const best = bestByScore(yearCandidates, label => scoreModelLabel(label, rawText));
      if (best && best.score >= 0.12) return best.it;
    }
  }

  return pickHyundaiModelLabel(rawText, candidates);
}

function resolveHyundaiVehicleModel({
  modelRaw = "",
  threadTitle = "",
  parentForumTitle = "",
  subforumTitle = "",
  subforumUrl = "",
}) {
  const combined = normalizeHyundaiForumMatchText([modelRaw, threadTitle, subforumTitle, parentForumTitle].filter(Boolean).join(" | "));

  if (/coupe\s+rd\b/i.test(combined) || /^coupe-rd-gk(?:-|$)/i.test(slugFromForumUrl(subforumUrl))) {
    if (!/\bgk\b|\btuscani\b/i.test(combined)) return null;
  }

  const subforumHint = classifyHyundaiForumEntry({ url: subforumUrl, title: subforumTitle || parentForumTitle });
  if (subforumHint.keep && subforumHint.forum_type === "model" && subforumHint.resolved_model) {
    return subforumHint.resolved_model;
  }
  if (subforumHint.keep && subforumHint.forum_type === "model_family" && subforumHint.candidate_models.length > 0) {
    const familyChoice = pickBestHyundaiCandidate(subforumHint.candidate_models, combined);
    if (familyChoice) return familyChoice;
  }

  const exactAlias = pickHyundaiModelLabelByExplicitAlias(combined);
  if (exactAlias) return exactAlias;

  const best = bestHyundaiModelMatch(combined);
  if (best && best.score >= 0.30) return best.it.label;

  return null;
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

      const reviewId = computeHyundaiReviewId({
        forum: args.forum,
        sourceUrl,
        threadTitle: normalizedThreadTitle,
        stage,
      });
      await writeJsonFileUnique(outReview, reviewId, { review_id: reviewId, ...payload });
      return true;
    };

    const classifierPrompt = [
      "You are an automotive forum thread classifier for Hyundai seed data quality control.",
      "Return ONLY one JSON object, no other text.",
      "",
      "Rules:",
      "- Do not guess or infer missing facts.",
      "- Approve the thread if it contains at least one extractable resolved automotive case.",
      "- A valid case means one forum user explicitly describes their own Hyundai fault/symptoms and later confirms the successful repair for that same case.",
      "- The confirming user does NOT need to be the original thread author.",
      "- Ignore unresolved side discussions, guesses, or advice-only replies if at least one valid case exists.",
      "- A thread may contain multiple independent resolved cases from different users. That is allowed.",
      "- Forum context may contain the model or generation. You may use that context, but only when explicit.",
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
        const kept = await writeReview("classifier", classifier.reason || "Thread looks like a real diagnostic case but did not pass READY gate.", { classifier });
        return { ready: 0, review: kept ? 1 : 0, discarded: kept ? 0 : 1 };
      }
      await logDiscard("classifier", classifier.reason || "Thread did not pass strict seed gate.", { classifier });
      return { ready: 0, review: 0, discarded: 1 };
    }

    const extractorPrompt = [
      "You extract one or more high-confidence resolved Hyundai automotive diagnostic cases from a forum thread.",
      "Return ONLY a JSON array, no other text.",
      "",
      "Rules:",
      "- Do not guess or infer missing facts.",
      "- Each case must belong to one forum user: the same user must explicitly describe the fault/symptoms and later confirm the successful repair for that same case.",
      "- The case author does NOT need to be the original thread author.",
      "- A thread may contain multiple independent resolved cases from different users. Return all qualifying cases.",
      "- Ignore advice-only replies, guesses, or cases where another user suggests a fix but the reporting user never confirms it.",
      "- Use forum context if it explicitly identifies the Hyundai model or generation.",
      "- If any required field is ambiguous for one case, omit that case but continue extracting other clear cases.",
      "- If there are no clear cases, return [].",
      "- Translate symptoms, description, and resolution to English.",
      "- If mileage is explicitly mentioned, extract it as an integer number of kilometers.",
      "- Normalize OBD codes to uppercase format like P0401. If none are present, use [].",
      "",
      "Output schema:",
      '[{"case_author":"","fault_post_numbers":[],"resolution_post_numbers":[],"brand_raw":"Hyundai","model_raw":"","engine_raw":"","engine_code_raw":"","mileage":null,"symptoms":[],"obd_codes":[],"description":"","resolution":"","closed_at":""}]',
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
        const kept = await writeReview("record", authorValidation.reason || "Author validation failed.", { classifier, extracted_raw: item ?? null });
        if (kept) reviewCount++;
        else discardedCount++;
        continue;
      }

      const normalizedItem = { ...(item ?? {}), case_author: authorValidation.caseAuthor ?? (item?.case_author ?? "") };
      if (extractedCaseUsesUnresolvedResolutionPost(normalizedItem, postTextByNumber)) {
        const kept = await writeReview("record", "Resolution post still uses future/uncertain language in the source thread.", { classifier, extracted_raw: normalizedItem ?? null });
        if (kept) reviewCount++;
        else discardedCount++;
        continue;
      }

      const vehicle_brand = "Hyundai";
      const vehicle_model = resolveHyundaiVehicleModel({
        modelRaw: normalizedItem?.model_raw ?? "",
        threadTitle: normalizedThreadTitle,
        parentForumTitle,
        subforumTitle,
        subforumUrl,
      }) ?? null;
      const engine_power = vehicle_model
        ? pickEnginePower(
            HYUNDAI_ENTRY,
            vehicle_model,
            [
              normalizedItem?.engine_raw ?? "",
              normalizedItem?.engine_code_raw ?? "",
              normalizedThreadTitle,
              subforumTitle,
              parentForumTitle,
            ].filter(Boolean).join(" | ")
          )
        : null;

      const canonical = { vehicle_brand, vehicle_model, engine_power };
      const local_id = computeLocalId({ forum: args.forum, sourceUrl, item: normalizedItem, canonical });

      let description = (normalizedItem?.description ?? "").toString();
      const engineCodeRaw = (normalizedItem?.engine_code_raw ?? "").toString().trim();
      if (engineCodeRaw && !normalizeText(description).includes(normalizeText(engineCodeRaw))) {
        description = description.trim() ? `${description.trim()} Engine code: ${engineCodeRaw}.` : `Engine code: ${engineCodeRaw}.`;
      }

      const record = {
        local_id,
        user_id: args.userId,
        vehicle_brand,
        vehicle_model,
        mileage: typeof normalizedItem?.mileage === "number" ? Math.trunc(normalizedItem.mileage) : null,
        engine_power,
        symptoms: canonicalizeSymptoms(normalizedItem?.symptoms),
        obd_codes: ensureArrayOfStrings(normalizedItem?.obd_codes).map(code => code.toUpperCase()),
        description,
        resolution: (normalizedItem?.resolution ?? "").toString(),
        closed_at: toIsoOrNow(normalizedItem?.closed_at),
        thread_url: sourceUrl || null,
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

async function discoverHyundaiForums({ input, cookie = "" }) {
  if (isHyundaiRootUrl(input)) {
    const rootHtml = await fetchUrl(input, cookie);
    return {
      inventory: inferHyundaiForumInventory({ rootUrl: input, rootHtml }),
    };
  }

  if (isHyundaiForumUrl(input)) {
    const forumHtml = await fetchUrl(input, cookie);
    const title = extractTitleFromHtml(forumHtml);
    return {
      inventory: [{
        forum_url: canonicalHyundaiForumUrl(input),
        forum_title: title,
        ...classifyHyundaiForumEntry({ url: input, title }),
      }],
    };
  }

  throw new Error(`Unsupported Hyundai input: ${input}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!Array.isArray(args.inputs) || args.inputs.length === 0 || !args.outDir) usage(1);
  if (!args.cookie) args.cookie = process.env.FORUM_COOKIE ?? "";

  const outReady = path.join(args.outDir, "ready");
  const outReview = path.join(args.outDir, "to_review");
  const discardedPath = path.join(args.outDir, "discarded.jsonl");
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

  let totalFound = 0;
  let totalKept = 0;
  let totalDropped = 0;
  let totalReady = 0;
  let totalReview = 0;
  let totalDiscarded = 0;
  let totalProcessedThreads = 0;
  let totalThreadErrors = 0;
  const inventoryAll = [];

  if (args.discoverOnly) {
    for (let inputIndex = 0; inputIndex < args.inputs.length; inputIndex++) {
      const input = args.inputs[inputIndex];
      logProgress(`Input ${inputIndex + 1}/${args.inputs.length} start: ${input}`);
      const inputStem = makeInputStem(input);
      const allPath = path.join(args.outDir, `discovered_threads_all_${inputStem}.jsonl`);
      const keptPath = path.join(args.outDir, `discovered_threads_kept_${inputStem}.jsonl`);

      const { inventory } = await discoverHyundaiForums({ input, cookie: args.cookie });
      inventoryAll.push(...inventory);
      const keptForums = inventory.filter(item => item.keep);
      logProgress(`Root discovery found ${inventory.length} category link(s), keeping ${keptForums.length}.`);

      for (const forum of keptForums) {
        const firstHtml = await fetchUrl(forum.forum_url, args.cookie);
        const pageUrls = discoverHyundaiListingPageUrls(firstHtml, forum.forum_url, args.indexPages);
        for (let pageIndex = 0; pageIndex < pageUrls.length; pageIndex++) {
          const pageUrl = pageUrls[pageIndex];
          const html = pageIndex === 0 ? firstHtml : await fetchUrl(pageUrl, args.cookie);
          const entries = extractHyundaiTopicEntriesFromForumPage(html, forum.forum_url, {
            minPosts: args.minPosts,
            signalsOnly: args.signalsOnly,
          }).map((entry) => ({
            ...entry,
            parent_forum_title: forum.forum_title,
            subforum_url: forum.forum_url,
            resolved_model: forum.resolved_model ?? null,
            candidate_models: forum.candidate_models ?? [],
          }));

          for (const entry of entries) {
            await appendJsonLine(allPath, entry);
            totalFound++;
            if (entry.keep) {
              await appendJsonLine(keptPath, entry);
              totalKept++;
            } else {
              totalDropped++;
            }
          }
          if (args.sleepMs > 0) await sleep(args.sleepMs);
        }
      }
    }

    await fs.writeFile(path.join(args.outDir, "forum_inventory.json"), JSON.stringify(inventoryAll, null, 2), "utf8");
    console.log(`Discovery complete. Found ${totalFound} thread title(s), kept ${totalKept} and dropped ${totalDropped} into: ${args.outDir}`);
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error("Missing DEEPSEEK_API_KEY (or use --dry).");
    process.exit(2);
  }

  const processOneThread = await processThreadFactory({ args, apiKey, outReady, outReview, discardedPath });

  for (let inputIndex = 0; inputIndex < args.inputs.length; inputIndex++) {
    const input = args.inputs[inputIndex];
    logProgress(`Input ${inputIndex + 1}/${args.inputs.length} start: ${input}`);

    if (isHyundaiThreadUrl(input)) {
      const raw = await fetchHyundaiThreadAsText({ url: input, pages: args.pages, cookie: args.cookie });
      const res = await processOneThread({ threadUrl: input, threadTextRaw: raw });
      totalReady += res.ready;
      totalReview += res.review;
      totalDiscarded += res.discarded;
      totalProcessedThreads++;
      continue;
    }

    const inputStem = makeInputStem(input);
    const discoveredAllPath = path.join(args.outDir, `discovered_threads_all_${inputStem}.jsonl`);
    const discoveredKeptPath = path.join(args.outDir, `discovered_threads_kept_${inputStem}.jsonl`);
    const donePath = path.join(args.outDir, `done_threads_${inputStem}.txt`);
    const errPath = path.join(args.outDir, `errors_${inputStem}.txt`);

    let doneSet = new Set();
    try {
      const doneText = await fs.readFile(donePath, "utf8");
      doneSet = new Set(doneText.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
    } catch {}

    const { inventory } = await discoverHyundaiForums({ input, cookie: args.cookie });
    inventoryAll.push(...inventory);
    const keptForums = inventory.filter(item => item.keep);
    logProgress(`Root discovery found ${inventory.length} category link(s), keeping ${keptForums.length}.`);

    const discoveredThreads = [];
    for (const forum of keptForums) {
      const firstHtml = await fetchUrl(forum.forum_url, args.cookie);
      const pageUrls = discoverHyundaiListingPageUrls(firstHtml, forum.forum_url, args.indexPages);
      for (let pageIndex = 0; pageIndex < pageUrls.length; pageIndex++) {
        const pageUrl = pageUrls[pageIndex];
        const html = pageIndex === 0 ? firstHtml : await fetchUrl(pageUrl, args.cookie);
        const entries = extractHyundaiTopicEntriesFromForumPage(html, forum.forum_url, {
          minPosts: args.minPosts,
          signalsOnly: args.signalsOnly,
        }).map((entry) => ({
          ...entry,
          parentForumTitle: forum.forum_title,
          subforumTitle: forum.forum_title,
          subforumName: forum.resolved_model ?? forum.forum_title,
          subforumUrl: forum.forum_url,
          resolved_model: forum.resolved_model ?? null,
          candidate_models: forum.candidate_models ?? [],
        }));

        for (const entry of entries) {
          await appendJsonLine(discoveredAllPath, entry);
          totalFound++;
          if (entry.keep) {
            await appendJsonLine(discoveredKeptPath, entry);
            totalKept++;
            discoveredThreads.push(entry);
          } else {
            totalDropped++;
          }
        }

        if (args.sleepMs > 0) await sleep(args.sleepMs);
      }
    }

    const uniqueThreads = uniqByKey(discoveredThreads, thread => thread.url);
    const toProcess = uniqueThreads.filter(thread => !doneSet.has(thread.url)).slice(0, args.maxThreads);

    logProgress(`Discovered ${uniqueThreads.length} kept thread(s), processing ${toProcess.length}.`);

    for (let threadIndex = 0; threadIndex < toProcess.length; threadIndex++) {
      const thread = toProcess[threadIndex];
      try {
        logProgress(`Thread ${threadIndex + 1}/${toProcess.length}: ${thread.title || thread.url}`);
        const raw = await fetchHyundaiThreadAsText({
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
        totalThreadErrors++;
        await fs.appendFile(errPath, `[${new Date().toISOString()}] ${thread.url}\n${error?.stack || String(error)}\n\n`, "utf8");
      }
      if (args.sleepMs > 0) await sleep(args.sleepMs);
    }
  }

  await fs.writeFile(path.join(args.outDir, "forum_inventory.json"), JSON.stringify(inventoryAll, null, 2), "utf8");

  if (args.keepReview) {
    console.log(`Processed ${totalProcessedThreads} thread(s). Wrote ${totalReady} ready record(s), ${totalReview} review item(s), discarded ${totalDiscarded} item(s) and hit ${totalThreadErrors} thread error(s) into: ${args.outDir}`);
  } else {
    console.log(`Processed ${totalProcessedThreads} thread(s). Wrote ${totalReady} ready record(s), discarded ${totalDiscarded} item(s) and hit ${totalThreadErrors} thread error(s) into: ${args.outDir}`);
  }
}

const entryArg = process.argv[1];
const isDirectRun = entryArg ? import.meta.url === pathToFileURL(path.resolve(entryArg)).href : false;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}

export {
  classifyHyundaiTopicEntry,
  extractHyundaiForumEntriesFromHtml,
  extractHyundaiTopicEntriesFromForumPage,
  extractPostsFromHyundaiThreadHtml,
  inferHyundaiForumInventory,
  looksLikeUsefulHyundaiTopicTitle,
  parseArgs,
  resolveHyundaiVehicleModel,
};
