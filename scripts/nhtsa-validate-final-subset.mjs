#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CONDITIONAL_RESOLUTION_PATTERNS = [
  /\bas needed\b/i,
  /\bif necessary\b/i,
  /\bif the concern persists\b/i,
  /\bif concern persists\b/i,
  /\bif concern remains\b/i,
  /\bif the issue persists\b/i,
  /\bif issue persists\b/i,
  /\bif symptoms persist\b/i,
  /\bif .* found\b/i,
  /\bif .* damaged\b/i,
  /\bif .* out of spec\b/i,
  /\bif .* cannot be established\b/i,
  /\bthen replace\b/i,
];

function usage(exitCode = 1) {
  console.log(`
Usage:
  node scripts/nhtsa-validate-final-subset.mjs <input_dir> <out_dir>

Example:
  node scripts/nhtsa-validate-final-subset.mjs C:\\GB\\tmp\\brand\\07_final_subset C:\\GB\\tmp\\brand\\06_codex_validate
`.trim());
  process.exit(exitCode);
}

export function parseArgs(argv) {
  const positional = argv.filter(token => !token.startsWith("--"));
  if (positional.length !== 2) usage(1);
  return {
    inputDir: path.resolve(positional[0]),
    outDir: path.resolve(positional[1]),
  };
}

function cleanText(value) {
  return (value ?? "").toString().replace(/^\uFEFF/, "").replace(/\s+/g, " ").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value.map(item => cleanText(item)).filter(Boolean) : [];
}

export function wordCount(text) {
  return cleanText(text).split(/\s+/).filter(Boolean).length;
}

export function hasConditionalResolution(text) {
  const normalized = cleanText(text);
  return CONDITIONAL_RESOLUTION_PATTERNS.some(pattern => pattern.test(normalized));
}

export function isDtcLikeSymptom(text) {
  const normalized = cleanText(text);
  return /^DTCs?\b/i.test(normalized) || /^[PCUB][0-9A-F]{4,6}\b/i.test(normalized);
}

export function makeCanonicalKey(seed) {
  return [
    cleanText(seed?.vehicle_brand).toLowerCase(),
    cleanText(seed?.vehicle_model).toLowerCase(),
    ensureArray(seed?.obd_codes).join(",").toLowerCase(),
    cleanText(seed?.description).toLowerCase(),
    cleanText(seed?.resolution).toLowerCase(),
  ].join("||");
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath, payload) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function appendJsonLine(filePath, payload) {
  await fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, "utf8");
}

async function collectSeedFiles(inputDir) {
  const readyDir = path.join(inputDir, "ready");
  const scanDir = await fs.stat(readyDir).then(stat => stat.isDirectory() ? readyDir : inputDir).catch(() => inputDir);
  const entries = await fs.readdir(scanDir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map(entry => path.join(scanDir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function issueRecord(type, filePath, details = {}) {
  return {
    type,
    file: filePath,
    ...details,
  };
}

export async function validateSubset(inputDir, outDir) {
  const seedFiles = await collectSeedFiles(inputDir);
  const issuesPath = path.join(outDir, "issues.jsonl");
  await ensureDir(outDir);
  await fs.writeFile(issuesPath, "", "utf8");

  const summary = {
    input_dir: inputDir,
    validated_at: new Date().toISOString(),
    seed_count: seedFiles.length,
    duplicate_groups: 0,
    duplicate_rows: 0,
    long_symptom_tags: 0,
    redundant_dtc_symptom_hits: 0,
    unresolved_catalog_mapping: 0,
    conditional_resolutions: 0,
    missing_core_fields: 0,
    empty_subset: seedFiles.length === 0 ? 1 : 0,
    approved: false,
  };

  const canonicalMap = new Map();

  for (const filePath of seedFiles) {
    const parsed = JSON.parse((await fs.readFile(filePath, "utf8")).replace(/^\uFEFF/, ""));
    const symptoms = ensureArray(parsed?.symptoms);
    const obdCodes = ensureArray(parsed?.obd_codes);
    const description = cleanText(parsed?.description);
    const resolution = cleanText(parsed?.resolution);
    const mappingResolved = parsed?.metadata?.catalog_mapping?.resolved === true;

    const missingCore =
      !cleanText(parsed?.local_id) ||
      !cleanText(parsed?.vehicle_brand) ||
      !cleanText(parsed?.vehicle_model) ||
      symptoms.length === 0 ||
      !description ||
      !resolution;
    if (missingCore) {
      summary.missing_core_fields++;
      await appendJsonLine(issuesPath, issueRecord("missing_core_fields", filePath));
    }

    const longTags = symptoms.filter(symptom => wordCount(symptom) > 4);
    if (longTags.length > 0) {
      summary.long_symptom_tags += longTags.length;
      await appendJsonLine(issuesPath, issueRecord("long_symptom_tags", filePath, { symptoms: longTags }));
    }

    const redundantDtcTags = symptoms.filter(symptom => isDtcLikeSymptom(symptom) && obdCodes.length > 0);
    if (redundantDtcTags.length > 0) {
      summary.redundant_dtc_symptom_hits += redundantDtcTags.length;
      await appendJsonLine(issuesPath, issueRecord("redundant_dtc_symptom_tag", filePath, { symptoms: redundantDtcTags }));
    }

    if (!mappingResolved) {
      summary.unresolved_catalog_mapping++;
      await appendJsonLine(issuesPath, issueRecord("unresolved_catalog_mapping", filePath));
    }

    if (hasConditionalResolution(resolution)) {
      summary.conditional_resolutions++;
      await appendJsonLine(issuesPath, issueRecord("conditional_resolution", filePath, { resolution }));
    }

    const canonicalKey = makeCanonicalKey(parsed);
    if (!canonicalMap.has(canonicalKey)) {
      canonicalMap.set(canonicalKey, []);
    }
    canonicalMap.get(canonicalKey).push(filePath);
  }

  for (const files of canonicalMap.values()) {
    if (files.length <= 1) continue;
    summary.duplicate_groups++;
    summary.duplicate_rows += files.length;
    await appendJsonLine(issuesPath, {
      type: "duplicate_group",
      files,
    });
  }

  summary.approved =
    summary.seed_count > 0 &&
    summary.duplicate_groups === 0 &&
    summary.long_symptom_tags === 0 &&
    summary.redundant_dtc_symptom_hits === 0 &&
    summary.unresolved_catalog_mapping === 0 &&
    summary.conditional_resolutions === 0 &&
    summary.missing_core_fields === 0;

  await writeJson(path.join(outDir, "summary.json"), summary);
  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = await validateSubset(args.inputDir, args.outDir);
  console.log(
    `Validated ${summary.seed_count} seed(s). approved=${summary.approved} duplicates=${summary.duplicate_groups} long_tags=${summary.long_symptom_tags} redundant_dtc=${summary.redundant_dtc_symptom_hits} unresolved_mapping=${summary.unresolved_catalog_mapping} conditional=${summary.conditional_resolutions} missing_core=${summary.missing_core_fields}`,
  );
  if (!summary.approved) {
    process.exitCode = 1;
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
