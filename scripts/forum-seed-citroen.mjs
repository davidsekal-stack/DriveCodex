#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { buildClubCrawlerApi } from "./forum-seed-club-root.mjs";

const ROOT_URL = "https://www.citroen-club.cz/forum";

const MODEL_ALIAS_BY_LABEL = new Map([
  ["C1 I (2005–2014)", ["C1 I"]],
  ["C1 II (2014–2022)", ["C1 II"]],
  ["C2 (2003–2009)", ["C2"]],
  ["C3 I (2002–2009)", ["C3 I"]],
  ["C3 II (2009–2016)", ["C3 II"]],
  ["C3 III (2016–současnost)", ["C3 III"]],
  ["C3 Picasso (2009–2017)", ["C3 Picasso"]],
  ["C3 Aircross (2017–současnost)", ["C3 Aircross"]],
  ["C4 I (2004–2010)", ["C4 I"]],
  ["C4 II (2010–2018)", ["C4 II"]],
  ["C4 III / ë-C4 (2020–současnost)", ["C4 III", "e-C4", "ë-C4"]],
  ["C4 Picasso / Grand C4 Picasso I (2006–2013)", ["C4 Picasso I", "Grand C4 Picasso I", "C4 Grand Picasso I"]],
  ["C4 Picasso / Grand C4 Picasso II / SpaceTourer (2013–2022)", ["C4 Picasso II", "Grand C4 Picasso II", "SpaceTourer"]],
  ["C4 Cactus (2014–2020)", ["C4 Cactus"]],
  ["C5 Aircross (2018–současnost)", ["C5 Aircross"]],
  ["C6 (2005–2012)", ["C6"]],
  ["C8 (2002–2014)", ["C8"]],
  ["C-Crosser (2007–2012)", ["C-Crosser", "C Crosser"]],
  ["C5 III (2008–2017)", ["C5 III"]],
  ["C5 X (2022–současnost)", ["C5 X"]],
  ["Berlingo II (2008–2018)", ["Berlingo II"]],
  ["Berlingo III (2018–současnost)", ["Berlingo III"]],
  ["Nemo / Nemo Multispace (2008–2017)", ["Nemo", "Nemo Multispace"]],
  ["Jumpy II (2007–2016)", ["Jumpy II"]],
  ["Jumpy III (2016–současnost)", ["Jumpy III"]],
  ["Jumper III 2.2 HDi (2006–2016)", ["Jumper III 2.2 HDi"]],
  ["Jumper III 2.0/2.2 BlueHDi (2016–současnost)", ["Jumper III FL"]],
  ["DS3 (2010–2019)", ["DS3"]],
  ["DS4 (2011–2018)", ["DS4"]],
  ["DS5 (2011–2018)", ["DS5"]],
]);

