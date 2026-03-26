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
import { RUNTIME_CONFIG } from "./runtime-config.js";
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

export async function callAI({ systemPrompt, userMessage, maxTokens = AI_MAX_TOKENS, model = AI_MODEL }) {
  const { data: { user } } = await supabase.auth.getUser();

  return edgeFetch("deepseek-proxy", buildAiRequestPayload({
    model,
    systemPrompt,
    userMessage,
    maxTokens,
    userId: user?.id ?? "web-anonymous",
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
  const res = await fetch(`${RUNTIME_CONFIG.edgeFunctionsUrl}/review-cases?status=${status}&limit=50`, {
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

export async function updateCaseStatus(caseIdOrIds, status) {
  const payload = Array.isArray(caseIdOrIds)
    ? { case_ids: caseIdOrIds, status }
    : { case_id: caseIdOrIds, status };
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
