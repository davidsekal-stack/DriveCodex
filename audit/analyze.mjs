import fs from "node:fs";
const cases = JSON.parse(fs.readFileSync("audit/cases.json", "utf8"));

const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return null; } };
const sub = (u) => {
  try { const x=new URL(u); const f=x.searchParams.get("f");
    if (f) return `${hostOf(u)} ?f=${f}`;
    return `${hostOf(u)}/${x.pathname.split("/").filter(Boolean).slice(0,2).join("/")}`;
  } catch { return null; }
};
const isNhtsa = (r) => /static\.nhtsa\.gov/i.test(r.thread_url||"") || /NHTSA\s*\d{6,}/i.test(r.source_ref||"");

// classify
function srcType(r){
  if (isNhtsa(r)) return "NHTSA_TSB";
  if (r.thread_url && /^https?:/.test(r.thread_url)) return "FORUM:"+hostOf(r.thread_url);
  return "UNKNOWN";
}
const typeCount={}, forumSub={}, brandByForum={};
for(const r of cases){ const t=srcType(r); typeCount[t]=(typeCount[t]||0)+1;
  if(t.startsWith("FORUM:")){ const s=sub(r.thread_url)||t; forumSub[s]=(forumSub[s]||0)+1;
    (brandByForum[t]||={}); const b=(r.vehicle_brand||"(none)").trim(); brandByForum[t][b]=(brandByForum[t][b]||0)+1; }
}
console.log("=== CLEAN SOURCE CLASSIFICATION ===");
for(const [t,n] of Object.entries(typeCount).sort((a,b)=>b[1]-a[1])) console.log(`  ${t.padEnd(26)} ${n}`);

console.log("\n=== UNKNOWN bucket: 8 samples ===");
const unknown = cases.filter(r=>srcType(r)==="UNKNOWN");
for(const r of unknown.slice(0,8)) console.log(`  brand=${r.vehicle_brand} model=${r.vehicle_model} src_ref=${JSON.stringify(r.source_ref)} thread=${JSON.stringify(r.thread_url)}\n     resn="${String(r.resolution||"").slice(0,80)}"`);
// what brands dominate unknown?
const ub={}; for(const r of unknown){const b=(r.vehicle_brand||"(none)");ub[b]=(ub[b]||0)+1;}
console.log("  UNKNOWN brands:", Object.entries(ub).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([b,n])=>`${b}:${n}`).join("  "));

// ---- QUALITY AUDIT ----
const obdRe=/^[PBCU][0-9][0-9A-F]{3}$/i;
const expectBrand={ "fordtransit.org":/ford/i, "skoda-club.net":/škoda|skoda/i, "kia-club.org":/kia/i, "club-fiat.com":/fiat/i };
const flags={};
const tag=(r,f)=>{ (flags[f]||=[]).push(r.id); };
const norm=s=>(s||"").toString().toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
for(const r of cases){
  const sym = Array.isArray(r.symptoms)?r.symptoms:(r.symptoms?[r.symptoms]:[]);
  const desc=(r.description||"").trim(), res=(r.resolution||"").trim();
  if(!(r.vehicle_brand||"").trim()) tag(r,"no_brand");
  if(!(r.vehicle_model||"").trim()) tag(r,"no_model");
  if(sym.length===0 && !desc) tag(r,"no_problem_stated");
  if(!res) tag(r,"no_resolution");
  else if(res.length<10) tag(r,"resolution_too_short");
  else if(res.length>400) tag(r,"resolution_too_long");
  if(res && desc && norm(res)===norm(desc)) tag(r,"resolution_equals_description");
  if(res && /\b(viz výše|see above|n\/a|none|unknown|nevím|tbd|xxx)\b/i.test(res) && res.length<25) tag(r,"resolution_filler");
  const obd=Array.isArray(r.obd_codes)?r.obd_codes:(r.obd_codes?[r.obd_codes]:[]);
  for(const c of obd){ if(c && !obdRe.test(String(c).trim())) { tag(r,"obd_malformed"); break; } }
  const h=hostOf(r.thread_url||"");
  if(h && expectBrand[h] && r.vehicle_brand && !expectBrand[h].test(r.vehicle_brand)) tag(r,"brand_forum_mismatch");
}
// duplicates: same thread_url + near-identical resolution
const seen={}; let dup=0;
for(const r of cases){ if(!r.thread_url) continue; const k=r.thread_url+"|"+norm(r.resolution).slice(0,60);
  if(seen[k]) { dup++; } else seen[k]=1; }

console.log("\n=== QUALITY FLAGS (count of cases) ===");
for(const [f,ids] of Object.entries(flags).sort((a,b)=>b[1].length-a[1].length)) console.log(`  ${f.padEnd(30)} ${ids.length}`);
console.log(`  ${"exact_dup(thread+resolution)".padEnd(30)} ${dup}`);

const flaggedIds = new Set(Object.values(flags).flat());
console.log(`\nTOTAL distinct cases with >=1 flag: ${flaggedIds.size} / ${cases.length} (${(100*flaggedIds.size/cases.length).toFixed(1)}%)`);
fs.writeFileSync("audit/flags.json", JSON.stringify({flags, total:cases.length}, null, 0));
