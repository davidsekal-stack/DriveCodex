-- ═══════════════════════════════════════════════════════════════════════════════
-- GearBrain — DTC codes: BMW + Mercedes-Benz brand-specific codes
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add brand group mappings to dtc-lookup.js: BMW → "BMW", Mercedes-Benz → "MB"

INSERT INTO public.gearbrain_dtc_codes (code, brand_group, description, system, common_causes, severity, source) VALUES

-- ═══════════════════════════════════════════════════════════════════════════════
-- BMW-specific codes
-- Sources: ISTA, Bimmerpost, Bimmerfest, RealOEM, BMWfault.com
-- ═══════════════════════════════════════════════════════════════════════════════

-- VANOS / Valvetronic (BMW signature systems)
('P1520', 'BMW', 'Valvetronic System – Stuck/Stalled', 'engine', 'Valvetronic motor (eccentric shaft sensor);Eccentric shaft seized;Wiring harness;VVT adaptation lost', 'critical', 'oem'),
('P1523', 'BMW', 'Valvetronic – Learning Limit Position Error', 'engine', 'Eccentric shaft sensor dirty;Valvetronic motor weak;Adaptation needed after battery disconnect;Oil sludge in system', 'high', 'oem'),
('P1525', 'BMW', 'Valvetronic Actuator Monitoring – Torque Plausibility', 'engine', 'Eccentric shaft play;Valvetronic motor;Oil quality;Worn helical gear', 'high', 'oem'),
('P0015', 'BMW', 'Camshaft Position B – Timing Over-Retarded (Bank 1)', 'engine', 'VANOS solenoid clogged with oil sludge;Low oil pressure;VANOS unit worn;Oil quality/level', 'high', 'oem'),
('P0014', 'BMW', 'Camshaft Position B – Timing Over-Advanced (Bank 1)', 'engine', 'VANOS solenoid stuck open;Oil sludge;VANOS piston seal worn;Low oil level', 'high', 'oem'),
('P0012', 'BMW', 'Camshaft Position A – Timing Over-Retarded (Bank 1)', 'engine', 'Intake VANOS solenoid;Oil sludge;Low oil pressure;Failed oil pump', 'high', 'oem'),
('P0010', 'BMW', 'Camshaft Position A Actuator Circuit (Bank 1)', 'engine', 'VANOS solenoid wiring;Solenoid coil failure;ECU driver', 'medium', 'oem'),

-- Fuel / Injection (N20/N55/B48/B58)
('P1083', 'BMW', 'Fuel Control Mixture Lean (Bank 1)', 'fuel', 'Vacuum leak at valve cover (common N20/N55);Cracked charge pipe;VANOS seal leak;Faulty injector', 'medium', 'oem'),
('P1084', 'BMW', 'Fuel Control Mixture Rich (Bank 1)', 'fuel', 'Leaking fuel injector;High-pressure fuel pump;Faulty O2 sensor;EVAP purge stuck open', 'medium', 'oem'),
('P1188', 'BMW', 'Fuel Rail Pressure Sensor – Signal Low', 'fuel', 'High-pressure fuel pump failing;Low-pressure fuel pump weak;Fuel filter;Rail pressure sensor', 'high', 'oem'),
('P1189', 'BMW', 'Fuel Rail Pressure Sensor – Signal High', 'fuel', 'Fuel pressure regulator;Rail pressure sensor fault;Blocked return line', 'high', 'oem'),
('P13C6', 'BMW', 'Fuel High-Pressure System – Pressure at Injection Too Low', 'fuel', 'High-pressure fuel pump (HPFP) failing (common N54/N55);Low-pressure pump;Fuel quality;Injector leak-back', 'critical', 'oem'),

