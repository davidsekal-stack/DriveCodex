#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { buildClubCrawlerApi } from "./forum-seed-club-root.mjs";

const ROOT_URL = "https://cs.tesla-club.eu/forum";

const MODEL_ALIAS_BY_LABEL = new Map([
  ["Roadster I (2008–2012)", ["Roadster I", "Tesla Roadster 2008", "Tesla Roadster"]],
  ["Model 3 (2017–2023)", ["Model 3 pre-Highland", "Model 3 2017", "Model 3 2018", "Model 3 2019", "Model 3 2020", "Model 3 2021", "Model 3 2022", "Model 3 2023"]],
  ["Model 3 Highland (2024–dosud)", ["Model 3 Highland", "Highland", "Model 3 2024", "Model 3 2025", "Model 3 2026"]],
  ["Model Y (2020–2024)", ["Model Y pre-Juniper", "Model Y 2020", "Model Y 2021", "Model Y 2022", "Model Y 2023", "Model Y 2024"]],
  ["Model Y Juniper (2025–dosud)", ["Model Y Juniper", "Juniper", "Model Y 2025", "Model Y 2026"]],
  ["Model S (2012–2020)", ["Model S pre-refresh", "Model S 2012", "Model S 2013", "Model S 2014", "Model S 2015", "Model S 2016", "Model S 2017", "Model S 2018", "Model S 2019", "Model S 2020"]],
  ["Model S (2021–dosud)", ["Model S refresh", "Model S 2021", "Model S 2022", "Model S 2023", "Model S 2024", "Model S 2025", "Model S 2026", "Model S Plaid"]],
  ["Model X (2015–2020)", ["Model X pre-refresh", "Model X 2015", "Model X 2016", "Model X 2017", "Model X 2018", "Model X 2019", "Model X 2020"]],
  ["Model X (2021–dosud)", ["Model X refresh", "Model X 2021", "Model X 2022", "Model X 2023", "Model X 2024", "Model X 2025", "Model X 2026", "Model X Plaid"]],
  ["Cybertruck (2023–dosud)", ["Cybertruck"]],
  ["Semi (2022–dosud)", ["Tesla Semi", "Semi"]],
]);

const FORUM_HINTS = new Map([
  ["model-3", {
    forum_type: "model_family",
    resolved_model: null,
    candidate_models: ["Model 3 (2017–2023)", "Model 3 Highland (2024–dosud)"],
    note: "Generic Model 3 forum spans pre-Highland and Highland generations.",
  }],
  ["model-s", {
    forum_type: "model_family",
    resolved_model: null,
    candidate_models: ["Model S (2012–2020)", "Model S (2021–dosud)"],
    note: "Generic Model S forum spans pre-refresh and refresh generations.",
  }],
  ["model-x", {
    forum_type: "model_family",
    resolved_model: null,
    candidate_models: ["Model X (2015–2020)", "Model X (2021–dosud)"],
    note: "Generic Model X forum spans pre-refresh and refresh generations.",
  }],
  ["model-y", {
    forum_type: "model_family",
    resolved_model: null,
    candidate_models: ["Model Y (2020–2024)", "Model Y Juniper (2025–dosud)"],
    note: "Generic Model Y forum spans pre-Juniper and Juniper generations.",
  }],
  ["roadster-i", { forum_type: "model", resolved_model: "Roadster I (2008–2012)", candidate_models: [] }],
  ["roadster-ii", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "Roadster II remains excluded until series production is officially confirmed." }],
  ["semi", { forum_type: "model", resolved_model: "Semi (2022–dosud)", candidate_models: [] }],
  ["cybertruck", { forum_type: "model", resolved_model: "Cybertruck (2023–dosud)", candidate_models: [] }],
  ["cybercab-robotaxi", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "Cybercab / Robotaxi remains excluded until series production is officially confirmed." }],
  ["pokec-vseobecny", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["klubove-zalezitosti", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["o-clancich", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
]);

function restrictTeslaCandidates({ models, rawText, normalizeForumMatchText }) {
  const normalized = normalizeForumMatchText(rawText);
  if (!normalized) return models;

  if (/\b(cybercab|robotaxi|roadster ii)\b/i.test(normalized)) return [];

  const families = [
    { pattern: /\bmodel\s*3\b/i, keep: /model 3/ },
    { pattern: /\bmodel\s*y\b/i, keep: /model y/ },
    { pattern: /\bmodel\s*s\b/i, keep: /model s/ },
    { pattern: /\bmodel\s*x\b/i, keep: /model x/ },
    { pattern: /\bcybertruck\b/i, keep: /cybertruck/ },
    { pattern: /\bsemi\b/i, keep: /semi/ },
    { pattern: /\broadster\b/i, keep: /roadster/ },
  ];

  for (const family of families) {
    if (!family.pattern.test(normalized)) continue;
    return models.filter((model) => family.keep.test(normalizeForumMatchText(model.label)));
  }

  return models;
}

const api = buildClubCrawlerApi({
  brand: "Tesla",
  rootUrl: ROOT_URL,
  forum: "tesla_club_eu",
  minModelStartYear: 2000,
  rootHintNote: "Root Tesla forum discovery input. Only officially confirmed post-2000 Tesla production model forums are kept.",
  modelAliasByLabel: MODEL_ALIAS_BY_LABEL,
  forumHints: FORUM_HINTS,
  normalizeReplacements: [
    [/\bmodel3\b/gi, "model 3"],
    [/\bmodely\b/gi, "model y"],
    [/\bmodels\b/gi, "model s"],
    [/\bmodelx\b/gi, "model x"],
    [/\brobotaxi\b/gi, "cybercab robotaxi"],
  ],
  signalPatterns: [
    /\b(bms|hv|high voltage|supercharg(?:e|er)|charge port|charging|heat pump|inverter|battery|12v|low voltage|drive unit|autopilot|fsd|mcu|ptc)\b/i,
  ],
  restrictCandidates: restrictTeslaCandidates,
});

export const parseArgs = api.parseArgs;
export const extractRelNextUrl = api.extractRelNextUrl;
export const discoverTeslaRootCategoriesFromRoot = api.discoverRootCategoriesFromRoot;
export const classifyTeslaTopicEntry = api.classifyTopicEntry;
export const extractTeslaTopicEntriesFromForumPage = api.extractTopicEntriesFromForumPage;
export const inferTeslaForumInventory = api.inferForumInventory;
export const resolveTeslaVehicleModel = api.resolveVehicleModel;

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  api.main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
