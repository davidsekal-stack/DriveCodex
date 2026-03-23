const DEFAULT_SUPABASE_URL = "https://nmvjthfezyjcwuzphiuu.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tdmp0aGZlenlqY3d1enBoaXV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MzcwNTAsImV4cCI6MjA4ODMxMzA1MH0.acMPCJe2asOToPXg6DQccejtLOUbD8EMx9Z9FqWo_xo";

const VITE_ENV = typeof import.meta !== "undefined" && import.meta.env
  ? import.meta.env
  : {};

function getEnvString(name) {
  const value = VITE_ENV[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function buildSupabaseFunctionsUrl(supabaseUrl, explicitFunctionsUrl) {
  if (typeof explicitFunctionsUrl === "string" && explicitFunctionsUrl.trim()) {
    return explicitFunctionsUrl.trim().replace(/\/+$/, "");
  }

  const normalizedBaseUrl = typeof supabaseUrl === "string"
    ? supabaseUrl.trim().replace(/\/+$/, "")
    : "";

  return normalizedBaseUrl ? `${normalizedBaseUrl}/functions/v1` : "";
}

const supabaseUrl = getEnvString("VITE_SUPABASE_URL") ?? DEFAULT_SUPABASE_URL;
const supabaseAnonKey = getEnvString("VITE_SUPABASE_ANON_KEY") ?? DEFAULT_SUPABASE_ANON_KEY;

export const RUNTIME_CONFIG = {
  supabaseUrl,
  supabaseAnonKey,
  edgeFunctionsUrl: buildSupabaseFunctionsUrl(supabaseUrl, getEnvString("VITE_SUPABASE_FUNCTIONS_URL")),
};
