/**
 * DriveCodex — Edge Function: review-cases
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

      const cases = data ?? []
      // Attach the intake-triage marker (why the case is disputable + real forum quotes),
      // so the review screen can show the owner only the disputable cases with evidence.
      const localIds = cases.map((c: { local_id?: string }) => c.local_id).filter(Boolean)
      if (localIds.length > 0) {
        const { data: queued } = await supabase
          .from('crawl_review_queue')
          .select('case_local_id, clause, ai_note, evidence_json, thread_url')
          .in('case_local_id', localIds)
          .is('resolved_at', null)
        const byLocalId = new Map((queued ?? []).map((r: { case_local_id: string }) => [r.case_local_id, r]))
        for (const c of cases as Array<{ local_id?: string; review?: unknown }>) {
          const r = c.local_id ? byLocalId.get(c.local_id) : undefined
          if (r) c.review = { clause: r.clause, ai_note: r.ai_note, evidence: r.evidence_json, thread_url: r.thread_url }
        }
      }

      return json({ cases, count: cases.length })
    }

    // ── POST: Update case status ─────────────────────────────────────────────
    if (req.method === 'POST') {
      const { case_id, status: newStatus, case_ids, reason } = await req.json()

      if (!['approved', 'rejected'].includes(newStatus)) {
        return json({ error: 'Status musí být "approved" nebo "rejected".' }, 400)
      }

      const ids = case_ids ?? (case_id ? [case_id] : [])
      if (ids.length === 0) {
        return json({ error: 'Chybí case_id nebo case_ids.' }, 400)
      }

      // Rejection reason → human-verified label for the Phase-4 gold-set. Reason codes
      // map 1:1 to the verifier's 6 conditions (see migration 024). Approvals carry no
      // reason. reviewed_at marks a genuine human decision (vs migration-grandfathered).
      const REASON_CODES = ['not_car', 'vehicle_mismatch', 'not_a_fault', 'no_repair', 'unconfirmed', 'vague', 'other']
      const reviewReason = newStatus === 'rejected' && REASON_CODES.includes(reason) ? reason : null

      const { error, count } = await supabase
        .from('gearbrain_cases')
        .update({ status: newStatus, review_reason: reviewReason, reviewed_at: new Date().toISOString() })
        .in('id', ids)

      if (error) return json({ error: error.message }, 500)

      // Resolve the intake-triage queue rows for these cases (best-effort; the decision
      // is keyed by case local_id). The owner's call closes the disputable item.
      const { data: decided } = await supabase.from('gearbrain_cases').select('local_id').in('id', ids)
      const decidedLocalIds = (decided ?? []).map((r: { local_id?: string }) => r.local_id).filter(Boolean)
      if (decidedLocalIds.length > 0) {
        await supabase
          .from('crawl_review_queue')
          .update({ resolved_at: new Date().toISOString(), decision: newStatus })
          .in('case_local_id', decidedLocalIds)
          .is('resolved_at', null)
      }

      return json({ ok: true, updated: count ?? ids.length })
    }

    return json({ error: 'Method not allowed' }, 405)

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})
