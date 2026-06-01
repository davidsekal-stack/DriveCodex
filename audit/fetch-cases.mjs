// Pulls all gearbrain_cases rows via Supabase REST (service key) and writes audit/cases.json
import fs from "node:fs";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://nmvjthfezyjcwuzphiuu.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!KEY) { console.error("Missing SUPABASE_SERVICE_KEY"); process.exit(1); }

const BASE = `${SUPABASE_URL}/rest/v1/gearbrain_cases`;
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const PAGE = 1000;
let all = [];
for (let from = 0; ; from += PAGE) {
  const to = from + PAGE - 1;
  const url = `${BASE}?select=*&order=created_at.asc`;
  const res = await fetch(url, { headers: { ...headers, Range: `${from}-${to}`, "Range-Unit": "items" } });
  if (!res.ok) { console.error("HTTP", res.status, await res.text()); process.exit(1); }
  const rows = await res.json();
  all = all.concat(rows);
  process.stderr.write(`fetched ${all.length}\r`);
  if (rows.length < PAGE) break;
}
process.stderr.write("\n");

fs.writeFileSync("audit/cases.json", JSON.stringify(all));
console.log("TOTAL ROWS:", all.length);
console.log("\nCOLUMNS:", Object.keys(all[0] || {}).join(", "));

const by = (key) => {
  const m = {};
  for (const r of all) { const k = r[key] ?? "(null)"; m[k] = (m[k] || 0) + 1; }
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
};

console.log("\nBY status:");
for (const [k, n] of by("status")) console.log(`  ${String(k).padEnd(12)} ${n}`);

// forum-ish columns
for (const col of ["forum", "source", "source_ref"]) {
  if (all[0] && col in all[0]) {
    const top = by(col).slice(0, 40);
    console.log(`\nBY ${col} (top 40 of ${by(col).length}):`);
    for (const [k, n] of top) console.log(`  ${String(k).slice(0,50).padEnd(52)} ${n}`);
  }
}
