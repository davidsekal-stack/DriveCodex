/**
 * GearBrain — Edge Function: send-feedback
 *
 * Přijme zpětnou vazbu od uživatele a uloží ji do tabulky gearbrain_feedback.
 * Volitelně přepošle na email přes Resend API (pokud je RESEND_API_KEY nastaven).
 *
 * POST /functions/v1/send-feedback
 * Body: { message: string, userEmail?: string, lang?: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FEEDBACK_EMAIL = 'davidsekal@gmail.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, userEmail, lang } = await req.json()

    if (!message?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Empty feedback' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Store in Supabase DB ────────────────────────────────────────────────
    const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
    const supabaseKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase     = createClient(supabaseUrl, supabaseKey)

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

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('send-feedback error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
