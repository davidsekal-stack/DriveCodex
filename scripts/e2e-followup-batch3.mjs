/**
 * E2E test — hybrid follow-up, DÁVKA 3: 8 ZÁLUDNÝCH / hraničních případů.
 *
 * Reaguje na zpětnou vazbu QA kritika: předchozí dávky obsahovaly jen
 * jednoznačné vstupy (čistě dotaz NEBO čistě zjištění). Tady cíleně testuju
 * tvrdé hrany detektoru režimu: dotaz+zjištění v jedné zprávě, vágní „co teď",
 * změnu tématu, emoční zprávu bez dotazu, nesouhlas bez důkazu, zjištění
 * formulované jako otázku, opravu údaje + opravu, a poděkování.
 *
 * Spuštění:  node scripts/e2e-followup-batch3.mjs [id...]
 * Výstup:    scripts/e2e-followup-results-batch3.json
 */

import { writeFileSync } from "node:fs";
import { executeDiagnosis } from "../web/src/lib/run-diagnosis.js";
import { translate } from "../web/src/i18n/translate.js";
import { RUNTIME_CONFIG } from "../web/src/lib/runtime-config.js";

const EDGE = RUNTIME_CONFIG.edgeFunctionsUrl;
const ANON = RUNTIME_CONFIG.supabaseAnonKey;
const MODEL = "deepseek-v4-pro";
const USER_ID = "e2e-batch3";
const CALL_TIMEOUT_MS = 240_000;
const CONCURRENCY = 6;

const trFor = (lang) => (key, params) => translate(key, params, lang || "cs");