const FORUM_HINTS = new Map([
  ["c1-i", { forum_type: "model", resolved_model: "C1 I (2005–2014)", candidate_models: [] }],
  ["c1-ii", { forum_type: "model", resolved_model: "C1 II (2014–2022)", candidate_models: [] }],
  ["c1", { forum_type: "model_family", resolved_model: null, candidate_models: ["C1 I (2005–2014)", "C1 II (2014–2022)"], note: "Generic C1 forum spans multiple post-2000 generations." }],
  ["c2", { forum_type: "model", resolved_model: "C2 (2003–2009)", candidate_models: [] }],
  ["c3-i", { forum_type: "model", resolved_model: "C3 I (2002–2009)", candidate_models: [] }],
  ["c3-ii", { forum_type: "model", resolved_model: "C3 II (2009–2016)", candidate_models: [] }],
  ["c3-iii", { forum_type: "model", resolved_model: "C3 III (2016–současnost)", candidate_models: [] }],
  ["c3-pluriel", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "C3 Pluriel is intentionally excluded until it is verified and catalogued separately." }],
  ["c3-picasso", { forum_type: "model", resolved_model: "C3 Picasso (2009–2017)", candidate_models: [] }],
  ["c3-aircross", { forum_type: "model", resolved_model: "C3 Aircross (2017–současnost)", candidate_models: [] }],
  ["c4-i", { forum_type: "model", resolved_model: "C4 I (2004–2010)", candidate_models: [] }],
  ["c4-ii", { forum_type: "model", resolved_model: "C4 II (2010–2018)", candidate_models: [] }],
  ["c4-iii", { forum_type: "model", resolved_model: "C4 III / ë-C4 (2020–současnost)", candidate_models: [] }],
  ["c4-picasso-grand-i", { forum_type: "model", resolved_model: "C4 Picasso / Grand C4 Picasso I (2006–2013)", candidate_models: [] }],
  ["c4-picasso-grand-ii", { forum_type: "model", resolved_model: "C4 Picasso / Grand C4 Picasso II / SpaceTourer (2013–2022)", candidate_models: [] }],
  ["c4-picasso", { forum_type: "model_family", resolved_model: null, candidate_models: ["C4 Picasso / Grand C4 Picasso I (2006–2013)", "C4 Picasso / Grand C4 Picasso II / SpaceTourer (2013–2022)"], note: "Generic C4 Picasso forum spans multiple post-2000 generations." }],
  ["c4-aircross", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "C4 Aircross is not yet mapped into the verified Citroen catalog." }],
  ["c4-cactus", { forum_type: "model", resolved_model: "C4 Cactus (2014–2020)", candidate_models: [] }],
  ["c4-x", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "C4 X is not yet mapped into the verified Citroen catalog." }],
  ["c5-iii", { forum_type: "model", resolved_model: "C5 III (2008–2017)", candidate_models: [] }],
  ["c5-aircross", { forum_type: "model", resolved_model: "C5 Aircross (2018–současnost)", candidate_models: [] }],
  ["c5-x", { forum_type: "model", resolved_model: "C5 X (2022–současnost)", candidate_models: [] }],
  ["c6", { forum_type: "model", resolved_model: "C6 (2005–2012)", candidate_models: [] }],
  ["c8", { forum_type: "model", resolved_model: "C8 (2002–2014)", candidate_models: [] }],
  ["c-crosser", { forum_type: "model", resolved_model: "C-Crosser (2007–2012)", candidate_models: [] }],
  ["c-zero", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "C-Zero is intentionally excluded until it is verified and catalogued separately." }],
  ["berlingo-ii", { forum_type: "model", resolved_model: "Berlingo II (2008–2018)", candidate_models: [] }],
  ["berlingo-iii", { forum_type: "model", resolved_model: "Berlingo III (2018–současnost)", candidate_models: [] }],
  ["nemo", { forum_type: "model", resolved_model: "Nemo / Nemo Multispace (2008–2017)", candidate_models: [] }],
  ["jumpy-ii", { forum_type: "model", resolved_model: "Jumpy II (2007–2016)", candidate_models: [] }],
  ["jumpy-iii", { forum_type: "model", resolved_model: "Jumpy III (2016–současnost)", candidate_models: [] }],
  ["jumpy-dispatch", { forum_type: "model_family", resolved_model: null, candidate_models: ["Jumpy II (2007–2016)", "Jumpy III (2016–současnost)"], note: "Generic Jumpy / Dispatch forum spans multiple post-2000 generations." }],
  ["jumpy", { forum_type: "model_family", resolved_model: null, candidate_models: ["Jumpy II (2007–2016)", "Jumpy III (2016–současnost)"], note: "Generic Jumpy forum spans multiple post-2000 generations." }],
  ["jumper", { forum_type: "model_family", resolved_model: null, candidate_models: ["Jumper III 2.2 HDi (2006–2016)", "Jumper III 2.0/2.2 BlueHDi (2016–současnost)"], note: "Generic Jumper forum spans pre- and post-facelift versions." }],
  ["jumper-iii", { forum_type: "model_family", resolved_model: null, candidate_models: ["Jumper III 2.2 HDi (2006–2016)", "Jumper III 2.0/2.2 BlueHDi (2016–současnost)"], note: "Generic Jumper III forum spans pre- and post-facelift versions." }],
  ["ds3", { forum_type: "model", resolved_model: "DS3 (2010–2019)", candidate_models: [] }],
  ["ds3-ii", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "DS3 II is intentionally excluded until it is verified and catalogued separately." }],
  ["ds4", { forum_type: "model", resolved_model: "DS4 (2011–2018)", candidate_models: [] }],
  ["ds5", { forum_type: "model", resolved_model: "DS5 (2011–2018)", candidate_models: [] }],
]);

function restrictCitroenCandidates({ models, rawText, normalizeForumMatchText }) {
  const normalized = normalizeForumMatchText(rawText);
  if (!normalized) return models;

  if (/\b(xsara|xantia|zx|saxo|ax|xm|bx|pluriel|c zero|czero)\b/i.test(normalized)) return [];

  const familyMatch = normalized.match(/\b(c[1-8]|berlingo|jumpy|jumper)\s+(i{1,3}|iv)\b/i);
  if (familyMatch) {
    const [, modelToken, generation] = familyMatch;
    return models.filter((model) => {
      const label = normalizeForumMatchText(model.label);
      return label.includes(modelToken) && new RegExp(`\\b${generation}\\b`, "i").test(label);
    });
  }

  const picassoMatch = normalized.match(/\b(?:c4\s+picasso|grand\s+c4\s+picasso|c4\s+grand)\s+(i{1,2})\b/i);
  if (picassoMatch) {
    const generation = picassoMatch[1];
    return models.filter((model) => {
      const label = normalizeForumMatchText(model.label);
      return label.includes("c4 picasso") && new RegExp(`\\b${generation}\\b`, "i").test(label);
    });
  }

  return models;
}

const api = buildClubCrawlerApi({
  brand: "Citroën",
  rootUrl: ROOT_URL,
  forum: "citroen_club_cz",
  minModelStartYear: 2000,
  rootHintNote: "Root Citroen forum discovery input. Only post-2000 Citroen model and generation forums are kept.",
  modelAliasByLabel: MODEL_ALIAS_BY_LABEL,
  forumHints: FORUM_HINTS,
  normalizeReplacements: [
    [/\bgrand\s+c4\b/gi, "grand c4 picasso"],
  ],
  signalPatterns: [
    /\b(hdi|bluehdi|puretech|vti|thp|bmp6|egs|hydra(?:ctive)?|adblue)\b/i,
  ],
  restrictCandidates: restrictCitroenCandidates,
});

export const parseArgs = api.parseArgs;
export const extractRelNextUrl = api.extractRelNextUrl;
export const discoverCitroenRootCategoriesFromRoot = api.discoverRootCategoriesFromRoot;
export const classifyCitroenTopicEntry = api.classifyTopicEntry;
export const extractCitroenTopicEntriesFromForumPage = api.extractTopicEntriesFromForumPage;
export const inferCitroenForumInventory = api.inferForumInventory;
export const resolveCitroenVehicleModel = api.resolveVehicleModel;

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  api.main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
