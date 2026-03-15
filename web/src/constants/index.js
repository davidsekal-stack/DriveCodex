// ── Katalog vozidel ───────────────────────────────────────────────────────────
//
// Centrální datová struktura pro všechny podporované značky.
//
// active: true  → zobrazuje se v GUI (výběr modelu, system prompt...)
// active: false → data připravena v katalogu, GUI je zatím nezobrazuje
//
// expertise → odborný kontext vložený do AI system promptu pro tuto značku

export const VEHICLE_CATALOG = [
  {
    brand:     "Ford",
    active:    true,
    expertise: "Ford Transit všech generací a variant (TDCi, EcoBlue, EcoBoost, Elektro) od roku 2006 do současnosti, EU spec (AdBlue, DPF Euro 5/6, SCR systémy)",
    models: [
      // ── 1. Transit (velká dodávka) ──────────────────────────────────────────
      { group: "Transit (velká dodávka)" },
      { label: "Transit MK7 2.2 TDCi (2006–2011)",        powers: ["63 kW (85 k)", "81 kW (110 k)", "85 kW (115 k)", "96 kW (130 k)", "103 kW (140 k)"] },
      { label: "Transit MK7 2.4 TDCi (2006–2011)",        powers: ["74 kW (100 k)", "85 kW (115 k)", "103 kW (140 k)"] },
      { label: "Transit MK7 3.2 TDCi (2006–2011)",        powers: ["147 kW (200 k)"] },
      { label: "Transit MK7 2.3 Duratec (2006–2011)",     powers: ["107 kW (145 k)"] },
      { label: "Transit MK7 FL 2.2 TDCi (2011–2014)",     powers: ["74 kW (100 k)", "92 kW (125 k)", "114 kW (155 k)"] },
      { label: "Transit MK8 2.2 TDCi (2014–2016)",        powers: ["74 kW (100 k)", "92 kW (125 k)", "114 kW (155 k)"] },
      { label: "Transit MK8 2.0 EcoBlue (2016–současnost)", powers: ["77 kW (105 k)", "96 kW (130 k)", "125 kW (170 k)", "136 kW (185 k)"] },
      { label: "E-Transit Elektro (2022–současnost)",      powers: ["135 kW (184 k)", "198 kW (269 k)"] },

      // ── 2. Transit Custom (střední dodávka) ────────────────────────────────
      { group: "Transit Custom" },
      { label: "Transit Custom I 2.2 TDCi (2012–2016)",          powers: ["74 kW (100 k)", "92 kW (125 k)", "113 kW (154 k)"] },
      { label: "Transit Custom I FL 2.0 EcoBlue (2016–2023)",    powers: ["77 kW (105 k)", "96 kW (130 k)", "125 kW (170 k)", "136 kW (185 k)"] },
      { label: "Transit Custom I 1.0 EcoBoost PHEV (2019–2023)", powers: ["93 kW (126 k)"] },
      { label: "Transit Custom II 2.0 EcoBlue (2023–současnost)", powers: ["81 kW (110 k)", "100 kW (136 k)", "110 kW (150 k)", "125 kW (170 k)"] },
      { label: "Transit Custom II 2.5 Duratec PHEV (2023–současnost)", powers: ["171 kW (232 k)"] },
      { label: "E-Transit Custom Elektro (2024–současnost)",     powers: ["100 kW (136 k)", "160 kW (218 k)", "210 kW (285 k)"] },

      // ── 3. Transit Connect (kompaktní dodávka) ─────────────────────────────
      { group: "Transit Connect" },
      { label: "Transit Connect I 1.8 TDCi (2006–2013)",         powers: ["55 kW (75 k)", "66 kW (90 k)", "81 kW (110 k)"] },
      { label: "Transit Connect II 1.6 TDCi (2013–2015)",        powers: ["55 kW (75 k)", "70 kW (95 k)", "85 kW (115 k)"] },
      { label: "Transit Connect II 1.0 EcoBoost (2013–2018)",    powers: ["74 kW (100 k)"] },
      { label: "Transit Connect II 1.5 TDCi (2015–2018)",        powers: ["55 kW (75 k)", "74 kW (100 k)", "88 kW (120 k)"] },
      { label: "Transit Connect II FL 1.5 EcoBlue (2018–2024)",  powers: ["55 kW (75 k)", "74 kW (100 k)", "88 kW (120 k)"] },
      { label: "Transit Connect III 2.0 EcoBlue (2024–současnost)", powers: ["75 kW (102 k)", "90 kW (122 k)"] },
      { label: "Transit Connect III 1.5 EcoBoost PHEV (2024–současnost)", powers: ["110 kW (150 k)"] },

      // ── 4. Transit Courier (nejmenší dodávka) ──────────────────────────────
      { group: "Transit Courier" },
      { label: "Transit Courier I 1.5/1.6 TDCi (2014–2023)",    powers: ["55 kW (75 k)", "70 kW (95 k)", "74 kW (100 k)"] },
      { label: "Transit Courier I 1.0 EcoBoost (2014–2023)",    powers: ["74 kW (100 k)"] },
      { label: "Transit Courier II 1.0 EcoBoost (2023–současnost)", powers: ["74 kW (100 k)", "92 kW (125 k)"] },
      { label: "Transit Courier II 1.5 EcoBlue (2023–současnost)", powers: ["74 kW (100 k)"] },
      { label: "E-Transit Courier Elektro (2025–současnost)",    powers: ["100 kW (136 k)"] },
    ],
  },

  {
    brand:     "Volkswagen",
    active:    true,
    expertise: "Volkswagen osobní a užitková vozidla všech modelových řad (Polo, Golf, Jetta, Passat, Arteon, Tiguan, T-Roc, Touareg, Touran, Sharan, Caddy, Transporter, Crafter, ID série) — motory TSI, TDI, MPI, FSI, TFSI a elektrické pohony od roku 2006 do současnosti, EU spec (AdBlue, DPF Euro 5/6, SCR systémy)",
    models: [
      // ── Polo ──────────────────────────────────────────────────────────────────
      { group: "Polo" },
      { label: "Polo IV (2006–2009)", powers: ["44 kW – 1.2", "47 kW – 1.2", "59 kW – 1.4", "63 kW – 1.4", "51 kW – 1.4 TDI", "59 kW – 1.4 TDI", "74 kW – 1.9 TDI"] },
      { label: "Polo V (2009–2017)", powers: ["44 kW – 1.0 MPI", "55 kW – 1.0 MPI", "66 kW – 1.2", "77 kW – 1.2 TSI", "81 kW – 1.2 TSI", "90 kW – 1.4 TSI", "55 kW – 1.4 TDI", "66 kW – 1.6 TDI", "77 kW – 1.6 TDI", "141 kW – 1.8 TSI GTI"] },
      { label: "Polo VI (2017–dosud)", powers: ["48 kW – 1.0 MPI", "59 kW – 1.0 MPI", "70 kW – 1.0 TSI", "81 kW – 1.0 TSI", "85 kW – 1.0 TSI", "110 kW – 1.5 TSI", "147 kW – 2.0 TSI GTI", "59 kW – 1.6 TDI", "70 kW – 1.6 TDI"] },

      // ── Golf ──────────────────────────────────────────────────────────────────
      { group: "Golf" },
      { label: "Golf V (2006–2008)", powers: ["55 kW – 1.4", "75 kW – 1.6", "66 kW – 1.9 TDI", "77 kW – 1.9 TDI", "103 kW – 2.0 TDI", "147 kW – 2.0 TFSI GTI", "184 kW – 3.2 VR6 R32"] },
      { label: "Golf VI (2008–2012)", powers: ["77 kW – 1.2 TSI", "90 kW – 1.4 TSI", "118 kW – 1.4 TSI", "66 kW – 1.6 TDI", "81 kW – 2.0 TDI", "103 kW – 2.0 TDI", "155 kW – 2.0 TSI GTI"] },
      { label: "Golf VII (2012–2020)", powers: ["63 kW – 1.0 TSI", "85 kW – 1.0 TSI", "63 kW – 1.2 TSI", "77 kW – 1.2 TSI", "90 kW – 1.4 TSI", "103 kW – 1.4 TSI", "96 kW – 1.5 TSI", "110 kW – 1.5 TSI", "66 kW – 1.6 TDI", "81 kW – 1.6 TDI", "110 kW – 2.0 TDI", "135 kW – 2.0 TDI GTD", "162 kW – 2.0 TSI GTI", "169 kW – 2.0 TSI GTI", "221 kW – 2.0 TSI R", "228 kW – 2.0 TSI R"] },
      { label: "Golf VIII (2020–dosud)", powers: ["81 kW – 1.0 TSI", "96 kW – 1.5 TSI", "110 kW – 1.5 TSI", "85 kW – 2.0 TDI", "110 kW – 2.0 TDI", "180 kW – 2.0 TSI GTI", "235 kW – 2.0 TSI R"] },

      // ── Jetta ─────────────────────────────────────────────────────────────────
      { group: "Jetta" },
      { label: "Jetta V (2006–2010)", powers: ["75 kW – 1.6", "90 kW – 1.4 TSI", "103 kW – 1.4 TSI", "77 kW – 1.9 TDI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI", "147 kW – 2.0 TFSI"] },
      { label: "Jetta VI (2010–2018)", powers: ["77 kW – 1.2 TSI", "90 kW – 1.4 TSI", "110 kW – 1.4 TSI", "77 kW – 1.6 TDI", "81 kW – 2.0 TDI", "103 kW – 2.0 TDI", "110 kW – 2.0 TDI"] },
      { label: "Jetta VII (2018–dosud)", powers: ["81 kW – 1.0 TSI", "85 kW – 1.0 TSI", "96 kW – 1.5 TSI", "110 kW – 1.5 TSI", "110 kW – 2.0 TDI"] },

      // ── Passat ────────────────────────────────────────────────────────────────
      { group: "Passat" },
      { label: "Passat B6 (2006–2010)", powers: ["85 kW – 1.6 FSI", "118 kW – 1.8 TSI", "81 kW – 2.0 TDI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI", "147 kW – 2.0 TFSI", "220 kW – 3.6 VR6"] },
      { label: "Passat B7 (2010–2014)", powers: ["90 kW – 1.4 TSI", "110 kW – 1.4 TSI", "118 kW – 1.8 TSI", "132 kW – 1.8 TSI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI", "130 kW – 2.0 TDI", "155 kW – 2.0 TSI", "220 kW – 3.6 VR6"] },
      { label: "Passat B8 (2014–2023)", powers: ["110 kW – 1.5 TSI", "140 kW – 2.0 TSI", "200 kW – 2.0 TSI", "110 kW – 2.0 TDI", "140 kW – 2.0 TDI", "176 kW – 2.0 TDI"] },
      { label: "Passat B9 (2023–dosud)", powers: ["110 kW – 1.5 TSI", "150 kW – 1.5 TSI eHybrid", "200 kW – 1.5 TSI eHybrid", "110 kW – 2.0 TDI", "142 kW – 2.0 TDI"] },

      // ── Arteon ────────────────────────────────────────────────────────────────
      { group: "Arteon" },
      { label: "Arteon I (2017–2023)", powers: ["110 kW – 1.5 TSI", "140 kW – 2.0 TSI", "206 kW – 2.0 TSI", "110 kW – 2.0 TDI", "147 kW – 2.0 TDI", "235 kW – 2.0 TSI R"] },
      { label: "Arteon II (2023–dosud)", powers: ["110 kW – 1.5 TSI", "150 kW – 2.0 TSI", "110 kW – 2.0 TDI", "142 kW – 2.0 TDI"] },

      // ── Tiguan ────────────────────────────────────────────────────────────────
      { group: "Tiguan" },
      { label: "Tiguan I (2007–2016)", powers: ["110 kW – 1.4 TSI", "118 kW – 1.4 TSI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI", "135 kW – 2.0 TDI", "125 kW – 2.0 TSI", "147 kW – 2.0 TSI", "155 kW – 2.0 TSI"] },
      { label: "Tiguan II (2016–2023)", powers: ["96 kW – 1.5 TSI", "110 kW – 1.5 TSI", "132 kW – 2.0 TSI", "180 kW – 2.0 TSI", "110 kW – 2.0 TDI", "147 kW – 2.0 TDI", "235 kW – 2.0 TSI R"] },
      { label: "Tiguan III (2023–dosud)", powers: ["96 kW – 1.5 TSI", "110 kW – 1.5 TSI", "150 kW – 1.5 TSI eHybrid", "200 kW – 1.5 TSI eHybrid", "110 kW – 2.0 TDI", "142 kW – 2.0 TDI"] },

      // ── T-Roc ─────────────────────────────────────────────────────────────────
      { group: "T-Roc" },
      { label: "T-Roc (2017–dosud)", powers: ["81 kW – 1.0 TSI", "85 kW – 1.0 TSI", "110 kW – 1.5 TSI", "140 kW – 2.0 TSI", "221 kW – 2.0 TSI R", "85 kW – 1.6 TDI", "110 kW – 2.0 TDI", "140 kW – 2.0 TDI"] },

      // ── Touareg ───────────────────────────────────────────────────────────────
      { group: "Touareg" },
      { label: "Touareg II (2010–2018)", powers: ["150 kW – 3.0 V6 TDI", "176 kW – 3.0 V6 TDI", "193 kW – 3.0 V6 TDI", "204 kW – 3.0 V6 TDI", "206 kW – 3.6 V6 FSI", "250 kW – 4.2 V8 TDI"] },
      { label: "Touareg III (2018–dosud)", powers: ["170 kW – 3.0 V6 TDI", "210 kW – 3.0 V6 TDI", "231 kW – 3.0 V6 TDI", "280 kW – 3.0 V6 TSI eHybrid", "340 kW – 3.0 V6 TSI eHybrid R"] },

      // ── Touran ────────────────────────────────────────────────────────────────
      { group: "Touran" },
      { label: "Touran II (2015–dosud)", powers: ["81 kW – 1.2 TSI", "110 kW – 1.4 TSI", "110 kW – 1.5 TSI", "81 kW – 1.6 TDI", "110 kW – 2.0 TDI", "140 kW – 2.0 TDI"] },

      // ── Sharan ────────────────────────────────────────────────────────────────
      { group: "Sharan" },
      { label: "Sharan II (2010–2022)", powers: ["110 kW – 1.4 TSI", "147 kW – 2.0 TSI", "85 kW – 2.0 TDI", "103 kW – 2.0 TDI", "130 kW – 2.0 TDI", "135 kW – 2.0 TDI"] },

      // ── Caddy ─────────────────────────────────────────────────────────────────
      { group: "Caddy" },
      { label: "Caddy III (2006–2015)", powers: ["55 kW – 1.4", "75 kW – 1.6", "63 kW – 1.2 TSI", "77 kW – 1.2 TSI", "55 kW – 1.6 TDI", "75 kW – 1.6 TDI", "81 kW – 2.0 TDI", "103 kW – 2.0 TDI", "125 kW – 2.0 TDI"] },
      { label: "Caddy IV (2015–2020)", powers: ["75 kW – 1.0 TSI", "62 kW – 1.2 TSI", "92 kW – 1.4 TSI", "55 kW – 2.0 TDI", "75 kW – 2.0 TDI", "103 kW – 2.0 TDI", "110 kW – 2.0 TDI"] },
      { label: "Caddy V (2020–dosud)", powers: ["84 kW – 1.5 TSI", "96 kW – 1.5 TSI", "55 kW – 2.0 TDI", "75 kW – 2.0 TDI", "90 kW – 2.0 TDI", "110 kW – 2.0 TDI"] },

      // ── Transporter ───────────────────────────────────────────────────────────
      { group: "Transporter" },
      { label: "Transporter T5 (2006–2015)", powers: ["85 kW – 2.0", "62 kW – 1.9 TDI", "75 kW – 1.9 TDI", "77 kW – 1.9 TDI", "96 kW – 2.5 TDI", "128 kW – 2.5 TDI", "62 kW – 2.0 TDI", "75 kW – 2.0 TDI", "103 kW – 2.0 TDI", "132 kW – 2.0 BiTDI"] },
      { label: "Transporter T6 (2015–2019)", powers: ["62 kW – 2.0 TDI", "75 kW – 2.0 TDI", "81 kW – 2.0 TDI", "103 kW – 2.0 TDI", "110 kW – 2.0 TDI", "150 kW – 2.0 TDI", "132 kW – 2.0 BiTDI", "150 kW – 2.0 TSI"] },
      { label: "Transporter T6.1 (2019–dosud)", powers: ["66 kW – 2.0 TDI", "81 kW – 2.0 TDI", "110 kW – 2.0 TDI", "150 kW – 2.0 TDI", "146 kW – 2.0 BiTDI"] },

      // ── Crafter ───────────────────────────────────────────────────────────────
      { group: "Crafter" },
      { label: "Crafter I (2006–2016)", powers: ["65 kW – 2.5 TDI", "80 kW – 2.5 TDI", "100 kW – 2.5 TDI", "120 kW – 2.5 TDI", "80 kW – 2.0 TDI", "100 kW – 2.0 TDI", "120 kW – 2.0 TDI"] },
      { label: "Crafter II (2016–dosud)", powers: ["75 kW – 2.0 TDI", "90 kW – 2.0 TDI", "103 kW – 2.0 TDI", "130 kW – 2.0 TDI", "177 kW – 2.0 TDI", "100 kW – e-Crafter Electric"] },

      // ── ID (elektro) ─────────────────────────────────────────────────────────
      { group: "ID (elektro)" },
      { label: "ID.3 (2020–dosud)", powers: ["107 kW – Electric Pro", "125 kW – Electric Pro", "150 kW – Electric Pro S", "170 kW – Electric Pro S", "210 kW – Electric GTX"] },
      { label: "ID.4 (2020–dosud)", powers: ["109 kW – Electric Pure", "125 kW – Electric Pro", "150 kW – Electric Pro", "195 kW – Electric Pro S", "210 kW – Electric GTX", "220 kW – Electric GTX"] },
      { label: "ID.5 (2021–dosud)", powers: ["128 kW – Electric Pro", "150 kW – Electric Pro", "195 kW – Electric Pro S", "210 kW – Electric GTX", "220 kW – Electric GTX"] },
    ],
  },

  // ── Připraveno, zatím neaktivní ───────────────────────────────────────────

  {
    brand:     "Mercedes-Benz",
    active:    false,
    expertise: "Mercedes-Benz Sprinter a Vito CDI/d všech generací, EU spec (BlueTEC, AdBlue, OM651/OM654)",
    models: [
      { group: "Sprinter W906" },
      { label: "Sprinter 314 CDI (2006–2018)" },
      { label: "Sprinter 316 CDI (2006–2018)" },
      { group: "Sprinter W907/W910" },
      { label: "Sprinter 314 CDI (2018–současnost)" },
      { label: "Sprinter 316 CDI (2018–současnost)" },
      { group: "Vito W447" },
      { label: "Vito 114 CDI (2014–současnost)" },
      { label: "Vito 116 CDI (2014–současnost)" },
    ],
  },

  {
    brand:     "Renault",
    active:    false,
    expertise: "Renault Master a Trafic dCi všech generací, EU spec (AdBlue od Euro 6)",
    models: [
      { group: "Master III/IV" },
      { label: "Master 2.3 dCi (2010–současnost)" },
      { group: "Trafic III" },
      { label: "Trafic 2.0 dCi (2014–současnost)" },
      { label: "Trafic 1.6 dCi (2014–2019)" },
    ],
  },
]

