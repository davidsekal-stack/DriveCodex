/**
 * GearBrain — Edge Function: analytics
 *
 * Admin endpoint — aggregovaná analytika:
 * - Denní AI volání + tokeny
 * - Denní unikátní uživatelé
 * - Celkové počty (případy, uživatelé, tokeny)
 * - Top uživatelé podle spotřeby tokenů
 * - Statistika značek vozidel
 *
 * Admin účty (ANALYTICS_EXCLUDE_EMAILS) se automaticky odfiltrují.
 */

import { optionsResponse } from '../_shared/cors.ts'
import { json } from '../_shared/response.ts'
import { getAuthUser, isAdmin } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/client.ts'

const PROJECT_START = '2026-03-17T00:00:00Z'

// Emaily k vyloučení z analytiky (admin/test účty)
const EXCLUDE_EMAILS = (Deno.env.get('ANALYTICS_EXCLUDE_EMAILS') ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  const user = await getAuthUser(req)
  if (!user) return json({ error: 'Unauthorized' }, 401)
  if (!isAdmin(user)) return json({ error: 'Forbidden' }, 403)

  const supabase = getServiceClient()

  const url = new URL(req.url)
  const rawDays = parseInt(url.searchParams.get('days') ?? '30')
  // days=0 means "max" — from project start (2026-03-17)
  const since = rawDays === 0
    ? PROJECT_START
    : new Date(Date.now() - Math.min(rawDays, 365) * 86400000).toISOString()
  const effectiveDays = rawDays === 0
    ? Math.ceil((Date.now() - new Date(PROJECT_START).getTime()) / 86400000)
    : Math.min(rawDays, 365)

  const ex = EXCLUDE_EMAILS

  try {
    const [aiUsage, sessions, cases, regUsers, topUsers, brands] = await Promise.all([
      supabase.rpc('analytics_ai_daily', { since_date: since, exclude_emails: ex }),
      supabase.rpc('analytics_sessions_daily', { since_date: since, exclude_emails: ex }),
      supabase.rpc('analytics_case_stats'),
      supabase.rpc('analytics_registered_users', { exclude_emails: ex }),
      supabase.rpc('analytics_top_users', { since_date: since, lim: 10, exclude_emails: ex }),
      supabase.rpc('analytics_brand_stats', { since_date: since, exclude_emails: ex }),
    ])

    return json({
      ai_daily: aiUsage.data ?? [],
      sessions_daily: sessions.data ?? [],
      case_stats: cases.data?.[0] ?? { total: 0, pending: 0, approved: 0, rejected: 0 },
      registered_users: regUsers.data?.[0] ?? { total_users: 0, users_today: 0, users_7d: 0, users_30d: 0 },
      top_users: topUsers.data ?? [],
      brand_stats: brands.data ?? [],
      days: effectiveDays,
      since: since.slice(0, 10),
    })

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})
