#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RUNTIME_CONFIG } from "../web/src/lib/runtime-config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const DEFAULT_PUSH_CASE_URL = `${RUNTIME_CONFIG.edgeFunctionsUrl}/push-case`;
const DEFAULT_ANON_KEY = RUNTIME_CONFIG.supabaseAnonKey;
const DEFAULT_INPUTS = [
  path.join(REPO_ROOT, "seed_vw_full_20260319_145646"),
  path.join(REPO_ROOT, "seed_skoda"),
];
const DEFAULT_USER_ID = "ai_importer";
const MIN_RESOLUTION_LENGTH = 10;
const MAX_RESOLUTION_LENGTH = 400;

export function stripLeadingBom(text) {
  return typeof text === "string" ? text.replace(/^\uFEFF/, "") : "";
}

export function parseSeedJson(rawText) {
  return JSON.parse(stripLeadingBom(rawText));
}

function usage(exitCode = 1) {
  console.log(`
Usage:
  node scripts/import-seeds-to-supabase.mjs [input_dir_or_file ...] [options]

Examples:
  node scripts/import-seeds-to-supabase.mjs
  node scripts/import-seeds-to-supabase.mjs seed_vw_full_20260319_145646 seed_skoda
  node scripts/import-seeds-to-supabase.mjs seed_vw_full_20260319_145646 --limit 10 --dry

Options:
  --url <push_case_url>     Override push-case endpoint URL
  --anon-key <key>          Override Supabase anon key
  --user-id <uuid>          Override user_id for all imported records
  --limit <n>               Import only first N files
  --skip <n>                Skip first N files
  --errors-from <jsonl>     Retry files that failed in a previous results.jsonl log
  --sleep-ms <ms>           Wait this long between requests (default 250)
  --out-dir <dir>           Directory for JSONL import log
  --dry                     Validate and log without sending
`.trim());
  process.exit(exitCode);
}

