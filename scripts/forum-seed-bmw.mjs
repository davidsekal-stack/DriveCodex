#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { buildClubCrawlerApi } from "./forum-seed-club-root.mjs";

const ROOT_URL = "https://www.bmw-club.cz/forum";

const MODEL_ALIAS_BY_LABEL = new Map([
  ["1 E87 (2004–2011)", ["1 E81", "1 E82", "1 E87", "1 E88"]],
  ["1 F20 (2011–2019)", ["1 F20", "1 F21"]],
  ["1 F40 (2019–dosud)", ["1 F40"]],
  ["2 F22 Coupé (2014–2021)", ["2 F22", "2 F23"]],
  ["2 G42 Coupé (2022–dosud)", ["2 G42"]],
  ["2 Active Tourer F45 (2014–2021)", ["2 F45", "2 F46"]],
  ["2 Active Tourer U06 (2022–dosud)", ["2 U06"]],
  ["3 E90 (2005–2012)", ["3 E90", "3 E91", "3 E92", "3 E93"]],
  ["3 F30 (2012–2019)", ["3 F30", "3 F31", "3 F34"]],
  ["3 G20 (2019–dosud)", ["3 G20", "3 G21"]],
  ["4 F32/F33/F36 (2013–2020)", ["4 F32", "4 F33", "4 F36"]],
  ["4 G22/G23/G26 (2020–dosud)", ["4 G22", "4 G23", "4 G26"]],
  ["5 E60 (2003–2010)", ["5 E60", "5 E61"]],
  ["5 F10 (2010–2017)", ["5 F10", "5 F11"]],
  ["5 G30 (2017–dosud)", ["5 G30", "5 G31"]],
  ["6 E63/E64 (2003–2010)", ["6 E63", "6 E64"]],
  ["6 F06/F12/F13 (2011–2018)", ["6 F06", "6 F12", "6 F13"]],
  ["7 F01 (2008–2015)", ["7 F01", "7 F02"]],
  ["7 G11 (2015–2022)", ["7 G11", "7 G12"]],
  ["7 G70 (2022–dosud)", ["7 G70"]],
  ["X1 E84 (2009–2015)", ["X1 E84"]],
  ["X1 F48 (2015–2022)", ["X1 F48"]],
  ["X1 U11 (2022–dosud)", ["X1 U11"]],
  ["X2 F39 (2018–2023)", ["X2 F39"]],
  ["X2 U10 (2024–dosud)", ["X2 U10"]],
  ["X3 F25 (2010–2017)", ["X3 F25"]],
  ["X3 G01 (2017–dosud)", ["X3 G01"]],
  ["X4 F26 (2014–2018)", ["X4 F26"]],
  ["X4 G02 (2018–dosud)", ["X4 G02"]],
  ["X5 E70 (2006–2013)", ["X5 E70"]],
  ["X5 F15 (2013–2018)", ["X5 F15"]],
  ["X5 G05 (2018–dosud)", ["X5 G05"]],
  ["X6 E71 (2008–2014)", ["X6 E71"]],
  ["X6 F16 (2014–2019)", ["X6 F16"]],
  ["X6 G06 (2019–dosud)", ["X6 G06"]],
  ["X7 G07 (2018–dosud)", ["X7 G07"]],
  ["Z4 E85/E86 (2002–2008)", ["Z4 E85", "Z4 E86"]],
  ["Z4 E89 (2009–2016)", ["Z4 E89"]],
  ["Z4 G29 (2019–dosud)", ["Z4 G29"]],
  ["i3 (2013–2022)", ["i3"]],
  ["i4 (2021–dosud)", ["i4"]],
  ["i5 (2023–dosud)", ["i5"]],
  ["i7 (2022–dosud)", ["i7"]],
  ["iX (2021–dosud)", ["iX"]],
]);