-- Turbo / Charge system (N54/N55/B58)
('P1555', 'BMW', 'Charge Pressure – Upper Control Deviation', 'engine', 'Wastegate actuator stuck/weak;Charge pipe leak (N54/N55 plastic pipe);Boost solenoid;Turbo bearing wear', 'high', 'oem'),
('P1557', 'BMW', 'Charge Pressure – Negative Deviation During Buildup', 'engine', 'Boost leak (intercooler, charge pipe);Wastegate stuck open;VNT actuator (diesel);Turbo failure', 'high', 'oem'),
('P0299', 'BMW', 'Turbocharger/Supercharger A Underboost Condition', 'engine', 'Charge pipe cracked/blown off (N54/N55 common);Wastegate rattle;Vacuum line;Intercooler leak', 'high', 'oem'),

-- Cooling system (BMW Achilles heel)
('P0128', 'BMW', 'Coolant Thermostat Below Regulating Temperature', 'engine', 'Electric thermostat failed open (extremely common N52/N54/N55);Coolant temperature sensor;Low coolant', 'medium', 'oem'),
('P2BA4', 'BMW', 'Coolant Pump – Plausibility / Flow Insufficient', 'engine', 'Electric water pump failed (common N52/N55/B58);Pump impeller cracked;Wiring;Coolant level low', 'critical', 'oem'),
('P2BBF', 'BMW', 'Coolant Pump Request Monitoring', 'engine', 'Electric water pump motor failing;Internal electronics;Pump seized;Coolant contamination', 'critical', 'oem'),

-- Oil system
('P052A', 'BMW', 'Oil Condition Deterioration – Oil Service Overdue', 'engine', 'Oil change overdue;Fuel dilution in oil;Faulty oil condition sensor;Wrong oil specification', 'medium', 'oem'),
('P052B', 'BMW', 'Oil Pressure Control Solenoid Performance/Stuck Off', 'engine', 'Oil pressure solenoid;Low oil level;Oil pump wear;Oil pickup tube clogged', 'high', 'oem'),

-- Crankshaft / Camshaft
('P1345', 'BMW', 'Misfire Cylinder 1 With Fuel Cutoff Active', 'engine', 'Ignition coil failure (common);Spark plug;Injector;Compression', 'high', 'oem'),
('P1396', 'BMW', 'Crankshaft–Camshaft Position Error', 'engine', 'Timing chain stretched (N47/N20 common);Chain guide broken;VANOS;Crank sensor', 'critical', 'oem'),

-- N47 Timing chain (notorious)
('P0016', 'BMW', 'Crankshaft Pos. – Camshaft Pos. Correlation Bank 1 Sensor A', 'engine', 'Timing chain stretched (N47 2.0d CRITICAL known issue);Chain guide shattered;Tensioner failed;URGENT — engine destruction risk', 'critical', 'oem'),

-- Diesel specific (N47/B47)
('P2002', 'BMW', 'DPF Efficiency Below Threshold – Bank 1', 'emissions', 'DPF clogged (short trips);Differential pressure sensor;EGR fault causing excess soot;Injector issue;Wrong oil spec (must be LL-04)', 'high', 'oem'),
('P20EE', 'BMW', 'SCR NOx Catalyst Efficiency Below Threshold', 'emissions', 'AdBlue quality;SCR catalyst aged;NOx sensor;AdBlue injector;Heater circuit', 'high', 'oem'),
('P2463', 'BMW', 'DPF Soot Accumulation', 'emissions', 'Short trip driving;Failed regen;Glow plug fault;EGR;Oil spec (LL-04 mandatory)', 'high', 'oem'),

-- DSC / ABS / Chassis
('P0562', 'BMW', 'System Voltage Low', 'electrical', 'IBS (intelligent battery sensor) fault;Battery registration needed after replacement;Alternator;Corroded ground', 'medium', 'oem'),
('C0020', 'BMW', 'Steering Angle Sensor – Plausibility', 'chassis', 'Needs calibration after alignment;Sensor fault;Steering column issue;Clock spring', 'medium', 'oem'),

