/**
 * Shared response helpers for all GearBrain edge functions.
 */

import { CORS_HEADERS } from './cors.ts'

/** JSON response with CORS headers. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

/** HTML response with CORS headers. */
export function html(content: string, status = 200): Response {
  return new Response(content, {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
  })
}
