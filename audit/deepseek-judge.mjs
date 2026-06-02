// Semantic "does this case make sense?" judge over a stratified sample, via DeepSeek.
import fs from "node:fs";
const KEY = process.env.DEEPSEEK_API_KEY;
if (!KEY) { console.error("Missing DEEPSEEK_API_KEY"); process.exit(1); }
const cases = JSON.parse(fs.readFileSync("audit/cases.json", "utf8"));
const host = u => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return null; } };
const isNhtsa = r => /static\.nhtsa\.gov/i.test(r.thread_url||"") || /NHTSA\s*\d{6,}/i.test(r.source_ref||"");
const type = r => isNhtsa(r) ? "NHTSA" : (r.thread_url ? "FORUM:"+host(r.thread_url) : "UNKNOWN");

// deterministic stratified sample
function pick(arr, n) { const out=[]; let s=98765; const seen=new Set();
  while(out.length<n && seen.size<arr.length){ s=(s*1103515245+12345)&0x7fffffff; const i=s%arr.length; if(!seen.has(i)){seen.add(i);out.push(arr[i]);}} return out; }
const strata = { NHTSA:[], "FORUM:fordtransit.org":[], "FORUM:skoda-club.net":[], UNKNOWN:[] };
for (const r of cases) { const t=type(r); if (strata[t]) strata[t].push(r); }
const sample = [
  ...pick(strata.NHTSA, 30),
  ...pick(strata["FORUM:fordtransit.org"], 30),
  ...pick(strata["FORUM:skoda-club.net"], 30),
  ...pick(strata.UNKNOWN, 30),
];
console.error(`judging ${sample.length} cases…`);

async function judge(batch) {
  const items = batch.map((r,i)=>({ n:i,
    vehicle:`${r.vehicle_brand} ${r.vehicle_model}`,
    symptoms:r.symptoms, description:(r.description||"").slice(0,300), resolution:(r.resolution||"").slice(0,300) }));
  const prompt = `You are auditing an automotive diagnostic knowledge base. For each case decide if it MAKES SENSE: i.e., the resolution is a plausible, coherent fix or root-cause for the stated symptoms/description, the vehicle is real, and nothing is contradictory or garbled. A short root-cause statement ("it was the X") counts as sensible. Return ONLY a JSON array, one object per case: {"n":<n>,"ok":true|false,"issue":"<short reason if not ok, else empty>"}.\nCASES:\n${JSON.stringify(items)}`;
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${KEY}` },
    body: JSON.stringify({ model:"deepseek-chat", temperature:0, max_tokens:1500,
      messages:[{role:"user", content:prompt}] }) });
  if (!res.ok) { console.error("HTTP", res.status, (await res.text()).slice(0,150)); return []; }
  const txt = (await res.json()).choices?.[0]?.message?.content || "";
  const m = txt.match(/\[[\s\S]*\]/); if (!m) return [];
  try { return JSON.parse(m[0]); } catch { return []; }
}

const results = [];
for (let i=0; i<sample.length; i+=10) {
  const batch = sample.slice(i, i+10);
  const verdicts = await judge(batch);
  for (const v of verdicts) { const r = batch[v.n]; if (r) results.push({ id:r.id, type:type(r), ok:v.ok, issue:v.issue, vehicle:`${r.vehicle_brand} ${r.vehicle_model}`, resolution:(r.resolution||"").slice(0,90) }); }
  process.stderr.write(`  judged ${results.length}\r`);
}
process.stderr.write("\n");
const ok = results.filter(r=>r.ok).length;
console.log(`\nJUDGED: ${results.length}`);
console.log(`MAKE SENSE: ${ok} (${(100*ok/results.length).toFixed(1)}%)`);
console.log(`FLAGGED NOT-OK: ${results.length-ok}`);
for (const r of results.filter(r=>!r.ok)) console.log(`  [${r.type}] ${r.vehicle} — ${r.issue}\n     resn: "${r.resolution}"`);
fs.writeFileSync("audit/judge-results.json", JSON.stringify(results,null,1));
