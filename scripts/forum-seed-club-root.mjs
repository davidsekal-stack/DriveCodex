#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

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
import { deepseekChatJson, OFFLINE_DEEPSEEK_MODEL } from "./agent/deepseek.mjs";

const COMMON_TOPIC_BLACKLIST = [
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

const COMMON_TITLE_NOISE_PATTERNS = [
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

const COMMON_SIGNAL_PATTERNS = [
  /\b[pbcu]\d{4}\b/i,
  /\b(nejde|nestart|zhas(i|í|n)|skub|cuk|klep|hluk|hu[cč]i|p[ií]sk|nouz|probl[eé]m|z[aá]vada|chyba|kontrolka|olej|tlak|netop[ií]|sahara|termostat|ventil[aá]tor|spojka|brzd|airbag|abs|esp|emise|fap|dpf|egr|turbo|[uú]nik|cidlo|čidlo|senzor|elektrika|vstrik|vstřik|převodovka|prevodovka|servo|altern[aá]tor|baterie|klima|vibrac|kou[rř]|smrd[ií])\b/i,
  /\b(problem|fault|issue|error|warning|leak|noise|knock|rattle|whine|squeak|vibration|misfire|jerk|judder|limp|overheat|overheating|won['’]t start|doesn['’]t start|stall|stalls|smoke|smell|oil|coolant|brake|airbag|abs|esp|fap|dpf|egr|turbo|sensor|injector|battery|alternator|gearbox|transmission|clutch|steering|ac|climate|thermostat|fan)\b/i,
  /\b\d{2,3}\s*kw\b/i,
];

const DEFAULT_MODEL = OFFLINE_DEEPSEEK_MODEL;
const DEFAULT_MIN_POSTS = 2;

function usageText(brand, rootUrl) {
  return `
Usage:
  node scripts/forum-seed-${normalizeText(brand)}.mjs <out_dir> [options]
  node scripts/forum-seed-${normalizeText(brand)}.mjs <${rootUrl}> <out_dir> [options]
  node scripts/forum-seed-${normalizeText(brand)}.mjs <${rootUrl.replace(/\/forum\/?$/i, "/forum-kategorie/...")}> <out_dir> [options]
  node scripts/forum-seed-${normalizeText(brand)}.mjs <${rootUrl.replace(/\/forum\/?$/i, "/forum-tema/...")}> <out_dir> [options]

Options:
  --discover-only  Only gather forum inventory and filtered thread titles
  --keep-review    Store borderline but promising cases into to_review/
  --signals-only   Process only signal-strong titles during the first crawl pass
  --min-posts N    Ignore topic titles with fewer than N posts on the listing page
`.trim();
}

function clampInt(raw, min, max, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : fallback;
}

function logProgress(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
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

function isTopicUrl(url) {
  return /\/forum-(tema|topic)\//i.test((url ?? "").toString());
}

function isCategoryUrl(url) {
  return /\/forum-(kategorie|category)\//i.test((url ?? "").toString());
}

function isRootForumUrl(url) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/\/+$/g, "").toLowerCase();
    return pathname === "/forum";
  } catch {
    return false;
  }
}

function canonicalTopicUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:") parsed.protocol = "https:";
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return (url ?? "").toString();
  }
}

function canonicalListingUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:") parsed.protocol = "https:";
    const keep = parsed.searchParams.get("kols");
    parsed.search = "";
    if (keep && Number(keep) > 1) parsed.searchParams.set("kols", String(Number(keep)));
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return (url ?? "").toString();
  }
}

