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
    // ── GET: Fetch review cases ──────────────────────────────────────────────
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const statusFilter = url.searchParams.get('status') ?? 'pending'
      const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 500)
      // The pending REVIEW queue shows ONLY the DISPUTABLE cases that intake-triage
      // flagged — clear cases are auto-approved and must never clutter the human queue,
      // and not-yet-triaged pending cases are awaiting auto-sort (hidden until decided).
      // `?all=1` bypasses this to see every pending case (operator escape hatch).
      const onlyDisputable = statusFilter === 'pending' && url.searchParams.get('all') !== '1'

      if (onlyDisputable) {
        // select('*') is deliberate: it returns candidate_confirmation when migration 027
        // has landed and simply omits it before, so the screen degrades gracefully (no
        // candidate shown) instead of erroring on a not-yet-created column.
        const { data: queued, error: qErr } = await supabase
          .from('crawl_review_queue')
          .select('*')
          .is('resolved_at', null)
          .limit(limit)
        if (qErr) return json({ error: qErr.message }, 500)
        const qRows = queued ?? []
        if (qRows.length === 0) return json({ cases: [], count: 0 })
        const byLocalId = new Map(qRows.map((r: { case_local_id: string }) => [r.case_local_id, r]))
        const { data, error } = await supabase
          .from('gearbrain_cases_review')
          .select('*')
          .eq('status', 'pending')
          .in('local_id', qRows.map((r: { case_local_id: string }) => r.case_local_id))
          .order('closed_at', { ascending: false })
          .limit(limit)
        if (error) return json({ error: error.message }, 500)
        const cases = (data ?? []).map((c: { local_id?: string }) => {
          const r = c.local_id ? byLocalId.get(c.local_id) : undefined
          return r ? { ...c, review: { clause: r.clause, ai_note: r.ai_note, evidence: r.evidence_json, thread_url: r.thread_url, candidate_confirmation: r.candidate_confirmation ?? null } } : c
        })
        return json({ cases, count: cases.length })
      }

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
      const { case_id, status: newStatus, case_ids, reason, note } = await req.json()

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

      // Free-text reasoning the owner typed (why they approved/rejected) — the learning
      // signal for triage calibration. Trim + cap; empty → null. Untrusted text, stored
      // as data only (never interpolated as an instruction).
      const humanNote = (typeof note === 'string' && note.trim()) ? note.trim().slice(0, 2000) : null

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
        // (1) GUARANTEED: close the queue row with the decision. Uses only long-standing
        // columns, so it works regardless of whether migration 026 has landed yet.
        await supabase
          .from('crawl_review_queue')
          .update({ resolved_at: new Date().toISOString(), decision: newStatus })
          .in('case_local_id', decidedLocalIds)
          .is('resolved_at', null)

        // (2) BEST-EFFORT: record the reason code + free-text note as a labeled example for
        // learning. Separated so a missing column (026 not yet applied) can never break the
        // decision itself — if it errors, the close above already stuck.
        if (humanNote || reviewReason) {
          const { error: noteErr } = await supabase
            .from('crawl_review_queue')
            .update({ decision_reason: reviewReason, human_note: humanNote })
            .in('case_local_id', decidedLocalIds)
          if (noteErr) console.warn('review-cases: human_note not stored (migration 026 pending?):', noteErr.message)
        }
      }

      return json({ ok: true, updated: count ?? ids.length })
    }

    return json({ error: 'Method not allowed' }, 405)

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})
