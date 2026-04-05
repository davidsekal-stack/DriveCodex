#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

import { parseTsbLine, hasSupportedCatalogBrand, isExcludedCommercialModel } from "./tsb-seed-nhtsa.mjs";
import { validateSubset } from "./nhtsa-validate-final-subset.mjs";

const execFile = promisify(execFileCb);

const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_STATE_ROOT = path.join(process.cwd(), "tmp", "nhtsa_runs");
const DEFAULT_IMPORT_USER_ID = "8463d502-7bf6-464b-9fb2-e6dec5b9d4d3";
const AUTOMATION_BRANCH = "codex/nhtsa-automation";
const TERMINAL_STATUSES = new Set([
  "dry_import_done",
  "live_import_done",
  "rejected",
  "blocked",
  "done",
]);
const STOP_AFTER_VALUES = new Set(["sync", "coarse", "refined", "deepseek", "second-pass", "codex-review", "codex-validate", "dry", "live"]);

function usage(exitCode = 1) {
  console.log(`
Usage:
  node scripts/nhtsa-supercrawler.mjs <input_dir> [options]

Examples:
  node scripts/nhtsa-supercrawler.mjs C:\\Users\\sekald\\Downloads\\TSBS_RECEIVED_2020-2024
  node scripts/nhtsa-supercrawler.mjs C:\\Users\\sekald\\Downloads\\TSBS_RECEIVED_2020-2024 --state-root C:\\GB-nhtsa\\tmp\\nhtsa_runs

Options:
  --state-root <dir>          Where run manifests and per-brand workspaces live
  --file <basename>           Process only one input file
  --make <make>               Process only one make within discovered supported brands
  --model <name>              DeepSeek model for AI review steps. Default: ${DEFAULT_MODEL}
  --user-id <id>              User id written into generated seeds before import. Default: ${DEFAULT_IMPORT_USER_ID}
  --push-case-url <url>       Override push-case endpoint for import steps
  --anon-key <key>            Override Supabase anon key for import steps
  --import-sleep-ms <ms>      Delay between import requests. Default: 200
  --live                      After dry import, also run live import
  --stop-after <phase>        Stop after one phase: sync, coarse, refined, deepseek, second-pass, codex-review, codex-validate, dry, live
  --allow-main-branch         Disable the branch safety guard
  --help                      Show help
`.trim());
  process.exit(exitCode);
}

export function parseArgs(argv) {
  const args = {
    inputDir: "",
    stateRoot: DEFAULT_STATE_ROOT,
    fileName: "",
    make: "",
    model: DEFAULT_MODEL,
    userId: DEFAULT_IMPORT_USER_ID,
    pushCaseUrl: "",
    anonKey: "",
    importSleepMs: 200,
    live: false,
    stopAfter: "",
    allowMainBranch: false,
  };

  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--help" || token === "-h") usage(0);
    if (token === "--state-root") {
      args.stateRoot = path.resolve(argv[++i] ?? "");
      continue;
    }
    if (token === "--file") {
      args.fileName = (argv[++i] ?? "").trim();
      continue;
    }
    if (token === "--make") {
      args.make = (argv[++i] ?? "").trim();
      continue;
    }
    if (token === "--model") {
      args.model = (argv[++i] ?? "").trim() || DEFAULT_MODEL;
      continue;
    }
    if (token === "--user-id") {
      args.userId = (argv[++i] ?? "").trim() || DEFAULT_IMPORT_USER_ID;
      continue;
    }
    if (token === "--push-case-url") {
      args.pushCaseUrl = (argv[++i] ?? "").trim();
      continue;
    }
    if (token === "--anon-key") {
      args.anonKey = (argv[++i] ?? "").trim();
      continue;
    }
    if (token === "--import-sleep-ms") {
      const value = Number(argv[++i] ?? "");
      args.importSleepMs = Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 200;
      continue;
    }
    if (token === "--live") {
      args.live = true;
      continue;
    }
    if (token === "--stop-after") {
      const value = cleanText(argv[++i] ?? "").toLowerCase();
      if (!STOP_AFTER_VALUES.has(value)) {
        throw new Error(`Unsupported --stop-after value '${value}'. Expected one of: ${[...STOP_AFTER_VALUES].join(", ")}`);
      }
      args.stopAfter = value;
      continue;
    }
    if (token === "--allow-main-branch") {
      args.allowMainBranch = true;
      continue;
    }
    if (token.startsWith("--")) usage(1);
    positional.push(token);
  }

  if (positional.length !== 1) usage(1);
  args.inputDir = path.resolve(positional[0]);
  return args;
}

