/**
 * Unified Result pattern for error handling.
 * All async operations should return Result objects instead of throwing.
 *
 * Usage:
 *   import { ok, err, isOk } from "./result.js"
 *   return ok(data)          // { ok: true, data }
 *   return err("message")    // { ok: false, error: "message" }
 *   if (isOk(result)) { ... }
 */

export const ok = (data = null) => ({ ok: true, data })
export const err = (error) => ({ ok: false, error: typeof error === "string" ? error : error?.message ?? "Unknown error" })
export const isOk = (result) => result?.ok === true