// ── Odvozené konstanty ────────────────────────────────────────────────────────

/** Vyhledá záznam katalogu podle značky (case-insensitive) */
export function getBrandEntry(brand) {
  if (!brand) return null
  return VEHICLE_CATALOG.find(b => b.brand.toLowerCase() === brand.toLowerCase()) ?? null
}

/** Pouze aktivní značky — zobrazují se v GUI */
export const ACTIVE_BRANDS = VEHICLE_CATALOG.filter(b => b.active)

/**
 * Flat seznam modelů aktivních značek pro <select> v GUI.
 * Pokud je aktivních značek více, přidá nadpis značky jako group separator.
 */
export const VEHICLE_MODELS = ACTIVE_BRANDS.length === 1
  ? ACTIVE_BRANDS[0].models
  : ACTIVE_BRANDS.flatMap(b => [{ group: b.brand }, ...b.models])

/** Výchozí značka pro nový případ */
export const DEFAULT_BRAND  = ACTIVE_BRANDS[0]?.brand ?? ""

/** Prázdné vozidlo pro nový případ */
export const EMPTY_VEHICLE  = { brand: DEFAULT_BRAND, model: "", mileage: "", enginePower: "" }

/** Vrátí pole modelů pro danou značku (pro dynamický model select) */
export function getBrandModels(brand) {
  if (!brand) return []
  const entry = getBrandEntry(brand)
  return entry?.models ?? []
}

/** Vrátí pole dostupných výkonů pro daný model (label) */
export function getModelPowers(modelLabel) {
  if (!modelLabel) return []
  for (const brand of VEHICLE_CATALOG) {
    const entry = brand.models.find(m => m.label === modelLabel)
    if (entry?.powers) return entry.powers
  }
  return []
}

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

// ── Časté OBD kódy ────────────────────────────────────────────────────────────
export const COMMON_OBD_CODES = [
  "P0087", "P0093", "P0191", "P0401", "P0402", "P0403",
  "P0489", "P0490", "P1000", "P2002", "P2003", "P2263",
  "P2599", "P242F", "P246C", "U0001",
]
