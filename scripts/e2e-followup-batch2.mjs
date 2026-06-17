/**
 * E2E test — hybrid follow-up, DÁVKA 2: 20 dalších rozdílných případů.
 *
 * Jako scripts/e2e-followup-test.mjs, ale širší pokrytí: jiné značky/systémy
 * (zapalování benzín, turbo, DPF/AdBlue, DSG, ABS, chlazení, nabíjení, EV/hybrid,
 * rozvody, podvozek, přímé vstřikování), edge-case „oprava zabrala" i nesouhlas
 * mechanika, a scénáře v EN a DE (ověření jazyků). Volá REÁLNÉ DeepSeek API.
 *
 * Spuštění:  node scripts/e2e-followup-batch2.mjs [id...]
 * Výstup:    scripts/e2e-followup-results-batch2.json
 */

import { writeFileSync } from "node:fs";
import { executeDiagnosis } from "../web/src/lib/run-diagnosis.js";
import { translate } from "../web/src/i18n/translate.js";
import { RUNTIME_CONFIG } from "../web/src/lib/runtime-config.js";

const EDGE = RUNTIME_CONFIG.edgeFunctionsUrl;
const ANON = RUNTIME_CONFIG.supabaseAnonKey;
const MODEL = "deepseek-v4-pro";
const USER_ID = "e2e-batch2"; // fresh user_id → vlastní denní limit
const CALL_TIMEOUT_MS = 240_000;
const CONCURRENCY = 6;

const trFor = (lang) => (key, params) => translate(key, params, lang || "cs");

