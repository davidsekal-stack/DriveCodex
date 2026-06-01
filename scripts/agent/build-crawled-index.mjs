#!/usr/bin/env node
/**
 * build-crawled-index.mjs — Build the authoritative "already extracted" index
 * from the production gearbrain_cases table, so no crawler re-extracts the same
 * forum thread / subforum / NHTSA bulletin.
 *
 * The DB is the single source of truth (it can't drift). This snapshots it into
 * scripts/agent/crawled-index.json, which crawlers load via crawled-index.mjs.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... node scripts/agent/build-crawled-index.mjs
 *   (SUPABASE_URL defaults to the project URL)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalizeThreadUrl } from "./url-utils.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://nmvjthfezyjcwuzphiuu.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
if (!KEY) { console.error("Missing SUPABASE_SERVICE_KEY / SUPABASE_ANON_KEY"); process.exit(1); }

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "crawled-index.json");

const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return null; } };
const subforumOf = (u) => {
  try {
    const url = new URL(u);
    const f = url.searchParams.get("f");
    if (f) return `?f=${f}`;
    return "/" + url.pathname.split("/").filter(Boolean).slice(0, 2).join("/");
  } catch { return null; }
};
// NHTSA ODI id: from .../MC-11026660-0001.pdf  or  "... / NHTSA 11026660"
const nhtsaOdiOf = (r) => {
  const m1 = (r.thread_url || "").match(/(?:MC-|odi\/tsbs\/\d+\/[A-Z]*-?)(\d{6,})/i);
  if (m1) return m1[1];
  const m2 = (r.source_ref || "").match(/NHTSA\s*(\d{6,})/i);
  return m2 ? m2[1] : null;
};
const isNhtsa = (r) => /static\.nhtsa\.gov/i.test(r.thread_url || "") || /NHTSA\s*\d{6,}/i.test(r.source_ref || "");

async function fetchAll() {
  const base = `${SUPABASE_URL}/rest/v1/gearbrain_cases?select=thread_url,source_ref&order=created_at.asc`;
  const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };
  let all = [], from = 0, PAGE = 1000;
  for (;;) {
    const res = await fetch(base, { headers: { ...headers, Range: `${from}-${from + PAGE - 1}` } });
    if (!res.ok) { console.error("HTTP", res.status, await res.text()); process.exit(1); }
    const rows = await res.json();
    all = all.concat(rows);
    process.stderr.write(`fetched ${all.length}\r`);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  process.stderr.write("\n");
  return all;
}

const rows = await fetchAll();

const threadUrls = new Set();
const nhtsaOdi = new Set();
const forums = {};            // host -> { subforums:{key:count}, threadCount }
let noSource = 0;

for (const r of rows) {
  if (isNhtsa(r)) {
    const odi = nhtsaOdiOf(r);
    if (odi) nhtsaOdi.add(odi); else noSource++;
    continue;
  }
  if (r.thread_url && /^https?:\/\//.test(r.thread_url)) {
    const canon = canonicalizeThreadUrl(r.thread_url);
    threadUrls.add(canon);
    const h = hostOf(canon) || "(unparseable)";
    const sf = subforumOf(canon) || "(root)";
    (forums[h] ||= { subforums: {}, threadCount: 0 });
    forums[h].subforums[sf] = (forums[h].subforums[sf] || 0) + 1;
    continue;
  }
  noSource++;
}
for (const h of Object.keys(forums)) {
  forums[h].threadCount = [...threadUrls].filter((u) => hostOf(u) === h).length;
}

const index = {
  generatedAt: new Date().toISOString(),
  totalCases: rows.length,
  counts: {
    forumThreadUrls: threadUrls.size,
    nhtsaBulletins: nhtsaOdi.size,
    noSourceUnindexable: noSource,
  },
  forums,
  nhtsaOdi: [...nhtsaOdi].sort(),
  threadUrls: [...threadUrls].sort(),
};

fs.writeFileSync(OUT, JSON.stringify(index, null, 1));
console.log(`Wrote ${OUT}`);
console.log(`  forum thread URLs : ${threadUrls.size}`);
console.log(`  NHTSA bulletins   : ${nhtsaOdi.size}`);
console.log(`  no-source (unindexable, cannot dedupe by URL): ${noSource}`);
console.log("  forums/subforums:");
for (const [h, f] of Object.entries(forums)) {
  const subs = Object.entries(f.subforums).map(([k, n]) => `${k}:${n}`).join("  ");
  console.log(`    ${h.padEnd(20)} ${f.threadCount} threads · ${subs}`);
}
