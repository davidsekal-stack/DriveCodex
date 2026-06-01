#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { buildClubCrawlerApi } from "./forum-seed-club-root.mjs";

const ROOT_URL = "https://www.skoda-club.net/forum";

const MODEL_ALIAS_BY_LABEL = new Map([
  ["Citigo (2011–2020)", ["Citigo"]],
  ["Fabia II (2007–2014)", ["Fabia II", "Fabia 2", "5J"]],
  ["Fabia III (2014–2021)", ["Fabia III", "Fabia 3", "NJ"]],
  ["Fabia IV (2021–)", ["Fabia IV", "Fabia 4", "PJ"]],
  ["Rapid (2012–2019)", ["Rapid", "Rapid Spaceback", "NH"]],
  ["Roomster (2006–2015)", ["Roomster", "5J Roomster"]],
  ["Octavia II (2006–2013)", ["Octavia II", "Octavia 2", "1Z", "Octavia A5"]],
  ["Octavia III (2013–2020)", ["Octavia III", "Octavia 3", "5E", "Octavia A7"]],
  ["Octavia IV (2020–2024)", ["Octavia IV", "Octavia 4", "NX"]],
  ["Octavia IV FL (2024–dosud)", ["Octavia IV FL", "Octavia 4 FL", "NX FL", "2024 Octavia", "2025 Octavia"]],
  ["Superb II (2008–2015)", ["Superb II", "Superb 2", "3T"]],
  ["Superb III (2015–2024)", ["Superb III", "Superb 3", "3V"]],
  ["Superb IV (2024–dosud)", ["Superb IV", "Superb 4", "2024 Superb", "2025 Superb"]],
  ["Yeti (2009–2017)", ["Yeti", "5L"]],
  ["Scala (2019–)", ["Scala", "NW"]],
  ["Kamiq (2019–)", ["Kamiq", "NW4"]],
  ["Karoq (2017–)", ["Karoq", "NU"]],
  ["Kodiaq I (2016–2024)", ["Kodiaq", "Kodiaq I", "Kodiaq 1", "Kodiaq Scout", "NS7"]],
  ["Kodiaq II (2024–dosud)", ["Kodiaq II", "Kodiaq 2", "2024 Kodiaq", "2025 Kodiaq"]],
  ["Enyaq iV (2021–)", ["Enyaq", "Enyaq iV", "Enyaq Coupe", "Enyaq Coupé"]],
]);

