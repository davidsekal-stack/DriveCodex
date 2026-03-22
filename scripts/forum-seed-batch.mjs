#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

const BOOL_FLAGS = new Set([
  "--discover-only",
  "--signals-only",
  "--keep-review",
  "--dry",
]);

const VALUE_FLAGS = new Set([
  "--index-pages",
  "--pages",
  "--sleep-ms",
  "--min-posts",
  "--forum",
  "--user-id",
  "--source-url",
  "--cookie",
  "--model",
  "--max-chars",
]);

const BATCH_TARGETS = [
  {
    slug: "citroen",
    display: "Citroen",
    script: "forum-seed-citroen.mjs",
    rootUrl: "https://www.citroen-club.cz/forum",
    tokens: [
      "citroen",
      "citroën",
      "citroen-club",
      "www.citroen-club.cz",
      "www.citroen-club.cz/forum",
      "citroen-club.cz",
      "citroen-club.cz/forum",
      "https://www.citroen-club.cz/",
      "https://www.citroen-club.cz/forum",
    ],
  },
  {
    slug: "bmw",
    display: "BMW",
    script: "forum-seed-bmw.mjs",
    rootUrl: "https://www.bmw-club.cz/forum",
    tokens: [
      "bmw",
      "bmw-club",
      "www.bmw-club.cz",
      "www.bmw-club.cz/forum",
      "bmw-club.cz",
      "bmw-club.cz/forum",
      "https://www.bmw-club.cz/",
      "https://www.bmw-club.cz/forum",
    ],
  },
  {
    slug: "opel",
    display: "Opel",
    script: "forum-seed-opel.mjs",
    rootUrl: "https://www.club-opel.com/forum",
    tokens: [
      "opel",
      "club-opel",
      "www.club-opel.com",
      "www.club-opel.com/forum",
      "club-opel.com",
      "club-opel.com/forum",
      "https://www.club-opel.com/",
      "https://www.club-opel.com/forum",
    ],
  },
  {
    slug: "seat",
    display: "SEAT",
    script: "forum-seed-seat.mjs",
    rootUrl: "https://www.seatclub.cz/forum",
    tokens: [
      "seat",
      "seatclub",
      "www.seatclub.cz",
      "www.seatclub.cz/forum",
      "seatclub.cz",
      "seatclub.cz/forum",
      "https://www.seatclub.cz/",
      "https://www.seatclub.cz/forum",
    ],
  },
];

const DEFAULT_BATCH_TARGETS = BATCH_TARGETS.map((target) => target.rootUrl);

function usage(code = 0) {
  console.log(`Usage:
  node scripts/forum-seed-batch.mjs <out_dir> [targets...] [options]

Targets:
  citroen | bmw | opel | seat
  or their root forum URLs

If no targets are provided, the batch runs all default club roots:
  ${DEFAULT_BATCH_TARGETS.join("\n  ")}

Examples:
  node scripts/forum-seed-batch.mjs seed_batch_20260321 --discover-only
  node scripts/forum-seed-batch.mjs seed_batch_20260321 citroen seat --signals-only --keep-review --index-pages 999 --pages 3 --sleep-ms 400 --min-posts 2
`);
  process.exit(code);
}

function stripDiacritics(value) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function normalizeTargetToken(value) {
  if (!value) return "";
  let normalized = stripDiacritics(String(value).trim().toLowerCase());
  normalized = normalized.replace(/^https?:\/\//, "");
  normalized = normalized.replace(/\/+$/, "");

  if (normalized === "www.bmw-club.cz") normalized = "www.bmw-club.cz/forum";
  if (normalized === "bmw-club.cz") normalized = "bmw-club.cz/forum";
  if (normalized === "www.seatclub.cz") normalized = "www.seatclub.cz/forum";
  if (normalized === "seatclub.cz") normalized = "seatclub.cz/forum";
  if (normalized === "www.club-opel.com") normalized = "www.club-opel.com/forum";
  if (normalized === "club-opel.com") normalized = "club-opel.com/forum";
  if (normalized === "www.citroen-club.cz") normalized = "www.citroen-club.cz/forum";
  if (normalized === "citroen-club.cz") normalized = "citroen-club.cz/forum";

  return normalized;
}

const TARGET_INDEX = new Map();
for (const target of BATCH_TARGETS) {
  TARGET_INDEX.set(normalizeTargetToken(target.slug), target);
  for (const token of target.tokens) TARGET_INDEX.set(normalizeTargetToken(token), target);
}

export function resolveBatchTargets(tokens) {
  const requested = Array.isArray(tokens) && tokens.length > 0 ? tokens : DEFAULT_BATCH_TARGETS;
  const resolved = [];
  const seen = new Set();

  for (const token of requested) {
    const normalized = normalizeTargetToken(token);
    const target = TARGET_INDEX.get(normalized);
    if (!target) {
      throw new Error(`Unsupported batch target: ${token}`);
    }
    if (seen.has(target.slug)) continue;
    seen.add(target.slug);
    resolved.push(target);
  }

  return resolved;
}

export function parseArgs(argv) {
  const args = {
    outDir: null,
    targetTokens: [],
    forwardedArgs: [],
  };

  const positional = [];

  for (let index = 0; index < argv.length; index++) {
    const current = argv[index];
    if (!current) continue;

    if (current === "--help" || current === "-h") usage(0);

    if (BOOL_FLAGS.has(current)) {
      args.forwardedArgs.push(current);
      continue;
    }

    if (VALUE_FLAGS.has(current)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${current}`);
      }
      args.forwardedArgs.push(current, value);
      index++;
      continue;
    }

    if (current.startsWith("--")) {
      throw new Error(`Unknown batch option: ${current}`);
    }

    positional.push(current);
  }

  args.outDir = positional[0] ?? null;
  args.targetTokens = positional.slice(1);
  return args;
}

export function buildChildArgs(target, batchArgs) {
  return [
    path.join(SCRIPT_DIR, target.script),
    target.rootUrl,
    path.join(batchArgs.outDir, target.slug),
    ...batchArgs.forwardedArgs,
  ];
}

function spawnCrawler(target, batchArgs) {
  return new Promise((resolve, reject) => {
    const childArgs = buildChildArgs(target, batchArgs);
    const child = spawn(process.execPath, childArgs, {
      cwd: REPO_ROOT,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args.outDir) usage(1);

  const targets = resolveBatchTargets(args.targetTokens);
  await fs.mkdir(args.outDir, { recursive: true });

  const summary = [];
  let failures = 0;

  for (let index = 0; index < targets.length; index++) {
    const target = targets[index];
    console.log(`[${index + 1}/${targets.length}] ${target.display} start: ${target.rootUrl}`);
    const exitCode = await spawnCrawler(target, args);
    summary.push({
      slug: target.slug,
      display: target.display,
      root_url: target.rootUrl,
      out_dir: path.join(args.outDir, target.slug),
      exit_code: exitCode,
      ok: exitCode === 0,
    });
    if (exitCode !== 0) failures++;
  }

  const summaryPath = path.join(args.outDir, "batch_summary.json");
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  if (failures > 0) {
    console.error(`Batch finished with ${failures} failed job(s). Summary: ${summaryPath}`);
    process.exit(1);
  }

  console.log(`Batch finished successfully. Summary: ${summaryPath}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
