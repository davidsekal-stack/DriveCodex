#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import {
  computeLocalId,
  canonicalizeSymptoms,
  ensureArrayOfStrings,
  isReadyRecord,
  pickEnginePower,
  selectCatalogForMarket,
  toIsoOrNow,
  normalizeText,
} from "./forum-seed.mjs";
import {
  resolveTransitFamilyVehicleModel,
  sanitizeResolvedTransitModel,
} from "./forum-seed-fordtransit.mjs";

const DEFAULT_FORUM = "fordtransit_org";
const DEFAULT_USER_ID = "ai_importer";

const FORD_ENTRY = selectCatalogForMarket("eu").catalog.find(
  (entry) => normalizeText(entry.brand) === "ford",
);

if (!FORD_ENTRY) {
  throw new Error("Ford brand entry was not found in web/src/constants/catalog.js");
}

function usage(exitCode = 1) {
  console.log(
    "Usage: node scripts/retriage-fordtransit-review.mjs <to_review_dir> <out_dir>",
  );
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

function buildCatalogMapping({ modelRaw = "", threadTitle = "", parentForumTitle = "", vehicleModel = null }) {
  return {
    resolved: Boolean(vehicleModel),
    model_raw: modelRaw || null,
    thread_title: threadTitle || null,
    parent_forum_title: parentForumTitle || null,
    candidate_hints: [],
  };
}

function buildCandidateSeed(review) {
  if (!review?.extracted_raw || !review?.classifier) return null;

  const normalizedItem = review.extracted_raw;
  const normalizedThreadTitle = (review.thread_title ?? "").toString();
  const parentForumTitle = (review.parent_forum_title ?? "").toString();
  const sourceUrl = (review.thread_url ?? "").toString();

  const modelContext = [
    normalizedThreadTitle,
    normalizedItem?.engine_raw ?? "",
    normalizedItem?.engine_code_raw ?? "",
    normalizedItem?.description ?? "",
  ]
    .filter(Boolean)
    .join(" | ");

  const resolvedVehicleModel = resolveTransitFamilyVehicleModel({
    modelRaw: normalizedItem?.model_raw ?? "",
    threadTitle: normalizedThreadTitle,
    parentForumTitle,
    extraText: modelContext,
  }) ?? null;

  const vehicle_model = sanitizeResolvedTransitModel(resolvedVehicleModel, modelContext);
  const engine_power = vehicle_model
    ? pickEnginePower(
        FORD_ENTRY,
        vehicle_model,
        [
          normalizedItem?.engine_raw ?? "",
          modelContext,
          parentForumTitle,
        ].filter(Boolean).join(" | "),
      )
    : null;

  let description = (normalizedItem?.description ?? "").toString();
  const engineCodeRaw = (normalizedItem?.engine_code_raw ?? "").toString().trim();
  if (engineCodeRaw && !normalizeText(description).includes(normalizeText(engineCodeRaw))) {
    description = description.trim()
      ? `${description.trim()} Engine code: ${engineCodeRaw}.`
      : `Engine code: ${engineCodeRaw}.`;
  }

  const metadata = {
    source_type: "forum_fordtransit_org",
    source_ref: "fordtransit.org/forum/viewforum.php?f=2",
    thread_title: normalizedThreadTitle || null,
    case_author: normalizedItem?.case_author || null,
    catalog_mapping: buildCatalogMapping({
      modelRaw: normalizedItem?.model_raw ?? "",
      threadTitle: normalizedThreadTitle,
      parentForumTitle,
      vehicleModel: vehicle_model,
    }),
  };

  const canonical = {
    vehicle_brand: "Ford",
    vehicle_model,
    engine_power,
  };

  return {
    local_id: computeLocalId({
      forum: DEFAULT_FORUM,
      sourceUrl,
      item: normalizedItem,
      canonical,
    }),
    user_id: review?.candidate_seed?.user_id || DEFAULT_USER_ID,
    thread_url: sourceUrl || null,
    vehicle_brand: "Ford",
    vehicle_model,
    mileage: typeof normalizedItem?.mileage === "number" ? Math.trunc(normalizedItem.mileage) : null,
    engine_power,
    symptoms: canonicalizeSymptoms(normalizedItem?.symptoms),
    obd_codes: ensureArrayOfStrings(normalizedItem?.obd_codes).map((code) => code.toUpperCase()),
    description,
    resolution: (normalizedItem?.resolution ?? "").toString(),
    closed_at: toIsoOrNow(normalizedItem?.closed_at),
    metadata,
  };
}

function classifyReview(review, rebuiltCandidate) {
  const classifier = review?.classifier ?? null;
  const stage = review?.stage ?? "";

  if (stage === "record") {
    if (rebuiltCandidate?.vehicle_model && isReadyRecord(rebuiltCandidate, classifier)) {
      return {
        final_status: "promote_ready_candidate",
        final_reason: "Resolved case now maps to current catalog and passes READY validation.",
      };
    }
    if (!rebuiltCandidate?.vehicle_model) {
      return {
        final_status: "model_resolution_needed",
        final_reason: "Resolved case exists, but the model still cannot be mapped safely to the current catalog.",
      };
    }
    return {
      final_status: "record_hold",
      final_reason: "Resolved case exists, but the rebuilt candidate still does not pass READY validation.",
    };
  }

  if (stage === "extractor") {
    return {
      final_status: "manual_extraction_needed",
      final_reason: "Classifier approved the thread, but the extractor returned zero clear cases.",
    };
  }

  if (stage === "classifier") {
    if (classifier?.should_seed === true) {
      return {
        final_status: "manual_extraction_needed",
        final_reason: "Classifier sees at least one valid case, but extraction or strict validation did not produce a usable seed.",
      };
    }
    if (classifier?.has_confirmed_resolution === false) {
      return {
        final_status: "reject_no_confirmed_resolution",
        final_reason: "Thread describes a fault but does not confirm a successful repair for the same case.",
      };
    }
    if (classifier?.has_required_fields === false) {
      return {
        final_status: "manual_review_classifier",
        final_reason: "Classifier sees a likely resolved case, but required fields or case linkage remain weak.",
      };
    }
    return {
      final_status: "manual_review_classifier",
      final_reason: "Classifier-stage review item needs manual inspection.",
    };
  }

  return {
    final_status: "unclassified_review_item",
    final_reason: "Unknown review stage.",
  };
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

async function main() {
  const [, , reviewDir, outDir] = process.argv;
  if (!reviewDir || !outDir) usage(1);

  await fs.mkdir(outDir, { recursive: true });
  const stamp = dateStamp();
  const files = (await fs.readdir(reviewDir))
    .filter((name) => name.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  const triageRows = [];
  const promoteRows = [];

  for (const fileName of files) {
    const fullPath = path.join(reviewDir, fileName);
    const review = await readJson(fullPath);
    const rebuiltCandidate = buildCandidateSeed(review);
    const triage = classifyReview(review, rebuiltCandidate);

    const row = {
      file: fileName,
      review_id: review.review_id ?? "",
      stage: review.stage ?? "",
      final_status: triage.final_status,
      thread_title: review.thread_title ?? "",
      thread_url: review.thread_url ?? "",
      reason: review.reason ?? "",
      final_reason: triage.final_reason,
      should_seed: review?.classifier?.should_seed ?? "",
      has_confirmed_resolution: review?.classifier?.has_confirmed_resolution ?? "",
      same_user_confirms_resolution: review?.classifier?.same_user_confirms_resolution ?? "",
      has_required_fields: review?.classifier?.has_required_fields ?? "",
      model_raw: review?.extracted_raw?.model_raw ?? "",
      engine_raw: review?.extracted_raw?.engine_raw ?? "",
      remapped_vehicle_model: rebuiltCandidate?.vehicle_model ?? "",
      remapped_engine_power: rebuiltCandidate?.engine_power ?? "",
      candidate_local_id: rebuiltCandidate?.local_id ?? "",
    };

    triageRows.push(row);

    if (triage.final_status === "promote_ready_candidate" && rebuiltCandidate) {
      promoteRows.push(rebuiltCandidate);
    }
  }

  const summary = {
    reviewed_total: triageRows.length,
    by_stage: Object.fromEntries(
      [...triageRows.reduce((map, row) => {
        map.set(row.stage, (map.get(row.stage) ?? 0) + 1);
        return map;
      }, new Map()).entries()].sort(),
    ),
    by_final_status: Object.fromEntries(
      [...triageRows.reduce((map, row) => {
        map.set(row.final_status, (map.get(row.final_status) ?? 0) + 1);
        return map;
      }, new Map()).entries()].sort(),
    ),
    promote_ready_candidates: promoteRows.length,
  };

  const triageJsonl = path.join(outDir, `to_review_full_triage_${stamp}.jsonl`);
  const triageCsv = path.join(outDir, `to_review_full_triage_${stamp}.csv`);
  const promoteJsonl = path.join(outDir, `to_review_promote_ready_candidates_${stamp}.jsonl`);
  const promoteCsv = path.join(outDir, `to_review_promote_ready_candidates_${stamp}.csv`);
  const summaryPath = path.join(outDir, `to_review_full_triage_${stamp}_summary.json`);

  await writeJsonl(triageJsonl, triageRows);
  await writeCsv(triageCsv, triageRows, [
    "file",
    "review_id",
    "stage",
    "final_status",
    "thread_title",
    "thread_url",
    "reason",
    "final_reason",
    "should_seed",
    "has_confirmed_resolution",
    "same_user_confirms_resolution",
    "has_required_fields",
    "model_raw",
    "engine_raw",
    "remapped_vehicle_model",
    "remapped_engine_power",
    "candidate_local_id",
  ]);
  await writeJsonl(promoteJsonl, promoteRows);
  await writeCsv(promoteCsv, promoteRows, [
    "local_id",
    "thread_url",
    "vehicle_brand",
    "vehicle_model",
    "mileage",
    "engine_power",
    "description",
    "resolution",
    "closed_at",
  ]);
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    summary_path: summaryPath,
    triage_jsonl: triageJsonl,
    promote_jsonl: promoteJsonl,
    reviewed_total: summary.reviewed_total,
    promote_ready_candidates: summary.promote_ready_candidates,
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
