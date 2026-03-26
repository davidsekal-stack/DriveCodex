/**
 * Detekce typu paliva z názvu motorizace + pravidla pro system prompt.
 */

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

export function buildFuelBlock(fuelType, vehicle, lang) {
  if (!fuelType) return ""

  const labels = FUEL_LABELS[lang] || FUEL_LABELS.cs
  const rules  = FUEL_RULES[lang] || FUEL_RULES.cs
  const label  = labels[fuelType]
  const rule   = rules[fuelType]

  const vehicleDesc = [vehicle.brand, vehicle.model, vehicle.enginePower].filter(Boolean).join(" ")

  return `\n\n🔧 TYP POHONU: ${label} (${vehicleDesc})\n${rule}`
}
