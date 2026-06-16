import { MSG } from "../constants/enums.js";
import { MAX_REPAIR_STEPS, MAX_REPAIR_LENGTH } from "../constants/limits.js";

export function collectCaseInputs(messages = [], inputMsg) {
  // fromReply = konverzační otázka mechanika (vedla na textovou odpověď) — ta
  // NENÍ diagnostický příznak, takže ji do agregace vstupů nezahrnujeme.
  const prevInputs = messages.filter((message) => message.type === MSG.INPUT && !message.fromReply);
  const allInputs = [...prevInputs, inputMsg];

  return {
    allInputs,
    allSymptoms: [...new Set(allInputs.flatMap((message) => message.symptoms ?? []))],
    allObdCodes: [...new Set(allInputs.flatMap((message) => message.obdCodes ?? []))],
    allTexts: allInputs.map((message) => message.text).filter(Boolean),
  };
}

export function buildRagInput(vehicle = {}, allSymptoms = [], allObdCodes = [], allTexts = []) {
  return {
    vehicle,
    symptoms: allSymptoms,
    obdCodes: allObdCodes,
    text: allTexts.join(" "),
  };
}

export function buildDiagnosisUserPrompt({ vehicle = {}, allSymptoms = [], allObdCodes = [], allTexts = [], tr }) {
  return [
    (vehicle.brand || vehicle.model) && `${tr("app.userVehicle")}: ${[vehicle.brand, vehicle.model, vehicle.enginePower].filter(Boolean).join(" ")}`,
    vehicle.mileage && `${tr("app.userMileage")}: ${vehicle.mileage} km`,
    allSymptoms.length && `${tr("app.userSymptoms")}: ${allSymptoms.map((symptom) => tr(symptom)).join(", ")}`,
    allObdCodes.length && `${tr("app.userObd")}: ${allObdCodes.join(", ")}`,
    ...allTexts.map((text, index) => `${tr("app.userMechDesc")}${allTexts.length > 1 ? ` ${index + 1}` : ""}:\n${text}`),
  ].filter(Boolean).join("\n");
}

export async function searchSimilarCases(searchCases, ragInput) {
  try {
    const result = await searchCases(ragInput);
    return {
      cases: Array.isArray(result?.cases) ? result.cases : [],
      ok: result?.ok === true,
      error: result?.ok === false ? (result.error ?? null) : null,
    };
  } catch (error) {
    return {
      cases: [],
      ok: false,
      error,
    };
  }
}

export function removeMessageById(messages = [], messageId) {
  return messages.filter((message) => message.id !== messageId);
}

/**
 * Je naparsovaná AI odpověď konverzační (režim "odpověď"), ne diagnóza?
 * True když AI explicitně zvolila režim "odpověď", nebo vrátila text odpovědi
 * bez seznamu závad.
 */
export function isReplyResult(parsed) {
  if (!parsed || typeof parsed !== "object") return false;
  const hasReplyText = typeof parsed.odpověď === "string" && parsed.odpověď.trim().length > 0;
  const hasFaults = Array.isArray(parsed.závady) && parsed.závady.length > 0;
  // Explicitní režim "odpověď" platí jen s neprázdným textem — jinak (např.
  // protichůdný výstup "odpověď" + závady bez textu) raději propadne na diagnózu.
  if (parsed.režim === "odpověď") return hasReplyText;
  return hasReplyText && !hasFaults;
}

/** Poslední diagnóza v konverzaci (její `result`), nebo null když žádná není. */
export function getLatestDiagnosis(messages = []) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.type === MSG.DIAGNOSIS && messages[i]?.result) {
      return messages[i].result;
    }
  }
  return null;
}

/**
 * Serializuje předchozí diagnózu do textového bloku pro follow-up prompt,
 * aby na ni AI mohla navázat (drží procenta, vyřazuje vyloučené příčiny).
 * Vrací "" když diagnóza chybí.
 */
export function buildPriorDiagnosisContext(result, tr) {
  if (!result || !Array.isArray(result.závady) || result.závady.length === 0) return "";

  const faultLines = result.závady.map((fault, index) => {
    const prob = typeof fault.pravděpodobnost === "number" ? `${fault.pravděpodobnost} %` : "?";
    const desc = (fault.popis ?? "").trim();
    const shortDesc = desc.length > 220 ? `${desc.slice(0, 220)}…` : desc;
    return `${index + 1}. ${fault.název ?? "?"} (${prob})${shortDesc ? ` — ${shortDesc}` : ""}`;
  });

  return [
    `\n\n${tr("ai.priorDiagTitle")}`,
    result.shrnutí ? `${tr("ai.priorDiagSummary")}: ${result.shrnutí}` : null,
    `${tr("ai.priorDiagFaults")}:`,
    ...faultLines,
    tr("ai.priorDiagInstr"),
  ].filter(Boolean).join("\n");
}

export function normalizeDiagnosisResult(parsed, tr, similarCount = 0) {
  const faults = Array.isArray(parsed?.závady)
    ? parsed.závady.map((fault) => ({ ...fault }))
    : [];

  // Show only faults the AI actually identified — no placeholder padding

  for (const fault of faults) {
    fault.početShod = fault.zdroj === "databáze" ? similarCount : 0;

    // Sanitize řešení — must be array of short strings
    if (!Array.isArray(fault.řešení)) fault.řešení = [];
    fault.řešení = fault.řešení
      .filter((r) => typeof r === "string" && r.trim().length > 0)
      .map((r) => r.trim().slice(0, MAX_REPAIR_LENGTH))
      .slice(0, MAX_REPAIR_STEPS);
    fault.řešení = [...new Set(fault.řešení)];
  }

  return { ...parsed, závady: faults };
}

export function buildDiagnosedCaseName(vehicle = {}, primaryFaultName, fallbackName) {
  const vehicleLabel = vehicle.model?.split(" ").slice(0, 3).join(" ") || vehicle.brand || fallbackName;
  return primaryFaultName ? `${vehicleLabel} | ${primaryFaultName}` : fallbackName;
}
