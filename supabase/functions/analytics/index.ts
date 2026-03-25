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
  const days = Math.min(parseInt(url.searchParams.get('days') ?? '30'), 90)
  const since = new Date(Date.now() - days * 86400000).toISOString()

  try {
    // Parallel queries
    const [aiUsage, sessions, cases] = await Promise.all([
      // AI usage per day
      supabase.rpc('analytics_ai_daily', { since_date: since }),
      // Active sessions per day
      supabase.rpc('analytics_sessions_daily', { since_date: since }),
      // Case stats
      supabase.rpc('analytics_case_stats'),
    ])

    return json({
      ai_daily: aiUsage.data ?? [],
      sessions_daily: sessions.data ?? [],
      case_stats: cases.data?.[0] ?? { total: 0, pending: 0, approved: 0, rejected: 0 },
      days,
    }, 200)

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})
