// ── OBD kódy — tříúrovňový systém ────────────────────────────────────────────
// 1) Obecné (P0xxx/P2xxx) — SAE standard, platí pro všechna OBD-II vozidla
// 2) Dle technologie motoru — diesel, turbo, electric, hybrid, adblue
// 3) Dle značky (P1xxx) — manufacturer-specific kódy

// ── 1. Obecné SAE kódy (zobrazit vždy) ──────────────────────────────────────
export const COMMON_OBD_CODES = [
  "P0087", "P0093", "P0191", "P0300", "P0301", "P0401",
  "P0402", "P0403", "P0420", "P0430", "P0489", "P0490",
  "P0171", "P0172", "P0174", "P0175",
  "P2002", "P2003", "P2263", "P2599", "P242F", "P246C",
  "U0001",
]

// ── 2. Kódy dle technologie motoru ──────────────────────────────────────────
export const ENGINE_OBD_CODES = {
  diesel: [
    "P0380", // Glow plug circuit A
    "P0381", // Glow plug indicator circuit
    "P0670", // Glow plug module control circuit
    "P0671", // Glow plug cyl 1 circuit
    "P0088", // Fuel rail pressure too high
    "P0089", // Fuel pressure regulator performance
    "P0093", // Fuel system leak detected – large
    "P0201", // Injector circuit cyl 1
    "P0251", // Injection pump fuel metering A – malfunction
    "P0263", // Cyl 1 contribution/balance
  ],
  turbo: [
    "P0234", // Turbo overboost condition
    "P0235", // Turbo boost sensor A circuit
    "P0236", // Turbo boost sensor A range/performance
    "P0237", // Turbo boost sensor A circuit low
    "P0238", // Turbo boost sensor A circuit high
    "P0299", // Turbo underboost condition
    "P0243", // Turbo wastegate solenoid A
    "P0244", // Turbo wastegate solenoid A range/performance
    "P0245", // Turbo wastegate solenoid A low
    "P0246", // Turbo wastegate solenoid A high
  ],
  electric: [
    "P0A09", // DC/DC converter status
    "P0A0A", // High voltage system interlock circuit
    "P0A1F", // Battery energy control module
    "P0A80", // Replace hybrid battery pack
    "P0AA6", // Hybrid battery voltage system isolation fault
    "P0AFA", // 14V power module system performance
    "P0C73", // Drive motor A inverter temperature
    "P0D00", // Drive motor A control module
    "P0D14", // HV battery cell voltage low
    "P0D15", // HV battery cell voltage high
  ],
  hybrid: [
    "P0A0F", // Engine failed to start
    "P0A7F", // Hybrid battery pack deterioration
    "P0A80", // Replace hybrid battery pack
    "P0A94", // DC/DC converter performance
    "P0AF5", // Hybrid battery system voltage
    "P0C24", // Drive motor A inverter performance
    "P3000", // HV battery pack malfunction
    "P3004", // HV battery pack cooling fan
    "P3009", // HV battery voltage
    "P3011", // Battery block temperature
  ],
  adblue: [
    "P20EE", // SCR NOx catalyst efficiency below threshold
    "P2BAD", // NOx exceedance – SCR system
    "P207F", // Reductant quality performance
    "P2080", // Exhaust gas temp sensor range
    "P203B", // Reductant level sensor circuit range
    "P203D", // Reductant level too low
    "P204F", // Reductant system – forced limited power
    "P20BD", // Reductant heater control circuit
    "P2200", // NOx sensor circuit bank 1
    "P2201", // NOx sensor circuit range bank 1
  ],
}

