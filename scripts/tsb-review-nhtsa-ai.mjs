#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_MAX_CASES = Infinity;
const DEFAULT_SLEEP_MS = 0;

const GENERIC_RESOLUTION_PATTERNS = [
  /^follow the service procedure\b/i,
  /^follow the bulletin(?: repair)? procedure\b/i,
  /^refer to\b/i,
  /^see bulletin\b/i,
  /^perform service action\b/i,
  /^this (?:service|technical) bulletin provides repair information\b/i,
  /^this (?:service|technical) bulletin provides a repair procedure\b/i,
  /^this preliminary information communicates\b/i,
  /^this bulletin announces the availability of new reprogramming files\b/i,
];

function usage(exitCode = 1) {
  console.log(`
Usage:
  node scripts/tsb-review-nhtsa-ai.mjs <input_dir1> [input_dir2 ...] <out_dir> [options]

Examples:
  node scripts/tsb-review-nhtsa-ai.mjs C:\\GB\\tmp\\nhtsa_tsb_kia_us_fixcheck_20260328 out_kia_reviewed
  node scripts/tsb-review-nhtsa-ai.mjs dir1 dir2 out_reviewed --model deepseek-chat --max-cases 100

Options:
  --model <name>          DeepSeek model. Default: ${DEFAULT_MODEL}
  --max-cases <n>         Review at most N candidates
  --sleep-ms <ms>         Delay between AI calls. Default: ${DEFAULT_SLEEP_MS}
  --include-review        Also review files from to_review/ (candidate_seed payloads)
  --help                  Show help

Env:
  DEEPSEEK_API_KEY        Required
`.trim());
  process.exit(exitCode);
}

export function parseArgs(argv) {
  const args = {
    inputs: [],
    outDir: "",
    model: DEFAULT_MODEL,
    maxCases: DEFAULT_MAX_CASES,
    sleepMs: DEFAULT_SLEEP_MS,
    includeReview: false,
  };

  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--help" || token === "-h") usage(0);
    if (token === "--model") {
      args.model = (argv[++i] ?? "").trim() || DEFAULT_MODEL;
      continue;
    }
    if (token === "--max-cases") {
      const n = Number(argv[++i] ?? "");
      args.maxCases = Number.isFinite(n) && n > 0 ? Math.trunc(n) : DEFAULT_MAX_CASES;
      continue;
    }
    if (token === "--sleep-ms") {
      const n = Number(argv[++i] ?? "");
      args.sleepMs = Number.isFinite(n) && n >= 0 ? Math.trunc(n) : DEFAULT_SLEEP_MS;
      continue;
    }
    if (token === "--include-review") {
      args.includeReview = true;
      continue;
    }
    if (token.startsWith("--")) usage(1);
    positional.push(token);
  }

  if (positional.length < 2) usage(1);
  args.inputs = positional.slice(0, -1).map(v => path.resolve(v));
  args.outDir = path.resolve(positional[positional.length - 1]);
  return args;
}

function cleanText(value) {
  return (value ?? "")
    .toString()
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ")
    .replace(/â€™/g, "'")
    .trim();
}

function stripJsonFences(text) {
  return cleanText(text).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

export function safeParseJsonObject(text) {
  const raw = stripJsonFences(text);
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("LLM did not return a JSON object.");
  }
  const parsed = JSON.parse(raw.slice(start, end + 1));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Parsed JSON is not an object.");
  }
  return parsed;
}

function ensureArrayOfStrings(value) {
  if (!Array.isArray(value)) return [];
  return value.map(v => cleanText(v)).filter(Boolean);
}

function wordCount(text) {
  return cleanText(text).split(/\s+/).filter(Boolean).length;
}

function extractCodeTag(text) {
  const matches = [...cleanText(text).matchAll(/\b([PCUB][0-9A-F]{4,6})(?:[-/][0-9A-F]{1,3})?\b/gi)]
    .map(match => match[1].toUpperCase());
  const codes = [...new Set(matches)];
  if (codes.length === 0) return "";
  if (codes.length === 1) return `DTC ${codes[0]}`;
  return `DTCs ${codes.slice(0, 4).join("/")}`;
}

