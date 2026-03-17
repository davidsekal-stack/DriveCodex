/**
 * Web storage layer — CRUD pro případy přes Supabase
 *
 * Tabulka: gearbrain_web_sessions
 *   - id (UUID, PK)
 *   - user_id (UUID, FK → auth.users)
 *   - data (JSONB — celý case objekt)
 *   - status ('open' | 'closed')
 *   - created_at, updated_at
 *
 * Při uzavření případu se navíc pushne normalizovaný záznam do gearbrain_cases
 * (pro RAG).
 */

import { supabase } from './supabase.js'
import { validateResolution } from './validation.js'

const TABLE = 'gearbrain_web_sessions'

// ── Load all cases for current user ────────────────────────────────────────────

export async function loadCases() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, data, status, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(row => ({
    ...row.data,
    _rowId: row.id,
    _status: row.status,
  }))
}

// ── Save a case (upsert by user_id + local_id) ────────────────────────────────
// Used for both create and update. Reliable: never loses data even if
// createCase failed on first save (e.g. due to auth error).

async function saveCase(caseData, status = 'open') {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nepřihlášen')

  const { error } = await supabase
    .from(TABLE)
    .upsert({
      user_id:  user.id,
      local_id: caseData.id,
      data:     caseData,
      status,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,local_id' })

  if (error) throw error
}

export async function createCase(caseData) {
  return saveCase(caseData, 'open')
}

export async function updateCase(caseId, caseData, status = 'open') {
  return saveCase(caseData, status)
}

// ── Delete a case ──────────────────────────────────────────────────────────────

export async function deleteCase(caseId) {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('local_id', caseId)

  if (error) throw error
}

// ── Push closed case to RAG database ───────────────────────────────────────────

export async function pushClosedCase(kase) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Nepřihlášen' }

  // Validate before push
  const resVal = validateResolution(kase.resolution)
  if (!resVal.ok) return { ok: false, error: resVal.reason }
  if (!kase.vehicle?.model) return { ok: false, error: 'Chybí model vozidla.' }

  const inputs = (kase.messages ?? []).filter(m => m.type === 'input')
  const symptoms  = [...new Set(inputs.flatMap(m => m.symptoms ?? []))]
  const obdCodes  = [...new Set(inputs.flatMap(m => m.obdCodes ?? []))]
  const texts     = inputs.map(m => m.text).filter(Boolean)

  const mileage = parseInt(kase.vehicle?.mileage, 10)

  // Call push-case Edge Function — handles translation to English + DB insert
  const result = await edgeFetch('push-case', {
    local_id:        kase.id,
    user_id:         user.id,
    installation_id: user.id,  // web uses user_id as installation_id
    vehicle_brand:   kase.vehicle?.brand || null,
    vehicle_model:   kase.vehicle?.model || null,
    mileage:         Number.isFinite(mileage) ? mileage : null,
    engine_power:    kase.vehicle?.enginePower || null,
    symptoms,
    obd_codes:       obdCodes,
    description:     texts.join(' ') || null,
    resolution:      kase.resolution,
    closed_at:       kase.closedAt || new Date().toISOString(),
  })

  if (result.error) return { ok: false, error: result.error }
  return { ok: true }
}

// ── Supabase Edge Function URL + auth headers ────────────────────────────────

const FUNCTIONS_URL = 'https://nmvjthfezyjcwuzphiuu.supabase.co/functions/v1'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tdmp0aGZlenlqY3d1enBoaXV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MzcwNTAsImV4cCI6MjA4ODMxMzA1MH0.acMPCJe2asOToPXg6DQccejtLOUbD8EMx9Z9FqWo_xo'

async function edgeFetch(fnName, body) {
  const { data: { session } } = await supabase.auth.getSession()
  // Use user JWT if available, otherwise fall back to anon key
  // (anon key is a valid JWT that Supabase Gateway always accepts)
  const token = session?.access_token || ANON_KEY
  const res = await fetch(`${FUNCTIONS_URL}/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    let msg = `Edge Function ${fnName}: HTTP ${res.status}`
    try {
      const j = JSON.parse(text)
      msg = j.error?.message || j.msg || j.message || msg
    } catch {
      if (text) msg += ` — ${text.slice(0, 200)}`
    }
    throw new Error(msg)
  }
  return res.json()
}

// ── Call AI via Edge Function ─────────────────────────────────────────────────

export async function callAI({ systemPrompt, userMessage, maxTokens = 4000, model = 'deepseek-reasoner' }) {
  const { data: { user } } = await supabase.auth.getUser()

  return edgeFetch('anthropic-proxy', {
    model,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    max_tokens: maxTokens,
    installation_id: user?.id ?? 'web-anonymous',
  })
}

// ── Search cases via Edge Function ─────────────────────────────────────────────

export async function searchCases(ragInput) {
  const { data: { user } } = await supabase.auth.getUser()

  try {
    return await edgeFetch('search-cases', {
      vehicle:        ragInput.vehicle,
      symptoms:       ragInput.symptoms,
      obdCodes:       ragInput.obdCodes,
      text:           ragInput.text,
      installationId: user?.id ?? 'web-anonymous',
    })
  } catch {
    return { cases: [], count: 0 }
  }
}