// ── 3. Kódy dle značky (manufacturer-specific P1xxx) ────────────────────────
export const BRAND_OBD_CODES = {
  "Ford": [
    "P1000", // OBD monitor testing not complete
    "P1131", // Lack of HO2S switch – lean (bank 1)
    "P1151", // Lack of HO2S switch – lean (bank 2)
    "P1260", // Theft detected – engine disabled
    "P1299", // Cylinder head overtemperature protection
    "P1450", // Unable to bleed up fuel tank vacuum
    "P1633", // KAM voltage too low
    "P1744", // Torque converter clutch system performance
    "P2008", // Intake manifold runner control circuit
    "P2196", // O2 sensor signal biased/stuck rich (bank 1)
  ],
  "Volkswagen": [
    "P1545", // Throttle valve controller malfunction
    "P1564", // Quantity adjuster deviation
    "P1388", // Internal control module – KP drive error
    "P1425", // Tank ventilation valve short circuit
    "P1136", // Fuel trim mixture too lean (bank 1 long)
    "P1137", // Fuel trim mixture too rich (bank 1 long)
    "P1297", // Turbocharger connection between MAF and turbo
    "P1609", // Crash signal – airbag
    "P1602", // Power supply (B+) terminal 30 – voltage low
    "P1250", // Fuel pump relay contact defect
  ],
  "Škoda": [
    "P1545", // Throttle valve controller malfunction
    "P1564", // Quantity adjuster deviation
    "P1388", // Internal control module – KP drive error
    "P1425", // Tank ventilation valve short circuit
    "P1136", // Fuel trim mixture too lean (bank 1 long)
    "P1137", // Fuel trim mixture too rich (bank 1 long)
    "P1297", // Turbocharger MAF-turbo connection
    "P1609", // Crash signal – airbag
    "P1602", // Power supply B+ voltage low
    "P1176", // O2 correction bank 1
  ],
  "Audi": [
    "P1545", // Throttle valve controller malfunction
    "P1564", // Quantity adjuster deviation
    "P1388", // Internal control module – KP drive error
    "P1425", // Tank ventilation valve short circuit
    "P1128", // Fuel trim long term – lean (bank 1)
    "P1129", // Fuel trim long term – rich (bank 1)
    "P1297", // Turbocharger MAF-turbo connection
    "P1602", // Power supply B+ voltage low
    "P1340", // Crankshaft–camshaft position misalignment
    "P1250", // Fuel pump relay contact defect
  ],
  "Toyota": [
    "P1346", // VVT sensor performance (bank 1)
    "P1349", // VVT system malfunction (bank 1)
    "P1300", // Igniter circuit malfunction – No. 1
    "P1310", // Igniter circuit malfunction – No. 2
    "P1130", // Air/fuel ratio sensor – circuit range (bank 1)
    "P1135", // Air/fuel ratio sensor heater circuit (bank 1)
    "P1150", // Air/fuel ratio sensor – circuit range (bank 2)
    "P1155", // Air/fuel ratio sensor heater circuit (bank 2)
    "P1604", // Startability malfunction
    "P1656", // OCV circuit (bank 1)
  ],
  "Renault": [
    "P1351", // Glow plug relay circuit
    "P1384", // Crankshaft position sensor intermittent
    "P1443", // EVAP canister purge valve 2
    "P1497", // Turbocharger bypass solenoid circuit
    "P1504", // Idle air control system
    "P1606", // Accelerator pedal sensor anomaly
    "P1610", // Injector unlock code not yet programmed
    "P1612", // ECU fault – EEPROM
    "P1614", // Immobilizer communication error
    "P1703", // Brake switch – permanent
  ],
  "Dacia": [
    "P1351", // Glow plug relay circuit
    "P1384", // Crankshaft position sensor intermittent
    "P1497", // Turbocharger bypass solenoid circuit
    "P1504", // Idle air control system
    "P1606", // Accelerator pedal sensor anomaly
    "P1610", // Injector unlock code not yet programmed
    "P1612", // ECU fault – EEPROM
    "P1614", // Immobilizer communication error
    "P1703", // Brake switch – permanent
    "P1443", // EVAP canister purge valve 2
  ],
  "Peugeot": [
    "P1336", // Crankshaft position sensor intermittent
    "P1340", // Crankshaft–camshaft sensor correlation
    "P1351", // Glow plug relay circuit
    "P1402", // EGR system – stuck closed
    "P1497", // Turbocharger bypass solenoid
    "P1504", // Idle speed control
    "P1611", // Immobilizer – code not yet programmed
    "P1612", // ECU fault – EEPROM
    "P1614", // Anti-start device communication
    "P1780", // Clutch pedal switch circuit
  ],
  "BMW": [
    "P1083", // Fuel control mixture lean (bank 1)
    "P1084", // Fuel control mixture rich (bank 1)
    "P1188", // Fuel rail pressure sensor – signal low
    "P1189", // Fuel rail pressure sensor – signal high
    "P1250", // Fuel pump relay fault
    "P1345", // Misfire cyl 1 with fuel cutoff
    "P1396", // Crankshaft–camshaft position error
    "P1523", // Valvetronic – learning limit position error
    "P1545", // Throttle position control – malfunction
    "P1555", // Charge pressure – upper control deviation
  ],
  "Tesla": [
    "P0A09", // DC/DC converter status
    "P0A1F", // Battery energy control module
    "P0AA6", // HV battery isolation fault
    "P0C73", // Drive motor inverter temperature high
    "P0D14", // HV battery cell voltage low
    "P0D15", // HV battery cell voltage high
    "P0AFA", // 14V power module performance
    "P0AF5", // HV battery system voltage
    "U0073", // Control module communication bus A off
    "U0100", // Lost communication with ECM/PCM
  ],
  "Kia": [
    "P1121", // Throttle position sensor intermittent
    "P1128", // Throttle control motor position sensor
    "P1151", // A/F ratio sensor range (bank 2)
    "P1295", // EGI main relay fault
    "P1307", // Chassis acceleration sensor signal
    "P1386", // Knock sensor 2 peak timing error
    "P1449", // Canister close valve
    "P1505", // Idle speed actuator – opening malfunction
    "P1513", // Idle speed actuator – closing malfunction
    "P1610", // Immobilizer – ECU code not stored
  ],
  "Hyundai": [
    "P1121", // Throttle position sensor intermittent
    "P1128", // Throttle control motor position sensor
    "P1151", // A/F ratio sensor range (bank 2)
    "P1295", // EGI main relay fault
    "P1307", // Chassis acceleration sensor signal
    "P1386", // Knock sensor 2 peak timing error
    "P1449", // Canister close valve
    "P1505", // Idle speed actuator – opening malfunction
    "P1513", // Idle speed actuator – closing malfunction
    "P1610", // Immobilizer – ECU code not stored
  ],
  "Mercedes-Benz": [
    "P1186", // Fuel trim mixture too lean (bank 1)
    "P1187", // Fuel trim mixture too rich (bank 1)
    "P1400", // EGR valve position sensor
    "P1453", // Glow plug relay – bank 1
    "P1515", // Intake manifold flap – circuit
    "P1542", // Throttle actuator control range/performance
    "P1570", // Immobilizer – engine start locked
    "P1633", // Accelerator pedal sensor A+B correlation
    "P1700", // Transmission range display – circuit
    "P1747", // Torque converter clutch system performance
  ],
  "Citroën": [
    "P1336", // Crankshaft position sensor intermittent
    "P1340", // Crankshaft–camshaft sensor correlation
    "P1351", // Glow plug relay circuit
    "P1402", // EGR system – stuck closed
    "P1497", // Turbocharger bypass solenoid
    "P1504", // Idle speed control
    "P1611", // Immobilizer – code not yet programmed
    "P1612", // ECU fault – EEPROM
    "P1614", // Anti-start device communication
    "P1780", // Clutch pedal switch circuit
  ],
  "Nissan": [
    "P1148", // Closed loop control function (bank 1)
    "P1168", // Closed loop control function (bank 2)
    "P1212", // Fuel injector – cyl 1 circuit
    "P1320", // Ignition signal – primary
    "P1336", // Crankshaft position sensor learned value
    "P1402", // EGR system function
    "P1444", // EVAP canister purge volume control valve
    "P1490", // Vacuum cut bypass valve
    "P1610", // Immobilizer – NATS lock mode
    "P1614", // NATS ECM communication error
  ],
  "Fiat": [
    "P1130", // Fuel trim – swirl valve actuator
    "P1320", // Ignition coil 1 – primary circuit
    "P1336", // Crankshaft position sensor – adaptive
    "P1402", // EGR system performance
    "P1501", // Immobilizer – transponder signal
    "P1504", // Idle speed control
    "P1590", // Swirl valve actuator circuit
    "P1606", // Accelerator pedal sensor anomaly
    "P1612", // ECU fault – EEPROM
    "P1614", // Immobilizer communication error
  ],
}

