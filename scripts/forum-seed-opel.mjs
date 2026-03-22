#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { buildClubCrawlerApi } from "./forum-seed-club-root.mjs";

const ROOT_URL = "https://www.club-opel.com/forum";

const MODEL_ALIAS_BY_LABEL = new Map([
  ["Corsa C (2000–2006)", ["Corsa C"]],
  ["Corsa D (2006–2014)", ["Corsa D"]],
  ["Corsa E (2014–2019)", ["Corsa E"]],
  ["Corsa F (2019–dosud)", ["Corsa F"]],
  ["Astra H (2004–2010)", ["Astra H"]],
  ["Astra J (2009–2015)", ["Astra J"]],
  ["Astra K (2015–2021)", ["Astra K"]],
  ["Astra L (2021–dosud)", ["Astra L"]],
  ["Vectra C (2002–2008)", ["Vectra C"]],
  ["Signum (2003–2008)", ["Signum"]],
  ["Insignia A (2008–2017)", ["Insignia A"]],
  ["Insignia B (2017–2022)", ["Insignia B"]],
  ["Meriva A (2003–2010)", ["Meriva A"]],
  ["Meriva B (2010–2017)", ["Meriva B"]],
  ["Antara (2006–2015)", ["Antara"]],
  ["Mokka A (2012–2016)", ["Mokka A"]],
  ["Mokka X (2016–2020)", ["Mokka X"]],
  ["Mokka B (2021–dosud)", ["Mokka B"]],
  ["Crossland X (2017–2020)", ["Crossland X"]],
  ["Crossland (2020–2024)", ["Crossland"]],
  ["Grandland I (2017–2024)", ["Grandland I"]],
  ["Grandland II (2024–dosud)", ["Grandland II"]],
  ["Combo C (2001–2011)", ["Combo C"]],
  ["Combo D (2011–2018)", ["Combo D"]],
  ["Combo E (2018–dosud)", ["Combo E"]],
  ["Vivaro A (2001–2014)", ["Vivaro A"]],
  ["Vivaro B (2014–2019)", ["Vivaro B"]],
  ["Vivaro C (2019–dosud)", ["Vivaro C"]],
  ["Zafira B (2005–2014)", ["Zafira B"]],
  ["Zafira Tourer / Zafira C (2011–2019)", ["Zafira C", "Zafira Tourer"]],
  ["Zafira Life / Zafira Electric (2019–dosud)", ["Zafira Life", "Zafira Electric"]],
  ["ADAM (2013–2019)", ["ADAM"]],
  ["KARL (2015–2019)", ["KARL"]],
  ["Cascada (2013–2019)", ["Cascada"]],
  ["Movano B 2.3 CDTI (2010–2021)", ["Movano B"]],
  ["Movano C 2.2 Diesel (2021–dosud)", ["Movano C"]],
  ["Movano Electric (2021–dosud)", ["Movano Electric"]],
]);

