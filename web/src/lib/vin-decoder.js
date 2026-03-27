/**
 * VIN decoder — uses the free NHTSA vPIC API (no key required, CORS enabled).
 * Decodes a 17-character VIN into brand, model, year, engine, fuel type etc.
 *
 * API docs: https://vpic.nhtsa.dot.gov/api/
 */

const NHTSA_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues";

// Map NHTSA Make names → our catalog brand names
const MAKE_MAP = {
  "VOLKSWAGEN": "Volkswagen",
  "ŠKODA": "Škoda", "SKODA": "Škoda",
  "AUDI": "Audi",
  "SEAT": "SEAT",
  "CUPRA": "Cupra",
  "BMW": "BMW",
  "MINI": "MINI",
  "MERCEDES-BENZ": "Mercedes-Benz", "MERCEDES BENZ": "Mercedes-Benz",
  "FORD": "Ford",
  "TOYOTA": "Toyota",
  "LEXUS": "Lexus",
  "RENAULT": "Renault",
  "DACIA": "Dacia",
  "PEUGEOT": "Peugeot",
  "CITROËN": "Citroën", "CITROEN": "Citroën",
  "OPEL": "Opel",
  "FIAT": "Fiat",
  "ALFA ROMEO": "Alfa Romeo",
  "NISSAN": "Nissan",
  "INFINITI": "Infiniti",
  "HYUNDAI": "Hyundai",
  "KIA": "Kia",
  "GENESIS": "Genesis",
  "HONDA": "Honda",
  "ACURA": "Acura",
  "SUBARU": "Subaru",
  "MAZDA": "Mazda",
  "SUZUKI": "Suzuki",
  "VOLVO": "Volvo",
  "TESLA": "Tesla",
  "CHEVROLET": "Chevrolet",
  "GMC": "GMC",
  "CADILLAC": "Cadillac",
  "BUICK": "Buick",
  "DODGE": "Dodge",
  "CHRYSLER": "Chrysler",
  "JEEP": "Jeep",
  "RAM": "Ram",
  "LINCOLN": "Lincoln",
  "SMART": "Smart",
  "LANCIA": "Lancia",
};

/**
 * Validate VIN format (basic check).
 */
export function isValidVin(vin) {
  if (!vin || typeof vin !== "string") return false;
  const clean = vin.trim().toUpperCase();
  // 17 alphanumeric chars, no I/O/Q (per ISO 3779)
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(clean);
}

/**
 * Decode a VIN via the NHTSA API.
 *
 * @param {string} vin — 17-character VIN
 * @returns {Promise<{ok: boolean, brand?, model?, year?, engine?, fuelType?, error?}>}
 */
export async function decodeVin(vin) {
  const clean = vin.trim().toUpperCase();
  if (!isValidVin(clean)) {
    return { ok: false, error: "invalid_vin" };
  }

  try {
    const res = await fetch(`${NHTSA_URL}/${clean}?format=json`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, error: "api_error" };

    const json = await res.json();
    const results = json.Results?.[0];
    if (!results) return { ok: false, error: "no_results" };

    // Check for decode errors
    const errorCode = results.ErrorCode;
    if (errorCode && errorCode !== "0" && !errorCode.includes("0")) {
      // ErrorCode can be "1,6,11" etc — only "0" means no error
      // But partial results are still useful, so only bail on major errors
      if (!results.Make) return { ok: false, error: "decode_failed" };
    }

    const makeUpper = (results.Make || "").toUpperCase().trim();
    const brand = MAKE_MAP[makeUpper] || titleCase(results.Make || "");

    const model = results.Model || "";
    const year = results.ModelYear || "";
    const displacementL = results.DisplacementL ? parseFloat(results.DisplacementL).toFixed(1) : "";
    const cylinders = results.EngineCylinders || "";
    const hp = results.EngineHP || "";
    const kw = hp ? Math.round(parseFloat(hp) * 0.7457) : "";
    const fuelType = results.FuelTypePrimary || "";
    const engineModel = results.EngineModel || "";
    const driveType = results.DriveType || "";
    const transmission = results.TransmissionStyle || "";
    const bodyClass = results.BodyClass || "";
    const doors = results.Doors || "";
    const trim = results.Trim || results.Series || "";

    // Build engine description string similar to our catalog format
    // e.g. "92 kW – 1.0 EcoBoost" or "110 kW – 2.0 TDI"
    let engineDesc = "";
    if (kw && displacementL) {
      engineDesc = `${kw} kW – ${displacementL}L`;
      if (engineModel) engineDesc += ` ${engineModel}`;
      if (fuelType && fuelType.toLowerCase().includes("diesel")) engineDesc += " Diesel";
    } else if (kw) {
      engineDesc = `${kw} kW`;
      if (engineModel) engineDesc += ` – ${engineModel}`;
    } else if (displacementL) {
      engineDesc = `${displacementL}L`;
      if (engineModel) engineDesc += ` ${engineModel}`;
    }

    return {
      ok: true,
      brand,
      model,
      year,
      engineDesc,
      fuelType,
      displacementL,
      kw,
      cylinders,
      engineModel,
      driveType,
      transmission,
      bodyClass,
      doors,
      trim,
    };
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return { ok: false, error: "timeout" };
    }
    return { ok: false, error: "network_error" };
  }
}

function titleCase(str) {
  return str.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.substr(1).toLowerCase());
}
