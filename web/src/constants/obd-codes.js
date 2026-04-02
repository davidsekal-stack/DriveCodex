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

  // ── US Market brands ────────────────────────────────────────────────────────

  "Chevrolet": [
    "P1011", // Intake camshaft position actuator park – bank 1
    "P1014", // Exhaust camshaft position actuator park – bank 1
    "P1101", // MAF sensor out of self-test range
    "P1133", // HO2S insufficient switching – bank 1
    "P1153", // HO2S insufficient switching – bank 2
    "P1174", // Fuel trim cylinder balance – bank 1
    "P1361", // ICM 4X reference circuit – low
    "P1516", // Throttle actuator control module – throttle position
    "P1689", // Traction control delivered torque output circuit
    "P3401", // Cylinder 1 deactivation/intake valve control – stuck open (AFM/DFM)
    "P3441", // Cylinder 5 deactivation/intake valve control – stuck open
  ],
  "GMC": [
    "P1011", // Intake camshaft position actuator park – bank 1
    "P1014", // Exhaust camshaft position actuator park – bank 1
    "P1101", // MAF sensor out of self-test range
    "P1133", // HO2S insufficient switching – bank 1
    "P1153", // HO2S insufficient switching – bank 2
    "P1174", // Fuel trim cylinder balance – bank 1
    "P1361", // ICM 4X reference circuit – low
    "P1516", // Throttle actuator control module – throttle position
    "P1689", // Traction control delivered torque output circuit
    "P3401", // Cylinder 1 deactivation – stuck open (AFM)
    "P3441", // Cylinder 5 deactivation – stuck open
  ],
  "Ram": [
    "P1128", // Closed loop fueling not achieved – bank 1
    "P1195", // O2 sensor slow during catalyst monitor (bank 1)
    "P1281", // Engine is cold too long (thermostat performance)
    "P1282", // Fuel pump relay control circuit
    "P1388", // Auto shutdown relay control circuit
    "P1391", // Intermittent loss of CMP or CKP signal
    "P1403", // EGR solenoid circuit (Cummins Diesel)
    "P1488", // Auxiliary 5-volt supply output too low
    "P1595", // Speed control switch – solenoid circuit
    "P1693", // Fault in companion module (check companion DTC)
    "P1F55", // ECM memory – programmed VIN does not match
  ],
  "Jeep": [
    "P1128", // Closed loop fueling not achieved – bank 1
    "P1281", // Engine cold too long – thermostat performance
    "P1282", // Fuel pump relay control circuit
    "P1388", // Auto shutdown relay control circuit
    "P1391", // Intermittent loss of CMP or CKP signal
    "P1480", // Cooling fan relay 1 – circuit
    "P1486", // EVAP leak monitor pinched hose found
    "P1490", // Low speed fuel pump relay circuit
    "P1595", // Speed control solenoid circuit
    "P1693", // Fault in companion module
    "P155A", // 4WD switch circuit (low range)
  ],
  "Dodge": [
    "P1128", // Closed loop fueling not achieved – bank 1
    "P1281", // Engine cold too long – thermostat performance
    "P1282", // Fuel pump relay control circuit
    "P1388", // Auto shutdown relay control circuit
    "P1391", // Intermittent loss of CMP or CKP signal
    "P1486", // EVAP leak monitor – pinched hose
    "P1595", // Speed control solenoid circuit
    "P1693", // Fault in companion module
    "P1762", // Governor pressure sensor offset – volts low
    "P1899", // Park/neutral switch stuck in park or in gear
  ],
  "Chrysler": [
    "P1128", // Closed loop fueling not achieved – bank 1
    "P1281", // Engine cold too long – thermostat
    "P1388", // Auto shutdown relay control circuit
    "P1391", // Intermittent loss of CMP or CKP signal
    "P1480", // Cooling fan relay 1 circuit
    "P1486", // EVAP leak monitor – pinched hose
    "P1595", // Speed control solenoid circuit
    "P1693", // Fault in companion module
    "P1790", // Fault after inhibit or after battery disconnect
    "P1899", // Park/neutral switch stuck
  ],
  "Honda": [
    "P1009", // Variable valve timing control advance malfunction
    "P1077", // IMRC system malfunction – low RPM
    "P1078", // IMRC system malfunction – high RPM
    "P1157", // A/F sensor (primary O2) – circuit malfunction (bank 2)
    "P1241", // Paired injector circuit (cyl 1–4 pair) malfunction
    "P1253", // VTEC system malfunction
    "P1259", // VTEC system malfunction (bank 1 sensor)
    "P1297", // Electrical load detector circuit – low input
    "P1298", // Electrical load detector circuit – high input
    "P1399", // Random/multiple misfire detected (Honda-specific)
    "P1457", // EVAP control system leak in fuel tank
  ],
  "Acura": [
    "P1009", // Variable valve timing advance malfunction
    "P1077", // IMRC malfunction – low RPM
    "P1157", // A/F sensor circuit malfunction (bank 2)
    "P1253", // VTEC system malfunction
    "P1259", // VTEC oil pressure switch (bank 1)
    "P1279", // VTEC oil pressure switch (bank 2)
    "P1297", // Electrical load detector – low input
    "P1298", // Electrical load detector – high input
    "P1399", // Random/multiple misfire (Acura-specific)
    "P1457", // EVAP leak – fuel tank
    "P1491", // EGR valve insufficient lift
  ],
  "Subaru": [
    "P1086", // Tumble generator valve position sensor 1 – low
    "P1087", // Tumble generator valve position sensor 1 – high
    "P1088", // Tumble generator valve position sensor 2 – low
    "P1089", // Tumble generator valve position sensor 2 – high
    "P1092", // Tumble generator valve actuator 1 – open circuit
    "P1093", // Tumble generator valve actuator 2 – open circuit
    "P1130", // Front O2 sensor – circuit range/performance
    "P1390", // Timing over-retarded – bank 1
    "P1443", // EVAP canister purge control valve – electrical
    "P1491", // EGR valve – solenoid circuit
    "P1560", // Backup power supply circuit
  ],
  "Mazda": [
    "P1170", // Front HO2S – stuck at mid-range
    "P1195", // Barometric pressure sensor (BARO) circuit
    "P1250", // Pressure regulator control solenoid – circuit
    "P1345", // Variable swirl control valve actuator circuit
    "P1410", // EGR valve position sensor circuit
    "P1414", // Secondary air injection – bank 2 system
    "P1442", // EVAP control system – small leak
    "P1443", // EVAP canister purge valve – solenoid circuit
    "P1510", // Throttle control – MFI (ETC system)
    "P1521", // Variable intake air (VIAS) control solenoid
    "P1523", // Variable intake air (VIAS) control solenoid – stuck
  ],
  "Suzuki": [
    "P1011", // Intake camshaft position actuator – incorrect park position bank 1
    "P1107", // Manifold absolute pressure (MAP) sensor – signal voltage low
    "P1116", // Engine coolant temperature (ECT) circuit performance
    "P1121", // Throttle position sensor intermittent high voltage
    "P1231", // Fuel pump relay high voltage
    "P1320", // Crankshaft segment malfunction
    "P1408", // MAP sensor / EGR system circuit malfunction
    "P1443", // EVAP purge control valve malfunction – stuck open
    "P1510", // Engine control module (ECM) supply voltage
    "P1614", // Transponder response error / immobilizer key mismatch
  ],
  "Volvo": [
    "P1171", // System too lean – bank 1 part load
    "P1172", // System too rich – bank 1 part load
    "P1237", // Turbocharger boost control deviation
    "P1238", // Turbocharger boost pressure sensor / boost control malfunction
    "P1273", // Electronic throttle system malfunction
    "P1336", // Crankshaft position sensor / RPM signal range-performance
    "P1449", // EVAP leak detection pump circuit malfunction
    "P1505", // Idle air control valve opening signal
    "P1602", // Engine control module power stage group B
    "P1618", // Transmission control module MIL ON request
  ],
  "Cadillac": [
    "P1011", // Intake camshaft position actuator park – bank 1
    "P1014", // Exhaust camshaft position actuator park – bank 1
    "P1101", // MAF sensor out of self-test range
    "P1133", // HO2S insufficient switching – bank 1
    "P1516", // Throttle actuator control module – throttle position
    "P1571", // Traction control request circuit
    "P1689", // Traction control delivered torque output circuit
    "P3401", // Cylinder 1 deactivation – stuck open (AFM)
    "P3441", // Cylinder 5 deactivation – stuck open
    "P161B", // Supercharger coolant pump relay circuit (Blackwing)
  ],
  "Buick": [
    "P1011", // Intake camshaft position actuator park – bank 1
    "P1101", // MAF sensor out of self-test range
    "P1133", // HO2S insufficient switching – bank 1
    "P1153", // HO2S insufficient switching – bank 2
    "P1174", // Fuel trim cylinder balance – bank 1
    "P1516", // Throttle actuator control module
    "P1689", // Traction control delivered torque output circuit
    "P0299", // Turbo underboost – very common on 1.4/1.5T Ecotec
    "P0171", // System lean – common on 1.4/1.5T with direct injection
  ],
  "Lincoln": [
    "P1000", // OBD monitor testing not complete
    "P1131", // Lack of HO2S switch – lean (bank 1)
    "P1151", // Lack of HO2S switch – lean (bank 2)
    "P1299", // Cylinder head overtemperature protection
    "P1450", // Unable to bleed up fuel tank vacuum
    "P1516", // Throttle actuator control module
    "P1633", // KAM voltage too low
    "P1744", // Torque converter clutch system performance
    "P2008", // Intake manifold runner control circuit
    "P2196", // O2 sensor signal biased/stuck rich (bank 1)
  ],
  "Lexus": [
    "P1120", // Accelerator pedal position sensor – circuit malfunction
    "P1121", // Accelerator pedal sensor range/performance
    "P1300", // Igniter circuit malfunction – No. 1
    "P1310", // Igniter circuit malfunction – No. 2
    "P1346", // VVT-i sensor range/performance (bank 1)
    "P1349", // VVT-i system malfunction (bank 1)
    "P1604", // Startability malfunction
    "P1633", // ECM backup power source circuit
    "P1656", // OCV assembly (bank 1)
    "P1780", // Park/neutral position switch – illegal input
  ],
  "Infiniti": [
    "P1148", // Closed loop control function (bank 1)
    "P1168", // Closed loop control function (bank 2)
    "P1320", // Primary ignition signal circuit
    "P1336", // Crankshaft position sensor (CKPS) learned value
    "P1402", // EGR system function
    "P1444", // EVAP canister purge volume control valve
    "P1610", // Immobilizer NATS – lock mode
    "P1614", // NATS ECM communication
    "P1900", // Cooling fan – intermittent malfunction
    "P1804", // 4WD solenoid circuit (QX80)
  ],
  "Genesis": [
    "P1121", // Throttle position sensor – intermittent signal
    "P1128", // Throttle control motor position sensor
    "P1295", // EGI main relay circuit fault
    "P1307", // Chassis acceleration sensor signal fault
    "P1386", // Knock sensor 2 peak timing error
    "P1449", // Canister close valve circuit
    "P1505", // Idle speed actuator – opening malfunction
    "P1513", // Idle speed actuator – closing malfunction
    "P1610", // Immobilizer – ECU code not stored
    "P0A80", // Replace hybrid/HV battery pack (Genesis electrified)
  ],
}