export function parseArgs(argv) {
  const args = {
    inputs: [],
    url: DEFAULT_PUSH_CASE_URL,
    anonKey: DEFAULT_ANON_KEY,
    userId: "",
    limit: Infinity,
    skip: 0,
    errorsFrom: "",
    sleepMs: 250,
    outDir: "",
    dry: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token) continue;
    if (token === "--dry") {
      args.dry = true;
      continue;
    }
    if (token === "--url") {
      args.url = argv[++i] ?? "";
      continue;
    }
    if (token === "--anon-key") {
      args.anonKey = argv[++i] ?? "";
      continue;
    }
    if (token === "--user-id") {
      args.userId = (argv[++i] ?? "").trim();
      continue;
    }
    if (token === "--limit") {
      args.limit = Number(argv[++i] ?? "");
      continue;
    }
    if (token === "--skip") {
      args.skip = Number(argv[++i] ?? "");
      continue;
    }
    if (token === "--errors-from") {
      args.errorsFrom = argv[++i] ?? "";
      continue;
    }
    if (token === "--sleep-ms") {
      args.sleepMs = Number(argv[++i] ?? "");
      continue;
    }
    if (token === "--out-dir") {
      args.outDir = argv[++i] ?? "";
      continue;
    }
    if (token.startsWith("--")) usage(1);
    args.inputs.push(token);
  }

  if (!args.inputs.length && !args.errorsFrom) args.inputs = [...DEFAULT_INPUTS];
  if (!Number.isFinite(args.limit) || args.limit < 1) args.limit = Infinity;
  if (!Number.isFinite(args.skip) || args.skip < 0) args.skip = 0;
  if (!Number.isFinite(args.sleepMs) || args.sleepMs < 0) args.sleepMs = 250;
  if (!args.url || !args.anonKey) {
    throw new Error("Missing Supabase push-case URL or anon key.");
  }

  return args;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function collectSeedJsonFiles(inputPath) {
  const resolved = path.resolve(inputPath);
  const stat = await fs.stat(resolved);

  if (stat.isFile()) {
    if (path.extname(resolved).toLowerCase() !== ".json") {
      throw new Error(`Input file is not JSON: ${resolved}`);
    }
    return [resolved];
  }

  if (!stat.isDirectory()) {
    throw new Error(`Input path is neither file nor directory: ${resolved}`);
  }

  const readyDir = path.join(resolved, "ready");
  const scanDir = await pathExists(readyDir) ? readyDir : resolved;
  const entries = await fs.readdir(scanDir, { withFileTypes: true });

  return entries
    .filter(entry => entry.isFile() && path.extname(entry.name).toLowerCase() === ".json")
    .map(entry => path.join(scanDir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

export function normalizeResolutionText(value) {
  const normalized = typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : "";

  if (normalized.length <= MAX_RESOLUTION_LENGTH) {
    return normalized;
  }

  const hardLimit = MAX_RESOLUTION_LENGTH - 3;
  const candidate = normalized.slice(0, hardLimit).trim();
  const preferredBoundary = Math.max(120, Math.floor(MAX_RESOLUTION_LENGTH * 0.6));
  const sentenceBoundary = Math.max(
    candidate.lastIndexOf(". "),
    candidate.lastIndexOf("! "),
    candidate.lastIndexOf("? "),
    candidate.lastIndexOf("; "),
  );

  if (sentenceBoundary >= preferredBoundary) {
    return candidate.slice(0, sentenceBoundary + 1).trim();
  }

  const wordBoundary = candidate.lastIndexOf(" ");
  const safeCut = wordBoundary >= preferredBoundary ? candidate.slice(0, wordBoundary).trim() : candidate;
  return `${safeCut}...`;
}

export function normalizeSeedPayload(seed, fallbackUserId = DEFAULT_USER_ID, forcedUserId = "") {
  const resolvedUserId = forcedUserId || (seed?.user_id ?? fallbackUserId).toString().trim() || fallbackUserId;
  const threadUrl = typeof seed?.thread_url === "string" && seed.thread_url.trim()
    ? seed.thread_url.trim()
    : typeof seed?.metadata?.thread_url === "string" && seed.metadata.thread_url.trim()
      ? seed.metadata.thread_url.trim()
      : null;
  return {
    local_id: (seed?.local_id ?? "").toString().trim(),
    user_id: resolvedUserId,
    thread_url: threadUrl,
    vehicle_brand: seed?.vehicle_brand ?? null,
    vehicle_model: seed?.vehicle_model ?? null,
    mileage: Number.isFinite(seed?.mileage) ? Math.trunc(seed.mileage) : null,
    engine_power: seed?.engine_power ?? null,
    symptoms: Array.isArray(seed?.symptoms) ? seed.symptoms.filter(Boolean) : [],
    obd_codes: Array.isArray(seed?.obd_codes) ? seed.obd_codes.filter(Boolean) : [],
    description: typeof seed?.description === "string" ? seed.description : "",
    resolution: normalizeResolutionText(seed?.resolution),
    closed_at: typeof seed?.closed_at === "string" && seed.closed_at.trim()
      ? seed.closed_at
      : new Date().toISOString(),
  };
}

export function wasResolutionTruncated(seed, normalizedResolution) {
  const rawResolution = typeof seed?.resolution === "string"
    ? seed.resolution.replace(/\s+/g, " ").trim()
    : "";
  return rawResolution !== normalizedResolution;
}

function validatePayload(payload, filePath) {
  if (!payload.local_id) throw new Error(`Missing local_id in ${filePath}`);
  if (!payload.vehicle_model) throw new Error(`Missing vehicle_model in ${filePath}`);
  if (!payload.resolution?.trim()) throw new Error(`Missing resolution in ${filePath}`);
  if (payload.resolution.length < MIN_RESOLUTION_LENGTH) {
    throw new Error(`Resolution too short after normalization in ${filePath}`);
  }
  if (payload.resolution.length > MAX_RESOLUTION_LENGTH) {
    throw new Error(`Resolution too long after normalization in ${filePath}`);
  }
}

async function loadSeedPayload(filePath, forcedUserId = "") {
  const raw = parseSeedJson(await fs.readFile(filePath, "utf8"));
  const payload = normalizeSeedPayload(raw, DEFAULT_USER_ID, forcedUserId);
  validatePayload(payload, filePath);
  return {
    payload,
    resolutionTruncated: wasResolutionTruncated(raw, payload.resolution),
  };
}

async function appendJsonLine(filePath, obj) {
  await fs.appendFile(filePath, `${JSON.stringify(obj)}\n`, "utf8");
}

export async function collectRetryErrorFiles(resultsJsonlPath) {
  const resolved = path.resolve(resultsJsonlPath);
  const raw = await fs.readFile(resolved, "utf8");
  const files = new Set();

  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line);
    if (entry?.status !== "error" || !entry?.file) continue;
    files.add(path.resolve(REPO_ROOT, entry.file));
  }

  return [...files].sort((a, b) => a.localeCompare(b));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pushCase({ url, anonKey, payload }) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return {
    ok: response.ok && data?.ok !== false,
    status: response.status,
    data,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = args.outDir
    ? path.resolve(args.outDir)
    : path.join(REPO_ROOT, `seed_import_supabase_${timestamp}`);
  const logPath = path.join(outDir, "results.jsonl");

  await fs.mkdir(outDir, { recursive: true });

  const files = [];
  for (const input of args.inputs) {
    const discovered = await collectSeedJsonFiles(input);
    files.push(...discovered);
  }
  if (args.errorsFrom) {
    const retryFiles = await collectRetryErrorFiles(args.errorsFrom);
    files.push(...retryFiles);
  }

  const dedupedFiles = [...new Set(files)];
  const selectedFiles = dedupedFiles.slice(args.skip, Number.isFinite(args.limit) ? args.skip + args.limit : undefined);
  if (!selectedFiles.length) {
    console.log("No seed JSON files found to import.");
    return;
  }

  let success = 0;
  let failed = 0;

  console.log(`Importing ${selectedFiles.length} seed file(s) to ${args.url}`);
  console.log(`Log: ${logPath}`);

  for (let i = 0; i < selectedFiles.length; i++) {
    const filePath = selectedFiles[i];
    const startedAt = new Date().toISOString();
    const relPath = path.relative(REPO_ROOT, filePath);

    try {
      const { payload, resolutionTruncated } = await loadSeedPayload(filePath, args.userId);

      if (args.dry) {
        await appendJsonLine(logPath, {
          file: relPath,
          local_id: payload.local_id,
          status: "dry",
          resolution_length: payload.resolution.length,
          resolution_truncated: resolutionTruncated,
          started_at: startedAt,
        });
        success++;
      } else {
        const result = await pushCase({ url: args.url, anonKey: args.anonKey, payload });
        const status = result.ok ? "ok" : "error";
        await appendJsonLine(logPath, {
          file: relPath,
          local_id: payload.local_id,
          status,
          http_status: result.status,
          resolution_length: payload.resolution.length,
          resolution_truncated: resolutionTruncated,
          response: result.data,
          started_at: startedAt,
        });
        if (!result.ok) {
          failed++;
          console.log(`[${i + 1}/${selectedFiles.length}] ERROR ${relPath} (${result.status})`);
        } else {
          success++;
          console.log(`[${i + 1}/${selectedFiles.length}] OK ${relPath}`);
        }
      }
    } catch (error) {
      failed++;
      await appendJsonLine(logPath, {
        file: relPath,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        started_at: startedAt,
      });
      console.log(`[${i + 1}/${selectedFiles.length}] ERROR ${relPath}`);
    }

    if (!args.dry && args.sleepMs > 0 && i < selectedFiles.length - 1) {
      await sleep(args.sleepMs);
    }
  }

  console.log(`Done. Success: ${success}, Failed: ${failed}, Total: ${selectedFiles.length}`);
  console.log(`Log written to: ${logPath}`);

  if (failed > 0) process.exitCode = 1;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  main().catch(error => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}
