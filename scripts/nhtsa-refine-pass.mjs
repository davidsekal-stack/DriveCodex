#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const GENERIC_RESOLUTION_PATTERNS = [
  /^follow the service procedure\b/i,
  /^follow the bulletin(?: repair)? procedure\b/i,
  /^refer to\b/i,
  /^see bulletin\b/i,
  /^perform service action\b/i,
  /^this (?:service|technical) bulletin provides repair information\b/i,
  /^this (?:service|technical) bulletin provides a repair procedure\b/i,
  /^inspect\b/i,
  /^check\b/i,
  /^verify\b/i,
  /^torque\b/i,
  /^clean and lubricate\b/i,
];

const HIGH_VALUE_PATTERNS = [
  /\bdtc\b/i,
  /\bmil\b/i,
  /\bno start\b/i,
  /\bwon['’]?t start\b/i,
  /\bstall\b/i,
  /\bloss of propulsion\b/i,
  /\breduced power\b/i,
  /\blimp mode\b/i,
  /\bpoor acceleration\b/i,
  /\boverheat(?:ing)?\b/i,
  /\bleak\b/i,
  /\bbrake fluid\b/i,
  /\bbrake assist\b/i,
  /\bhard brake pedal\b/i,
  /\bincorrect gear ratio\b/i,
  /\bslipping\b/i,
  /\bjerking\b/i,
  /\brough shifts?\b/i,
  /\bno charge\b/i,
  /\bunable to charge\b/i,
  /\bbattery dead\b/i,
  /\bdead battery\b/i,
  /\binoperative\b/i,
  /\bremote start inoperative\b/i,
  /\bstart\/stop inoperative\b/i,
  /\bengine runs cold\b/i,
  /\bno cabin heat\b/i,
];

const LOW_VALUE_PATTERNS = [
  /\bnoise\b/i,
  /\brattle\b/i,
  /\bclunk\b/i,
  /\bsqueak\b/i,
  /\bwhin(?:e|ing)\b/i,
  /\bmoan\b/i,
  /\bgrinding\b/i,
  /\bscrap(?:e|ing)\b/i,
  /\bvibration\b/i,
  /\bharsh ride\b/i,
  /\bpopping\b/i,
  /\bflutter\b/i,
  /\bticking\b/i,
  /\bmanual door lock\b/i,
  /\bheated seat\b/i,
  /\bsunshade\b/i,
  /\bpower folding mirror\b/i,
  /\bsharp curve warning\b/i,
  /\bwater leak center stack\b/i,
  /\broof rattle\b/i,
  /\bwindow operation\b/i,
  /\bwheel bearing noise\b/i,
  /\bess inoperative\b/i,
  /\bcheck gas cap\b/i,
];

function usage(exitCode = 1) {
  console.log(`
Usage:
  node scripts/nhtsa-refine-pass.mjs <input_dir> <out_dir>

Example:
  node scripts/nhtsa-refine-pass.mjs C:\\GB\\tmp\\nhtsa_runs\\file\\brand\\01_coarse C:\\GB\\tmp\\nhtsa_runs\\file\\brand\\02_refined
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

function makeDecisionId(seedPath) {
  return path.basename(seedPath).replace(/\.json$/i, "");
}

export function classifySeedForRefine(seed) {
  const symptoms = ensureArray(seed?.symptoms);
  const description = cleanText(seed?.description);
  const resolution = cleanText(seed?.resolution);
  const summaryRaw = cleanText(seed?.metadata?.summary_raw);
  const text = `${symptoms.join(" ")} ${description} ${resolution} ${summaryRaw}`;

  if (seed?.metadata?.catalog_mapping?.resolved !== true) {
    return { stage: "review", reason: "Catalog mapping unresolved or missing." };
  }

  if (!description || !resolution || symptoms.length === 0) {
    return { stage: "review", reason: "Seed is missing core case fields after coarse extraction." };
  }

  if (symptoms.some(symptom => cleanText(symptom).split(/\s+/).filter(Boolean).length > 4)) {
    return { stage: "review", reason: "Symptom tags are too verbose for high-confidence refined ready." };
  }

  if (GENERIC_RESOLUTION_PATTERNS.some(pattern => pattern.test(resolution))) {
    return { stage: "review", reason: "Resolution still looks like procedural or generic bulletin guidance." };
  }

  const hasHighValueSignal = HIGH_VALUE_PATTERNS.some(pattern => pattern.test(text));
  const hasLowValueSignal = LOW_VALUE_PATTERNS.some(pattern => pattern.test(text));

  if (hasLowValueSignal && !hasHighValueSignal) {
    return { stage: "review", reason: "Low-value NVH/comfort/nuisance case moved out of refined ready." };
  }

  return { stage: "ready", reason: "" };
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inReadyDir = path.join(args.inputDir, "ready");
  const inReviewDir = path.join(args.inputDir, "to_review");
  const outReadyDir = path.join(args.outDir, "ready");
  const outReviewDir = path.join(args.outDir, "to_review");
  const movedDir = path.join(args.outDir, "manual_review", "moved_from_ready");
  await ensureDir(outReadyDir);
  await ensureDir(outReviewDir);
  await ensureDir(movedDir);

  const summary = {
    input_dir: args.inputDir,
    ready_kept: 0,
    ready_moved_to_review: 0,
    existing_review_copied: 0,
  };

  const readyEntries = await fs.readdir(inReadyDir, { withFileTypes: true }).catch(() => []);
  for (const entry of readyEntries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) continue;
    const sourcePath = path.join(inReadyDir, entry.name);
    const raw = await fs.readFile(sourcePath, "utf8");
    const seed = JSON.parse(raw.replace(/^\uFEFF/, ""));
    const decision = classifySeedForRefine(seed);
    if (decision.stage === "ready") {
      await fs.writeFile(path.join(outReadyDir, entry.name), `${JSON.stringify(seed, null, 2)}\n`, "utf8");
      summary.ready_kept++;
      continue;
    }

    await writeJson(path.join(outReviewDir, `review_${makeDecisionId(sourcePath).replace(/^seed_/, "")}.json`), {
      review_reason: decision.reason,
      candidate_seed: seed,
      source_record: {
        summary: seed?.metadata?.summary_raw ?? "",
      },
    });
    await writeJson(path.join(movedDir, entry.name), {
      source_path: sourcePath,
      review_reason: decision.reason,
      seed,
    });
    summary.ready_moved_to_review++;
  }

  const reviewEntries = await fs.readdir(inReviewDir, { withFileTypes: true }).catch(() => []);
  for (const entry of reviewEntries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) continue;
    const sourcePath = path.join(inReviewDir, entry.name);
    const targetPath = path.join(outReviewDir, entry.name);
    const raw = await fs.readFile(sourcePath, "utf8");
    await fs.writeFile(targetPath, raw, "utf8");
    summary.existing_review_copied++;
  }

  await writeJson(path.join(args.outDir, "summary.json"), summary);
  console.log(
    `Refined ${summary.ready_kept + summary.ready_moved_to_review} ready candidate(s). Kept ${summary.ready_kept}, moved ${summary.ready_moved_to_review} to review, copied ${summary.existing_review_copied} prior review files into: ${args.outDir}`,
  );
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