-- Transmission (ZF 8HP)
('P0700', 'BMW', 'Transmission Control System Malfunction', 'transmission', 'TCM software issue;Mechatronic sleeve connector leak (8HP common);Low ATF;Solenoid', 'high', 'oem'),
('P0730', 'BMW', 'Incorrect Gear Ratio', 'transmission', 'Clutch pack wear (8HP);Mechatronic valve body;Low ATF level;Fluid contaminated — check if ATF was ever changed', 'high', 'oem'),
('P17D1', 'BMW', 'Transmission Oil Deterioration', 'transmission', 'ATF needs replacement (ZF recommends 80k km despite BMW "lifetime fill" claim);Overheating;Contamination', 'medium', 'oem'),

-- ═══════════════════════════════════════════════════════════════════════════════
-- Mercedes-Benz-specific codes
-- Sources: XENTRY/DAS, MBWorld, BenzWorld, PeachParts
-- ═══════════════════════════════════════════════════════════════════════════════

-- Diesel (OM651/OM654/OM642)
('P0401', 'MB', 'EGR Flow Insufficient', 'emissions', 'EGR valve seized with carbon (OM651 very common);EGR cooler bypass stuck;Swirl flap linkage;Vacuum actuator', 'high', 'oem'),
('P2002', 'MB', 'DPF Efficiency Below Threshold – Bank 1', 'emissions', 'DPF saturated;Differential pressure sensor lines cracked;5th injector (DPF regeneration) clogged;Glow plug issue', 'high', 'oem'),
('P2463', 'MB', 'DPF Soot Accumulation', 'emissions', 'Short trip driving;5th injector for regen failed;EGR fault;Oil spec must be MB 229.52', 'high', 'oem'),
('P20EE', 'MB', 'SCR NOx Catalyst Efficiency Below Threshold', 'emissions', 'AdBlue quality sensor;SCR catalyst;NOx sensor N1/N2;AdBlue dosing module;Heater element', 'critical', 'oem'),
('P207F', 'MB', 'Reductant Quality Performance', 'emissions', 'Contaminated AdBlue;Wrong fluid added;AdBlue crystallization in lines;Quality sensor Y134', 'high', 'oem'),
('P204F', 'MB', 'Reductant System Performance – Improper Dosing', 'emissions', 'AdBlue pump/dosing module A161;Clogged nozzle;Lines blocked/frozen;Relay', 'high', 'oem'),
('P0671', 'MB', 'Glow Plug Cylinder 1 Circuit', 'engine', 'Glow plug failed;Glow plug control module N14/3;Wiring corrosion at plug connector', 'medium', 'oem'),

-- Petrol (M274/M276/M264)
('P0171', 'MB', 'System Too Lean – Bank 1', 'fuel', 'Intake manifold gasket (M274 known issue);Vacuum leak;MAF sensor;Camshaft adjuster seal;PCV', 'medium', 'oem'),
('P1186', 'MB', 'Fuel Trim Too Lean – Bank 1', 'fuel', 'Cracked intake manifold (M272/M273);Vacuum hose;MAF sensor;Fuel pressure', 'high', 'oem'),
('P1187', 'MB', 'Fuel Trim Too Rich – Bank 1', 'fuel', 'Leaking injector;Fuel pressure regulator;O2 sensor;EVAP leak', 'medium', 'oem'),
('P0016', 'MB', 'Crankshaft–Camshaft Position Correlation Bank 1', 'engine', 'Timing chain stretched (M271/M274);Cam adjuster solenoid Y49;Oil quality;Chain tensioner', 'critical', 'oem'),

-- Turbo
('P0299', 'MB', 'Turbocharger Underboost', 'engine', 'Boost leak (charge pipe, intercooler);Wastegate actuator;VNT vanes stuck (diesel);Turbo bearing wear;Boost pressure sensor', 'high', 'oem'),

-- Balance shaft (M272/M273 notorious)
('P0016', 'MB', 'Camshaft Position Correlation – Bank 1', 'engine', 'Balance shaft gear wear (M272/M273 2004-2008 known defect);Timing chain;Cam adjuster;Oil starved', 'critical', 'oem'),

