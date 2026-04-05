#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { execFile as execFileCb } from "node:child_process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

const DEFAULT_STATE_ROOT = path.join(process.cwd(), "tmp", "nhtsa_runs");
const AUTOMATION_BRANCH = "codex/nhtsa-automation";
const JOB_TYPE_ORDER = {
  codex_review: 0,
  codex_validate: 1,
};

function usage(exitCode = 1) {
  console.log(`
Usage:
  node scripts/nhtsa-codex-runner.mjs claim [options]
  node scripts/nhtsa-codex-runner.mjs complete <job_file> [options]

Examples:
  node scripts/nhtsa-codex-runner.mjs claim --state-root C:\\GB-nhtsa\\tmp\\nhtsa_runs
  node scripts/nhtsa-codex-runner.mjs complete C:\\GB-nhtsa\\tmp\\nhtsa_runs\\file\\brand\\05_codex_review\\review_job.json --status approved --final-subset-dir C:\\GB-nhtsa\\tmp\\nhtsa_runs\\file\\brand\\07_final_subset

Claim options:
  --state-root <dir>          Where NHTSA run manifests live. Default: ${DEFAULT_STATE_ROOT}
  --phase <review|validate>   Limit to one Codex phase
  --allow-main-branch         Disable branch safety guard

Complete options:
  --status <value>            approved | rejected | blocked
  --final-subset-dir <dir>    Required for approved review jobs
  --manual-review-path <path> Optional MANUAL_REVIEW.md path for review jobs
  --ready-count <n>           Optional ready count for review jobs
  --rejected-count <n>        Optional rejected count for review jobs
  --notes <text>              Optional notes for validator/reviewer result
  --allow-main-branch         Disable branch safety guard
`.trim());
  process.exit(exitCode);
}

function cleanText(value) {
  return (value ?? "").toString().replace(/^\uFEFF/, "").replace(/\s+/g, " ").trim();
}

function normalizePhase(value) {
  const normalized = cleanText(value).toLowerCase();
  if (!normalized) return "";
  if (normalized === "review") return "codex_review";
  if (normalized === "validate") return "codex_validate";
  if (normalized === "codex_review" || normalized === "codex_validate") return normalized;
  throw new Error(`Unsupported phase '${value}'. Expected review or validate.`);
}

export function parseArgs(argv) {
  const [subcommand, ...rest] = argv;
  if (!subcommand) usage(1);
  if (subcommand !== "claim" && subcommand !== "complete") usage(1);

  const args = {
    subcommand,
    stateRoot: DEFAULT_STATE_ROOT,
    phase: "",
    allowMainBranch: false,
    jobFile: "",
    status: "",
    finalSubsetDir: "",
    manualReviewPath: "",
    readyCount: null,
    rejectedCount: null,
    notes: "",
  };

  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token === "--help" || token === "-h") usage(0);
    if (token === "--state-root") {
      args.stateRoot = path.resolve(rest[++i] ?? "");
      continue;
    }
    if (token === "--phase") {
      args.phase = normalizePhase(rest[++i] ?? "");
      continue;
    }
    if (token === "--allow-main-branch") {
      args.allowMainBranch = true;
      continue;
    }
    if (token === "--status") {
      args.status = cleanText(rest[++i] ?? "").toLowerCase();
      continue;
    }
    if (token === "--final-subset-dir") {
      args.finalSubsetDir = path.resolve(rest[++i] ?? "");
      continue;
    }
    if (token === "--manual-review-path") {
      args.manualReviewPath = path.resolve(rest[++i] ?? "");
      continue;
    }
    if (token === "--ready-count") {
      const value = Number(rest[++i] ?? "");
      args.readyCount = Number.isFinite(value) ? Math.trunc(value) : null;
      continue;
    }
    if (token === "--rejected-count") {
      const value = Number(rest[++i] ?? "");
      args.rejectedCount = Number.isFinite(value) ? Math.trunc(value) : null;
      continue;
    }
    if (token === "--notes") {
      args.notes = cleanText(rest[++i] ?? "");
      continue;
    }
    if (token.startsWith("--")) usage(1);
    positional.push(token);
  }

  if (subcommand === "complete") {
    if (positional.length !== 1) usage(1);
    args.jobFile = path.resolve(positional[0]);
    if (!["approved", "rejected", "blocked"].includes(args.status)) {
      throw new Error("complete requires --status approved|rejected|blocked");
    }
  } else if (positional.length > 0) {
    usage(1);
  }

  return args;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readJson(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, payload) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
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
    throw new Error(`Refusing to run nhtsa-codex-runner on branch '${branch}'. Use '${AUTOMATION_BRANCH}' or pass --allow-main-branch.`);
  }
}

