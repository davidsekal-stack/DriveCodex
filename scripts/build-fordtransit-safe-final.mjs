#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import { normalizeText, selectCatalogForMarket } from "./forum-seed.mjs";

function usage(exitCode = 1) {
  console.log("Usage: node scripts/build-fordtransit-safe-final.mjs <manual_review_dir> <raw_ready_dir>");
  process.exit(exitCode);
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function writeJsonl(filePath, rows) {
  const text = rows.map((row) => JSON.stringify(row)).join("\n");
  await fs.writeFile(filePath, text ? `${text}\n` : "", "utf8");
}

async function writeCsv(filePath, rows, columns) {
  const lines = [columns.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => csvEscape(row[column])).join(","));
  }
  await fs.writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

function normalizeModelLabel(label) {
  const raw = (label ?? "").toString().trim();
  if (!raw) return "";
  return raw
    .replace(/(\d{4})\?(\d{4})/g, "$1–$2")
    .replace(/(\d{4})\?(současnost)/gi, "$1–$2")
    .replace(/(\d{4})\?(dosud)/gi, "$1–$2")
    .replace(/\s+/g, " ")
    .trim();
}

function makeModelLookup(labels) {
  const map = new Map();
  for (const label of labels) {
    map.set(normalizeText(normalizeModelLabel(label)), label);
  }
  return map;
}

function normalizeResolutionText(text) {
  return normalizeText((text ?? "").toString().replace(/\s+/g, " ").trim());
}

function normalizeSymptoms(symptoms) {
  const items = Array.isArray(symptoms) ? symptoms : [];
  return items
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .sort();
}

function candidateKey(candidate) {
  return [
    candidate.thread_url ?? "",
    normalizeText(candidate.case_author ?? ""),
    normalizeSymptoms(candidate.symptoms).join("|"),
    normalizeResolutionText(candidate.resolution),
  ].join(" :: ");
}

function sourcePriority(sourceBucket) {
  if (sourceBucket === "ready_import_only") return 3;
  if (sourceBucket === "model_resolution_fetch_promoted") return 2;
  return 1;
}

function hasBroadVehicleLabel(model) {
  return /\bTransit \/ Tourneo\b/i.test(model ?? "");
}

function isWeakResolution(candidate) {
  const resolution = (candidate.resolution ?? "").trim();
  const normalized = normalizeResolutionText(resolution);
  if (!normalized) return true;
  if (normalized.includes("implied repair")) return true;
  if (/^faulty pump\.?$/.test(resolution)) return true;
  if (/^problem sorted\b/i.test(resolution)) return true;
  if (/sorted itself out/i.test(resolution)) return true;
  if (/appears to have been sorted/i.test(resolution)) return true;
  if (/poor connection\.?$/i.test(resolution) && resolution.length < 40) return true;
  if (/fixed now\.?$/i.test(resolution) && resolution.length < 35) return true;
  return false;
}

function makeIssueRow(candidate, issue, detail = "") {
  return {
    source_bucket: candidate.source_bucket ?? "",
    local_id: candidate.local_id ?? "",
    thread_url: candidate.thread_url ?? "",
    thread_title: candidate.thread_title ?? "",
    case_author: candidate.case_author ?? "",
    vehicle_model: candidate.vehicle_model ?? "",
    issue,
    detail,
  };
}

