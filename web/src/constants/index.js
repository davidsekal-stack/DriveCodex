// Barrel re-export — zpětná kompatibilita pro všechny importy
export { VEHICLE_CATALOG } from "./catalog.js"
export { SYMPTOM_CATEGORIES } from "./symptoms.js"
export { COMMON_OBD_CODES, ENGINE_OBD_CODES, BRAND_OBD_CODES, getObdCodes, detectEngineTech } from "./obd-codes.js"
export { ACTIVE_BRAND_DROPDOWN_OPTIONS, ACTIVE_BRAND_SECTIONS, ACTIVE_BRANDS, VEHICLE_MODELS, getBrandEntry, getBrandModels, getModelPowers } from "./catalog-helpers.js"
export { EMPTY_VEHICLE, getDefaultBrand, setDefaultBrand, getStoredDefaultBrand, makeEmptyVehicle, saveIdent, findIdentHistory } from "./local-vehicle-store.js"