async function collectBrandManifestPaths(stateRoot) {
  const out = [];
  const fileDirs = await fs.readdir(stateRoot, { withFileTypes: true }).catch(() => []);
  for (const fileDir of fileDirs) {
    if (!fileDir.isDirectory()) continue;
    const absoluteFileDir = path.join(stateRoot, fileDir.name);
    const brandDirs = await fs.readdir(absoluteFileDir, { withFileTypes: true }).catch(() => []);
    for (const brandDir of brandDirs) {
      if (!brandDir.isDirectory()) continue;
      const manifestPath = path.join(absoluteFileDir, brandDir.name, "brand_manifest.json");
      const manifest = await readJson(manifestPath, null);
      if (manifest) out.push({ manifestPath, manifest });
    }
  }
  return out;
}

function makeJobSortKey(job) {
  return [
    String(JOB_TYPE_ORDER[job.jobType] ?? 99).padStart(2, "0"),
    String(-(job.supportedRows ?? 0)).padStart(12, "0"),
    cleanText(job.make).toLowerCase(),
  ].join("||");
}

export async function discoverPendingJobs(stateRoot, phase = "") {
  const brandManifests = await collectBrandManifestPaths(stateRoot);
  const jobs = [];

  for (const { manifestPath, manifest } of brandManifests) {
    if (manifest.status === "awaiting_codex_review" && (!phase || phase === "codex_review")) {
      const jobFile = path.join(manifest.directories.codex_review, "review_job.json");
      const job = await readJson(jobFile, null);
      const resultPath = path.join(manifest.directories.codex_review, "review_result.json");
      const claimPath = path.join(manifest.directories.codex_review, "runner_claim.json");
      if (job && !(await readJson(resultPath, null)) && !(await readJson(claimPath, null))) {
        jobs.push({
          jobType: "codex_review",
          jobFile,
          claimPath,
          resultPath,
          manifestPath,
          brandManifest: manifest,
          supportedRows: manifest.supported_rows ?? 0,
          make: manifest.make,
          brandKey: manifest.brand_key,
          job,
        });
      }
    }

    if (manifest.status === "awaiting_codex_validate" && (!phase || phase === "codex_validate")) {
      const jobFile = path.join(manifest.directories.codex_validate, "validate_job.json");
      const job = await readJson(jobFile, null);
      const resultPath = path.join(manifest.directories.codex_validate, "validate_result.json");
      const claimPath = path.join(manifest.directories.codex_validate, "runner_claim.json");
      if (job && !(await readJson(resultPath, null)) && !(await readJson(claimPath, null))) {
        jobs.push({
          jobType: "codex_validate",
          jobFile,
          claimPath,
          resultPath,
          manifestPath,
          brandManifest: manifest,
          supportedRows: manifest.supported_rows ?? 0,
          make: manifest.make,
          brandKey: manifest.brand_key,
          job,
        });
      }
    }
  }

  return jobs.sort((a, b) => makeJobSortKey(a).localeCompare(makeJobSortKey(b)));
}

function buildReviewPrompt(job) {
  const brand = job.brandManifest;
  return [
    `Review the NHTSA ${brand.make} candidate set in ${job.job.input_dir}.`,
    `Work one case at a time. Treat parser and both AI passes only as coarse filters.`,
    "Reject weak software-only, comfort, nuisance, NVH, maintenance-like and conditional cases.",
    "Check catalog mapping during this first review. If mapping is suspicious or a valid model is missing, verify from multiple official sources before keeping the seed and prepare the safe catalog change.",
    `Write the final accepted subset into ${job.job.expected_output_dir}.`,
    "Expected outputs:",
    "- ready/*.json",
    "- MANUAL_REVIEW.md",
    "- optional rejected_ready/ and promoted_from_review/ helper dirs",
    `When done, record the result with: node scripts/nhtsa-codex-runner.mjs complete "${job.jobFile}" --status approved --final-subset-dir "${job.job.expected_output_dir}"`,
    "If the set is bad or blocked, complete the job with --status rejected or --status blocked and add --notes.",
  ].join("\n");
}

function buildValidatePrompt(job) {
  const brand = job.brandManifest;
  return [
    `Validate the final NHTSA ${brand.make} subset in ${job.job.input_dir}.`,
    "You are the independent gatekeeper. Do not rewrite the seeds. Only approve, reject or block.",
    "Check that every seed is diagnostically relevant, has clear symptoms, explicit non-conditional repair, correct catalog mapping and no obvious semantic duplicates.",
    `If the subset is acceptable, record it with: node scripts/nhtsa-codex-runner.mjs complete "${job.jobFile}" --status approved`,
    "If not acceptable, use --status rejected or --status blocked and add --notes.",
  ].join("\n");
}