async function main() {
  const [, , manualDir, rawReadyDir] = process.argv;
  if (!manualDir || !rawReadyDir) usage(1);

  const stamp = dateStamp();
  const { catalog } = selectCatalogForMarket("eu");
  const fordEntry = catalog.find((entry) => normalizeText(entry.brand) === "ford");
  if (!fordEntry) throw new Error("Ford brand entry was not found in web/src/constants/catalog.js");

  const catalogLabels = (fordEntry.models ?? []).map((model) => model?.label).filter(Boolean);
  const catalogLookup = makeModelLookup(catalogLabels);

  const readySummary = await readJsonl(path.join(manualDir, "ready_import_only_20260404.jsonl"));
  const triagePromoted = await readJsonl(path.join(manualDir, "to_review_promote_ready_candidates_20260404.jsonl"));
  const fetchPromoted = await readJsonl(path.join(manualDir, "model_resolution_promoted_after_fetch_20260404.jsonl"));

  const candidates = [];

  for (const item of readySummary) {
    const rawSeed = await readJson(path.join(rawReadyDir, item.file));
    candidates.push({
      source_bucket: "ready_import_only",
      local_id: rawSeed.local_id ?? "",
      thread_url: rawSeed.thread_url ?? "",
      thread_title: item.thread_title ?? rawSeed?.metadata?.thread_title ?? "",
      case_author: item.case_author ?? rawSeed?.metadata?.case_author ?? "",
      vehicle_brand: rawSeed.vehicle_brand ?? "Ford",
      vehicle_model: normalizeModelLabel(item.final_model ?? rawSeed.vehicle_model ?? ""),
      original_model: item.original_model ?? rawSeed.vehicle_model ?? "",
      mileage: rawSeed.mileage ?? null,
      engine_power: rawSeed.engine_power ?? null,
      symptoms: Array.isArray(rawSeed.symptoms) ? rawSeed.symptoms : [],
      obd_codes: Array.isArray(rawSeed.obd_codes) ? rawSeed.obd_codes : [],
      description: rawSeed.description ?? "",
      resolution: rawSeed.resolution ?? "",
      closed_at: rawSeed.closed_at ?? "",
      metadata: rawSeed.metadata ?? {},
    });
  }

  for (const item of triagePromoted) {
    candidates.push({
      source_bucket: "to_review_promoted",
      local_id: item.local_id ?? "",
      thread_url: item.thread_url ?? "",
      thread_title: item?.metadata?.thread_title ?? "",
      case_author: item?.metadata?.case_author ?? "",
      vehicle_brand: item.vehicle_brand ?? "Ford",
      vehicle_model: normalizeModelLabel(item.vehicle_model ?? ""),
      original_model: item?.metadata?.catalog_mapping?.model_raw ?? "",
      mileage: item.mileage ?? null,
      engine_power: item.engine_power ?? null,
      symptoms: Array.isArray(item.symptoms) ? item.symptoms : [],
      obd_codes: Array.isArray(item.obd_codes) ? item.obd_codes : [],
      description: item.description ?? "",
      resolution: item.resolution ?? "",
      closed_at: item.closed_at ?? "",
      metadata: item.metadata ?? {},
    });
  }

  for (const item of fetchPromoted) {
    candidates.push({
      source_bucket: "model_resolution_fetch_promoted",
      local_id: item.local_id ?? "",
      thread_url: item.thread_url ?? "",
      thread_title: item?.metadata?.thread_title ?? "",
      case_author: item?.metadata?.case_author ?? "",
      vehicle_brand: item.vehicle_brand ?? "Ford",
      vehicle_model: normalizeModelLabel(item.vehicle_model ?? ""),
      original_model: item?.metadata?.catalog_mapping?.model_raw ?? "",
      mileage: item.mileage ?? null,
      engine_power: item.engine_power ?? null,
      symptoms: Array.isArray(item.symptoms) ? item.symptoms : [],
      obd_codes: Array.isArray(item.obd_codes) ? item.obd_codes : [],
      description: item.description ?? "",
      resolution: item.resolution ?? "",
      closed_at: item.closed_at ?? "",
      metadata: item.metadata ?? {},
    });
  }

  const exactDeduped = new Map();
  const duplicateDrops = [];
  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    const incumbent = exactDeduped.get(key);
    if (!incumbent) {
      exactDeduped.set(key, candidate);
      continue;
    }
    const better = sourcePriority(candidate.source_bucket) > sourcePriority(incumbent.source_bucket)
      || (
        sourcePriority(candidate.source_bucket) === sourcePriority(incumbent.source_bucket)
        && (candidate.resolution ?? "").length > (incumbent.resolution ?? "").length
      )
      ? candidate
      : incumbent;
    const dropped = better === candidate ? incumbent : candidate;
    exactDeduped.set(key, better);
    duplicateDrops.push(makeIssueRow(dropped, "exact_duplicate_case", `Superseded by ${better.local_id || better.thread_url}`));
  }

  const exactRows = [...exactDeduped.values()];

  const issues = [];
  const threadAuthorGroups = new Map();

  for (const candidate of exactRows) {
    const normalizedCatalogLabel = catalogLookup.get(normalizeText(candidate.vehicle_model));
    candidate.vehicle_model = normalizedCatalogLabel ?? candidate.vehicle_model;
    const key = `${candidate.thread_url} :: ${normalizeText(candidate.case_author ?? "")}`;
    const list = threadAuthorGroups.get(key) ?? [];
    list.push(candidate);
    threadAuthorGroups.set(key, list);

    if (!candidate.thread_url || !candidate.thread_title) {
      issues.push(makeIssueRow(candidate, "missing_thread_identity"));
    }
    if (!candidate.vehicle_model || !catalogLookup.has(normalizeText(candidate.vehicle_model))) {
      issues.push(makeIssueRow(candidate, "model_not_in_catalog"));
    }
    if (hasBroadVehicleLabel(candidate.vehicle_model)) {
      issues.push(makeIssueRow(candidate, "broad_vehicle_label", "Broad Transit/Tourneo family label kept out of safe import."));
    }
    if (!Array.isArray(candidate.symptoms) || candidate.symptoms.length < 1) {
      issues.push(makeIssueRow(candidate, "missing_symptoms"));
    }
    if (!(candidate.description ?? "").toString().trim()) {
      issues.push(makeIssueRow(candidate, "missing_description"));
    }
    if (!(candidate.resolution ?? "").toString().trim()) {
      issues.push(makeIssueRow(candidate, "missing_resolution"));
    }
    if (isWeakResolution(candidate)) {
      issues.push(makeIssueRow(candidate, "weak_resolution", candidate.resolution));
    }
  }

  for (const [groupKey, group] of threadAuthorGroups.entries()) {
    if (group.length < 2) continue;
    for (const candidate of group) {
      issues.push(makeIssueRow(candidate, "same_author_multi_case_thread", `Multiple candidate cases in one thread for ${groupKey}`));
    }
    const distinctModels = [...new Set(group.map((item) => item.vehicle_model))];
    if (distinctModels.length > 1) {
      for (const candidate of group) {
        issues.push(makeIssueRow(candidate, "same_author_conflicting_model", `Conflict group ${groupKey}`));
      }
    }
  }

  const issueMap = new Map();
  for (const issue of [...issues, ...duplicateDrops]) {
    const key = [
      issue.local_id,
      issue.thread_url,
      issue.issue,
      issue.detail,
    ].join(" :: ");
    if (!issueMap.has(key)) issueMap.set(key, issue);
  }
  const uniqueIssues = [...issueMap.values()];

  const badLocalIds = new Set(uniqueIssues.map((issue) => issue.local_id).filter(Boolean));
  const safe = exactRows.filter((candidate) => !badLocalIds.has(candidate.local_id));
  const manualReview = exactRows.filter((candidate) => badLocalIds.has(candidate.local_id));

  const summary = {
    source_candidates: candidates.length,
    exact_case_deduped: exactRows.length,
    safe_import_candidates: safe.length,
    manual_review_candidates: manualReview.length,
    issue_counts: uniqueIssues.reduce((acc, issue) => {
      acc[issue.issue] = (acc[issue.issue] ?? 0) + 1;
      return acc;
    }, {}),
  };

  const safeJsonl = path.join(manualDir, `transit_safe_import_final_${stamp}.jsonl`);
  const safeCsv = path.join(manualDir, `transit_safe_import_final_${stamp}.csv`);
  const reviewJsonl = path.join(manualDir, `transit_safe_import_manual_review_${stamp}.jsonl`);
  const reviewCsv = path.join(manualDir, `transit_safe_import_manual_review_${stamp}.csv`);
  const issuesCsv = path.join(manualDir, `transit_safe_import_issues_${stamp}.csv`);
  const summaryPath = path.join(manualDir, `transit_safe_import_final_${stamp}_summary.json`);

  await writeJsonl(safeJsonl, safe);
  await writeCsv(safeCsv, safe, [
    "source_bucket",
    "local_id",
    "thread_url",
    "thread_title",
    "case_author",
    "vehicle_model",
    "engine_power",
    "closed_at",
  ]);
  await writeJsonl(reviewJsonl, manualReview);
  await writeCsv(reviewCsv, manualReview, [
    "source_bucket",
    "local_id",
    "thread_url",
    "thread_title",
    "case_author",
    "vehicle_model",
    "engine_power",
    "closed_at",
  ]);
  await writeCsv(issuesCsv, uniqueIssues, [
    "source_bucket",
    "local_id",
    "thread_url",
    "thread_title",
    "case_author",
    "vehicle_model",
    "issue",
    "detail",
  ]);
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    summary_path: summaryPath,
    safe_jsonl: safeJsonl,
    manual_review_jsonl: reviewJsonl,
    issues_csv: issuesCsv,
    safe_import_candidates: safe.length,
    manual_review_candidates: manualReview.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
