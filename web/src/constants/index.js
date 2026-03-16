// Barrel re-export — zpětná kompatibilita pro všechny importy
export { VEHICLE_CATALOG } from "./catalog.js"
export { SYMPTOM_CATEGORIES } from "./symptoms.js"
export { COMMON_OBD_CODES, ENGINE_OBD_CODES, BRAND_OBD_CODES, getObdCodes, detectEngineTech } from "./obd-codes.js"
export { getBrandEntry, ACTIVE_BRANDS, VEHICLE_MODELS, DEFAULT_BRAND, EMPTY_VEHICLE, getBrandModels, getModelPowers } from "./helpers.js"