-- Electrical / SAM
('P1570', 'MB', 'Immobilizer – Engine Start Locked', 'electrical', 'EIS (Electronic Ignition Switch) module fault;Key transponder;Steering lock module (ELV);DME communication', 'critical', 'oem'),
('P0562', 'MB', 'System Voltage Low', 'electrical', 'Auxiliary battery (48V mild hybrid);Main battery;SAM module drain;Alternator;Ground point corrosion', 'medium', 'oem'),
('P0563', 'MB', 'System Voltage High', 'electrical', 'Voltage regulator;Alternator overcharging;Battery sensor B47;DC-DC converter (hybrid)', 'medium', 'oem'),

-- Transmission (722.9 / 9G-Tronic)
('P0700', 'MB', 'Transmission Control System Malfunction', 'transmission', 'Conductor plate (722.9 common failure);Speed sensor;TCM;Low ATF;Valve body', 'high', 'oem'),
('P0730', 'MB', 'Incorrect Gear Ratio', 'transmission', 'Clutch pack wear;Conductor plate (722.9);Torque converter;Low fluid level', 'high', 'oem'),
('P0741', 'MB', 'Torque Converter Clutch – Performance/Stuck Off', 'transmission', 'Torque converter lockup valve;Conductor plate;Low ATF;Valve body contamination', 'high', 'oem'),
('P1747', 'MB', 'Torque Converter Clutch System Performance', 'transmission', 'Torque converter wear;722.9 conductor plate;Fluid level/quality;Overheating', 'high', 'oem'),

-- Body / Comfort
('P1515', 'MB', 'Intake Manifold Flap – Actuator Circuit', 'engine', 'Swirl flap actuator M44 (diesel);Linkage broken;Swirl flaps seized with carbon', 'medium', 'oem'),
('P1542', 'MB', 'Throttle Actuator Control Range/Performance', 'engine', 'Electronic throttle body;Dirty throttle plate;Wiring;Adaptation needed', 'high', 'oem'),
('P1400', 'MB', 'EGR Valve Position Sensor', 'emissions', 'EGR valve position potentiometer;Carbon fouling;Wiring;EGR valve replacement needed', 'medium', 'oem'),
('P1453', 'MB', 'Glow Plug Relay – Bank 1', 'engine', 'Glow plug relay N14/3;Wiring;Fuse;Module internal fault', 'medium', 'oem'),

-- Steering
('P1633', 'MB', 'Accelerator Pedal Sensor A+B – Correlation Error', 'engine', 'Faulty accelerator pedal module;Wiring;Floor mat interference;ECU', 'high', 'oem'),
('P1700', 'MB', 'Transmission Range Display – Circuit Malfunction', 'transmission', 'Gear position sensor (ISM);Conductor plate;Wiring;Shifter mechanism', 'medium', 'oem'),

-- Network / Communication
('U0073', 'MB', 'Control Module Communication Bus A Off', 'network', 'CAN bus fault;SAM module (front or rear);Water damage;Gateway module;Aftermarket device', 'critical', 'oem'),
('U0100', 'MB', 'Lost Communication With ECM/PCM', 'network', 'ECU power supply;CAN bus short;ECU failure;Key/immobilizer issue', 'critical', 'oem'),
('U0101', 'MB', 'Lost Communication With TCM', 'network', 'Conductor plate harness (722.9);TCM power;CAN bus;Module failure', 'high', 'oem'),

-- Air suspension (common on W211/W220/W164/W166)
('C1132', 'MB', 'Air Suspension – Compressor Runtime Exceeded', 'chassis', 'Air spring leaking (rubber bladder);Compressor worn out;Valve block leak;Air line cracked', 'high', 'oem'),
('C1401', 'MB', 'Air Suspension – Vehicle Level Front Left Too Low', 'chassis', 'Front left air spring leak;Air line connection;Valve block;Compressor weak', 'high', 'oem')

ON CONFLICT (code, COALESCE(brand_group, '__generic__')) DO NOTHING;
