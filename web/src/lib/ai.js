import { extractSignals } from "./rag.js";
import { getBrandEntry }  from "../constants/index.js";
import { translate }       from "../i18n/translate.js";
export { CASE_TOKEN_LIMIT } from "../constants/limits.js";

// ── Detekce typu paliva z názvu motorizace ──────────────────────────────────

const PETROL_PATTERNS = /\b(TSI|TFSI|FSI|MPI|GDI|T-?GDI|VTEC|VVT-?i|MIVEC|BoosterJet|DuoJet|DualJet|EcoBoost|PureTech|FireFly|Skyactiv-G|DOHC|Valvetronic)\b/i
const DIESEL_PATTERNS = /\b(TDI|CDI|HDI|dCi|CDTI|CRDi|D-?4D|EcoBlue|BlueHDi|Skyactiv-D|JTD|JTDM|DDiS|Multijet)\b/i
const HYBRID_PATTERNS = /\b(Hybrid|HEV|MHEV|FHEV|e-HYBRID|PHEV|GTE|GTe)\b/i
const ELECTRIC_PATTERNS = /\b(Electric|BEV|EV|e-tron|ID\.\d)\b/i

/**
 * Detekuje typ paliva z enginePower stringu (např. "118 kW – 1.4 TSI").
 * @returns {"petrol"|"diesel"|"electric"|"hybrid"|null}
 */
export function detectFuelType(enginePower) {
  if (!enginePower) return null
  if (HYBRID_PATTERNS.test(enginePower)) return "hybrid"
  if (ELECTRIC_PATTERNS.test(enginePower)) return "electric"
  if (DIESEL_PATTERNS.test(enginePower)) return "diesel"
  if (PETROL_PATTERNS.test(enginePower)) return "petrol"
  return null
}

const FUEL_LABELS = {
  cs: { petrol: "BENZÍNOVÝ", diesel: "NAFTOVÝ (DIESEL)", electric: "ELEKTRICKÝ", hybrid: "HYBRIDNÍ" },
  en: { petrol: "PETROL (GASOLINE)", diesel: "DIESEL", electric: "ELECTRIC", hybrid: "HYBRID" },
  de: { petrol: "BENZIN", diesel: "DIESEL", electric: "ELEKTRISCH", hybrid: "HYBRID" },
}

const FUEL_RULES = {
  cs: {
    petrol: "⚠️ MOTOR JE BENZÍNOVÝ — NIKDY nezmiňuj diesel-specifické systémy (common rail, vstřikovací čerpadlo diesel, DPF, AdBlue, SCR, EGR diesel, žhavicí svíčky). Zaměř se na benzínové komponenty: zapalovací svíčky, zapalovací cívky, lambda sondy, katalyzátor, přímé vstřikování benzínu, turbo (pokud TSI/TFSI).",
    diesel: "Motor je NAFTOVÝ — zaměř se na diesel-specifické systémy: common rail, vstřikovací čerpadlo, DPF, AdBlue/SCR (pokud Euro 5/6), EGR, žhavicí svíčky, turbo VGT.",
    electric: "Motor je ELEKTRICKÝ — zaměř se na: baterie, BMS, inverter, elektromotor, nabíjecí systém, rekuperace. Nezmiňuj spalovací komponenty.",
    hybrid: "Pohon je HYBRIDNÍ — zohledni jak spalovací motor tak elektrickou část: baterie HV, inverter, spalovací motor, přepínání pohonu.",
  },
  en: {
    petrol: "⚠️ THIS IS A PETROL (GASOLINE) ENGINE — NEVER mention diesel-specific systems (common rail, diesel injection pump, DPF, AdBlue, SCR, diesel EGR, glow plugs). Focus on petrol components: spark plugs, ignition coils, lambda sensors, catalytic converter, direct petrol injection, turbo (if TSI/TFSI).",
    diesel: "This is a DIESEL engine — focus on diesel-specific systems: common rail, injection pump, DPF, AdBlue/SCR (if Euro 5/6), EGR, glow plugs, VGT turbo.",
    electric: "This is an ELECTRIC vehicle — focus on: battery, BMS, inverter, electric motor, charging system, regenerative braking. Do NOT mention combustion components.",
    hybrid: "This is a HYBRID powertrain — consider both combustion engine and electric part: HV battery, inverter, combustion engine, drive mode switching.",
  },
  de: {
    petrol: "⚠️ DIES IST EIN BENZINMOTOR — erwähne NIEMALS Diesel-spezifische Systeme (Common Rail, Diesel-Einspritzpumpe, DPF, AdBlue, SCR, Diesel-AGR, Glühkerzen). Fokussiere auf Benzinkomponenten: Zündkerzen, Zündspulen, Lambdasonden, Katalysator, Benzin-Direkteinspritzung, Turbo (wenn TSI/TFSI).",
    diesel: "Dies ist ein DIESELMOTOR — fokussiere auf Diesel-spezifische Systeme: Common Rail, Einspritzpumpe, DPF, AdBlue/SCR (wenn Euro 5/6), AGR, Glühkerzen, VGT-Turbo.",
    electric: "Dies ist ein ELEKTROFAHRZEUG — fokussiere auf: Batterie, BMS, Wechselrichter, Elektromotor, Ladesystem, Rekuperation. Erwähne KEINE Verbrennungskomponenten.",
    hybrid: "Dies ist ein HYBRIDANTRIEB — berücksichtige sowohl Verbrennungsmotor als auch Elektroteil: HV-Batterie, Wechselrichter, Verbrennungsmotor, Antriebsmodusumschaltung.",
  },
}