const FORUM_HINTS = new Map([
  ["1-e81-e82-e87-e88", { forum_type: "model", resolved_model: "1 E87 (2004–2011)", candidate_models: [] }],
  ["1-f20-f21", { forum_type: "model", resolved_model: "1 F20 (2011–2019)", candidate_models: [] }],
  ["1-f40", { forum_type: "model", resolved_model: "1 F40 (2019–dosud)", candidate_models: [] }],
  ["2-f22-f23", { forum_type: "model", resolved_model: "2 F22 Coupé (2014–2021)", candidate_models: [] }],
  ["2-g42", { forum_type: "model", resolved_model: "2 G42 Coupé (2022–dosud)", candidate_models: [] }],
  ["2-f45-f46", { forum_type: "model", resolved_model: "2 Active Tourer F45 (2014–2021)", candidate_models: [] }],
  ["2-u06", { forum_type: "model", resolved_model: "2 Active Tourer U06 (2022–dosud)", candidate_models: [] }],
  ["3-e90-e91-e92-e93", { forum_type: "model", resolved_model: "3 E90 (2005–2012)", candidate_models: [] }],
  ["3-f30-f31-f34", { forum_type: "model", resolved_model: "3 F30 (2012–2019)", candidate_models: [] }],
  ["3-g20-g21", { forum_type: "model", resolved_model: "3 G20 (2019–dosud)", candidate_models: [] }],
  ["4-f32-f33-f36", { forum_type: "model", resolved_model: "4 F32/F33/F36 (2013–2020)", candidate_models: [] }],
  ["4-g22-g23-g26", { forum_type: "model", resolved_model: "4 G22/G23/G26 (2020–dosud)", candidate_models: [] }],
  ["5-e60-e61", { forum_type: "model", resolved_model: "5 E60 (2003–2010)", candidate_models: [] }],
  ["5-f10-f11", { forum_type: "model", resolved_model: "5 F10 (2010–2017)", candidate_models: [] }],
  ["5-g30-g31", { forum_type: "model", resolved_model: "5 G30 (2017–dosud)", candidate_models: [] }],
  ["6-e63-e64", { forum_type: "model", resolved_model: "6 E63/E64 (2003–2010)", candidate_models: [] }],
  ["6-f06-f12-f13", { forum_type: "model", resolved_model: "6 F06/F12/F13 (2011–2018)", candidate_models: [] }],
  ["7-f01-f02", { forum_type: "model", resolved_model: "7 F01 (2008–2015)", candidate_models: [] }],
  ["7-g11-g12", { forum_type: "model", resolved_model: "7 G11 (2015–2022)", candidate_models: [] }],
  ["7-g70", { forum_type: "model", resolved_model: "7 G70 (2022–dosud)", candidate_models: [] }],
  ["x1-e84", { forum_type: "model", resolved_model: "X1 E84 (2009–2015)", candidate_models: [] }],
  ["x1-f48", { forum_type: "model", resolved_model: "X1 F48 (2015–2022)", candidate_models: [] }],
  ["x1-u11", { forum_type: "model", resolved_model: "X1 U11 (2022–dosud)", candidate_models: [] }],
  ["x2-f39", { forum_type: "model", resolved_model: "X2 F39 (2018–2023)", candidate_models: [] }],
  ["x2-u10", { forum_type: "model", resolved_model: "X2 U10 (2024–dosud)", candidate_models: [] }],
  ["x3-f25", { forum_type: "model", resolved_model: "X3 F25 (2010–2017)", candidate_models: [] }],
  ["x3-g01", { forum_type: "model", resolved_model: "X3 G01 (2017–dosud)", candidate_models: [] }],
  ["x4-f26", { forum_type: "model", resolved_model: "X4 F26 (2014–2018)", candidate_models: [] }],
  ["x4-g02", { forum_type: "model", resolved_model: "X4 G02 (2018–dosud)", candidate_models: [] }],
  ["x5-e70", { forum_type: "model", resolved_model: "X5 E70 (2006–2013)", candidate_models: [] }],
  ["x5-f15", { forum_type: "model", resolved_model: "X5 F15 (2013–2018)", candidate_models: [] }],
  ["x5-g05", { forum_type: "model", resolved_model: "X5 G05 (2018–dosud)", candidate_models: [] }],
  ["x6-e71", { forum_type: "model", resolved_model: "X6 E71 (2008–2014)", candidate_models: [] }],
  ["x6-f16", { forum_type: "model", resolved_model: "X6 F16 (2014–2019)", candidate_models: [] }],
  ["x6-g06", { forum_type: "model", resolved_model: "X6 G06 (2019–dosud)", candidate_models: [] }],
  ["x7-g07", { forum_type: "model", resolved_model: "X7 G07 (2018–dosud)", candidate_models: [] }],
  ["z4-e85-e86", { forum_type: "model", resolved_model: "Z4 E85/E86 (2002–2008)", candidate_models: [] }],
  ["z4-e89", { forum_type: "model", resolved_model: "Z4 E89 (2009–2016)", candidate_models: [] }],
  ["z4-g29", { forum_type: "model", resolved_model: "Z4 G29 (2019–dosud)", candidate_models: [] }],
  ["z4", { forum_type: "model_family", resolved_model: null, candidate_models: ["Z4 E85/E86 (2002–2008)", "Z4 E89 (2009–2016)", "Z4 G29 (2019–dosud)"], note: "Generic Z4 forum spans multiple post-2000 generations." }],
  ["i3", { forum_type: "model", resolved_model: "i3 (2013–2022)", candidate_models: [] }],
  ["i4", { forum_type: "model", resolved_model: "i4 (2021–dosud)", candidate_models: [] }],
  ["i5", { forum_type: "model", resolved_model: "i5 (2023–dosud)", candidate_models: [] }],
  ["i7", { forum_type: "model", resolved_model: "i7 (2022–dosud)", candidate_models: [] }],
  ["ix", { forum_type: "model", resolved_model: "iX (2021–dosud)", candidate_models: [] }],
]);

function restrictBmwCandidates({ models, rawText, normalizeForumMatchText }) {
  const normalized = normalizeForumMatchText(rawText);
  if (!normalized) return models;

  const code = normalized.match(/\b(?:e\d{2}|f\d{2}|g\d{2}|u06|u10|u11)\b/i)?.[0] ?? "";
  if (!code) return models;

  return models.filter((model) => normalizeForumMatchText(model.label).includes(code));
}

const api = buildClubCrawlerApi({
  brand: "BMW",
  rootUrl: ROOT_URL,
  forum: "bmw_club_cz",
  minModelStartYear: 2000,
  rootHintNote: "Root BMW forum discovery input. Only post-2000 BMW model and generation forums are kept.",
  modelAliasByLabel: MODEL_ALIAS_BY_LABEL,
  forumHints: FORUM_HINTS,
  normalizeReplacements: [
    [/\břada\b/gi, " "],
    [/\bseries\b/gi, " "],
  ],
  signalPatterns: [
    /\b(n47|b47|n20|b48|n55|b58|n57|b57|vanos|valvetronic|xdrive|zf)\b/i,
  ],
  restrictCandidates: restrictBmwCandidates,
});

export const parseArgs = api.parseArgs;
export const extractRelNextUrl = api.extractRelNextUrl;
export const discoverBmwRootCategoriesFromRoot = api.discoverRootCategoriesFromRoot;
export const classifyBmwTopicEntry = api.classifyTopicEntry;
export const extractBmwTopicEntriesFromForumPage = api.extractTopicEntriesFromForumPage;
export const inferBmwForumInventory = api.inferForumInventory;
export const resolveBmwVehicleModel = api.resolveVehicleModel;

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  api.main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
