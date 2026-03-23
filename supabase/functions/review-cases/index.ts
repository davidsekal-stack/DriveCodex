/**
 * GearBrain — Edge Function: review-cases
 *
 * Admin endpoint pro review workflow:
 * - GET:  Vrátí pending případy s emailem uživatele a časem uzavření
 * - POST: Změní status případu (approved / rejected)
 *
 * Přístup omezen na ADMIN_USER_IDS (env var, čárkami oddělené UUID).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Ověří JWT token a vrátí user objekt. Null = neautorizovaný. */
async function getAuthUser(req: Request) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return null

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

function isAdmin(user: { id: string; email?: string }): boolean {
  const admins = (Deno.env.get('ADMIN_USER_IDS') ?? '').split(',').map(s => s.trim())
  return admins.includes(user.id) || admins.includes(user.email ?? '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // ── Auth check ─────────────────────────────────────────────────────────────
  const user = await getAuthUser(req)
  if (!user) return json({ error: 'Unauthorized' }, 401)
  if (!isAdmin(user)) return json({ error: 'Forbidden' }, 403)

  // Service role pro přístup k view a úpravy
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  try {
    // ── GET: Fetch pending cases ─────────────────────────────────────────────
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const statusFilter = url.searchParams.get('status') ?? 'pending'
      const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)

      const { data, error } = await supabase
        .from('gearbrain_cases_review')
        .select('*')
        .eq('status', statusFilter)
        .order('closed_at', { ascending: false })
        .limit(limit)

      if (error) return json({ error: error.message }, 500)

      return json({ cases: data ?? [], count: data?.length ?? 0 }, 200)
    }

    // ── POST: Update case status ─────────────────────────────────────────────
    if (req.method === 'POST') {
      const { case_id, status: newStatus, case_ids } = await req.json()

      // Validace statusu
      if (!['approved', 'rejected'].includes(newStatus)) {
        return json({ error: 'Status musí být "approved" nebo "rejected".' }, 400)
      }

      // Bulk update (více ID najednou) nebo single
      const ids = case_ids ?? (case_id ? [case_id] : [])
      if (ids.length === 0) {
        return json({ error: 'Chybí case_id nebo case_ids.' }, 400)
      }

      const { error, count } = await supabase
        .from('gearbrain_cases')
        .update({ status: newStatus })
        .in('id', ids)

      if (error) return json({ error: error.message }, 500)

      return json({ ok: true, updated: count ?? ids.length }, 200)
    }

    return json({ error: 'Method not allowed' }, 405)

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})
