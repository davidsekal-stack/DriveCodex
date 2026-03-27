-- ═══════════════════════════════════════════════════════════════════════════════
-- GearBrain — DTC codes: All remaining brand groups
-- Ford, Toyota, Renault, PSA, Fiat, Nissan, Hyundai/Kia, GM, Stellantis US,
-- Honda, Subaru, Mazda, Suzuki, Volvo, Tesla
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.gearbrain_dtc_codes (code, brand_group, description, system, common_causes, severity, source) VALUES

-- ═══════════════════════════════════════════════════════════════════════════════
-- FORD (+ Lincoln) — brand_group: "FORD"
-- Sources: ForScan, FordTechMakuloco, Ford TSBs
-- ═══════════════════════════════════════════════════════════════════════════════

('P1000', 'FORD', 'OBD-II Monitor Testing Not Complete', 'engine', 'Battery recently disconnected;ECU reset;Drive cycle not completed;Normal after repair', 'low', 'oem'),
('P1131', 'FORD', 'Lack of HO2S Switch – Sensor Indicates Lean (Bank 1)', 'emissions', 'Vacuum leak;Faulty O2 sensor;Fuel pressure low;MAF sensor contaminated', 'medium', 'oem'),
('P1151', 'FORD', 'Lack of HO2S Switch – Sensor Indicates Lean (Bank 2)', 'emissions', 'Vacuum leak bank 2;O2 sensor;Intake manifold gasket;Fuel delivery issue', 'medium', 'oem'),
('P1260', 'FORD', 'Theft Detected – Engine Disabled (PATS)', 'electrical', 'PATS key not programmed;Transponder fault;PATS module;Ignition switch', 'critical', 'oem'),
('P1299', 'FORD', 'Cylinder Head Overtemperature Protection Active', 'engine', 'Low coolant;Faulty CHT sensor;Head gasket leak;Thermostat stuck;Water pump failure', 'critical', 'oem'),
('P1450', 'FORD', 'Unable to Bleed Up Fuel Tank Vacuum', 'emissions', 'EVAP canister purge valve stuck open;Fuel tank pressure sensor;Vapor line blockage;Gas cap', 'medium', 'oem'),
('P1633', 'FORD', 'Keep Alive Memory (KAM) Voltage Too Low', 'electrical', 'Dead battery;Corroded terminals;PCM power supply circuit;Fuse', 'medium', 'oem'),
('P1744', 'FORD', 'Torque Converter Clutch System Performance', 'transmission', 'TCC solenoid;Valve body wear;Low ATF;Contaminated fluid', 'high', 'oem'),
('P2008', 'FORD', 'Intake Manifold Runner Control Circuit – Open', 'engine', 'IMRC actuator motor;Linkage broken;Wiring;Carbon buildup on runner flaps', 'medium', 'oem'),
('P2196', 'FORD', 'O2 Sensor Signal Biased/Stuck Rich (Bank 1 Sensor 1)', 'emissions', 'O2 sensor failed;Fuel injector leaking;Fuel pressure too high;EVAP purge stuck', 'medium', 'oem'),
('P0171', 'FORD', 'System Too Lean – Bank 1', 'fuel', 'Intake manifold gasket (3.5L EcoBoost common);PCV hose;MAF sensor;Fuel pump module', 'medium', 'oem'),
('P0299', 'FORD', 'Turbocharger Underboost', 'engine', 'Charge air cooler (CAC) condensation/leak (1.0/1.5/2.0 EcoBoost known issue);Wastegate;Boost hose', 'high', 'oem'),
('P0420', 'FORD', 'Catalyst Efficiency Below Threshold – Bank 1', 'emissions', 'Catalytic converter degraded;Downstream O2 sensor;Exhaust leak;Misfires damaged cat', 'medium', 'oem'),

-- ═══════════════════════════════════════════════════════════════════════════════
-- TOYOTA (+ Lexus) — brand_group: "TOYOTA"
-- Sources: Toyota TIS, ToyotaNation, ClubLexus
-- ═══════════════════════════════════════════════════════════════════════════════