function trimToWords(text, maxWords = 4) {
  return cleanText(text).split(/\s+/).filter(Boolean).slice(0, maxWords).join(" ");
}

function normalizeQuotedMessage(text) {
  const match = cleanText(text).match(/["“]([^"”]{3,80})["”]/);
  if (!match) return "";
  const quoted = cleanText(match[1]);
  if (/uconnect box requires service/i.test(quoted)) return "Uconnect service message";
  if (/not available/i.test(quoted)) return trimToWords(quoted.replace(/\bmessage\b/gi, "").trim(), 3);
  return trimToWords(quoted, 4);
}

export function normalizeSymptomTag(text) {
  const normalized = cleanText(text)
    .replace(/^[•\-–\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";

  const quotedMessage = normalizeQuotedMessage(normalized);
  if (quotedMessage) return quotedMessage;

  if (/\bdoor glass\b.*\b(?:does not|won['’]?t)\s+drop\b/i.test(normalized)) return "Door glass won't drop";
  if (/\bfuel(?:-filler)? lid\b.*\b(?:does not|won['’]?t)\s+lock\b/i.test(normalized)) return "Fuel lid won't lock";
  if (/\bpower liftgate\b.*\b(?:does not|won['’]?t)\s+close\b/i.test(normalized)) return "Liftgate won't close";
  if (/\bpower liftgate\b.*\b(?:does not|won['’]?t)\s+open\b/i.test(normalized)) return "Liftgate won't open";
  if (/\btelematics box module\b|\bTBM\b/i.test(normalized) && /\bbackup battery\b/i.test(normalized)) return "TBM battery fault";
  if (/\b12V\b.*\bbattery\b|\b12-volt\b.*\bbattery\b/i.test(normalized)) return "12V battery fault";
  if (/\bintegrated thermal management\b|\bITM\b/i.test(normalized)) return "ITM fault";
  if (/\bbattery monitor module\b/i.test(normalized)) return "Battery monitor fault";
  if (/\bactive grille air shutter\b/i.test(normalized)) return "Active grille shutter fault";
  if (/\bshift out of park\b/i.test(normalized)) return "Stuck in Park";
  if (/\btorque converter(?: damper)? clutch\b/i.test(normalized) && /\b(?:lack of engagement|won['’]?t engage|does not engage|not engage)\b/i.test(normalized)) return "Torque converter clutch fault";
  if (/\bcarbon fouling\b/i.test(normalized) && /\bmisfire\b/i.test(normalized)) return "Engine misfire";
  if (/\bseat warmer\b.*\b(?:does not|won['’]?t)\s+operate\b/i.test(normalized)) return "Seat warmer inoperative";
  if (/\bwindow\b.*\b(?:does not|won['’]?t)\s+open\b/i.test(normalized)) return "Window won't open";

  const codeTag = extractCodeTag(normalized);
  if (/^(?:diagnostic trouble codes?|dtcs?|fault codes?)/i.test(normalized) && codeTag) {
    return codeTag;
  }

  if (/uconnect box requires service/i.test(normalized)) return "Uconnect service message";
  if (/\bmalfunction indicator lamp\b|\bMIL\b/i.test(normalized)) return "MIL on";
  if (/\bwarning light\b/i.test(normalized)) return "Warning light";
  if (/\bblind spot monitor\b|\bBSM\b/i.test(normalized)) return "BSM fault";
  if (/\brear lighting\b|\bbrake light\b|\btaillight\b|\bturn indicator\b/i.test(normalized)) return "Rear lighting fault";
  if (/\brear seat\b.*\bnot\b.*\blocked\b/i.test(normalized)) return "Rear seat unlocked";
  if (/\bdoor handle\b/i.test(normalized) && /\bnot sit flush\b|\bmove slightly\b|\bmisaligned\b|\bloose\b/i.test(normalized)) return "Loose door handle";
  if (/\bharsh downshift\b/i.test(normalized)) return "Harsh downshift";
  if (/\bclicking noise\b/i.test(normalized)) return "Clicking noise";
  if (/\bblower noise\b|\bHVAC\b.*\bnoise\b/i.test(normalized)) return "HVAC blower noise";
  if (/\bfuel door\b.*\bnot open\b|\bfuel door\b.*\bwon['’]?t open\b/i.test(normalized)) return "Fuel door stuck";
  if (/\bno start\b|\bwon['’]?t start\b/i.test(normalized)) return "No start";
  if (/\bbattery drain\b|\bparasitic drain\b/i.test(normalized)) return "Battery drain";
  if (/\bmusty odor\b/i.test(normalized)) return "Musty odor";
  if (/\binoperative\b/i.test(normalized)) {
    const compact = normalized
      .replace(/^(?:the )?/i, "")
      .replace(/\bis inoperative\b.*$/i, " inoperative")
      .replace(/\binoperative\b.*$/i, " inoperative");
    return trimToWords(compact, 3);
  }
  if (/\bmessage\b/i.test(normalized)) {
    const compact = normalized
      .replace(/^(?:check control message for|check control message indicates|vehicle displays|vehicle shows|customer reports|customer states that (?:he\/she )?sees?)\s+/i, "")
      .replace(/\bis displayed\b.*$/i, " message")
      .replace(/\bdisplayed\b.*$/i, " message");
    return trimToWords(compact, 4);
  }
  if (codeTag) return codeTag;

  const compact = normalized
    .replace(/^(?:vehicle exhibits|vehicle displays|vehicle shows|customer reports|customer states that (?:he\/she )?sees?)\s+/i, "")
    .replace(/\bwhen\b.*$/i, "")
    .replace(/\bwhile\b.*$/i, "")
    .replace(/\bduring\b.*$/i, "")
    .replace(/\bwith\b.*$/i, "")
    .replace(/\bdue to\b.*$/i, "")
    .replace(/\bcaused by\b.*$/i, "")
    .replace(/[.,;:]+$/g, "")
    .trim();

  return trimToWords(compact, 4);
}

export function normalizeSymptomTags(values, fallbackDescription = "") {
  const sourceValues = Array.isArray(values) && values.length > 0 ? values : [fallbackDescription];
  const tags = [];
  for (const value of sourceValues) {
    const tag = normalizeSymptomTag(value);
    if (!tag) continue;
    if (wordCount(tag) > 4) continue;
    if (looksLikeRawBulletinText(tag)) continue;
    tags.push(tag);
  }
  const deduped = [...new Set(tags)];
  if (deduped.length > 0) return deduped.slice(0, 4);

  const fallback = normalizeSymptomTag(fallbackDescription);
  return fallback && wordCount(fallback) <= 4 ? [fallback] : [];
}

function isDtcLikeSymptomTag(text) {
  const normalized = cleanText(text);
  return /^DTCs?\b/i.test(normalized) || /^[PCUB][0-9A-F]{4,6}\b/i.test(normalized);
}

function isGenericSymptomTag(text) {
  const normalized = cleanText(text);
  return normalized === "MIL on" || normalized === "Warning light";
}

export function pruneGenericSymptomTags(symptoms, description = "", rawSummary = "") {
  const uniqueSymptoms = [...new Set(ensureArrayOfStrings(symptoms))];
  if (uniqueSymptoms.length <= 1) {
    if (uniqueSymptoms.length === 1 && !isGenericSymptomTag(uniqueSymptoms[0])) {
      return uniqueSymptoms;
    }
    const derived = normalizeSymptomTags([description, rawSummary], description)
      .filter(tag => !isGenericSymptomTag(tag));
    return derived.length > 0 ? derived : uniqueSymptoms;
  }

  const nonGeneric = uniqueSymptoms.filter(tag => !isGenericSymptomTag(tag));
  if (nonGeneric.length > 0) {
    return nonGeneric;
  }

  const derived = normalizeSymptomTags([description, rawSummary], description)
    .filter(tag => !isGenericSymptomTag(tag));
  return derived.length > 0 ? derived : uniqueSymptoms;
}

export function augmentDtcOnlySymptoms(symptoms, description = "", rawSummary = "") {
  const uniqueSymptoms = [...new Set(ensureArrayOfStrings(symptoms))];
  if (uniqueSymptoms.length === 0 || !uniqueSymptoms.every(isDtcLikeSymptomTag)) {
    return uniqueSymptoms;
  }
  const derived = normalizeSymptomTags([description, rawSummary], description)
    .filter(tag => !isDtcLikeSymptomTag(tag))
    .filter(tag => !isGenericSymptomTag(tag));
  return derived.length > 0 ? [...new Set([...derived, ...uniqueSymptoms])] : uniqueSymptoms;
}

export function pruneSymptomsAgainstObdCodes(symptoms, obdCodes = []) {
  const uniqueSymptoms = [...new Set(ensureArrayOfStrings(symptoms))];
  if (!Array.isArray(obdCodes) || obdCodes.length === 0) return uniqueSymptoms;
  return uniqueSymptoms.filter(tag => !isDtcLikeSymptomTag(tag));
}

function looksLikeRawBulletinText(text) {
  const normalized = cleanText(text);
  if (!normalized) return true;
  if (normalized.length > 240) return true;
  if (/^(?:some|certain|these)\b/i.test(normalized)) return true;
  if (/this (?:service|technical) bulletin/i.test(normalized)) return true;
  if (/\bproduced from\b|\bequipped with\b|\bbuilt on\b/i.test(normalized)) return true;
  return false;
}

function hasActionableResolution(text) {
  const normalized = cleanText(text);
  if (!normalized) return false;
  if (GENERIC_RESOLUTION_PATTERNS.some(pattern => pattern.test(normalized))) return false;
  return /\b(?:replace|repair|reprogram|update|adjust|install|inspect|tighten|clean|reseal|torque|bleed|flush)\b/i.test(normalized);
}

function uniqueSorted(values) {
  return [...new Set((values ?? []).map(value => cleanText(value)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function extractRevisionRank(sourceRef) {
  const text = cleanText(sourceRef).toUpperCase();
  const revLetter = text.match(/\bREV\.?\s*([A-Z])\b/);
  if (revLetter) return revLetter[1].charCodeAt(0) - 64;
  const revNumber = text.match(/(?:^|[_\s-])R(\d{1,2})(?:$|[_\s-])/);
  if (revNumber) return Number(revNumber[1]);
  return 0;
}

function extractNhtsaId(sourceRef) {
  const match = cleanText(sourceRef).match(/NHTSA\s+(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function makeAcceptedKey(seed) {
  return [
    cleanText(seed.vehicle_brand).toLowerCase(),
    cleanText(seed.vehicle_model).toLowerCase(),
    uniqueSorted(seed.obd_codes).join(",").toLowerCase(),
    cleanText(seed.description).toLowerCase(),
    cleanText(seed.resolution).toLowerCase(),
  ].join("||");
}

function mergeAcceptedMetadata(preferredSeed, otherSeed) {
  preferredSeed.metadata = preferredSeed.metadata ?? {};
  otherSeed.metadata = otherSeed.metadata ?? {};
  preferredSeed.metadata.source_refs = uniqueSorted([
    ...(preferredSeed.metadata.source_refs ?? [preferredSeed.source_ref, preferredSeed.metadata.source_ref]),
    ...(otherSeed.metadata.source_refs ?? [otherSeed.source_ref, otherSeed.metadata.source_ref]),
  ]);
  preferredSeed.metadata.thread_urls = uniqueSorted([
    ...(preferredSeed.metadata.thread_urls ?? [preferredSeed.thread_url]),
    ...(otherSeed.metadata.thread_urls ?? [otherSeed.thread_url]),
  ]);
  preferredSeed.metadata.source_variant_count = Math.max(
    Number(preferredSeed.metadata.source_variant_count ?? 1),
    Number(otherSeed.metadata.source_variant_count ?? 1),
  ) + 1;
  return preferredSeed;
}

function acceptedSeedWins(incomingSeed, existingSeed) {
  const incomingRevision = extractRevisionRank(incomingSeed.source_ref);
  const existingRevision = extractRevisionRank(existingSeed.source_ref);
  if (incomingRevision !== existingRevision) return incomingRevision > existingRevision;
  const incomingNhtsa = extractNhtsaId(incomingSeed.source_ref);
  const existingNhtsa = extractNhtsaId(existingSeed.source_ref);
  return incomingNhtsa > existingNhtsa;
}

export function dedupeAcceptedSeeds(records) {
  const map = new Map();
  const dropped = [];
  for (const record of records) {
    const key = makeAcceptedKey(record.seed);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...record,
        seed: structuredClone(record.seed),
      });
      continue;
    }

    const incomingWins = acceptedSeedWins(record.seed, existing.seed);
    const preferred = incomingWins ? record : existing;
    const other = incomingWins ? existing : record;
    const kept = {
      ...preferred,
      seed: mergeAcceptedMetadata(structuredClone(preferred.seed), other.seed),
    };
    map.set(key, kept);
    dropped.push({
      dropped: other,
      kept,
      reason: "Duplicate accepted seed after AI review; kept higher revision/source_ref variant.",
    });
  }
  return {
    kept: [...map.values()],
    dropped,
  };
}

export function normalizeAiDecision(value) {
  const decision = cleanText(value?.decision).toLowerCase();
  const normalized = {
    decision: decision === "accept" || decision === "reject" || decision === "review" ? decision : "review",
    isRelevant: value?.is_relevant === true,
    hasClearSymptoms: value?.has_clear_symptoms === true,
    hasClearResolution: value?.has_clear_resolution === true,
    matchesCaseStructure: value?.matches_case_structure === true,
    cleanedSymptoms: ensureArrayOfStrings(value?.cleaned_symptoms),
    cleanedDescription: cleanText(value?.cleaned_description),
    cleanedResolution: cleanText(value?.cleaned_resolution),
    reason: cleanText(value?.reason),
  };

  if (!normalized.cleanedDescription && normalized.cleanedSymptoms[0]) {
    normalized.cleanedDescription = normalized.cleanedSymptoms[0];
  }
  normalized.cleanedSymptoms = normalizeSymptomTags(normalized.cleanedSymptoms, normalized.cleanedDescription);
  normalized.cleanedSymptoms = pruneGenericSymptomTags(
    normalized.cleanedSymptoms,
    normalized.cleanedDescription,
    normalized.cleanedDescription,
  );
  normalized.cleanedSymptoms = augmentDtcOnlySymptoms(
    normalized.cleanedSymptoms,
    normalized.cleanedDescription,
    normalized.cleanedDescription,
  );

  const structurallyAcceptable =
    normalized.isRelevant &&
    normalized.hasClearSymptoms &&
    normalized.hasClearResolution &&
    normalized.matchesCaseStructure &&
    normalized.cleanedSymptoms.length > 0 &&
    normalized.cleanedSymptoms.every(tag => wordCount(tag) <= 4) &&
    normalized.cleanedDescription.length >= 12 &&
    normalized.cleanedResolution.length >= 10 &&
    !looksLikeRawBulletinText(normalized.cleanedDescription) &&
    !looksLikeRawBulletinText(normalized.cleanedResolution) &&
    normalized.cleanedDescription.toLowerCase() !== normalized.cleanedResolution.toLowerCase() &&
    hasActionableResolution(normalized.cleanedResolution);

  if (normalized.decision === "accept" && !structurallyAcceptable) {
    normalized.decision = "review";
    normalized.reason = normalized.reason || "AI marked accept, but normalized output still failed structural validation.";
  }

  return normalized;
}

export function buildReviewPrompt(candidate) {
  return [
    "You review one automotive diagnostic seed candidate extracted from an NHTSA manufacturer bulletin.",
    "Return ONLY one JSON object and nothing else.",
    "",
    "Accept the seed only if ALL of these are true:",
    "- it is relevant for diagnostic case retrieval",
    "- the malfunction or symptom is clearly described",
    "- the repair action is clearly described",
    "- the structure matches a concise diagnostic case: symptoms -> resolution",
    "",
    "Reject if any of these are true:",
    "- it is administrative, preventive, policy, or generic service information",
    "- the resolution is just 'follow bulletin / procedure / service information'",
    "- the description or resolution still reads like raw bulletin prose",
    "- it does not clearly separate what is wrong from how to fix it",
    "",
    "If accepted, rewrite the candidate into concise English.",
    "- Keep only the malfunction and repair.",
    "- Do not include production ranges, VIN ranges, or extra bulletin framing unless essential.",
    "- Keep OBD/DTC references only if explicitly present.",
    "- cleaned_symptoms must be SHORT TAGS only, 1 to 4 words each.",
    "- Examples of valid cleaned_symptoms: [\"Clicking noise\"], [\"Door glass won't drop\"], [\"TBM battery fault\"], [\"BSM fault\", \"DTC C1AB413/C1AB513\"], [\"Uconnect service message\"].",
    "- Never return full sentences in cleaned_symptoms.",
    "",
    'JSON schema:',
    '{"decision":"reject","is_relevant":false,"has_clear_symptoms":false,"has_clear_resolution":false,"matches_case_structure":false,"cleaned_symptoms":[],"cleaned_description":"","cleaned_resolution":"","reason":""}',
    "",
    `Brand: ${candidate.seed.vehicle_brand}`,
    `Model: ${candidate.seed.vehicle_model}`,
    `Source ref: ${candidate.seed.source_ref ?? ""}`,
    `Current symptoms: ${JSON.stringify(candidate.seed.symptoms ?? [])}`,
    `Current description: ${candidate.seed.description ?? ""}`,
    `Current resolution: ${candidate.seed.resolution ?? ""}`,
    `Current OBD codes: ${JSON.stringify(candidate.seed.obd_codes ?? [])}`,
    `Raw source summary: ${candidate.summaryRaw}`,
  ].join("\n");
}

async function deepseekChatJson({ apiKey, model, messages, maxTokens = 1200 }) {
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
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DeepSeek API error ${res.status}: ${body.slice(0, 400)}`);
  }

  const data = await res.json();
  return (data?.choices?.[0]?.message?.content ?? "").toString();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function appendJsonLine(filePath, payload) {
  await fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, "utf8");
}

function makeDecisionId(sourcePath) {
  return path.basename(sourcePath).replace(/\.json$/i, "");
}

export async function loadCandidate(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
  if (parsed?.candidate_seed && parsed?.source_record) {
    return {
      sourcePath: filePath,
      kind: "review",
      seed: parsed.candidate_seed,
      sourceRecord: parsed.source_record,
      summaryRaw: cleanText(parsed.source_record.summary ?? parsed.candidate_seed?.metadata?.summary_raw ?? ""),
      reviewReason: cleanText(parsed.review_reason),
    };
  }
  return {
    sourcePath: filePath,
    kind: "ready",
    seed: parsed,
    sourceRecord: null,
    summaryRaw: cleanText(parsed?.metadata?.summary_raw ?? ""),
    reviewReason: "",
  };
}

export async function collectCandidatePaths(inputDirs, includeReview = false) {
  const out = [];
  for (const inputDir of inputDirs) {
    const readyDir = path.join(inputDir, "ready");
    try {
      const readyFiles = await fs.readdir(readyDir, { withFileTypes: true });
      for (const entry of readyFiles) {
        if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
          out.push(path.join(readyDir, entry.name));
        }
      }
    } catch {}

    if (!includeReview) continue;
    const reviewDir = path.join(inputDir, "to_review");
    try {
      const reviewFiles = await fs.readdir(reviewDir, { withFileTypes: true });
      for (const entry of reviewFiles) {
        if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
          out.push(path.join(reviewDir, entry.name));
        }
      }
    } catch {}
  }
  return out.sort((a, b) => a.localeCompare(b));
}

export function parseDecisionLogLines(text) {
  const processedPaths = [];
  const acceptedDecisions = [];
  const summary = {
    reviewed: 0,
    accepted: 0,
    review: 0,
    rejected: 0,
  };

  for (const rawLine of (text ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const record = JSON.parse(line);
    const decision = normalizeAiDecision(record?.decision ?? {});
    if (record?.source_path) processedPaths.push(path.resolve(record.source_path));
    summary.reviewed++;
    if (decision.decision === "accept") {
      acceptedDecisions.push({
        sourcePath: path.resolve(record.source_path),
        decision,
      });
    } else if (decision.decision === "review") {
      summary.review++;
    } else {
      summary.rejected++;
    }
  }

  summary.accepted = acceptedDecisions.length;
  return {
    processedPaths: [...new Set(processedPaths)],
    acceptedDecisions,
    summary,
  };
}

async function loadResumeState(outDir, model) {
  const decisionsPath = path.join(outDir, "ai_review_decisions.jsonl");
  try {
    const raw = await fs.readFile(decisionsPath, "utf8");
    if (!raw.trim()) {
      return {
        processedPathSet: new Set(),
        acceptedRecords: [],
        summary: {
          reviewed: 0,
          accepted: 0,
          review: 0,
          rejected: 0,
        },
      };
    }

    const parsed = parseDecisionLogLines(raw);
    const acceptedRecords = [];
    for (const accepted of parsed.acceptedDecisions) {
      const candidate = await loadCandidate(accepted.sourcePath);
      acceptedRecords.push({
        sourcePath: accepted.sourcePath,
        seed: applyDecisionToSeed(candidate.seed, accepted.decision, model),
      });
    }

    return {
      processedPathSet: new Set(parsed.processedPaths),
      acceptedRecords,
      summary: parsed.summary,
    };
  } catch {
    return {
      processedPathSet: new Set(),
      acceptedRecords: [],
      summary: {
        reviewed: 0,
        accepted: 0,
        review: 0,
        rejected: 0,
      },
    };
  }
}

function applyDecisionToSeed(seed, decision, model) {
  const updated = structuredClone(seed);
  updated.symptoms = pruneSymptomsAgainstObdCodes(decision.cleanedSymptoms, updated.obd_codes);
  updated.description = decision.cleanedDescription;
  updated.resolution = decision.cleanedResolution;
  updated.metadata = updated.metadata ?? {};
  updated.metadata.ai_review = {
    reviewed_at: new Date().toISOString(),
    reviewer_model: model,
    decision: decision.decision,
    reason: decision.reason,
    is_relevant: decision.isRelevant,
    has_clear_symptoms: decision.hasClearSymptoms,
    has_clear_resolution: decision.hasClearResolution,
    matches_case_structure: decision.matchesCaseStructure,
  };
  return updated;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error("Missing DEEPSEEK_API_KEY.");
    process.exit(2);
  }

  const readyDir = path.join(args.outDir, "ready");
  const reviewDir = path.join(args.outDir, "to_review");
  const rejectDir = path.join(args.outDir, "manual_review", "rejected_ai");
  const decisionsPath = path.join(args.outDir, "ai_review_decisions.jsonl");
  await ensureDir(readyDir);
  await ensureDir(reviewDir);
  await ensureDir(rejectDir);
  const resumeState = await loadResumeState(args.outDir, args.model);
  if (resumeState.processedPathSet.size === 0) {
    await fs.writeFile(decisionsPath, "", "utf8");
  } else {
    console.log(
      `Resuming AI review from ${resumeState.processedPathSet.size} processed candidate(s) in ${args.outDir}`,
    );
  }

  const candidatePaths = (await collectCandidatePaths(args.inputs, args.includeReview))
    .slice(0, args.maxCases)
    .filter(candidatePath => !resumeState.processedPathSet.has(candidatePath));
  const summary = {
    input_dirs: args.inputs,
    include_review: args.includeReview,
    model: args.model,
    reviewed: resumeState.summary.reviewed,
    accepted: resumeState.summary.accepted,
    deduped_accepted_duplicates: 0,
    review: resumeState.summary.review,
    rejected: resumeState.summary.rejected,
  };
  const acceptedRecords = [...resumeState.acceptedRecords];

  for (let index = 0; index < candidatePaths.length; index++) {
    const candidate = await loadCandidate(candidatePaths[index]);
    const prompt = buildReviewPrompt(candidate);
    const content = await deepseekChatJson({
      apiKey,
      model: args.model,
      maxTokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });
    const decision = normalizeAiDecision(safeParseJsonObject(content));
    const decisionRecord = {
      source_path: candidate.sourcePath,
      source_ref: candidate.seed.source_ref ?? null,
      vehicle_brand: candidate.seed.vehicle_brand ?? null,
      vehicle_model: candidate.seed.vehicle_model ?? null,
      raw_summary: candidate.summaryRaw,
      decision,
    };
    await appendJsonLine(decisionsPath, decisionRecord);

    if (decision.decision === "accept") {
      const updatedSeed = applyDecisionToSeed(candidate.seed, decision, args.model);
      acceptedRecords.push({
        sourcePath: candidate.sourcePath,
        seed: updatedSeed,
      });
    } else if (decision.decision === "review") {
      await writeJson(path.join(reviewDir, `${makeDecisionId(candidate.sourcePath)}.json`), {
        source_path: candidate.sourcePath,
        seed: candidate.seed,
        source_record: candidate.sourceRecord,
        raw_summary: candidate.summaryRaw,
        ai_decision: decision,
      });
      summary.review++;
    } else {
      await writeJson(path.join(rejectDir, path.basename(candidate.sourcePath)), {
        source_path: candidate.sourcePath,
        seed: candidate.seed,
        source_record: candidate.sourceRecord,
        raw_summary: candidate.summaryRaw,
        ai_decision: decision,
      });
      summary.rejected++;
    }

    summary.reviewed++;
    if (args.sleepMs > 0 && index < candidatePaths.length - 1) {
      await sleep(args.sleepMs);
    }
  }

  const deduped = dedupeAcceptedSeeds(acceptedRecords);
  for (const record of deduped.kept) {
    await writeJson(path.join(readyDir, path.basename(record.sourcePath)), record.seed);
  }
  for (const duplicate of deduped.dropped) {
    await writeJson(path.join(rejectDir, path.basename(duplicate.dropped.sourcePath)), {
      source_path: duplicate.dropped.sourcePath,
      seed: duplicate.dropped.seed,
      duplicate_of: path.basename(duplicate.kept.sourcePath),
      kept_source_ref: duplicate.kept.seed.source_ref ?? null,
      reason: duplicate.reason,
    });
  }
  summary.accepted = deduped.kept.length;
  summary.deduped_accepted_duplicates = deduped.dropped.length;
  summary.rejected += deduped.dropped.length;

  await writeJson(path.join(args.outDir, "summary.json"), summary);
  console.log(
    `AI-reviewed ${summary.reviewed} candidate(s). Accepted ${summary.accepted}, review ${summary.review}, rejected ${summary.rejected} into: ${args.outDir}`,
  );
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
