#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { buildClubCrawlerApi } from "./forum-seed-club-root.mjs";

const ROOT_URL = "https://www.nissanclub.cz/forum";

const MODEL_ALIAS_BY_LABEL = new Map([
  ["Almera N16 (2000–2006)", ["Almera N16", "N16", "Almera 2000", "Almera 2005"]],
  ["Almera Tino V10 (2000–2006)", ["Almera Tino", "Tino", "V10", "Almera Tino V10"]],
  ["Primera P12 (2001–2007)", ["Primera P12", "P12", "Primera 2002", "Primera 2006"]],
  ["Micra K12 (2002–2010)", ["Micra K12", "K12", "Micra 2003", "Micra 2009"]],
  ["Micra K13 (2010–2017)", ["Micra K13", "K13", "Micra 2011", "Micra 2016"]],
  ["Micra K14 (2017–současnost)", ["Micra K14", "K14", "Micra 2018", "Micra 2024"]],
  ["Note E11 (2006–2013)", ["Note E11", "E11", "Note 2006", "Note 2012"]],
  ["Note E12 (2013–2020)", ["Note E12", "E12", "Note 2014", "Note 2019"]],
  ["Juke F15 (2010–2019)", ["Juke I F15", "Juke F15", "F15", "Juke 2011", "Juke 2018"]],
  ["Juke F16 (2019–současnost)", ["Juke II F16", "Juke F16", "F16", "Juke 2020", "Juke 2024"]],
  ["Qashqai J10 (2007–2013)", ["Qashqai J10", "J10", "Qashqai 2008", "Qashqai 2012"]],
  ["Qashqai J11 (2014–2021)", ["Qashqai J11", "J11", "Qashqai 2015", "Qashqai 2020"]],
  ["Qashqai J12 (2021–současnost)", ["Qashqai J12", "J12", "Qashqai 2022", "Qashqai 2025"]],
  ["X-Trail T30 (2001–2007)", ["X-Trail T30", "T30", "X Trail T30", "X-Trail 2002", "X-Trail 2006"]],
  ["X-Trail T31 (2007–2013)", ["X-Trail T31", "T31", "X Trail T31", "X-Trail 2008", "X-Trail 2012"]],
  ["X-Trail T32 (2014–2021)", ["X-Trail T32", "T32", "X Trail T32", "X-Trail 2015", "X-Trail 2020"]],
  ["X-Trail T33 (2022–současnost)", ["X-Trail T33", "T33", "X Trail T33", "X-Trail 2023", "X-Trail 2025"]],
  ["350Z Z33 (2002–2009)", ["350Z", "Z33", "Fairlady Z Z33"]],
  ["370Z Z34 (2009–2020)", ["370Z", "Z34", "370Z Nismo"]],
  ["Z RZ34 (2022–současnost)", ["Nissan Z", "Fairlady Z", "RZ34", "Z 2023", "Z 2024", "Z 2025"]],
  ["GT-R R35 (2007–současnost)", ["GT-R", "GTR", "R35", "GT R R35"]],
  ["Murano Z50 (2002–2008)", ["Murano Z50", "Z50", "Murano 2004"]],
  ["Murano Z51 (2008–2014)", ["Murano Z51", "Z51", "Murano 2010", "Murano 2013"]],
  ["Leaf ZE0 (2010–2017)", ["Leaf ZE0", "ZE0", "Leaf 2011", "Leaf 2016"]],
  ["Leaf ZE1 (2017–současnost)", ["Leaf ZE1", "ZE1", "Leaf 2018", "Leaf 2024"]],
  ["Ariya (2022–současnost)", ["Ariya", "Ariya 2023", "Ariya 2025"]],
  ["NV200 (2009–2021)", ["NV200", "Evalia", "NV200 Evalia"]],
  ["Navara D40 (2006–2015)", ["Navara D40", "D40", "Navara 2010"]],
  ["Navara D23 (2015–současnost)", ["Navara D23", "D23", "Navara 2016", "Navara 2024"]],
  ["Patrol Y62 (2010–současnost)", ["Patrol Y62", "Y62", "Patrol 2012", "Patrol 2024"]],
  ["Tiida C11 (2004–2012)", ["Tiida", "Tiida C11", "C11", "Tiida 2007"]],
  ["Pulsar C13 (2014–2018)", ["Pulsar C13", "C13", "Pulsar 2015", "Pulsar 2017"]],
]);