('P1346', 'TOYOTA', 'VVT Sensor Range/Performance (Bank 1)', 'engine', 'VVT-i oil control valve (OCV) clogged;Oil sludge;Cam position sensor;Low oil level', 'medium', 'oem'),
('P1349', 'TOYOTA', 'VVT System Malfunction (Bank 1)', 'engine', 'VVT-i OCV stuck;Timing chain stretched;Oil passages clogged;Low oil pressure', 'high', 'oem'),
('P1300', 'TOYOTA', 'Igniter Circuit Malfunction – No. 1', 'engine', 'Ignition coil failed;Spark plug;ECU igniter driver;Wiring to coil', 'high', 'oem'),
('P1310', 'TOYOTA', 'Igniter Circuit Malfunction – No. 2', 'engine', 'Ignition coil cyl 2;Spark plug;ECU driver;Wiring', 'high', 'oem'),
('P1130', 'TOYOTA', 'Air/Fuel Ratio Sensor – Circuit Range/Performance (Bank 1)', 'emissions', 'A/F sensor (wideband O2) failing;Exhaust leak;Vacuum leak;Wiring', 'medium', 'oem'),
('P1135', 'TOYOTA', 'Air/Fuel Ratio Sensor Heater Circuit Response Time (Bank 1)', 'emissions', 'A/F sensor heater element;Fuse;Wiring;ECU relay', 'medium', 'oem'),
('P1150', 'TOYOTA', 'Air/Fuel Ratio Sensor – Circuit Range/Performance (Bank 2)', 'emissions', 'A/F sensor bank 2;Exhaust leak;Vacuum leak', 'medium', 'oem'),
('P1155', 'TOYOTA', 'Air/Fuel Ratio Sensor Heater Circuit (Bank 2)', 'emissions', 'A/F sensor heater;Fuse;Wiring', 'medium', 'oem'),
('P1604', 'TOYOTA', 'Startability Malfunction', 'engine', 'Cranking time too long;Weak battery;Fuel pressure;Immobilizer communication;Starter motor', 'medium', 'oem'),
('P1656', 'TOYOTA', 'OCV Circuit – Bank 1', 'engine', 'VVT-i oil control valve (OCV) solenoid;Wiring;ECU driver;Oil contamination', 'medium', 'oem'),
('P0171', 'TOYOTA', 'System Too Lean – Bank 1', 'fuel', 'Intake manifold gasket;MAF sensor;PCV valve;Fuel injector;Brake booster hose leak', 'medium', 'oem'),
('P0420', 'TOYOTA', 'Catalyst Efficiency Below Threshold – Bank 1', 'emissions', 'Catalytic converter aged;Oil burning past piston rings (1ZZ-FE known);Downstream O2 sensor;Exhaust leak', 'medium', 'oem'),
('P0441', 'TOYOTA', 'EVAP System Incorrect Purge Flow', 'emissions', 'VSV (vacuum switching valve) for EVAP;Charcoal canister;Gas cap;Vapor line cracked', 'low', 'oem'),
('P0500', 'TOYOTA', 'Vehicle Speed Sensor Malfunction', 'transmission', 'Speed sensor;Wiring;Instrument cluster;ECU', 'medium', 'oem'),

-- ═══════════════════════════════════════════════════════════════════════════════
-- RENAULT (+ Dacia) — brand_group: "RENAULT"
-- Sources: Renault CLIP, French Car Forum, Dacia Forum
-- ═══════════════════════════════════════════════════════════════════════════════

('P1351', 'RENAULT', 'Glow Plug Relay Circuit', 'engine', 'Glow plug relay failed;Fuse;Wiring;Glow plug ECU', 'medium', 'oem'),
('P1384', 'RENAULT', 'Crankshaft Position Sensor – Intermittent Signal', 'engine', 'Crank sensor wiring chafed;Sensor air gap;Reluctor ring;Sensor failing', 'high', 'oem'),
('P1443', 'RENAULT', 'EVAP Canister Purge Valve 2', 'emissions', 'Purge valve stuck;Wiring;Vacuum line;Charcoal canister saturated', 'low', 'oem'),
('P1497', 'RENAULT', 'Turbocharger Bypass Solenoid Circuit', 'engine', 'Wastegate solenoid;Vacuum line perished;Wiring;Wastegate actuator seized', 'high', 'oem'),
('P1504', 'RENAULT', 'Idle Air Control System – RPM Higher Than Expected', 'engine', 'Throttle body dirty;Idle actuator;Vacuum leak;Air leak after MAF', 'medium', 'oem'),
('P1606', 'RENAULT', 'Accelerator Pedal Position Sensor – Anomaly', 'engine', 'Pedal position sensor failing;Wiring;Floor mat interference;ECU', 'high', 'oem'),
('P1610', 'RENAULT', 'Injector Driver Unlock Code Not Yet Programmed', 'electrical', 'ECU replaced without coding injectors;Injector code mismatch;ECU clone error', 'critical', 'oem'),
('P1612', 'RENAULT', 'ECU Fault – EEPROM', 'electrical', 'ECU internal memory corruption;Power interruption during write;ECU needs replacement or reflash', 'critical', 'oem'),
('P1614', 'RENAULT', 'Immobilizer – Communication Error', 'electrical', 'Key transponder weak;UCH (body computer) fault;Antenna ring;Key not learned to ECU', 'critical', 'oem'),
('P1703', 'RENAULT', 'Brake Switch – Permanent Input', 'chassis', 'Brake light switch stuck;Switch adjustment;Wiring;Brake pedal bracket', 'medium', 'oem'),
('P0299', 'RENAULT', 'Turbocharger Underboost', 'engine', 'Wastegate actuator seized (1.5 dCi common);Boost hose split;VNT vanes stuck;Turbo bearing wear', 'high', 'oem'),
('P2002', 'RENAULT', 'DPF Efficiency Below Threshold – Bank 1', 'emissions', 'DPF clogged (1.5 dCi short trips);Pressure sensor hoses;Fuel additive level low (Eolys/Cerine for PSA-shared engines);EGR fault', 'high', 'oem'),
('P0400', 'RENAULT', 'Exhaust Gas Recirculation Flow', 'emissions', 'EGR valve carbon buildup (1.5 dCi very common);EGR cooler;Intake manifold clogged', 'high', 'oem'),
('P0380', 'RENAULT', 'Glow Plug/Heater Circuit A', 'engine', 'Glow plug(s) failed;Control module;Wiring corrosion;Wrong plug type fitted', 'medium', 'oem'),

-- ═══════════════════════════════════════════════════════════════════════════════
-- PSA (Peugeot, Citroën, Opel/Vauxhall post-2017) — brand_group: "PSA"
-- Sources: Peugeot Planet/DiagBox, PeugeotForums, French Car Forum
-- ═══════════════════════════════════════════════════════════════════════════════

