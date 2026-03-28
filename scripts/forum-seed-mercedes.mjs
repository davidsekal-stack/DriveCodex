#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { buildClubCrawlerApi } from "./forum-seed-club-root.mjs";

const ROOT_URL = "https://www.mercedesclub.cz/forum";

const MODEL_ALIAS_BY_LABEL = new Map([
  ["A-Class W169 (2004–2012)", ["A-Class W169", "W169", "A 169", "A-Class II"]],
  ["A-Class W176 (2012–2018)", ["A-Class W176", "W176", "A 176"]],
  ["A-Class W177 (2018–současnost)", ["A-Class W177", "W177", "A 177"]],
  ["B-Class W245 (2005–2011)", ["B-Class W245", "W245", "B 245"]],
  ["B-Class W246 (2011–2018)", ["B-Class W246", "W246", "B 246"]],
  ["B-Class W247 (2018–současnost)", ["B-Class W247", "W247", "B 247"]],
  ["C-Class W203 (2000–2007)", ["C-Class W203", "W203", "C 203"]],
  ["C-Class SportCoupé C203 (2001–2008)", ["SportCoupe C203", "SportCoupé C203", "C203", "CL203"]],
  ["C-Class W204 (2007–2014)", ["C-Class W204", "W204", "C 204"]],
  ["C-Class Coupé C204 (2011–2015)", ["C-Class Coupe C204", "C-Class Coupé C204", "C204"]],
  ["CLC CL203 (2008–2011)", ["CLC", "CL203"]],
  ["C-Class W205 (2014–2021)", ["C-Class W205", "W205", "C 205"]],
  ["C-Class W206 (2021–současnost)", ["C-Class W206", "W206", "C 206"]],
  ["E-Class W211 (2002–2009)", ["E-Class W211", "W211", "E 211"]],
  ["E-Class W212 (2009–2016)", ["E-Class W212", "W212", "E 212"]],
  ["E-Class W213 (2016–současnost)", ["E-Class W213", "W213", "E 213"]],
  ["CLA C117 (2013–2019)", ["CLA C117", "C117", "X117"]],
  ["CLA C118 (2019–současnost)", ["CLA C118", "C118", "X118"]],
  ["CLK W209 (2002–2009)", ["CLK W209", "W209", "C209", "A209"]],
  ["CLE C/A236 (2023–dosud)", ["CLE W236", "CLE C236", "CLE A236", "W236", "C236", "A236"]],
  ["SL R230 (2001–2011)", ["SL R230", "R230"]],
  ["SL R231 (2012–2020)", ["SL R231", "R231"]],
  ["SLK R171 (2004–2011)", ["SLK R171", "R171"]],
  ["SLK R172 (2011–2016)", ["SLK R172", "R172"]],
  ["SLC R172 (2016–2020)", ["SLC R172", "SLC", "R172"]],
  ["CL C216 (2006–2013)", ["CL C216", "C216"]],
  ["S-Class W221 (2005–2013)", ["S-Class W221", "W221", "S 221"]],
  ["S-Class W222 (2013–2020)", ["S-Class W222", "W222", "S 222"]],
  ["S-Class Coupé / Cabrio C/A217 (2014–2020)", ["S-Class C217", "S-Class A217", "C217", "A217"]],
  ["CLS C219 (2004–2010)", ["CLS C219", "C219"]],
  ["CLS C218 / X218 (2010–2018)", ["CLS C218", "CLS X218", "C218", "X218"]],
  ["CLS C257 (2018–2023)", ["CLS C257", "C257"]],
  ["R-Class W251 (2005–2013)", ["R-Class W251", "W251"]],
  ["GL-Class X164 (2006–2012)", ["GL-Class X164", "X164"]],
  ["GLA X156 (2013–2020)", ["GLA X156", "X156"]],
  ["GLA H247 (2020–současnost)", ["GLA H247", "H247"]],
  ["GLK X204 (2008–2015)", ["GLK X204", "X204"]],
  ["GLC X253 (2015–2022)", ["GLC X253", "X253"]],
  ["GLC X254 (2022–současnost)", ["GLC X254", "X254"]],
  ["ML-Class W164 (2005–2011)", ["ML W164", "M-Class W164", "W164"]],
  ["ML-Class W166 (2011–2015)", ["ML W166", "M-Class W166", "W166"]],
  ["GLE W166/C292 (2015–2019)", ["GLE W166", "GLE C292", "W166", "C292"]],
  ["GLE V167/C167 (2019–současnost)", ["GLE V167", "GLE C167", "V167", "C167"]],
  ["GL / GLS X166 (2012–2019)", ["GL X166", "GLS X166", "X166"]],
  ["GLS X167 (2019–současnost)", ["GLS X167", "X167"]],
  ["Vito / Viano W639 (2003–2014)", ["Vito W639", "Viano W639", "W639"]],
  ["Vito W447 (2014–současnost)", ["Vito W447", "W447"]],
  ["V-Class W447 (2014–současnost)", ["V-Class W447", "V-Class", "V class", "V 447", "W447"]],
  ["Vaneo W414 (2001–2005)", ["Vaneo W414", "W414"]],
  ["Citan I (2012–2021)", ["Citan W415", "W415", "Citan I"]],
  ["Citan / T-Class II (2022–současnost)", ["Citan II", "T-Class", "W420"]],
  ["EQB X243 (2021–současnost)", ["EQB X243", "EQB", "X243"]],
]);

