/**
 * Shared CORS headers for all DriveCodex edge functions.
 */

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Standard OPTIONS preflight response. */
export function optionsResponse(): Response {
  return new Response('ok', { headers: CORS_HEADERS })
}