let capture = {};
async function callAI({ systemPrompt, userMessage, maxTokens }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await fetch(`${EDGE}/deepseek-proxy`, {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}`, apikey: ANON },
      body: JSON.stringify({ model: MODEL, system: systemPrompt, messages: [{ role: "user", content: userMessage }], max_tokens: maxTokens, user_id: USER_ID }),
    });
    const data = await res.json();
    capture.raw = data?.content?.map((b) => b.text ?? "").join("") ?? null;
    return data;
  } finally { clearTimeout(timer); }
}
async function searchCases() { return { cases: [], ok: true }; }

function diag(shrnuti, f) {
  return { id: "dg0", type: "diagnosis", timestamp: "2026-06-16T10:00:05.000Z", ragMatchIds: [], tokensUsed: 0,
    result: { shrnutí: shrnuti, závady: f.map(([n, p, popis, nal]) => ({ název: n, pravděpodobnost: p, popis, naléhavost: nal || "střední", zdroj: "ai", početShod: 0 })), doporučené_testy: [], varování: null, další_info: null } };
}
function inp(text) { return { id: "in0", type: "input", symptoms: [], obdCodes: [], text, timestamp: "2026-06-16T10:00:00.000Z" }; }

const DIESEL_V = { brand: "Ford", model: "Transit 2.2 TDCi", enginePower: "103 kW", mileage: "210000" };
const DIESEL_PRIOR = diag("Ford Transit 2.2 TDCi – bílý kouř, ztráta výkonu, koktání na 2. válci.", [
  ["Vadný vstřikovač (válec 2)", 65, "Nedovřený vstřikovač, bílý kouř, ředění oleje.", "vysoká"],
  ["Prasklé těsnění hlavy válců", 60, "Vnik kapaliny do spalování, bílý kouř.", "vysoká"],
  ["Poškození pístu/kroužků (válec 2)", 45, "Ztráta komprese, prohoření oleje.", "kritická"]]);

const TURBO_V = { brand: "BMW", model: "320d E90", enginePower: "120 kW", mileage: "215000" };
const TURBO_PRIOR = diag("BMW 320d – ztráta výkonu, nouzový režim, P0299 (podtlak turba).", [
  ["Vadná geometrie turba (VNT)", 60, "Zaseklé lopatky, nízký tlak.", "vysoká"],
  ["Netěsnost přeplňování", 50, "Únik tlaku.", "střední"],
  ["Vadný MAP snímač", 30, "Špatné měření.", "nízká"]]);

const EGR_V = { brand: "Volkswagen", model: "Passat B8 2.0 TDI", enginePower: "110 kW", mileage: "180000" };
const EGR_PRIOR = diag("VW Passat 2.0 TDI – trhání, kontrolka motoru, P0401 (nízký průtok EGR).", [
  ["Zanesený EGR ventil", 80, "Karbon blokuje EGR, nízký průtok.", "střední"],
  ["Ucpaný DPF filtr", 50, "Vyšší protitlak.", "střední"],
  ["Vadný snímač MAF", 35, "Nepřesné měření vzduchu.", "nízká"]]);

const S = [
  { id: 1, lang: "cs", title: "Záludné — dotaz + nové zjištění v jedné zprávě",
    vehicle: DIESEL_V, prior: DIESEL_PRIOR, priorInput: inp("Transit 2.2 TDCi, bílý kouř, ztráta výkonu, koktá."),
    followup: "Změřil jsem kompresi a na 2. válci je výrazně nižší než na ostatních. Znamená to, že musím dolů s hlavou? A jak se vlastně dělá leak-down test?",
    expectedMode: "diagnóza", expect: "Pravidlo: je tu NOVÉ ZJIŠTĚNÍ (nízká komprese 2. válce) → diagnóza, mechanika/píst/těsnění nahoru; ideálně v popisu/postupu odpoví i na otázku." },

  { id: 2, lang: "cs", title: "Záludné — vágní 'co teď'",
    vehicle: DIESEL_V, prior: DIESEL_PRIOR, priorInput: inp("Transit 2.2 TDCi, bílý kouř, ztráta výkonu."),
    followup: "Tak dobře. A co mám teď udělat jako úplně první?",
    expectedMode: "odpověď", expect: "Žádné nové zjištění, jen dotaz na další postup → odpověď (poradí první krok, např. leak-off/kompresní test); ne nové karty." },

  { id: 3, lang: "cs", title: "Záludné — změna tématu (stále auto)",
    vehicle: DIESEL_V, prior: DIESEL_PRIOR, priorInput: inp("Transit 2.2 TDCi, bílý kouř, ztráta výkonu."),
    followup: "Mimochodem, po kolika kilometrech se u tohohle motoru má měnit rozvodový řemen?",
    expectedMode: "odpověď", expect: "Dotaz nesouvisí s aktuální závadou, ale je to dotaz → odpověď; nemá generovat novou diagnózu. (Pozor na vymýšlení konkrétního intervalu z paměti – ideálně odkáže na servisní plán.)" },

  { id: 4, lang: "cs", title: "Záludné — emoce bez dotazu i zjištění",
    vehicle: DIESEL_V, prior: DIESEL_PRIOR, priorInput: inp("Transit 2.2 TDCi, bílý kouř, ztráta výkonu."),
    followup: "Tohle už mě fakt štve, mám strach, že to bude strašně drahé.",
    expectedMode: "odpověď", expect: "Žádné zjištění ani technický dotaz → odpověď (uklidní, nasměruje k dalšímu kroku); NESMÍ vyrobit novou sadu karet." },

  { id: 5, lang: "cs", title: "Záludné — nesouhlas bez důkazu",
    vehicle: TURBO_V, prior: TURBO_PRIOR, priorInput: inp("320d, ztráta výkonu, nouzový režim, P0299."),
    followup: "Mně to přijde jako nesmysl, tyhle motory mají přece vždycky problém s vířivými klapkami v sání, ne s turbem.",
    expectedMode: "odpověď", expect: "Názor/nesouhlas bez nového měření → odpověď (věcně vysvětlí, vířivé klapky zváží jako možnost, navrhne ověření); hraniční, ale očekávám text." },

  { id: 6, lang: "cs", title: "Záludné — zjištění formulované jako otázka",
    vehicle: TURBO_V, prior: TURBO_PRIOR, priorInput: inp("320d, ztráta výkonu, P0299."),
    followup: "Může to dělat to, že jsem našel olej nakapaný v hadici od intercooleru?",
    expectedMode: "diagnóza", expect: "Obsahuje NOVÉ ZJIŠTĚNÍ (olej v intercooleru) → diagnóza; mělo by nahoru posunout vůli/opotřebení turba (těsnění/ložisko turba pouští olej). Hraniční – přijatelná i kvalitní odpověď, pokud zjištění správně využije." },

  { id: 7, lang: "cs", title: "Záludné — oprava údaje + provedená oprava",
    vehicle: EGR_V, prior: EGR_PRIOR, priorInput: inp("Passat 2.0 TDI, trhání, kontrolka, P0401."),
    followup: "Popletl jsem ten kód — není to P0401, ale P0402 (nadměrný průtok EGR). A ventil EGR jsem už vyčistil.",
    expectedMode: "diagnóza", expect: "Oprava údaje + provedená oprava → diagnóza; přehodnotí na nadměrný průtok (zaseklý otevřený EGR / vadné řízení), zohlední že čištění proběhlo." },

  { id: 8, lang: "cs", title: "Záludné — poděkování / zakončení",
    vehicle: DIESEL_V, prior: DIESEL_PRIOR, priorInput: inp("Transit 2.2 TDCi, bílý kouř, ztráta výkonu."),
    followup: "Aha, díky moc za pomoc, to mi hodně pomohlo!",
    expectedMode: "odpověď", expect: "Poděkování bez dotazu/zjištění → odpověď (zdvořilé zakončení, případně nabídka dalších kroků); NESMÍ vyrobit novou diagnózu." },
];

async function runScenario(s) {
  capture = {};
  const tr = trFor(s.lang);
  const currentCase = { id: `b3-${s.id}`, vehicle: s.vehicle, messages: [s.priorInput, s.prior], tokenCount: 0 };
  const inputData = { symptoms: [], obdCodes: [], text: s.followup };
  const started = Date.now();
  try {
    const result = await executeDiagnosis({ currentCase, inputData, callAI, searchCases, tr, lang: s.lang });
    const actualMode = result.diagnosisMsg ? "diagnóza" : result.replyMsg ? "odpověď" : "??";
    return { id: s.id, title: s.title, lang: s.lang, expectedMode: s.expectedMode, actualMode, modeMatch: actualMode === s.expectedMode, expect: s.expect,
      reply: result.replyMsg?.text ?? null,
      faults: result.diagnosisMsg?.result?.závady?.map((f) => ({ název: f.název, pravděpodobnost: f.pravděpodobnost })) ?? null,
      shrnutí: result.diagnosisMsg?.result?.shrnutí ?? null,
      usedTokens: result.usedTokens, elapsedMs: Date.now() - started, error: null, raw: capture.raw };
  } catch (e) {
    return { id: s.id, title: s.title, lang: s.lang, expectedMode: s.expectedMode, actualMode: "ERROR", modeMatch: false, expect: s.expect, reply: null, faults: null, shrnutí: null, usedTokens: 0, elapsedMs: Date.now() - started, error: e.message, raw: capture.raw };
  }
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let idx = 0;
  async function next() {
    while (idx < items.length) {
      const cur = idx++;
      console.log(`  ▶ start #${items[cur].id} — ${items[cur].title}`);
      results[cur] = await worker(items[cur]);
      const r = results[cur];
      console.log(`  ✓ done  #${r.id} — čekáno=${r.expectedMode} / dostal=${r.actualMode} ${r.modeMatch ? "✅" : "❌"} (${(r.elapsedMs / 1000).toFixed(0)}s)`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return results;
}

(async () => {
  const only = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));
  const toRun = only.length ? S.filter((s) => only.includes(s.id)) : S;
  console.log(`\n=== E2E follow-up DÁVKA 3 (záludné hrany) · model=${MODEL} · ${toRun.length} scénářů ===\n`);
  const results = await runPool(toRun, runScenario, CONCURRENCY);
  const passed = results.filter((r) => r.modeMatch).length;
  console.log(`\n=== Shrnutí režimu: ${passed}/${results.length} odpovídá očekávání (hraniční sada — i odchylka je poučná) ===\n`);
  writeFileSync(new URL("./e2e-followup-results-batch3.json", import.meta.url), JSON.stringify({ model: MODEL, ranAt: new Date().toISOString(), results }, null, 2), "utf8");
  console.log("Detailní výsledky uloženy do scripts/e2e-followup-results-batch3.json");
})();
