/**
 * GearBrain — Edge Function: analytics
 *
 * Admin endpoint — aggregovaná analytika za posledních 30 dní:
 * - Denní AI volání + tokeny
 * - Denní unikátní uživatelé
 * - Celkové počty (případy, uživatelé, tokeny)
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

  const user = await getAuthUser(req)
  if (!user) return json({ error: 'Unauthorized' }, 401)
  if (!isAdmin(user)) return json({ error: 'Forbidden' }, 403)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const url = new URL(req.url)
  const rawDays = parseInt(url.searchParams.get('days') ?? '30')
  // days=0 means "max" — from project start (2026-03-17)
  const PROJECT_START = '2026-03-17T00:00:00Z'
  const since = rawDays === 0
    ? PROJECT_START
    : new Date(Date.now() - Math.min(rawDays, 365) * 86400000).toISOString()
  const effectiveDays = rawDays === 0
    ? Math.ceil((Date.now() - new Date(PROJECT_START).getTime()) / 86400000)
    : Math.min(rawDays, 365)

  try {
    // Parallel queries
    const [aiUsage, sessions, cases, regUsers, topUsers] = await Promise.all([
      supabase.rpc('analytics_ai_daily', { since_date: since }),
      supabase.rpc('analytics_sessions_daily', { since_date: since }),
      supabase.rpc('analytics_case_stats'),
      supabase.rpc('analytics_registered_users'),
      supabase.rpc('analytics_top_users', { since_date: since, lim: 10 }),
    ])

    return json({
      ai_daily: aiUsage.data ?? [],
      sessions_daily: sessions.data ?? [],
      case_stats: cases.data?.[0] ?? { total: 0, pending: 0, approved: 0, rejected: 0 },
      registered_users: regUsers.data?.[0] ?? { total_users: 0, users_today: 0, users_7d: 0, users_30d: 0 },
      top_users: topUsers.data ?? [],
      days: effectiveDays,
      since: since.slice(0, 10),
    }, 200)

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})
