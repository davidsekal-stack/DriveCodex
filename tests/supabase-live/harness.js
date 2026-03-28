const assert = require('assert')

function createHarness() {
  const config = loadConfig()
  const state = {
    accessToken: null,
    userId: null,
    passed: 0,
    failed: 0,
    skipped: 0,
    runId: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    cleanup: {
      webSessions: new Set(),
      cases: new Set(),
      feedbackPrefixes: new Set(),
    },
  }

  function section(title) {
    console.log(`\n══ ${title} ═════════════════════════════════════════════`)
  }

  async function test(name, fn) {
    try {
      await fn()
      console.log(`  ✓ ${name}`)
      state.passed++
    } catch (error) {
      console.error(`  ✗ ${name}\n    ${error.message}`)
      state.failed++
    }
  }

  function skip(name, reason) {
    console.log(`  ⊘ ${name} (${reason})`)
    state.skipped++
  }

  function headers(token = state.accessToken, extra = {}) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || config.anonKey}`,
      'apikey': config.anonKey,
      ...extra,
    }
  }

  async function login(email, password) {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.anonKey,
      },
      body: JSON.stringify({ email, password }),
    })

    const data = await response.json().catch(() => ({}))
    assert.strictEqual(response.status, 200, `Auth failed: HTTP ${response.status}`)
    assert.ok(data.access_token, 'Chybí access_token')
    assert.ok(data.user?.id, 'Chybí user.id')

    return {
      accessToken: data.access_token,
      userId: data.user.id,
    }
  }

  async function authenticatePrimary() {
    const auth = await login(config.email, config.password)
    state.accessToken = auth.accessToken
    state.userId = auth.userId
    return auth
  }

  async function authenticateSecondary() {
    if (!config.secondUserEmail || !config.secondUserPassword) return null
    return login(config.secondUserEmail, config.secondUserPassword)
  }

  async function rest(table, method, params = {}) {
    let url = `${config.restUrl}/${table}`
    if (params.query) url += `?${params.query}`
    const extraHeaders = {}
    if (params.preferRepresentation !== false) {
      extraHeaders.Prefer = 'return=representation'
    }

    const response = await fetch(url, {
      method,
      headers: headers(params.token, extraHeaders),
      body: params.body ? JSON.stringify(params.body) : undefined,
    })

    const text = await response.text()
    try {
      return { status: response.status, data: JSON.parse(text), headers: response.headers }
    } catch {
      return { status: response.status, data: text, headers: response.headers }
    }
  }

  async function headCount(table, query = '', token = state.accessToken) {
    let url = `${config.restUrl}/${table}`
    if (query) url += `?${query}`

    const response = await fetch(url, {
      method: 'HEAD',
      headers: headers(token, {
        Prefer: 'count=exact',
      }),
    })

    const contentRange = response.headers.get('content-range') || ''
    const countMatch = contentRange.match(/\/(\d+)$/)

    return {
      status: response.status,
      count: countMatch ? Number(countMatch[1]) : null,
    }
  }

  async function edge(fnName, body, token = state.accessToken) {
    const response = await fetch(`${config.functionsUrl}/${fnName}`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(body),
    })

    const text = await response.text()
    try {
      return { status: response.status, data: JSON.parse(text) }
    } catch {
      return { status: response.status, data: text }
    }
  }

  function trackWebSession(localId) {
    if (localId) state.cleanup.webSessions.add(localId)
  }

  function trackCase(localId) {
    if (localId) state.cleanup.cases.add(localId)
  }

  function trackFeedbackPrefix(prefix) {
    if (prefix) state.cleanup.feedbackPrefixes.add(prefix)
  }

  function createId(suffix) {
    return `${state.runId}-${suffix}`
  }

  async function runCleanup() {
    section('6. CLEANUP')
    let cleanupErrors = 0

    for (const localId of state.cleanup.webSessions) {
      try {
        const result = await rest('gearbrain_web_sessions', 'DELETE', {
          query: `local_id=eq.${localId}`,
        })
        if (result.status >= 200 && result.status < 300) {
          console.log(`  ✓ web_sessions: smazán ${localId}`)
        } else {
          console.warn(`  ⚠ web_sessions DELETE ${localId}: ${result.status}`)
          cleanupErrors++
        }
      } catch (error) {
        console.warn(`  ⚠ web_sessions DELETE ${localId}: ${error.message}`)
        cleanupErrors++
      }
    }

    for (const localId of state.cleanup.webSessions) {
      try {
        const result = await rest('gearbrain_web_sessions', 'GET', {
          query: `select=id&local_id=eq.${localId}`,
        })
        if (result.status === 200 && Array.isArray(result.data) && result.data.length === 0) {
          console.log(`  ✓ web_sessions: ověřeno smazání ${localId}`)
        } else {
          console.warn(`  ⚠ web_sessions: ${localId} stále existuje`)
          cleanupErrors++
        }
      } catch (error) {
        console.warn(`  ⚠ web_sessions verify ${localId}: ${error.message}`)
        cleanupErrors++
      }
    }

    for (const localId of state.cleanup.cases) {
      try {
        const result = await rest('gearbrain_cases', 'DELETE', {
          query: `local_id=eq.${localId}&user_id=eq.${state.userId}`,
        })
        if (result.status >= 200 && result.status < 300) {
          console.log(`  ✓ gearbrain_cases: smazán ${localId}`)
        } else {
          console.warn(`  ⚠ gearbrain_cases DELETE ${localId}: ${result.status}`)
          cleanupErrors++
        }
      } catch (error) {
        console.warn(`  ⚠ gearbrain_cases DELETE ${localId}: ${error.message}`)
        cleanupErrors++
      }
    }

    for (const prefix of state.cleanup.feedbackPrefixes) {
      try {
        const result = await rest('gearbrain_feedback', 'DELETE', {
          query: `message=like.${encodeURIComponent(`${prefix}%`)}`,
        })
        if (result.status >= 200 && result.status < 300) {
          console.log(`  ✓ gearbrain_feedback: smazány zprávy s prefixem ${prefix}`)
        } else {
          console.warn(`  ⚠ gearbrain_feedback DELETE ${prefix}: ${result.status}`)
          cleanupErrors++
        }
      } catch (error) {
        console.warn(`  ⚠ gearbrain_feedback DELETE ${prefix}: ${error.message}`)
        cleanupErrors++
      }
    }

    if (cleanupErrors > 0) {
      console.warn(`  ⚠ ${cleanupErrors} cleanup operací selhalo`)
    } else {
      console.log('  ✓ Veškerá testovací data byla smazána')
    }
  }

  function printSummary() {
    console.log('\n════════════════════════════════════════════════════════════════')
    console.log(`  Celkem: ${state.passed + state.failed + state.skipped}  ✓ ${state.passed}  ✗ ${state.failed}  ⊘ ${state.skipped}`)
  }

  return {
    assert,
    config,
    state,
    authenticatePrimary,
    authenticateSecondary,
    createId,
    edge,
    headCount,
    headers,
    printSummary,
    rest,
    runCleanup,
    section,
    skip,
    test,
    trackCase,
    trackFeedbackPrefix,
    trackWebSession,
  }
}

function loadConfig() {
  const supabaseUrl = requiredEnv('TEST_SUPABASE_URL')
  const anonKey = requiredEnv('TEST_SUPABASE_ANON_KEY')
  const email = requiredEnv('TEST_USER_EMAIL')
  const password = requiredEnv('TEST_USER_PASSWORD')

  return {
    supabaseUrl,
    anonKey,
    email,
    password,
    secondUserEmail: process.env.TEST_SECOND_USER_EMAIL || '',
    secondUserPassword: process.env.TEST_SECOND_USER_PASSWORD || '',
    functionsUrl: (process.env.TEST_SUPABASE_FUNCTIONS_URL || `${supabaseUrl}/functions/v1`).replace(/\/+$/, ''),
    restUrl: `${supabaseUrl}/rest/v1`,
  }
}

function requiredEnv(name) {
  const value = (process.env[name] || '').trim()
  if (!value) {
    throw new Error(`Missing required env ${name}.`)
  }
  return value
}

module.exports = {
  createHarness,
}
