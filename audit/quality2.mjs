import fs from "node:fs";
const cases = JSON.parse(fs.readFileSync("audit/cases.json","utf8"));
const hostOf=(u)=>{try{return new URL(u).host.replace(/^www\./,"");}catch{return null;}};
const isNhtsa=(r)=>/static\.nhtsa\.gov/i.test(r.thread_url||"")||/NHTSA\s*\d{6,}/i.test(r.source_ref||"");
const srcType=(r)=> isNhtsa(r)?"NHTSA_TSB": (r.thread_url&&/^https?:/.test(r.thread_url))?("FORUM:"+hostOf(r.thread_url)):"UNKNOWN(no-source)";

const fixVerb=/\b(replac|repair|fix|clean|flush|renew|install|chang|adjust|tighten|bleed|reset|reflash|updat|solv|swap|refit|reconnect|seal|weld|topp?ed up|relearn|recalibrat)/i;
const csFix=/\b(vyměn|oprav|čišt|propláchl|utáh|seříz|nov[ýáé]|odpoj|zapoj|dotáh|vyčist|opravil|namont)/i;
const unresolved=/\b(not (yet )?(solved|resolved|fixed)|unresolved|no solution|still (not|broken)|problém (přetrvává|nevyřešen)|nevyřeš|stále nefunguje)\b/i;

let noFix=0, question=0, unres=0;
const noFixByType={}, examplesNoFix=[];
for(const r of cases){
  const res=(r.resolution||"").trim(); const t=srcType(r);
  const hasFix = fixVerb.test(res)||csFix.test(res);
  if(!hasFix){ noFix++; noFixByType[t]=(noFixByType[t]||0)+1; if(examplesNoFix.length<15) examplesNoFix.push({t,brand:r.vehicle_brand,res:res.slice(0,120)}); }
  if(/\?\s*$/.test(res)||/^(jak |proč |does anyone|anyone know|how do)/i.test(res)) question++;
  if(unresolved.test(res)) unres++;
}
console.log("TOTAL:",cases.length);
console.log("resolutions WITHOUT a clear fix/action verb:",noFix,`(${(100*noFix/cases.length).toFixed(1)}%)`);
console.log("  by source type:"); for(const [t,n] of Object.entries(noFixByType).sort((a,b)=>b[1]-a[1])) console.log("   ",t.padEnd(24),n);
console.log("resolutions that look like a QUESTION:",question);
console.log("resolutions saying NOT resolved:",unres);
console.log("\nExamples of 'no clear fix verb' (may be false positives — outcome-style wording):");
for(const e of examplesNoFix) console.log(`  [${e.t}] ${e.brand}: "${e.res}"`);