('P1336', 'PSA', 'Crankshaft Position Sensor – Intermittent', 'engine', 'Crank sensor wiring;Sensor gap;Flywheel teeth damaged;Engine vibration', 'high', 'oem'),
('P1340', 'PSA', 'Crankshaft–Camshaft Sensor Correlation', 'engine', 'Timing belt/chain stretched;Timing slipped;Cam sensor;Crank sensor', 'critical', 'oem'),
('P1351', 'PSA', 'Glow Plug Relay Circuit', 'engine', 'Glow plug relay;Fuse;Wiring;Control module', 'medium', 'oem'),
('P1402', 'PSA', 'EGR System – Stuck Closed', 'emissions', 'EGR valve seized with carbon (1.6 HDi/2.0 HDi common);Vacuum actuator;EGR cooler blocked', 'high', 'oem'),
('P1497', 'PSA', 'Turbocharger Bypass Solenoid', 'engine', 'Wastegate solenoid;Vacuum hose perished;Actuator;Turbo VNT mechanism', 'high', 'oem'),
('P1504', 'PSA', 'Idle Speed Control', 'engine', 'Throttle body dirty;Idle stepper motor;Vacuum leak;Air leak post-MAF', 'medium', 'oem'),
('P1611', 'PSA', 'Immobilizer – Code Not Yet Programmed', 'electrical', 'ECU replaced without key learning;BSI (body computer) mismatch;Transponder fault', 'critical', 'oem'),
('P1612', 'PSA', 'ECU Fault – EEPROM', 'electrical', 'ECU memory corruption;BSI communication lost;Power failure during programming', 'critical', 'oem'),
('P1614', 'PSA', 'Anti-Start Device – Communication Error', 'electrical', 'Key transponder;BSI module;Antenna coil;Key battery', 'critical', 'oem'),
('P1780', 'PSA', 'Clutch Pedal Switch Circuit', 'transmission', 'Clutch switch failed;Wiring;Switch adjustment;Pedal box', 'medium', 'oem'),
('P0299', 'PSA', 'Turbocharger Underboost', 'engine', 'VNT actuator stuck (1.6 HDi/BlueHDi common);Boost hose;Intercooler leak;Turbo worn', 'high', 'oem'),
('P2002', 'PSA', 'DPF Efficiency Below Threshold', 'emissions', 'DPF saturated;Additive (Eolys/Cerine) tank empty — PSA uses fuel additive system for DPF regen;Pressure sensor;EGR fault', 'high', 'oem'),
('P1164', 'PSA', 'Fuel Rail Pressure Too Low at Idle', 'fuel', 'High-pressure pump;Fuel filter clogged;Low-pressure pump;Rail sensor', 'high', 'oem'),
('P0171', 'PSA', 'System Too Lean – Bank 1', 'fuel', 'Vacuum leak;MAF sensor (PureTech turbo);Intake manifold gasket;Fuel injector', 'medium', 'oem'),
('P0420', 'PSA', 'Catalyst Efficiency Below Threshold', 'emissions', 'Cat degraded;Downstream O2;Oil burning (1.2 PureTech known issue);Exhaust leak', 'medium', 'oem'),

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIAT (+ Alfa Romeo, Lancia) — brand_group: "FIAT"
-- Sources: FiatForum, Alfisti, multiecuscan
-- ═══════════════════════════════════════════════════════════════════════════════

('P1130', 'FIAT', 'Fuel Trim – Swirl Valve Actuator', 'engine', 'Swirl valve actuator;Linkage broken;Carbon buildup;Wiring', 'medium', 'oem'),
('P1320', 'FIAT', 'Ignition Coil 1 – Primary Circuit', 'engine', 'Ignition coil pack failed;Spark plug;Wiring;ECU driver', 'high', 'oem'),
('P1336', 'FIAT', 'Crankshaft Position Sensor – Adaptive Performance', 'engine', 'Crank sensor adaptation needed;Flywheel teeth;Sensor gap;Vibration', 'medium', 'oem'),
('P1402', 'FIAT', 'EGR System Performance', 'emissions', 'EGR valve carbon buildup (1.3 MultiJet very common);EGR cooler;Intake swirl flaps seized', 'high', 'oem'),
('P1501', 'FIAT', 'Immobilizer – Transponder Signal Invalid', 'electrical', 'Key transponder fault;Body computer (BSI/BCM);Key antenna;Key not matched', 'critical', 'oem'),
('P1504', 'FIAT', 'Idle Speed Control', 'engine', 'Throttle body dirty (1.4 Fire common);Stepper motor;Vacuum leak', 'medium', 'oem'),
('P1590', 'FIAT', 'Swirl Valve Actuator Circuit', 'engine', 'Swirl flap motor;Linkage;Flaps stuck with carbon;Wiring', 'medium', 'oem'),
('P1606', 'FIAT', 'Accelerator Pedal Sensor – Anomaly', 'engine', 'Pedal sensor;Wiring;Floor mat;ECU', 'high', 'oem'),
('P1612', 'FIAT', 'ECU Fault – EEPROM', 'electrical', 'ECU memory error;Power interruption;Needs reflash or replacement', 'critical', 'oem'),
('P1614', 'FIAT', 'Immobilizer – Communication Error', 'electrical', 'Key transponder;Body computer;Antenna ring;Key not learned', 'critical', 'oem'),
('P0299', 'FIAT', 'Turbocharger Underboost', 'engine', 'VNT actuator stuck (1.3 MultiJet common);Boost hose;Wastegate;Turbo bearing wear', 'high', 'oem'),
('P2002', 'FIAT', 'DPF Efficiency Below Threshold', 'emissions', 'DPF clogged (1.3/1.6 MultiJet);Differential pressure sensor;EGR;Oil spec (must be ACEA C2/C3)', 'high', 'oem'),
('P0420', 'FIAT', 'Catalyst Efficiency Below Threshold', 'emissions', 'Cat degraded;O2 sensor;Exhaust leak;Engine running rich', 'medium', 'oem'),

