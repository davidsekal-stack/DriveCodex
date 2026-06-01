#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import { normalizeText, selectCatalogForMarket } from "./forum-seed.mjs";

function usage(exitCode = 1) {
  console.log("Usage: node scripts/build-skoda-safe-final.mjs <crawl_dir> <manual_review_dir>");
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
    normalizeSymptoms(candidate.symptoms).join("|"),
    normalizeResolutionText(candidate.resolution),
  ].join(" :: ");
}

function sourcePriority(sourceBucket) {
  if (sourceBucket === "ready") return 2;
  if (sourceBucket === "retry_extractor_promoted") return 1;
  if (sourceBucket === "retry_classifier_promoted") return 1;
  if (sourceBucket === "to_review_promoted") return 1;
  return 0;
}

function makeIssueRow(candidate, issue, detail = "") {
  return {
    source_bucket: candidate.source_bucket ?? "",
    local_id: candidate.local_id ?? "",
    thread_url: candidate.thread_url ?? "",
    thread_title: candidate.thread_title ?? "",
    vehicle_model: candidate.vehicle_model ?? "",
    issue,
    detail,
  };
}

function isWeakResolution(candidate) {
  const resolution = (candidate.resolution ?? "").trim();
  const normalized = normalizeResolutionText(resolution);
  if (!normalized) return true;
  if (/^it works\b/i.test(resolution) && resolution.length < 25) return true;
  if (/^everything is ok\b/i.test(resolution) && resolution.length < 40) return true;
  if (/^fault removed\b/i.test(resolution) && resolution.length < 35) return true;
  if (/recommend/i.test(resolution)) return true;
  if (/succeeded using the procedure/i.test(resolution)) return true;
  if (/disconnected .* prevents the issue/i.test(normalized)) return true;
  if (/problem practically disappeared/i.test(normalized)) return true;
  if (/everything was okay\.?$/i.test(resolution) && resolution.length < 80) return true;
  return false;
}

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function extractFamilyToken(text) {
  const normalized = normalizeText(text);
  if (!normalized) return "";
  const families = [
    "citigo",
    "fabia",
    "rapid",
    "roomster",
    "octavia",
    "superb",
    "yeti",
    "scala",
    "kamiq",
    "karoq",
    "kodiaq",
    "enyaq",
  ];
  return families.find((token) => normalized.includes(token)) ?? "";
}

async function buildThreadTitleLookup(crawlDir) {
  const files = (await fs.readdir(crawlDir))
    .filter((name) => /^discovered_threads_kept_.*\.jsonl$/i.test(name))
    .sort((a, b) => a.localeCompare(b));

  const map = new Map();
  for (const fileName of files) {
    const rows = await readJsonl(path.join(crawlDir, fileName));
    for (const row of rows) {
      if (row?.url && row?.title) map.set(row.url, row.title);
    }
  }
  return map;
}

