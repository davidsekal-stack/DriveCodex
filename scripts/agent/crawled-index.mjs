/**
 * crawled-index.mjs — Load the "already extracted" index and check membership,
 * so crawlers skip forum threads / NHTSA bulletins that are already in the DB.
 *
 * Source of truth is gearbrain_cases; refresh the snapshot with:
 *   node scripts/agent/build-crawled-index.mjs
 *
 * Usage in a crawler:
 *   import { loadCrawledIndex, isThreadAlreadyExtracted, isNhtsaDone } from './crawled-index.mjs';
 *   const idx = loadCrawledIndex();
 *   if (isThreadAlreadyExtracted(threadUrl, idx)) continue;   // skip
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalizeThreadUrl } from "./url-utils.mjs";

const INDEX_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "crawled-index.json");

export function loadCrawledIndex(file = INDEX_PATH) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { raw = { threadUrls: [], nhtsaOdi: [], forums: {}, totalCases: 0 }; }
  return {
    ...raw,
    _threadSet: new Set(raw.threadUrls || []),
    _nhtsaSet: new Set((raw.nhtsaOdi || []).map(String)),
  };
}

export function isThreadAlreadyExtracted(url, index) {
  if (!url || !index?._threadSet) return false;
  return index._threadSet.has(canonicalizeThreadUrl(url));
}

const odiFromString = (s) => {
  const str = (s || "").toString().trim();
  // Whole string is exactly an ODI id (e.g. "11026660").
  if (/^\d{6,}$/.test(str)) return str;
  // Otherwise only extract from a genuine NHTSA context (mirrors build-side nhtsaOdiOf),
  // so a stray digit-run from a forum URL (e.g. viewtopic?t=172092) is never read as an ODI id.
  const m = str.match(/(?:MC-|odi\/tsbs\/\d+\/[A-Za-z]*-?|NHTSA\s*)(\d{6,})/i);
  return m ? m[1] : null;
};
export function isNhtsaDone(idOrUrl, index) {
  const odi = odiFromString(idOrUrl);
  return !!(odi && index?._nhtsaSet?.has(odi));
}

/** Filter a list of thread URLs down to the ones NOT yet extracted. */
export function filterNewThreadUrls(urls, index) {
  return (urls || []).filter((u) => !isThreadAlreadyExtracted(u, index));
}
