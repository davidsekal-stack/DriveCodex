#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { buildClubCrawlerApi } from "./forum-seed-club-root.mjs";

const ROOT_URL = "https://www.seatclub.cz/forum";

const MODEL_ALIAS_BY_LABEL = new Map([
  ["Mii (2012–2020)", ["Mii"]],
  ["Ibiza III 6L (2002–2008)", ["Ibiza III", "Ibiza 6L"]],
  ["Ibiza IV (2008–2017)", ["Ibiza IV", "Ibiza 6J"]],
  ["Ibiza V (2017–dosud)", ["Ibiza V", "Ibiza KJ"]],
  ["Leon II 1P (2005–2012)", ["Leon II", "Leon 1P"]],
  ["Leon III (2012–2020)", ["Leon III", "Leon 5F"]],
  ["Leon IV (2020–dosud)", ["Leon IV", "Leon KL"]],
  ["Cordoba II (2002–2009)", ["Cordoba", "Cordoba II"]],
  ["Toledo III 5P (2004–2009)", ["Toledo III", "Toledo 5P"]],
  ["Toledo IV (2012–2019)", ["Toledo IV", "Toledo NH"]],
  ["Altea / Altea XL / Freetrack (2004–2015)", ["Altea", "Altea XL", "Freetrack"]],
  ["Exeo / Exeo ST (2009–2013)", ["Exeo", "Exeo ST", "Exeo 3R"]],
  ["Arona (2017–dosud)", ["Arona"]],
  ["Ateca (2016–dosud)", ["Ateca"]],
  ["Tarraco (2018–dosud)", ["Tarraco"]],
  ["Alhambra II (2010–2022)", ["Alhambra II", "Alhambra 7N"]],
]);

const FORUM_HINTS = new Map([
  ["mii", { forum_type: "model", resolved_model: "Mii (2012–2020)", candidate_models: [] }],
  ["ibiza-i-021a", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["ibiza-ii-typ-6k", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["ibiza-iii-6l", { forum_type: "model", resolved_model: "Ibiza III 6L (2002–2008)", candidate_models: [] }],
  ["ibiza-iv-6j", { forum_type: "model", resolved_model: "Ibiza IV (2008–2017)", candidate_models: [] }],
  ["ibiza-v-kj", { forum_type: "model", resolved_model: "Ibiza V (2017–dosud)", candidate_models: [] }],
  ["ibiza", { forum_type: "model_family", resolved_model: null, candidate_models: ["Ibiza III 6L (2002–2008)", "Ibiza IV (2008–2017)", "Ibiza V (2017–dosud)"], note: "Generic Ibiza forum spans multiple post-2000 generations." }],
  ["leon-i-typ-1m", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["leon-ii-1p", { forum_type: "model", resolved_model: "Leon II 1P (2005–2012)", candidate_models: [] }],
  ["leon-iii-5f", { forum_type: "model", resolved_model: "Leon III (2012–2020)", candidate_models: [] }],
  ["leon-iv-kl", { forum_type: "model", resolved_model: "Leon IV (2020–dosud)", candidate_models: [] }],
  ["leon", { forum_type: "model_family", resolved_model: null, candidate_models: ["Leon II 1P (2005–2012)", "Leon III (2012–2020)", "Leon IV (2020–dosud)"], note: "Generic Leon forum spans multiple post-2000 generations." }],
  ["cordoba-i-typ-6k", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["cordoba-ii", { forum_type: "model", resolved_model: "Cordoba II (2002–2009)", candidate_models: [] }],
  ["toledo-mk1-typ-1l", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["toledo-mk2-typ-1m", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["toledo-iii-5p", { forum_type: "model", resolved_model: "Toledo III 5P (2004–2009)", candidate_models: [] }],
  ["toledo-mk4-typ-nh", { forum_type: "model", resolved_model: "Toledo IV (2012–2019)", candidate_models: [] }],
  ["toledo-iv-nh", { forum_type: "model", resolved_model: "Toledo IV (2012–2019)", candidate_models: [] }],
  ["toledo", { forum_type: "model_family", resolved_model: null, candidate_models: ["Toledo III 5P (2004–2009)", "Toledo IV (2012–2019)"], note: "Generic Toledo forum spans multiple post-2000 generations." }],
  ["altea", { forum_type: "model", resolved_model: "Altea / Altea XL / Freetrack (2004–2015)", candidate_models: [] }],
  ["exeo", { forum_type: "model", resolved_model: "Exeo / Exeo ST (2009–2013)", candidate_models: [] }],
  ["arona", { forum_type: "model", resolved_model: "Arona (2017–dosud)", candidate_models: [] }],
  ["ateca", { forum_type: "model", resolved_model: "Ateca (2016–dosud)", candidate_models: [] }],
  ["tarraco", { forum_type: "model", resolved_model: "Tarraco (2018–dosud)", candidate_models: [] }],
  ["alhambra-typ-7m", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["alhambra-typ-7n", { forum_type: "model", resolved_model: "Alhambra II (2010–2022)", candidate_models: [] }],
  ["alhambra-ii", { forum_type: "model", resolved_model: "Alhambra II (2010–2022)", candidate_models: [] }],
]);

function restrictSeatCandidates({ models, rawText, normalizeForumMatchText }) {
  const normalized = normalizeForumMatchText(rawText);
  if (!normalized) return models;

  if (/\b(1l|1m|021a|6k|7m)\b/i.test(normalized) || /\b(mk1|mk2)\b/i.test(normalized)) {
    return [];
  }

  const modelGenMatch = normalized.match(/\b(ibiza|leon|toledo|cordoba)\s+(ii|iii|iv|v)\b/i);
  if (modelGenMatch) {
    const [, modelName, generation] = modelGenMatch;
    return models.filter((model) => {
      const label = normalizeForumMatchText(model.label);
      return label.includes(modelName) && new RegExp(`\\b${generation}\\b`, "i").test(label);
    });
  }

  const uniqueCode = normalized.match(/\b(?:1p|3r|5f|6j|7n|kj|kl|nh)\b/i)?.[0] ?? "";
  if (!uniqueCode) return models;

  return models.filter((model) => normalizeForumMatchText(model.label).includes(uniqueCode));
}

const api = buildClubCrawlerApi({
  brand: "SEAT",
  rootUrl: ROOT_URL,
  forum: "seatclub_cz",
  minModelStartYear: 2000,
  rootHintNote: "Root SEAT forum discovery input. Only post-2000 SEAT model and generation forums are kept.",
  modelAliasByLabel: MODEL_ALIAS_BY_LABEL,
  forumHints: FORUM_HINTS,
  signalPatterns: [
    /\b(tsi|tdi|tgi|ecofuel|cupra|dsg|e-hybrid|etsi|fsi)\b/i,
  ],
  restrictCandidates: restrictSeatCandidates,
});

export const parseArgs = api.parseArgs;
export const extractRelNextUrl = api.extractRelNextUrl;
export const discoverSeatRootCategoriesFromRoot = api.discoverRootCategoriesFromRoot;
export const classifySeatTopicEntry = api.classifyTopicEntry;
export const extractSeatTopicEntriesFromForumPage = api.extractTopicEntriesFromForumPage;
export const inferSeatForumInventory = api.inferForumInventory;
export const resolveSeatVehicleModel = api.resolveVehicleModel;

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  api.main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
