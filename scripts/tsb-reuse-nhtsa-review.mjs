#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import {
  collectCandidatePaths,
  loadCandidate,
  parseDecisionLogLines,
} from "./tsb-review-nhtsa-ai.mjs";

function usage(exitCode = 1) {
  console.log(`
Usage:
  node scripts/tsb-reuse-nhtsa-review.mjs <old_review_dir> <new_input_dir1> [new_input_dir2 ...] <new_out_dir> [options]

Examples:
  node scripts/tsb-reuse-nhtsa-review.mjs old_review chevy_subset chevy_reviewed --include-review

Options:
  --include-review   Match both ready/ and to_review/ candidates from the new subset
  --help             Show help
`.trim());
  process.exit(exitCode);
}

export function parseArgs(argv) {
  const args = {
    oldReviewDir: "",
    newInputDirs: [],
    newOutDir: "",
    includeReview: false,
  };

  const positional = [];
  for (const token of argv) {
    if (token === "--help" || token === "-h") usage(0);
    if (token === "--include-review") {
      args.includeReview = true;
      continue;
    }
    if (token.startsWith("--")) usage(1);
    positional.push(token);
  }

  if (positional.length < 3) usage(1);
  args.oldReviewDir = path.resolve(positional[0]);
  args.newInputDirs = positional.slice(1, -1).map(item => path.resolve(item));
  args.newOutDir = path.resolve(positional[positional.length - 1]);
  return args;
}

function cleanText(value) {
  return (value ?? "").toString().replace(/^\uFEFF/, "").trim();
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

export async function bootstrapReviewReuse({
  oldReviewDir,
  newInputDirs,
  newOutDir,
  includeReview = false,
}) {
  const oldDecisionsPath = path.join(oldReviewDir, "ai_review_decisions.jsonl");
  const raw = await fs.readFile(oldDecisionsPath, "utf8");
  const parsed = parseDecisionLogLines(raw);

  const newCandidatePaths = await collectCandidatePaths(newInputDirs, includeReview);
  const candidateMap = new Map(newCandidatePaths.map(candidatePath => [path.basename(candidatePath), candidatePath]));

  const readyDir = path.join(newOutDir, "ready");
  const reviewDir = path.join(newOutDir, "to_review");
  const rejectDir = path.join(newOutDir, "manual_review", "rejected_ai");
  const reviewErrorDir = path.join(newOutDir, "manual_review", "review_errors");
  const decisionsPath = path.join(newOutDir, "ai_review_decisions.jsonl");

  await ensureDir(readyDir);
  await ensureDir(reviewDir);
  await ensureDir(rejectDir);
  await ensureDir(reviewErrorDir);
  await fs.writeFile(decisionsPath, "", "utf8");

  const summary = {
    old_review_dir: oldReviewDir,
    new_input_dirs: newInputDirs,
    include_review: includeReview,
    old_decisions: parsed.summary.reviewed,
    matched: 0,
    unmatched: 0,
    reused_accept: 0,
    reused_review: 0,
    reused_reject: 0,
  };

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const record = JSON.parse(line);
    const sourceName = path.basename(cleanText(record.source_path));
    const newPath = candidateMap.get(sourceName);
    if (!newPath) {
      summary.unmatched++;
      continue;
    }

    const candidate = await loadCandidate(newPath);
    const rewritten = {
      source_path: candidate.sourcePath,
      source_ref: candidate.seed.source_ref ?? null,
      vehicle_brand: candidate.seed.vehicle_brand ?? null,
      vehicle_model: candidate.seed.vehicle_model ?? null,
      raw_summary: candidate.summaryRaw,
      decision: record.decision,
    };
    await appendJsonLine(decisionsPath, rewritten);

    if (record.decision?.decision === "review") {
      await writeJson(path.join(reviewDir, `${path.basename(candidate.sourcePath, ".json")}.json`), {
        source_path: candidate.sourcePath,
        seed: candidate.seed,
        source_record: candidate.sourceRecord,
        raw_summary: candidate.summaryRaw,
        ai_decision: record.decision,
      });
      summary.reused_review++;
    } else if (record.decision?.decision === "reject") {
      await writeJson(path.join(rejectDir, path.basename(candidate.sourcePath)), {
        source_path: candidate.sourcePath,
        seed: candidate.seed,
        source_record: candidate.sourceRecord,
        raw_summary: candidate.summaryRaw,
        ai_decision: record.decision,
      });
      summary.reused_reject++;
    } else if (record.decision?.decision === "accept") {
      summary.reused_accept++;
    }

    summary.matched++;
  }

  await writeJson(path.join(newOutDir, "bootstrap_summary.json"), summary);
  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = await bootstrapReviewReuse({
    oldReviewDir: args.oldReviewDir,
    newInputDirs: args.newInputDirs,
    newOutDir: args.newOutDir,
    includeReview: args.includeReview,
  });
  console.log(
    `Reused ${summary.matched} prior AI decisions into ${args.newOutDir}. ` +
    `Accept ${summary.reused_accept}, review ${summary.reused_review}, reject ${summary.reused_reject}, unmatched ${summary.unmatched}.`,
  );
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.endsWith("tsb-reuse-nhtsa-review.mjs")) {
  main().catch(error => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}