const FORUM_HINTS = new Map([
  ["corsa-c", { forum_type: "model", resolved_model: "Corsa C (2000–2006)", candidate_models: [] }],
  ["corsa-d", { forum_type: "model", resolved_model: "Corsa D (2006–2014)", candidate_models: [] }],
  ["corsa-e", { forum_type: "model", resolved_model: "Corsa E (2014–2019)", candidate_models: [] }],
  ["corsa-f", { forum_type: "model", resolved_model: "Corsa F (2019–dosud)", candidate_models: [] }],
  ["astra-h", { forum_type: "model", resolved_model: "Astra H (2004–2010)", candidate_models: [] }],
  ["astra-j", { forum_type: "model", resolved_model: "Astra J (2009–2015)", candidate_models: [] }],
  ["astra-k", { forum_type: "model", resolved_model: "Astra K (2015–2021)", candidate_models: [] }],
  ["astra-l", { forum_type: "model", resolved_model: "Astra L (2021–dosud)", candidate_models: [] }],
  ["vectra-c", { forum_type: "model", resolved_model: "Vectra C (2002–2008)", candidate_models: [] }],
  ["signum", { forum_type: "model", resolved_model: "Signum (2003–2008)", candidate_models: [] }],
  ["insignia-a", { forum_type: "model", resolved_model: "Insignia A (2008–2017)", candidate_models: [] }],
  ["insignia-b", { forum_type: "model", resolved_model: "Insignia B (2017–2022)", candidate_models: [] }],
  ["meriva-a", { forum_type: "model", resolved_model: "Meriva A (2003–2010)", candidate_models: [] }],
  ["meriva-b", { forum_type: "model", resolved_model: "Meriva B (2010–2017)", candidate_models: [] }],
  ["antara", { forum_type: "model", resolved_model: "Antara (2006–2015)", candidate_models: [] }],
  ["mokka-a", { forum_type: "model", resolved_model: "Mokka A (2012–2016)", candidate_models: [] }],
  ["mokka-x", { forum_type: "model", resolved_model: "Mokka X (2016–2020)", candidate_models: [] }],
  ["mokka-b", { forum_type: "model", resolved_model: "Mokka B (2021–dosud)", candidate_models: [] }],
  ["mokka", { forum_type: "model_family", resolved_model: null, candidate_models: ["Mokka A (2012–2016)", "Mokka X (2016–2020)", "Mokka B (2021–dosud)"], note: "Generic Mokka forum spans multiple post-2000 generations." }],
  ["crossland-x", { forum_type: "model", resolved_model: "Crossland X (2017–2020)", candidate_models: [] }],
  ["crossland", { forum_type: "model_family", resolved_model: null, candidate_models: ["Crossland X (2017–2020)", "Crossland (2020–2024)"], note: "Generic Crossland forum spans pre- and post-facelift versions." }],
  ["grandland-i", { forum_type: "model", resolved_model: "Grandland I (2017–2024)", candidate_models: [] }],
  ["grandland-ii", { forum_type: "model", resolved_model: "Grandland II (2024–dosud)", candidate_models: [] }],
  ["grandland", { forum_type: "model_family", resolved_model: null, candidate_models: ["Grandland I (2017–2024)", "Grandland II (2024–dosud)"], note: "Generic Grandland forum spans multiple post-2000 generations." }],
  ["combo-c", { forum_type: "model", resolved_model: "Combo C (2001–2011)", candidate_models: [] }],
  ["combo-d", { forum_type: "model", resolved_model: "Combo D (2011–2018)", candidate_models: [] }],
  ["combo-e", { forum_type: "model", resolved_model: "Combo E (2018–dosud)", candidate_models: [] }],
  ["combo", { forum_type: "model_family", resolved_model: null, candidate_models: ["Combo C (2001–2011)", "Combo D (2011–2018)", "Combo E (2018–dosud)"], note: "Generic Combo forum spans multiple post-2000 generations." }],
  ["vivaro-a", { forum_type: "model", resolved_model: "Vivaro A (2001–2014)", candidate_models: [] }],
  ["vivaro-b", { forum_type: "model", resolved_model: "Vivaro B (2014–2019)", candidate_models: [] }],
  ["vivaro-c", { forum_type: "model", resolved_model: "Vivaro C (2019–dosud)", candidate_models: [] }],
  ["vivaro", { forum_type: "model_family", resolved_model: null, candidate_models: ["Vivaro A (2001–2014)", "Vivaro B (2014–2019)", "Vivaro C (2019–dosud)"], note: "Generic Vivaro forum spans multiple post-2000 generations." }],
  ["zafira-b", { forum_type: "model", resolved_model: "Zafira B (2005–2014)", candidate_models: [] }],
  ["zafira-c", { forum_type: "model", resolved_model: "Zafira Tourer / Zafira C (2011–2019)", candidate_models: [] }],
  ["zafira-life", { forum_type: "model", resolved_model: "Zafira Life / Zafira Electric (2019–dosud)", candidate_models: [] }],
  ["zafira", { forum_type: "model_family", resolved_model: null, candidate_models: ["Zafira B (2005–2014)", "Zafira Tourer / Zafira C (2011–2019)", "Zafira Life / Zafira Electric (2019–dosud)"], note: "Generic Zafira forum spans multiple post-2000 generations." }],
  ["adam", { forum_type: "model", resolved_model: "ADAM (2013–2019)", candidate_models: [] }],
  ["karl", { forum_type: "model", resolved_model: "KARL (2015–2019)", candidate_models: [] }],
  ["cascada", { forum_type: "model", resolved_model: "Cascada (2013–2019)", candidate_models: [] }],
  ["movano-b", { forum_type: "model", resolved_model: "Movano B 2.3 CDTI (2010–2021)", candidate_models: [] }],
  ["movano-c", { forum_type: "model", resolved_model: "Movano C 2.2 Diesel (2021–dosud)", candidate_models: [] }],
  ["movano-electric", { forum_type: "model", resolved_model: "Movano Electric (2021–dosud)", candidate_models: [] }],
  ["movano", { forum_type: "model_family", resolved_model: null, candidate_models: ["Movano B 2.3 CDTI (2010–2021)", "Movano C 2.2 Diesel (2021–dosud)", "Movano Electric (2021–dosud)"], note: "Generic Movano forum spans multiple post-2000 generations." }],
]);

