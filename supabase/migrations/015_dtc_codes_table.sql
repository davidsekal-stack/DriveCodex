-- ═══════════════════════════════════════════════════════════════════════════════
-- GearBrain — DTC code lookup database
-- Structured manufacturer-specific + generic OBD-II fault code descriptions
-- ═══════════════════════════════════════════════════════════════════════════════

-- Clean up partial state from failed migration attempt
DROP TABLE IF EXISTS public.gearbrain_dtc_codes CASCADE;
DROP FUNCTION IF EXISTS lookup_dtc_codes(TEXT[], TEXT);

CREATE TABLE public.gearbrain_dtc_codes (
  id           SERIAL PRIMARY KEY,
  code         TEXT NOT NULL,                    -- P0171, P1250, C0035, B1000, U0001
  brand_group  TEXT,                             -- NULL = generic/SAE, 'VAG' = VW/Audi/Škoda/Seat, 'BMW', etc.
  description  TEXT NOT NULL,                    -- Human-readable fault description
  system       TEXT,                             -- engine, transmission, body, chassis, network, emissions, fuel, electrical
  common_causes TEXT,                            -- Typical root causes (semicolon-separated)
  severity     TEXT DEFAULT 'medium',            -- low, medium, high, critical
  source       TEXT DEFAULT 'community',         -- 'sae', 'community', 'oem', 'ai-enriched'
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Fast lookups by code (most common query)
CREATE INDEX idx_dtc_code ON public.gearbrain_dtc_codes (code);

-- Lookup by brand group
CREATE INDEX idx_dtc_brand_group ON public.gearbrain_dtc_codes (brand_group);

-- Composite: code + brand_group for exact match
CREATE UNIQUE INDEX idx_dtc_code_brand ON public.gearbrain_dtc_codes (code, COALESCE(brand_group, '__generic__'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- Lookup function: returns best match (brand-specific first, then generic)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION lookup_dtc_codes(
  codes TEXT[],
  p_brand_group TEXT DEFAULT NULL
)
RETURNS TABLE (
  code          TEXT,
  brand_group   TEXT,
  description   TEXT,
  system        TEXT,
  common_causes TEXT,
  severity      TEXT
) LANGUAGE sql STABLE AS $$
  SELECT DISTINCT ON (d.code)
    d.code,
    d.brand_group,
    d.description,
    d.system,
    d.common_causes,
    d.severity
  FROM public.gearbrain_dtc_codes d
  WHERE d.code = ANY(codes)
    AND (d.brand_group = p_brand_group OR d.brand_group IS NULL)
  ORDER BY d.code,
    -- Prefer brand-specific over generic
    CASE WHEN d.brand_group IS NOT NULL THEN 0 ELSE 1 END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED: Generic SAE OBD-II codes (P0xxx, P2xxx — universal)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO public.gearbrain_dtc_codes (code, brand_group, description, system, common_causes, severity, source) VALUES
-- Fuel system
('P0087', NULL, 'Fuel Rail/System Pressure Too Low', 'fuel', 'Weak fuel pump;Clogged fuel filter;Leaking fuel line;Faulty fuel pressure regulator', 'high', 'sae'),
('P0088', NULL, 'Fuel Rail/System Pressure Too High', 'fuel', 'Faulty fuel pressure regulator;Blocked return line;Faulty fuel pump driver', 'high', 'sae'),
('P0089', NULL, 'Fuel Pressure Regulator Performance', 'fuel', 'Failed pressure regulator;Vacuum line leak;Fuel pump issue', 'high', 'sae'),
('P0093', NULL, 'Fuel System Leak Detected – Large', 'fuel', 'Cracked fuel line;Faulty injector seal;Loose fuel rail connection', 'critical', 'sae'),
('P0171', NULL, 'System Too Lean (Bank 1)', 'fuel', 'Vacuum leak;Faulty MAF sensor;Weak fuel pump;Clogged fuel injectors;Intake gasket leak', 'medium', 'sae'),
('P0172', NULL, 'System Too Rich (Bank 1)', 'fuel', 'Faulty O2 sensor;Leaking fuel injector;Faulty MAP sensor;Clogged air filter', 'medium', 'sae'),
('P0174', NULL, 'System Too Lean (Bank 2)', 'fuel', 'Vacuum leak;Faulty MAF sensor;Intake manifold gasket', 'medium', 'sae'),
('P0175', NULL, 'System Too Rich (Bank 2)', 'fuel', 'Faulty O2 sensor;Leaking fuel injector;Faulty fuel pressure regulator', 'medium', 'sae'),
('P0191', NULL, 'Fuel Rail Pressure Sensor Circuit Range/Performance', 'fuel', 'Faulty fuel rail pressure sensor;Wiring issue;Low fuel pressure', 'medium', 'sae'),
('P0201', NULL, 'Injector Circuit/Open – Cylinder 1', 'fuel', 'Faulty injector;Wiring harness damage;ECU driver failure', 'high', 'sae'),
('P0202', NULL, 'Injector Circuit/Open – Cylinder 2', 'fuel', 'Faulty injector;Wiring harness damage;ECU driver failure', 'high', 'sae'),
('P0203', NULL, 'Injector Circuit/Open – Cylinder 3', 'fuel', 'Faulty injector;Wiring harness damage;ECU driver failure', 'high', 'sae'),
('P0204', NULL, 'Injector Circuit/Open – Cylinder 4', 'fuel', 'Faulty injector;Wiring harness damage;ECU driver failure', 'high', 'sae'),
('P0251', NULL, 'Injection Pump Fuel Metering Control A – Malfunction', 'fuel', 'Faulty metering valve;Fuel pump wear;Wiring issue', 'high', 'sae'),
('P0263', NULL, 'Cylinder 1 Contribution/Balance', 'fuel', 'Faulty injector;Low compression;Valve timing issue', 'high', 'sae'),

-- Ignition / Misfire
('P0300', NULL, 'Random/Multiple Cylinder Misfire Detected', 'engine', 'Spark plugs worn;Ignition coil failure;Vacuum leak;Low fuel pressure;Compression issue', 'high', 'sae'),
('P0301', NULL, 'Cylinder 1 Misfire Detected', 'engine', 'Faulty spark plug;Ignition coil;Injector;Low compression', 'high', 'sae'),
('P0302', NULL, 'Cylinder 2 Misfire Detected', 'engine', 'Faulty spark plug;Ignition coil;Injector;Low compression', 'high', 'sae'),
('P0303', NULL, 'Cylinder 3 Misfire Detected', 'engine', 'Faulty spark plug;Ignition coil;Injector;Low compression', 'high', 'sae'),
('P0304', NULL, 'Cylinder 4 Misfire Detected', 'engine', 'Faulty spark plug;Ignition coil;Injector;Low compression', 'high', 'sae'),
('P0305', NULL, 'Cylinder 5 Misfire Detected', 'engine', 'Faulty spark plug;Ignition coil;Injector;Low compression', 'high', 'sae'),
('P0306', NULL, 'Cylinder 6 Misfire Detected', 'engine', 'Faulty spark plug;Ignition coil;Injector;Low compression', 'high', 'sae'),

-- EGR
('P0401', NULL, 'Exhaust Gas Recirculation Flow Insufficient', 'emissions', 'Clogged EGR valve;Carbon buildup;Faulty EGR position sensor;Blocked EGR passages', 'medium', 'sae'),
('P0402', NULL, 'Exhaust Gas Recirculation Flow Excessive', 'emissions', 'EGR valve stuck open;Faulty EGR vacuum solenoid;Vacuum leak', 'medium', 'sae'),
('P0403', NULL, 'Exhaust Gas Recirculation Circuit Malfunction', 'emissions', 'Faulty EGR solenoid;Wiring issue;ECU fault', 'medium', 'sae'),

-- Catalytic converter
('P0420', NULL, 'Catalyst System Efficiency Below Threshold (Bank 1)', 'emissions', 'Worn catalytic converter;Faulty O2 sensor (downstream);Exhaust leak;Engine misfire damage', 'medium', 'sae'),
('P0430', NULL, 'Catalyst System Efficiency Below Threshold (Bank 2)', 'emissions', 'Worn catalytic converter;Faulty O2 sensor (downstream);Exhaust leak', 'medium', 'sae'),

-- EVAP
('P0489', NULL, 'EGR A Control Circuit Low', 'emissions', 'Wiring short to ground;Faulty EGR solenoid;ECU issue', 'low', 'sae'),
('P0490', NULL, 'EGR A Control Circuit High', 'emissions', 'Wiring short to power;Faulty EGR solenoid;ECU issue', 'low', 'sae'),

-- Turbo
('P0234', NULL, 'Turbocharger/Supercharger Overboost Condition', 'engine', 'Stuck wastegate;Faulty boost control solenoid;Boost pressure sensor;Vacuum line leak', 'high', 'sae'),
('P0235', NULL, 'Turbocharger Boost Sensor A Circuit', 'engine', 'Faulty MAP/boost sensor;Wiring issue;Vacuum leak', 'medium', 'sae'),
('P0236', NULL, 'Turbocharger Boost Sensor A Circuit Range/Performance', 'engine', 'Boost sensor drift;Carbon buildup in intake;Wastegate malfunction', 'medium', 'sae'),
('P0299', NULL, 'Turbocharger/Supercharger Underboost', 'engine', 'Boost leak;Worn turbo bearings;Stuck wastegate;Clogged air filter;Intercooler leak', 'high', 'sae'),
('P0243', NULL, 'Turbocharger Wastegate Solenoid A', 'engine', 'Faulty N75 solenoid;Vacuum line leak;Wiring issue', 'medium', 'sae'),
('P0244', NULL, 'Turbocharger Wastegate Solenoid A Range/Performance', 'engine', 'Sticking wastegate;Worn N75 valve;Boost leak', 'medium', 'sae'),
('P0245', NULL, 'Turbocharger Wastegate Solenoid A Low', 'engine', 'Wiring short to ground;Faulty solenoid;ECU driver issue', 'medium', 'sae'),
('P0246', NULL, 'Turbocharger Wastegate Solenoid A High', 'engine', 'Wiring short to power;Faulty solenoid;ECU driver issue', 'medium', 'sae'),

-- Diesel specific
('P0380', NULL, 'Glow Plug/Heater Circuit A', 'engine', 'Faulty glow plug;Glow plug relay;Wiring issue;Glow plug control module', 'medium', 'sae'),
('P0381', NULL, 'Glow Plug/Heater Indicator Circuit', 'engine', 'Faulty indicator bulb;Wiring issue;Glow plug relay', 'low', 'sae'),
('P0670', NULL, 'Glow Plug Module Control Circuit', 'engine', 'Faulty glow plug control module;Wiring;Bus communication error', 'medium', 'sae'),
('P0671', NULL, 'Glow Plug Cylinder 1 Circuit', 'engine', 'Faulty glow plug;Wiring corrosion;Control module failure', 'medium', 'sae'),

-- DPF / SCR / AdBlue
('P2002', NULL, 'Diesel Particulate Filter Efficiency Below Threshold (Bank 1)', 'emissions', 'DPF clogged;Failed regeneration;Faulty differential pressure sensor;Oil contamination', 'high', 'sae'),
('P2003', NULL, 'Diesel Particulate Filter Efficiency Below Threshold (Bank 2)', 'emissions', 'DPF clogged;Failed regeneration;Faulty differential pressure sensor', 'high', 'sae'),
('P2263', NULL, 'Turbocharger/Supercharger Boost System Performance', 'engine', 'Wastegate stuck;VNT mechanism seized;Boost leak;Faulty actuator', 'high', 'sae'),
('P2599', NULL, 'Turbocharger Boost Pressure Control Position Not Learned', 'engine', 'Adaptation not performed after repair;Faulty actuator;ECU update needed', 'medium', 'sae'),
('P242F', NULL, 'Diesel Particulate Filter Restriction – Ash Accumulation', 'emissions', 'DPF full of ash;Needs cleaning or replacement;High oil consumption', 'high', 'sae'),
('P246C', NULL, 'Diesel Particulate Filter Restriction – Forced Limited Power', 'emissions', 'DPF critically clogged;Emergency regen needed;Possible DPF replacement', 'critical', 'sae'),
('P20EE', NULL, 'SCR NOx Catalyst Efficiency Below Threshold (Bank 1)', 'emissions', 'Bad AdBlue quality;Faulty NOx sensor;SCR catalyst degraded;AdBlue injector clogged', 'high', 'sae'),
('P2BAD', NULL, 'NOx Exceedance – Loss of Inducement', 'emissions', 'Empty AdBlue tank;Faulty AdBlue system;NOx sensor failure', 'critical', 'sae'),
('P207F', NULL, 'Reductant Quality Performance', 'emissions', 'Diluted/contaminated AdBlue;Wrong fluid used;AdBlue crystallization', 'high', 'sae'),
('P2080', NULL, 'Exhaust Gas Temperature Sensor Circuit Range/Performance (Bank 1 Sensor 1)', 'emissions', 'Faulty EGT sensor;Wiring issue;Soot buildup on sensor', 'medium', 'sae'),
('P203B', NULL, 'Reductant Level Sensor Circuit Range/Performance', 'emissions', 'Faulty AdBlue level sensor;Wiring;Frozen AdBlue', 'medium', 'sae'),
('P203D', NULL, 'Reductant Level Too Low', 'emissions', 'Empty AdBlue tank;Faulty level sensor;AdBlue leak', 'high', 'sae'),
('P204F', NULL, 'Reductant System Performance', 'emissions', 'AdBlue dosing valve stuck;Clogged injector;Pump failure', 'high', 'sae'),
('P20BD', NULL, 'Reductant Heater Control Circuit/Open', 'emissions', 'Faulty AdBlue heater;Wiring;Fuse blown;Frozen lines', 'medium', 'sae'),
('P2200', NULL, 'NOx Sensor Circuit (Bank 1)', 'emissions', 'Faulty NOx sensor;Wiring;ECU communication error', 'medium', 'sae'),
('P2201', NULL, 'NOx Sensor Circuit Range/Performance (Bank 1)', 'emissions', 'NOx sensor drift;Exhaust leak before sensor;SCR issue', 'medium', 'sae'),

-- Sensors
('P0100', NULL, 'Mass or Volume Air Flow Circuit Malfunction', 'engine', 'Faulty MAF sensor;Dirty MAF element;Air leak after MAF;Wiring issue', 'medium', 'sae'),
('P0101', NULL, 'Mass or Volume Air Flow Circuit Range/Performance', 'engine', 'Dirty MAF;Air filter restriction;Intake leak', 'medium', 'sae'),
('P0110', NULL, 'Intake Air Temperature Sensor Circuit', 'engine', 'Faulty IAT sensor;Wiring;Connector corrosion', 'low', 'sae'),
('P0115', NULL, 'Engine Coolant Temperature Sensor Circuit', 'engine', 'Faulty ECT sensor;Wiring;Connector corrosion;Low coolant', 'medium', 'sae'),
('P0116', NULL, 'Engine Coolant Temperature Circuit Range/Performance', 'engine', 'Stuck thermostat;Faulty ECT sensor;Air in cooling system', 'medium', 'sae'),
('P0120', NULL, 'Throttle Position Sensor A Circuit', 'engine', 'Faulty TPS;Throttle body issue;Wiring', 'medium', 'sae'),
('P0130', NULL, 'O2 Sensor Circuit (Bank 1 Sensor 1)', 'emissions', 'Faulty O2 sensor;Exhaust leak;Wiring issue;Contaminated sensor', 'medium', 'sae'),
('P0131', NULL, 'O2 Sensor Circuit Low Voltage (Bank 1 Sensor 1)', 'emissions', 'Vacuum leak;Faulty O2 sensor;Exhaust leak before sensor', 'medium', 'sae'),
('P0135', NULL, 'O2 Sensor Heater Circuit (Bank 1 Sensor 1)', 'emissions', 'Faulty O2 sensor heater;Blown fuse;Wiring issue', 'low', 'sae'),
('P0340', NULL, 'Camshaft Position Sensor A Circuit (Bank 1)', 'engine', 'Faulty cam sensor;Timing chain stretched;Wiring issue;Tone wheel damage', 'high', 'sae'),
('P0335', NULL, 'Crankshaft Position Sensor A Circuit', 'engine', 'Faulty crank sensor;Reluctor ring damage;Wiring;Excessive crank endplay', 'critical', 'sae'),
('P0016', NULL, 'Crankshaft Position – Camshaft Position Correlation (Bank 1 Sensor A)', 'engine', 'Timing chain stretched;VVT solenoid fault;Cam phaser;Oil quality/level', 'high', 'sae'),

-- Cooling
('P0217', NULL, 'Engine Overheating Condition', 'engine', 'Low coolant;Faulty thermostat;Water pump failure;Radiator blocked;Fan malfunction', 'critical', 'sae'),
('P0128', NULL, 'Coolant Thermostat Below Regulating Temperature', 'engine', 'Thermostat stuck open;Faulty ECT sensor;Low coolant', 'low', 'sae'),

-- Transmission
('P0700', NULL, 'Transmission Control System – Malfunction', 'transmission', 'TCM internal fault;Wiring;Low transmission fluid;Solenoid failure', 'high', 'sae'),
('P0715', NULL, 'Input/Turbine Speed Sensor Circuit', 'transmission', 'Faulty speed sensor;Wiring;Contaminated sensor;Low fluid', 'high', 'sae'),
('P0730', NULL, 'Incorrect Gear Ratio', 'transmission', 'Worn clutch packs;Low fluid;Solenoid failure;Valve body issue', 'high', 'sae'),
('P0741', NULL, 'Torque Converter Clutch Circuit Performance/Stuck Off', 'transmission', 'TCC solenoid;Valve body;Low fluid;Worn converter', 'high', 'sae'),

-- Network / Communication
('U0001', NULL, 'High Speed CAN Communication Bus', 'network', 'CAN bus wiring fault;Terminating resistor;ECU failure;Short circuit on CAN lines', 'critical', 'sae'),
('U0100', NULL, 'Lost Communication With ECM/PCM A', 'network', 'ECU power supply;CAN bus fault;ECU failure;Wiring', 'critical', 'sae'),
('U0101', NULL, 'Lost Communication With TCM', 'network', 'TCM power supply;CAN bus fault;TCM failure;Wiring', 'high', 'sae'),
('U0121', NULL, 'Lost Communication With ABS Control Module', 'network', 'ABS module power supply;CAN bus;Module failure', 'high', 'sae'),
('U0140', NULL, 'Lost Communication With Body Control Module', 'network', 'BCM power supply;CAN bus;Module failure', 'medium', 'sae'),

-- ABS / Chassis
('C0035', NULL, 'Left Front Wheel Speed Sensor Circuit', 'chassis', 'Faulty wheel speed sensor;Tone ring damage;Wiring;Bearing play', 'medium', 'sae'),
('C0040', NULL, 'Right Front Wheel Speed Sensor Circuit', 'chassis', 'Faulty wheel speed sensor;Tone ring damage;Wiring;Bearing play', 'medium', 'sae'),
('C0045', NULL, 'Left Rear Wheel Speed Sensor Circuit', 'chassis', 'Faulty wheel speed sensor;Tone ring damage;Wiring;Bearing play', 'medium', 'sae'),
('C0050', NULL, 'Right Rear Wheel Speed Sensor Circuit', 'chassis', 'Faulty wheel speed sensor;Tone ring damage;Wiring;Bearing play', 'medium', 'sae'),

-- Electric / Hybrid
('P0A09', NULL, 'DC/DC Converter Status Circuit Low', 'electrical', 'Faulty DC/DC converter;Wiring;12V battery issue', 'high', 'sae'),
('P0A80', NULL, 'Replace Hybrid Battery Pack', 'electrical', 'Degraded HV battery cells;Cell imbalance;Battery management fault', 'critical', 'sae'),
('P0A94', NULL, 'DC/DC Converter Performance', 'electrical', 'DC/DC converter degradation;HV battery issue;Cooling system fault', 'high', 'sae'),

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED: VAG-specific codes (VW, Škoda, Audi, Seat, Cupra)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Intake manifold / throttle
('P2015', 'VAG', 'Intake Manifold Runner Position Sensor/Switch Circuit Range/Performance – Bank 1', 'engine', 'Faulty intake manifold flap motor (V157);Broken flap linkage;Wiring issue;Carbon buildup on flaps', 'high', 'oem'),
('P2008', 'VAG', 'Intake Manifold Runner Control Circuit/Open – Bank 1', 'engine', 'Intake manifold flap motor V157;Wiring;ECU driver', 'medium', 'oem'),
('P2020', 'VAG', 'Intake Manifold Runner Position Sensor/Switch Circuit – Bank 2', 'engine', 'V157 motor (bank 2);Linkage;Wiring', 'medium', 'oem'),

-- 1.4 TSI / 1.8 TSI / 2.0 TSI specific
('P1250', 'VAG', 'Fuel Level Too Low', 'fuel', 'Low fuel with inclined vehicle;Faulty fuel level sensor;Fuel pump', 'low', 'oem'),
('P1297', 'VAG', 'Connection Between Turbocharger and Throttle Valve Pressure Hose', 'engine', 'Disconnected or cracked boost hose;Intercooler leak;Hose clamp loose', 'high', 'oem'),
('P0299', 'VAG', 'Turbocharger/Supercharger A Underboost Condition', 'engine', 'Boost leak (intercooler hoses);Worn turbo;Stuck wastegate;Faulty N75 valve;Diverter valve torn diaphragm', 'high', 'oem'),
('P1545', 'VAG', 'Throttle Position Control Malfunction', 'engine', 'Faulty throttle body;Dirty throttle plate;Adaptation needed;ECU issue', 'high', 'oem'),
('P1564', 'VAG', 'Throttle Position Control Idle Position Not Reached', 'engine', 'Carbon buildup on throttle plate;Faulty throttle body;Adaptation lost', 'medium', 'oem'),
('P2187', 'VAG', 'System Too Lean at Idle – Bank 1', 'fuel', 'PCV valve failure (common on TSI);Vacuum leak at intake manifold;Faulty fuel injector;Brake booster hose leak', 'high', 'oem'),
('P2188', 'VAG', 'System Too Rich at Idle – Bank 1', 'fuel', 'Leaking fuel injector;Faulty EVAP purge valve N80;Faulty O2 sensor', 'medium', 'oem'),

-- Timing chain (1.2/1.4 TSI notorious issue)
('P0016', 'VAG', 'Crankshaft Pos. – Camshaft Pos. Correlation Bank 1 Sensor A', 'engine', 'Timing chain stretched (1.2/1.4 TSI common failure);Chain tensioner worn;VVT solenoid;Oil level/quality', 'critical', 'oem'),
('P0017', 'VAG', 'Crankshaft Pos. – Camshaft Pos. Correlation Bank 1 Sensor B', 'engine', 'Timing chain stretched;Exhaust camshaft adjuster;Chain tensioner;Oil starvation', 'critical', 'oem'),
('P000A', 'VAG', 'Camshaft Position Slow Response – Bank 1 A', 'engine', 'VVT solenoid N205 stuck;Low oil pressure;Oil channels clogged;Cam phaser wear', 'high', 'oem'),

-- 2.0 TDI (PD / CR) specific
('P0403', 'VAG', 'Exhaust Gas Recirculation Circuit Malfunction', 'emissions', 'EGR valve stuck (very common on 2.0 TDI);Carbon buildup;Cooler leak;Wiring to EGR', 'high', 'oem'),
('P0401', 'VAG', 'Exhaust Gas Recirculation Flow Insufficient Detected', 'emissions', 'Carbon-clogged EGR valve;Blocked intake manifold;EGR cooler failure;Vacuum actuator', 'high', 'oem'),
('P2463', 'VAG', 'Diesel Particulate Filter – Soot Accumulation', 'emissions', 'Short trip driving;Failed forced regeneration;Faulty differential pressure sensor G450;Oil dilution in fuel', 'high', 'oem'),
('P2002', 'VAG', 'Diesel Particulate Filter Efficiency Below Threshold – Bank 1', 'emissions', 'DPF internally damaged;Excessive oil consumption;Wrong oil specification;Sensor G450/G527 fault', 'critical', 'oem'),
('P0671', 'VAG', 'Glow Plug Cylinder 1 Circuit', 'engine', 'Glow plug failed;Glow plug control module J745;Wiring corrosion;Wrong glow plug type', 'medium', 'oem'),
('P0672', 'VAG', 'Glow Plug Cylinder 2 Circuit', 'engine', 'Glow plug failed;Glow plug control module J745;Wiring corrosion', 'medium', 'oem'),
('P0673', 'VAG', 'Glow Plug Cylinder 3 Circuit', 'engine', 'Glow plug failed;Glow plug control module J745;Wiring corrosion', 'medium', 'oem'),
('P0674', 'VAG', 'Glow Plug Cylinder 4 Circuit', 'engine', 'Glow plug failed;Glow plug control module J745;Wiring corrosion', 'medium', 'oem'),
('P2146', 'VAG', 'Fuel Injector Group A Supply Voltage Circuit/Open', 'fuel', 'Injector wiring harness;Fuse;ECU driver module', 'high', 'oem'),

-- DSG / Mechatronic
('P17BF', 'VAG', 'Mechatronic Unit Malfunction – Internal Error', 'transmission', 'Mechatronic unit failure (common DSG7 DQ200);Electro-hydraulic valve body;Software update needed', 'critical', 'oem'),
('P189C', 'VAG', 'Clutch Engagement Limit Reached', 'transmission', 'DSG clutch pack worn;Mechatronic pressure loss;Clutch adaptation limit exceeded', 'critical', 'oem'),
('P0741', 'VAG', 'Torque Converter Clutch Circuit Performance or Stuck Off', 'transmission', 'Torque converter lockup solenoid (AT);Valve body;Low ATF level;Contaminated fluid', 'high', 'oem'),
('P0722', 'VAG', 'Output Speed Sensor No Signal', 'transmission', 'Faulty speed sensor G195;Wiring;Mechatronic connection;Low fluid', 'high', 'oem'),

-- Steering / Chassis
('C0051', 'VAG', 'ABS Wheel Speed Sensor Supply Voltage', 'chassis', 'Sensor power supply;ABS module;Wiring harness damage', 'medium', 'oem'),
('C0020', 'VAG', 'Steering Angle Sensor Malfunction', 'chassis', 'Faulty steering angle sensor G85;Needs calibration after alignment;Clock spring', 'medium', 'oem'),

-- Air conditioning
('B10D2', 'VAG', 'A/C Compressor Control Circuit', 'body', 'AC compressor clutch relay;Compressor seized;Refrigerant pressure sensor;Wiring', 'low', 'oem'),

-- Lighting / Body
('B1000', 'VAG', 'Headlamp Range Adjustment – Right Side', 'body', 'Faulty headlamp leveling motor;Wiring;Headlamp module;Ride height sensor', 'low', 'oem'),

-- Electrical system
('P0562', 'VAG', 'System Voltage Low', 'electrical', 'Weak battery;Alternator failure;Corroded ground point;Parasitic drain', 'medium', 'oem'),
('P0563', 'VAG', 'System Voltage High', 'electrical', 'Faulty voltage regulator;Alternator overcharge;Battery sensor issue', 'medium', 'oem'),
('U0073', 'VAG', 'Control Module Communication Bus A Off', 'network', 'CAN bus termination;Gateway module J533;Water ingress in connector;Module failure', 'critical', 'oem'),
('U0101', 'VAG', 'Lost Communication With TCM', 'network', 'TCM power supply;CAN bus wiring to gearbox;TCM failure (DSG mechatronic);Connector corrosion', 'high', 'oem'),

-- AdBlue / SCR (EA288 / EA189 post-fix)
('P20EE', 'VAG', 'SCR NOx Catalyst Efficiency Below Threshold – Bank 1', 'emissions', 'AdBlue quality (crystallized);SCR catalyst degraded;NOx sensor G295/G296;AdBlue heater;Dosing valve', 'critical', 'oem'),
('P207F', 'VAG', 'Reductant Quality Performance', 'emissions', 'Wrong fluid in AdBlue tank;Diluted AdBlue;AdBlue quality sensor G686;Contamination', 'high', 'oem'),
('P204F', 'VAG', 'Reductant System Performance – Bank 1 Improper Dosing', 'emissions', 'AdBlue dosing unit V387;Clogged injector nozzle;Pump module;Lines blocked/frozen', 'high', 'oem'),
('P203B', 'VAG', 'Reductant Level Sensor Circuit Range/Performance', 'emissions', 'AdBlue level sensor;Sender unit in tank;Wiring;Frozen AdBlue', 'medium', 'oem')

ON CONFLICT (code, COALESCE(brand_group, '__generic__')) DO NOTHING;