function buildContextPacket(job) {
  return {
    job_type: job.jobType,
    make: job.brandManifest.make,
    brand_key: job.brandManifest.brand_key,
    file_key: job.brandManifest.file_key,
    manifest_path: job.manifestPath,
    job_file: job.jobFile,
    input_dir: job.job.input_dir,
    expected_output_dir: job.job.expected_output_dir,
    checklist: job.job.checklist ?? [],
    completion_examples: job.jobType === "codex_review"
      ? {
          approved: `node scripts/nhtsa-codex-runner.mjs complete "${job.jobFile}" --status approved --final-subset-dir "${job.job.expected_output_dir}"`,
          blocked: `node scripts/nhtsa-codex-runner.mjs complete "${job.jobFile}" --status blocked --notes "why blocked"`,
        }
      : {
          approved: `node scripts/nhtsa-codex-runner.mjs complete "${job.jobFile}" --status approved`,
          rejected: `node scripts/nhtsa-codex-runner.mjs complete "${job.jobFile}" --status rejected --notes "why rejected"`,
        },
  };
}

export async function claimNextJob(stateRoot, phase = "") {
  const jobs = await discoverPendingJobs(stateRoot, phase);
  const job = jobs[0] ?? null;
  if (!job) return null;

  const claim = {
    run_id: `codex_job_${Date.now()}`,
    claimed_at: new Date().toISOString(),
    pid: process.pid,
    job_type: job.jobType,
    job_file: job.jobFile,
  };
  await writeJson(job.claimPath, claim);
  job.job.status = "claimed";
  job.job.claim = claim;
  job.job.prompt_path = path.join(path.dirname(job.jobFile), "job_prompt.md");
  job.job.context_path = path.join(path.dirname(job.jobFile), "job_context.json");
  await writeJson(job.jobFile, job.job);
  await fs.writeFile(job.job.prompt_path, `${job.jobType === "codex_review" ? buildReviewPrompt(job) : buildValidatePrompt(job)}\n`, "utf8");
  await writeJson(job.job.context_path, buildContextPacket(job));

  return {
    jobType: job.jobType,
    jobFile: job.jobFile,
    claimPath: job.claimPath,
    promptPath: job.job.prompt_path,
    contextPath: job.job.context_path,
    make: job.brandManifest.make,
    brandKey: job.brandManifest.brand_key,
    inputDir: job.job.input_dir,
    expectedOutputDir: job.job.expected_output_dir,
  };
}

function buildResultPayload(args, job, nowIso) {
  if (job.type === "codex_review") {
    return {
      status: args.status,
      final_subset_dir: args.status === "approved" ? args.finalSubsetDir : "",
      manual_review_path: args.manualReviewPath || "",
      ready_count: args.readyCount,
      rejected_count: args.rejectedCount,
      notes: args.notes,
      reviewed_at: nowIso,
    };
  }
  return {
    status: args.status,
    notes: args.notes,
    validated_at: nowIso,
  };
}

export async function completeJob(args) {
  const job = await readJson(args.jobFile, null);
  if (!job) {
    throw new Error(`Missing job file: ${args.jobFile}`);
  }
  if (!job.type || (job.type !== "codex_review" && job.type !== "codex_validate")) {
    throw new Error(`Unsupported job type in ${args.jobFile}`);
  }
  if (job.type === "codex_review" && args.status === "approved" && !args.finalSubsetDir) {
    throw new Error("Approved review completion requires --final-subset-dir");
  }

  const jobDir = path.dirname(args.jobFile);
  const resultPath = path.join(jobDir, job.type === "codex_review" ? "review_result.json" : "validate_result.json");
  const claimPath = path.join(jobDir, "runner_claim.json");
  const nowIso = new Date().toISOString();
  const payload = buildResultPayload(args, job, nowIso);
  await writeJson(resultPath, payload);

  job.status = "completed";
  job.completed_at = nowIso;
  job.result_path = resultPath;
  await writeJson(args.jobFile, job);
  await fs.rm(claimPath, { force: true });

  return {
    jobType: job.type,
    jobFile: args.jobFile,
    resultPath,
    status: args.status,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await ensureSafeBranch(process.cwd(), args.allowMainBranch);

  if (args.subcommand === "claim") {
    const job = await claimNextJob(args.stateRoot, args.phase);
    if (!job) {
      console.log("nhtsa-codex-runner: no pending Codex jobs.");
      return;
    }
    console.log(JSON.stringify(job, null, 2));
    return;
  }

  const result = await completeJob(args);
  console.log(JSON.stringify(result, null, 2));
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