// ── Off-topic detekce ─────────────────────────────────────────────────────────

// Technické zkratky — jejich přítomnost silně indikuje diagnostický kontext
const TECH_ABBREVIATIONS = /(dpf|egr|adblue|ecu|ecm|tcm|abs|esp|eps|can|lin|obd|dtc|mil|vin|rpm|tdci|ecoblue|ecoboost|scr|nox|def|urea|vgt|egts|maf|map|iac|tps|ckp|cmp|evap|purge|swirl|pid)/i

// OBD kód ve formátu P0401, C1234, B0001, U0100
const OBD_CODE_PATTERN = /[PCBU][0-9A-F]{4}/i

// Čísla s technickým kontextem — nájezd, teplota, tlak, RPM, napětí
const TECHNICAL_NUMBER = /\d+\s*(km|bar|kpa|rpm|psi|mbar|nm|ms|mv|mg)|\d+°[cf]/i

/**
 * Zkontroluje zda text mechanika pravděpodobně patří k diagnostice vozidla.
 *
 * Blokuje pouze dlouhé texty (>80 znaků) bez jakéhokoliv technického signálu.
 * Krátké texty a doplňující odpovědi ("znovu se to stalo") vždy projdou.
 *
 * Signály relevance (stačí jeden):
 *   - OBD kód (P0401, C1234...)
 *   - Technická zkratka (DPF, EGR, ECU, ABS...)
 *   - Číslo s jednotkou (185000 km, 92°C, 2.4 bar...)
 *   - Krátký text ≤80 znaků (doplňující odpověď)
 *
 * @param {string} text
 * @returns {{ ok: boolean, reason: string|null }}
 */
export function checkTopicRelevance(_text, _lang) {
  // Disabled — let users describe problems in their own words
  return { ok: true, reason: null }
}

/**
 * Pokusí se opravit zkrácený nebo mírně poškozený JSON z API odpovědi.
 * 1) Zkusí přímý JSON.parse
 * 2) Heuristická oprava — najde poslední kompletní závadu a doplní zbytek struktury
 * @param {string} raw - surový text z API
 * @returns {Object|null}
 */
export function smartRepair(raw) {
  const start = raw.indexOf("{");
  if (start === -1) return null;

  const str = raw.slice(start);
  try { return JSON.parse(str); } catch (_) {}

  let depth = 0, inStr = false, esc = false, lastFaultEnd = -1;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (esc)               { esc = false; continue; }
    if (c === "\\" && inStr) { esc = true;  continue; }
    if (c === '"')           { inStr = !inStr; continue; }
    if (inStr)               continue;
    if (c === "{" || c === "[")      depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 2 && c === "}") lastFaultEnd = i;
    }
  }

  if (lastFaultEnd > 0) {
    try {
      return JSON.parse(
        str.slice(0, lastFaultEnd + 1) +
        '\n],\n"doporučené_testy":[],\n"varování":null,\n"další_info":null\n}'
      );
    } catch (_) {}
  }

  return null;
}

/**
 * Sestaví system prompt pro Claude.
 * Odborný kontext AI se odvíjí od značky vozidla (lookup z VEHICLE_CATALOG).
 * Pokud existují podobné uzavřené případy, jsou vloženy jako RAG blok.
 *
 * @param {Array}  similarCases - výsledek searchCases() z Edge Function
 * @param {Object} vehicle      - { brand, model, mileage } aktuálního případu
 * @returns {string}
 */
// ── Localized system prompt templates ────────────────────────────────────────
// JSON keys MUST stay in Czech (závady, postup, naléhavost…) to avoid breaking
// smartRepair parsing and DiagCard rendering. Only descriptive text changes lang.

