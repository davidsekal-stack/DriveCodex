export function collectCaseInputs(messages = [], inputMsg) {
  const prevInputs = messages.filter((message) => message.type === "input");
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

export function normalizeDiagnosisResult(parsed, tr, similarCount = 0) {
  const faults = Array.isArray(parsed?.závady)
    ? parsed.závady.map((fault) => ({ ...fault }))
    : [];

  while (faults.length < 3) {
    const index = faults.length + 1;
    faults.push({
      název: tr("diag.additionalCause", { num: index }),
      pravděpodobnost: Math.max(5, (faults[faults.length - 1]?.pravděpodobnost ?? 20) - 15),
      popis: tr("diag.additionalCauseDesc"),
      příznaky_shoda: [],
      obd_kódy: [],
      díly: [],
      řešení: [],
      postup: "",
      naléhavost: "nízká",
      poznámka: tr("diag.additionalCauseNote"),
      zdroj: "ai",
      početShod: 0,
    });
  }

  for (const fault of faults) {
    fault.početShod = fault.zdroj === "databáze" ? similarCount : 0;

    // Sanitize řešení — must be array of short strings
    if (!Array.isArray(fault.řešení)) fault.řešení = [];
    fault.řešení = fault.řešení
      .filter((r) => typeof r === "string" && r.trim().length > 0)
      .map((r) => r.trim().slice(0, 60))
      .slice(0, 4);
    fault.řešení = [...new Set(fault.řešení)];
  }

  return { ...parsed, závady: faults };
}

export function buildDiagnosedCaseName(vehicle = {}, primaryFaultName, fallbackName) {
  const vehicleLabel = vehicle.model?.split(" ").slice(0, 3).join(" ") || vehicle.brand || fallbackName;
  return primaryFaultName ? `${vehicleLabel} | ${primaryFaultName}` : fallbackName;
}