const FORUM_HINTS = new Map([
  ["almera-iii-n17-versa-latio", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "Mixed Almera / Versa / Latio forum stays excluded until badge and market coverage is expanded safely." }],
  ["almera-iv-n18", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "Almera IV N18 remains excluded until we expand the catalog with newer regional Almera generations from official sources." }],
  ["almera-n15", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["almera-n16", { forum_type: "model", resolved_model: "Almera N16 (2000–2006)", candidate_models: [] }],
  ["almera-tino", { forum_type: "model", resolved_model: "Almera Tino V10 (2000–2006)", candidate_models: [] }],
  ["primera-p10", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["primera-p11", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["primera-p12", { forum_type: "model", resolved_model: "Primera P12 (2001–2007)", candidate_models: [] }],
  ["x-trail-t30", { forum_type: "model", resolved_model: "X-Trail T30 (2001–2007)", candidate_models: [] }],
  ["x-trail-t31", { forum_type: "model", resolved_model: "X-Trail T31 (2007–2013)", candidate_models: [] }],
  ["x-trail-t32", { forum_type: "model", resolved_model: "X-Trail T32 (2014–2021)", candidate_models: [] }],
  ["x-trail-t33", { forum_type: "model", resolved_model: "X-Trail T33 (2022–současnost)", candidate_models: [] }],
  ["300zx", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["350z", { forum_type: "model", resolved_model: "350Z Z33 (2002–2009)", candidate_models: [] }],
  ["370z", { forum_type: "model", resolved_model: "370Z Z34 (2009–2020)", candidate_models: [] }],
  ["z", { forum_type: "model_family", resolved_model: null, candidate_models: ["370Z Z34 (2009–2020)", "Z RZ34 (2022–současnost)"], note: "Generic Z forum spans late 370Z and the current Z." }],
  ["qashqai-j10", { forum_type: "model", resolved_model: "Qashqai J10 (2007–2013)", candidate_models: [] }],
  ["qashqai-j11", { forum_type: "model", resolved_model: "Qashqai J11 (2014–2021)", candidate_models: [] }],
  ["qashqai-j12", { forum_type: "model", resolved_model: "Qashqai J12 (2021–současnost)", candidate_models: [] }],
  ["micra-k10", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["micra-k11", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["micra-k12", { forum_type: "model", resolved_model: "Micra K12 (2002–2010)", candidate_models: [] }],
  ["micra-k13", { forum_type: "model", resolved_model: "Micra K13 (2010–2017)", candidate_models: [] }],
  ["micra-k14", { forum_type: "model", resolved_model: "Micra K14 (2017–současnost)", candidate_models: [] }],
  ["navara-d21", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["navara-d22", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["navara-d40", { forum_type: "model", resolved_model: "Navara D40 (2006–2015)", candidate_models: [] }],
  ["navara-d23", { forum_type: "model", resolved_model: "Navara D23 (2015–současnost)", candidate_models: [] }],
  ["juke-i-f15", { forum_type: "model", resolved_model: "Juke F15 (2010–2019)", candidate_models: [] }],
  ["juke-ii-f16", { forum_type: "model", resolved_model: "Juke F16 (2019–současnost)", candidate_models: [] }],
  ["maxima-j30", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["maxima-a32", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["maxima-a33", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["maxima-a34", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["maxima-a35", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["maxima-a36", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["murano-z50", { forum_type: "model", resolved_model: "Murano Z50 (2002–2008)", candidate_models: [] }],
  ["murano-z51", { forum_type: "model", resolved_model: "Murano Z51 (2008–2014)", candidate_models: [] }],
  ["murano-z52", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "Murano Z52 remains excluded until the current-region powertrain coverage is expanded safely." }],
  ["s12", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["s13", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["s14", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["s15", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["patrol-y60", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["patrol-y61", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["patrol-y62", { forum_type: "model", resolved_model: "Patrol Y62 (2010–současnost)", candidate_models: [] }],
  ["pathfinder-wd21-terrano", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["pathfinder-r50", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["pathfinder-r51", { forum_type: "unknown", resolved_model: null, candidate_models: [], note: "Pathfinder generations stay excluded until R51/R52/R53 are fully covered in catalog from official Nissan sources." }],
  ["pathfinder-r52", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["pathfinder-r53", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["100nx", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["altima", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["ariya", { forum_type: "model", resolved_model: "Ariya (2022–současnost)", candidate_models: [] }],
  ["armada", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["bluebird", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["cube", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["gt-r", { forum_type: "model", resolved_model: "GT-R R35 (2007–současnost)", candidate_models: [] }],
  ["kicks", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["lannia", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["laurel", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["leaf", { forum_type: "model_family", resolved_model: null, candidate_models: ["Leaf ZE0 (2010–2017)", "Leaf ZE1 (2017–současnost)"], note: "Generic Leaf forum spans ZE0 and ZE1 generations." }],
  ["livina", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["note", { forum_type: "model_family", resolved_model: null, candidate_models: ["Note E11 (2006–2013)", "Note E12 (2013–2020)"], note: "Generic Note forum spans E11 and E12 generations." }],
  ["nv200-evalia", { forum_type: "model", resolved_model: "NV200 (2009–2021)", candidate_models: [] }],
  ["pulsar-c13", { forum_type: "model", resolved_model: "Pulsar C13 (2014–2018)", candidate_models: [] }],
  ["pulsar-nx", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["rogue", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["sentra", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["serena", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["skyline", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["sunny", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["teana", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["terrano", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["terrano-ii-r20", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["tiida", { forum_type: "model", resolved_model: "Tiida C11 (2004–2012)", candidate_models: [] }],
  ["titan", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["versa", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["wingroad", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["xterra", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["pokec-vseobecny", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["technicky-koutek", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["dopravni-prestupky", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["navody", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["tuning-a-upravy", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["ukradena-vozidla", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["klubove-zalezitosti", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["o-srazech-a-akcich", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["o-vozech-nasich-clenu", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["o-clancich", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["vtipy", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["kos", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
  ["novinky", { forum_type: "unknown", resolved_model: null, candidate_models: [] }],
]);

function restrictNissanCandidates({ models, rawText, normalizeForumMatchText }) {
  const normalized = normalizeForumMatchText(rawText);
  if (!normalized) return models;

  if (/\b(n15|p10|p11|k10|k11|d21|d22|j30|a32|a33|wd21|r50|y60|y61|300zx|100nx|pulsar nx|terrano ii|navody|tuning|pokec|sraz|vtipy|novinky)\b/i.test(normalized)) {
    return [];
  }

  const codeMatch = normalized.match(/\b(n16|v10|p12|k12|k13|k14|e11|e12|t30|t31|t32|t33|z33|z34|rz34|r35|z50|z51|ze0|ze1|d40|d23|f15|f16|c13|c11|y62)\b/i)?.[0] ?? "";
  if (codeMatch) {
    return models.filter((model) => {
      const aliases = MODEL_ALIAS_BY_LABEL.get(model.label) ?? [];
      const corpus = [model.label, ...aliases].map(normalizeForumMatchText).join(" | ");
      return corpus.includes(codeMatch);
    });
  }

  const families = [
    { pattern: /\balmera tino\b/i, keep: /almera tino|tino/ },
    { pattern: /\balmera\b/i, keep: /\balmera\b/ },
    { pattern: /\bprimera\b/i, keep: /\bprimera\b/ },
    { pattern: /\bmicra\b/i, keep: /\bmicra\b/ },
    { pattern: /\bnote\b/i, keep: /\bnote\b/ },
    { pattern: /\bjuke\b/i, keep: /\bjuke\b/ },
    { pattern: /\bqashqai\b/i, keep: /\bqashqai\b/ },
    { pattern: /\bx[- ]?trail\b/i, keep: /x-trail/ },
    { pattern: /\bleaf\b/i, keep: /\bleaf\b/ },
    { pattern: /\bariya\b/i, keep: /\bariya\b/ },
    { pattern: /\bnv200|evalia\b/i, keep: /nv200/ },
    { pattern: /\bnavara\b/i, keep: /\bnavara\b/ },
    { pattern: /\bmurano\b/i, keep: /\bmurano\b/ },
    { pattern: /\btiida\b/i, keep: /\btiida\b/ },
    { pattern: /\bpulsar\b/i, keep: /\bpulsar\b/ },
    { pattern: /\bpatrol\b/i, keep: /\bpatrol\b/ },
    { pattern: /\bgt[- ]?r|gtr\b/i, keep: /gt-r/ },
    { pattern: /\b350z|fairlady z z33\b/i, keep: /350z/ },
    { pattern: /\b370z\b/i, keep: /370z/ },
    { pattern: /\brz34|nissan z|fairlady z\b/i, keep: /z rz34/ },
  ];

  for (const family of families) {
    if (!family.pattern.test(normalized)) continue;
    return models.filter((model) => family.keep.test(normalizeForumMatchText(model.label)));
  }

  return models;
}

const api = buildClubCrawlerApi({
  brand: "Nissan",
  rootUrl: ROOT_URL,
  forum: "nissanclub_cz",
  minModelStartYear: 2000,
  rootHintNote: "Root Nissan forum discovery input. Only safely verified post-2000 Nissan model and generation forums are kept.",
  modelAliasByLabel: MODEL_ALIAS_BY_LABEL,
  forumHints: FORUM_HINTS,
  normalizeReplacements: [
    [/\bx\s*trail\b/gi, "x-trail"],
    [/\bgt\s*-\s*r\b/gi, "gtr"],
    [/\bgt\s+r\b/gi, "gtr"],
    [/\be\s*-\s*power\b/gi, "e-power"],
    [/\balmera[-\s]+tino\b/gi, "almera tino"],
  ],
  titleNoisePatterns: [
    /\bjak[yý]\s+olej\b/i,
    /\bolej\s+do\b/i,
    /\bp[řr]evodov[ýy]\s+olej\b/i,
    /\bautor[aá]dio\b/i,
    /\br[aá]dio\b/i,
    /\bk[óo]d\s+radia\b/i,
    /\bsecure\s+k[óo]d\b/i,
    /\bnavigac/i,
    /\brepro\b/i,
    /\bservisn[ií]\s+kni(?:ha|zka)\b/i,
    /\bservisn[ií]\s+interval\b/i,
    /\bn[aá]hradn[ií]\s+d[ií]l\b/i,
    /\bpopt[aá]vka\b/i,
    /\bjak[yý]\s+motor\b/i,
    /\bkoup[eě]\b/i,
    /\bdeaktivovat\s+imobil/i,
    /\bxdf\b/i,
    /\becu\b.*\b(soubor|subor|mapa|xdf)\b/i,
    /\bservisn[ýy]\s+ventil\b/i,
    /\b(adapt[eé]r|dr[žz][aá]k\s+na\s+mobil)\b/i,
    /\b(demont[aá][žz]|zapojen[ií]|dom[aá]c[ií]\s+v[ýy]m[eě]na|uprava\s+jednotky)\b/i,
    /\b(voln[eě]\s+p[řr][ií]stupn[eé]\s+servisn[ií]\s+j[aá]my|celoro[čc]n[ií]\s+pneu)\b/i,
    /\b(v[ýy]m[eě]na\s+[žz][aá]rovk|led\s+[žz]iarovk|led\s+žárovk)\b/i,
    /\bdisky?\b/i,
    /\bplastov[ée]\s+prahy\b/i,
    /^\s*(p[řr]evodovka|r[aá]dio|diagnostika|xenon|sv[ěe]tlomety|v[ýy]fuk|imobiliz[eé]r|st[ěe]ra[čc]e|spojka)\s*$/i,
  ],
  signalPatterns: [
    /\b(dig-t|e-power|vc-turbo|qg\d{2}|qr\d{2}|hr\d{2}|mr\d{2}|vq\d{2}|vr38dett|vr30ddtt|yd\d{2}|m9r|k9k)\b/i,
  ],
  restrictCandidates: restrictNissanCandidates,
});

export const parseArgs = api.parseArgs;
export const extractRelNextUrl = api.extractRelNextUrl;
export const discoverNissanRootCategoriesFromRoot = api.discoverRootCategoriesFromRoot;
export const classifyNissanTopicEntry = api.classifyTopicEntry;
export const extractNissanTopicEntriesFromForumPage = api.extractTopicEntriesFromForumPage;
export const inferNissanForumInventory = api.inferForumInventory;
export const resolveNissanVehicleModel = api.resolveVehicleModel;

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  api.main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