const SYSTEM_PROMPTS = {
  cs: (expertise, ragBlock) =>
    `Jsi expertní AI diagnostika pro mechaniky specializující se na ${expertise}.${ragBlock}

Když dostaneš příznaky, OBD kódy nebo popis závady, vrať POUZE validní JSON (bez textu před/za JSON):
{"shrnutí":"...","závady":[{"název":"...","pravděpodobnost":85,"popis":"...","příznaky_shoda":[],"obd_kódy":[],"díly":[],"řešení":[],"postup":"...","naléhavost":"vysoká","poznámka":"...","zdroj":"databáze","početShod":2}],"doporučené_testy":[],"varování":null,"další_info":null}

Pole "řešení" = 2–4 KONEČNÉ opravné akce, které problém vyřeší. Každá akce = konkrétní oprava/výměna, kterou mechanik provede (max 8 slov). NESMÍ obsahovat diagnostické/měřicí kroky (měření, kontrola, test, diagnostika) — ty patří do pole "postup" nebo "doporučené_testy". Příklady: únik kapaliny → ["výměna těsnění hlavy","výměna hlavy válců","utažení šroubů hlavy"]. Ztráta výkonu turba → ["nasazení hadice zpět","výměna hadice turba","utažení spony"]. Chybné vstřikování → ["výměna vstřikovače","vymazání adaptací ECU","výměna palivové lišty"]. DPF ucpán → ["nucená regenerace","výměna DPF filtru","čištění DPF"]. ŠPATNĚ: "měření komprese", "kontrola kabeláže", "test těsnosti" — to NEJSOU řešení!

Pravidla: Odpovídáš VÝHRADNĚ na otázky týkající se diagnostiky a opravy vozidel. Pokud dostaneš dotaz nesouvisející s diagnostikou vozidla, vrať JSON se závadou název "Nesouvisející dotaz" a pravděpodobností 0 a popisem "Tento systém slouží pouze pro diagnostiku vozidel." Jinak: Když nevíš, přiznej to. VŽDY uveď přesně 3 nejpravděpodobnější závady seřazené dle pravděpodobnosti — i když máš silnou shodu z databáze, doplň další možné příčiny. Naléhavost: nízká/střední/vysoká/kritická. Zohledni EU specifika (AdBlue, DPF Euro6). Pole "zdroj": nastav na "databáze" pokud závada vychází ze shody s případem z databáze (RAG), jinak "ai". Pole "početShod": u závad ze zdroje "databáze" uveď počet odpovídajících případů z databáze, u "ai" nastav na 0. VRAŤ POUZE JSON.`,

  en: (expertise, ragBlock) =>
    `You are an expert AI diagnostics system for mechanics specialising in ${expertise}.${ragBlock}

When you receive symptoms, OBD codes or a fault description, return ONLY valid JSON (no text before/after JSON).
IMPORTANT: The JSON keys MUST be in Czech exactly as shown below — do NOT translate the keys:
{"shrnutí":"...","závady":[{"název":"...","pravděpodobnost":85,"popis":"...","příznaky_shoda":[],"obd_kódy":[],"díly":[],"řešení":[],"postup":"...","naléhavost":"vysoká","poznámka":"...","zdroj":"databáze","početShod":2}],"doporučené_testy":[],"varování":null,"další_info":null}

Field "řešení" = 2–4 FINAL repair actions that fix the problem. Each action = specific repair/replacement the mechanic performs (max 8 words). MUST NOT contain diagnostic/measurement steps (measuring, checking, testing, inspecting) — those belong in "postup" or "doporučené_testy". Examples: coolant leak → ["replace head gasket","replace cylinder head","retorque head bolts"]. Turbo power loss → ["reattach turbo hose","replace turbo hose","tighten hose clamp"]. Faulty injection → ["replace injector","clear ECU adaptations","replace fuel rail"]. Clogged DPF → ["forced regeneration","replace DPF filter","DPF cleaning"]. WRONG: "measure compression", "check wiring", "test for leaks" — these are NOT solutions!

Write all VALUES (descriptions, fault names, repair procedures, notes) in English.
Rules: You answer ONLY questions related to vehicle diagnostics and repair. If you receive a non-diagnostic query, return JSON with fault název "Unrelated query" and pravděpodobnost 0 and popis "This system is for vehicle diagnostics only." Otherwise: If you don't know, admit it. ALWAYS return exactly 3 most probable faults sorted by probability — even if you have a strong database match, add other possible causes. naléhavost values: nízká/střední/vysoká/kritická. Consider EU specifics (AdBlue, DPF Euro6). Field "zdroj": set to "databáze" if the fault is based on a RAG database match, otherwise "ai". Field "početShod": for "databáze" source faults, set to the number of matching database cases; for "ai" set to 0. RETURN ONLY JSON.`,

  de: (expertise, ragBlock) =>
    `Du bist ein Experten-AI-Diagnosesystem für Mechaniker, spezialisiert auf ${expertise}.${ragBlock}

Wenn du Symptome, OBD-Codes oder eine Fehlerbeschreibung erhältst, gib NUR gültiges JSON zurück (kein Text vor/nach JSON).
WICHTIG: Die JSON-Schlüssel MÜSSEN auf Tschechisch sein, genau wie unten gezeigt — übersetze die Schlüssel NICHT:
{"shrnutí":"...","závady":[{"název":"...","pravděpodobnost":85,"popis":"...","příznaky_shoda":[],"obd_kódy":[],"díly":[],"řešení":[],"postup":"...","naléhavost":"vysoká","poznámka":"...","zdroj":"databáze","početShod":2}],"doporučené_testy":[],"varování":null,"další_info":null}

Feld "řešení" = 2–4 ENDGÜLTIGE Reparaturmaßnahmen, die das Problem beheben. Jede Aktion = konkrete Reparatur/Austausch, die der Mechaniker durchführt (max 8 Wörter). DARF KEINE Diagnose-/Messschritte enthalten (Messen, Prüfen, Testen, Kontrollieren) — diese gehören in "postup" oder "doporučené_testy". Beispiele: Kühlmittelverlust → ["Zylinderkopfdichtung ersetzen","Zylinderkopf ersetzen","Kopfschrauben nachziehen"]. Turbo-Leistungsverlust → ["Turboschlauch wieder anschließen","Turboschlauch ersetzen","Schlauchschelle nachziehen"]. Fehlerhafte Einspritzung → ["Injektor ersetzen","ECU-Adaptionen löschen","Kraftstoffleiste ersetzen"]. DPF verstopft → ["Zwangsregeneration","DPF-Filter ersetzen","DPF-Reinigung"]. FALSCH: "Kompression messen", "Verkabelung prüfen", "Dichtheitsprüfung" — das sind KEINE Lösungen!

Schreibe alle WERTE (Beschreibungen, Fehlernamen, Reparaturverfahren, Anmerkungen) auf Deutsch.
Regeln: Du antwortest AUSSCHLIESSLICH auf Fragen zur Fahrzeugdiagnose und -reparatur. Bei einer nicht-diagnostischen Anfrage gib JSON mit název "Nicht verwandte Anfrage" und pravděpodobnost 0 und popis "Dieses System dient nur der Fahrzeugdiagnose." zurück. Sonst: Wenn du es nicht weißt, gib es zu. Gib IMMER genau 3 wahrscheinlichste Fehler sortiert nach Wahrscheinlichkeit zurück — auch bei starker Datenbankübereinstimmung, ergänze weitere mögliche Ursachen. naléhavost-Werte: nízká/střední/vysoká/kritická. Berücksichtige EU-Spezifika (AdBlue, DPF Euro6). Feld "zdroj": auf "databáze" setzen wenn der Fehler auf einer RAG-Datenbankübereinstimmung basiert, sonst "ai". Feld "početShod": für "databáze"-Quelle die Anzahl passender Datenbankfälle angeben, für "ai" auf 0 setzen. GIB NUR JSON ZURÜCK.`,
}

