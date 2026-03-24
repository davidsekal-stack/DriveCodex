/**
 * GearBrain — Edge Function: share-case
 *
 * POST: Create a shareable snapshot of a diagnostic case.
 * GET:  Return an HTML page with OG meta tags + redirect to SPA.
 *
 * POST /functions/v1/share-case
 *   Body: { session_id, snapshot, vehicle_summary, fault_summary }
 *   Returns: { ok: true, id, url }
 *
 * GET /functions/v1/share-case?id=abc123
 *   Returns: HTML page with OG tags (for social media crawlers)
 *            + JS redirect to SPA for real browsers
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://gearbrain.vercel.app'
const OG_IMAGE = `${FRONTEND_URL}/og-image.png`

// ── Nanoid-style short ID generator ──────────────────────────────────────────

function generateShareId(length = 9): string {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function html(content: string, status = 200) {
  return new Response(content, {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
}

// ── GET: OG HTML page ────────────────────────────────────────────────────────

async function handleGet(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')

  if (!id) {
    return json({ error: 'Missing id parameter' }, 400)
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('shared_cases')
    .select('vehicle_summary, fault_summary')
    .eq('id', id)
    .single()

  if (error || !data) {
    return html(`<!DOCTYPE html>
<html><head><title>GearBrain — Not Found</title></head>
<body><p>This shared diagnosis was not found or has expired.</p></body></html>`, 404)
  }

  const title = `GearBrain — ${data.vehicle_summary || 'Diagnostika'}`
  const description = data.fault_summary || 'AI-powered vehicle diagnostic report'
  const shareUrl = `${FRONTEND_URL}/share/${id}`

  // OG crawlers (Facebook, Discord, Twitter) parse meta tags from this HTML.
  // Real browsers hitting this endpoint directly get redirected to the SPA.
  return html(`<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta property="og:url" content="${escapeHtml(shareUrl)}" />
  <meta property="og:site_name" content="GearBrain" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${OG_IMAGE}" />
  <script>window.location.replace("${shareUrl}")</script>
</head>
<body style="font-family:monospace;padding:40px;color:#333">
  <p>Redirecting to GearBrain diagnostics...</p>
  <p><a href="${shareUrl}">Click here if not redirected</a></p>
</body>
</html>`)
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ── POST: Create share link ──────────────────────────────────────────────────

async function handlePost(req: Request): Promise<Response> {
  // Verify auth via JWT
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')

  if (!token) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const supabase = getSupabase()

  // Decode JWT to get user_id — use anon key for client, verify token explicitly
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const { data: { user }, error: authError } = await createClient(
    Deno.env.get('SUPABASE_URL')!,
    anonKey,
    {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  ).auth.getUser(token)

  if (authError || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const { session_id, snapshot, vehicle_summary, fault_summary } = await req.json()

  if (!session_id || !snapshot) {
    return json({ error: 'Missing session_id or snapshot' }, 400)
  }

  // Check if a share already exists for this session
  const { data: existing } = await supabase
    .from('shared_cases')
    .select('id')
    .eq('user_id', user.id)
    .eq('session_id', session_id)
    .single()

  if (existing) {
    // Return existing share link
    return json({
      ok: true,
      id: existing.id,
      url: `${FRONTEND_URL}/share/${existing.id}`,
    })
  }

  // Generate new share
  const id = generateShareId()

  const { error } = await supabase
    .from('shared_cases')
    .insert({
      id,
      user_id: user.id,
      session_id: session_id,
      snapshot,
      vehicle_summary: (vehicle_summary ?? '').slice(0, 200),
      fault_summary: (fault_summary ?? '').slice(0, 300),
    })

  if (error) {
    return json({ error: error.message }, 500)
  }

  return json({
    ok: true,
    id,
    url: `${FRONTEND_URL}/share/${id}`,
  })
}

// ── Router ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method === 'GET') return await handleGet(req)
    if (req.method === 'POST') return await handlePost(req)
    return json({ error: 'Method not allowed' }, 405)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})
