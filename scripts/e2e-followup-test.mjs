/**
 * E2E test — hybrid follow-up režim (odpověď / diagnóza).
 *
 * Volá REÁLNOU edge funkci deepseek-proxy (DeepSeek API) přes anon key z repa
 * a pouští skutečný orchestrátor executeDiagnosis(). RAG (searchCases) je
 * záměrně stubnutý naprázdno, aby byl test deterministický a soustředil se na
 * NOVÉ chování follow-upu — to na obsahu RAG nezávisí (RAG jen přidává kandidáty
 * do promptu úplně stejně jako u první diagnostiky).
 *
 * Spuštění:  node scripts/e2e-followup-test.mjs
 * Výstup:    konzole + scripts/e2e-followup-results.json
 */

import { writeFileSync } from "node:fs";
import { executeDiagnosis } from "../web/src/lib/run-diagnosis.js";
import { translate } from "../web/src/i18n/translate.js";
import { RUNTIME_CONFIG } from "../web/src/lib/runtime-config.js";

const EDGE = RUNTIME_CONFIG.edgeFunctionsUrl;
const ANON = RUNTIME_CONFIG.supabaseAnonKey;
const MODEL = "deepseek-v4-pro"; // = AI_MODEL v produkci
const USER_ID = "e2e-followup-test";
const CALL_TIMEOUT_MS = 240_000;
const CONCURRENCY = 4;

const tr = (key, params) => translate(key, params, "cs");

