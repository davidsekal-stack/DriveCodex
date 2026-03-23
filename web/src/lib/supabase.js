import { createClient } from '@supabase/supabase-js'
import { RUNTIME_CONFIG } from './runtime-config.js'

export const supabase = createClient(RUNTIME_CONFIG.supabaseUrl, RUNTIME_CONFIG.supabaseAnonKey)

// ── Auth helpers ────────────────────────────────────────────────────────────────

/** Registrace emailem + heslem */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

/** Přihlášení emailem + heslem */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

/** Přihlášení přes Google OAuth */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
  return data
}

/** Odhlášení */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/** Aktuální session */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

/** Aktuální user */
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
