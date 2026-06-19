/**
 * prompt-sanitize.mjs — make untrusted forum-extracted case fields safe to interpolate
 * into an LLM prompt. Collapses whitespace (strips injected newlines, so a crafted forum
 * post can't start its own instruction line inside a field) and caps length. Shared by
 * EVERY site that puts case fields into a prompt — the live verify gate (verify.mjs) and
 * both daily audits (recall-watchdog.mjs, precision-auditor.mjs) — so the defense stays
 * consistent across all of them.
 *
 * Near-no-op for legitimate data (single-line short text); only crafted/oversized input
 * is altered, which is the point.
 */
import { normalizeImportText } from './supabase-utils.mjs';

export const PROMPT_FIELD_MAX = 2000;

/** Whitespace-collapse + length-cap a single untrusted field. */
export function promptField(v, max = PROMPT_FIELD_MAX) {
  return normalizeImportText(v || '').slice(0, max);
}

/** Sanitize + join a list field (symptoms, OBD codes, post numbers); each item capped short. */
export function promptList(arr, itemMax = 100, fallback = 'none') {
  return (arr || []).map(s => normalizeImportText(s).slice(0, itemMax)).filter(Boolean).join(', ') || fallback;
}
