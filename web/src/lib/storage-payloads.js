export function mapStoredCases(rows) {
  return (rows ?? []).map((row) => ({
    ...row.data,
    _rowId: row.id,
    _status: row.status,
  }));
}

export function sanitizeCaseForCloud(caseData) {
  const safeData = { ...caseData };

  if (safeData.vehicle) {
    const { identType, identValue, ...safeVehicle } = safeData.vehicle;
    safeData.vehicle = safeVehicle;
  }

  return safeData;
}

export function buildSaveCasePayload(userId, caseData, status, updatedAt) {
  return {
    user_id: userId,
    local_id: caseData.id,
    data: sanitizeCaseForCloud(caseData),
    status,
    updated_at: updatedAt,
  };
}

export function buildPushClosedCasePayload(kase, userId) {
  const inputs = (kase.messages ?? []).filter((message) => message.type === "input");
  const symptoms = [...new Set(inputs.flatMap((message) => message.symptoms ?? []))];
  const obdCodes = [...new Set(inputs.flatMap((message) => message.obdCodes ?? []))];
  const texts = inputs.map((message) => message.text).filter(Boolean);
  const mileage = parseInt(kase.vehicle?.mileage, 10);

  return {
    local_id: kase.id,
    user_id: userId,
    vehicle_brand: kase.vehicle?.brand || null,
    vehicle_model: kase.vehicle?.model || null,
    mileage: Number.isFinite(mileage) ? mileage : null,
    engine_power: kase.vehicle?.enginePower || null,
    symptoms,
    obd_codes: obdCodes,
    description: texts.join(" ") || null,
    resolution: kase.resolution,
    closed_at: kase.closedAt || new Date().toISOString(),
  };
}

export function buildFeedbackPayload(message, lang, userEmail) {
  return {
    message,
    userEmail: userEmail || null,
    lang: lang || "cs",
  };
}

export function buildSearchCasesPayload(ragInput, userId) {
  return {
    vehicle: ragInput.vehicle,
    symptoms: ragInput.symptoms,
    obdCodes: ragInput.obdCodes,
    text: ragInput.text,
    userId: userId ?? "web-anonymous",
  };
}
