#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

import { VEHICLE_CATALOG } from "../web/src/constants/catalog.js";
import { VEHICLE_CATALOG_US } from "../web/src/constants/catalog-us.js";

const HEADERS = [
  "nhtsa_id",
  "replacement_bulletin",
  "date_added",
  "tsb_id",
  "mfr_comm_date",
  "mfr_internal_campaign",
  "communication_type",
  "make",
  "model",
  "model_year",
  "nhtsa_components",
  "mfr_component_system",
  "mfr_component_subsystem",
  "summary",
];

const DEFAULT_USER_ID = "ai_importer";
const DEFAULT_LIMIT = Infinity;

const ACTION_PATTERNS = [
  /\breplac(?:e|ed|ement|ing)\b/i,
  /\bupdate(?:d)?\b/i,
  /\breprogram(?:med|ming)?\b/i,
  /\breflash(?:ed)?\b/i,
  /\binspect(?:ion|ed)?\b/i,
  /\bclean(?:ed|ing)?\b/i,
  /\btighten(?:ed|ing)?\b/i,
  /\badjust(?:ed|ment)?\b/i,
  /\brepair(?:ed)?\b/i,
  /\binstall(?:ed|ation)?\b/i,
  /\btorque(?:d)?\b/i,
  /\bcalibrat(?:e|ed|ion)\b/i,
  /\breseal(?:ed)?\b/i,
  /\bbleed(?: the)?\b/i,
];