let capture = {};
async function callAI({ systemPrompt, userMessage, maxTokens }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await fetch(`${EDGE}/deepseek-proxy`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}`, apikey: ANON },
      body: JSON.stringify({ model: MODEL, system: systemPrompt, messages: [{ role: "user", content: userMessage }], max_tokens: maxTokens, user_id: USER_ID }),
    });
    const data = await res.json();
    capture.raw = data?.content?.map((b) => b.text ?? "").join("") ?? null;
    return data;
  } finally {
    clearTimeout(timer);
  }
}
async function searchCases() { return { cases: [], ok: true }; }

// Builder předchozí diagnózy: f = [název, pravděpodobnost, popis, naléhavost]
function diag(shrnuti, f) {
  return {
    id: "dg0", type: "diagnosis", timestamp: "2026-06-16T10:00:05.000Z", ragMatchIds: [], tokensUsed: 0,
    result: {
      shrnutí: shrnuti,
      závady: f.map(([nazev, p, popis, nal]) => ({ název: nazev, pravděpodobnost: p, popis, naléhavost: nal || "střední", zdroj: "ai", početShod: 0 })),
      doporučené_testy: [], varování: null, další_info: null,
    },
  };
}
function inp(text) { return { id: "in0", type: "input", symptoms: [], obdCodes: [], text, timestamp: "2026-06-16T10:00:00.000Z" }; }

const S = [
  { id: 1, lang: "cs", title: "Benzín zapalování — Q cívka vs svíčka",
    vehicle: { brand: "Škoda", model: "Octavia III 1.4 TSI", enginePower: "110 kW", mileage: "120000" },
    prior: diag("Škoda Octavia 1.4 TSI – nepravidelný běh, kontrolka motoru, vynechávání na válci 1 (P0301).", [
      ["Vadná zapalovací cívka válce 1", 75, "Cívka netvoří jiskru, vynechávání, trhání, P0301.", "střední"],
      ["Opotřebená zapalovací svíčka válce 1", 55, "Špatná jiskra, vynechávání za zátěže.", "nízká"],
      ["Netěsnost sání / vakuum", 35, "Falešný vzduch ochuzuje směs.", "nízká"]]),
    priorInput: inp("Octavia 1.4 TSI, nepravidelný běh, svítí kontrolka, kód P0301."),
    followup: "Jak poznám, jestli za to může cívka nebo svíčka, než budu kupovat díly?",
    expectedMode: "odpověď", expect: "Poradí přehození cívky/svíčky na jiný válec a sledování, zda se chyba přesune; text." },

  { id: 2, lang: "cs", title: "Benzín zapalování — F přehození cívky",
    vehicle: { brand: "Škoda", model: "Octavia III 1.4 TSI", enginePower: "110 kW", mileage: "120000" },
    prior: diag("Škoda Octavia 1.4 TSI – vynechávání na válci 1 (P0301).", [
      ["Vadná zapalovací cívka válce 1", 75, "Cívka netvoří jiskru.", "střední"],
      ["Opotřebená svíčka válce 1", 55, "Špatná jiskra.", "nízká"],
      ["Netěsnost sání", 35, "Falešný vzduch.", "nízká"]]),
    priorInput: inp("Octavia 1.4 TSI, vynechávání, P0301."),
    followup: "Přehodil jsem cívku z válce 1 na válec 3 a chyba se přesunula na válec 3 (teď P0303).",
    expectedMode: "diagnóza", expect: "Vadná cívka jednoznačně potvrzena (přesun chyby) → nahoru ~95 %; svíčka/sání dolů." },

  { id: 3, lang: "cs", title: "Turbo — Q co je underboost",
    vehicle: { brand: "BMW", model: "320d E90", enginePower: "120 kW", mileage: "215000" },
    prior: diag("BMW 320d – ztráta výkonu, nouzový režim, P0299 (podtlak turba).", [
      ["Netěsnost přeplňování (hadice/intercooler)", 60, "Únik tlaku, turbo nedosáhne cíle, P0299.", "střední"],
      ["Vadná geometrie turba (VNT)", 55, "Zaseklé lopatky, nízký tlak.", "vysoká"],
      ["Vadný snímač tlaku plnění (MAP)", 30, "Špatné měření plnicího tlaku.", "nízká"]]),
    priorInput: inp("320d, ztráta výkonu, nouzový režim, P0299."),
    followup: "Co přesně znamená underboost a může za to turbo, nebo to může být něco lacinějšího?",
    expectedMode: "odpověď", expect: "Vysvětlí podtlak plnění a že příčinou bývá i levná netěsnost hadice, ne nutně turbo; text." },

  { id: 4, lang: "cs", title: "Turbo — F prasklá hadice intercooleru",
    vehicle: { brand: "BMW", model: "320d E90", enginePower: "120 kW", mileage: "215000" },
    prior: diag("BMW 320d – ztráta výkonu, nouzový režim, P0299 (podtlak turba).", [
      ["Vadná geometrie turba (VNT)", 60, "Zaseklé lopatky.", "vysoká"],
      ["Netěsnost přeplňování", 55, "Únik tlaku.", "střední"],
      ["Vadný MAP snímač", 30, "Špatné měření.", "nízká"]]),
    priorInput: inp("320d, ztráta výkonu, P0299."),
    followup: "Při kontrole jsem našel prasklou gumovou hadici mezi intercoolerem a sáním, je natržená.",
    expectedMode: "diagnóza", expect: "Netěsnost přeplňování nahoru na 1. místo (vysoká); turbo dolů (zatím nevyloučeno)." },

  { id: 5, lang: "cs", title: "AdBlue/SCR — Q můžu jezdit",
    vehicle: { brand: "Mercedes-Benz", model: "Sprinter 2.1 CDI", enginePower: "105 kW", mileage: "240000" },
    prior: diag("Sprinter 2.1 CDI – varování SCR/AdBlue, omezení výkonu, P20EE (nízká účinnost SCR).", [
      ["Vadný NOx snímač (za SCR)", 60, "Špatné měření NOx, P20EE, omezení.", "střední"],
      ["Krystalizace AdBlue v dávkovači", 45, "Ucpaný injektor AdBlue.", "střední"],
      ["Vadný SCR katalyzátor", 30, "Snížená konverze NOx.", "vysoká"]]),
    priorInput: inp("Sprinter 2.1 CDI, hlásí AdBlue/SCR, omezuje výkon, P20EE."),
    followup: "Musím to řešit hned, nebo s tím ještě můžu pár dní jezdit do práce?",
    expectedMode: "odpověď", expect: "Vysvětlí riziko počítadla startů / úplného omezení a doporučí brzkou opravu; text." },

  { id: 6, lang: "cs", title: "AdBlue/SCR — F doplněno, hlásí kvalitu",
    vehicle: { brand: "Mercedes-Benz", model: "Sprinter 2.1 CDI", enginePower: "105 kW", mileage: "240000" },
    prior: diag("Sprinter 2.1 CDI – varování SCR/AdBlue, P20EE.", [
      ["Krystalizace AdBlue v dávkovači", 55, "Ucpaný injektor.", "střední"],
      ["Vadný NOx snímač", 50, "Špatné měření.", "střední"],
      ["Vadný SCR katalyzátor", 30, "Snížená konverze.", "vysoká"]]),
    priorInput: inp("Sprinter, AdBlue/SCR, P20EE."),
    followup: "Doplnil jsem plnou nádrž čerstvého AdBlue, ale kontrolka svítí dál a teď to hlásí špatnou kvalitu redukčního činidla.",
    expectedMode: "diagnóza", expect: "Doplnění nepomohlo → kvalita měřená snímačem; NOx/kvalitní snímač nebo SCR nahoru, prosté doplnění vyloučeno." },

  { id: 7, lang: "cs", title: "DSG — Q mechatronika vs spojka",
    vehicle: { brand: "Volkswagen", model: "Golf VII 1.4 TSI DSG", enginePower: "103 kW", mileage: "160000" },
    prior: diag("VW Golf DSG (DQ200) – škubání při řazení, občas nezařadí, P17BF.", [
      ["Vadná mechatronická jednotka", 60, "Chyba tlaku/ventilů, škubání, P17BF.", "vysoká"],
      ["Opotřebení suché dvojspojky", 50, "Prokluz, škubání při rozjezdu.", "vysoká"],
      ["Nízká/stará převodová kapalina", 25, "Špatný tlak v hydraulice.", "nízká"]]),
    priorInput: inp("Golf 1.4 TSI DSG, škube při řazení, občas nezařadí, P17BF."),
    followup: "Je to spíš ta mechatronika, nebo spojka? Liší se to dost cenou.",
    expectedMode: "odpověď", expect: "Vysvětlí rozdíl příznaků a doporučí měření tlaku/adaptace pro rozlišení; text." },

  { id: 8, lang: "cs", title: "DSG — F tlak mechatroniky v normě",
    vehicle: { brand: "Volkswagen", model: "Golf VII 1.4 TSI DSG", enginePower: "103 kW", mileage: "160000" },
    prior: diag("VW Golf DSG (DQ200) – škubání při řazení, P17BF.", [
      ["Vadná mechatronická jednotka", 60, "Chyba tlaku/ventilů.", "vysoká"],
      ["Opotřebení suché dvojspojky", 50, "Prokluz při rozjezdu.", "vysoká"],
      ["Stará převodová kapalina", 25, "Špatný tlak.", "nízká"]]),
    priorInput: inp("Golf DSG, škube, P17BF."),
    followup: "Specialista změřil tlaky v mechatronice, drží je v normě a adaptace proběhly. Škubání je hlavně při rozjezdu z místa.",
    expectedMode: "diagnóza", expect: "Mechatronika dolů (tlaky OK), opotřebená dvojspojka nahoru (škubání při rozjezdu)." },

  { id: 9, lang: "cs", title: "ABS — Q brzdí ale svítí",
    vehicle: { brand: "Ford", model: "Focus III 1.6 TDCi", enginePower: "85 kW", mileage: "175000" },
    prior: diag("Ford Focus – svítí ABS, vypnutý ESP, C0035 (snímač předního levého kola).", [
      ["Vadný snímač otáček předního levého kola", 70, "Výpadek signálu, C0035.", "střední"],
      ["Poškozený impulsní (reluktorový) kroužek", 45, "Nečitelný signál snímače.", "nízká"],
      ["Koroze/špatný konektor snímače", 30, "Přerušovaný signál.", "nízká"]]),
    priorInput: inp("Focus 1.6 TDCi, svítí ABS, kód C0035."),
    followup: "Proč auto normálně brzdí, ale přitom mi svítí ABS? Je to bezpečné?",
    expectedMode: "odpověď", expect: "Vysvětlí, že při výpadku ABS funguje běžná brzda bez ABS asistence, opatrnost na kluzku; text." },

  { id: 10, lang: "cs", title: "ABS — F vyčištěn snímač, chyba se vrací",
    vehicle: { brand: "Ford", model: "Focus III 1.6 TDCi", enginePower: "85 kW", mileage: "175000" },
    prior: diag("Ford Focus – svítí ABS, C0035 (přední levé kolo).", [
      ["Vadný snímač předního levého kola", 70, "Výpadek signálu.", "střední"],
      ["Poškozený reluktorový kroužek", 45, "Nečitelný signál.", "nízká"],
      ["Špatný konektor", 30, "Přerušovaný signál.", "nízká"]]),
    priorInput: inp("Focus, ABS, C0035."),
    followup: "Vyčistil jsem snímač i konektor, chyba na den zmizela, ale pak se vrátila. Na kroužku je vidět kousek odštípnutý zub.",
    expectedMode: "diagnóza", expect: "Poškozený reluktorový kroužek nahoru (viditelně odštípnutý zub); čistý snímač/konektor dolů." },

  { id: 11, lang: "cs", title: "Chlazení — Q jak najdu únik",
    vehicle: { brand: "Toyota", model: "Corolla 1.8", enginePower: "103 kW", mileage: "150000" },
    prior: diag("Toyota Corolla 1.8 – přehřívání, úbytek chladicí kapaliny, bez zjevné louže.", [
      ["Netěsné vodní čerpadlo", 50, "Únik přes ucpávku, úbytek kapaliny.", "střední"],
      ["Prasklá/popraskaná hadice chlazení", 45, "Únik za tlaku/tepla.", "střední"],
      ["Vadná těsnící zátka chladiče / expanzní nádrž", 30, "Únik tlaku a páry.", "nízká"]]),
    priorInput: inp("Corolla 1.8, přehřívá se, ubývá chladicí kapalina, louži nevidím."),
    followup: "Jak najdu, kudy ta kapalina uniká, když pod autem nic nekape?",
    expectedMode: "odpověď", expect: "Doporučí tlakovou zkoušku okruhu, UV barvivo, prohlídku za tepla; text." },

  { id: 12, lang: "cs", title: "Chlazení — F tlaková zkouška vodní pumpa",
    vehicle: { brand: "Toyota", model: "Corolla 1.8", enginePower: "103 kW", mileage: "150000" },
    prior: diag("Toyota Corolla 1.8 – přehřívání, úbytek kapaliny.", [
      ["Prasklá hadice chlazení", 45, "Únik za tlaku.", "střední"],
      ["Netěsné vodní čerpadlo", 45, "Únik přes ucpávku.", "střední"],
      ["Vadná zátka chladiče", 30, "Únik páry.", "nízká"]]),
    priorInput: inp("Corolla, přehřívá, ubývá kapalina."),
    followup: "Tlaková zkouška ukázala, že kapalina prosakuje z odvzdušňovacího otvoru vodního čerpadla.",
    expectedMode: "diagnóza", expect: "Netěsné vodní čerpadlo nahoru na 1. místo (prosak z otvoru = klasika); hadice/zátka dolů." },

  { id: 13, lang: "en", title: "Charging (EN) — Q how to test alternator",
    vehicle: { brand: "Renault", model: "Mégane III 1.5 dCi", enginePower: "81 kW", mileage: "190000" },
    prior: diag("Renault Mégane – battery warning light, dim lights, suspected charging fault.", [
      ["Faulty alternator / voltage regulator", 65, "Not charging, battery light on.", "vysoká"],
      ["Worn alternator belt / tensioner", 40, "Belt slip reduces charging.", "střední"],
      ["Bad battery or terminals", 30, "Poor connection, low voltage.", "nízká"]]),
    priorInput: inp("Renault Megane 1.5 dCi, battery warning light, dim lights."),
    followup: "How do I check whether the alternator is actually charging? I have a multimeter.",
    expectedMode: "odpověď", expect: "Reply in ENGLISH: measure battery voltage engine off (~12.6V) vs running (~13.8–14.4V), should rise; text." },

  { id: 14, lang: "en", title: "Charging (EN) — F 12.2V no rise",
    vehicle: { brand: "Renault", model: "Mégane III 1.5 dCi", enginePower: "81 kW", mileage: "190000" },
    prior: diag("Renault Mégane – battery warning light, suspected charging fault.", [
      ["Faulty alternator / voltage regulator", 65, "Not charging.", "vysoká"],
      ["Worn belt / tensioner", 40, "Belt slip.", "střední"],
      ["Bad battery/terminals", 30, "Poor connection.", "nízká"]]),
    priorInput: inp("Megane 1.5 dCi, battery warning light."),
    followup: "I measured 12.2V at the battery with the engine running, and it does not rise at all when I rev it. Belt looks fine and tight.",
    expectedMode: "diagnóza", expect: "Diagnosis in ENGLISH: alternator/regulator to top (no voltage rise = not charging); belt down (looks fine)." },

  { id: 15, lang: "cs", title: "EV — Q zimní dojezd",
    vehicle: { brand: "Tesla", model: "Model 3", enginePower: "208 kW", mileage: "60000" },
    prior: diag("Tesla Model 3 – snížený dojezd v zimě, hláška o omezeném dosahu.", [
      ["Normální vliv nízké teploty na baterii", 60, "Chemie LiIon dává v zimě méně, vytápění bere energii.", "nízká"],
      ["Degradace článků baterie", 30, "Trvalý úbytek kapacity stárnutím.", "střední"],
      ["Neoptimalizované předehřívání/nabíjení", 25, "Bez předehřevu vyšší ztráty.", "nízká"]]),
    priorInput: inp("Model 3, v zimě výrazně menší dojezd než v létě."),
    followup: "Je vůbec normální takhle přijít o dojezd v zimě, nebo mám špatnou baterku?",
    expectedMode: "odpověď", expect: "Vysvětlí, že zimní pokles dojezdu je u EV běžný (chemie + topení), kdy je důvod ke kontrole; text." },

  { id: 16, lang: "cs", title: "Hybrid — F slabý modul baterie",
    vehicle: { brand: "Toyota", model: "Prius III hybrid", enginePower: "73 kW", mileage: "230000" },
    prior: diag("Toyota Prius III – kontrolka hybridního systému, P0A80 (vyměňte HV baterii).", [
      ["Degradovaný článek/modul HV baterie", 65, "Nevyrovnané napětí modulů, P0A80.", "vysoká"],
      ["Vadné chlazení HV baterie (ventilátor/filtr)", 35, "Přehřívání urychluje degradaci.", "střední"],
      ["Vadný snímač/řízení HV baterie", 25, "Chybné měření článků.", "nízká"]]),
    priorInput: inp("Prius III, svítí hybridní systém, P0A80."),
    followup: "Vyčetl jsem napětí bloků a jeden modul má výrazně nižší napětí než ostatní, ostatní jsou vyrovnané.",
    expectedMode: "diagnóza", expect: "Degradovaný modul baterie nahoru (jeden slabý blok = klasika); snímač/řízení dolů." },

  { id: 17, lang: "de", title: "Rozvody (DE) — Q kann ich fahren",
    vehicle: { brand: "Peugeot", model: "308 1.6 HDi", enginePower: "82 kW", mileage: "185000" },
    prior: diag("Peugeot 1.6 HDi – Rasseln beim Kaltstart, Motorkontrollleuchte, P0016 (Nockenwellen-Kurbelwellen-Korrelation).", [
      ["Längung der Steuerkette / verschlissener Kettenspanner", 65, "Kette springt über, Rasseln, P0016.", "vysoká"],
      ["Defekter Nockenwellensensor", 35, "Falsches Signal, Korrelationsfehler.", "střední"],
      ["Niedriger Öldruck am Kettenspanner", 30, "Spanner hält nicht, Rasseln.", "střední"]]),
    priorInput: inp("Peugeot 308 1.6 HDi, Rasseln beim Kaltstart, P0016."),
    followup: "Kann ich noch zur Werkstatt fahren oder reißt mir gleich die Steuerkette?",
    expectedMode: "odpověď", expect: "Antwort auf DEUTSCH: Risiko Kettenüberspringen/Motorschaden, lieber nicht fahren / abschleppen; Text." },

  { id: 18, lang: "cs", title: "Rozvody — F napínák zabral, P0016 zpět",
    vehicle: { brand: "Peugeot", model: "308 1.6 HDi", enginePower: "82 kW", mileage: "185000" },
    prior: diag("Peugeot 1.6 HDi – rachot za studena, P0016 (korelace vačka-klika).", [
      ["Vytažený rozvodový řetěz / opotřebený napínák", 65, "Řetěz přeskakuje, rachot, P0016.", "vysoká"],
      ["Vadný snímač vačky", 35, "Špatný signál.", "střední"],
      ["Nízký tlak oleje na napínáku", 30, "Napínák nedrží.", "střední"]]),
    priorInput: inp("Peugeot 1.6 HDi, rachot za studena, P0016."),
    followup: "Vyměnil jsem napínák řetězu, rachot za studena zmizel, ale kód P0016 se po pár dnech vrátil a kontrolka svítí.",
    expectedMode: "diagnóza", expect: "Napínák vyřešil rachot, ale přetrvávající P0016 → vytažený řetěz/přeskočené ozubení nahoru; snímač zvážit." },

  { id: 19, lang: "cs", title: "Edge — oprava zabrala (vyřešeno)",
    vehicle: { brand: "Škoda", model: "Octavia III 1.4 TSI", enginePower: "110 kW", mileage: "120000" },
    prior: diag("Škoda Octavia 1.4 TSI – vynechávání na válci 1 (P0301).", [
      ["Vadná zapalovací cívka válce 1", 90, "Cívka netvoří jiskru (potvrzeno přesunem chyby).", "střední"],
      ["Opotřebená svíčka válce 1", 30, "Špatná jiskra.", "nízká"],
      ["Netěsnost sání", 15, "Falešný vzduch.", "nízká"]]),
    priorInput: inp("Octavia 1.4 TSI, vynechávání P0301; přehození cívky potvrdilo vadnou cívku."),
    followup: "Vyměnil jsem zapalovací cívku na válci 1 a motor teď běží úplně hladce, kontrolka po vymazání zhasla a nevrátila se.",
    expectedMode: "diagnóza", expect: "Rozpozná, že je závada VYŘEŠENÁ (cívka potvrzena a opravena) — nevymýšlí nové nesouvisející závady; ideálně doporučí uzavřít případ." },

  { id: 20, lang: "cs", title: "Edge — nesouhlas mechanika + pozorování",
    vehicle: { brand: "Audi", model: "A4 B8 2.0 TDI", enginePower: "130 kW", mileage: "205000" },
    prior: diag("Audi A4 B8 – klapání na nerovnostech zepředu, neurčitý zvuk podvozku.", [
      ["Vůle v spodním rameni / silentblok", 60, "Opotřebené pouzdro ramene klape přes nerovnosti.", "střední"],
      ["Opotřebené uložení tlumiče (horní)", 45, "Klapání horního ložiska tlumiče.", "střední"],
      ["Vůle na čepu řízení / stabilizátoru", 40, "Klepání tyčky stabilizátoru.", "nízká"]]),
    priorInput: inp("Audi A4 B8 2.0 TDI, klape to zepředu na nerovnostech."),
    followup: "Nemyslím, že je to rameno — gumy (silentbloky) na rameni vypadají jako nové, žádná vůle. Spíš mi to klepe shora od tlumiče a zhoršuje se to na malých nerovnostech.",
    expectedMode: "diagnóza", expect: "Spodní rameno dolů (silentbloky OK), horní uložení tlumiče nahoru (zvuk shora, malé nerovnosti)." },
];

async function runScenario(s) {
  capture = {};
  const tr = trFor(s.lang);
  const currentCase = { id: `b2-${s.id}`, vehicle: s.vehicle, messages: [s.priorInput, s.prior], tokenCount: 0 };
  const inputData = { symptoms: [], obdCodes: [], text: s.followup };
  const started = Date.now();
  try {
    const result = await executeDiagnosis({ currentCase, inputData, callAI, searchCases, tr, lang: s.lang });
    const actualMode = result.diagnosisMsg ? "diagnóza" : result.replyMsg ? "odpověď" : "??";
    return {
      id: s.id, title: s.title, lang: s.lang, expectedMode: s.expectedMode, actualMode,
      modeMatch: actualMode === s.expectedMode, expect: s.expect,
      reply: result.replyMsg?.text ?? null,
      faults: result.diagnosisMsg?.result?.závady?.map((f) => ({ název: f.název, pravděpodobnost: f.pravděpodobnost })) ?? null,
      shrnutí: result.diagnosisMsg?.result?.shrnutí ?? null,
      usedTokens: result.usedTokens, elapsedMs: Date.now() - started, error: null, raw: capture.raw,
    };
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
      console.log(`  ✓ done  #${r.id} [${r.lang}] — čekáno=${r.expectedMode} / dostal=${r.actualMode} ${r.modeMatch ? "✅" : "❌"} (${(r.elapsedMs / 1000).toFixed(0)}s)`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return results;
}

(async () => {
  const only = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));
  const toRun = only.length ? S.filter((s) => only.includes(s.id)) : S;
  console.log(`\n=== E2E follow-up DÁVKA 2 · model=${MODEL} · ${toRun.length} scénářů · proxy=${EDGE} ===\n`);
  const results = await runPool(toRun, runScenario, CONCURRENCY);
  const passed = results.filter((r) => r.modeMatch).length;
  console.log(`\n=== Shrnutí režimu: ${passed}/${results.length} odpovídá očekávání ===\n`);
  writeFileSync(new URL("./e2e-followup-results-batch2.json", import.meta.url), JSON.stringify({ model: MODEL, ranAt: new Date().toISOString(), results }, null, 2), "utf8");
  console.log("Detailní výsledky uloženy do scripts/e2e-followup-results-batch2.json");
})();