const FORUM_HINTS = new Map([
  ["citigo", { forum_type: "model", resolved_model: "Citigo (2011–2020)", candidate_models: [] }],
  ["fabia-i", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "Fabia I starts before 2000 and is intentionally out of the primary Skoda crawl scope." }],
  ["fabia-ii", { forum_type: "model", resolved_model: "Fabia II (2007–2014)", candidate_models: [] }],
  ["fabia-iii", { forum_type: "model", resolved_model: "Fabia III (2014–2021)", candidate_models: [] }],
  ["fabia-iv", { forum_type: "model", resolved_model: "Fabia IV (2021–)", candidate_models: [] }],
  ["rapid", { forum_type: "model", resolved_model: "Rapid (2012–2019)", candidate_models: [] }],
  ["roomster", { forum_type: "model", resolved_model: "Roomster (2006–2015)", candidate_models: [] }],
  ["octavia-i", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "Octavia I starts before 2000 and is intentionally out of the primary Skoda crawl scope." }],
  ["octavia-ii", { forum_type: "model", resolved_model: "Octavia II (2006–2013)", candidate_models: [] }],
  ["octavia-iii", { forum_type: "model", resolved_model: "Octavia III (2013–2020)", candidate_models: [] }],
  ["octavia-iv", { forum_type: "model_family", resolved_model: null, candidate_models: ["Octavia IV (2020–2024)", "Octavia IV FL (2024–dosud)"] }],
  ["superb-i", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "Superb I remains out of primary scope to keep the crawl focused on post-2000-start generations." }],
  ["superb-ii", { forum_type: "model", resolved_model: "Superb II (2008–2015)", candidate_models: [] }],
  ["superb-iii", { forum_type: "model", resolved_model: "Superb III (2015–2024)", candidate_models: [] }],
  ["superb-iv", { forum_type: "model", resolved_model: "Superb IV (2024–dosud)", candidate_models: [] }],
  ["yeti", { forum_type: "model", resolved_model: "Yeti (2009–2017)", candidate_models: [] }],
  ["scala", { forum_type: "model", resolved_model: "Scala (2019–)", candidate_models: [] }],
  ["kamiq", { forum_type: "model", resolved_model: "Kamiq (2019–)", candidate_models: [] }],
  ["karoq", { forum_type: "model", resolved_model: "Karoq (2017–)", candidate_models: [] }],
  ["kodiaq", { forum_type: "model_family", resolved_model: null, candidate_models: ["Kodiaq I (2016–2024)", "Kodiaq II (2024–dosud)"] }],
  ["enyaq", { forum_type: "model", resolved_model: "Enyaq iV (2021–)", candidate_models: [] }],
  ["epiq", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "Future/preview model forum is excluded until production catalog coverage exists." }],
  ["peaq", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "Concept/preview forum is excluded." }],
  ["kushaq", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "Regional non-EU model is excluded from the primary EU Skoda crawl." }],
  ["slavia", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "Regional non-EU model is excluded from the primary EU Skoda crawl." }],
  ["praktik", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "Praktik stays out until dedicated catalog support is added." }],
  ["favorit", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["felicia", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["forman", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["100", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["1000", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["105", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["1100", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["110", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["110-r", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["120", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["1202", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["1203", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["125", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["130", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["135", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["pokec-vseobecny", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["technicky-koutek", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["navody", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["tuning-a-upravy", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["ukradena-vozidla", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["dopravni-prestupky", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["klubove-zalezitosti", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["o-srazech-a-akcich", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["o-vozech-nasich-clenu", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["o-clancich", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["skupiny", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["vtipy", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
]);

function restrictSkodaCandidates({ models, rawText, normalizeForumMatchText }) {
  const normalized = normalizeForumMatchText(rawText);
  if (!normalized) return models;

  if (/\b(fabia ii|fabia 2|5j)\b/i.test(normalized)) {
    return models.filter((model) => /Fabia II/i.test(model.label));
  }
  if (/\b(fabia iii|fabia 3|nj)\b/i.test(normalized)) {
    return models.filter((model) => /Fabia III/i.test(model.label));
  }
  if (/\b(fabia iv|fabia 4|pj)\b/i.test(normalized)) {
    return models.filter((model) => /Fabia IV/i.test(model.label));
  }
  if (/\b(octavia ii|octavia 2|1z|a5)\b/i.test(normalized)) {
    return models.filter((model) => /Octavia II/i.test(model.label));
  }
  if (/\b(octavia iii|octavia 3|5e|a7)\b/i.test(normalized)) {
    return models.filter((model) => /Octavia III/i.test(model.label));
  }
  if (/\b(octavia iv fl|octavia 4 fl|nx fl|2024 octavia|2025 octavia)\b/i.test(normalized)) {
    return models.filter((model) => /Octavia IV FL/i.test(model.label));
  }
  if (/\b(octavia iv|octavia 4|nx)\b/i.test(normalized)) {
    return models.filter((model) => /Octavia IV/i.test(model.label) && !/FL/i.test(model.label));
  }
  if (/\b(superb ii|superb 2|3t)\b/i.test(normalized)) {
    return models.filter((model) => /Superb II/i.test(model.label));
  }
  if (/\b(superb iii|superb 3|3v)\b/i.test(normalized)) {
    return models.filter((model) => /Superb III/i.test(model.label));
  }
  if (/\b(superb iv|superb 4|2024 superb|2025 superb)\b/i.test(normalized)) {
    return models.filter((model) => /Superb IV/i.test(model.label));
  }
  if (/\b(kodiaq ii|kodiaq 2|2024 kodiaq|2025 kodiaq)\b/i.test(normalized)) {
    return models.filter((model) => /Kodiaq II/i.test(model.label));
  }
  if (/\b(kodiaq i|kodiaq 1|ns7)\b/i.test(normalized)) {
    return models.filter((model) => /Kodiaq I/i.test(model.label));
  }

  return models;
}

function filterSkodaRootCategory(item) {
  const forumUrl = (item?.forum_url ?? "").toString();
  if (/\/forum-kategorie\/rapid-35(?:$|[/?#])/i.test(forumUrl)) {
    return {
      keep: false,
      forum_type: "unknown",
      resolved_model: null,
      candidate_models: [],
      note: "Legacy Rapid forum with pre-2000 Rapid 130/135 content is excluded from the primary post-2000 Skoda crawl.",
      skip_reason: "Legacy Rapid forum is outside the primary post-2000 crawl scope.",
    };
  }
  return null;
}

const api = buildClubCrawlerApi({
  brand: "Škoda",
  rootUrl: ROOT_URL,
  forum: "skoda_club_net",
  minModelStartYear: 2000,
  rootHintNote: "Root Skoda forum discovery input. Only conservative Skoda model forums with 2000+ generation starts are kept.",
  modelAliasByLabel: MODEL_ALIAS_BY_LABEL,
  forumHints: FORUM_HINTS,
  normalizeReplacements: [
    [/\bskoda\b/gi, "škoda"],
    [/\bskoda\s+auto\b/gi, "škoda"],
    [/\bcoupe\b/gi, "coupé"],
    [/\boctavia\s+iv\s+facelift\b/gi, "octavia iv fl"],
  ],
  titleNoisePatterns: [
    /\bjak[yý]\s+olej\b/i,
    /\bolej\s+do\b/i,
    /^\s*emise\s*$/i,
    /^\s*chladi[cč][ií]\s+(kapalina|zmes|sm[eě]s)\s*$/i,
    /^\s*posunut[yý]\s+volant\s*$/i,
    /\bk[óo]d\s+r[aá]dia\b/i,
    /\bk[oó]d\s+barvy\b/i,
    /\bk[oó]dov[aá]n[ií]\s+baterie\b/i,
    /\br[aá]dio\b/i,
    /\bautor[aá]dio\b/i,
    /\bnavigac/i,
    /\bč[ií]slo\s+d[ií]lu\b/i,
    /\bn[aá]hradn[ií]\s+d[ií]l\b/i,
    /\bservisn[ií]\s+interval\b/i,
    /\bbaterie\s+do\s+kl[ií][čc]e\b/i,
    /\bta[zž]n[eé]\s+za[rř][ií]zen[ií]\b/i,
    /\bstatick[eé]\s+zat[ií][žz]en[ií]\s+st[řr]echy\b/i,
    /\bsound\s+system\b/i,
    /\bplechov[ýy]\s+disk\b/i,
    /\bvnit[řr]n[ií]\s+rozm[eě]ry\b/i,
    /\bchipnout\b/i,
    /\bmanual\b/i,
    /\bn[aá]vod\b/i,
    /\bhow\s+to\b/i,
    /^\s*(r[aá]dio|navigace|olej|manu[aá]l|n[aá]vod)\s*$/i,
  ],
  signalPatterns: [
    /\btsi\b/i,
    /\btdi\b/i,
    /\bmpi\b/i,
    /\bhtp\b/i,
    /\biv\b/i,
    /\be-tec\b/i,
    /\bmechatronik\b/i,
    /\bdsg\b/i,
    /\bhaldex\b/i,
    /\badblue\b/i,
  ],
  restrictCandidates: restrictSkodaCandidates,
  filterRootCategory: filterSkodaRootCategory,
});

export const parseArgs = api.parseArgs;
export const extractRelNextUrl = api.extractRelNextUrl;
export const discoverSkodaRootCategoriesFromRoot = api.discoverRootCategoriesFromRoot;
export const classifySkodaTopicEntry = api.classifyTopicEntry;
export const extractSkodaTopicEntriesFromForumPage = api.extractTopicEntriesFromForumPage;
export const inferSkodaForumInventory = api.inferForumInventory;
export const resolveSkodaVehicleModel = api.resolveVehicleModel;

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  api.main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