-- ═══════════════════════════════════════════════════════════════════════════════
-- NISSAN (+ Infiniti) — brand_group: "NISSAN"
-- Sources: Nissan Consult, NissanClub, InfinitiScene
-- ═══════════════════════════════════════════════════════════════════════════════

('P1148', 'NISSAN', 'Closed Loop Control Function (Bank 1)', 'emissions', 'A/F sensor bank 1 slow response;Exhaust leak;Vacuum leak;MAF sensor', 'medium', 'oem'),
('P1168', 'NISSAN', 'Closed Loop Control Function (Bank 2)', 'emissions', 'A/F sensor bank 2;Exhaust leak;Intake gasket;MAF', 'medium', 'oem'),
('P1212', 'NISSAN', 'Fuel Injector – Cylinder 1 Circuit', 'fuel', 'Injector wiring;Connector corrosion;Injector coil;ECU driver', 'high', 'oem'),
('P1320', 'NISSAN', 'Ignition Signal – Primary', 'engine', 'Ignition coil(s) failing (very common on VQ35/VQ37);Spark plug;Power transistor;Wiring', 'high', 'oem'),
('P1336', 'NISSAN', 'Crankshaft Position Sensor Learned Value Not Stored', 'engine', 'Crank sensor adaptation lost;Sensor fault;Battery disconnect;ECU reset', 'medium', 'oem'),
('P1402', 'NISSAN', 'EGR System Function', 'emissions', 'EGR valve stuck;Carbon buildup;BPT (back pressure transducer) hose;Vacuum supply', 'medium', 'oem'),
('P1444', 'NISSAN', 'EVAP Canister Purge Volume Control Valve', 'emissions', 'Purge valve stuck open/closed;Wiring;Vacuum line;Charcoal canister', 'low', 'oem'),
('P1490', 'NISSAN', 'Vacuum Cut Bypass Valve', 'fuel', 'Vacuum cut valve failed;Hose cracked;Vapor line blocked', 'low', 'oem'),
('P1610', 'NISSAN', 'NATS – Lock Mode (Immobilizer)', 'electrical', 'Key not registered;NATS antenna;ECU locked;Key transponder', 'critical', 'oem'),
('P1614', 'NISSAN', 'NATS – ECM Communication Error', 'electrical', 'NATS control unit;Wiring between NATS and ECM;Key registration;BCM', 'critical', 'oem'),
('P0171', 'NISSAN', 'System Too Lean – Bank 1', 'fuel', 'MAF sensor dirty (hot wire type);Intake boot cracked;PCV valve;Fuel pressure', 'medium', 'oem'),
('P0300', 'NISSAN', 'Random/Multiple Misfire', 'engine', 'Ignition coils (VQ engines common);Spark plugs;Intake manifold gasket (VQ35 plenum);Timing chain', 'high', 'oem'),
('P0420', 'NISSAN', 'Catalyst Efficiency Below Threshold', 'emissions', 'Cat degraded;Pre-cat pipe exhaust leak;O2 sensor;Misfire damage', 'medium', 'oem'),

-- ═══════════════════════════════════════════════════════════════════════════════
-- HYUNDAI / KIA (+ Genesis) — brand_group: "HYUKIA"
-- Sources: Hyundai GDS, KiaForums, HyundaiForums
-- ═══════════════════════════════════════════════════════════════════════════════

('P1121', 'HYUKIA', 'Throttle Position Sensor – Intermittent High Voltage', 'engine', 'TPS fault;Throttle body connector corrosion;Wiring;ECU', 'medium', 'oem'),
('P1128', 'HYUKIA', 'Throttle Control Motor Position Sensor', 'engine', 'Electronic throttle body failing;Connector;Carbon buildup;Adaptation lost', 'high', 'oem'),
('P1151', 'HYUKIA', 'Air/Fuel Ratio Sensor Range/Performance (Bank 2)', 'emissions', 'A/F sensor;Exhaust leak;Vacuum leak;Wiring', 'medium', 'oem'),
('P1295', 'HYUKIA', 'EGI Main Relay Circuit Fault', 'electrical', 'Main relay failed;Fuse;Wiring;ECU power supply circuit', 'high', 'oem'),
('P1307', 'HYUKIA', 'Chassis Acceleration Sensor Signal', 'chassis', 'G sensor fault;ESC module;Wiring;Sensor mounting', 'medium', 'oem'),
('P1386', 'HYUKIA', 'Knock Sensor 2 Peak Timing Error', 'engine', 'Knock sensor;Low octane fuel;Carbon buildup;Sensor wiring;Sensor torque', 'medium', 'oem'),
('P1449', 'HYUKIA', 'Canister Close Valve', 'emissions', 'CCV stuck/failed;Wiring;Vapor line;EVAP system', 'low', 'oem'),
('P1505', 'HYUKIA', 'Idle Speed Actuator – Opening Malfunction', 'engine', 'ISC motor;Carbon buildup;Throttle body;Wiring', 'medium', 'oem'),
('P1513', 'HYUKIA', 'Idle Speed Actuator – Closing Malfunction', 'engine', 'ISC motor stuck;Carbon deposits;Throttle body dirty;Vacuum leak', 'medium', 'oem'),
('P1610', 'HYUKIA', 'Immobilizer – ECU Code Not Stored', 'electrical', 'Key not matched;Smartra module;Transponder;ECU needs key registration', 'critical', 'oem'),
('P0171', 'HYUKIA', 'System Too Lean – Bank 1', 'fuel', 'PCV valve (Theta II engine common issue);Intake gasket;MAF;Fuel pump', 'medium', 'oem'),
('P0299', 'HYUKIA', 'Turbocharger Underboost', 'engine', 'Wastegate actuator (1.6 T-GDI);Boost hose;VNT sticking (diesel);Turbo oil seal', 'high', 'oem'),
('P1326', 'HYUKIA', 'Connecting Rod Bearing Clearance Excessive – KSDS Active', 'engine', 'Knock Sensor Detection System activated — engine bearing wear detected (Theta II/Nu recall);URGENT: stop driving;Bearing/engine replacement', 'critical', 'oem'),
('P0420', 'HYUKIA', 'Catalyst Efficiency Below Threshold', 'emissions', 'Cat degraded;O2 sensor;Exhaust leak;Oil burning (Theta II known)', 'medium', 'oem'),