// ── Detekce technologie motoru z enginePower stringu ────────────────────────

// EU + US engine technology detection
// Diesel: EU (TDI, CDI, dCi…) + US (Duramax, Cummins, EcoDiesel, PowerStroke)
const DIESEL_RE = /\b(TDI|HDi|CDI|dCi|CRDi|D-4D|MultiJet|BlueHDi|CRDI|JTD|JTDM|Duratorq|EcoBlue|2\.0d|3\.0d|1\.5d|1\.6d|2\.2d|Duramax|Cummins|EcoDiesel|PowerStroke|Power Stroke|Diesel|Diesel I4|Diesel I6|Diesel V6)\b/i
// Turbo: EU (TSI, TFSI, TCe…) + US (EcoBoost, Hurricane, VC-Turbo, Supercharged, Twin Turbo…)
const TURBO_RE  = /\b(TSI|TFSI|T-GDI|T-GDi|TCe|THP|PureTech|T-Jet|Turbo|EcoBoost|N[0-9]{2}[A-Z]?|B[0-9]{2}[A-Z]?|FireFly T|DIG-T|MultiAir|SkyActiv Turbo|VC-Turbo|Hurricane|Twin Turbo|TwinTurbo|Supercharged|Hellcat|Redeye|Blackwing|EcoTec Turbo|Ecotec Turbo)\b/i
// Electric: EU + US (Electrified, Dual Motor, Single Motor, Mach-E…)
const ELEC_RE   = /\b(Electric|EV|BEV|e-tron|iD|ID\.|e-208|e-C4|Niro EV|IONIQ|Model [3SXY]|e-Ducato|e-Berlingo|Electrified|Dual Motor|Single Motor|Mach-E)\b/i
// Hybrid: EU + US (eTorque, 4xe, i-MMD, e-Boxer, IMA…)
const HYBRID_RE = /\b(Hybrid|PHEV|HEV|GTE|e-TSI|e-HDi|E-TECH|PlugIn|Plug-In|eTorque|4xe|i-MMD|e-Boxer|Plug-in|IMA|Sport Hybrid|SH-AWD Hybrid|FHEV)\b/i
// AdBlue/DEF: only explicit SCR/urea markers, not generic diesel naming
const ADBLUE_RE = /\b(AdBlue|DEF|SCR|BlueTEC|BlueHDi|Reductant|Urea|NOx)\b/i

// Značky vždy elektrické (žádné ICE)
const ELECTRIC_BRANDS = ["Tesla"]
const BRAND_CANONICAL_FOR_OBD = {
  "Ford (US)": "Ford",
  "Toyota (US)": "Toyota",
  "Nissan (US)": "Nissan",
  "Hyundai (US)": "Hyundai",
  "Kia (US)": "Kia",
  "Volkswagen (US)": "Volkswagen",
  "Pontiac": "Chevrolet",
  "Saturn": "Chevrolet",
  "SEAT": "Volkswagen",
  "Seat": "Volkswagen",
  "Cupra": "Volkswagen",
  "CUPRA": "Volkswagen",
  // Opel katalog zde zatím pokrývá novější PSA/Stellantis-era modely.
  "Opel": "Peugeot",
}

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
  // AdBlue přidáváme jen při explicitním SCR/DEF signálu.
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
  const obdBrand = BRAND_CANONICAL_FOR_OBD[brand] ?? brand
  const brandCodes = BRAND_OBD_CODES[obdBrand] ?? []

  return { common, engine: uniqueEngine, brand: brandCodes }
}