// ── Detekce technologie motoru z enginePower stringu ────────────────────────

const DIESEL_RE = /\b(TDI|HDi|CDI|dCi|CRDi|D-4D|MultiJet|BlueHDi|CRDI|JTD|JTDM|Duratorq|EcoBlue|2\.0d|3\.0d|1\.5d|1\.6d|2\.2d)\b/i
const TURBO_RE  = /\b(TSI|TFSI|T-GDI|T-GDi|TCe|THP|PureTech|T-Jet|Turbo|EcoBoost|N[0-9]{2}[A-Z]?|B[0-9]{2}[A-Z]?|FireFly T|DIG-T|MultiAir)\b/i
const ELEC_RE   = /\b(Electric|EV|BEV|e-tron|iD|ID\.|e-208|e-C4|Niro EV|IONIQ|Model [3SXY]|e-Ducato|e-Berlingo)\b/i
const HYBRID_RE = /\b(Hybrid|PHEV|HEV|GTE|e-TSI|e-HDi|E-TECH|PlugIn|Plug-In)\b/i
const ADBLUE_RE = /\b(TDI|CDI|dCi|CRDi|D-4D|MultiJet|BlueHDi|CRDI|JTD|JTDM|EcoBlue|SCR)\b/i

// Tesla je vždy elektrický
const ELECTRIC_BRANDS = ["Tesla"]