-- ═══════════════════════════════════════════════════════════════════════════════
-- GM (Chevrolet, GMC, Cadillac, Buick) — brand_group: "GM"
-- Sources: GM TIS2Web, GM Authority, CorvetteForum, SilveradoSierra
-- ═══════════════════════════════════════════════════════════════════════════════

('P1011', 'GM', 'Intake Camshaft Position Actuator – Park Position (Bank 1)', 'engine', 'Camshaft position actuator solenoid;Oil sludge;Low oil pressure;Timing chain', 'high', 'oem'),
('P1014', 'GM', 'Exhaust Camshaft Position Actuator – Park Position (Bank 1)', 'engine', 'Exhaust cam phaser;Oil quality/level;Solenoid;Timing chain', 'high', 'oem'),
('P1101', 'GM', 'MAF Sensor – Out of Self-Test Range', 'engine', 'MAF sensor dirty;Intake air leak after MAF;Wiring;Filter restriction', 'medium', 'oem'),
('P1133', 'GM', 'HO2S Insufficient Switching Frequency (Bank 1 Sensor 1)', 'emissions', 'O2 sensor lazy/slow;Exhaust leak;Vacuum leak;Fuel trim issue', 'medium', 'oem'),
('P1153', 'GM', 'HO2S Insufficient Switching Frequency (Bank 2 Sensor 1)', 'emissions', 'O2 sensor bank 2;Exhaust leak;Intake manifold gasket (LS V8 common)', 'medium', 'oem'),
('P1174', 'GM', 'Fuel Trim Cylinder Balance – Bank 1', 'fuel', 'Vacuum leak;Intake manifold gasket (3.1/3.4/3.8L);Fuel injector;MAF', 'medium', 'oem'),
('P1516', 'GM', 'TAC Module – Throttle Position Not Available', 'engine', 'TAC module (throttle actuator control);Throttle body;APP sensor;Wiring', 'high', 'oem'),
('P1689', 'GM', 'Traction Control – Delivered Torque Output', 'chassis', 'EBCM communication;Wheel speed sensor;Traction control module;Wiring', 'medium', 'oem'),
('P3401', 'GM', 'Cylinder 1 Deactivation/Intake Valve Control – Stuck Open (AFM/DFM)', 'engine', 'AFM lifter collapsed (5.3L/6.2L V8 common);Lifter stuck;Oil pressure;VLOM assembly', 'critical', 'oem'),
('P3441', 'GM', 'Cylinder 5 Deactivation – Intake Valve Control Stuck Open', 'engine', 'AFM/DFM lifter failure;Lifter roller;Oil pressure;Cam lobe damage', 'critical', 'oem'),
('P0171', 'GM', 'System Too Lean – Bank 1', 'fuel', 'Intake manifold gasket (3.1/3.4/3.8L very common);PCV valve;MAF sensor;Fuel pressure', 'medium', 'oem'),
('P0300', 'GM', 'Random/Multiple Misfire', 'engine', 'AFM lifter failure (V8);Spark plugs;Intake manifold gasket;Fuel injector;Low compression', 'high', 'oem'),
('P0420', 'GM', 'Catalyst Efficiency Below Threshold', 'emissions', 'Cat degraded;O2 sensor;Exhaust manifold bolt broken (LS V8 common);Misfire damage', 'medium', 'oem'),

-- ═══════════════════════════════════════════════════════════════════════════════
-- STELLANTIS US (Ram, Jeep, Dodge, Chrysler) — brand_group: "MOPAR"
-- Sources: WiTECH, JeepForum, DodgeForum, RAMForumz
-- ═══════════════════════════════════════════════════════════════════════════════

