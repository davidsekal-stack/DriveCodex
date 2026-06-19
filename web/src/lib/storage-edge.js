import {
  buildAiRequestPayload,
  buildEdgeFunctionHeaders,
  getEdgeFunctionErrorMessage,
  getEdgeFunctionToken,
} from "./edge-functions.js";
import { supabase } from "./supabase.js";
import {
  buildFeedbackPayload,
  buildPushClosedCasePayload,
  buildSearchCasesPayload,
} from "./storage-payloads.js";
import { RUNTIME_CONFIG, PROD_SUPABASE_URL } from "./runtime-config.js";
import {
  makeStorageErrorResult,
  makeStorageSuccessResult,
  normalizeSearchCasesResult,
} from "./storage-result.js";
import { validateResolution } from "./validation.js";

async function edgeFetch(fnName, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = getEdgeFunctionToken(session, RUNTIME_CONFIG.supabaseAnonKey);
  const response = await fetch(`${RUNTIME_CONFIG.edgeFunctionsUrl}/${fnName}`, {
    method: "POST",
    headers: buildEdgeFunctionHeaders(token, RUNTIME_CONFIG.supabaseAnonKey),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(getEdgeFunctionErrorMessage(fnName, response.status, text));
  }

  return response.json();
}

export async function pushClosedCase(kase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return makeStorageErrorResult("Nepřihlášen");

  const validation = validateResolution(kase.resolution);
  if (!validation.ok) return makeStorageErrorResult(validation.reason);
  if (!kase.vehicle?.model) return makeStorageErrorResult("Chybí model vozidla.");

  try {
    const result = await edgeFetch("push-case", buildPushClosedCasePayload(kase, user.id));

    if (result?.error) {
      return makeStorageErrorResult(result.error, "Push case failed");
    }

    return makeStorageSuccessResult();
  } catch (error) {
    return makeStorageErrorResult(error, "Push case failed");
  }
}

import { AI_MAX_TOKENS, AI_MODEL } from "../constants/limits.js";

/**
 * TEST-ONLY AI stub. Returns a canned diagnosis instead of calling DeepSeek so that
 * the end-to-end browser test is deterministic, fast and free.
 *
 * DOUBLE-GATED so it can NEVER fire in production:
 *   1. import.meta.env.DEV — true only in a local `vite dev` build, never in the
 *      production bundle that Vercel ships (`vite build` statically replaces this
 *      with `false`, so the whole function dead-code-eliminates to a constant false).
 *   2. the app is NOT pointed at the production Supabase project (defense-in-depth:
 *      even a dev build with the flag set won't stub against prod data).
 *   3. an explicit opt-in flag — VITE_TEST_MODE=1 at build time, or a
 *      `dc_test_mode` = "1" localStorage key set by the test harness at runtime.
 * All conditions must hold; any one alone leaves the real AI call untouched.
 */
function isTestAiStubEnabled() {
  if (!import.meta.env.DEV) return false;
  if (RUNTIME_CONFIG.supabaseUrl === PROD_SUPABASE_URL) return false;
  if (import.meta.env.VITE_TEST_MODE === "1") return true;
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem("dc_test_mode") === "1";
  } catch {
    return false;
  }
}

function buildTestAiResponse() {
  // Shape mirrors the real deepseek-proxy contract consumed by run-diagnosis.js:
  // data.content[].text (joined) → smartRepair → parsed.závady[].
  const cannedDiagnosis = {
    závady: [
      {
        název: "Zanesený DPF filtr (test)",
        pravděpodobnost: 80,
        zdroj: "AI",
        řešení: ["Provést nucenou regeneraci DPF", "Zkontrolovat tlakové čidlo DPF"],
        popis: "Kanonická testovací odpověď – AI nebyla volána.",
      },
    ],
  };
  return {
    content: [{ text: JSON.stringify(cannedDiagnosis) }],
    usage: { input_tokens: 0, output_tokens: 0 },
  };
}

export async function callAI({ systemPrompt, userMessage, maxTokens = AI_MAX_TOKENS, model = AI_MODEL, thinking = { type: "enabled" } }) {
  if (isTestAiStubEnabled()) return buildTestAiResponse();

  const { data: { user } } = await supabase.auth.getUser();

  return edgeFetch("deepseek-proxy", buildAiRequestPayload({
    model,
    systemPrompt,
    userMessage,
    maxTokens,
    userId: user?.id ?? "web-anonymous",
    thinking,
  }));
}