function getPageOrderFromUrl(url) {
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

function extractRelNextUrl(html, baseUrl, pageKind = "listing") {
  const accepts = pageKind === "topic" ? isTopicUrl : isCategoryUrl;
  const match = (html ?? "").toString().match(/<link\b[^>]*rel=(["'])next\1[^>]*href=(["'])(.*?)\2/i);
  if (match?.[3]) {
    const resolved = resolveUrl(baseUrl, match[3]);
    if (accepts(resolved)) return resolved;
  }

  const anchors = extractAllAnchors(html, baseUrl)
    .filter(anchor => accepts(anchor.url))
    .filter(anchor => anchor.url.includes("kols="));
  const next = bestByScore(anchors, anchor => {
    const current = getPageOrderFromUrl(baseUrl);
    const page = getPageOrderFromUrl(anchor.url);
    return page > current ? 1 / page : -1;
  });
  return next && getPageOrderFromUrl(next.it.url) > getPageOrderFromUrl(baseUrl) ? next.it.url : "";
}

function isTimestampLine(line) {
  return /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test((line ?? "").toString().trim());
}

function normalizeAuthor(line) {
  return (line ?? "")
    .toString()
    .replace(/\bImage\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNoiseLine(line) {
  const text = normalizeText(line);
  if (!text) return true;
  return /^(reply|odpovedet|odpovědět|forum|fórum|manuals|manualy|manuály|advert|inzerce|model|new topic|nove tema|nové téma|on-line|online)$/i.test(text);
}

function sanitizePostText(lines) {
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

function parseLabelYearRange(label) {
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

function escapeRegExp(value) {
  return (value ?? "").toString().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

export function createClubCrawler(config) {
  const brand = config.brand;
  const rootUrl = config.rootUrl;
  const defaultInputs = [...(config.defaultInputs ?? [rootUrl])];
  const defaultForum = config.forum ?? `${normalizeText(brand)}_club`;
  const defaultUserId = config.userId ?? "ai_importer";
  const defaultMinPosts = config.minPosts ?? DEFAULT_MIN_POSTS;
  const minModelStartYear = config.minModelStartYear ?? 2000;
  const rootHintNote = config.rootHintNote ?? "Root forum discovery input.";

  const { catalog: euCatalog } = selectCatalogForMarket("eu");
  const brandEntry = euCatalog.find(entry => normalizeText(entry.brand) === normalizeText(brand));
  if (!brandEntry) {
    throw new Error(`${brand} brand entry was not found in web/src/constants/catalog.js`);
  }

  const topicBlacklist = [...COMMON_TOPIC_BLACKLIST, ...(config.topicBlacklist ?? [])];
  const titleNoisePatterns = [...COMMON_TITLE_NOISE_PATTERNS, ...(config.titleNoisePatterns ?? [])];
  const topicSignalPatterns = [...COMMON_SIGNAL_PATTERNS, ...(config.signalPatterns ?? [])];
  const modelAliasByLabel = config.modelAliasByLabel ?? new Map();
  const forumHints = config.forumHints ?? new Map();
  const filterRootCategory = typeof config.filterRootCategory === "function" ? config.filterRootCategory : null;
  const replacements = config.normalizeReplacements ?? [];

  function usage(exitCode = 1) {
    console.log(usageText(brand, rootUrl));
    process.exit(exitCode);
  }

  return {
    brand,
    rootUrl,
    defaultInputs,
    defaultForum,
    defaultUserId,
    defaultMinPosts,
    minModelStartYear,
    rootHintNote,
    brandEntry,
    topicBlacklist,
    titleNoisePatterns,
    topicSignalPatterns,
    modelAliasByLabel,
    forumHints,
    filterRootCategory,
    replacements,
    usage,
  };
}

export function buildClubCrawlerApi(config) {
  const state = createClubCrawler(config);
  const {
    brand,
    rootUrl,
    defaultInputs,
    defaultForum,
    defaultUserId,
    defaultMinPosts,
    minModelStartYear,
    rootHintNote,
    brandEntry,
    topicBlacklist,
    titleNoisePatterns,
    topicSignalPatterns,
    modelAliasByLabel,
    forumHints,
    filterRootCategory,
    replacements,
    usage,
  } = state;

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

  function parseArgs(argv) {
    const args = {
      inputs: [],
      outDir: null,
      forum: defaultForum,
      userId: defaultUserId,
      sourceUrl: "",
      model: DEFAULT_MODEL,
      maxChars: 60000,
      pages: 999,
      indexPages: 25,
      maxThreads: 20000,
      minPosts: defaultMinPosts,
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
      args.inputs = [...defaultInputs];
      args.outDir = positional[0] ?? null;
    } else if (positional.length >= 2) {
      args.inputs = positional.slice(0, -1);
      args.outDir = positional[positional.length - 1] ?? null;
    }

    return args;
  }

  function defaultHeaders() {
    return {
      "User-Agent": `Mozilla/5.0 (compatible; DriveCodex${brand.replace(/[^a-z0-9]+/gi, "")}Seed/1.0; +https://example.invalid)`,
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

  function normalizeForumMatchText(value) {
    let text = (value ?? "").toString();
    for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);
    return normalizeText(text);
  }

  function normalizeLabelText(label) {
    return normalizeForumMatchText(
      (label ?? "")
        .toString()
        .replace(/\(\d{4}[–-](\d{4}|dosud|sou[čc]asnost)\)/gi, " ")
    );
  }

  function getModelAliasTexts(label) {
    const base = (label ?? "")
      .toString()
      .replace(/\(\d{4}[–-](\d{4}|dosud|sou[čc]asnost)\)/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return [...new Set([label, base, ...(modelAliasByLabel.get(label) ?? [])].filter(Boolean))];
  }

  function scoreModelLabel(label, query) {
    const normalizedLabel = normalizeLabelText(label);
    const normalizedQuery = normalizeForumMatchText(query);
    if (!normalizedLabel || !normalizedQuery) return 0;

    const direct = tokenOverlapScore(normalizedLabel, normalizedQuery) + (normalizedQuery.includes(normalizedLabel) ? 0.35 : 0);
    const aliasScores = getModelAliasTexts(label)
      .map(alias => normalizeForumMatchText(alias))
      .filter(Boolean)
      .map(alias => tokenOverlapScore(alias, normalizedQuery) + (normalizedQuery.includes(alias) ? 0.35 : 0));
    return Math.max(direct, 0, ...aliasScores);
  }

  function restrictCandidates(models, rawText) {
    if (typeof config.restrictCandidates === "function") {
      return config.restrictCandidates({ models, rawText, normalizeForumMatchText });
    }
    return models;
  }

  function pickModelLabelByExplicitAlias(rawText) {
    const normalized = normalizeForumMatchText(rawText);
    if (!normalized?.trim()) return null;

    const models = (brandEntry.models ?? []).filter(model => model?.label);
    const matches = [];
    for (const model of models) {
      for (const alias of getModelAliasTexts(model.label).map(normalizeForumMatchText).filter(Boolean)) {
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

  function pickCandidateLabelByExplicitAlias(candidateLabels, rawText) {
    const normalized = normalizeForumMatchText(rawText);
    if (!normalized?.trim() || !Array.isArray(candidateLabels) || candidateLabels.length === 0) return null;

    const matches = [];
    for (const label of candidateLabels.filter(Boolean)) {
      for (const alias of getModelAliasTexts(label).map(normalizeForumMatchText).filter(Boolean)) {
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

  function pickModelLabel(rawText) {
    const normalized = normalizeForumMatchText(rawText);
    if (!normalized?.trim()) return null;

    const explicitAliasLabel = pickModelLabelByExplicitAlias(normalized);
    if (explicitAliasLabel) return explicitAliasLabel;

    const models = restrictCandidates((brandEntry.models ?? []).filter(model => model?.label), normalized);
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
      const range = parseLabelYearRange(label);
      return range && explicitYears.some(year => year >= range.start && year <= range.end);
    });

    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      const best = bestByScore(matches, label => scoreModelLabel(label, combined));
      return best && best.score >= 0.15 ? best.it : null;
    }
    return null;
  }

  function isEligibleModelLabel(label) {
    if (!label) return false;
    const range = parseLabelYearRange(label);
    return !range || range.start >= minModelStartYear;
  }

  function resolveVehicleModel({ modelRaw = "", threadTitle = "", parentForumTitle = "", subforumUrl = "" }) {
    const forumHint = forumHints.get(getCategorySlug(subforumUrl)) ?? null;
    const combined = normalizeForumMatchText([modelRaw, threadTitle, parentForumTitle].filter(Boolean).join(" | "));
    const explicitYears = extractExplicitYears(combined);
    const familyContext = normalizeForumMatchText([modelRaw, threadTitle].filter(Boolean).join(" | ")) || combined;
    const models = restrictCandidates((brandEntry.models ?? []).filter(model => model?.label), familyContext);

    if (forumHint?.forum_type === "unknown") return null;

    if (forumHint?.resolved_model && forumHint.forum_type === "model") return forumHint.resolved_model;

    if (forumHint?.forum_type === "model_family") {
      const yearMatch = resolveFamilyModelFromYears(forumHint.candidate_models, explicitYears, combined);
      if (yearMatch) return yearMatch;
      const explicitAliasMatch = pickCandidateLabelByExplicitAlias(forumHint.candidate_models, combined);
      if (explicitAliasMatch) return explicitAliasMatch;
      return null;
    }

    if (forumHint?.forum_type === "shared") {
      if (forumHint.resolved_model && forumHint.candidate_models.length <= 1) return forumHint.resolved_model;
      if (forumHint.candidate_models.length > 1) {
        const yearMatch = resolveFamilyModelFromYears(forumHint.candidate_models, explicitYears, combined);
        if (yearMatch) return yearMatch;
        const explicitAliasMatch = pickCandidateLabelByExplicitAlias(forumHint.candidate_models, combined);
        if (explicitAliasMatch) return explicitAliasMatch;
        const filtered = restrictCandidates(forumHint.candidate_models.map(label => ({ label })), combined);
        if (filtered.length === 1) return filtered[0].label;
        return null;
      }
    }

    if (explicitYears.length > 0) {
      const yearCandidates = models.filter(model => {
        if (scoreModelLabel(model.label, combined) < 0.15) return false;
        const range = parseLabelYearRange(model.label);
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
      .map(value => normalizeForumMatchText(value))
      .filter(Boolean);

    for (const context of contexts) {
      const label = pickModelLabel(context);
      if (label) return label;
    }

    return null;
  }

  function listCatalogMatches(rawText, limit = 8) {
    const normalized = normalizeForumMatchText(rawText);
    if (!normalized) return [];
    const models = restrictCandidates((brandEntry.models ?? []).filter(model => model?.label), normalized);
    return models
      .map(model => ({ label: model.label, score: scoreModelLabel(model.label, normalized) }))
      .filter(item => item.score >= 0.16)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, limit)
      .map(item => item.label);
  }

  function normalizeForumTitle(title) {
    return (title ?? "")
      .toString()
      .replace(/\s*-\s*F[oó]rum\s*-\s*.+$/i, "")
      .replace(/\s*-\s*Forum\s*-\s*.+$/i, "")
      .trim();
  }

  function inferForumInventory({ forumUrl, forumTitle }) {
    const cleanTitle = normalizeForumTitle(forumTitle);
    const hint = forumHints.get(getCategorySlug(forumUrl)) ?? null;
    const shouldInferResolvedModel = !hint || hint.forum_type === "model";
    const resolvedModel = shouldInferResolvedModel
      ? (hint?.resolved_model ?? resolveVehicleModel({
          modelRaw: cleanTitle,
          threadTitle: cleanTitle,
          parentForumTitle: cleanTitle,
          subforumUrl: forumUrl,
        }))
      : (hint?.resolved_model ?? null);
    const candidateModels = (hint?.candidate_models ?? listCatalogMatches(cleanTitle, 12)).filter(isEligibleModelLabel);
    const keep = Boolean((resolvedModel && isEligibleModelLabel(resolvedModel)) || candidateModels.length > 0);

    return {
      forum_url: forumUrl,
      forum_title: forumTitle,
      normalized_title: cleanTitle,
      forum_type: hint?.forum_type ?? (resolvedModel ? "model" : "unknown"),
      resolved_model: resolvedModel && isEligibleModelLabel(resolvedModel) ? resolvedModel : null,
      candidate_models: candidateModels,
      note: hint?.note ?? "",
      keep,
      skip_reason: keep ? "" : "Forum title could not be safely mapped to a supported post-2000 model.",
    };
  }

  function classifyTopicEntry({ title, postCount, minPosts = defaultMinPosts }) {
    const raw = (title ?? "").toString().trim();
    const count = Number(postCount) || 0;
    if (!raw || raw.length < 4) return { keep: false, reason: "Title too short", signal: false };
    if (count < minPosts) return { keep: false, reason: `Only ${count} post(s)`, signal: false };
    if (topicBlacklist.some(pattern => pattern.test(raw))) {
      return { keep: false, reason: "Clearly non-diagnostic topic", signal: false };
    }
    if (titleNoisePatterns.some(pattern => pattern.test(raw))) {
      return { keep: false, reason: "Low-value title noise", signal: false };
    }
    return {
      keep: true,
      reason: "Passed mild prefilter",
      signal: topicSignalPatterns.some(pattern => pattern.test(raw)),
    };
  }

  function extractTopicEntriesFromForumPage(html, listingUrl, minPosts = defaultMinPosts) {
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
        .filter(item => isTopicUrl(item.url))
        .filter(item => !/[?&]select=/i.test(item.url));

      if (topicAnchors.length === 0) continue;

      const topic = topicAnchors[0];
      const canonicalUrl = canonicalTopicUrl(topic.url);
      const postCountMatch = row.match(/<td\b[^>]*align=(["'])right\1[^>]*>\s*(\d+)\s*<\/td>/i)
        || row.match(/<td\b[^>]*align=right[^>]*>\s*(\d+)\s*<\/td>/i);
      const postCount = Number(postCountMatch?.[2] ?? postCountMatch?.[1] ?? 0) || 0;
      const classification = classifyTopicEntry({ title: topic.title, postCount, minPosts });

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

  function extractPostsFromText(html, pageNumber = 1) {
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
      if (!isTimestampLine(lines[i])) continue;
      const when = lines[i];

      let author = "";
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        if (isNoiseLine(lines[j])) continue;
        author = normalizeAuthor(lines[j]);
        if (author) break;
      }
      if (!author) continue;

      const body = [];
      let k = i + 1;
      for (; k < lines.length; k++) {
        if (isTimestampLine(lines[k])) break;
        body.push(lines[k]);
      }

      const text = sanitizePostText(body);
      if (text.length >= 10) posts.push({ author, when, postId: "", pageNumber, text });
      i = k - 1;
    }

    return posts;
  }

  async function collectPages({ firstHtml, firstUrl, maxPages, cookie = "", sleepMs = 0, canonicalize, pageKind = "listing" }) {
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

  async function fetchThreadAsText({ url, pages = 999, cookie = "", forumTitle = "", sleepMs = 0 }) {
    const firstHtml = await fetchUrl(url, cookie);
    const title = extractTitleFromHtml(firstHtml);
    const pageItems = await collectPages({
      firstHtml,
      firstUrl: url,
      maxPages: pages,
      cookie,
      sleepMs,
      canonicalize: canonicalTopicUrl,
      pageKind: "topic",
    });

    const posts = [];
    for (let i = 0; i < pageItems.length; i++) posts.push(...extractPostsFromText(pageItems[i].html, i + 1));

    if (posts.length === 0) {
      return { text: htmlToText(firstHtml), title, totalPages: pageItems.length };
    }

    return {
      text: buildThreadText({ url, title, posts, forumTitle, subforumName: "", subforumTitle: "" }),
      title,
      totalPages: pageItems.length,
    };
  }

  async function discoverThreadsFromForum({ forumUrl, firstHtml = "", indexPages = 25, minPosts = defaultMinPosts, cookie = "", sleepMs = 0 }) {
    const forumHtml = firstHtml || await fetchUrl(forumUrl, cookie);
    const forumTitle = extractTitleFromHtml(forumHtml);
    const listingPages = await collectPages({
      firstHtml: forumHtml,
      firstUrl: forumUrl,
      maxPages: indexPages,
      cookie,
      sleepMs,
      canonicalize: canonicalListingUrl,
      pageKind: "listing",
    });

    const discovered = [];
    logProgress(`Listing start: ${forumTitle || forumUrl}`);
    for (let pageIndex = 0; pageIndex < listingPages.length; pageIndex++) {
      const page = listingPages[pageIndex];
      logProgress(`Listing page ${pageIndex + 1}/${listingPages.length}: ${page.url}`);
      const topics = extractTopicEntriesFromForumPage(page.html, page.url, minPosts).map(topic => ({
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

  function discoverRootCategoriesFromRoot({ rootUrl: sourceUrl, rootHtml = "" }) {
    const anchors = extractAllAnchors(rootHtml, sourceUrl)
      .filter(anchor => safeHostnameFromUrl(anchor.url) === safeHostnameFromUrl(sourceUrl))
      .filter(anchor => isCategoryUrl(anchor.url))
      .filter(anchor => !/[?&]select=/i.test(anchor.url))
      .filter(anchor => anchor.text && anchor.text.length >= 2)
      .map(anchor => ({
        forum_url: canonicalListingUrl(anchor.url),
        forum_title: anchor.text,
      }));

    return uniqByKey(anchors, item => item.forum_url)
      .map(item => ({
        ...inferForumInventory({
          forumUrl: item.forum_url,
          forumTitle: item.forum_title,
        }),
        discovered_from_root: true,
      }))
      .map(item => {
        if (!filterRootCategory) return item;
        const decision = filterRootCategory(item);
        if (!decision) return item;
        return {
          ...item,
          ...decision,
        };
      });
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
        `- Forum context (model forum title) may contain the ${brand} model or generation. You may use that context, but only when explicit.`,
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
        `- Use forum context if it explicitly identifies the ${brand} model or generation.`,
        "- If any required field is ambiguous for one case, omit that case but continue extracting other clear cases.",
        "- If there are no clear cases, return [].",
        "- Translate symptoms, description, and resolution to English.",
        "- If mileage is explicitly mentioned, extract it as an integer number of kilometers (e.g., 185000).",
        "- Normalize OBD codes to uppercase format like P0401. If none are present, use [].",
        "",
        "Output schema:",
        `[{"case_author":"","fault_post_numbers":[],"resolution_post_numbers":[],"brand_raw":"${brand}","model_raw":"","engine_raw":"","engine_code_raw":"","mileage":null,"symptoms":[],"obd_codes":[],"description":"","resolution":"","closed_at":""}]`,
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

        const vehicle_brand = brand;
        const vehicle_model = resolveVehicleModel({
          modelRaw: normalizedItem?.model_raw ?? "",
          threadTitle: normalizedThreadTitle,
          parentForumTitle,
          subforumUrl,
        }) ?? null;
        const engine_power = vehicle_model
          ? pickEnginePower(
              brandEntry,
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

  async function processCategory({
    args,
    forumUrl,
    knownForumTitle = "",
    processOneThread,
    inventoryMap,
    processedCategoryUrls,
    counters,
    outDir,
  }) {
    const canonicalForumUrl = canonicalListingUrl(forumUrl);
    if (processedCategoryUrls.has(canonicalForumUrl)) return;
    processedCategoryUrls.add(canonicalForumUrl);

    const inputStem = makeInputStem(canonicalForumUrl);
    const discoveredAllPath = path.join(outDir, `discovered_threads_all_${inputStem}.jsonl`);
    const discoveredKeptPath = path.join(outDir, `discovered_threads_kept_${inputStem}.jsonl`);
    const donePath = path.join(outDir, `done_threads_${inputStem}.txt`);
    const errPath = path.join(outDir, `errors_${inputStem}.txt`);

    let doneSet = new Set();
    if (!args.discoverOnly) {
      try {
        const doneText = await fs.readFile(donePath, "utf8");
        doneSet = new Set(doneText.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
      } catch {}
    }

    const firstHtml = await fetchUrl(canonicalForumUrl, args.cookie);
    const pageForumTitle = extractTitleFromHtml(firstHtml) || knownForumTitle || canonicalForumUrl;
    inventoryMap.set(canonicalForumUrl, inferForumInventory({
      forumUrl: canonicalForumUrl,
      forumTitle: pageForumTitle,
    }));

    const discovered = await discoverThreadsFromForum({
      forumUrl: canonicalForumUrl,
      firstHtml,
      indexPages: args.indexPages,
      minPosts: args.minPosts,
      cookie: args.cookie,
      sleepMs: args.sleepMs,
    });

    const uniqueThreads = uniqByKey(discovered.threads, thread => thread.url);
    const keptThreads = uniqueThreads.filter(thread => thread.keep);
    const droppedThreads = uniqueThreads.length - keptThreads.length;

    counters.totalDiscovered += uniqueThreads.length;
    counters.totalKept += keptThreads.length;
    counters.totalDropped += droppedThreads;

    for (const thread of uniqueThreads) await appendJsonLine(discoveredAllPath, thread);
    for (const thread of keptThreads) await appendJsonLine(discoveredKeptPath, thread);

    if (args.discoverOnly || !processOneThread) return;

    const toProcess = keptThreads
      .filter(thread => !doneSet.has(thread.url))
      .filter(thread => !args.signalsOnly || thread.signal)
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
        counters.totalReady += res.ready;
        counters.totalReview += res.review;
        counters.totalDiscarded += res.discarded;
        counters.totalProcessedThreads++;
        await fs.appendFile(donePath, `${thread.url}\n`, "utf8");
      } catch (error) {
        counters.totalThreadErrors++;
        await fs.appendFile(errPath, `[${new Date().toISOString()}] ${thread.url}\n${error?.stack || String(error)}\n\n`, "utf8");
      }
      if (args.sleepMs > 0) await sleep(args.sleepMs);
    }
  }

  async function main(argv = process.argv.slice(2)) {
    const args = parseArgs(argv);
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

    let processOneThread = null;
    if (!args.discoverOnly) {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        console.error("Missing DEEPSEEK_API_KEY (or use --discover-only / --dry).");
        process.exit(2);
      }
      processOneThread = await processThreadFactory({ args, apiKey, outReady, outReview, discardedPath });
    }

    const inventoryMap = new Map();
    const processedCategoryUrls = new Set();
    const counters = {
      totalDiscovered: 0,
      totalKept: 0,
      totalDropped: 0,
      totalReady: 0,
      totalReview: 0,
      totalDiscarded: 0,
      totalProcessedThreads: 0,
      totalThreadErrors: 0,
    };

    for (let inputIndex = 0; inputIndex < args.inputs.length; inputIndex++) {
      const input = args.inputs[inputIndex];
      logProgress(`Input ${inputIndex + 1}/${args.inputs.length} start: ${input}`);

      if (isTopicUrl(input)) {
        if (args.discoverOnly) {
          counters.totalDiscovered++;
          counters.totalKept++;
          continue;
        }
        const raw = await fetchThreadAsText({ url: input, pages: args.pages, cookie: args.cookie, sleepMs: args.sleepMs });
        const res = await processOneThread({ threadUrl: input, threadTextRaw: raw });
        counters.totalReady += res.ready;
        counters.totalReview += res.review;
        counters.totalDiscarded += res.discarded;
        counters.totalProcessedThreads++;
        continue;
      }

      if (isRootForumUrl(input)) {
        const rootHtml = await fetchUrl(input, args.cookie);
        const rootTitle = extractTitleFromHtml(rootHtml) || input;
        inventoryMap.set(canonicalListingUrl(input), {
          forum_url: canonicalListingUrl(input),
          forum_title: rootTitle,
          normalized_title: normalizeForumTitle(rootTitle),
          forum_type: "root",
          resolved_model: null,
          candidate_models: [],
          note: rootHintNote,
          keep: true,
          skip_reason: "",
        });

        const categories = discoverRootCategoriesFromRoot({ rootUrl: input, rootHtml });
        for (const category of categories) inventoryMap.set(category.forum_url, category);

        const keptCategories = categories.filter(category => category.keep);
        logProgress(`Root discovery found ${categories.length} category link(s), keeping ${keptCategories.length}.`);
        for (const category of keptCategories) {
          await processCategory({
            args,
            forumUrl: category.forum_url,
            knownForumTitle: category.forum_title,
            processOneThread,
            inventoryMap,
            processedCategoryUrls,
            counters,
            outDir: args.outDir,
          });
        }
        continue;
      }

      if (isCategoryUrl(input)) {
        await processCategory({
          args,
          forumUrl: input,
          processOneThread,
          inventoryMap,
          processedCategoryUrls,
          counters,
          outDir: args.outDir,
        });
        continue;
      }

      await appendJsonLine(discardedPath, {
        stage: "input",
        reason: `Unsupported ${brand} input URL. Expected root forum, forum category or forum topic URL.`,
        thread_url: input,
        created_at: new Date().toISOString(),
      });
      counters.totalDiscarded++;
    }

    await fs.writeFile(inventoryPath, JSON.stringify([...inventoryMap.values()], null, 2), "utf8");

    if (args.discoverOnly) {
      console.log(`Discovery complete. Found ${counters.totalDiscovered} thread title(s), kept ${counters.totalKept} and dropped ${counters.totalDropped} into: ${args.outDir}`);
      return;
    }

    if (args.keepReview) {
      console.log(`Processed ${counters.totalProcessedThreads} thread(s). Wrote ${counters.totalReady} ready record(s), ${counters.totalReview} review item(s), discarded ${counters.totalDiscarded} item(s) and hit ${counters.totalThreadErrors} thread error(s) into: ${args.outDir}`);
    } else {
      console.log(`Processed ${counters.totalProcessedThreads} thread(s). Wrote ${counters.totalReady} ready record(s), discarded ${counters.totalDiscarded} item(s) and hit ${counters.totalThreadErrors} thread error(s) into: ${args.outDir}`);
    }
  }

  return {
    main,
    parseArgs,
    isRootForumUrl,
    discoverRootCategoriesFromRoot,
    classifyTopicEntry,
    extractTopicEntriesFromForumPage,
    extractRelNextUrl,
    inferForumInventory,
    resolveVehicleModel,
  };
}