('P1128', 'MOPAR', 'Closed Loop Fueling Not Achieved – Bank 1', 'fuel', 'O2 sensor;Large vacuum leak;Fuel system fault;Coolant temp sensor', 'medium', 'oem'),
('P1281', 'MOPAR', 'Engine Is Cold Too Long – Thermostat Performance', 'engine', 'Thermostat stuck open (3.6L Pentastar common);Coolant temp sensor;Low coolant', 'medium', 'oem'),
('P1282', 'MOPAR', 'Fuel Pump Relay Control Circuit', 'fuel', 'Fuel pump relay;TIPM (Totally Integrated Power Module) failure (common Chrysler/Dodge/Jeep);Wiring', 'high', 'oem'),
('P1388', 'MOPAR', 'Auto Shutdown Relay Control Circuit', 'electrical', 'ASD relay in TIPM;TIPM internal failure;Wiring;Fuse', 'high', 'oem'),
('P1391', 'MOPAR', 'Intermittent Loss of CMP or CKP Signal', 'engine', 'Cam or crank sensor intermittent;Wiring chafed;Tone wheel;Connector corrosion', 'high', 'oem'),
('P1486', 'MOPAR', 'EVAP Leak Monitor – Pinched Hose Found', 'emissions', 'EVAP hose kinked;LDP (Leak Detection Pump) hose;Vapor line routed wrong', 'low', 'oem'),
('P1595', 'MOPAR', 'Speed Control Solenoid Circuit', 'chassis', 'Cruise control solenoid;Clockspring;Wiring;Brake switch', 'low', 'oem'),
('P1693', 'MOPAR', 'Fault In Companion Module – Check Other DTCs', 'network', 'DTC stored in TCM or BCM — scan ALL modules;Communication error;CAN bus', 'medium', 'oem'),
('P0171', 'MOPAR', 'System Too Lean – Bank 1', 'fuel', 'Intake manifold gasket (3.6L Pentastar);PCV;MAF contaminated;Fuel injector', 'medium', 'oem'),
('P0300', 'MOPAR', 'Random/Multiple Misfire', 'engine', 'Spark plugs (3.6L Pentastar);Rocker arm/roller follower (HEMI known);Ignition coil;Fuel quality', 'high', 'oem'),
('P0420', 'MOPAR', 'Catalyst Efficiency Below Threshold', 'emissions', 'Cat degraded;Downstream O2;Exhaust manifold bolt (HEMI common);Misfire damage', 'medium', 'oem'),
('P0456', 'MOPAR', 'EVAP System – Small Leak Detected', 'emissions', 'Gas cap seal;EVAP purge solenoid;Leak detection pump;Vapor line crack', 'low', 'oem'),

-- ═══════════════════════════════════════════════════════════════════════════════
-- HONDA (+ Acura) — brand_group: "HONDA"
-- Sources: Honda HDS, HondaTech, AcuraZine
-- ═══════════════════════════════════════════════════════════════════════════════

('P1009', 'HONDA', 'Variable Valve Timing Control Advance Malfunction', 'engine', 'VTC actuator failure (K-series common);Oil level low;Oil passages clogged;Timing chain stretched', 'high', 'oem'),
('P1077', 'HONDA', 'IMRC System Malfunction – Low RPM', 'engine', 'Intake manifold runner control motor;Linkage;Butterfly valve stuck;Carbon', 'medium', 'oem'),
('P1078', 'HONDA', 'IMRC System Malfunction – High RPM', 'engine', 'IMRC motor;High RPM butterfly;Wiring;ECU', 'medium', 'oem'),
('P1157', 'HONDA', 'A/F Sensor (Primary O2) Circuit Malfunction (Bank 2)', 'emissions', 'A/F sensor;Wiring;Exhaust leak;Connector', 'medium', 'oem'),
('P1253', 'HONDA', 'VTEC System Malfunction', 'engine', 'VTEC solenoid spool valve;Oil pressure low;Oil passages clogged;Screen filter in solenoid blocked', 'high', 'oem'),
('P1259', 'HONDA', 'VTEC System Malfunction – Stuck Off', 'engine', 'VTEC solenoid;Oil quality (sludge);Pressure switch;Screen filter;Low oil level', 'high', 'oem'),
('P1297', 'HONDA', 'Electrical Load Detector – Low Input', 'electrical', 'ELD sensor failed;Wiring;ECU;Alternator load signal', 'medium', 'oem'),
('P1298', 'HONDA', 'Electrical Load Detector – High Input', 'electrical', 'ELD circuit;Wiring short to power;ECU issue', 'medium', 'oem'),
('P1399', 'HONDA', 'Random/Multiple Misfire Detected (Honda-specific)', 'engine', 'Ignition coils (V6);Spark plugs;Valve adjustment needed (common on older Hondas);EGR ports clogged', 'high', 'oem'),
('P1457', 'HONDA', 'EVAP Control System Leak – Fuel Tank', 'emissions', 'EVAP two-way valve on fuel tank;Canister vent shut valve;Fuel tank pressure sensor;Gas cap', 'medium', 'oem'),
('P0171', 'HONDA', 'System Too Lean – Bank 1', 'fuel', 'PCV valve;MAF sensor;Intake manifold gasket;Fuel injector;Vacuum hose', 'medium', 'oem'),
('P0420', 'HONDA', 'Catalyst Efficiency Below Threshold', 'emissions', 'Cat degraded;Downstream O2;Exhaust leak at manifold;Oil burning past valve seals', 'medium', 'oem'),
('P0300', 'HONDA', 'Random/Multiple Misfire', 'engine', 'Valve adjustment (required every 100k km on VTEC);Ignition coils;Spark plugs;Fuel injectors', 'high', 'oem'),

-- ═══════════════════════════════════════════════════════════════════════════════
-- SUBARU — brand_group: "SUBARU"
-- Sources: Subaru SSM, NASIOC, SubaruForester.org
-- ═══════════════════════════════════════════════════════════════════════════════