const SYMPTOM_PATTERNS = [
  /\bnon-responsive\b/i,
  /\binoperative\b/i,
  /\bwarning light\b/i,
  /\bmalfunction\b/i,
  /\bconcern\b/i,
  /\bissue\b/i,
  /\bproblem\b/i,
  /\bno start\b/i,
  /\bwon['’]?t start\b/i,
  /\bstall(?:ing|ed)?\b/i,
  /\bhesitat(?:e|ion)\b/i,
  /\bjerk(?:ing)?\b/i,
  /\bmisfire\b/i,
  /\boverheat(?:ing)?\b/i,
  /\bleak(?:ing)?\b/i,
  /\bnoise\b/i,
  /\bvibration\b/i,
  /\bdrain\b/i,
  /\bdischarg(?:e|ing)\b/i,
  /\bnot respond\b/i,
  /\bdoes not respond\b/i,
  /\bnot charging\b/i,
  /\bwon['’]?t charge\b/i,
  /\bshut(?:s)? off\b/i,
  /\bfault\b/i,
  /\bdtc\b/i,
  /\bp[0-9a-f]{4}\b/i,
  /\bc[0-9a-f]{4}\b/i,
  /\bu[0-9a-f]{4}\b/i,
  /\bb[0-9a-f]{4}\b/i,
];

const READY_GRADE_SYMPTOM_PATTERNS = [
  /\bnon-responsive\b/i,
  /\binoperative\b/i,
  /\bwarning light\b/i,
  /\bmalfunction indicator lamp\b/i,
  /\bmil illumination\b/i,
  /\bwon['’]?t start\b/i,
  /\bno start\b/i,
  /\bstall(?:ing|ed)?\b/i,
  /\bhesitat(?:e|ion)\b/i,
  /\bjerk(?:ing)?\b/i,
  /\bmisfire\b/i,
  /\boverheat(?:ing)?\b/i,
  /\bleak(?:ing)?\b/i,
  /\bnoise\b/i,
  /\bvibration\b/i,
  /\bdrain\b/i,
  /\bdischarg(?:e|ing)\b/i,
  /\bnot charging\b/i,
  /\bwon['’]?t charge\b/i,
  /\bshut(?:s)? off\b/i,
  /\bvehicle enters? into limp home mode\b/i,
  /\bturtle icon\b/i,
  /\bwrench icon\b/i,
  /\bmay experience\b/i,
  /\bcustomers may also comment\b/i,
  /\bcustomers must experience\b/i,
  /\bdtc\b/i,
  /\bp[0-9a-f]{4}\b/i,
  /\bc[0-9a-f]{4}\b/i,
  /\bu[0-9a-f]{4}\b/i,
  /\bb[0-9a-f]{4}\b/i,
];

const DISCARD_PATTERNS = [
  /\bowner renotification\b/i,
  /\bowner notification\b/i,
  /\bowner letter\b/i,
  /\bcustomer satisfaction\b/i,
  /\bwarranty extension(?!.*(?:warning|fault|concern|issue|problem|repair|replace|reprogram|update))/i,
  /\bdealer message\b/i,
  /\bservice campaign\b/i,
  /\bparts return\b/i,
  /\bclaim submission\b/i,
  /\bshipping\b/i,
  /\bpolicy\b/i,
];

const GM_MAKES = new Set(["CHEVROLET", "GMC", "CADILLAC", "BUICK"]);
const GM_ADMIN_DISCARD_PATTERNS = [
  /\b(?:submit|send|upload)\b[\s\S]{0,120}\b(?:gds|snapshot|session logs?|diagnostic data|data log|log file|pictures?|photos?)\b[\s\S]{0,120}\b(?:tac|technical assistance center)\b/i,
  /\bprovide a pico file to receive diagnostic assistance from tac\b/i,
  /\bemail gds2 session logs into technical assistance\b/i,
  /\b(?:contact|call)\s+tac\b/i,
  /\buse the following labor code\b/i,
  /\blabor code\b[\s\S]{0,80}\b(?:warranty|claim|transaction)\b/i,
  /\bproper floor mat use\b/i,
  /\bfloor mat\b[\s\S]{0,80}\b(?:retention|usage|interference)\b/i,
  /\bunderbody component corrosion\b/i,
  /\bfluid testing procedures?\b/i,
  /\bhow to recover the image processing module\b/i,
  /\buse of j-35616-64b\b/i,
  /\bmultiple repair attempts\b[\s\S]{0,220}\btechnical assistance center\b/i,
  /\btire sidewall irregularities\b/i,
  /\bnormal transmission shift condition\b/i,
  /\bbefore being sold\b[\s\S]{0,80}\bfull inspection\b/i,
  /\bvehicle stock on hand\b[\s\S]{0,120}\bprepping\b/i,
  /\bdiagnose batteries that have set for a long period of time\b/i,
  /\bcold weather climates and testing those batteries\b/i,
  /\bwhen the engine is replaced after severe internal engine damage\b/i,
  /\bparts catalog assistance\b/i,
  /\btool usage\b/i,
  /\bdo not replace any parts at this time\b/i,
];

const GENERIC_RESOLUTION_PATTERNS = [
  /^follow the service procedure\b/i,
  /^follow the bulletin(?: repair)? procedure\b/i,
  /^refer to\b/i,
  /^see bulletin\b/i,
  /^perform service action\b/i,
  /^this (?:service|technical) bulletin provides repair information\b/i,
  /^this (?:service|technical) bulletin provides a repair procedure\b/i,
  /^this preliminary information communicates\b/i,
  /^this bulletin announces the availability of new reprogramming files\b/i,
];

const BULLETIN_PROSE_PREFIX_PATTERNS = [
  /^(?:some|certain|various|affected|these)\b/i,
  /^(?:the following|vehicles listed|for vehicles listed)\b/i,
];

const BULLETIN_PROSE_BODY_PATTERNS = [
  /\bequipped with\b/i,
  /\bbuilt on\b/i,
  /\bproduced from\b/i,
  /\bthrough\b/i,
  /\bmodel statement above\b/i,
  /\bthis bulletin provides\b/i,
  /\bthis service bulletin provides\b/i,
  /\b\d{4}(?:[-–]\d{4}|my)\b/i,
];

const MODEL_ALIAS_RULES = {
  KIA: [
    { pattern: /^OPTIMA$/i, values: ["K5", "Optima"] },
  ],
  CHEVROLET: [
    { pattern: /^(?:TAHOE|SUBURBAN(?: 1500)?)$/i, values: ["Tahoe/Suburban"] },
    { pattern: /^EXPRESS(?: CUTAWAY VAN| 2500| 3500)?$/i, values: ["Express"] },
    { pattern: /^SILVERADO EV$/i, values: ["Silverado EV"] },
  ],
  FORD: [
    { pattern: /^MUSTANG MACH E$/i, values: ["Mustang Mach-E"] },
    { pattern: /^E TRANSIT$/i, values: ["E-Transit", "Transit"] },
  ],
  GMC: [
    { pattern: /^YUKON(?: DENALI)?(?: XL(?: 1500| 2500)?)?(?: HYBRID)?$/i, values: ["Yukon/Yukon XL"] },
    { pattern: /^SAVANA(?: CUTAWAY VAN| 1500| 2500| 3500| 4500)?$/i, values: ["Savana"] },
    { pattern: /^SIERRA EV$/i, values: ["Sierra EV"] },
    { pattern: /^SIERRA DENALI$/i, values: ["Sierra 1500"] },
  ],
  HUMMER: [
    { pattern: /^H2$/i, values: ["H2"], minYear: 2003, maxYear: 2010 },
    { pattern: /^H2 SUT$/i, values: ["H2 SUT"], minYear: 2005, maxYear: 2009 },
    { pattern: /^H3$/i, values: ["H3"], minYear: 2006, maxYear: 2010 },
    { pattern: /^H3 SUT$/i, values: ["H3T / H3 SUT"], minYear: 2009, maxYear: 2010 },
  ],
  JEEP: [
    { pattern: /^WRANGLER$/i, values: ["Wrangler JL"] },
    { pattern: /^WRANGLER!?4XE$/i, values: ["Wrangler 4xe", "Wrangler JL"] },
    { pattern: /^GRAND CHEROKEE$/i, values: ["Grand Cherokee WL"] },
    { pattern: /^GRAND CHEROKEE 4XE$/i, values: ["Grand Cherokee 4xe", "Grand Cherokee WL"] },
    { pattern: /^GRAND CHEROKEE L$/i, values: ["Grand Cherokee L", "Grand Cherokee WL"] },
    { pattern: /^WAGONEER$/i, values: ["Wagoneer"] },
    { pattern: /^RECON$/i, values: ["Recon"] },
  ],
  "MERCEDES BENZ": [
    { pattern: /^(?:A ?\d+|AMG A ?\d+)/i, values: ["A-Class"] },
    { pattern: /^(?:B ?\d+|AMG B ?\d+)/i, values: ["B-Class"] },
    { pattern: /^(?:C ?\d+|AMG C ?\d+)/i, values: ["C-Class"] },
    { pattern: /^(?:CLA ?\d+|AMG CLA ?\d+)/i, values: ["CLA"] },
    { pattern: /^(?:CLS ?\d+|AMG CLS ?\d+)/i, values: ["CLS C257", "CLS C218 / X218"] },
    { pattern: /^(?:E ?\d+|AMG E ?\d+)/i, values: ["E-Class"] },
    { pattern: /^(?:S ?\d+|AMG S ?\d+)/i, values: ["S-Class"] },
    { pattern: /^(?:GLA ?\d+|AMG GLA ?\d+)/i, values: ["GLA"] },
    { pattern: /^(?:GLB ?\d+|AMG GLB ?\d+)/i, values: ["GLB"] },
    { pattern: /^(?:GLC ?\d+|AMG GLC ?\d+)/i, values: ["GLC"] },
    { pattern: /^(?:GLE ?\d+|AMG GLE ?\d+)/i, values: ["GLE"] },
    { pattern: /^(?:GLS ?\d+|AMG GLS ?\d+)/i, values: ["GLS"] },
    { pattern: /^(?:G ?550|G ?580(?: WITH EQ TECHNOLOGY)?|G ?63|AMG G ?(?:55|63|65))$/i, values: ["G-Class W463A", "G-Class W463"] },
    { pattern: /^(?:ML ?\d+|AMG ML ?\d+)/i, values: ["ML-Class W166", "ML-Class W164"] },
    { pattern: /^(?:GL ?\d+)$/i, values: ["GL / GLS X166", "GL-Class X164"] },
    { pattern: /^GLK ?\d+$/i, values: ["GLK X204"] },
    { pattern: /^R ?\d+$/i, values: ["R-Class W251"] },
    { pattern: /^CL ?(?:550|600|63|65)$/i, values: ["CL C216"] },
    { pattern: /^(?:CLE ?(?:300|450)|AMG CLE ?53)$/i, values: ["CLE C/A236"] },
    { pattern: /^SPRINTER ?\(VS30\)$/i, values: ["Sprinter VS30"] },
    { pattern: /^SPRINTER ?(?:1500|2500|3500|4500)$/i, values: ["Sprinter VS30"], minYear: 2019 },
    { pattern: /^ESPRINTER$/i, values: ["eSprinter Electric"] },
    { pattern: /^(?:AMG GT ?(?:43|53|53E|55|63|63S|63 S|63 S E|63 S E COUPE)|AMG GT 63 S E COUPE)$/i, values: ["AMG GT X290"] },
    { pattern: /^(?:AMG GT(?: ?[CSR])?|AMG GTS|AMG GTR|AMG GTC)$/i, values: ["AMG GT C190 / R190"] },
    { pattern: /^(?:SL ?(?:450|550|63|65)|AMG SL ?(?:43|55|63(?: S E)?|65))$/i, values: ["SL R232", "SL R231", "SL R230"] },
    { pattern: /^SL400$/i, values: ["SL R231"] },
    { pattern: /^SLK ?\d+$/i, values: ["SLK R172", "SLK R171"] },
    { pattern: /^(?:SLC ?300|AMG SLC ?43)$/i, values: ["SLC R172"] },
    { pattern: /^METRIS$/i, values: ["Vito W447"] },
    { pattern: /^EQA\b/i, values: ["EQA H243"] },
    { pattern: /^(?:EQB|AMG EQB)\b/i, values: ["EQB X243"] },
    { pattern: /^EQC\b/i, values: ["EQC N293"] },
    { pattern: /^(?:EQE|AMG EQE)\b/i, values: ["EQE V295"] },
    { pattern: /(?:^| )EQS\b|redundant EQS 450/i, values: ["EQS V297"] },
  ],
  "MERCEDES MAYBACH": [
    { pattern: /^GLS ?600(?: 4MATIC)?$/i, values: ["GLS"] },
    { pattern: /^S ?(?:550|560|580|600|650|680)(?: 4MATIC)?$/i, values: ["S-Class"] },
    { pattern: /^EQS SUV ?680(?: 4MATIC)?$/i, values: ["EQS SUV X296"] },
  ],
  MERCEDES: [
    { pattern: /^EQA\b/i, values: ["EQA H243"] },
  ],
  MAYBACH: [
    { pattern: /^MAYBACH$/i, values: ["57 / 62"], minYear: 2002, maxYear: 2012 },
  ],
  PONTIAC: [
    { pattern: /^VIBE$/i, values: ["Vibe"] },
    { pattern: /^G6$/i, values: ["G6"] },
    { pattern: /^G5$/i, values: ["G5"] },
    { pattern: /^G8$/i, values: ["G8"] },
    { pattern: /^GTO$/i, values: ["GTO"] },
    { pattern: /^G3$/i, values: ["G3"] },
    { pattern: /^SOLSTICE$/i, values: ["Solstice"] },
    { pattern: /^TORRENT$/i, values: ["Torrent"] },
  ],
  SATURN: [
    { pattern: /^ION$/i, values: ["Ion"] },
    { pattern: /^AURA$/i, values: ["Aura"] },
    { pattern: /^AURA HYBRID$/i, values: ["Aura Hybrid"] },
    { pattern: /^ASTRA$/i, values: ["Astra"] },
    { pattern: /^VUE$/i, values: ["Vue"] },
    { pattern: /^VUE HYBRID$/i, values: ["Vue Hybrid"] },
    { pattern: /^OUTLOOK$/i, values: ["Outlook"] },
    { pattern: /^RELAY$/i, values: ["Relay"] },
    { pattern: /^SKY$/i, values: ["Sky"] },
  ],
  SAAB: [
    { pattern: /^9-2X$/i, values: ["9-2X"] },
    { pattern: /^9-4X$/i, values: ["9-4X"] },
    { pattern: /^9-7X$/i, values: ["9-7X"] },
  ],
  SCION: [
    { pattern: /^IA$/i, values: ["iA / Yaris iA"], minYear: 2016, maxYear: 2018 },
    { pattern: /^IM$/i, values: ["iM / Corolla iM"], minYear: 2016, maxYear: 2018 },
  ],
  SMART: [
    { pattern: /^FORTWO(?: COUPE| CONVERTIBLE)?$/i, values: ["fortwo 451"], minYear: 2008, maxYear: 2015 },
    { pattern: /^FORTWO(?: COUPE| CONVERTIBLE| CABRIOLET)?$/i, values: ["fortwo 453"], minYear: 2016, maxYear: 2019 },
    { pattern: /^FORTWO COUPE ELECTRIC$/i, values: ["fortwo Electric Drive"], minYear: 2013, maxYear: 2015 },
    { pattern: /^FORTWO CONVERTIBLE ELECTR$/i, values: ["fortwo Electric Drive"], minYear: 2013, maxYear: 2015 },
  ],
  VOLVO: [
    { pattern: /^XC60PHEV$/i, values: ["XC60"] },
    { pattern: /^XC60MHEV$/i, values: ["XC60"] },
    { pattern: /^XC90PHEV$/i, values: ["XC90"] },
    { pattern: /^XC90MHEV$/i, values: ["XC90"] },
    { pattern: /^XC90E$/i, values: ["XC90"] },
    { pattern: /^S60PHEV$/i, values: ["S60"] },
    { pattern: /^S60MHEV$/i, values: ["S60"] },
    { pattern: /^S90PHEV$/i, values: ["S90"] },
    { pattern: /^S90MHEV$/i, values: ["S90"] },
    { pattern: /^V60PHEV$/i, values: ["V60"] },
    { pattern: /^V60MHEV$/i, values: ["V60"] },
    { pattern: /^V60CCMHEV$/i, values: ["V60 Cross Country"] },
    { pattern: /^V90CCMHEV$/i, values: ["V90 Cross Country"] },
    { pattern: /^XC40MHEV$/i, values: ["XC40"] },
    { pattern: /^XC40BEV$/i, values: ["EX40", "XC40 Recharge / EX40"] },
    { pattern: /^C40BEV$/i, values: ["EC40", "C40 Recharge / EC40"] },
    { pattern: /^DUPLICATE C40BEV$/i, values: ["EC40", "C40 Recharge / EC40"] },
    { pattern: /^EX40$/i, values: ["EX40", "XC40 Recharge / EX40"] },
    { pattern: /^EC40$/i, values: ["EC40", "C40 Recharge / EC40"] },
  ],
};

const JEEP_WAGONEER_S_HINT_PATTERNS = [
  /\bwagoneer s\b/i,
  /\b(?:level[- ]1|level[- ]2|dc fast charge|high voltage charging station)\b/i,
  /\b(?:idcm|bpcm|mcp a|mcp b|evcu|wheel end disconnect)\b/i,
  /\bdrive ready mode\b/i,
  /\b12 ?volt battery lamp\b/i,
  /\bcharge module\b/i,
];

const VOLVO_COMMERCIAL_MODEL_PATTERNS = [
  /^VN$/i,
  /^VNL(?: \(\d+\))?$/i,
  /^VNR(?: \(\d+\))?$/i,
  /^VNRE(?: \(ELECTRIC\))?$/i,
  /^VHD$/i,
  /^VAH$/i,
  /^VT$/i,
];

const ISUZU_COMMERCIAL_MODEL_PATTERNS = [
  /^N-SERIES$/i,
  /^F-SERIES$/i,
  /^F SERIES$/i,
  /^H SERIES$/i,
  /^T SERIES$/i,
];

const MODEL_TRIM_TOKENS = new Set([
  "BASE", "SPORT", "LIMITED", "LUXURY", "PLATINUM", "PREMIUM", "SIGNATURE", "RESERVE",
  "TOURING", "GT", "GT2", "GT3", "GT4", "GTS", "GTX", "RS", "R", "S", "SRT", "N",
  "EX", "EXL", "EX-L", "LX", "LXS", "SX", "SX-P", "SXP", "XLINE", "X-LINE", "XPRO", "X-PRO",
  "SEL", "SE", "XSE", "XLE", "LARIAT", "KING", "RAPTOR", "RLINE", "R-LINE", "DENALI",
  "PRESTIGE", "ULTIMATE", "CALIGRAPHY", "TROFEO", "MODENA", "TRIDENTE", "SQUADRA", "Q4",
  "COMPETIZIONE", "QUADRIFOGLIO", "EDITION", "ANNIVERSARY", "HERITAGE",
  "AWD", "FWD", "RWD", "4WD", "4X4",
]);

function usage(exitCode = 1) {
  console.log(`
Usage:
  node scripts/tsb-seed-nhtsa.mjs <input_tsv> <out_dir> [options]

Examples:
  node scripts/tsb-seed-nhtsa.mjs C:\\path\\MfrComms.txt out_nhtsa
  node scripts/tsb-seed-nhtsa.mjs C:\\path\\MfrComms.txt out_nhtsa --make KIA --limit 10000

Options:
  --make <make>       Filter by exact Make value from the file (case-insensitive)
  --model <model>     Filter by exact Model value from the file (case-insensitive)
  --limit <n>         Read at most N raw rows from the TSV
  --user-id <id>      Stored in generated seed files. Default: ${DEFAULT_USER_ID}
  --help              Show help
`.trim());
  process.exit(exitCode);
}

export function parseArgs(argv) {
  const args = {
    inputPath: "",
    outDir: "",
    make: "",
    model: "",
    limit: DEFAULT_LIMIT,
    userId: DEFAULT_USER_ID,
  };

  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--help" || token === "-h") usage(0);
    if (token === "--make") {
      args.make = (argv[++i] ?? "").trim();
      continue;
    }
    if (token === "--model") {
      args.model = (argv[++i] ?? "").trim();
      continue;
    }
    if (token === "--limit") {
      const limit = Number(argv[++i] ?? "");
      args.limit = Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : DEFAULT_LIMIT;
      continue;
    }
    if (token === "--user-id") {
      args.userId = (argv[++i] ?? "").trim() || DEFAULT_USER_ID;
      continue;
    }
    if (token.startsWith("--")) usage(1);
    positional.push(token);
  }

  if (positional.length !== 2) usage(1);
  args.inputPath = path.resolve(positional[0]);
  args.outDir = path.resolve(positional[1]);
  return args;
}

function cleanText(value) {
  return (value ?? "")
    .toString()
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ")
    .replace(/â€™/g, "'")
    .trim();
}

export function parseTsbLine(line) {
  if (!line || !line.trim()) return null;
  const cols = line.split("\t");
  if (cols.length < HEADERS.length) return null;
  const fixed = cols.slice(0, HEADERS.length - 1);
  fixed.push(cols.slice(HEADERS.length - 1).join("\t"));
  return Object.fromEntries(HEADERS.map((header, index) => [header, cleanText(fixed[index] ?? "")]));
}

function csvList(value) {
  return [...new Set(
    cleanText(value)
      .split(",")
      .map(item => item.trim())
      .filter(Boolean),
  )];
}

function normalizeCommunicationType(value) {
  return cleanText(value).toLowerCase().replace(/\s*\/\s*/g, "/");
}

function isServiceBulletin(record) {
  return normalizeCommunicationType(record.communication_type) === "service bulletin/repair instructions";
}

function isWarrantyExtension(record) {
  return normalizeCommunicationType(record.communication_type) === "warranty program/extension";
}

function shouldKeepByFilter(record, args) {
  if (args.make && record.make.toLowerCase() !== args.make.toLowerCase()) return false;
  if (args.model && record.model.toLowerCase() !== args.model.toLowerCase()) return false;
  if (isExcludedCommercialModel(record)) return false;
  if (!hasSupportedCatalogBrand(record.make)) return false;
  return true;
}

export function isExcludedCommercialModel(record) {
  const make = normalizeComparableText(record?.make);
  const model = cleanText(record?.model);
  if (make === "VOLVO") {
    return VOLVO_COMMERCIAL_MODEL_PATTERNS.some((pattern) => pattern.test(model));
  }
  if (make === "ISUZU") {
    return ISUZU_COMMERCIAL_MODEL_PATTERNS.some((pattern) => pattern.test(model));
  }
  return false;
}

function makeGroupKey(record) {
  return [
    record.nhtsa_id,
    record.tsb_id,
    record.make,
    record.model,
    record.model_year,
    cleanText(record.summary),
  ].join("||");
}

export function makePatternKey(record) {
  return [
    record.nhtsa_id,
    record.tsb_id,
    record.communication_type,
    record.make,
    cleanText(record.summary),
  ].join("||");
}

export function mergeTsbRecords(existing, record) {
  if (!existing) {
    return {
      ...record,
      nhtsa_components: csvList(record.nhtsa_components),
      mfr_component_system: csvList(record.mfr_component_system),
      mfr_component_subsystem: csvList(record.mfr_component_subsystem),
    };
  }

  return {
    ...existing,
    nhtsa_components: [...new Set([...existing.nhtsa_components, ...csvList(record.nhtsa_components)])],
    mfr_component_system: [...new Set([...existing.mfr_component_system, ...csvList(record.mfr_component_system)])],
    mfr_component_subsystem: [...new Set([...existing.mfr_component_subsystem, ...csvList(record.mfr_component_subsystem)])],
  };
}

function smartTitleWord(word) {
  const raw = word.trim();
  if (!raw) return raw;
  if (/[0-9]/.test(raw)) return raw;
  if (/^(?:EV|HEV|PHEV|AWD|FWD|4WD|2WD|SUV|ABS|SRS|DCT|CVT|GT|GT-R|GTI|RS|SE|SEL|N|X|Z)$/i.test(raw)) {
    return raw.toUpperCase();
  }
  if (/^[A-Z]{1,3}$/.test(raw)) return raw;
  if (/^[A-Z][a-z0-9]+$/.test(raw)) return raw;
  const lower = raw.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function formatMake(value) {
  const preservedMakes = new Set(["BMW", "GMC", "RAM", "MG", "BYD", "DS"]);
  return cleanText(value)
    .split(/\s+/)
    .map(word => {
      const raw = word.trim();
      if (preservedMakes.has(raw.toUpperCase())) return raw.toUpperCase();
      return raw
        .split("-")
        .map(part => {
          const lower = part.toLowerCase();
          return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join("-");
    })
    .join(" ");
}

function formatModel(value) {
  return cleanText(value)
    .split(/\s+/)
    .map(smartTitleWord)
    .join(" ");
}

function formatVehicleModel(model, modelYear) {
  const formattedModel = formatModel(model);
  return modelYear && modelYear !== "9999" ? `${formattedModel} (${modelYear})` : formattedModel;
}

function normalizeComparableText(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(US\)/gi, " ")
    .replace(/[()!]/g, " ")
    .replace(/[/,_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function stripMarketSuffix(text) {
  return cleanText(text).replace(/\s*\(US\)\s*/gi, " ").replace(/\s+/g, " ").trim();
}

function extractLabelBase(label) {
  return cleanText(label)
    .replace(/\s*\((?:19|20)\d{2}\s*[–-]\s*(?:\d{4}|present|current|dosud|současnost|soucasnost)\)\s*$/i, "")
    .trim();
}

function parseLabelYearRange(label) {
  const match = cleanText(label).match(/\((\d{4})\s*[–-]\s*(\d{4}|present|current|dosud|současnost|soucasnost)\)/i);
  if (!match) return null;
  const start = Number(match[1]);
  const end = /^\d{4}$/.test(match[2]) ? Number(match[2]) : 9999;
  return { start, end };
}

function buildCatalogModelIndex() {
  const index = new Map();
  for (const [market, catalog] of [["EU", VEHICLE_CATALOG], ["US", VEHICLE_CATALOG_US]]) {
    for (const brandEntry of catalog) {
      let currentGroup = "";
      const models = [];
      for (const model of brandEntry.models ?? []) {
        if (model.group) currentGroup = model.group;
        if (!model.label) continue;
        models.push({
          label: model.label,
          group: currentGroup || extractLabelBase(model.label),
          group_key: normalizeComparableText(stripMarketSuffix(currentGroup || extractLabelBase(model.label))),
          label_key: normalizeComparableText(stripMarketSuffix(extractLabelBase(model.label))),
          group_tokens: tokenizeModelKey(currentGroup || extractLabelBase(model.label)),
          label_tokens: tokenizeModelKey(extractLabelBase(model.label)),
          year_range: parseLabelYearRange(model.label),
        });
      }
      index.set(brandEntry.brand, {
        brand: brandEntry.brand,
        market,
        models,
      });
    }
  }
  return index;
}

const CATALOG_MODEL_INDEX = buildCatalogModelIndex();
const ALL_CATALOG_BRANDS = [...VEHICLE_CATALOG, ...VEHICLE_CATALOG_US];
const CATALOG_BRAND_ALIASES = new Map([
  ["HUMMER", ["Hummer"]],
  ["MAYBACH", ["Maybach"]],
  ["MERCEDES", ["Mercedes-Benz"]],
  ["MERCEDES MAYBACH", ["Mercedes-Benz"]],
  ["SCION", ["Scion"]],
  ["SMART", ["Smart"]],
]);

function buildCatalogBrandIndex() {
  const index = new Map();
  for (const entry of ALL_CATALOG_BRANDS) {
    const keys = new Set([
      normalizeComparableText(entry.brand),
      normalizeComparableText(stripMarketSuffix(entry.brand)),
    ]);
    for (const key of keys) {
      if (!key) continue;
      const bucket = index.get(key) ?? [];
      bucket.push(entry.brand);
      index.set(key, bucket);
    }
  }
  return index;
}

const CATALOG_BRAND_INDEX = buildCatalogBrandIndex();

function sortBrandCandidates(candidates) {
  return [...new Set(candidates)].sort((a, b) => {
    const aUs = /\(US\)/i.test(a) ? 0 : 1;
    const bUs = /\(US\)/i.test(b) ? 0 : 1;
    if (aUs !== bUs) return aUs - bUs;
    return a.localeCompare(b, "en", { sensitivity: "base" });
  });
}

function getCandidateBrandNames(make) {
  const normalized = normalizeComparableText(make);
  const direct = CATALOG_BRAND_INDEX.get(normalized) ?? [];
  if (direct.length > 0) return sortBrandCandidates(direct);

  const alias = CATALOG_BRAND_ALIASES.get(normalized) ?? [];
  if (alias.length > 0) return sortBrandCandidates(alias);

  const formatted = formatMake(make);
  const fallback = [];
  const preferredUs = `${stripMarketSuffix(formatted)} (US)`;
  if (CATALOG_MODEL_INDEX.has(preferredUs)) fallback.push(preferredUs);
  if (CATALOG_MODEL_INDEX.has(formatted)) fallback.push(formatted);
  return sortBrandCandidates(fallback);
}

export function hasSupportedCatalogBrand(make) {
  return getCandidateBrandNames(make).length > 0;
}

function buildModelKeyCandidates(make, model, modelYear) {
  const normalizedMake = normalizeComparableText(make);
  const raw = normalizeComparableText(model);
  const year = Number(modelYear);
  const candidates = new Set();
  if (raw) candidates.add(raw);
  const deTrimmed = tokenizeModelKey(raw).join(" ");
  if (deTrimmed && deTrimmed !== raw) candidates.add(deTrimmed);

  const stripped = raw
    .replace(/\bPLUG IN HYBRID\b/g, " ")
    .replace(/\bPLUGIN HYBRID\b/g, " ")
    .replace(/\bHYBRID\b/g, " ")
    .replace(/\bPHEV\b/g, " ")
    .replace(/\bHEV\b/g, " ")
    .replace(/\bELECTRIC\b/g, " ")
    .replace(/\bEV\b$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped && stripped !== raw) candidates.add(stripped);
  const strippedDeTrimmed = tokenizeModelKey(stripped).join(" ");
  if (strippedDeTrimmed && strippedDeTrimmed !== stripped) candidates.add(strippedDeTrimmed);

  for (const rule of MODEL_ALIAS_RULES[normalizedMake] ?? []) {
    if (!rule.pattern.test(raw)) continue;
    if (Number.isFinite(rule.minYear) && (!Number.isFinite(year) || year < rule.minYear)) continue;
    if (Number.isFinite(rule.maxYear) && (!Number.isFinite(year) || year > rule.maxYear)) continue;
    for (const value of rule.values) {
      candidates.add(normalizeComparableText(value));
    }
  }

  return [...candidates];
}

function prefersJeepWagoneerS(record) {
  if (normalizeComparableText(record?.make) !== "JEEP") return false;
  if (normalizeComparableText(record?.model) !== "WAGONEER") return false;
  const summary = String(record?.summary ?? "");
  return JEEP_WAGONEER_S_HINT_PATTERNS.some(pattern => pattern.test(summary));
}

function getForcedJeepCatalogMatch(record) {
  if (normalizeComparableText(record?.make) !== "JEEP") return null;
  const model = normalizeComparableText(record?.model);
  if (model === "WRANGLER") {
    return { brand: "Jeep", market: "US", label: "Wrangler JL (2018–)", group: "Wrangler" };
  }
  if (model === "GRAND CHEROKEE") {
    return { brand: "Jeep", market: "US", label: "Grand Cherokee WL (2021–)", group: "Grand Cherokee" };
  }
  return null;
}

function tokenizeModelKey(value) {
  return normalizeComparableText(value)
    .split(" ")
    .map(token => token.trim())
    .filter(Boolean)
    .filter(token => !MODEL_TRIM_TOKENS.has(token));
}

function isTokenSubset(subset, superset) {
  return subset.every(token => superset.includes(token));
}

function isYearInRange(year, range) {
  if (!range || !Number.isFinite(year) || year <= 0) return true;
  return year >= range.start && year <= range.end;
}

function compareScores(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left === right) continue;
    return left - right;
  }
  return 0;
}

export function resolveCatalogVehicle(record) {
  const forcedJeep = getForcedJeepCatalogMatch(record);
  if (forcedJeep) {
    return {
      resolved: true,
      market: forcedJeep.market,
      vehicle_brand: forcedJeep.brand,
      vehicle_model: forcedJeep.label,
      raw_brand: formatMake(record.make),
      raw_model: formatVehicleModel(record.model, record.model_year),
      matched_group: forcedJeep.group,
      candidate_brands: getCandidateBrandNames(record.make),
      candidate_model_keys: buildModelKeyCandidates(record.make, record.model, record.model_year),
    };
  }

  const year = Number(record.model_year);
  const brandCandidates = getCandidateBrandNames(record.make);
  const modelCandidates = buildModelKeyCandidates(record.make, record.model, record.model_year);
  if (prefersJeepWagoneerS(record)) {
    modelCandidates.unshift(normalizeComparableText("Wagoneer S"));
  }
  const modelTokenCandidates = modelCandidates.map(candidate => tokenizeModelKey(candidate));
  const rawBrand = formatMake(record.make);
  const rawModel = formatVehicleModel(record.model, record.model_year);
  let best = null;

  for (let brandPriority = 0; brandPriority < brandCandidates.length; brandPriority++) {
    const brandName = brandCandidates[brandPriority];
    const brandEntry = CATALOG_MODEL_INDEX.get(brandName);
    if (!brandEntry) continue;

    for (let modelPriority = 0; modelPriority < modelCandidates.length; modelPriority++) {
      const candidate = modelCandidates[modelPriority];
      const candidateTokens = modelTokenCandidates[modelPriority];
      for (const modelEntry of brandEntry.models) {
        const exactGroupMatch = modelEntry.group_key === candidate;
        const exactLabelMatch = modelEntry.label_key === candidate;
        const fuzzyGroupMatch =
          !exactGroupMatch &&
          candidateTokens.length >= 2 &&
          isTokenSubset(candidateTokens, modelEntry.group_tokens);
        const fuzzyLabelMatch =
          !exactLabelMatch &&
          candidateTokens.length >= 2 &&
          isTokenSubset(candidateTokens, modelEntry.label_tokens);
        if (!exactGroupMatch && !exactLabelMatch && !fuzzyGroupMatch && !fuzzyLabelMatch) continue;
        if (!isYearInRange(year, modelEntry.year_range)) continue;

        const rangeSpan = modelEntry.year_range ? modelEntry.year_range.end - modelEntry.year_range.start : 9999;
        const score = [
          brandPriority,
          exactLabelMatch ? 0 : exactGroupMatch ? 1 : fuzzyLabelMatch ? 2 : 3,
          modelPriority,
          rangeSpan,
          modelEntry.label.length,
        ];

        if (!best || compareScores(score, best.score) < 0) {
          best = {
            score,
            market: brandEntry.market,
            brand: brandEntry.brand,
            label: modelEntry.label,
            group: modelEntry.group,
          };
        }
      }
    }
  }

  if (!best) {
    return {
      resolved: false,
      market: null,
      vehicle_brand: rawBrand,
      vehicle_model: rawModel,
      raw_brand: rawBrand,
      raw_model: rawModel,
      candidate_brands: brandCandidates,
      candidate_model_keys: modelCandidates,
    };
  }

  return {
    resolved: true,
    market: best.market,
    vehicle_brand: best.brand,
    vehicle_model: best.label,
    raw_brand: rawBrand,
    raw_model: rawModel,
    matched_group: best.group,
    candidate_brands: brandCandidates,
    candidate_model_keys: modelCandidates,
  };
}

function parseYmdToIso(value) {
  const raw = cleanText(value);
  if (!/^\d{8}$/.test(raw)) return new Date().toISOString();
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
}

function extractBulletinYear(record) {
  for (const candidate of [record.date_added, record.mfr_comm_date]) {
    const raw = cleanText(candidate);
    if (/^\d{8}$/.test(raw)) return raw.slice(0, 4);
  }
  return null;
}

export function buildNhtsaSourceRef(record) {
  const tsbId = cleanText(record.tsb_id);
  const nhtsaId = cleanText(record.nhtsa_id);
  if (tsbId && nhtsaId) return `${tsbId} / NHTSA ${nhtsaId}`;
  if (tsbId) return tsbId;
  if (nhtsaId) return `NHTSA ${nhtsaId}`;
  return null;
}

export function buildNhtsaBulletinUrl(record) {
  const year = extractBulletinYear(record);
  const nhtsaId = cleanText(record.nhtsa_id);
  if (!year || !nhtsaId) return null;
  return `https://static.nhtsa.gov/odi/tsbs/${year}/MC-${nhtsaId}-0001.pdf`;
}

function extractRevisionRankFromSourceRef(sourceRef) {
  const text = cleanText(sourceRef).toUpperCase();
  const revLetter = text.match(/\bREV\.?\s*([A-Z])\b/);
  if (revLetter) return revLetter[1].charCodeAt(0) - 64;
  const revNumber = text.match(/(?:^|[_\s-])R(\d{1,2})(?:$|[_\s-])/);
  if (revNumber) return Number(revNumber[1]);
  return 0;
}

function sentenceSplit(text) {
  return cleanText(text)
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

function stripLeadPrefixes(value) {
  let text = cleanText(value);
  const prefixes = [
    /^technical service bulletin:\s*/i,
    /^service action:\s*/i,
    /^dealer message:\s*/i,
    /^warranty extension:\s*/i,
    /^product improvement campaign:\s*/i,
    /^customer satisfaction campaign:\s*/i,
  ];
  for (const pattern of prefixes) {
    text = text.replace(pattern, "");
  }
  return text.trim();
}

function splitTitleAndBody(summary) {
  const normalized = cleanText(summary);
  const dashIndex = normalized.indexOf(" - ");
  if (dashIndex === -1) {
    return {
      title: stripLeadPrefixes(normalized),
      body: normalized,
    };
  }
  return {
    title: stripLeadPrefixes(normalized.slice(0, dashIndex)),
    body: cleanText(normalized.slice(dashIndex + 3)),
  };
}

function extractObdCodes(text) {
  return [...new Set((cleanText(text).match(/\b[PBCU][0-9A-F]{4}\b/gi) ?? []).map(code => code.toUpperCase()))];
}

function hasRepairLanguage(text) {
  return ACTION_PATTERNS.some(pattern => pattern.test(text));
}

function hasSymptomLanguage(text) {
  return SYMPTOM_PATTERNS.some(pattern => pattern.test(text));
}

function hasReadyGradeSymptomLanguage(text) {
  return READY_GRADE_SYMPTOM_PATTERNS.some(pattern => pattern.test(text));
}

function isActionLikeText(text) {
  return /^(?:update|upgrade|replace|reprogram|repair|inspect|clean|tighten|adjust|install|flash)\b/i.test(cleanText(text));
}

function isDiscardLike(text) {
  return DISCARD_PATTERNS.some(pattern => pattern.test(text));
}

function isGmAdminDiscard(record, text) {
  return GM_MAKES.has(cleanText(record?.make).toUpperCase()) &&
    GM_ADMIN_DISCARD_PATTERNS.some(pattern => pattern.test(text));
}

function looksLikeBulletinProse(text) {
  const normalized = cleanText(text);
  if (!normalized) return false;
  if (normalized.length >= 135 && BULLETIN_PROSE_PREFIX_PATTERNS.some(pattern => pattern.test(normalized))) return true;
  if (normalized.length >= 160 && BULLETIN_PROSE_BODY_PATTERNS.some(pattern => pattern.test(normalized))) return true;
  return false;
}

function bestSentence(sentences, predicate) {
  return sentences.find(predicate) ?? "";
}

function stripLeadNoise(text) {
  return cleanText(text)
    .replace(/^customers may experience the following:\s*/i, "")
    .replace(/^the following:\s*[•●\-]?\s*/i, "")
    .trim();
}

function sentenceCase(text) {
  const normalized = stripLeadNoise(cleanText(text).replace(/^['"“”‘’]+|['"“”‘’]+$/g, ""));
  if (!normalized) return normalized;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function cleanConcernText(text) {
  return stripLeadNoise(cleanText(text))
    .replace(/\b(?:concerns?|issues?|conditions?)\b/gi, "")
    .replace(/[‘’]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+\.$/, ".");
}

function formatCodeList(codes) {
  const unique = [...new Set((codes ?? []).map(code => cleanText(code).toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return "";
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")}, and ${unique[unique.length - 1]}`;
}

function formatDtcPhrase(codes) {
  const list = formatCodeList(codes);
  if (!list) return "";
  return codes.length === 1 ? `DTC ${list}` : `DTCs ${list}`;
}

function makeConciseDescription(title, body, sentences) {
  const extractedCodes = extractObdCodes(body);
  const failurePart = cleanText(
    body.match(/\baddresses failures of (?:the )?(.+?)(?:,| as well as| on\b| in\b|\.)/i)?.[1] ?? "",
  );
  const relatedConcern = cleanConcernText(
    body.match(/\bconcerns? related to (?:the )?(.+?)(?:\.|,)/i)?.[1] ??
    body.match(/\brelated to (?:the )?(.+?)(?:\.|,)/i)?.[1] ??
    "",
  );
  if (failurePart) {
    const desc = `${sentenceCase(failurePart)} failure${relatedConcern ? ` causing ${relatedConcern}` : ""}.`;
    return desc.replace(/\.\./g, ".");
  }

  const remedyConcern = cleanConcernText(
    body.match(/\bto remedy (?:an? )?[‘'"]?(.+?)[’'"]? (?:concern|issue|condition)\b/i)?.[1] ?? "",
  );
  if (remedyConcern) return `${sentenceCase(remedyConcern)}.`;

  const mayExperience = cleanConcernText(
    body.match(/\bmay experience ([^.]+?)(?: concerns?| issues?| conditions?)?(?:\.|,)/i)?.[1] ?? "",
  );
  if (mayExperience) return `${sentenceCase(mayExperience)}.`;

  const thereCouldBe = cleanConcernText(
    body.match(/\bthere could be (.+?)(?:\.| The technician\b| Replace or repair\b)/i)?.[1] ?? "",
  );
  if (thereCouldBe) return `${sentenceCase(thereCouldBe.replace(/^an?\s+/i, ""))}.`;

  const customerConcern = cleanConcernText(
    body.match(/\bto correct (?:a )?customer concern of ([^.]+?)(?:\.|,)/i)?.[1] ??
    body.match(/\bcorrect (?:a )?customer concern of ([^.]+?)(?:\.|,)/i)?.[1] ??
    "",
  );
  if (customerConcern) return `${sentenceCase(customerConcern)}.`;

  const mayEncounter = cleanConcernText(
    body.match(/\bmay be encountered with (.+?)(?:\.|,)/i)?.[1] ?? "",
  );
  if (mayEncounter) return `${sentenceCase(mayEncounter.replace(/^there could be\s+/i, ""))}.`;

  const technicianAware = cleanConcernText(
    body.match(/\bmakes technicians aware of (.+?)(?:\.|,)/i)?.[1] ?? "",
  );
  if (technicianAware) return `${sentenceCase(technicianAware)}.`;

  const oilLeakNearTurbo = cleanConcernText(
    body.match(/\b(oil leak near the turbocharger)\b/i)?.[1] ?? "",
  );
  if (oilLeakNearTurbo) return `${sentenceCase(oilLeakNearTurbo)}.`;

  const sesCodes = extractObdCodes(body.match(/\bSES light on[\s\S]*/i)?.[0] ?? "");
  if (/\bSES light on\b/i.test(body) && sesCodes.length > 0) {
    return `SES light on with ${formatDtcPhrase(sesCodes)}.`;
  }

  const logicDtcCodes = extractObdCodes(
    body.match(/\bfollowing Diagnostic Trouble Code \(DTC\):\s*([^.]+?)(?:\.|,)/i)?.[1] ??
    body.match(/\bfollowing DTCs[\s\S]+$/i)?.[0] ??
    "",
  );
  if (logicDtcCodes.length > 0) {
    if (/\bTransmission Control Module\b|\bTCM\b/i.test(body)) {
      return `${formatDtcPhrase(logicDtcCodes)} detected in the transmission control module.`;
    }
    if (/\bHYDRAULIC UNIT ASSEMBLY\b|\bVDC\b/i.test(body)) {
      return `${formatDtcPhrase(logicDtcCodes)} detected in the VDC module.`;
    }
    return `${formatDtcPhrase(logicDtcCodes)} detected.`;
  }

  const symptom1 = cleanConcernText(
    body.match(/\bSYMPTOM 1:\s*([^:]+?)(?:SYMPTOM 2:|SYPMTOM 2:|NOTE:|\.")/i)?.[1] ?? "",
  );
  const symptom2 = cleanConcernText(
    body.match(/\bSYPM?TOM 2:\s*([^:]+?)(?:NOTE:|\.")/i)?.[1] ?? "",
  );
  if (symptom1 && symptom2) {
    return `${sentenceCase(symptom1.replace(/\.$/, ""))} or ${cleanConcernText(symptom2).replace(/\.$/, "").replace(/^A\s+/, "a ")}.`;
  }
  if (symptom1) return `${sentenceCase(symptom1)}.`;

  const mayNotRespond = cleanConcernText(
    body.match(/\bmay not respond when ([^.]+)\./i)?.[1] ?? "",
  );
  if (mayNotRespond) return `${sentenceCase(`System does not respond when ${mayNotRespond}`)}.`;

  const activatesInResponse = cleanConcernText(
    body.match(/\b([a-z0-9\- ]+?) function that activates in response to (?:a )?(.+?)(?:\.|,)/i)?.[0] ??
    body.match(/\b([a-z0-9\- ]+?) activates in response to (?:a )?(.+?)(?:\.|,)/i)?.[0] ??
    "",
  );
  if (activatesInResponse) {
    return sentenceCase(
      activatesInResponse
        .replace(/\bfunction that activates\b/i, "activates")
        .replace(/\b in response to\b/i, " when ")
        .replace(/\bfault detected\b/i, "fault is detected"),
    );
  }

  const symptomSentence = cleanText(bestSentence(sentences, sentence => hasSymptomLanguage(sentence)));
  if (symptomSentence) {
    const rewritten = sentenceCase(
      symptomSentence
        .replace(/^the affected .+? may\b/i, "Vehicle may")
        .replace(/^this preliminary information communicates(?: that| to the technician to)?\s*/i, "")
        .replace(/^the document makes technicians aware of\s*/i, "")
        .replace(/^this bulletin announces (?:the )?availability of\s*/i, "")
        .replace(/^this logic was developed to address\s*/i, "")
        .replace(/^this bulletin provides information to\b/i, "")
        .trim(),
    );
    if (!isActionLikeText(rewritten)) return rewritten;
  }

  const cleanedTitle = cleanText(title);
  if (cleanedTitle && !/\bsoftware update\b/i.test(cleanedTitle) && !/\bimprovement\b/i.test(cleanedTitle)) {
    return sentenceCase(cleanedTitle);
  }
  return "";
}

function normalizeResolutionCandidate(text) {
  let normalized = cleanText(text).replace(/^this bulletin (?:provides information|provides the procedure|describes a procedure|contains instructions) to\s+/i, "");
  normalized = normalized.replace(/^dealers are to\s+/i, "");
  normalized = normalized.replace(/^to remedy\s+/i, "");
  normalized = normalized.replace(/^to address\s+/i, "");
  if (normalized && !/[.!?]$/.test(normalized)) normalized = `${normalized}.`;
  return normalized.trim();
}

function makeConciseResolution(text) {
  const source = cleanText(text);
  if (!source) return "";
  if (/\bdo not replace\b/i.test(source) || /\bnot to replace\b/i.test(source)) return "";

  const repairOrReplaceTarget = cleanText(
    source.match(/\breplace or repair (?:the )?(.+?)(?: as needed| if needed| when needed|\.|,)/i)?.[1] ?? "",
  );
  if (repairOrReplaceTarget) return `Repair or replace the ${repairOrReplaceTarget} as needed.`;

  const replacementTarget = cleanText(
    source.match(/\breplacement of (?:the )?(.+?)(?: on\b| for\b| in\b| to\b| if\b| when\b|\.|,)/i)?.[1] ?? "",
  );
  if (replacementTarget) return `Replace the ${replacementTarget}.`;

  const replaceTarget = cleanText(
    source.match(/\breplac(?:e|ed) (?:the )?(.+?)(?: on\b| for\b| in\b| to\b| if\b| when\b| as needed|\.|,)/i)?.[1] ?? "",
  );
  if (replaceTarget) return `Replace the ${replaceTarget}.`;

  const replacingTarget = cleanText(
    source.match(/\breplacing (?:the )?(.+?)(?: is the solution| will correct| can resolve|\.|,)/i)?.[1] ?? "",
  );
  if (replacingTarget) return `Replace the ${replacingTarget}.`;

  const updateTarget = cleanText(
    source.match(/\bupdate the software on (.+?)(?: to remedy| to address|\.|,)/i)?.[1] ??
    source.match(/\bupdate (?:the )?(.+? software)(?: on certain| on | for | to remedy| to address|\.|,)/i)?.[1] ??
    "",
  );
  if (updateTarget) {
    if (/\bsoftware\b/i.test(updateTarget)) return `Update the ${updateTarget}.`;
    return `Update the software on ${updateTarget}.`;
  }

  const reprogramTarget = cleanText(
    source.match(/\breprogram(?: the)? (.+?)(?: to remedy| to address|\.|,)/i)?.[1] ?? "",
  );
  if (reprogramTarget) return `Reprogram ${reprogramTarget}.`;

  const reprogramFilesTarget = cleanText(
    source.match(/\breprogramming files for the (.+?)(?:\.|,)/i)?.[1] ?? "",
  );
  if (reprogramFilesTarget) return `Reprogram the ${reprogramFilesTarget}.`;

  const availabilityReplacementTarget = cleanText(
    source.match(/\bavailability of the new (.+?) developed to address/i)?.[1] ?? "",
  );
  if (availabilityReplacementTarget) return `Replace the ${availabilityReplacementTarget}.`;

  if (/\breprogramming files\b/i.test(source) && /\bTransmission Control Module\b|\bTCM\b/i.test(source)) {
    return "Reprogram the Transmission Control Module (TCM).";
  }
  if (/\breprogramming files\b/i.test(source) && /\bHYDRAULIC UNIT ASSEMBLY\b|\bVDC\b/i.test(source)) {
    return "Reprogram the HYDRAULIC UNIT ASSEMBLY (VDC).";
  }

  const inspectTarget = cleanText(
    source.match(/\binspect (?:and repair |and replace )?(.+?)(?: for\b| on\b| in\b|\.|,)/i)?.[1] ?? "",
  );
  if (inspectTarget) return `Inspect ${inspectTarget}.`;

  return normalizeResolutionCandidate(source);
}

export function extractSeedParts(record) {
  const summary = cleanText(record.summary);
  const { title, body } = splitTitleAndBody(summary);
  const sentences = sentenceSplit(body);
  const preferredRepairSentence = cleanText(
    bestSentence(sentences, sentence => /\b(?:replace|reprogram|update|repair)\b/i.test(sentence)),
  );
  const repairSentence = preferredRepairSentence || cleanText(bestSentence(sentences, sentence => hasRepairLanguage(sentence)));
  const explicitRemedy =
    cleanText(body.match(/\bthis bulletin provides (?:information|the procedure) to ([\s\S]+?)(?<=\.)/i)?.[1] ?? "") ||
    cleanText(body.match(/\bdealers are to ([\s\S]+?)(?<=\.)/i)?.[1] ?? "") ||
    cleanText(body.match(/\bto remedy ([\s\S]+?)(?<=\.)/i)?.[1] ?? "") ||
    repairSentence;

  const resolution = makeConciseResolution(explicitRemedy);
  const actionWhenSymptomRaw = sentenceCase(
    cleanText(
      body.match(/\b(?:provides (?:instructions|repair information|the procedure)|dealers are to)\s+(?:on how to remedy|to remedy)\s+(.+?)(?:\.|$)/i)?.[1] ??
      body.match(/\b(?:provides (?:instructions|repair information|the procedure)|dealers are to)\s+to\s+(?:replace|repair|adjust|inspect|install)[\s\S]+?\bwhen\s+(.+?)(?:\.|$)/i)?.[1] ??
      "",
    ),
  );
  const actionWhenSymptom = actionWhenSymptomRaw
    ? /[.!?]$/.test(actionWhenSymptomRaw) ? actionWhenSymptomRaw : `${actionWhenSymptomRaw}.`
    : "";
  const description =
    actionWhenSymptom ||
    makeConciseDescription(title, body, sentences) ||
    cleanText(bestSentence(sentences, sentence => hasSymptomLanguage(sentence)) || title || sentences[0] || body);
  const symptomSource = description || (title && hasSymptomLanguage(title) ? title : "");
  const symptoms = symptomSource ? [symptomSource] : [];
  const obd_codes = extractObdCodes(`${title} ${body}`);

  return {
    description,
    resolution,
    symptoms,
    obd_codes,
    title,
    body,
  };
}

export function classifyTsbRecord(record) {
  const mergedText = cleanText(`${record.communication_type} ${record.summary}`);
  const extracted = extractSeedParts(record);
  const serviceBulletin = isServiceBulletin(record);
  const warranty = isWarrantyExtension(record);
  const hasRepair = hasRepairLanguage(mergedText);
  const hasSymptom = hasSymptomLanguage(mergedText) || extracted.obd_codes.length > 0;
  const hasReadyGradeSymptom = hasReadyGradeSymptomLanguage(mergedText) || extracted.obd_codes.length > 0;
  const discardLike = isDiscardLike(mergedText);
  const genericResolution = GENERIC_RESOLUTION_PATTERNS.some(pattern => pattern.test(extracted.resolution));
  const actionableResolution = hasRepairLanguage(extracted.resolution);
  const actionLikeDescription = isActionLikeText(extracted.description);
  const sameDescriptionAndResolution = cleanText(extracted.description).toLowerCase() === cleanText(extracted.resolution).toLowerCase();
  const descriptionLooksLikeBulletinProse = looksLikeBulletinProse(extracted.description);
  const symptomLooksLikeBulletinProse = extracted.symptoms.some(symptom => looksLikeBulletinProse(symptom));
  const resolutionLooksLikeBulletinProse = looksLikeBulletinProse(extracted.resolution) ||
    /^["“”']?this bulletin announces availability/i.test(cleanText(extracted.resolution));
  const preventiveOrInvestigative = /\bprevent\b[\s\S]{0,160}\bunnecessarily\b/i.test(mergedText) ||
    /\bfalse\b[\s\S]{0,120}\b(?:do not replace|not to replace)\b/i.test(mergedText) ||
    /\bdo not replace the module\b/i.test(mergedText) ||
    /\bengineering is currently investigating\b/i.test(mergedText) ||
    /\bif no issue is found[\s\S]{0,120}\bdo not replace\b/i.test(mergedText);

  if (!serviceBulletin && !warranty) {
    return { stage: "discarded", reason: `Unsupported communication type: ${record.communication_type}`, extracted };
  }
  if (discardLike) {
    return { stage: "discarded", reason: "Looks like a campaign/notice rather than a concrete repair case.", extracted };
  }
  if (isGmAdminDiscard(record, mergedText)) {
    return { stage: "discarded", reason: "GM bulletin looks administrative, TAC/workflow, or generic service guidance rather than a concrete diagnostic repair case.", extracted };
  }
  if (!hasRepair && !hasSymptom) {
    return { stage: "discarded", reason: "No concrete symptom or repair language in summary.", extracted };
  }
  if (!extracted.description || extracted.description.length < 12) {
    return { stage: "to_review", reason: "Description extraction is too thin.", extracted };
  }
  if (preventiveOrInvestigative) {
    return { stage: "to_review", reason: "Bulletin looks preventive, false-positive, or still under investigation.", extracted };
  }
  if (actionLikeDescription || sameDescriptionAndResolution) {
    return { stage: "to_review", reason: "Summary does not separate symptom from repair action cleanly enough.", extracted };
  }
  if (descriptionLooksLikeBulletinProse || symptomLooksLikeBulletinProse) {
    return { stage: "to_review", reason: "Extracted symptom/description still looks like raw bulletin prose.", extracted };
  }
  if (!extracted.resolution || extracted.resolution.length < 10 || genericResolution || resolutionLooksLikeBulletinProse || !actionableResolution) {
    return { stage: "to_review", reason: "Repair action exists but extracted resolution is still weak.", extracted };
  }
  if (!extracted.symptoms.length) {
    return { stage: "to_review", reason: "No usable symptom phrase extracted.", extracted };
  }
  if (!hasReadyGradeSymptom) {
    return { stage: "to_review", reason: "Repair bulletin exists, but the malfunction is not described concretely enough for automatic ready classification.", extracted };
  }
  if (serviceBulletin && hasRepair && hasSymptom) {
    return { stage: "ready", reason: "Concrete service bulletin with symptom and prescribed remedy.", extracted };
  }
  return { stage: "to_review", reason: "Potentially useful, but not strong enough for automatic ready classification.", extracted };
}

function computeLocalId(record) {
  const input = JSON.stringify({
    source: "nhtsa_mfr_comm",
    nhtsa_id: record.nhtsa_id,
    tsb_id: record.tsb_id,
    make: record.make,
    model: record.model,
    model_year: record.model_year,
    summary: cleanText(record.summary),
  });
  return `seed_${crypto.createHash("sha256").update(input, "utf8").digest("hex").slice(0, 16)}`;
}

export function computePatternId(record) {
  const input = JSON.stringify({
    source: "nhtsa_mfr_comm_pattern",
    nhtsa_id: record.nhtsa_id,
    tsb_id: record.tsb_id,
    communication_type: record.communication_type,
    make: record.make,
    summary: cleanText(record.summary),
  });
  return `pattern_${crypto.createHash("sha256").update(input, "utf8").digest("hex").slice(0, 16)}`;
}

export function buildPatternGroups(records) {
  const map = new Map();
  for (const record of records) {
    const key = makePatternKey(record);
    const existing = map.get(key);
    if (existing) {
      existing.records.push(record);
      existing.models.add(record.model);
      existing.modelYears.add(record.model_year);
      continue;
    }
    map.set(key, {
      pattern_id: computePatternId(record),
      key,
      representative: record,
      records: [record],
      models: new Set([record.model]),
      modelYears: new Set([record.model_year]),
    });
  }

  return [...map.values()].map(group => ({
    ...group,
    models: [...group.models].sort((a, b) => a.localeCompare(b)),
    modelYears: [...group.modelYears].sort((a, b) => a.localeCompare(b)),
  }));
}

export function buildSeedRecord(record, extracted, userId = DEFAULT_USER_ID, patternId = null) {
  const catalogMapping = resolveCatalogVehicle(record);
  const sourceRef = buildNhtsaSourceRef(record);
  const bulletinUrl = buildNhtsaBulletinUrl(record);
  return {
    local_id: computeLocalId(record),
    user_id: userId,
    thread_url: bulletinUrl,
    source_ref: sourceRef,
    vehicle_brand: catalogMapping.vehicle_brand,
    vehicle_model: catalogMapping.vehicle_model,
    mileage: null,
    engine_power: null,
    symptoms: extracted.symptoms,
    obd_codes: extracted.obd_codes,
    description: extracted.description,
    resolution: extracted.resolution,
    closed_at: parseYmdToIso(record.mfr_comm_date || record.date_added),
    metadata: {
      source_type: "nhtsa_mfr_comm",
      pattern_id: patternId,
      source_ref: sourceRef,
      source_refs: sourceRef ? [sourceRef] : [],
      nhtsa_id: record.nhtsa_id,
      replacement_bulletin: record.replacement_bulletin || null,
      date_added: record.date_added || null,
      tsb_id: record.tsb_id,
      mfr_comm_date: record.mfr_comm_date || null,
      mfr_internal_campaign: record.mfr_internal_campaign || null,
      communication_type: record.communication_type,
      make_raw: record.make,
      model_raw: record.model,
      model_year: record.model_year,
      model_years: record.model_year ? [record.model_year] : [],
      model_raw_values: record.model ? [record.model] : [],
      source_variant_count: 1,
      catalog_mapping: catalogMapping,
      nhtsa_components: record.nhtsa_components,
      mfr_component_system: record.mfr_component_system,
      mfr_component_subsystem: record.mfr_component_subsystem,
      summary_raw: record.summary,
    },
  };
}

export function finalizeStageForSeed(classification, seed) {
  if (classification.stage === "ready" && !seed?.metadata?.catalog_mapping?.resolved) {
    return {
      ...classification,
      stage: "to_review",
      reason: "Content looks ready, but the vehicle could not be mapped to the app catalog yet.",
    };
  }
  return classification;
}

function seedYearRank(seed) {
  const raw = cleanText(seed?.metadata?.model_year);
  return /^\d{4}$/.test(raw) ? Number(raw) : 0;
}

function seedRevisionRank(seed) {
  return extractRevisionRankFromSourceRef(seed?.source_ref ?? seed?.metadata?.source_ref ?? "");
}

function uniqueSorted(values) {
  return [...new Set((values ?? []).map(value => cleanText(value)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function mergeVariantMetadata(preferredSeed, otherSeed) {
  preferredSeed.metadata.model_years = uniqueSorted([
    ...(preferredSeed.metadata.model_years ?? [preferredSeed.metadata.model_year]),
    ...(otherSeed.metadata.model_years ?? [otherSeed.metadata.model_year]),
  ]);
  preferredSeed.metadata.model_raw_values = uniqueSorted([
    ...(preferredSeed.metadata.model_raw_values ?? [preferredSeed.metadata.model_raw]),
    ...(otherSeed.metadata.model_raw_values ?? [otherSeed.metadata.model_raw]),
  ]);
  preferredSeed.metadata.source_refs = uniqueSorted([
    ...(preferredSeed.metadata.source_refs ?? [preferredSeed.metadata.source_ref]),
    ...(otherSeed.metadata.source_refs ?? [otherSeed.metadata.source_ref]),
  ]);
  preferredSeed.metadata.source_variant_count = Math.max(
    Number(preferredSeed.metadata.source_variant_count ?? 1),
    Number(otherSeed.metadata.source_variant_count ?? 1),
  ) + 1;
  return preferredSeed;
}

function makeCanonicalSeedKey(stage, seed) {
  return [
    stage,
    cleanText(seed.vehicle_brand).toLowerCase(),
    cleanText(seed.vehicle_model).toLowerCase(),
    uniqueSorted(seed.obd_codes).join(",").toLowerCase(),
    cleanText(seed.description).toLowerCase(),
    cleanText(seed.resolution).toLowerCase(),
  ].join("||");
}

export function collapseSeedEntries(entries) {
  const map = new Map();
  for (const entry of entries) {
    const key = makeCanonicalSeedKey(entry.stage, entry.seed);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...entry,
        seed: entry.seed,
      });
      continue;
    }

    const incomingWins =
      seedRevisionRank(entry.seed) > seedRevisionRank(existing.seed) ||
      (
        seedRevisionRank(entry.seed) === seedRevisionRank(existing.seed) &&
        seedYearRank(entry.seed) > seedYearRank(existing.seed)
      );
    const preferred = incomingWins ? entry : existing;
    const other = incomingWins ? existing : entry;
    const mergedSeed = mergeVariantMetadata(preferred.seed, other.seed);
    map.set(key, {
      ...preferred,
      seed: mergedSeed,
    });
  }
  return [...map.values()];
}

async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

async function appendJsonLine(filePath, value) {
  await fsp.appendFile(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

async function collectMergedRecords(args) {
  const rows = new Map();
  const stats = {
    scanned_rows: 0,
    kept_rows: 0,
    merged_records: 0,
  };

  const stream = fs.createReadStream(args.inputPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    stats.scanned_rows++;
    if (stats.scanned_rows > args.limit) break;
    const record = parseTsbLine(line);
    if (!record || !shouldKeepByFilter(record, args)) continue;
    stats.kept_rows++;
    const key = makeGroupKey(record);
    rows.set(key, mergeTsbRecords(rows.get(key), record));
  }

  stats.merged_records = rows.size;
  return { records: [...rows.values()], stats };
}

async function writeReviewFile(dirPath, seed, record, classification) {
  const reviewPath = path.join(dirPath, `review_${seed.local_id.slice(5)}.json`);
  const payload = {
    pattern_id: seed?.metadata?.pattern_id ?? null,
    stage: classification.stage,
    review_reason: classification.reason,
    candidate_seed: seed,
    source_record: record,
  };
  await fsp.writeFile(reviewPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await ensureDir(args.outDir);
  const readyDir = path.join(args.outDir, "ready");
  const reviewDir = path.join(args.outDir, "to_review");
  const discardedPath = path.join(args.outDir, "discarded.jsonl");
  const patternDecisionsPath = path.join(args.outDir, "pattern_decisions.jsonl");
  const summaryPath = path.join(args.outDir, "summary.json");
  await ensureDir(readyDir);
  await ensureDir(reviewDir);
  await fsp.writeFile(discardedPath, "", "utf8");
  await fsp.writeFile(patternDecisionsPath, "", "utf8");

  const { records, stats } = await collectMergedRecords(args);
  const patternGroups = buildPatternGroups(records);
  const summary = {
    input_path: args.inputPath,
    filters: {
      make: args.make || null,
      model: args.model || null,
      limit: Number.isFinite(args.limit) ? args.limit : null,
    },
    scanned_rows: stats.scanned_rows,
    kept_rows: stats.kept_rows,
    merged_records: stats.merged_records,
    pattern_groups: patternGroups.length,
    ready: 0,
    to_review: 0,
    discarded: 0,
  };
  const readyEntries = [];
  const reviewEntries = [];

  for (const group of patternGroups) {
    const classification = classifyTsbRecord(group.representative);
    await appendJsonLine(patternDecisionsPath, {
      pattern_id: group.pattern_id,
      stage: classification.stage,
      reason: classification.reason,
      nhtsa_id: group.representative.nhtsa_id,
      tsb_id: group.representative.tsb_id,
      communication_type: group.representative.communication_type,
      make: group.representative.make,
      summary: group.representative.summary,
      model_count: group.records.length,
      models: group.models,
      model_years: group.modelYears,
    });

    for (const record of group.records) {
      const seed = buildSeedRecord(record, classification.extracted, args.userId, group.pattern_id);
      const finalClassification = finalizeStageForSeed(classification, seed);

      if (finalClassification.stage === "ready") {
        readyEntries.push({ stage: "ready", seed, record, classification: finalClassification });
        continue;
      }

      if (finalClassification.stage === "to_review") {
        reviewEntries.push({ stage: "to_review", seed, record, classification: finalClassification });
        continue;
      }

      await appendJsonLine(discardedPath, {
        pattern_id: group.pattern_id,
        stage: classification.stage,
        reason: classification.reason,
        nhtsa_id: record.nhtsa_id,
        tsb_id: record.tsb_id,
        communication_type: record.communication_type,
        make: record.make,
        model: record.model,
        model_year: record.model_year,
        summary: record.summary,
      });
      summary.discarded++;
    }
  }

  for (const entry of collapseSeedEntries(readyEntries)) {
    await fsp.writeFile(path.join(readyDir, `${entry.seed.local_id}.json`), `${JSON.stringify(entry.seed, null, 2)}\n`, "utf8");
    summary.ready++;
  }

  for (const entry of collapseSeedEntries(reviewEntries)) {
    await writeReviewFile(reviewDir, entry.seed, entry.record, entry.classification);
    summary.to_review++;
  }

  await fsp.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(
    `Processed ${summary.merged_records} merged record(s). Wrote ${summary.ready} ready, ${summary.to_review} review and ${summary.discarded} discarded into: ${args.outDir}`,
  );
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.endsWith("tsb-seed-nhtsa.mjs")) {
  main().catch(error => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}
