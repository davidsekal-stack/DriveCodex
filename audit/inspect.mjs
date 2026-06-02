import fs from "node:fs";
const cases = JSON.parse(fs.readFileSync("audit/cases.json","utf8"));
const hostOf=(u)=>{try{return new URL(u).host.replace(/^www\./,"");}catch{return null;}};
const norm=s=>(s||"").toString().toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

// 1. fordtransit thread_url uniqueness
const ft=cases.filter(r=>hostOf(r.thread_url)==="fordtransit.org");
const ftUrls=new Set(ft.map(r=>r.thread_url));
console.log(`fordtransit: ${ft.length} cases across ${ftUrls.size} distinct thread_urls`);
console.log("  sample urls:", [...ftUrls].slice(0,3).join("\n               "));

// 2. duplicate clusters: thread_url -> #cases (top)
const byUrl={}; for(const r of cases){ if(!r.thread_url) continue; (byUrl[r.thread_url]||=[]).push(r); }
const big=Object.entries(byUrl).filter(([,a])=>a.length>1).sort((a,b)=>b[1].length-a[1].length);
console.log(`\nthread_urls reused by >1 case: ${big.length}; top:`);
for(const [u,a] of big.slice(0,6)) console.log(`  ${a.length}x  ${u.slice(0,70)}`);

// 3. obd malformed samples
const obdRe=/^[PBCU][0-9][0-9A-F]{3}$/i;
const bad=[]; for(const r of cases){ const o=Array.isArray(r.obd_codes)?r.obd_codes:(r.obd_codes?[r.obd_codes]:[]); for(const c of o){ if(c&&!obdRe.test(String(c).trim())){bad.push({id:r.id,code:c,brand:r.vehicle_brand}); break;} } }
console.log(`\nobd_malformed samples (of ${bad.length}):`);
for(const b of bad.slice(0,12)) console.log(`  ${JSON.stringify(b.code).padEnd(28)} ${b.brand}`);

// 4. skoda-club samples WITH thread_url (for original cross-check)
const sk=cases.filter(r=>hostOf(r.thread_url)==="skoda-club.net");
console.log(`\n=== skoda-club samples (real per-thread URLs) ===`);
for(const r of sk.slice(0,5)){
  console.log(`\nID ${r.id}`);
  console.log(`  ${r.vehicle_brand} ${r.vehicle_model}  mil=${r.mileage} pwr=${r.engine_power}`);
  console.log(`  symptoms: ${JSON.stringify(r.symptoms)}`);
  console.log(`  obd: ${JSON.stringify(r.obd_codes)}`);
  console.log(`  desc: ${String(r.description||"").slice(0,140)}`);
  console.log(`  RESN: ${String(r.resolution||"").slice(0,200)}`);
  console.log(`  url: ${r.thread_url}`);
}

// 5. random sample of 12 across all for semantic read
function sample(arr,n){const out=[],idx=new Set();let s=12345;while(out.length<n&&out.length<arr.length){s=(s*1103515245+12345)&0x7fffffff;const i=s%arr.length;if(!idx.has(i)){idx.add(i);out.push(arr[i]);}}return out;}
console.log(`\n=== RANDOM 12 (semantic 'makes sense' read) ===`);
for(const r of sample(cases,12)){
  console.log(`\n[${hostOf(r.thread_url)||r.source_ref||"no-src"}] ${r.vehicle_brand} ${r.vehicle_model}`);
  console.log(`  sym=${JSON.stringify(r.symptoms)} obd=${JSON.stringify(r.obd_codes)}`);
  console.log(`  desc: ${String(r.description||"").slice(0,120)}`);
  console.log(`  resn: ${String(r.resolution||"").slice(0,160)}`);
}