// ── REÁLNÉ volání DeepSeek přes edge proxy ───────────────────────────────────
let capture = {};
async function callAI({ systemPrompt, userMessage, maxTokens }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await fetch(`${EDGE}/deepseek-proxy`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ANON}`,
        apikey: ANON,
      },
      body: JSON.stringify({
        model: MODEL,
        thinking: { type: "enabled" },
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
        max_tokens: maxTokens,
        user_id: USER_ID,
      }),
    });
    const data = await res.json();
    capture.raw = data?.content?.map((b) => b.text ?? "").join("") ?? null;
    capture.systemPromptLen = systemPrompt.length;
    capture.userMessage = userMessage;
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// RAG stub — naprázdno (viz hlavička)
async function searchCases() {
  return { cases: [], ok: true };
}

// ── Pomocníci pro stavbu předchozího stavu případu ───────────────────────────
function priorInputMsg(text, symptoms = []) {
  return { id: "in0", type: "input", symptoms, obdCodes: [], text, timestamp: "2026-06-16T10:00:00.000Z" };
}
function priorDiagMsg(result) {
  return { id: "dg0", type: "diagnosis", result, ragMatchIds: [], tokensUsed: 0, timestamp: "2026-06-16T10:00:05.000Z" };
}

// Realistická předchozí diagnóza Ford Transit (z reálného screenshotu)
const TRANSIT_VEHICLE = { brand: "Ford", model: "Transit 2.2 TDCi", enginePower: "103 kW", mileage: "210000" };
const TRANSIT_PRIOR = priorDiagMsg({
  shrnutí: "Ford Transit 2012 2.2 TDCI – bílý kouř, ztráta výkonu, koktání, nemožnost restartu, žere olej. Diagnostika ukázala závadu žhavicí svíčky na 2. válci.",
  závady: [
    { název: "Prasklé těsnění hlavy válců", pravděpodobnost: 78, popis: "Netěsnost těsnění hlavy umožňuje vnikání chladicí kapaliny do spalovacího prostoru. Bílý kouř (vodní pára), ztráta výkonu, koktání na 2. válci, hydrolock po vypnutí.", obd_kódy: ["P0302"], naléhavost: "vysoká", zdroj: "ai", početShod: 0 },
    { název: "Vadný vstřikovač (válec 2)", pravděpodobnost: 65, popis: "Zaseknutý nebo nedovřený vstřikovač vstřikuje palivo i mimo správný okamžik, což způsobuje bílý kouř a ředění oleje.", obd_kódy: ["P0202"], naléhavost: "vysoká", zdroj: "ai", početShod: 0 },
    { název: "Poškození pístu nebo pístních kroužků (válec 2)", pravděpodobnost: 55, popis: "Prasklý píst nebo kroužky způsobují ztrátu komprese, prohoření oleje a vynechávání.", obd_kódy: ["P0302"], naléhavost: "kritická", zdroj: "ai", početShod: 0 },
  ],
  doporučené_testy: ["Měření komprese na studeném motoru", "Zkouška těsnosti chladicího okruhu", "Test korekce vstřikovačů"],
  varování: "Nepokoušejte se opakovaně startovat při podezření na hydrolock.",
  další_info: null,
});

// VW Passat — sekundární vozidlo pro pestrost
const PASSAT_VEHICLE = { brand: "Volkswagen", model: "Passat B8 2.0 TDI", enginePower: "110 kW", mileage: "180000" };
const PASSAT_PRIOR = priorDiagMsg({
  shrnutí: "VW Passat 2.0 TDI – trhání při akceleraci, kontrolka motoru, kód P0401 (nízký průtok EGR).",
  závady: [
    { název: "Zanesený EGR ventil", pravděpodobnost: 80, popis: "Karbonové usazeniny blokují EGR ventil, nízký průtok, trhání a chybový kód P0401.", obd_kódy: ["P0401"], naléhavost: "střední", zdroj: "ai", početShod: 0 },
    { název: "Ucpaný DPF filtr", pravděpodobnost: 60, popis: "Částečně ucpaný DPF zvyšuje protitlak, ztráta výkonu, neúplné regenerace.", obd_kódy: ["P2002"], naléhavost: "střední", zdroj: "ai", početShod: 0 },
    { název: "Vadný snímač MAF", pravděpodobnost: 45, popis: "Nepřesné měření průtoku vzduchu může způsobit chybnou dávku a trhání.", obd_kódy: ["P0101"], naléhavost: "nízká", zdroj: "ai", početShod: 0 },
  ],
  doporučené_testy: ["Kontrola EGR ventilu endoskopem", "Měření protitlaku DPF", "Test MAF při zátěži"],
  varování: null,
  další_info: null,
});

// ── 10 scénářů: follow-up dotaz + očekávané chování ──────────────────────────
const SCENARIOS = [
  {
    id: 1, title: "Čistá otázka 'proč' (vysvětlení)",
    vehicle: TRANSIT_VEHICLE, prior: TRANSIT_PRIOR,
    priorInput: priorInputMsg("Transit 2012 2.2 103kW, ztratil výkon, bílý kouř, žere olej, koktá jako na 3 válce. Diagnostika: závada žhavicí svíčky na 2. válci."),
    followup: "Proč jde konkrétně o 2. válec? Z toho vstupu mi to není jasné.",
    expectedMode: "odpověď",
    expect: "Vysvětlí, že číslo válce pochází ze vstupní diagnostiky (žhavicí svíčka válce 2) — text, ne nové karty.",
  },
  {
    id: 2, title: "Otázka na pojem (co znamená test)",
    vehicle: TRANSIT_VEHICLE, prior: TRANSIT_PRIOR,
    priorInput: priorInputMsg("Transit 2.2 TDCi, bílý kouř, ztráta výkonu, koktá."),
    followup: "Co přesně je leak-off test a jak ho udělám?",
    expectedMode: "odpověď",
    expect: "Vysvětlí leak-off (zpětný tok vstřikovačů) běžným jazykem — text.",
  },
  {
    id: 3, title: "Otázka 'jak poznám' (rada)",
    vehicle: TRANSIT_VEHICLE, prior: TRANSIT_PRIOR,
    priorInput: priorInputMsg("Transit 2.2 TDCi, bílý kouř, ztráta výkonu."),
    followup: "Jak poznám prasklé těsnění hlavy bez demontáže?",
    expectedMode: "odpověď",
    expect: "Poradí indikátory (bubliny v chladiči, CO test, ztráta kapaliny) — text.",
  },
  {
    id: 4, title: "Nové zjištění vylučuje příčinu (komprese OK)",
    vehicle: TRANSIT_VEHICLE, prior: TRANSIT_PRIOR,
    priorInput: priorInputMsg("Transit 2.2 TDCi, bílý kouř, ztráta výkonu, koktá."),
    followup: "Změřil jsem kompresi na všech válcích včetně druhého — je v normě a vyrovnaná.",
    expectedMode: "diagnóza",
    expect: "Aktualizuje: výrazně sníží/vyřadí 'poškození pístu/kroužků (ztráta komprese)'; nahoru vstřikovač / těsnění.",
  },
  {
    id: 5, title: "Nové zjištění potvrzuje příčinu (leak-off velký na válci 2)",
    vehicle: TRANSIT_VEHICLE, prior: TRANSIT_PRIOR,
    priorInput: priorInputMsg("Transit 2.2 TDCi, bílý kouř, ztráta výkonu, koktá."),
    followup: "Udělal jsem leak-off test — vstřikovač na 2. válci má extrémní zpětný tok, ostatní v normě.",
    expectedMode: "diagnóza",
    expect: "Vadný vstřikovač válce 2 nahoru na 1. místo s vysokou pravděpodobností.",
  },
  {
    id: 6, title: "Provedená oprava nepomohla",
    vehicle: TRANSIT_VEHICLE, prior: TRANSIT_PRIOR,
    priorInput: priorInputMsg("Transit 2.2 TDCi, bílý kouř, ztráta výkonu, koktá."),
    followup: "Vyměnil jsem vstřikovač na 2. válci za nový a vymazal adaptace, ale bílý kouř i koktání pokračují stejně.",
    expectedMode: "diagnóza",
    expect: "Sníží vstřikovač, posune nahoru těsnění hlavy / mechanické poškození.",
  },
  {
    id: 7, title: "Nový příznak",
    vehicle: TRANSIT_VEHICLE, prior: TRANSIT_PRIOR,
    priorInput: priorInputMsg("Transit 2.2 TDCi, bílý kouř, ztráta výkonu."),
    followup: "Teď navíc rychle ubývá chladicí kapalina a v expanzní nádržce jsou bublinky.",
    expectedMode: "diagnóza",
    expect: "Prasklé těsnění hlavy nahoru (úbytek kapaliny + bubliny = výfuk do chladicího okruhu).",
  },
  {
    id: 8, title: "Nový OBD kód v textu (jiné vozidlo)",
    vehicle: PASSAT_VEHICLE, prior: PASSAT_PRIOR,
    priorInput: priorInputMsg("Passat 2.0 TDI, trhání při akceleraci, kontrolka motoru, kód P0401."),
    followup: "Vyčistil jsem EGR, ale teď naskočil nový kód P2002 a auto je v nouzovém režimu.",
    expectedMode: "diagnóza",
    expect: "DPF (P2002) nahoru na 1. místo, EGR dolů.",
  },
  {
    id: 9, title: "Smíšené: rada na svépomoc (otázka)",
    vehicle: TRANSIT_VEHICLE, prior: TRANSIT_PRIOR,
    priorInput: priorInputMsg("Transit 2.2 TDCi, bílý kouř, ztráta výkonu."),
    followup: "Myslíš, že výměnu těsnění hlavy zvládnu sám v garáži? Nemám moment klíč ani lis.",
    expectedMode: "odpověď",
    expect: "Poradí (náročnost, potřebné nářadí/úhel dotažení, doporučí servis) — text, ne karty.",
  },
  {
    id: 10, title: "Mimo téma během konverzace",
    vehicle: TRANSIT_VEHICLE, prior: TRANSIT_PRIOR,
    priorInput: priorInputMsg("Transit 2.2 TDCi, bílý kouř, ztráta výkonu."),
    followup: "Jaké bude zítra počasí v Brně?",
    expectedMode: "odpověď",
    expect: "Mělo by zdvořile odmítnout/odklonit zpět k diagnostice — NEMělo by generovat nové karty závad.",
  },
];

// ── Běh jednoho scénáře ──────────────────────────────────────────────────────
async function runScenario(s) {
  capture = {};
  const currentCase = {
    id: `case-${s.id}`,
    vehicle: s.vehicle,
    messages: [s.priorInput, s.prior],
    tokenCount: 0,
  };
  const inputData = { symptoms: [], obdCodes: [], text: s.followup };

  const started = Date.now();
  try {
    const result = await executeDiagnosis({ currentCase, inputData, callAI, searchCases, tr, lang: "cs" });
    const elapsedMs = Date.now() - started;
    const actualMode = result.diagnosisMsg ? "diagnóza" : result.replyMsg ? "odpověď" : "??";
    return {
      id: s.id, title: s.title, expectedMode: s.expectedMode, actualMode,
      modeMatch: actualMode === s.expectedMode,
      expect: s.expect,
      reply: result.replyMsg?.text ?? null,
      faults: result.diagnosisMsg?.result?.závady?.map((f) => ({ název: f.název, pravděpodobnost: f.pravděpodobnost })) ?? null,
      shrnutí: result.diagnosisMsg?.result?.shrnutí ?? null,
      usedTokens: result.usedTokens, elapsedMs, error: null,
      raw: capture.raw,
    };
  } catch (e) {
    return {
      id: s.id, title: s.title, expectedMode: s.expectedMode, actualMode: "ERROR",
      modeMatch: false, expect: s.expect, reply: null, faults: null, shrnutí: null,
      usedTokens: 0, elapsedMs: Date.now() - started, error: e.message, raw: capture.raw,
    };
  }
}

// ── Souběžné spuštění s omezenou konkurencí ──────────────────────────────────
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
  // Volitelný filtr ID z CLI: `node scripts/e2e-followup-test.mjs 1 2 3 7`
  const only = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));
  const toRun = only.length ? SCENARIOS.filter((s) => only.includes(s.id)) : SCENARIOS;
  console.log(`\n=== E2E follow-up test · model=${MODEL} · ${toRun.length} scénářů · proxy=${EDGE} ===\n`);
  const results = await runPool(toRun, runScenario, CONCURRENCY);

  const passed = results.filter((r) => r.modeMatch).length;
  console.log(`\n=== Shrnutí režimu: ${passed}/${results.length} odpovídá očekávání ===\n`);

  const outName = only.length ? `e2e-followup-results-subset.json` : `e2e-followup-results.json`;
  writeFileSync(
    new URL(`./${outName}`, import.meta.url),
    JSON.stringify({ model: MODEL, ranAt: new Date().toISOString(), results }, null, 2),
    "utf8",
  );
  console.log(`Detailní výsledky uloženy do scripts/${outName}`);
})();