const FORUM_HINTS = new Map([
  ["a-class-w168", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["a-class-w169", { forum_type: "model", resolved_model: "A-Class W169 (2004–2012)", candidate_models: [] }],
  ["a-class-w176", { forum_type: "model", resolved_model: "A-Class W176 (2012–2018)", candidate_models: [] }],
  ["a-class-w177", { forum_type: "model", resolved_model: "A-Class W177 (2018–současnost)", candidate_models: [] }],
  ["a-class-cla", { forum_type: "model_family", resolved_model: null, candidate_models: ["CLA C117 (2013–2019)", "CLA C118 (2019–současnost)"], note: "Shared CLA-family forum; keep generation conservative." }],
  ["b-class-w245", { forum_type: "model", resolved_model: "B-Class W245 (2005–2011)", candidate_models: [] }],
  ["b-class-w246", { forum_type: "model", resolved_model: "B-Class W246 (2011–2018)", candidate_models: [] }],
  ["b-class-w247", { forum_type: "model", resolved_model: "B-Class W247 (2018–současnost)", candidate_models: [] }],
  ["c-class-w202", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["c-class-w203", { forum_type: "model", resolved_model: "C-Class W203 (2000–2007)", candidate_models: [] }],
  ["c-class-w204", { forum_type: "model", resolved_model: "C-Class W204 (2007–2014)", candidate_models: [] }],
  ["c-class-w205", { forum_type: "model", resolved_model: "C-Class W205 (2014–2021)", candidate_models: [] }],
  ["c-class-w206", { forum_type: "model", resolved_model: "C-Class W206 (2021–současnost)", candidate_models: [] }],
  ["c-class-sportcoupe-c203", { forum_type: "model", resolved_model: "C-Class SportCoupé C203 (2001–2008)", candidate_models: [] }],
  ["c-class-coupe-c204", { forum_type: "model", resolved_model: "C-Class Coupé C204 (2011–2015)", candidate_models: [] }],
  ["cl-c140", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["cl-c215", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["cl-c216", { forum_type: "model", resolved_model: "CL C216 (2006–2013)", candidate_models: [] }],
  ["clc", { forum_type: "model", resolved_model: "CLC CL203 (2008–2011)", candidate_models: [] }],
  ["cle-w236", { forum_type: "model", resolved_model: "CLE C/A236 (2023–dosud)", candidate_models: [] }],
  ["clk-w208", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["clk-w209", { forum_type: "model", resolved_model: "CLK W209 (2002–2009)", candidate_models: [] }],
  ["sl-r230", { forum_type: "model", resolved_model: "SL R230 (2001–2011)", candidate_models: [] }],
  ["sl-r231", { forum_type: "model", resolved_model: "SL R231 (2012–2020)", candidate_models: [] }],
  ["slk-r170", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["slk-r171", { forum_type: "model", resolved_model: "SLK R171 (2004–2011)", candidate_models: [] }],
  ["slk-r172", { forum_type: "model", resolved_model: "SLK R172 (2011–2016)", candidate_models: [] }],
  ["slc-r172", { forum_type: "model", resolved_model: "SLC R172 (2016–2020)", candidate_models: [] }],
  ["s-class-w140", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["s-class-w220", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["s-class-w221", { forum_type: "model", resolved_model: "S-Class W221 (2005–2013)", candidate_models: [] }],
  ["s-class-w222", { forum_type: "model", resolved_model: "S-Class W222 (2013–2020)", candidate_models: [] }],
  ["s-class-c217", { forum_type: "model", resolved_model: "S-Class Coupé / Cabrio C/A217 (2014–2020)", candidate_models: [] }],
  ["cls-c219", { forum_type: "model", resolved_model: "CLS C219 (2004–2010)", candidate_models: [] }],
  ["cls-c218", { forum_type: "model", resolved_model: "CLS C218 / X218 (2010–2018)", candidate_models: [] }],
  ["cls-c257", { forum_type: "model", resolved_model: "CLS C257 (2018–2023)", candidate_models: [] }],
  ["r-class-w251", { forum_type: "model", resolved_model: "R-Class W251 (2005–2013)", candidate_models: [] }],
  ["e-class-w210", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["e-class-w211", { forum_type: "model", resolved_model: "E-Class W211 (2002–2009)", candidate_models: [] }],
  ["e-class-w212", { forum_type: "model", resolved_model: "E-Class W212 (2009–2016)", candidate_models: [] }],
  ["e-class-w213", { forum_type: "model", resolved_model: "E-Class W213 (2016–současnost)", candidate_models: [] }],
  ["e-class-coupe-cabrio", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "Shared E-Class coupe/cabrio forum stays conservative until the exact post-2000 body families are verified in catalog." }],
  ["g-class", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "Generic G-Class forum mixes pre-2000 and post-2000 generations." }],
  ["gl-class", { forum_type: "model", resolved_model: "GL-Class X164 (2006–2012)", candidate_models: [] }],
  ["gla-class", { forum_type: "model_family", resolved_model: null, candidate_models: ["GLA X156 (2013–2020)", "GLA H247 (2020–současnost)"], note: "Generic GLA forum spans first and second generation." }],
  ["glc-class", { forum_type: "model_family", resolved_model: null, candidate_models: ["GLC X253 (2015–2022)", "GLC X254 (2022–současnost)"], note: "Generic GLC forum spans two generations." }],
  ["gle-class", { forum_type: "model_family", resolved_model: null, candidate_models: ["GLE W166/C292 (2015–2019)", "GLE V167/C167 (2019–současnost)"], note: "Generic GLE forum spans two generations." }],
  ["glk-class", { forum_type: "model", resolved_model: "GLK X204 (2008–2015)", candidate_models: [] }],
  ["gls-class", { forum_type: "model_family", resolved_model: null, candidate_models: ["GL / GLS X166 (2012–2019)", "GLS X167 (2019–současnost)"], note: "Generic GLS forum spans late GL and newer GLS generations." }],
  ["ml-w163", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["ml-w164", { forum_type: "model", resolved_model: "ML-Class W164 (2005–2011)", candidate_models: [] }],
  ["ml-w166", { forum_type: "model", resolved_model: "ML-Class W166 (2011–2015)", candidate_models: [] }],
  ["tn", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["mb100", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["vario-w670", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["sprinter", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "Generic Sprinter forum may include first-generation 1995-started vans, so it stays excluded for post-2000-only crawling." }],
  ["vito-viano-w638", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["vito-viano-w639", { forum_type: "model", resolved_model: "Vito / Viano W639 (2003–2014)", candidate_models: [] }],
  ["vito-viano-w447", { forum_type: "model_family", resolved_model: null, candidate_models: ["Vito W447 (2014–současnost)", "V-Class W447 (2014–současnost)"], note: "Shared W447 forum spans Vito and V-Class passenger/van variants." }],
  ["vaneo-w414", { forum_type: "model", resolved_model: "Vaneo W414 (2001–2005)", candidate_models: [] }],
  ["citan-w415", { forum_type: "model", resolved_model: "Citan I (2012–2021)", candidate_models: [] }],
  ["c107", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["r107", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["r129-sl", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["w108-w109", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["w111-w112", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["w114-w115", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["w116", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["w123", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["w124", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["w126", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["w201", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["pokec-vseobecny", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["technicky-koutek", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["dopravni-prestupky", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["vip-arena", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["tuning-a-upravy", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["ukradena-vozidla", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["klubove-zalezitosti", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["o-srazech-a-akcich", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["o-vozech-nasich-clenu", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["o-clancich", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["skupiny", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["vtipy", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["kos", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
]);

function restrictMercedesCandidates({ models, rawText, normalizeForumMatchText }) {
  const normalized = normalizeForumMatchText(rawText);
  if (!normalized) return models;

  if (/\b(w168|w202|c140|c215|w208|r170|w140|w220|w163|w638|c107|r107|r129|w108|w109|w111|w112|w114|w115|w116|w123|w124|w126|w201|tn|mb100|vario)\b/i.test(normalized)) {
    return [];
  }

  const codeMatch = normalized.match(/\b(w169|w176|w177|w245|w246|w247|w203|w204|w205|w206|c203|cl203|c204|c216|c217|a217|c218|x218|c219|c257|w209|c209|a209|w236|c236|a236|r230|r231|r171|r172|w251|w211|x164|x156|h247|x204|x253|x254|w164|w166|c292|v167|c167|x166|x167|w639|w447|w414|w415|w420|x243|c117|x117|c118|x118)\b/i)?.[0] ?? "";
  if (!codeMatch) return models;

  return models.filter((model) => {
    const aliases = MODEL_ALIAS_BY_LABEL.get(model.label) ?? [];
    const corpus = [model.label, ...aliases].map(normalizeForumMatchText).join(" | ");
    return corpus.includes(codeMatch);
  });
}

const api = buildClubCrawlerApi({
  brand: "Mercedes-Benz",
  rootUrl: ROOT_URL,
  forum: "mercedesclub_cz",
  minModelStartYear: 2000,
  rootHintNote: "Root Mercedes forum discovery input. Only post-2000 Mercedes-Benz model and generation forums are kept.",
  modelAliasByLabel: MODEL_ALIAS_BY_LABEL,
  forumHints: FORUM_HINTS,
  normalizeReplacements: [
    [/\bsportcoup[eé]\b/gi, "sportcoupe"],
    [/\bcoup[eé]\b/gi, "coupe"],
    [/\bcabrio(let)?\b/gi, "cabrio"],
    [/\bml-class\b/gi, "ml"],
    [/\bm-class\b/gi, "ml"],
  ],
  signalPatterns: [
    /\b(cdi|bluetec|blueefficiency|kompressor|4matic|7g-tronic|9g-tronic|adblue|om\d{3}|m27\d|m26\d|m25\d|m13\d)\b/i,
  ],
  restrictCandidates: restrictMercedesCandidates,
});

export const parseArgs = api.parseArgs;
export const extractRelNextUrl = api.extractRelNextUrl;
export const discoverMercedesRootCategoriesFromRoot = api.discoverRootCategoriesFromRoot;
export const classifyMercedesTopicEntry = api.classifyTopicEntry;
export const extractMercedesTopicEntriesFromForumPage = api.extractTopicEntriesFromForumPage;
export const inferMercedesForumInventory = api.inferForumInventory;
export const resolveMercedesVehicleModel = api.resolveVehicleModel;

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  api.main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
