/**
 * Shared auth helpers for admin-only edge functions.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Extract and verify user from JWT token in Authorization header. */
export async function getAuthUser(req: Request) {
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

/** Check if user is in ADMIN_USER_IDS env var (supports UUID or email). */
export function isAdmin(user: { id: string; email?: string }): boolean {
  const admins = (Deno.env.get('ADMIN_USER_IDS') ?? '').split(',').map(s => s.trim())
  return admins.includes(user.id) || admins.includes(user.email ?? '')
}