export async function sendFeedback(message, lang) {
  const { data: { user } } = await supabase.auth.getUser();

  try {
    const result = await edgeFetch("send-feedback", buildFeedbackPayload(message, lang, user?.email));

    if (result?.error) {
      return makeStorageErrorResult(result.error, "Send feedback failed");
    }

    return makeStorageSuccessResult({ data: result ?? null });
  } catch (error) {
    return makeStorageErrorResult(error, "Send feedback failed");
  }
}

export async function fetchReviewCases(status = "pending") {
  const { data: { session } } = await supabase.auth.getSession();
  const token = getEdgeFunctionToken(session, RUNTIME_CONFIG.supabaseAnonKey);
  const res = await fetch(`${RUNTIME_CONFIG.edgeFunctionsUrl}/review-cases?status=${status}&limit=500`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: RUNTIME_CONFIG.supabaseAnonKey,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `review-cases: HTTP ${res.status}`;
    try { const j = JSON.parse(text); msg = j.error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }

  return res.json();
}

export async function updateCaseStatus(caseIdOrIds, status, reason = null) {
  const base = Array.isArray(caseIdOrIds)
    ? { case_ids: caseIdOrIds, status }
    : { case_id: caseIdOrIds, status };
  const payload = reason ? { ...base, reason } : base;
  return edgeFetch("review-cases", payload);
}

export async function createShareLink(activeCase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const vehicle = activeCase.vehicle ?? {};
  const vehicleParts = [vehicle.model, vehicle.enginePower].filter(Boolean);
  const vehicleSummary = vehicleParts.join(" · ") || "Vehicle";

  // Extract fault summary from latest diagnosis
  const diagMsgs = (activeCase.messages ?? []).filter((m) => m.type === "diagnosis");
  const latest = diagMsgs[diagMsgs.length - 1];
  const topFault = latest?.result?.závady?.[0];
  const faultSummary = topFault
    ? `${topFault.název} — ${topFault.pravděpodobnost}%`
    : "";

  const snapshot = {
    name: activeCase.name,
    vehicle: activeCase.vehicle,
    messages: activeCase.messages,
    status: activeCase.status,
    resolution: activeCase.resolution,
    closedAt: activeCase.closedAt,
  };

  try {
    const result = await edgeFetch("share-case", {
      session_id: activeCase.id,
      snapshot,
      vehicle_summary: vehicleSummary,
      fault_summary: faultSummary,
    });
    return result;
  } catch (error) {
    return { error: error.message || "Failed to create share link" };
  }
}

export async function fetchAnalytics(days = 30) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = getEdgeFunctionToken(session, RUNTIME_CONFIG.supabaseAnonKey);
  const res = await fetch(`${RUNTIME_CONFIG.edgeFunctionsUrl}/analytics?days=${days}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: RUNTIME_CONFIG.supabaseAnonKey,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `analytics: HTTP ${res.status}`;
    try { const j = JSON.parse(text); msg = j.error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }

  return res.json();
}

export async function searchCases(ragInput) {
  const { data: { user } } = await supabase.auth.getUser();

  try {
    const result = await edgeFetch("search-cases", buildSearchCasesPayload(ragInput, user?.id));
    return normalizeSearchCasesResult(result);
  } catch (error) {
    return makeStorageErrorResult(error, "Search cases failed", { cases: [], count: 0 });
  }
}

export async function fetchKnownFaults({ brand, model }) {
  try {
    const result = await edgeFetch("known-faults", { brand, model, mode: "stats" });
    return result?.ok ? result : { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function fetchKnownFaultCases({ brand, model, faultId, band, gen }) {
  try {
    const result = await edgeFetch("known-faults", { brand, model, mode: "cases", faultId, band: band ?? null, gen: gen ?? "exact" });
    return { ok: !!result?.ok, cases: result?.cases ?? [] };
  } catch {
    return { ok: false, cases: [] };
  }
}

export async function lookupManual({ brand, model, enginePower, components, faultNames }) {
  try {
    const result = await edgeFetch("manual-lookup", {
      brand,
      model,
      engine_power: enginePower,
      components,
      fault_names: faultNames,
    });
    return { ok: true, results: result.results ?? [], count: result.count ?? 0 };
  } catch (error) {
    return { ok: false, error: error.message || "Manual lookup failed", results: [], count: 0 };
  }
}

export async function fetchManualText({ manual, section, sectionId }) {
  try {
    const body = sectionId
      ? { section_id: sectionId }
      : { manual, section };
    const result = await edgeFetch("manual-text", body);
    if (result?.error) return { ok: false, error: result.error, content: null };
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: error.message || "Manual text fetch failed", content: null };
  }
}
