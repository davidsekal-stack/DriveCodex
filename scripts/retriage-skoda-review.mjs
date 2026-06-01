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
import { resolveSkodaVehicleModel } from "./forum-seed-skoda.mjs";

const DEFAULT_FORUM = "skoda_club_net";
const DEFAULT_USER_ID = "ai_importer";

const SKODA_ENTRY = selectCatalogForMarket("eu").catalog.find(
  (entry) => normalizeText(entry.brand) === normalizeText("Škoda"),
);

if (!SKODA_ENTRY) {
  throw new Error("Skoda brand entry was not found in web/src/constants/catalog.js");
}

function usage(exitCode = 1) {
  console.log("Usage: node scripts/retriage-skoda-review.mjs <to_review_dir> <out_dir>");
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

  const extracted = review.extracted_raw;
  const threadTitle = (review.thread_title ?? "").toString();
  const parentForumTitle = (review.parent_forum_title ?? "").toString();
  const subforumUrl = (review.subforum_url ?? "").toString();
  const sourceUrl = (review.thread_url ?? "").toString();

  const modelContext = [
    threadTitle,
    extracted?.engine_raw ?? "",
    extracted?.engine_code_raw ?? "",
    extracted?.description ?? "",
  ]
    .filter(Boolean)
    .join(" | ");

  const vehicle_model = resolveSkodaVehicleModel({
    modelRaw: extracted?.model_raw ?? "",
    threadTitle,
    parentForumTitle,
    subforumUrl,
    extraText: modelContext,
  }) ?? null;

  const engine_power = vehicle_model
    ? pickEnginePower(
        SKODA_ENTRY,
        vehicle_model,
        [
          extracted?.engine_raw ?? "",
          modelContext,
          parentForumTitle,
        ].filter(Boolean).join(" | "),
      )
    : null;

  let description = (extracted?.description ?? "").toString();
  const engineCodeRaw = (extracted?.engine_code_raw ?? "").toString().trim();
  if (engineCodeRaw && !normalizeText(description).includes(normalizeText(engineCodeRaw))) {
    description = description.trim()
      ? `${description.trim()} Engine code: ${engineCodeRaw}.`
      : `Engine code: ${engineCodeRaw}.`;
  }

  const metadata = {
    source_type: "forum_skoda_club_net",
    source_ref: "www.skoda-club.net/forum",
    thread_title: threadTitle || null,
    case_author: extracted?.case_author || null,
    catalog_mapping: buildCatalogMapping({
      modelRaw: extracted?.model_raw ?? "",
      threadTitle,
      parentForumTitle,
      vehicleModel: vehicle_model,
    }),
  };

  const canonical = {
    vehicle_brand: "Škoda",
    vehicle_model,
    engine_power,
  };

  return {
    local_id: computeLocalId({
      forum: DEFAULT_FORUM,
      sourceUrl,
      item: extracted,
      canonical,
    }),
    user_id: review?.candidate?.user_id || DEFAULT_USER_ID,
    thread_url: sourceUrl || null,
    vehicle_brand: "Škoda",
    vehicle_model,
    mileage: typeof extracted?.mileage === "number" ? Math.trunc(extracted.mileage) : null,
    engine_power,
    symptoms: canonicalizeSymptoms(extracted?.symptoms),
    obd_codes: ensureArrayOfStrings(extracted?.obd_codes).map((code) => code.toUpperCase()),
    description,
    resolution: (extracted?.resolution ?? "").toString(),
    closed_at: toIsoOrNow(extracted?.closed_at),
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
        final_reason: "Resolved case now maps to catalog and passes READY validation.",
      };
    }
    if (!rebuiltCandidate?.vehicle_model) {
      return {
        final_status: "model_resolution_needed",
        final_reason: "Resolved case exists, but the vehicle model still cannot be mapped safely.",
      };
    }
    return {
      final_status: "record_hold",
      final_reason: "Resolved case exists, but strict READY validation still fails.",
    };
  }

  if (stage === "extractor") {
    return {
      final_status: "manual_extraction_needed",
      final_reason: "Classifier approved the thread, but extractor returned zero clear cases.",
    };
  }

  if (stage === "classifier") {
    if (classifier?.should_seed === true && classifier?.has_confirmed_resolution === true && classifier?.has_required_fields === false) {
      return {
        final_status: "manual_review_classifier",
        final_reason: "Likely resolved case, but required fields or linkage are still weak.",
      };
    }
    if (classifier?.has_confirmed_resolution === false) {
      return {
        final_status: "reject_no_confirmed_resolution",
        final_reason: "Thread describes a fault, but no successful repair is clearly confirmed.",
      };
    }
    if (classifier?.has_required_fields === false) {
      return {
        final_status: "manual_review_classifier",
        final_reason: "Resolution may exist, but fields remain too weak for safe import.",
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
    created_at: new Date().toISOString(),
    review_dir: path.resolve(reviewDir),
    total_review_items: triageRows.length,
    final_status_counts: Object.fromEntries(
      [...triageRows.reduce((map, row) => {
        map.set(row.final_status, (map.get(row.final_status) ?? 0) + 1);
        return map;
      }, new Map()).entries()].sort((a, b) => a[0].localeCompare(b[0])),
    ),
    promoted_ready_candidates: promoteRows.length,
  };

  const triageJsonl = path.join(outDir, `to_review_full_triage_${stamp}.jsonl`);
  const triageCsv = path.join(outDir, `to_review_full_triage_${stamp}.csv`);
  const promoteJsonl = path.join(outDir, `to_review_promote_ready_candidates_${stamp}.jsonl`);
  const summaryJson = path.join(outDir, `to_review_full_triage_${stamp}_summary.json`);

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
  await fs.writeFile(summaryJson, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(
    `Processed ${triageRows.length} review item(s). Promoted ${promoteRows.length} candidate(s) into: ${outDir}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