('P1086', 'SUBARU', 'Tumble Generator Valve Position Sensor 1 – Low Input', 'engine', 'TGV actuator;Position sensor;Wiring;Carbon buildup', 'medium', 'oem'),
('P1087', 'SUBARU', 'Tumble Generator Valve Position Sensor 1 – High Input', 'engine', 'TGV position sensor;Wiring short;Actuator', 'medium', 'oem'),
('P1092', 'SUBARU', 'Tumble Generator Valve Actuator 1 – Open Circuit', 'engine', 'TGV motor open;Wiring;Connector;ECU driver', 'medium', 'oem'),
('P1130', 'SUBARU', 'Front O2 Sensor – Circuit Range/Performance', 'emissions', 'Front A/F sensor;Exhaust leak (head gasket related on EJ series);Wiring', 'medium', 'oem'),
('P1390', 'SUBARU', 'Timing Over-Retarded – Bank 1', 'engine', 'Oil control valve;Low oil pressure;AVCS system;Oil quality', 'high', 'oem'),
('P1443', 'SUBARU', 'EVAP Canister Purge Control Valve – Electrical', 'emissions', 'Purge solenoid;Wiring;ECU driver', 'low', 'oem'),
('P1491', 'SUBARU', 'EGR Valve – Solenoid Circuit', 'emissions', 'EGR solenoid;Wiring;Carbon buildup in EGR system', 'medium', 'oem'),
('P1560', 'SUBARU', 'Backup Power Supply Circuit', 'electrical', 'Battery voltage drop;Alternator;Wiring to ECU backup power;Fuse', 'medium', 'oem'),
('P0171', 'SUBARU', 'System Too Lean – Bank 1', 'fuel', 'Intake manifold gasket;MAF sensor;PCV valve;Head gasket (EJ25 external coolant leak affecting sensor)', 'medium', 'oem'),
('P0420', 'SUBARU', 'Catalyst Efficiency Below Threshold', 'emissions', 'Cat degraded;Downstream O2;Head gasket leak contaminating cat (EJ25 boxer common);Exhaust leak', 'medium', 'oem'),
('P0301', 'SUBARU', 'Cylinder 1 Misfire', 'engine', 'Ignition coil;Spark plug;Head gasket (EJ25 boxer — coolant into cylinder);Valve issue', 'high', 'oem'),

-- ═══════════════════════════════════════════════════════════════════════════════
-- MAZDA — brand_group: "MAZDA"
-- Sources: Mazda IDS, MazdaForum, MX-5Miata.net
-- ═══════════════════════════════════════════════════════════════════════════════

('P1170', 'MAZDA', 'Front HO2S Stuck at Mid-Range', 'emissions', 'O2 sensor contaminated;Vacuum leak;MAF sensor dirty;Fuel trim issue', 'medium', 'oem'),
('P1195', 'MAZDA', 'Barometric Pressure Sensor (BARO) Circuit', 'engine', 'MAP/BARO sensor fault;Vacuum hose;Altitude adaptation;Wiring', 'medium', 'oem'),
('P1250', 'MAZDA', 'Pressure Regulator Control Solenoid Circuit', 'fuel', 'Fuel pressure regulator solenoid;Wiring;Fuel pressure sensor', 'medium', 'oem'),
('P1345', 'MAZDA', 'Variable Swirl Control Valve Actuator Circuit', 'engine', 'Swirl valve motor;Linkage;Carbon on flaps;Wiring', 'medium', 'oem'),
('P1410', 'MAZDA', 'EGR Valve Position Sensor Circuit', 'emissions', 'EGR valve position sensor;Carbon fouling;Wiring;EGR valve', 'medium', 'oem'),
('P1442', 'MAZDA', 'EVAP Control System – Small Leak Detected', 'emissions', 'Gas cap;Purge valve;Canister;Vapor line crack', 'low', 'oem'),
('P1510', 'MAZDA', 'Throttle Control – MFI (ETC System)', 'engine', 'Electronic throttle body;APP sensor;Wiring;ECU', 'high', 'oem'),
('P1521', 'MAZDA', 'Variable Intake Air System (VIAS) Solenoid', 'engine', 'VIAS solenoid;Vacuum actuator;Intake runner flaps;Wiring', 'medium', 'oem'),
('P0171', 'MAZDA', 'System Too Lean – Bank 1', 'fuel', 'PCV valve;MAF sensor (hot film);Intake gasket;Boost leak (SkyActiv-G turbo)', 'medium', 'oem'),
('P0420', 'MAZDA', 'Catalyst Efficiency Below Threshold', 'emissions', 'Cat degraded;Downstream O2 sensor;Exhaust leak at manifold;Oil consumption', 'medium', 'oem'),

-- ═══════════════════════════════════════════════════════════════════════════════
-- VOLVO — brand_group: "VOLVO"
-- Sources: Volvo VIDA/DICE, SwedeSpeed, VolvoForums
-- ═══════════════════════════════════════════════════════════════════════════════

