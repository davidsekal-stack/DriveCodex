/**
 * GearBrain — Edge Function: deepseek-proxy
 *
 * Proxy pro DeepSeek API. Klient posílá diagnostický request,
 * Edge Function přidá API klíč a přepošle na DeepSeek.
 *
 * Rate limiting: max 50 AI volání / den / user_id.
 *
 * POST /functions/v1/deepseek-proxy
 * Body: { model, system, messages, max_tokens, user_id }
 */

import { optionsResponse } from '../_shared/cors.ts'
import { json } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/client.ts'

const ALLOWED_MODELS = [
  'deepseek-chat',
  'deepseek-reasoner',
]

const DAILY_LIMIT     = 50
const MAX_TOKENS_CAP  = 8000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const { model, system, messages, max_tokens, user_id } = await req.json()

    // ── Validace ───────────────────────────────────────────────────────────
    if (!user_id || typeof user_id !== 'string') {
      return json({ error: { message: 'Chybí user_id.' } }, 400)
    }
    if (!ALLOWED_MODELS.includes(model)) {
      return json({ error: { message: `Nepovolený model: ${model}` } }, 400)
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: { message: 'Chybí messages.' } }, 400)
    }

    const safeMaxTokens = Math.min(max_tokens ?? 4000, MAX_TOKENS_CAP)

    // ── Rate limiting ──────────────────────────────────────────────────────
    const supabase = getServiceClient()

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count, error: countErr } = await supabase
      .from('gearbrain_ai_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .gte('created_at', since)

    if (!countErr && (count ?? 0) >= DAILY_LIMIT) {
      return json(
        { error: { message: `Denní limit ${DAILY_LIMIT} AI dotazů překročen. Zkuste to zítra.` } },
        429,
      )
    }

    // ── Forward to DeepSeek ──────────────────────────────────────────────
    const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
    if (!apiKey) {
      return json({ error: { message: 'Server: chybí konfigurace AI služby.' } }, 500)
    }

    const dsMessages = [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages,
    ]

    const dsRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: safeMaxTokens,
        messages: dsMessages,
      }),
    })

    const dsData = await dsRes.json()

    if (dsData.error) {
      return json({ error: { message: dsData.error.message || 'DeepSeek API error' } }, dsRes.status)
    }

    const text = dsData.choices?.[0]?.message?.content ?? ''
    const inputTokens  = dsData.usage?.prompt_tokens     ?? 0
    const outputTokens = dsData.usage?.completion_tokens  ?? 0

    const response = {
      id:           dsData.id ?? '',
      type:         'message',
      role:         'assistant',
      content:      [{ type: 'text', text }],
      model:        dsData.model ?? model,
      stop_reason:  dsData.choices?.[0]?.finish_reason === 'stop' ? 'end_turn' : dsData.choices?.[0]?.finish_reason ?? null,
      usage: {
        input_tokens:  inputTokens,
        output_tokens: outputTokens,
      },
    }

    // ── Log usage (fire-and-forget) ────────────────────────────────────────
    supabase
      .from('gearbrain_ai_usage')
      .insert({
        user_id,
        model,
        input_tokens:  inputTokens,
        output_tokens: outputTokens,
      })
      .then(() => {})

    return json(response)

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: { message: `Proxy chyba: ${msg}` } }, 500)
  }
})
