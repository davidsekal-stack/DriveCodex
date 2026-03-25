import { supabase } from "./supabase.js";
import { ok, err } from "./result.js";
import {
  buildSaveCasePayload,
  mapStoredCases,
} from "./storage-payloads.js";

const TABLE = "gearbrain_web_sessions";

export async function loadCases() {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, data, status, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) return err(error);
  return ok(mapStoredCases(data));
}

async function saveCase(caseData, status = "open") {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("Nepřihlášen");

  const { error } = await supabase
    .from(TABLE)
    .upsert(
      buildSaveCasePayload(user.id, caseData, status, new Date().toISOString()),
      { onConflict: "user_id,local_id" },
    );

  if (error) return err(error);
  return ok();
}

export async function createCase(caseData) {
  return saveCase(caseData, "open");
}

export async function updateCase(caseId, caseData, status = "open") {
  return saveCase(caseData, status);
}

export async function deleteCase(caseId) {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("local_id", caseId);

  if (error) return err(error);
  return ok();
}

export async function getGlobalCaseCount() {
  const { count, error } = await supabase
    .from("gearbrain_cases")
    .select("*", { count: "exact", head: true })
    .eq("status", "approved");

  if (error) return err(error);
  return ok(count ?? 0);
}