const OPEL_CODE_SPECS = [
  { model: "astra", codes: ["g", "h", "j", "k", "l"] },
  { model: "corsa", codes: ["b", "c", "d", "e", "f"] },
  { model: "vectra", codes: ["b", "c"] },
  { model: "zafira", codes: ["a", "b", "c"] },
  { model: "combo", codes: ["b", "c", "d", "e"] },
  { model: "vivaro", codes: ["a", "b", "c"] },
  { model: "movano", codes: ["a", "b", "c"] },
  { model: "meriva", codes: ["a", "b"] },
  { model: "insignia", codes: ["a", "b"] },
  { model: "mokka", codes: ["a", "x", "b"] },
];

function restrictOpelCandidates({ models, rawText, normalizeForumMatchText }) {
  const normalized = normalizeForumMatchText(rawText);
  if (!normalized) return models;

  for (const spec of OPEL_CODE_SPECS) {
    const match = normalized.match(new RegExp(`\\b${spec.model}\\s+([${spec.codes.join("")}])\\b`, "i"));
    if (!match) continue;

    const code = match[1].toLowerCase();
    return models.filter((model) => {
      const label = normalizeForumMatchText(model.label);
      if (!label.includes(spec.model)) return false;
      if (spec.model === "mokka" && code === "x") return label.includes("mokka x");
      return label.includes(`${spec.model} ${code}`);
    });
  }

  return models;
}

const api = buildClubCrawlerApi({
  brand: "Opel",
  rootUrl: ROOT_URL,
  forum: "club_opel_com",
  minModelStartYear: 2000,
  rootHintNote: "Root Opel forum discovery input. Only post-2000 Opel model and generation forums are kept.",
  modelAliasByLabel: MODEL_ALIAS_BY_LABEL,
  forumHints: FORUM_HINTS,
  signalPatterns: [
    /\b(ecotec|cdti|dti|biturbo|opc|gse|start\/stop)\b/i,
  ],
  restrictCandidates: restrictOpelCandidates,
});

export const parseArgs = api.parseArgs;
export const extractRelNextUrl = api.extractRelNextUrl;
export const discoverOpelRootCategoriesFromRoot = api.discoverRootCategoriesFromRoot;
export const classifyOpelTopicEntry = api.classifyTopicEntry;
export const extractOpelTopicEntriesFromForumPage = api.extractTopicEntriesFromForumPage;
export const inferOpelForumInventory = api.inferForumInventory;
export const resolveOpelVehicleModel = api.resolveVehicleModel;

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  api.main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