('P1171', 'VOLVO', 'System Too Lean – Bank 1 Part Load', 'fuel', 'PCV system (flame trap/oil trap);Intake manifold gasket;MAF sensor;Boost leak', 'medium', 'oem'),
('P1172', 'VOLVO', 'System Too Rich – Bank 1 Part Load', 'fuel', 'Fuel injector leaking;O2 sensor;Fuel pressure regulator;EVAP purge valve', 'medium', 'oem'),
('P1237', 'VOLVO', 'Turbocharger Boost Control Deviation', 'engine', 'CBV (charge bypass valve);Wastegate actuator;Boost pressure sensor;Boost hose', 'high', 'oem'),
('P1238', 'VOLVO', 'Turbocharger Boost Pressure Sensor / Boost Control Malfunction', 'engine', 'MAP sensor;Boost solenoid;Wastegate;Turbo VNT mechanism', 'high', 'oem'),
('P1273', 'VOLVO', 'Electronic Throttle System Malfunction', 'engine', 'Electronic throttle module (ETM) failure (P2/V70 very common);Wiring;ECU', 'high', 'oem'),
('P1336', 'VOLVO', 'Crankshaft Position Sensor – RPM Signal', 'engine', 'Crank sensor;Wiring;Flywheel teeth;Sensor gap', 'high', 'oem'),
('P1449', 'VOLVO', 'EVAP Leak Detection Pump Circuit Malfunction', 'emissions', 'LDP motor;Wiring;EVAP system;Purge valve', 'low', 'oem'),
('P1505', 'VOLVO', 'Idle Air Control Valve Opening Signal', 'engine', 'IACV;Throttle body dirty;Vacuum leak;ETM', 'medium', 'oem'),
('P1602', 'VOLVO', 'Engine Control Module – Power Stage Group B', 'electrical', 'ECU internal driver failure;Power supply;Wiring to injectors/coils', 'high', 'oem'),
('P1618', 'VOLVO', 'Transmission Control Module – MIL Request', 'transmission', 'TCM detected fault — check transmission DTCs;Solenoid;Fluid level/condition;Valve body', 'high', 'oem'),
('P0171', 'VOLVO', 'System Too Lean – Bank 1', 'fuel', 'PCV/oil trap system clogged (5-cyl engines very common);Intake hose;MAF;Fuel pressure', 'medium', 'oem'),
('P0420', 'VOLVO', 'Catalyst Efficiency Below Threshold', 'emissions', 'Cat degraded;Downstream O2;PCV failure causing oil contamination;Exhaust leak', 'medium', 'oem'),

-- ═══════════════════════════════════════════════════════════════════════════════
-- SUZUKI — brand_group: "SUZUKI"
-- ═══════════════════════════════════════════════════════════════════════════════

('P1107', 'SUZUKI', 'MAP Sensor – Signal Voltage Low', 'engine', 'MAP sensor fault;Vacuum hose;Wiring short to ground;Intake leak', 'medium', 'oem'),
('P1116', 'SUZUKI', 'ECT Circuit Performance', 'engine', 'Coolant temp sensor drift;Thermostat;Low coolant;Wiring', 'medium', 'oem'),
('P1121', 'SUZUKI', 'Throttle Position Sensor – Intermittent High', 'engine', 'TPS failing;Connector corrosion;Throttle body;Wiring', 'medium', 'oem'),
('P1231', 'SUZUKI', 'Fuel Pump Relay – High Voltage', 'fuel', 'Fuel pump relay;Wiring;ECU driver;Relay socket', 'medium', 'oem'),
('P1320', 'SUZUKI', 'Crankshaft Segment Malfunction', 'engine', 'Crank sensor;Tone wheel;Wiring;Engine vibration', 'high', 'oem'),
('P1408', 'SUZUKI', 'MAP Sensor / EGR System Circuit Malfunction', 'emissions', 'EGR valve;MAP sensor interaction;Vacuum hose;Carbon buildup', 'medium', 'oem'),
('P1510', 'SUZUKI', 'ECM Supply Voltage', 'electrical', 'Battery weak;Alternator;Main relay;Ground connection', 'medium', 'oem'),
('P1614', 'SUZUKI', 'Transponder Response Error / Immobilizer Key Mismatch', 'electrical', 'Key transponder;Immobilizer antenna;ECU not matched;Key battery', 'critical', 'oem'),

-- ═══════════════════════════════════════════════════════════════════════════════
-- TESLA — brand_group: "TESLA"
-- (Tesla uses proprietary diagnostics but some OBD-II codes are standard)
-- ═══════════════════════════════════════════════════════════════════════════════

('P0A09', 'TESLA', 'DC/DC Converter Status Circuit', 'electrical', 'DC/DC converter failing;12V battery drained;Cooling system for DC/DC;HV connection', 'high', 'oem'),
('P0A1F', 'TESLA', 'Battery Energy Control Module', 'electrical', 'BMS fault;Cell imbalance;Temperature sensor;HV contactor', 'high', 'oem'),
('P0AA6', 'TESLA', 'HV Battery Isolation Fault', 'electrical', 'Isolation monitoring device;Coolant leak into battery (early Model S/X);HV cable;Connector corrosion', 'critical', 'oem'),
('P0C73', 'TESLA', 'Drive Motor Inverter Temperature – High', 'electrical', 'Inverter overheating;Coolant system;Thermal paste degradation;Aggressive driving in heat', 'high', 'oem'),
('P0D14', 'TESLA', 'HV Battery Cell Voltage Low', 'electrical', 'Individual cell degradation;BMS fault;Contactors;Cell balancing issue', 'critical', 'oem'),
('P0D15', 'TESLA', 'HV Battery Cell Voltage High', 'electrical', 'Cell imbalance;Overcharging;BMS;Temperature sensor', 'high', 'oem'),
('P0AFA', 'TESLA', '14V Power Module System Performance', 'electrical', '12V battery degraded (Tesla 12V lead-acid/lithium);DC/DC converter;Wiring;Aux battery management', 'medium', 'oem'),
('U0073', 'TESLA', 'CAN Bus Communication Off', 'network', 'CAN bus fault;Module failure;12V system voltage drop;HV contactor issue', 'critical', 'oem'),
('U0100', 'TESLA', 'Lost Communication With Vehicle Controller', 'network', 'Vehicle controller (MCU);12V power supply;CAN wiring;eMMC failure (MCUv1)', 'critical', 'oem')

ON CONFLICT (code, COALESCE(brand_group, '__generic__')) DO NOTHING;