async function main() {
  const [, , crawlDir, manualDir] = process.argv;
  if (!crawlDir || !manualDir) usage(1);

  const stamp = dateStamp();
  const { catalog } = selectCatalogForMarket("eu");
  const skodaEntry = catalog.find((entry) => normalizeText(entry.brand) === normalizeText("Škoda"));
  if (!skodaEntry) throw new Error("Skoda brand entry was not found in web/src/constants/catalog.js");

  const catalogLabels = new Set((skodaEntry.models ?? []).map((item) => normalizeText(item?.label)).filter(Boolean));
  const titleLookup = await buildThreadTitleLookup(crawlDir);
  const readyDir = path.join(crawlDir, "ready");
  const readyFiles = (await fs.readdir(readyDir)).filter((name) => name.endsWith(".json")).sort((a, b) => a.localeCompare(b));
  const promotePath = path.join(manualDir, `to_review_promote_ready_candidates_${stamp}.jsonl`);
  const retryPromotePath = path.join(manualDir, `retry_extractor_promoted_${stamp}.jsonl`);
  const retryClassifierPromotePath = path.join(manualDir, `retry_classifier_promoted_${stamp}.jsonl`);
  const promoted = await readJsonl(promotePath).catch(() => []);
  const retryPromoted = await readJsonl(retryPromotePath).catch(() => []);
  const retryClassifierPromoted = await readJsonl(retryClassifierPromotePath).catch(() => []);

  const candidates = [];

  for (const fileName of readyFiles) {
    const raw = await readJson(path.join(readyDir, fileName));
    candidates.push({
      source_bucket: "ready",
      file: fileName,
      local_id: raw.local_id ?? "",
      thread_url: raw.thread_url ?? "",
      thread_title: titleLookup.get(raw.thread_url ?? "") ?? "",
      vehicle_brand: raw.vehicle_brand ?? "Škoda",
      vehicle_model: raw.vehicle_model ?? "",
      mileage: raw.mileage ?? null,
      engine_power: raw.engine_power ?? null,
      symptoms: Array.isArray(raw.symptoms) ? raw.symptoms : [],
      obd_codes: Array.isArray(raw.obd_codes) ? raw.obd_codes : [],
      description: raw.description ?? "",
      resolution: raw.resolution ?? "",
      closed_at: raw.closed_at ?? "",
      metadata: raw.metadata ?? {},
    });
  }

  for (const raw of promoted) {
    candidates.push({
      source_bucket: "to_review_promoted",
      file: "",
      local_id: raw.local_id ?? "",
      thread_url: raw.thread_url ?? "",
      thread_title: titleLookup.get(raw.thread_url ?? "") ?? raw?.metadata?.thread_title ?? "",
      vehicle_brand: raw.vehicle_brand ?? "Škoda",
      vehicle_model: raw.vehicle_model ?? "",
      mileage: raw.mileage ?? null,
      engine_power: raw.engine_power ?? null,
      symptoms: Array.isArray(raw.symptoms) ? raw.symptoms : [],
      obd_codes: Array.isArray(raw.obd_codes) ? raw.obd_codes : [],
      description: raw.description ?? "",
      resolution: raw.resolution ?? "",
      closed_at: raw.closed_at ?? "",
      metadata: raw.metadata ?? {},
    });
  }

  for (const raw of retryPromoted) {
    candidates.push({
      source_bucket: "retry_extractor_promoted",
      file: "",
      local_id: raw.local_id ?? "",
      thread_url: raw.thread_url ?? "",
      thread_title: titleLookup.get(raw.thread_url ?? "") ?? raw?.metadata?.thread_title ?? "",
      vehicle_brand: raw.vehicle_brand ?? "Škoda",
      vehicle_model: raw.vehicle_model ?? "",
      mileage: raw.mileage ?? null,
      engine_power: raw.engine_power ?? null,
      symptoms: Array.isArray(raw.symptoms) ? raw.symptoms : [],
      obd_codes: Array.isArray(raw.obd_codes) ? raw.obd_codes : [],
      description: raw.description ?? "",
      resolution: raw.resolution ?? "",
      closed_at: raw.closed_at ?? "",
      metadata: raw.metadata ?? {},
    });
  }

  for (const raw of retryClassifierPromoted) {
    candidates.push({
      source_bucket: "retry_classifier_promoted",
      file: "",
      local_id: raw.local_id ?? "",
      thread_url: raw.thread_url ?? "",
      thread_title: titleLookup.get(raw.thread_url ?? "") ?? raw?.metadata?.thread_title ?? "",
      vehicle_brand: raw.vehicle_brand ?? "Škoda",
      vehicle_model: raw.vehicle_model ?? "",
      mileage: raw.mileage ?? null,
      engine_power: raw.engine_power ?? null,
      symptoms: Array.isArray(raw.symptoms) ? raw.symptoms : [],
      obd_codes: Array.isArray(raw.obd_codes) ? raw.obd_codes : [],
      description: raw.description ?? "",
      resolution: raw.resolution ?? "",
      closed_at: raw.closed_at ?? "",
      metadata: raw.metadata ?? {},
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
      ? candidate
      : incumbent;
    const dropped = better === candidate ? incumbent : candidate;
    exactDeduped.set(key, better);
    duplicateDrops.push(makeIssueRow(dropped, "exact_duplicate_case", `Superseded by ${better.local_id || better.thread_url}`));
  }

  const titleRejectPatterns = [
    /\bandroid\s+auto\b/i,
    /\bled\s+[^\n]*\bm[ií]sto\b/i,
    /\breset\s+servisn[ií]ho\s+intervalu\b/i,
    /\belektrick[eé]\s+vyh[řr][ií]v[aá]n[ií]\s+[čc]eln[ií]ho\s+okna\b/i,
    /\bolejov[aá]\s+vana\b/i,
    /\bp[řr]elit[ií]\s+mno[zž]stv[ií]\s+oleje\b/i,
    /\bv[ýy]dr[zž]\s+baterie\b/i,
    /\bk[óo]dov[aá]n[ií]\b/i,
    /\bsound\s+syst[eé]m\b/i,
  ];
  const descriptionRejectPatterns = [
    /\bconsidering\b/i,
    /\bdoes not have a humidity sensor\b/i,
    /\bsuccessfully installed a heated windshield\b/i,
    /\bpurchased recommended led bulbs\b/i,
    /\buser extracted half a liter of oil\b/i,
    /\bprocedure:\s*1\./i,
  ];
  const resolutionRejectPatterns = [
    /\brecommends the bulbs\b/i,
    /\bsucceeded using the procedure\b/i,
    /\binstalled a heated windshield\b/i,
    /\bdisables window operation but prevents the issue\b/i,
    /\beverything is ok since then\b/i,
  ];

  const safeRows = [];
  const manualRows = [];
  const issues = [...duplicateDrops];

  for (const candidate of exactDeduped.values()) {
    const title = (candidate.thread_title ?? "").toString();
    const description = (candidate.description ?? "").toString();
    const resolution = (candidate.resolution ?? "").toString();

    let blocked = false;

    if (!candidate.thread_url || !title) {
      issues.push(makeIssueRow(candidate, "missing_thread_identity"));
      blocked = true;
    }
    if (!candidate.vehicle_model || !catalogLabels.has(normalizeText(candidate.vehicle_model))) {
      issues.push(makeIssueRow(candidate, "model_not_in_catalog"));
      blocked = true;
    }
    const rawFamily = extractFamilyToken(candidate?.metadata?.catalog_mapping?.model_raw ?? "");
    const resolvedFamily = extractFamilyToken(candidate.vehicle_model);
    if (rawFamily && resolvedFamily && rawFamily !== resolvedFamily) {
      issues.push(makeIssueRow(candidate, "model_context_conflict", `${rawFamily} vs ${resolvedFamily}`));
      blocked = true;
    }
    if (!Array.isArray(candidate.symptoms) || candidate.symptoms.length < 1) {
      issues.push(makeIssueRow(candidate, "missing_symptoms"));
      blocked = true;
    }
    if (!description.trim()) {
      issues.push(makeIssueRow(candidate, "missing_description"));
      blocked = true;
    }
    if (!resolution.trim()) {
      issues.push(makeIssueRow(candidate, "missing_resolution"));
      blocked = true;
    }
    if (matchesAny(title, titleRejectPatterns)) {
      issues.push(makeIssueRow(candidate, "non_fault_title", title));
      blocked = true;
    }
    if (matchesAny(description, descriptionRejectPatterns)) {
      issues.push(makeIssueRow(candidate, "non_fault_description"));
      blocked = true;
    }
    if (matchesAny(resolution, resolutionRejectPatterns)) {
      issues.push(makeIssueRow(candidate, "non_fault_resolution"));
      blocked = true;
    }
    if (isWeakResolution(candidate)) {
      issues.push(makeIssueRow(candidate, "weak_resolution"));
      blocked = true;
    }

    if (blocked) {
      manualRows.push(candidate);
      continue;
    }

    safeRows.push(candidate);
  }

  safeRows.sort((a, b) => (a.thread_title || "").localeCompare(b.thread_title || ""));
  manualRows.sort((a, b) => (a.thread_title || "").localeCompare(b.thread_title || ""));
  issues.sort((a, b) => (a.thread_title || "").localeCompare(b.thread_title || ""));

  const summary = {
    created_at: new Date().toISOString(),
    crawl_dir: path.resolve(crawlDir),
    manual_dir: path.resolve(manualDir),
    total_candidates: candidates.length,
    deduped_candidates: exactDeduped.size,
    safe_final: safeRows.length,
    manual_review: manualRows.length,
    issues: issues.length,
  };

  const safeJsonl = path.join(manualDir, `skoda_safe_import_final_${stamp}.jsonl`);
  const safeCsv = path.join(manualDir, `skoda_safe_import_final_${stamp}.csv`);
  const manualJsonl = path.join(manualDir, `skoda_safe_import_manual_review_${stamp}.jsonl`);
  const issuesCsv = path.join(manualDir, `skoda_safe_import_issues_${stamp}.csv`);
  const summaryJson = path.join(manualDir, `skoda_safe_import_summary_${stamp}.json`);

  await writeJsonl(safeJsonl, safeRows);
  await writeCsv(safeCsv, safeRows, [
    "local_id",
    "thread_title",
    "thread_url",
    "vehicle_model",
    "engine_power",
    "mileage",
    "resolution",
  ]);
  await writeJsonl(manualJsonl, manualRows);
  await writeCsv(issuesCsv, issues, [
    "source_bucket",
    "local_id",
    "thread_title",
    "thread_url",
    "vehicle_model",
    "issue",
    "detail",
  ]);
  await fs.writeFile(summaryJson, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(`Prepared ${safeRows.length} safe Skoda import candidate(s) and flagged ${manualRows.length} manual-review item(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
