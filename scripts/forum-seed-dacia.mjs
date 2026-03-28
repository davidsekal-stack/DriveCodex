#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { buildClubCrawlerApi } from "./forum-seed-club-root.mjs";

const ROOT_URL = "https://www.daciaclub.cz/forum";

const MODEL_ALIAS_BY_LABEL = new Map([
  ["Logan I (2006–2012)", ["Logan I"]],
  ["Logan II (2012–2020)", ["Logan II"]],
  ["Logan III (2021–dosud)", ["Logan III"]],
  ["Sandero I (2008–2012)", ["Sandero I"]],
  ["Sandero II (2012–2020)", ["Sandero II"]],
  ["Sandero III (2021–dosud)", ["Sandero III"]],
  ["Duster I (2010–2017)", ["Duster I"]],
  ["Duster II (2018–2024)", ["Duster II"]],
  ["Duster III (2024–dosud)", ["Duster III"]],
  ["Bigster (2025–dosud)", ["Bigster"]],
  ["Dokker (2012–2020)", ["Dokker"]],
  ["Lodgy (2012–2022)", ["Lodgy"]],
  ["Jogger (2022–dosud)", ["Jogger"]],
  ["Spring (2021–dosud)", ["Spring"]],
]);

const FORUM_HINTS = new Map([
  ["bigster", { forum_type: "model", resolved_model: "Bigster (2025–dosud)", candidate_models: [] }],
  ["duster-i", { forum_type: "model", resolved_model: "Duster I (2010–2017)", candidate_models: [] }],
  ["duster-ii", { forum_type: "model", resolved_model: "Duster II (2018–2024)", candidate_models: [] }],
  ["duster-iii", { forum_type: "model", resolved_model: "Duster III (2024–dosud)", candidate_models: [] }],
  ["duster-oroch", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "Duster Oroch is an officially produced Renault pickup for Latin American markets, not a verified Dacia catalog model." }],
  ["logan-i", { forum_type: "model", resolved_model: "Logan I (2006–2012)", candidate_models: [] }],
  ["logan-ii", { forum_type: "model", resolved_model: "Logan II (2012–2020)", candidate_models: [] }],
  ["logan-iii", { forum_type: "model", resolved_model: "Logan III (2021–dosud)", candidate_models: [] }],
  ["sandero-i", { forum_type: "model", resolved_model: "Sandero I (2008–2012)", candidate_models: [] }],
  ["sandero-ii", { forum_type: "model", resolved_model: "Sandero II (2012–2020)", candidate_models: [] }],
  ["sandero-iii", { forum_type: "model", resolved_model: "Sandero III (2021–dosud)", candidate_models: [] }],
  ["sandero-iv", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "Sandero IV is excluded because official Dacia sources still show the current Sandero as the third generation." }],
  ["dokker", { forum_type: "model", resolved_model: "Dokker (2012–2020)", candidate_models: [] }],
  ["lodgy", { forum_type: "model", resolved_model: "Lodgy (2012–2022)", candidate_models: [] }],
  ["jogger", { forum_type: "model", resolved_model: "Jogger (2022–dosud)", candidate_models: [] }],
  ["spring", { forum_type: "model", resolved_model: "Spring (2021–dosud)", candidate_models: [] }],
  ["1300-1310", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["nova", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["solenza", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["supernova", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["dacia-ambasador", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["ostatni", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["pokec-vseobecny", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["technicky-koutek", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["dopravni-prestupky", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["navody", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["tuning-a-upravy", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["klubove-zalezitosti", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["o-srazech-a-akcich", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["o-vozech-nasich-clenu", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["o-clancich", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["skupiny", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["vtipy", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
]);

function restrictDaciaCandidates({ models, rawText, normalizeForumMatchText }) {
  const normalized = normalizeForumMatchText(rawText);
  if (!normalized) return models;

  if (/\b(1300|1310|nova|solenza|supernova|ambasador|oroch|sandero iv|navody|tuning|pokec|sraz|skupiny|vtipy)\b/i.test(normalized)) {
    return [];
  }

  const exactMatch = normalized.match(/\b(logan|sandero|duster)\s+(i{1,3}|iv)\b/i);
  if (!exactMatch) return models;

  const [, family, generation] = exactMatch;
  return models.filter((model) => {
    const label = normalizeForumMatchText(model.label);
    return label.includes(family) && new RegExp(`\\b${generation}\\b`, "i").test(label);
  });
}

const api = buildClubCrawlerApi({
  brand: "Dacia",
  rootUrl: ROOT_URL,
  forum: "daciaclub_cz",
  minModelStartYear: 2000,
  rootHintNote: "Root Dacia forum discovery input. Only post-2000 Dacia model and generation forums are kept.",
  modelAliasByLabel: MODEL_ALIAS_BY_LABEL,
  forumHints: FORUM_HINTS,
  titleNoisePatterns: [
    /\bjakou?\s+diagnostik/i,
    /\bktor[aá]\s+diagnostik/i,
    /\bservis\s+[a-zá-ž]+/i,
    /\bled\s+(sv[eě]tla|d[aá]lkov[eé])/i,
    /\bv[ýy]m[eě]na\s+[žz][aá]rovk/i,
    /\bhomologace\b/i,
    /\bdisky?\b/i,
    /\bloketn[ií]\s+op[eě]rka/i,
    /\bautoseda[cč]k/i,
    /\bp[řr][ií]davná\s+sv[eě]tla/i,
    /\b(v[yý]b[eě]r\s+sněhov[ýy]ch?\s+[řr]et[eě]z|plato\s+zavazadlov[eé]ho?\s+prostoru|palubn[ií]\s+po[cč][ií]ta[cč]|se[řr][ií]zen[ií]\s+p[řr]edn[ií]ch?\s+ost[řr]ikova[cč][ůu])\b/i,
    /\b(rozvody|brzdov[eé]\s+(kotou[cč]e|desti[cč]ky|platni[cč]ky)|palivov[ýy]\s+filtr|filtr(?:e|y)?\b|vým[eě]na\s+sv[ií][cč]ek|typ\s+chladiac(?:ej|i)\s+kapalin|nemrznouc[aiá])\b/i,
    /\b(aku\s+bateri[ií]|baterie\s+karty|vým[eě]na\s+lpg\s+n[aá]drže|olej\s+do\s+p[řr]evodovky|jaky?\s+olej|ak[yý]\s+olej|spot[řr]eba|tankov[aá]n[ií]\s+lpg)\b/i,
  ],
  signalPatterns: [
    /\b(sce|tce|dci|blue dci|eco-g|lpg|edc|cvt)\b/i,
  ],
  restrictCandidates: restrictDaciaCandidates,
});

export const parseArgs = api.parseArgs;
export const extractRelNextUrl = api.extractRelNextUrl;
export const discoverDaciaRootCategoriesFromRoot = api.discoverRootCategoriesFromRoot;
export const classifyDaciaTopicEntry = api.classifyTopicEntry;
export const extractDaciaTopicEntriesFromForumPage = api.extractTopicEntriesFromForumPage;
export const inferDaciaForumInventory = api.inferForumInventory;
export const resolveDaciaVehicleModel = api.resolveVehicleModel;

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  api.main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
