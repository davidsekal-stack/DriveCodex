/**
 * GearBrain — Edge Function: review-cases
 *
 * Admin endpoint pro review workflow:
 * - GET:  Vrátí pending případy s emailem uživatele a časem uzavření
 * - POST: Změní status případu (approved / rejected)
 *
 * Přístup omezen na ADMIN_USER_IDS (env var, čárkami oddělené UUID).
 */

import { optionsResponse } from '../_shared/cors.ts'
import { json } from '../_shared/response.ts'
import { getAuthUser, isAdmin } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/client.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  // ── Auth check ─────────────────────────────────────────────────────────────
  const user = await getAuthUser(req)
  if (!user) return json({ error: 'Unauthorized' }, 401)
  if (!isAdmin(user)) return json({ error: 'Forbidden' }, 403)

  const supabase = getServiceClient()

  try {
    // ── GET: Fetch pending cases ─────────────────────────────────────────────
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const statusFilter = url.searchParams.get('status') ?? 'pending'
      const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 500)

      const { data, error } = await supabase
        .from('gearbrain_cases_review')
        .select('*')
        .eq('status', statusFilter)
        .order('closed_at', { ascending: false })
        .limit(limit)

      if (error) return json({ error: error.message }, 500)

      return json({ cases: data ?? [], count: data?.length ?? 0 })
    }

    // ── POST: Update case status ─────────────────────────────────────────────
    if (req.method === 'POST') {
      const { case_id, status: newStatus, case_ids } = await req.json()

      if (!['approved', 'rejected'].includes(newStatus)) {
        return json({ error: 'Status musí být "approved" nebo "rejected".' }, 400)
      }

      const ids = case_ids ?? (case_id ? [case_id] : [])
      if (ids.length === 0) {
        return json({ error: 'Chybí case_id nebo case_ids.' }, 400)
      }

      const { error, count } = await supabase
        .from('gearbrain_cases')
        .update({ status: newStatus })
        .in('id', ids)

      if (error) return json({ error: error.message }, 500)

      return json({ ok: true, updated: count ?? ids.length })
    }

    return json({ error: 'Method not allowed' }, 405)

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})
