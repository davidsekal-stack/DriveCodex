export function buildCaseIdentLabel(vehicle, fallbackName) {
  return `${vehicle.brand} ${vehicle.model}`.trim() || fallbackName;
}
