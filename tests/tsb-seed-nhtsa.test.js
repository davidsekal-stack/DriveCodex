import assert from "node:assert/strict";

import {
  buildNhtsaBulletinUrl,
  buildNhtsaSourceRef,
  buildSeedRecord,
  buildPatternGroups,
  classifyTsbRecord,
  collapseSeedEntries,
  computePatternId,
  extractSeedParts,
  finalizeStageForSeed,
  hasSupportedCatalogBrand,
  mergeTsbRecords,
  makePatternKey,
  parseArgs,
  parseTsbLine,
  resolveCatalogVehicle,
} from "../scripts/tsb-seed-nhtsa.mjs";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  OK ${name}`);
    passed++;
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(`    ${error.message}`);
    failed++;
  }
}

console.log("\n== tsb-seed-nhtsa ==");

const SERVICE_BULLETIN_LINE = [
  "11011232",
  "",
  "20241204",
  "TSB_ELE352_R2",
  "20241202",
  "SA582",
  "Service Bulletin/Repair Instructions",
  "KIA",
  "SORENTO PHEV",
  "2024",
  "ELECTRICAL SYSTEM",
  "ELE",
  "",
  "TECHNICAL SERVICE BULLETIN: SERVICE ACTION: AVN 5.0 WIDE NON-RESPONSIVE RADIO ICON (AM, FM, SXM) (SA582) - This bulletin provides information to update the software on 5th Generation AVN wide on certain 2023-2024 MY Kia vehicles to remedy a non-responsive or inoperative radio concern. The affected AVN unit may not respond when pressing the RADIO hard key.",
].join("\t");

const OWNER_NOTICE_LINE = [
  "11011217",
  "",
  "20241204",
  "PI2106_OWNR_301",
  "20241202",
  "PI2106",
  "Other",
  "KIA",
  "FORTE",
  "2017",
  "ENGINE",
  "",
  "",
  "PRODUCT IMPROVEMENT CAMPAIGN: OWNER RENOTIFICATION (PI2106) - This document is the owner renotification advising that Kia is conducting an important Product Improvement Campaign to perform a software update on 2017-2018 MY Kia Forte vehicles equipped with 2.0-liter Nu GDI engines to protect the engine from excessive connecting rod bearing damage.",
].join("\t");

const WARRANTY_EXTENSION_LINE = [
  "11011945",
  "",
  "20241218",
  "TSB_ELE108_R1",
  "20241211",
  "WTY003",
  "Service Bulletin/Repair Instructions",
  "KIA",
  "SORENTO",
  "2012",
  "AIR BAGS,STEERING",
  "ELE",
  "",
  "TECHNICAL SERVICE BULLETIN: AIRBAG WARNING LIGHT ON (WTY003) - This bulletin provides information related to the replacement of the clock spring assembly on 2011MY - 2015MY Sorento (XMa) vehicles. This warranty extension addresses failures of the driver’s front airbag clock spring, as well as the diagnosis of any concerns related to the airbag warning light.",
].join("\t");

const SOFTWARE_UPGRADE_LINE = [
  "11013025",
  "",
  "20250122",
  "TSB_ELE367",
  "20250121",
  "SA599",
  "Service Bulletin/Repair Instructions",
  "KIA",
  "EV6",
  "2022",
  "ELECTRICAL SYSTEM",
  "ELE",
  "",
  "TECHNICAL SERVICE BULLETIN: SERVICE ACTION: LIMP-HOME MODE OPERATION LOGIC IMPROVEMENT (SA599) - This bulletin provides information to upgrade the Vehicle Control Unit (VCU) software on certain 2022-2024MY EV6 (CV) vehicles produced from November 17, 2021, through July 18, 2024, which are equipped with a limp-home mode function that activates in response to a fault detected in the Low-Voltage DC-DC Converter (LDC).",
].join("\t");

const MCU_UPDATE_WITH_EXPLICIT_SYMPTOMS_LINE = [
  "11012057",
  "",
  "20241223",
  "TSB_ELE364",
  "20241223",
  "SA596",
  "Service Bulletin/Repair Instructions",
  "KIA",
  "SORENTO HYBRID",
  "2025",
  "ELECTRICAL SYSTEM",
  "ELE",
  "",
  "TECHNICAL SERVICE BULLETIN: SERVICE ACTION: MOTOR CONTROL UNIT (MCU) LOGIC IMPROVEMENT (SA596) - This bulletin provides the procedure to update the Motor Control Unit (MCU) software on certain 2025MY Sorento HEV (MQ4 HEV) vehicles equipped with 19” wheels and produced from March 4, 2024 through November 9, 2024. The affected vehicles may exhibit traction motor noise, an inoperable A/C, and illuminated warning lights with DTCs P0A3C, P0AF0, P1B77 stored due to intermittent traction motor operation when the hybrid system powers ‘OFF’ during the engine clutch calibration procedure.",
].join("\t");

const MERCEDES_SAMPLE_LINE = [
  "11014001",
  "",
  "20250131",
  "LI54.30-P-080001",
  "20250130",
  "",
  "Service Bulletin/Repair Instructions",
  "MERCEDES-BENZ",
  "GLE",
  "2020",
  "ENGINE",
  "ENG",
  "",
  "SERVICE BULLETIN: ENGINE WARNING LIGHT - Vehicles may exhibit an illuminated check engine warning light and reduced performance. Replace the affected boost pressure sensor.",
].join("\t");

const PORSCHE_SAMPLE_LINE = [
  "11015001",
  "",
  "20250131",
  "WOR-24-911",
  "20250130",
  "",
  "Service Bulletin/Repair Instructions",
  "PORSCHE",
  "MACAN",
  "2024",
  "POWER TRAIN",
  "PT",
  "",
  "SERVICE BULLETIN: VEHICLE WILL NOT CHARGE - Customers may experience a vehicle that will not charge. Replace the onboard charger control module.",
].join("\t");

const PORSCHE_TRIM_SAMPLE_LINE = [
  "11015002",
  "",
  "20250131",
  "WOR-24-718",
  "20250130",
  "",
  "Service Bulletin/Repair Instructions",
  "PORSCHE",
  "718 CAYMAN GT4",
  "2024",
  "ENGINE",
  "ENG",
  "",
  "SERVICE BULLETIN: ENGINE NOISE - Customers may experience engine noise. Replace the affected valve lifter.",
].join("\t");

const LINCOLN_LONGFORM_LINE = [
  "11029540",
  "",
  "20260327",
  "SSM 54615",
  "20260320",
  "",
  "Service Bulletin/Repair Instructions",
  "LINCOLN",
  "CORSAIR",
  "2021",
  "POWER TRAIN",
  "TRANS",
  "",
  "SERVICE BULLETIN: TRANSMISSION CONCERN - Some 2025 Maverick/Corsair and 2025-2026 Escape/Bronco Sport vehicles equipped with an 8F35 transmission and built on 01-Sep-2024 through 15-Sep-2025 may exhibit a condition where the vehicle will not move in drive or reverse with DTCs P076E, P0760, P0761, P2706, P2707, and P2702. Replace the main control valve body.",
].join("\t");

const ALFA_TIMING_COVER_LINE = [
  "11018862",
  "",
  "20250529",
  "09-013-25",
  "20250528",
  "",
  "Service Bulletin/Repair Instructions",
  "ALFA ROMEO",
  "GIULIA",
  "2024",
  "ENGINE",
  "ENG",
  "",
  "SERVICE BULLETIN: OIL LEAK - Customers may experience the following: ● Oil leaking from the timing cover. Replace the timing cover sealant.",
].join("\t");

const BUICK_HPFP_LINE = [
  "11018413",
  "",
  "20250510",
  "PIP6061",
  "20250509",
  "",
  "Service Bulletin/Repair Instructions",
  "BUICK",
  "ENCLAVE",
  "2024",
  "FUEL SYSTEM",
  "ENG",
  "",
  "This Preliminary information communicates there could be an electrical connection concerns at the high pressure fuel pump, and may set any combnation of diagnostic trouble codes, P0089 P0090 P00C6 P163A and / or P228C. The technician should inspect the terminals and manipulate the harness to see if any of the codes can be duplicated. Replace or repair connector or terminals as needed.",
].join("\t");

const BUICK_FALSE_DTC_LINE = [
  "11019983",
  "",
  "20250518",
  "PIT6404",
  "20250517",
  "",
  "Service Bulletin/Repair Instructions",
  "BUICK",
  "ENVISION",
  "2024",
  "ELECTRICAL SYSTEM",
  "ELE",
  "",
  "This Preliminary Information communicates the DTC's setting in the SDGM are false, steps to resolve and not to replace the module.",
].join("\t");

const SUBARU_VDC_REFLASH_LINE = [
  "11022303",
  "",
  "20250612",
  "06-96-25",
  "20250611",
  "",
  "Service Bulletin/Repair Instructions",
  "SUBARU",
  "ASCENT",
  "2024",
  "SERVICE BRAKES",
  "BRAKE",
  "",
  "This bulletin announces the availability of reprogramming files for the HYDRAULIC UNIT ASSEMBLY(VDC). This logic was developed to address the following Diagnostic Trouble Code (DTC): C1411 ELECTRICAL CONTROL MODULE. If DTC C1411 is detected with a 30A2 failure detail code by the VDC perform the reprogramming procedure outlined.",
].join("\t");

const SUBARU_FALSE_POSITIVE_DTC_LINE = [
  "11021254",
  "",
  "20250608",
  "16-153-25",
  "20250607",
  "",
  "Service Bulletin/Repair Instructions",
  "SUBARU",
  "CROSSTREK",
  "2024",
  "POWER TRAIN",
  "TRANS",
  "",
  "This bulletin announces the availability of reprogramming files for the Transmission Control Module (TCM). These files contain enhanced logic to prevent DTC P0A12 from being set unnecessarily in the TCM memory.",
].join("\t");

const SUBARU_TCM_VALVE_BODY_LINE = [
  "11013504",
  "",
  "20250530",
  "16-149-25",
  "20250529",
  "",
  "Service Bulletin/Repair Instructions",
  "SUBARU",
  "LEGACY",
  "2024",
  "POWER TRAIN",
  "TRANS",
  "",
  "\"This bulletin announces availability of the new TR580 control valve and connector cover developed to address cases of the following DTCs detected by the Transmission Control Module (TCM): • P2721: Pressure Control Solenoid D Control Circuit High • P2763: Torque Converter Clutch Pressure Control Solenoid Control Circuit High • P0974: Shift Solenoid A Control Circuit High • P0977: Shift Solenoid B Control Circuit High\"",
].join("\t");

const SUBARU_TCM_REFLASH_SYMPTOMS_LINE = [
  "11012253",
  "",
  "20250524",
  "16-150-24R",
  "20250523",
  "",
  "Service Bulletin/Repair Instructions",
  "SUBARU",
  "OUTBACK",
  "2024",
  "POWER TRAIN",
  "TRANS",
  "",
  "\"This bulletin announces availability of new reprogramming files developed to address the two symptoms described below: SYMPTOM 1: A jerk or judder sensation felt from the powertrain during braking with the air conditioning on. SYPMTOM 2: A shudder is felt from the powertrain along with a screeching type of sound. NOTE: Both of these symptoms are not related with a fault code. The new files contain enhanced software optimizing input clutch application along with enhanced hydraulic pressure control during braking/deceleration.\"",
].join("\t");

const ACURA_CAUSE_ONLY_LINE = [
  "11017329",
  "",
  "20250514",
  "B23-029",
  "20250513",
  "",
  "Service Bulletin/Repair Instructions",
  "ACURA",
  "RDX",
  "2018",
  "POWER TRAIN",
  "TRANS",
  "",
  "Service Bulletin - The lock-up clutch cannot provide adequate holding force due to pressure bleeding down through a crack in the lock up piston. The reduced lock-up clutch capacity results in the transmission indicator flashing “D” and set DTC P0741 Torque Converter Clutch Circuit Performance or Stuck OFF.",
].join("\t");

const MITSUBISHI_GENERIC_PROCEDURE_LINE = [
  "11029567",
  "",
  "20260304",
  "TSB-23-55-001",
  "20260212",
  "",
  "Service Bulletin/Repair Instructions",
  "MITSUBISHI",
  "OUTLANDER",
  "2020",
  "VISIBILITY/WIPER",
  "",
  "",
  "This revised Technical Service Bulletin provides instructions on how to remedy noise from the HVAC system (heater, air conditioner, ventilation vents) when the blower motor is turned on.",
].join("\t");

const MITSUBISHI_STRUT_LINE = [
  "11017993",
  "",
  "20250506",
  "TSB-23-33-002REV3",
  "20250404",
  "",
  "Service Bulletin/Repair Instructions",
  "MITSUBISHI",
  "OUTLANDER",
  "2024",
  "STEERING,SUSPENSION",
  "",
  "",
  "This Revised Technical Service Bulletin provides instructions to replaced the strut bearing and sping with countermeasure parts when front strut noise is heard while turning the steering wheel.",
].join("\t");

test("parseArgs reads positional args and optional filters", () => {
  const args = parseArgs(["input.txt", "out_dir", "--make", "KIA", "--limit", "5000"]);
  assert.equal(args.inputPath.endsWith("input.txt"), true);
  assert.equal(args.outDir.endsWith("out_dir"), true);
  assert.equal(args.make, "KIA");
  assert.equal(args.limit, 5000);
});

test("parseTsbLine reads a 14-column TSV row", () => {
  const row = parseTsbLine(SERVICE_BULLETIN_LINE);
  assert.equal(row.tsb_id, "TSB_ELE352_R2");
  assert.equal(row.make, "KIA");
  assert.equal(row.model, "SORENTO PHEV");
  assert.equal(row.communication_type, "Service Bulletin/Repair Instructions");
});

test("mergeTsbRecords aggregates component values", () => {
  const rowA = parseTsbLine(SERVICE_BULLETIN_LINE);
  const rowB = {
    ...rowA,
    nhtsa_components: "ELECTRICAL SYSTEM,UNKNOWN OR OTHER",
    mfr_component_system: "ELE,AVN",
  };
  const merged = mergeTsbRecords(mergeTsbRecords(null, rowA), rowB);
  assert.deepEqual(merged.nhtsa_components, ["ELECTRICAL SYSTEM", "UNKNOWN OR OTHER"]);
  assert.deepEqual(merged.mfr_component_system, ["ELE", "AVN"]);
});

test("pattern grouping collapses repeated bulletin rows before classification", () => {
  const a = mergeTsbRecords(null, parseTsbLine(SERVICE_BULLETIN_LINE));
  const b = { ...a, model: "SOUL", model_year: "2023" };
  const groups = buildPatternGroups([a, b]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].records.length, 2);
  assert.equal(groups[0].pattern_id, computePatternId(a));
  assert.equal(makePatternKey(a), makePatternKey(b));
});

test("extractSeedParts derives description and resolution from service bulletin summary", () => {
  const record = mergeTsbRecords(null, parseTsbLine(SERVICE_BULLETIN_LINE));
  const parts = extractSeedParts(record);
  assert.match(parts.description, /non-responsive|inoperative radio/i);
  assert.match(parts.resolution, /Update the software on/i);
  assert.equal(parts.symptoms.length > 0, true);
});

test("extractSeedParts rewrites bulletin prose into concise case language", () => {
  const record = mergeTsbRecords(null, parseTsbLine(WARRANTY_EXTENSION_LINE));
  const parts = extractSeedParts(record);
  assert.equal(parts.description, "Driver’s front airbag clock spring failure causing airbag warning light.");
  assert.equal(parts.resolution, "Replace the clock spring assembly.");
});

test("extractSeedParts strips leading bulletin filler like 'The following:'", () => {
  const record = mergeTsbRecords(null, parseTsbLine(ALFA_TIMING_COVER_LINE));
  const parts = extractSeedParts(record);
  assert.equal(parts.description, "Oil leaking from the timing cover.");
  assert.equal(parts.symptoms[0], "Oil leaking from the timing cover.");
});

test("extractSeedParts rewrites GM preliminary info into concise symptom and repair", () => {
  const record = mergeTsbRecords(null, parseTsbLine(BUICK_HPFP_LINE));
  const parts = extractSeedParts(record);
  assert.equal(parts.description, "Electrical connection at the high pressure fuel pump, and may set any combnation of diagnostic trouble codes, P0089 P0090 P00C6 P163A and / or P228C.");
  assert.equal(parts.resolution, "Repair or replace the connector or terminals as needed.");
  assert.deepEqual(parts.obd_codes, ["P0089", "P0090", "P00C6", "P163A", "P228C"]);
});

test("extractSeedParts rewrites Subaru reflash bulletin into concrete fault and action", () => {
  const record = mergeTsbRecords(null, parseTsbLine(SUBARU_VDC_REFLASH_LINE));
  const parts = extractSeedParts(record);
  assert.equal(parts.description, "DTC C1411 detected in the VDC module.");
  assert.equal(parts.resolution, "Reprogram the HYDRAULIC UNIT ASSEMBLY(VDC).");
  assert.deepEqual(parts.obd_codes, ["C1411"]);
});

test("extractSeedParts rewrites Subaru control valve bulletin into replace action", () => {
  const record = mergeTsbRecords(null, parseTsbLine(SUBARU_TCM_VALVE_BODY_LINE));
  const parts = extractSeedParts(record);
  assert.equal(parts.description, "DTCs P2721, P2763, P0974, and P0977 detected in the transmission control module.");
  assert.equal(parts.resolution, "Replace the TR580 control valve and connector cover.");
});

test("extractSeedParts rewrites Subaru multi-symptom reflash bulletin into concise case", () => {
  const record = mergeTsbRecords(null, parseTsbLine(SUBARU_TCM_REFLASH_SYMPTOMS_LINE));
  const parts = extractSeedParts(record);
  assert.equal(parts.description, "A jerk or judder sensation felt from the powertrain during braking with the air conditioning on or a shudder is felt from the powertrain along with a screeching type of sound.");
  const result = classifyTsbRecord(record);
  assert.equal(result.stage, "to_review");
  assert.match(result.reason, /resolution is still weak|separate symptom from repair/i);
});

test("classifyTsbRecord marks concrete service bulletin as ready", () => {
  const record = mergeTsbRecords(null, parseTsbLine(SERVICE_BULLETIN_LINE));
  const result = classifyTsbRecord(record);
  assert.equal(result.stage, "ready");
});

test("classifyTsbRecord discards owner renotification noise", () => {
  const record = mergeTsbRecords(null, parseTsbLine(OWNER_NOTICE_LINE));
  const result = classifyTsbRecord(record);
  assert.equal(result.stage, "discarded");
});

test("classifyTsbRecord sends action-only software improvement bulletins to review", () => {
  const record = mergeTsbRecords(null, parseTsbLine(SOFTWARE_UPGRADE_LINE));
  const result = classifyTsbRecord(record);
  assert.equal(result.stage, "to_review");
  assert.match(result.reason, /malfunction is not described concretely enough|resolution is still weak/i);
});

test("classifyTsbRecord keeps concrete software-fix bulletin ready when symptom is explicit", () => {
  const record = mergeTsbRecords(null, parseTsbLine(MCU_UPDATE_WITH_EXPLICIT_SYMPTOMS_LINE));
  const parts = extractSeedParts(record);
  assert.match(parts.description, /traction motor noise|inoperable A\/C|warning lights/i);
  assert.equal(parts.resolution, "Update the Motor Control Unit (MCU) software.");
  const result = classifyTsbRecord(record);
  assert.equal(result.stage, "ready");
});

test("classifyTsbRecord sends long-form bulletin prose to review even when repair action exists", () => {
  const record = mergeTsbRecords(null, parseTsbLine(LINCOLN_LONGFORM_LINE));
  const result = classifyTsbRecord(record);
  assert.equal(result.stage, "to_review");
  assert.match(result.reason, /raw bulletin prose/i);
});

test("classifyTsbRecord keeps concrete GM preliminary info case ready after rewrite", () => {
  const record = mergeTsbRecords(null, parseTsbLine(BUICK_HPFP_LINE));
  const result = classifyTsbRecord(record);
  assert.equal(result.stage, "ready");
});

test("classifyTsbRecord sends false-positive DTC bulletin to review", () => {
  const record = mergeTsbRecords(null, parseTsbLine(BUICK_FALSE_DTC_LINE));
  const result = classifyTsbRecord(record);
  assert.equal(result.stage, "to_review");
  assert.match(result.reason, /preventive|false-positive|investigation/i);
});

test("classifyTsbRecord keeps specific Subaru VDC DTC reflash case ready", () => {
  const record = mergeTsbRecords(null, parseTsbLine(SUBARU_VDC_REFLASH_LINE));
  const result = classifyTsbRecord(record);
  assert.equal(result.stage, "ready");
});

test("classifyTsbRecord sends Subaru false-positive prevention bulletin to review", () => {
  const record = mergeTsbRecords(null, parseTsbLine(SUBARU_FALSE_POSITIVE_DTC_LINE));
  const result = classifyTsbRecord(record);
  assert.equal(result.stage, "to_review");
  assert.match(result.reason, /preventive|false-positive|investigation/i);
});

test("classifyTsbRecord sends cause-only bulletin without repair action to review", () => {
  const record = mergeTsbRecords(null, parseTsbLine(ACURA_CAUSE_ONLY_LINE));
  const result = classifyTsbRecord(record);
  assert.equal(result.stage, "to_review");
  assert.match(result.reason, /resolution is still weak|separate symptom from repair action/i);
});

test("classifyTsbRecord sends bulletin-procedure-only repair guidance to review", () => {
  const record = mergeTsbRecords(null, parseTsbLine(MITSUBISHI_GENERIC_PROCEDURE_LINE));
  const parts = extractSeedParts(record);
  assert.equal(parts.description, "Noise from the HVAC system (heater, air conditioner, ventilation vents) when the blower motor is turned on.");
  const result = classifyTsbRecord(record);
  assert.equal(result.stage, "to_review");
  assert.match(result.reason, /resolution is still weak|repair action/i);
});

test("extractSeedParts rewrites Mitsubishi replace typo into explicit repair action", () => {
  const record = mergeTsbRecords(null, parseTsbLine(MITSUBISHI_STRUT_LINE));
  const parts = extractSeedParts(record);
  assert.equal(parts.description, "Front strut noise is heard while turning the steering wheel.");
  assert.equal(parts.resolution, "Replace the strut bearing and sping with countermeasure parts.");
});

test("buildSeedRecord emits import-compatible seed payload with metadata", () => {
  const record = mergeTsbRecords(null, parseTsbLine(SERVICE_BULLETIN_LINE));
  const extracted = extractSeedParts(record);
  const seed = buildSeedRecord(record, extracted, "ai_importer", "pattern_test");
  assert.equal(seed.user_id, "ai_importer");
  assert.equal(seed.thread_url, "https://static.nhtsa.gov/odi/tsbs/2024/MC-11011232-0001.pdf");
  assert.equal(seed.source_ref, "TSB_ELE352_R2 / NHTSA 11011232");
  assert.equal(seed.vehicle_brand, "Kia (US)");
  assert.equal(seed.vehicle_model, "Sorento (2021–present)");
  assert.match(seed.closed_at, /^2024-12-02T12:00:00.000Z$/);
  assert.equal(seed.metadata.source_type, "nhtsa_mfr_comm");
  assert.equal(seed.metadata.pattern_id, "pattern_test");
  assert.equal(seed.metadata.source_ref, "TSB_ELE352_R2 / NHTSA 11011232");
  assert.equal(seed.metadata.catalog_mapping.market, "US");
  assert.equal(seed.metadata.catalog_mapping.resolved, true);
});

test("NHTSA helpers generate source ref and public bulletin URL", () => {
  const record = mergeTsbRecords(null, parseTsbLine(WARRANTY_EXTENSION_LINE));
  assert.equal(buildNhtsaSourceRef(record), "TSB_ELE108_R1 / NHTSA 11011945");
  assert.equal(buildNhtsaBulletinUrl(record), "https://static.nhtsa.gov/odi/tsbs/2024/MC-11011945-0001.pdf");
});

test("resolveCatalogVehicle prefers US catalog rows for NHTSA Kia models", () => {
  const sorento = resolveCatalogVehicle(mergeTsbRecords(null, parseTsbLine(WARRANTY_EXTENSION_LINE)));
  assert.equal(sorento.vehicle_brand, "Kia (US)");
  assert.equal(sorento.vehicle_model, "Sorento (2011–2020)");

  const forte = resolveCatalogVehicle({
    ...mergeTsbRecords(null, parseTsbLine(SERVICE_BULLETIN_LINE)),
    model: "FORTE",
    model_year: "2024",
  });
  assert.equal(forte.vehicle_brand, "Kia (US)");
  assert.equal(forte.vehicle_model, "Forte (2019–present)");
});

test("resolveCatalogVehicle handles punctuation differences in make names", () => {
  const mercedes = resolveCatalogVehicle(mergeTsbRecords(null, parseTsbLine(MERCEDES_SAMPLE_LINE)));
  assert.equal(mercedes.vehicle_brand, "Mercedes-Benz");
  assert.equal(mercedes.vehicle_model, "GLE V167/C167 (2019–současnost)");
  assert.equal(mercedes.market, "EU");
});

test("resolveCatalogVehicle maps newly added supported brands", () => {
  const porsche = resolveCatalogVehicle(mergeTsbRecords(null, parseTsbLine(PORSCHE_SAMPLE_LINE)));
  assert.equal(porsche.vehicle_brand, "Porsche");
  assert.equal(porsche.vehicle_model, "Macan (2015–2024)");
  assert.equal(porsche.market, "US");

  const porscheTrim = resolveCatalogVehicle(mergeTsbRecords(null, parseTsbLine(PORSCHE_TRIM_SAMPLE_LINE)));
  assert.equal(porscheTrim.vehicle_brand, "Porsche");
  assert.equal(porscheTrim.vehicle_model, "718 Boxster / Cayman (2017–present)");
});

test("resolveCatalogVehicle maps Volkswagen Arteon to US catalog", () => {
  const arteon = resolveCatalogVehicle({
    ...mergeTsbRecords(null, parseTsbLine(SERVICE_BULLETIN_LINE)),
    make: "VOLKSWAGEN",
    model: "ARTEON",
    model_year: "2022",
  });
  assert.equal(arteon.vehicle_brand, "Volkswagen (US)");
  assert.equal(arteon.vehicle_model, "Arteon (2019–2023)");
  assert.equal(arteon.market, "US");
});

test("resolveCatalogVehicle maps Kia Niro to US catalog", () => {
  const niro = resolveCatalogVehicle({
    ...mergeTsbRecords(null, parseTsbLine(SERVICE_BULLETIN_LINE)),
    make: "KIA",
    model: "NIRO",
    model_year: "2024",
  });
  assert.equal(niro.vehicle_brand, "Kia (US)");
  assert.equal(niro.vehicle_model, "Niro (2023–present)");
  assert.equal(niro.market, "US");
});

test("resolveCatalogVehicle maps Ford Mustang Mach-E to US catalog", () => {
  const machE = resolveCatalogVehicle({
    ...mergeTsbRecords(null, parseTsbLine(SERVICE_BULLETIN_LINE)),
    make: "FORD",
    model: "MUSTANG MACH E",
    model_year: "2025",
  });
  assert.equal(machE.vehicle_brand, "Ford (US)");
  assert.equal(machE.vehicle_model, "Mustang Mach-E (2021–present)");
  assert.equal(machE.market, "US");
});

test("resolveCatalogVehicle maps Ford E-Transit to US catalog", () => {
  const eTransit = resolveCatalogVehicle({
    ...mergeTsbRecords(null, parseTsbLine(SERVICE_BULLETIN_LINE)),
    make: "FORD",
    model: "E-TRANSIT",
    model_year: "2025",
  });
  assert.equal(eTransit.vehicle_brand, "Ford (US)");
  assert.equal(eTransit.vehicle_model, "E-Transit (2022–present)");
  assert.equal(eTransit.market, "US");
});

test("resolveCatalogVehicle maps Tesla Model Y to US catalog", () => {
  const modelY = resolveCatalogVehicle({
    ...mergeTsbRecords(null, parseTsbLine(SERVICE_BULLETIN_LINE)),
    make: "TESLA",
    model: "MODEL Y",
    model_year: "2026",
  });
  assert.equal(modelY.vehicle_brand, "Tesla (US)");
  assert.equal(modelY.vehicle_model, "Model Y Juniper (2025–present)");
  assert.equal(modelY.market, "US");
});

test("resolveCatalogVehicle maps Lexus TX Hybrid to US catalog", () => {
  const txHybrid = resolveCatalogVehicle({
    ...mergeTsbRecords(null, parseTsbLine(SERVICE_BULLETIN_LINE)),
    make: "LEXUS",
    model: "TX HYBRID",
    model_year: "2024",
  });
  assert.equal(txHybrid.vehicle_brand, "Lexus");
  assert.equal(txHybrid.vehicle_model, "TX 350/500h/550h+ (2024–present)");
  assert.equal(txHybrid.market, "US");
});

test("hasSupportedCatalogBrand filters unsupported and non-catalog makes", () => {
  assert.equal(hasSupportedCatalogBrand("KIA"), true);
  assert.equal(hasSupportedCatalogBrand("MERCEDES-BENZ"), true);
  assert.equal(hasSupportedCatalogBrand("PORSCHE"), true);
  assert.equal(hasSupportedCatalogBrand("LAND ROVER"), true);
  assert.equal(hasSupportedCatalogBrand("JAGUAR"), true);
  assert.equal(hasSupportedCatalogBrand("MITSUBISHI"), true);
  assert.equal(hasSupportedCatalogBrand("ALFA ROMEO"), true);
  assert.equal(hasSupportedCatalogBrand("BENTLEY"), true);
  assert.equal(hasSupportedCatalogBrand("MASERATI"), true);
  assert.equal(hasSupportedCatalogBrand("POLESTAR"), true);
  assert.equal(hasSupportedCatalogBrand("MINI"), true);
  assert.equal(hasSupportedCatalogBrand("RIVIAN"), true);
  assert.equal(hasSupportedCatalogBrand("LUCID"), true);
  assert.equal(hasSupportedCatalogBrand("HARLEY-DAVIDSON"), false);
  assert.equal(hasSupportedCatalogBrand("SEAT COVER UNLIMITED"), false);
});

test("finalizeStageForSeed downgrades unresolved ready candidates to review", () => {
  const classification = {
    stage: "ready",
    reason: "Ready",
    extracted: extractSeedParts(mergeTsbRecords(null, parseTsbLine(SERVICE_BULLETIN_LINE))),
  };
  const unresolvedSeed = {
    metadata: {
      catalog_mapping: {
        resolved: false,
      },
    },
  };
  const finalStage = finalizeStageForSeed(classification, unresolvedSeed);
  assert.equal(finalStage.stage, "to_review");
  assert.match(finalStage.reason, /could not be mapped to the app catalog/i);
});

test("collapseSeedEntries deduplicates canonical seeds after catalog mapping", () => {
  const baseRecord = mergeTsbRecords(null, parseTsbLine(LINCOLN_LONGFORM_LINE));
  const a = {
    ...baseRecord,
    model_year: "2021",
  };
  const b = {
    ...baseRecord,
    model_year: "2026",
  };
  const extracted = {
    description: "Fuel door will not open with DTC P04CA caused by an open circuit on SBB05 or a damaged splice S133.",
    resolution: "Inspect circuit SBB05 and splice S133 for damage and repair the circuit as needed.",
    symptoms: ["Fuel door will not open with DTC P04CA caused by an open circuit on SBB05 or a damaged splice S133."],
    obd_codes: ["P04CA"],
  };
  const entryA = {
    stage: "ready",
    seed: buildSeedRecord(a, extracted, "ai_importer", "pattern_lincoln"),
    record: a,
    classification: { stage: "ready", reason: "Ready", extracted },
  };
  const entryB = {
    stage: "ready",
    seed: buildSeedRecord(b, extracted, "ai_importer", "pattern_lincoln"),
    record: b,
    classification: { stage: "ready", reason: "Ready", extracted },
  };

  const collapsed = collapseSeedEntries([entryA, entryB]);
  assert.equal(collapsed.length, 1);
  assert.deepEqual(collapsed[0].seed.metadata.model_years, ["2021", "2026"]);
  assert.equal(collapsed[0].seed.metadata.source_variant_count, 2);
  assert.equal(collapsed[0].seed.metadata.model_year, "2026");
});

test("collapseSeedEntries prefers latest revision source_ref and merges source refs", () => {
  const baseRecord = {
    nhtsa_id: "11018862",
    replacement_bulletin: "",
    date_added: "20250501",
    tsb_id: "09-013-25",
    mfr_comm_date: "20250430",
    mfr_internal_campaign: "",
    communication_type: "Service Bulletin / Repair Instructions",
    make: "ALFA ROMEO",
    model: "STELVIO",
    model_year: "2024",
    nhtsa_components: ["ENGINE"],
    mfr_component_system: ["ENGINE"],
    mfr_component_subsystem: ["TIMING COVER"],
    summary: "Oil leaking from the timing cover. Replace the timing cover sealant.",
  };
  const revRecord = {
    ...baseRecord,
    nhtsa_id: "11019431",
    tsb_id: "09-013-25 REV. B",
  };
  const extracted = {
    description: "Oil leaking from the timing cover.",
    resolution: "Replace the timing cover sealant.",
    symptoms: ["Oil leaking from the timing cover."],
    obd_codes: [],
  };
  const collapsed = collapseSeedEntries([
    { stage: "ready", seed: buildSeedRecord(baseRecord, extracted) },
    { stage: "ready", seed: buildSeedRecord(revRecord, extracted) },
  ]);
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0].seed.source_ref, "09-013-25 REV. B / NHTSA 11019431");
  assert.deepEqual(collapsed[0].seed.metadata.source_refs, [
    "09-013-25 / NHTSA 11018862",
    "09-013-25 REV. B / NHTSA 11019431",
  ]);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
