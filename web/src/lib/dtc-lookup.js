/**
 * DTC code lookup — queries gearbrain_dtc_codes table for
 * manufacturer-specific + generic fault code descriptions.
 */

import { supabase } from "./supabase.js";

// Brand → brand_group mapping (VAG covers VW, Škoda, Audi, Seat, Cupra)
const BRAND_GROUP_MAP = {
  Volkswagen: "VAG", VW: "VAG", Škoda: "VAG", Skoda: "VAG",
  Audi: "VAG", Seat: "VAG", SEAT: "VAG", Cupra: "VAG",
  BMW: "BMW", MINI: "BMW", Mini: "BMW",
  "Mercedes-Benz": "MB", Mercedes: "MB", Smart: "MB",
};

export function getBrandGroup(brand) {
  return BRAND_GROUP_MAP[brand] ?? null;
}

/**
 * Lookup DTC codes from the database.
 * Returns brand-specific description if available, otherwise generic.
 *
 * @param {string[]} codes - Array of DTC codes (e.g. ["P0171", "P2015"])
 * @param {string|null} brandGroup - Brand group (e.g. "VAG") or null
 * @returns {Promise<Map<string, {description, system, common_causes, severity}>>}
 */
export async function lookupDtcCodes(codes, brandGroup) {
  if (!codes?.length) return new Map();

  const { data, error } = await supabase.rpc("lookup_dtc_codes", {
    codes,
    p_brand_group: brandGroup,
  });

  if (error || !data) return new Map();

  const map = new Map();
  for (const row of data) {
    map.set(row.code, {
      description: row.description,
      system: row.system,
      common_causes: row.common_causes,
      severity: row.severity,
      brand_specific: row.brand_group != null,
    });
  }
  return map;
}

/**
 * Format DTC lookup results as a block for the AI prompt.
 * Gives the AI context about what each code means.
 */
export function formatDtcBlock(dtcMap, lang) {
  if (!dtcMap?.size) return "";

  const title = {
    cs: "ZNÁMÉ DTC KÓDY Z DATABÁZE",
    en: "KNOWN DTC CODES FROM DATABASE",
    de: "BEKANNTE DTC-CODES AUS DER DATENBANK",
  }[lang] || "KNOWN DTC CODES FROM DATABASE";

  const lines = [];
  for (const [code, info] of dtcMap) {
    const tag = info.brand_specific ? " [OEM]" : "";
    const sev = info.severity === "critical" ? " ⚠️" : "";
    let line = `  ${code}${tag}${sev}: ${info.description}`;
    if (info.system) line += ` [${info.system}]`;
    if (info.common_causes) line += `\n    Typical causes: ${info.common_causes.replaceAll(";", ", ")}`;
    lines.push(line);
  }

  return `\n\n${title}:\n${lines.join("\n")}`;
}
