// Barrel re-export — zpětná kompatibilita pro všechny importy
export { VEHICLE_CATALOG } from "./catalog.js"
export { SYMPTOM_CATEGORIES } from "./symptoms.js"
export { COMMON_OBD_CODES, ENGINE_OBD_CODES, BRAND_OBD_CODES, getObdCodes, detectEngineTech } from "./obd-codes.js"
export { getBrandEntry, ACTIVE_BRANDS, VEHICLE_MODELS, EMPTY_VEHICLE, getBrandModels, getModelPowers, getDefaultBrand, setDefaultBrand, getStoredDefaultBrand, makeEmptyVehicle } from "./helpers.js"