function cleanText(value) {
  return (value ?? "").toString().replace(/^\uFEFF/, "").replace(/\s+/g, " ").trim();
}

export function isNhtsaInputFileName(fileName) {
  return /^TSBS_RECEIVED_\d{4}-\d{4}\.txt$/i.test(cleanText(fileName));
}

export function makeFileKey(fileNameOrPath) {
  const base = path.basename(fileNameOrPath, path.extname(fileNameOrPath));
  return cleanText(base).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function makeBrandKey(make) {
  return cleanText(make).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function chooseNextBrand(brands) {
  return [...brands]
    .filter(brand => !TERMINAL_STATUSES.has(brand.status))
    .sort((a, b) => {
      const byStatus = statusRank(a.status) - statusRank(b.status);
      if (byStatus !== 0) return byStatus;
      const byCount = Number(b.supported_rows ?? 0) - Number(a.supported_rows ?? 0);
      if (byCount !== 0) return byCount;
      return cleanText(a.make).localeCompare(cleanText(b.make));
    })[0] ?? null;
}

function statusRank(status) {
  switch (status) {
    case "discovered": return 0;
    case "coarse_done": return 1;
    case "refined_done": return 2;
    case "deepseek_done": return 3;
    case "second_pass_done": return 4;
    case "awaiting_codex_review": return 5;
    case "awaiting_codex_validate": return 6;
    case "codex_validate_done": return 7;
    case "dry_import_done": return 8;
    case "live_import_done": return 9;
    default: return 99;
  }
}

async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath, payload) {
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function readJson(filePath, fallback = null) {
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

async function findInputFiles(inputDir, fileNameFilter = "") {
  const entries = await fsp.readdir(inputDir, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile() && isNhtsaInputFileName(entry.name))
    .map(entry => path.join(inputDir, entry.name))
    .filter(fullPath => !fileNameFilter || path.basename(fullPath).toLowerCase() === fileNameFilter.toLowerCase())
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

export async function discoverSupportedMakesInFile(filePath) {
  const counts = new Map();
  const sampleModels = new Map();
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const record = parseTsbLine(line);
    if (!record) continue;
    if (isExcludedCommercialModel(record)) continue;
    if (!hasSupportedCatalogBrand(record.make)) continue;
    const key = cleanText(record.make).toUpperCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!sampleModels.has(key)) sampleModels.set(key, new Set());
    if (sampleModels.get(key).size < 8) sampleModels.get(key).add(cleanText(record.model));
  }
  return [...counts.entries()]
    .map(([make, supported_rows]) => ({
      make,
      brand_key: makeBrandKey(make),
      supported_rows,
      sample_models: [...(sampleModels.get(make) ?? [])].sort(),
    }))
    .sort((a, b) => b.supported_rows - a.supported_rows || a.make.localeCompare(b.make));
}

async function getCurrentGitBranch(cwd) {
  const { stdout } = await execFile("git", ["-C", cwd, "rev-parse", "--abbrev-ref", "HEAD"]);
  return cleanText(stdout);
}

async function ensureSafeBranch(cwd, allowMainBranch) {
  if (allowMainBranch) return;
  const branch = await getCurrentGitBranch(cwd).catch(() => "");
  if (!branch) return;
  if (branch === "main" || branch === "master") {
    throw new Error(`Refusing to run nhtsa-supercrawler on branch '${branch}'. Use a dedicated automation branch like '${AUTOMATION_BRANCH}' or pass --allow-main-branch.`);
  }
}

async function acquireLock(lockPath, payload) {
  await ensureDir(path.dirname(lockPath));
  try {
    const handle = await fsp.open(lockPath, "wx");
    await handle.writeFile(`${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await handle.close();
    return true;
  } catch (error) {
    if (error?.code === "EEXIST") return false;
    throw error;
  }
}

async function releaseLock(lockPath) {
  await fsp.rm(lockPath, { force: true });
}

async function spawnNodeScript(scriptPath, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", code => {
      if (code === 0) resolve();
      else reject(new Error(`Child process failed (${path.basename(scriptPath)}) with exit code ${code}.`));
    });
  });
}

function buildFileManifest(filePath, brands) {
  return {
    file_path: filePath,
    file_key: makeFileKey(filePath),
    discovered_at: new Date().toISOString(),
    status: "discovered",
    brands,
  };
}

function buildBrandManifest(filePath, brand, brandDir) {
  return {
    file_path: filePath,
    file_key: makeFileKey(filePath),
    brand_key: brand.brand_key,
    make: brand.make,
    supported_rows: brand.supported_rows,
    sample_models: brand.sample_models,
    status: "discovered",
    iteration_count: 0,
    why_refined_again: null,
    reused_decisions_count: 0,
    refined_from_previous_run: null,
    directories: {
      brand_root: brandDir,
      coarse: path.join(brandDir, "01_coarse"),
      refined: path.join(brandDir, "02_refined"),
      deepseek: path.join(brandDir, "03_deepseek_review"),
      second_pass: path.join(brandDir, "04_second_pass"),
      codex_review: path.join(brandDir, "05_codex_review"),
      codex_validate: path.join(brandDir, "06_codex_validate"),
      final_subset: path.join(brandDir, "07_final_subset"),
      import_dry: path.join(brandDir, "08_import_dry"),
      import_live: path.join(brandDir, "09_import_live"),
    },
    steps: {},
  };
}

async function syncState(args) {
  await ensureDir(args.stateRoot);
  const filePaths = await findInputFiles(args.inputDir, args.fileName);
  const synced = [];

  for (const filePath of filePaths) {
    const fileKey = makeFileKey(filePath);
    const fileDir = path.join(args.stateRoot, fileKey);
    await ensureDir(fileDir);
    const fileManifestPath = path.join(fileDir, "run_manifest.json");
    const discoveredBrands = await discoverSupportedMakesInFile(filePath);
    const existing = await readJson(fileManifestPath, null);
    const existingByKey = new Map((existing?.brands ?? []).map(brand => [brand.brand_key, brand]));
    const brands = [];

    for (const brand of discoveredBrands) {
      if (args.make && cleanText(brand.make).toUpperCase() !== cleanText(args.make).toUpperCase()) continue;
      const brandDir = path.join(fileDir, brand.brand_key);
      await ensureDir(brandDir);
      const brandManifestPath = path.join(brandDir, "brand_manifest.json");
      const existingBrand = await readJson(brandManifestPath, null) ?? existingByKey.get(brand.brand_key) ?? null;
      const manifest = existingBrand
        ? {
            ...existingBrand,
            file_path: filePath,
            make: brand.make,
            supported_rows: brand.supported_rows,
            sample_models: brand.sample_models,
          }
        : buildBrandManifest(filePath, brand, brandDir);
      await writeJson(brandManifestPath, manifest);
      brands.push({
        make: manifest.make,
        brand_key: manifest.brand_key,
        supported_rows: manifest.supported_rows,
        status: manifest.status,
        manifest_path: brandManifestPath,
      });
    }

    const nextStatus = brands.every(brand => TERMINAL_STATUSES.has(brand.status)) ? "done" : "discovered";
    const fileManifest = existing
      ? {
          ...existing,
          file_path: filePath,
          file_key: fileKey,
          status: nextStatus,
          brands,
        }
      : buildFileManifest(filePath, brands);
    fileManifest.status = nextStatus;
    await writeJson(fileManifestPath, fileManifest);
    synced.push({ filePath, fileKey, fileDir, fileManifestPath, brands });
  }

  return synced;
}

function buildCodexReviewJob(brandManifest) {
  return {
    type: "codex_review",
    status: "pending",
    checklist: [
      "Review every candidate individually, not only by pattern group.",
      "Reject weak software-only, comfort, nuisance, NVH and conditional cases.",
      "Confirm catalog mapping is not suspicious.",
      "If model is missing or mapped incorrectly, verify from multiple official sources and prepare a safe catalog update before keeping the seed.",
      "Keep symptom tags short and remove redundant DTC symptom tags when OBD codes already carry the code.",
    ],
    input_dir: brandManifest.directories.second_pass,
    expected_output_dir: brandManifest.directories.final_subset,
  };
}

function buildCodexValidateJob(brandManifest) {
  return {
    type: "codex_validate",
    status: "pending",
    checklist: [
      "Does every seed represent a diagnostically relevant closed case?",
      "Are symptoms specific and concise?",
      "Is the repair explicit and non-conditional?",
      "Is the catalog mapping correct?",
      "Are there any duplicate semantic variants left?",
    ],
    input_dir: brandManifest.directories.final_subset,
    expected_output_dir: brandManifest.directories.import_dry,
  };
}

async function runCoarseStep(brandManifest, filePath, cwd, userId) {
  await spawnNodeScript(path.join(cwd, "scripts", "tsb-seed-nhtsa.mjs"), [
    filePath,
    brandManifest.directories.coarse,
    "--make",
    brandManifest.make,
    "--user-id",
    userId,
  ], cwd);
  brandManifest.steps.coarse = {
    out_dir: brandManifest.directories.coarse,
    summary_path: path.join(brandManifest.directories.coarse, "summary.json"),
  };
  brandManifest.status = "coarse_done";
}

async function runRefineStep(brandManifest, cwd) {
  await spawnNodeScript(path.join(cwd, "scripts", "nhtsa-refine-pass.mjs"), [
    brandManifest.directories.coarse,
    brandManifest.directories.refined,
  ], cwd);
  brandManifest.steps.refined = {
    out_dir: brandManifest.directories.refined,
    summary_path: path.join(brandManifest.directories.refined, "summary.json"),
  };
  brandManifest.status = "refined_done";
}

async function runDeepseekStep(brandManifest, cwd, model) {
  await spawnNodeScript(path.join(cwd, "scripts", "tsb-review-nhtsa-ai.mjs"), [
    brandManifest.directories.refined,
    brandManifest.directories.deepseek,
    "--model",
    model,
  ], cwd);
  brandManifest.steps.deepseek = {
    out_dir: brandManifest.directories.deepseek,
    summary_path: path.join(brandManifest.directories.deepseek, "summary.json"),
  };
  brandManifest.status = "deepseek_done";
}

async function runSecondPassStep(brandManifest, cwd, model) {
  await spawnNodeScript(path.join(cwd, "scripts", "tsb-second-pass-nhtsa-ai.mjs"), [
    brandManifest.directories.deepseek,
    brandManifest.directories.second_pass,
    "--model",
    model,
  ], cwd);
  brandManifest.steps.second_pass = {
    out_dir: brandManifest.directories.second_pass,
    summary_path: path.join(brandManifest.directories.second_pass, "summary.json"),
  };
  brandManifest.status = "second_pass_done";
}

async function prepareCodexJobs(brandManifest) {
  await ensureDir(brandManifest.directories.codex_review);
  await ensureDir(brandManifest.directories.codex_validate);
  const reviewJobPath = path.join(brandManifest.directories.codex_review, "review_job.json");
  const validateJobPath = path.join(brandManifest.directories.codex_validate, "validate_job.json");
  await writeJson(reviewJobPath, buildCodexReviewJob(brandManifest));
  await writeJson(validateJobPath, buildCodexValidateJob(brandManifest));
  brandManifest.steps.codex_review = {
    job_path: reviewJobPath,
  };
  brandManifest.steps.codex_validate = {
    job_path: validateJobPath,
  };
  brandManifest.status = "awaiting_codex_review";
}

async function maybeAdvanceFromCodexReview(brandManifest) {
  const resultPath = path.join(brandManifest.directories.codex_review, "review_result.json");
  const result = await readJson(resultPath, null);
  if (!result) {
    return false;
  }

  const status = cleanText(result.status).toLowerCase();
  brandManifest.steps.codex_review = brandManifest.steps.codex_review ?? {
    job_path: path.join(brandManifest.directories.codex_review, "review_job.json"),
  };
  if (status === "rejected") {
    brandManifest.status = "rejected";
    brandManifest.steps.codex_review.result_path = resultPath;
    brandManifest.steps.codex_review.result = result;
    return true;
  }
  if (status === "blocked") {
    brandManifest.status = "blocked";
    brandManifest.steps.codex_review.result_path = resultPath;
    brandManifest.steps.codex_review.result = result;
    return true;
  }
  if (status !== "approved") {
    return false;
  }

  if (cleanText(result.final_subset_dir)) {
    brandManifest.directories.final_subset = path.resolve(result.final_subset_dir);
  }
  brandManifest.steps.codex_review.result_path = resultPath;
  brandManifest.steps.codex_review.result = result;
  brandManifest.status = "awaiting_codex_validate";
  return true;
}

async function maybeAdvanceFromCodexValidate(brandManifest) {
  const resultPath = path.join(brandManifest.directories.codex_validate, "validate_result.json");
  const result = await readJson(resultPath, null);
  if (!result) {
    return false;
  }

  const status = cleanText(result.status).toLowerCase();
  brandManifest.steps.codex_validate = brandManifest.steps.codex_validate ?? {
    job_path: path.join(brandManifest.directories.codex_validate, "validate_job.json"),
  };
  brandManifest.steps.codex_validate.result_path = resultPath;
  brandManifest.steps.codex_validate.result = result;
  if (status === "rejected") {
    brandManifest.status = "rejected";
    return true;
  }
  if (status === "blocked") {
    brandManifest.status = "blocked";
    return true;
  }
  if (status !== "approved") {
    return false;
  }

  brandManifest.status = "codex_validate_done";
  return true;
}

async function runFinalSubsetValidation(brandManifest, cwd) {
  const summary = await validateSubset(
    brandManifest.directories.final_subset,
    brandManifest.directories.codex_validate,
  );
  const summaryPath = path.join(brandManifest.directories.codex_validate, "summary.json");
  brandManifest.steps.final_validation = {
    summary_path: summaryPath,
    summary,
  };
  if (!summary?.approved) {
    brandManifest.status = "blocked";
    return;
  }
  brandManifest.status = "codex_validate_done";
}

async function runDryImportStep(brandManifest, args, cwd) {
  const importArgs = [
    path.join(cwd, "scripts", "import-seeds-to-supabase.mjs"),
    brandManifest.directories.final_subset,
    "--user-id",
    args.userId,
    "--sleep-ms",
    String(args.importSleepMs),
    "--out-dir",
    brandManifest.directories.import_dry,
    "--dry",
  ];
  if (args.pushCaseUrl) {
    importArgs.push("--url", args.pushCaseUrl);
  }
  if (args.anonKey) {
    importArgs.push("--anon-key", args.anonKey);
  }
  await spawnNodeScript(importArgs[0], importArgs.slice(1), cwd);
  const resultsPath = path.join(brandManifest.directories.import_dry, "results.jsonl");
  brandManifest.steps.import_dry = {
    out_dir: brandManifest.directories.import_dry,
    results_path: resultsPath,
  };
  brandManifest.status = "dry_import_done";
}

async function runLiveImportStep(brandManifest, args, cwd) {
  const importArgs = [
    path.join(cwd, "scripts", "import-seeds-to-supabase.mjs"),
    brandManifest.directories.final_subset,
    "--user-id",
    args.userId,
    "--sleep-ms",
    String(args.importSleepMs),
    "--out-dir",
    brandManifest.directories.import_live,
  ];
  if (args.pushCaseUrl) {
    importArgs.push("--url", args.pushCaseUrl);
  }
  if (args.anonKey) {
    importArgs.push("--anon-key", args.anonKey);
  }
  await spawnNodeScript(importArgs[0], importArgs.slice(1), cwd);
  const resultsPath = path.join(brandManifest.directories.import_live, "results.jsonl");
  brandManifest.steps.import_live = {
    out_dir: brandManifest.directories.import_live,
    results_path: resultsPath,
  };
  brandManifest.status = "live_import_done";
}

async function persistBrandManifest(brandManifestPath, brandManifest) {
  await writeJson(brandManifestPath, brandManifest);
}

async function runAutomaticPhases(args, targetBrand) {
  const brandManifest = await readJson(targetBrand.manifest_path, null);
  if (!brandManifest) {
    throw new Error(`Missing brand manifest: ${targetBrand.manifest_path}`);
  }

  if (TERMINAL_STATUSES.has(brandManifest.status)) {
    return { status: "noop", reason: `Brand already in terminal state ${brandManifest.status}.`, brandManifest };
  }

  const cwd = process.cwd();
  const userId = args.userId || process.env.IMPORTER_USER_ID || DEFAULT_IMPORT_USER_ID;

  if (brandManifest.status === "discovered") {
    await runCoarseStep(brandManifest, brandManifest.file_path, cwd, userId);
    await persistBrandManifest(targetBrand.manifest_path, brandManifest);
    if (args.stopAfter === "coarse") {
      return { status: brandManifest.status, brandManifest };
    }
  }
  if (brandManifest.status === "coarse_done") {
    await runRefineStep(brandManifest, cwd);
    await persistBrandManifest(targetBrand.manifest_path, brandManifest);
    if (args.stopAfter === "refined") {
      return { status: brandManifest.status, brandManifest };
    }
  }
  if (brandManifest.status === "refined_done") {
    await runDeepseekStep(brandManifest, cwd, args.model);
    await persistBrandManifest(targetBrand.manifest_path, brandManifest);
    if (args.stopAfter === "deepseek") {
      return { status: brandManifest.status, brandManifest };
    }
  }
  if (brandManifest.status === "deepseek_done") {
    await runSecondPassStep(brandManifest, cwd, args.model);
    await persistBrandManifest(targetBrand.manifest_path, brandManifest);
    if (args.stopAfter === "second-pass") {
      return { status: brandManifest.status, brandManifest };
    }
  }
  if (brandManifest.status === "second_pass_done") {
    await prepareCodexJobs(brandManifest);
    await persistBrandManifest(targetBrand.manifest_path, brandManifest);
    if (args.stopAfter === "codex-review") {
      return { status: brandManifest.status, brandManifest };
    }
  }
  if (brandManifest.status === "awaiting_codex_review") {
    const advanced = await maybeAdvanceFromCodexReview(brandManifest);
    if (advanced) {
      await persistBrandManifest(targetBrand.manifest_path, brandManifest);
    } else {
      return {
        status: brandManifest.status,
        reason: "Waiting for codex review result.",
        brandManifest,
      };
    }
  }
  if (brandManifest.status === "awaiting_codex_validate") {
    const advanced = await maybeAdvanceFromCodexValidate(brandManifest);
    if (advanced) {
      await persistBrandManifest(targetBrand.manifest_path, brandManifest);
      if (args.stopAfter === "codex-validate") {
        return { status: brandManifest.status, brandManifest };
      }
    } else {
      return {
        status: brandManifest.status,
        reason: "Waiting for codex validate result.",
        brandManifest,
      };
    }
  }
  if (brandManifest.status === "codex_validate_done") {
    await runFinalSubsetValidation(brandManifest, cwd);
    await persistBrandManifest(targetBrand.manifest_path, brandManifest);
    if (brandManifest.status !== "codex_validate_done") {
      return { status: brandManifest.status, brandManifest };
    }
  }
  if (brandManifest.status === "codex_validate_done") {
    await runDryImportStep(brandManifest, args, cwd);
    await persistBrandManifest(targetBrand.manifest_path, brandManifest);
    if (args.stopAfter === "dry") {
      return { status: brandManifest.status, brandManifest };
    }
  }
  if (brandManifest.status === "dry_import_done" && args.live) {
    await runLiveImportStep(brandManifest, args, cwd);
    await persistBrandManifest(targetBrand.manifest_path, brandManifest);
    if (args.stopAfter === "live") {
      return { status: brandManifest.status, brandManifest };
    }
  }

  return { status: brandManifest.status, brandManifest };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await ensureSafeBranch(process.cwd(), args.allowMainBranch);
  const lockPath = path.join(args.stateRoot, "automation.lock.json");
  const lockPayload = {
    run_id: `run_${Date.now()}`,
    started_at: new Date().toISOString(),
    input_dir: args.inputDir,
    active_step: "sync",
    pid: process.pid,
  };
  const acquired = await acquireLock(lockPath, lockPayload);
  if (!acquired) {
    const existing = await readJson(lockPath, {});
    console.log(`nhtsa-supercrawler: lock exists, skipping run. Active payload: ${JSON.stringify(existing)}`);
    return;
  }

  try {
    const syncedFiles = await syncState(args);
    if (args.stopAfter === "sync") {
      console.log("nhtsa-supercrawler: sync completed; stopping after sync as requested.");
      return;
    }
    const pendingBrands = syncedFiles.flatMap(file => file.brands);
    const nextBrand = chooseNextBrand(pendingBrands);
    if (!nextBrand) {
      console.log("nhtsa-supercrawler: no pending supported automotive brand backlog. Exiting cleanly.");
      return;
    }

    const result = await runAutomaticPhases(args, nextBrand);
    console.log(`nhtsa-supercrawler: ${nextBrand.make} -> ${result.status}`);
  } finally {
    await releaseLock(lockPath);
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
