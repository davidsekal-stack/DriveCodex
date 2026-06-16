/**
 * AI module — re-exports from focused sub-modules.
 *
 * - ai-fuel.js      → fuel type detection + prompt rules
 * - ai-json-repair.js → truncated JSON repair
 * - ai-prompts.js   → system prompts + RAG block builder
 */

export { detectFuelType, buildFuelBlock } from "./ai-fuel.js";
export { smartRepair }                    from "./ai-json-repair.js";
export { buildSystemPrompt, buildFollowupSystemPrompt } from "./ai-prompts.js";
export { CASE_TOKEN_LIMIT }               from "../constants/limits.js";

/**
 * Topic relevance check — disabled stub.
 * Kept here so existing imports don't break.
 */
export function checkTopicRelevance(_text, _lang) {
  return { ok: true, reason: null }
}
