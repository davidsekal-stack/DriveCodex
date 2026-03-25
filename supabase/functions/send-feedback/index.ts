/**
 * GearBrain — Edge Function: send-feedback
 *
 * Přijme zpětnou vazbu od uživatele a uloží ji do tabulky gearbrain_feedback.
 * Volitelně přepošle na email přes Resend API (pokud je RESEND_API_KEY nastaven).
 *
 * POST /functions/v1/send-feedback
 * Body: { message: string, userEmail?: string, lang?: string }
 */

import { optionsResponse } from '../_shared/cors.ts'
import { json } from '../_shared/response.ts'
import { getServiceClient } from '../_shared/client.ts'

// Configurable via env var — fallback for backwards compatibility
const FEEDBACK_EMAIL = Deno.env.get('FEEDBACK_EMAIL') || 'davidsekal@gmail.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const { message, userEmail, lang } = await req.json()

    if (!message?.trim()) {
      return json({ error: 'Empty feedback' }, 400)
    }

    // ── Store in Supabase DB ────────────────────────────────────────────────
    const supabase = getServiceClient()

    await supabase.from('gearbrain_feedback').insert({
      message:    message.trim(),
      user_email: userEmail || null,
      lang:       lang || 'cs',
      created_at: new Date().toISOString(),
    })

    // ── Try email notification via Resend (optional) ─────────────────────────
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (resendKey) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from:    'GearBrain <noreply@resend.dev>',
            to:      [FEEDBACK_EMAIL],
            subject: `GearBrain Feedback${userEmail ? ` od ${userEmail}` : ''}`,
            text:    `Nový feedback:\n\n${message.trim()}\n\n---\nOd: ${userEmail || 'neznámý'}\nJazyk: ${lang || 'cs'}`,
          }),
        })
      } catch (emailErr) {
        console.error('Email notification failed (non-critical):', emailErr)
      }
    }

    return json({ ok: true })
  } catch (err) {
    console.error('send-feedback error:', err)
    return json({ error: err.message }, 500)
  }
})
