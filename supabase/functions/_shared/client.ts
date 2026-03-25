/**
 * Shared Supabase client factory for edge functions.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Service-role client — full DB access, no RLS. Use only in trusted server code. */
export function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
}
