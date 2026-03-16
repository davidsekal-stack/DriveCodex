// ── Příznaky podle kategorie (klíče do i18n) ─────────────────────────────────
// V DB se ukládají klíče (sym.*), v GUI se překládají přes tr().
export const SYMPTOM_CATEGORIES = [
  { catKey: "sym.cat.engine", symptoms: ["sym.lossOfPower", "sym.blackSmoke", "sym.whiteSmoke", "sym.excessFuel", "sym.roughIdle", "sym.stalling", "sym.hardStart", "sym.noStart", "sym.limpMode", "sym.overheating", "sym.oilConsumption"] },
  { catKey: "sym.cat.transmission", symptoms: ["sym.shiftVibration", "sym.hardShifting", "sym.clutchSlip", "sym.shiftJerks", "sym.gearboxNoise", "sym.accelDropout"] },
  { catKey: "sym.cat.brakes", symptoms: ["sym.absLight", "sym.brakePulse", "sym.brakePull", "sym.chassisNoise", "sym.steeringVibration", "sym.unevenTyreWear"] },
  { catKey: "sym.cat.steering", symptoms: ["sym.heavySteering", "sym.steeringPlay", "sym.steeringClick", "sym.pullingSide", "sym.steeringLight"] },
  { catKey: "sym.cat.electrical", symptoms: ["sym.milLight", "sym.electricalDropout", "sym.alternatorIssue", "sym.batteryDrain", "sym.centralLockIssue", "sym.dashErrors"] },
  { catKey: "sym.cat.exhaust", symptoms: ["sym.dpfLight", "sym.adblueWarning", "sym.exhaustSmell", "sym.accelSmoke", "sym.dpfRegenFail"] },
]