export function buildSystemPrompt(similarCases, vehicle = {}, lang) {
  const entry    = getBrandEntry(vehicle.brand)
  const expertise = entry?.expertise
    ?? "užitková vozidla pro evropský trh (EU spec), včetně systémů AdBlue, DPF Euro 5/6 a SCR"
  const ragBlock = similarCases.length > 0 ? buildRagBlock(similarCases, lang) : ""
  const builder  = SYSTEM_PROMPTS[lang] || SYSTEM_PROMPTS.cs
  const fuelType = detectFuelType(vehicle.enginePower)
  const fuelBlock = buildFuelBlock(fuelType, vehicle, lang)

  return builder(expertise, ragBlock) + fuelBlock
}

function buildFuelBlock(fuelType, vehicle, lang) {
  if (!fuelType) return ""

  const labels = FUEL_LABELS[lang] || FUEL_LABELS.cs
  const rules  = FUEL_RULES[lang] || FUEL_RULES.cs
  const label  = labels[fuelType]
  const rule   = rules[fuelType]

  const vehicleDesc = [vehicle.brand, vehicle.model, vehicle.enginePower].filter(Boolean).join(" ")

  return `\n\n🔧 TYP POHONU: ${label} (${vehicleDesc})\n${rule}`
}

// ── Localized RAG block labels ────────────────────────────────────────────────
const RAG_LABELS = {
  cs: {
    high: "🔴 VYSOKÁ SHODA", mid: "🟡 STŘEDNÍ SHODA", low: "🟢 ČÁSTEČNÁ SHODA",
    score: "skóre", symptoms: "Příznaky", solution: "✅ Ověřené řešení",
    title: "OVĚŘENÉ OPRAVY Z DATABÁZE SERVISU",
    instrTitle: "INSTRUKCE K DATABÁZI",
    instrHigh:  "🔴 VYSOKÁ SHODA: Toto řešení MUSÍ být na 1. nebo 2. místě — má prokázaný výsledek na velmi podobném vozidle se shodnými OBD kódy i příznaky.",
    instrMid:   "🟡 STŘEDNÍ SHODA: Zahrň jako pravděpodobnou variantu, uveď výše než obecné hypotézy.",
    instrLow:   "🟢 ČÁSTEČNÁ SHODA: Zmiň jako možnost, hodnoť volně podle ostatních příznaků.",
    instrNote:  "Pokud databázové řešení neodpovídá aktuálním příznakům, vysvětli proč se liší.",
  },
  en: {
    high: "🔴 HIGH MATCH", mid: "🟡 MEDIUM MATCH", low: "🟢 PARTIAL MATCH",
    score: "score", symptoms: "Symptoms", solution: "✅ Verified solution",
    title: "VERIFIED REPAIRS FROM SERVICE DATABASE",
    instrTitle: "DATABASE INSTRUCTIONS",
    instrHigh:  "🔴 HIGH MATCH: This solution MUST be ranked 1st or 2nd — it has a proven result on a very similar vehicle with matching OBD codes and symptoms.",
    instrMid:   "🟡 MEDIUM MATCH: Include as a likely variant, rank above generic hypotheses.",
    instrLow:   "🟢 PARTIAL MATCH: Mention as a possibility, evaluate freely based on other symptoms.",
    instrNote:  "If the database solution does not match current symptoms, explain why it differs.",
  },
  de: {
    high: "🔴 HOHE ÜBEREINSTIMMUNG", mid: "🟡 MITTLERE ÜBEREINSTIMMUNG", low: "🟢 TEILWEISE ÜBEREINSTIMMUNG",
    score: "Punktzahl", symptoms: "Symptome", solution: "✅ Verifizierte Lösung",
    title: "VERIFIZIERTE REPARATUREN AUS DER SERVICEDATENBANK",
    instrTitle: "DATENBANK-ANWEISUNGEN",
    instrHigh:  "🔴 HOHE ÜBEREINSTIMMUNG: Diese Lösung MUSS auf Platz 1 oder 2 stehen — sie hat ein nachgewiesenes Ergebnis bei einem sehr ähnlichen Fahrzeug mit übereinstimmenden OBD-Codes und Symptomen.",
    instrMid:   "🟡 MITTLERE ÜBEREINSTIMMUNG: Als wahrscheinliche Variante einbeziehen, über allgemeinen Hypothesen einordnen.",
    instrLow:   "🟢 TEILWEISE ÜBEREINSTIMMUNG: Als Möglichkeit erwähnen, frei nach anderen Symptomen bewerten.",
    instrNote:  "Wenn die Datenbanklösung nicht zu den aktuellen Symptomen passt, erkläre warum sie abweicht.",
  },
}

function buildRagBlock(cases, lang) {
  const L = RAG_LABELS[lang] || RAG_LABELS.cs

  const entries = cases.map((c, i) => {
    const { symptoms, obdCodes } = extractSignals(c)
    const vehicle = [c.vehicle?.brand, c.vehicle?.model, c.vehicle?.enginePower].filter(Boolean).join(" ") || "?"
    const score   = c.ragScore ?? 0

    const strength = score >= 8 ? L.high : score >= 5 ? L.mid : L.low

    return (
      `[${i + 1}] ${strength} (${L.score}: ${score.toFixed(1)}) | ${vehicle}\n` +
      `   ${L.symptoms}: ${symptoms.join(", ") || "—"}\n` +
      `   OBD: ${obdCodes.join(", ") || "—"}\n` +
      `   ${L.solution}: ${c.resolution}`
    )
  })

  return `

${L.title}:
${entries.join("\n\n")}

${L.instrTitle}:
- ${L.instrHigh}
- ${L.instrMid}
- ${L.instrLow}
${L.instrNote}`
}