/**
 * Detekuje technologie motoru z enginePower stringu a značky.
 * @returns {string[]} pole tagů: ["diesel", "turbo", "adblue"] atd.
 */
export function detectEngineTech(brand, model, enginePower) {
  const tags = []
  const pw = enginePower || ""

  if (ELECTRIC_BRANDS.includes(brand)) {
    tags.push("electric")
    return tags
  }

  if (DIESEL_RE.test(pw))  tags.push("diesel")
  if (TURBO_RE.test(pw))   tags.push("turbo")
  if (ELEC_RE.test(pw))    tags.push("electric")
  if (HYBRID_RE.test(pw))  tags.push("hybrid")
  // AdBlue typicky u dieselů od Euro 6 (2014+), zjednodušeně = diesel
  if (tags.includes("diesel") && ADBLUE_RE.test(pw)) tags.push("adblue")

  return tags
}

/**
 * Vrátí sjednocený deduplikovaný seznam OBD kódů pro dané vozidlo.
 * Tříúrovňový systém: obecné + dle technologie motoru + dle značky.
 *
 * @param {string} brand       — např. "BMW"
 * @param {string} model       — např. "Řada 3 – F30 (2012–2019)"
 * @param {string} enginePower — např. "130 kW – 2.0d N47"
 * @returns {{ common: string[], engine: string[], brand: string[] }}
 */
export function getObdCodes(brand, model, enginePower) {
  const common = [...COMMON_OBD_CODES]

  // Engine-technology kódy
  const techs = detectEngineTech(brand, model, enginePower)
  const engineCodes = []
  for (const tech of techs) {
    const codes = ENGINE_OBD_CODES[tech]
    if (codes) engineCodes.push(...codes)
  }
  // Deduplikace engine kódů (odebrání těch, co už jsou v common)
  const commonSet = new Set(common)
  const uniqueEngine = [...new Set(engineCodes)].filter(c => !commonSet.has(c))

  // Brand-specific kódy
  const brandCodes = BRAND_OBD_CODES[brand] ?? []

  return { common, engine: uniqueEngine, brand: brandCodes }
}
