import { extractSignals } from "./rag.js";
import { getBrandEntry }  from "../constants/index.js";
import { translate }       from "../i18n/translate.js";

// ── Limity ────────────────────────────────────────────────────────────────────

export const CASE_TOKEN_LIMIT = 40_000

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
export function checkTopicRelevance(text, lang) {
  const trimmed = (text ?? "").trim()

  // Krátké texty vždy projdou — jsou to doplňující odpovědi v kontextu případu
  if (trimmed.length <= 80) return { ok: true, reason: null }

  // Delší text musí obsahovat alespoň jeden technický signál
  const hasObd        = OBD_CODE_PATTERN.test(trimmed)
  const hasTechAbbr   = TECH_ABBREVIATIONS.test(trimmed)
  const hasTechNumber = TECHNICAL_NUMBER.test(trimmed)

  if (hasObd || hasTechAbbr || hasTechNumber) {
    return { ok: true, reason: null }
  }

  return {
    ok: false,
    reason: translate('ai.topicIrrelevant', null, lang),
  }
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
{"shrnutí":"...","závady":[{"název":"...","pravděpodobnost":85,"popis":"...","příznaky_shoda":[],"obd_kódy":[],"díly":[],"postup":"...","naléhavost":"vysoká","poznámka":"...","zdroj":"databáze","shpipadů":2}],"doporučené_testy":[],"varování":null,"další_info":null}

Pravidla: Odpovídáš VÝHRADNĚ na otázky týkající se diagnostiky a opravy vozidel. Pokud dostaneš dotaz nesouvisející s diagnostikou vozidla, vrať JSON se závadou název "Nesouvisející dotaz" a pravděpodobností 0 a popisem "Tento systém slouží pouze pro diagnostiku vozidel." Jinak: Když nevíš, přiznej to. VŽDY uveď přesně 3 nejpravděpodobnější závady seřazené dle pravděpodobnosti — i když máš silnou shodu z databáze, doplň další možné příčiny. Naléhavost: nízká/střední/vysoká/kritická. Zohledni EU specifika (AdBlue, DPF Euro6). Pole "zdroj": nastav na "databáze" pokud závada vychází ze shody s případem z databáze (RAG), jinak "ai". Pole "shpipadů": u závad ze zdroje "databáze" uveď počet odpovídajících případů z databáze, u "ai" nastav na 0. VRAŤ POUZE JSON.`,

  en: (expertise, ragBlock) =>
    `You are an expert AI diagnostics system for mechanics specialising in ${expertise}.${ragBlock}

When you receive symptoms, OBD codes or a fault description, return ONLY valid JSON (no text before/after JSON).
IMPORTANT: The JSON keys MUST be in Czech exactly as shown below — do NOT translate the keys:
{"shrnutí":"...","závady":[{"název":"...","pravděpodobnost":85,"popis":"...","příznaky_shoda":[],"obd_kódy":[],"díly":[],"postup":"...","naléhavost":"vysoká","poznámka":"...","zdroj":"databáze","shpipadů":2}],"doporučené_testy":[],"varování":null,"další_info":null}

Write all VALUES (descriptions, fault names, repair procedures, notes) in English.
Rules: You answer ONLY questions related to vehicle diagnostics and repair. If you receive a non-diagnostic query, return JSON with fault název "Unrelated query" and pravděpodobnost 0 and popis "This system is for vehicle diagnostics only." Otherwise: If you don't know, admit it. ALWAYS return exactly 3 most probable faults sorted by probability — even if you have a strong database match, add other possible causes. naléhavost values: nízká/střední/vysoká/kritická. Consider EU specifics (AdBlue, DPF Euro6). Field "zdroj": set to "databáze" if the fault is based on a RAG database match, otherwise "ai". Field "shpipadů": for "databáze" source faults, set to the number of matching database cases; for "ai" set to 0. RETURN ONLY JSON.`,

  de: (expertise, ragBlock) =>
    `Du bist ein Experten-AI-Diagnosesystem für Mechaniker, spezialisiert auf ${expertise}.${ragBlock}

Wenn du Symptome, OBD-Codes oder eine Fehlerbeschreibung erhältst, gib NUR gültiges JSON zurück (kein Text vor/nach JSON).
WICHTIG: Die JSON-Schlüssel MÜSSEN auf Tschechisch sein, genau wie unten gezeigt — übersetze die Schlüssel NICHT:
{"shrnutí":"...","závady":[{"název":"...","pravděpodobnost":85,"popis":"...","příznaky_shoda":[],"obd_kódy":[],"díly":[],"postup":"...","naléhavost":"vysoká","poznámka":"...","zdroj":"databáze","shpipadů":2}],"doporučené_testy":[],"varování":null,"další_info":null}

Schreibe alle WERTE (Beschreibungen, Fehlernamen, Reparaturverfahren, Anmerkungen) auf Deutsch.
Regeln: Du antwortest AUSSCHLIESSLICH auf Fragen zur Fahrzeugdiagnose und -reparatur. Bei einer nicht-diagnostischen Anfrage gib JSON mit název "Nicht verwandte Anfrage" und pravděpodobnost 0 und popis "Dieses System dient nur der Fahrzeugdiagnose." zurück. Sonst: Wenn du es nicht weißt, gib es zu. Gib IMMER genau 3 wahrscheinlichste Fehler sortiert nach Wahrscheinlichkeit zurück — auch bei starker Datenbankübereinstimmung, ergänze weitere mögliche Ursachen. naléhavost-Werte: nízká/střední/vysoká/kritická. Berücksichtige EU-Spezifika (AdBlue, DPF Euro6). Feld "zdroj": auf "databáze" setzen wenn der Fehler auf einer RAG-Datenbankübereinstimmung basiert, sonst "ai". Feld "shpipadů": für "databáze"-Quelle die Anzahl passender Datenbankfälle angeben, für "ai" auf 0 setzen. GIB NUR JSON ZURÜCK.`,
}

export function buildSystemPrompt(similarCases, vehicle = {}, lang) {
  const entry    = getBrandEntry(vehicle.brand)
  const expertise = entry?.expertise
    ?? "užitková vozidla pro evropský trh (EU spec), včetně systémů AdBlue, DPF Euro 5/6 a SCR"
  const ragBlock = similarCases.length > 0 ? buildRagBlock(similarCases, lang) : ""
  const builder  = SYSTEM_PROMPTS[lang] || SYSTEM_PROMPTS.cs

  return builder(expertise, ragBlock)
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
