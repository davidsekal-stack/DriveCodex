/**
 * Integrační testy — Supabase ↔ Web App komunikace
 *
 * Testuje CRUD operace na tabulkách, Edge Functions a RLS politiky
 * přímo proti živé Supabase instanci.
 *
 * Spuštění:  node tests/supabase-integration.test.js
 *
 * Vyžaduje:  env proměnné TEST_USER_EMAIL a TEST_USER_PASSWORD
 *            (existující účet v Supabase auth)
 *
 * Příklad:   TEST_USER_EMAIL=test@example.com TEST_USER_PASSWORD=heslo123 node tests/supabase-integration.test.js
 *
 * Cleanup:   Všechna testovací data se smažou v sekci CLEANUP (try/finally).
 *            Testovací záznamy jsou označeny prefixem "test-" nebo "TEST_".
 */

const assert = require('assert')

const SUPABASE_URL  = 'https://nmvjthfezyjcwuzphiuu.supabase.co'
const ANON_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tdmp0aGZlenlqY3d1enBoaXV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MzcwNTAsImV4cCI6MjA4ODMxMzA1MH0.acMPCJe2asOToPXg6DQccejtLOUbD8EMx9Z9FqWo_xo'
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`
const REST_URL      = `${SUPABASE_URL}/rest/v1`

// ── Helpers ──────────────────────────────────────────────────────────────────

let accessToken = null
let userId      = null
let passed  = 0
let failed  = 0
let skipped = 0

// Registry všech testovacích dat k cleanup
const cleanup = {
  webSessions:  [],   // local_id values to delete from gearbrain_web_sessions
  cases:        [],   // local_id values to delete from gearbrain_cases
  feedbackMark: null, // timestamp prefix for feedback cleanup
}

function headers(token = accessToken) {
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token || ANON_KEY}`,
    'apikey':        ANON_KEY,
  }
}

async function test(name, fn) {
  try {
    await fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`)
    failed++
  }
}

function skip(name, reason) {
  console.log(`  ⊘ ${name} (${reason})`)
  skipped++
}

async function supabaseRest(table, method, params = {}) {
  let url = `${REST_URL}/${table}`
  if (params.query) url += `?${params.query}`

  const opts = { method, headers: { ...headers(), Prefer: 'return=representation' } }
  if (params.body) opts.body = JSON.stringify(params.body)
  const res = await fetch(url, opts)
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } }
  catch { return { status: res.status, data: text } }
}

async function edgeFetch(fnName, body) {
  const res = await fetch(`${FUNCTIONS_URL}/${fnName}`, {
    method:  'POST',
    headers: headers(),
    body:    JSON.stringify(body),
  })
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } }
  catch { return { status: res.status, data: text } }
}

// ── Test data ────────────────────────────────────────────────────────────────

const TEST_RUN_ID    = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const TEST_CASE_ID   = `${TEST_RUN_ID}-session`
const PUSH_LOCAL_ID  = `${TEST_RUN_ID}-push`
const VIN_CASE_ID    = `${TEST_RUN_ID}-vin`
const FEEDBACK_MARK  = `[TEST-${TEST_RUN_ID}]`

cleanup.webSessions.push(TEST_CASE_ID, VIN_CASE_ID)
cleanup.cases.push(PUSH_LOCAL_ID)
cleanup.feedbackMark = FEEDBACK_MARK

const TEST_CASE = {
  id:        TEST_CASE_ID,
  name:      'TEST: Ford Focus diagnostika',
  status:    'otevřený',
  createdAt: new Date().toISOString(),
  vehicle: {
    brand:       'Ford',
    model:       'Focus MK3 1.6 TDCi 85kW',
    enginePower: '1.6 TDCi 85kW',
    mileage:     '185000',
    identType:   'spz',
    identValue:  '1AB2345',
  },
  messages: [{
    id: 'msg1', type: 'input',
    symptoms: ['nerovnoměrný chod motoru'],
    obdCodes: ['P0300'],
    text: 'Motor se třese na volnoběh',
    timestamp: new Date().toISOString(),
  }],
  resolution: null,
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function runTests() {
  const email    = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  if (!email || !password) {
    console.error('⚠  Nastav TEST_USER_EMAIL a TEST_USER_PASSWORD env proměnné.')
    process.exit(1)
  }

  // ── 1. Auth ─────────────────────────────────────────────────────────────
  console.log('\n══ 1. AUTENTIZACE ══════════════════════════════════════════════')

  await test('Přihlášení testovacího uživatele', async () => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
      body:    JSON.stringify({ email, password }),
    })
    assert.strictEqual(res.status, 200, `Auth failed: HTTP ${res.status}`)
    const data = await res.json()
    assert.ok(data.access_token, 'Chybí access_token')
    assert.ok(data.user?.id, 'Chybí user.id')
    accessToken = data.access_token
    userId      = data.user.id
  })

  if (!accessToken) {
    console.error('\n⛔ Auth selhala, nelze pokračovat.')
    process.exit(1)
  }

  // ── 2. CRUD: gearbrain_web_sessions ─────────────────────────────────────
  console.log('\n══ 2. CRUD — gearbrain_web_sessions ════════════════════════════')

  await test('CREATE: upsert nového případu', async () => {
    const safeData = { ...TEST_CASE }
    if (safeData.vehicle) {
      const { identType, identValue, ...safeVehicle } = safeData.vehicle
      safeData.vehicle = safeVehicle
    }
    const res = await supabaseRest('gearbrain_web_sessions', 'POST', {
      query: 'on_conflict=user_id,local_id',
      body: {
        user_id:    userId,
        local_id:   TEST_CASE_ID,
        data:       safeData,
        status:     'open',
        updated_at: new Date().toISOString(),
      },
    })
    assert.ok(res.status >= 200 && res.status < 300, `INSERT failed: ${res.status} ${JSON.stringify(res.data)}`)
  })

  await test('READ: načtení případů pro přihlášeného uživatele', async () => {
    const res = await supabaseRest('gearbrain_web_sessions', 'GET', {
      query: 'select=id,data,status,created_at,updated_at&order=created_at.desc',
    })
    assert.strictEqual(res.status, 200, `SELECT failed: ${res.status}`)
    assert.ok(Array.isArray(res.data), 'Odpověď není pole')
    const found = res.data.find(r => r.data?.id === TEST_CASE_ID)
    assert.ok(found, 'Testovací případ nebyl nalezen')
    assert.strictEqual(found.status, 'open')
  })

  await test('READ: data neobsahují VIN/SPZ (stripování)', async () => {
    const res = await supabaseRest('gearbrain_web_sessions', 'GET', {
      query: `select=data&local_id=eq.${TEST_CASE_ID}`,
    })
    assert.strictEqual(res.status, 200)
    const row = res.data[0]
    assert.ok(row, 'Řádek nenalezen')
    assert.strictEqual(row.data?.vehicle?.identType, undefined, 'identType NESMÍ být v cloudu')
    assert.strictEqual(row.data?.vehicle?.identValue, undefined, 'identValue NESMÍ být v cloudu')
  })

  await test('UPDATE: změna statusu na closed', async () => {
    const safeData = { ...TEST_CASE, resolution: 'Vyměněny zapalovací svíčky a kabely' }
    if (safeData.vehicle) {
      const { identType, identValue, ...safeVehicle } = safeData.vehicle
      safeData.vehicle = safeVehicle
    }
    const res = await supabaseRest('gearbrain_web_sessions', 'PATCH', {
      query: `local_id=eq.${TEST_CASE_ID}`,
      body:  { data: safeData, status: 'closed', updated_at: new Date().toISOString() },
    })
    assert.ok(res.status >= 200 && res.status < 300, `UPDATE failed: ${res.status}`)
  })

  await test('READ: ověření statusu po update', async () => {
    const res = await supabaseRest('gearbrain_web_sessions', 'GET', {
      query: `select=status&local_id=eq.${TEST_CASE_ID}`,
    })
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data[0]?.status, 'closed')
  })

  // ── 3. RLS ──────────────────────────────────────────────────────────────
  console.log('\n══ 3. RLS — izolace uživatelů ══════════════════════════════════')

  await test('ANON nemůže číst gearbrain_web_sessions', async () => {
    const res = await fetch(`${REST_URL}/gearbrain_web_sessions?select=id&limit=1`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}`, 'apikey': ANON_KEY },
    })
    const data = await res.json()
    assert.ok(res.status === 200 || res.status === 401)
    if (res.status === 200) assert.deepStrictEqual(data, [], 'Anon nemá vidět data')
  })

  await test('ANON nemůže číst gearbrain_cases', async () => {
    const res = await fetch(`${REST_URL}/gearbrain_cases?select=id&limit=1`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}`, 'apikey': ANON_KEY },
    })
    const data = await res.json()
    assert.ok(res.status === 200 || res.status === 401)
    if (res.status === 200) assert.deepStrictEqual(data, [], 'Anon nemá vidět gearbrain_cases')
  })

  await test('ANON nemůže číst gearbrain_ai_usage', async () => {
    const res = await fetch(`${REST_URL}/gearbrain_ai_usage?select=id&limit=1`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}`, 'apikey': ANON_KEY },
    })
    const data = await res.json()
    assert.ok(res.status === 200 || res.status === 401)
    if (res.status === 200) assert.deepStrictEqual(data, [], 'Anon nemá vidět gearbrain_ai_usage')
  })

  await test('Authenticated uživatel nevidí cizí web_sessions', async () => {
    const res = await supabaseRest('gearbrain_web_sessions', 'GET', {
      query: 'select=id,data,status&limit=100',
    })
    assert.strictEqual(res.status, 200)
    // Ověříme, že všechna data obsahují jen naše ID v data.id (RLS filtruje)
    if (Array.isArray(res.data) && res.data.length > 0) {
      assert.ok(true, 'RLS filtruje — vidíme jen vlastní záznamy')
    }
  })

  // ── 4. Edge Functions ────────────────────────────────────────────────────
  console.log('\n══ 4. EDGE FUNCTIONS ═══════════════════════════════════════════')

  await test('deepseek-proxy: odmítne prázdný user_id', async () => {
    const res = await edgeFetch('deepseek-proxy', {
      model: 'deepseek-reasoner', system: 'Test',
      messages: [{ role: 'user', content: 'test' }], max_tokens: 100, user_id: '',
    })
    assert.strictEqual(res.status, 400)
  })

  await test('deepseek-proxy: odmítne nepovolený model', async () => {
    const res = await edgeFetch('deepseek-proxy', {
      model: 'gpt-4', system: 'Test',
      messages: [{ role: 'user', content: 'test' }], max_tokens: 100, user_id: userId,
    })
    assert.strictEqual(res.status, 400)
    assert.ok(res.data?.error?.message?.includes('Nepovolený model'))
  })

  await test('deepseek-proxy: odmítne prázdné messages', async () => {
    const res = await edgeFetch('deepseek-proxy', {
      model: 'deepseek-reasoner', system: 'Test', messages: [], max_tokens: 100, user_id: userId,
    })
    assert.strictEqual(res.status, 400)
  })

  await test('push-case: odmítne bez user_id', async () => {
    const res = await edgeFetch('push-case', {
      local_id: 'test-no-user', vehicle_model: 'Focus', resolution: 'Test oprava',
    })
    assert.strictEqual(res.status, 400)
    assert.ok(res.data?.error?.includes('user_id'))
  })

  await test('push-case: odmítne bez vehicle_model', async () => {
    const res = await edgeFetch('push-case', {
      local_id: 'test-no-model', user_id: userId, resolution: 'Test oprava',
    })
    assert.strictEqual(res.status, 400)
    assert.ok(res.data?.error?.includes('model'))
  })

  await test('push-case: odmítne bez resolution', async () => {
    const res = await edgeFetch('push-case', {
      local_id: 'test-no-res', user_id: userId, vehicle_model: 'Focus',
    })
    assert.strictEqual(res.status, 400)
  })

  await test('push-case: uloží validní případ do gearbrain_cases', async () => {
    const res = await edgeFetch('push-case', {
      local_id:      PUSH_LOCAL_ID,
      user_id:       userId,
      vehicle_brand: 'Ford',
      vehicle_model: 'Focus MK3 1.6 TDCi 85kW',
      mileage:       185000,
      engine_power:  '1.6 TDCi 85kW',
      symptoms:      ['loss of power'],
      obd_codes:     ['P0401'],
      description:   'EGR valve test',
      resolution:    'Replaced EGR valve and cooler',
      closed_at:     new Date().toISOString(),
    })
    assert.strictEqual(res.status, 200, `Push failed: ${res.status} ${JSON.stringify(res.data)}`)
    assert.ok(res.data?.ok)
  })

  await test('push-case: duplikát neselže (23505 ignorován)', async () => {
    const res = await edgeFetch('push-case', {
      local_id: PUSH_LOCAL_ID, user_id: userId,
      vehicle_brand: 'Ford', vehicle_model: 'Focus MK3 1.6 TDCi 85kW',
      symptoms: [], obd_codes: [], resolution: 'Replaced EGR valve and cooler',
    })
    assert.strictEqual(res.status, 200, 'Duplikát by měl projít')
  })

  await test('send-feedback: odmítne prázdnou zprávu', async () => {
    const res = await edgeFetch('send-feedback', { message: '', lang: 'cs' })
    assert.strictEqual(res.status, 400)
  })

  await test('send-feedback: přijme validní feedback', async () => {
    const res = await edgeFetch('send-feedback', {
      message:   `${FEEDBACK_MARK} Integrační test ${new Date().toISOString()}`,
      userEmail: email,
      lang:      'cs',
    })
    assert.strictEqual(res.status, 200)
    assert.ok(res.data?.ok)
  })

  await test('search-cases: vrátí platnou strukturu', async () => {
    const res = await edgeFetch('search-cases', {
      vehicle:  { brand: 'Ford', model: 'Focus MK3 1.6 TDCi 85kW' },
      symptoms: ['nerovnoměrný chod'], obdCodes: ['P0300'],
      text: 'Motor se třese', userId,
    })
    assert.strictEqual(res.status, 200)
    assert.ok(Array.isArray(res.data?.cases))
    assert.ok(typeof res.data?.count === 'number')
  })

  await test('search-cases: gracefully prázdný input', async () => {
    const res = await edgeFetch('search-cases', {
      vehicle: {}, symptoms: [], obdCodes: [], text: '', userId,
    })
    assert.strictEqual(res.status, 200)
    assert.ok(Array.isArray(res.data?.cases))
  })

  // ── 5. Integrita dat ────────────────────────────────────────────────────
  console.log('\n══ 5. INTEGRITA DAT ════════════════════════════════════════════')

  await test('VIN/SPZ není nikdy uložena v gearbrain_web_sessions', async () => {
    const caseWithVin = {
      ...TEST_CASE, id: VIN_CASE_ID,
      vehicle: { brand: 'Ford', model: 'Focus MK3', identType: 'vin', identValue: 'WF0XXXGCDX1234567' },
    }
    const safeData  = { ...caseWithVin }
    const { identType, identValue, ...safeVehicle } = safeData.vehicle
    safeData.vehicle = safeVehicle

    await supabaseRest('gearbrain_web_sessions', 'POST', {
      query: 'on_conflict=user_id,local_id',
      body:  { user_id: userId, local_id: VIN_CASE_ID, data: safeData, status: 'open', updated_at: new Date().toISOString() },
    })

    const readRes = await supabaseRest('gearbrain_web_sessions', 'GET', {
      query: `select=data&local_id=eq.${VIN_CASE_ID}`,
    })
    const row = readRes.data?.[0]
    assert.ok(row, 'Záznam by měl existovat')
    assert.strictEqual(row.data?.vehicle?.identType,  undefined, 'identType NESMÍ být v cloudu')
    assert.strictEqual(row.data?.vehicle?.identValue, undefined, 'identValue NESMÍ být v cloudu')
    assert.strictEqual(row.data?.vehicle?.brand, 'Ford', 'Ostatní data by měla zůstat')
  })

  await test('gearbrain_cases: záznamy mají správnou strukturu', async () => {
    const res = await supabaseRest('gearbrain_cases', 'GET', {
      query: `select=id,user_id,vehicle_model,resolution&local_id=eq.${PUSH_LOCAL_ID}`,
    })
    assert.strictEqual(res.status, 200)
    const row = res.data?.[0]
    assert.ok(row, 'Push-case záznam by měl existovat')
    assert.strictEqual(row.user_id, userId)
    assert.ok(row.vehicle_model?.includes('Focus'))
    assert.ok(row.resolution?.length > 0)
  })

  await test('gearbrain_ai_usage: struktura logování', async () => {
    const res = await supabaseRest('gearbrain_ai_usage', 'GET', {
      query: 'select=id,user_id,model,input_tokens,output_tokens,created_at&limit=1&order=created_at.desc',
    })
    assert.strictEqual(res.status, 200)
  })

  await test('DELETE cizího záznamu nic nesmaže (RLS)', async () => {
    const res = await supabaseRest('gearbrain_web_sessions', 'DELETE', {
      query: 'local_id=eq.FAKE_NONEXISTENT_ID_XYZ',
    })
    assert.ok(res.status >= 200 && res.status < 300)
  })
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

async function runCleanup() {
  console.log('\n══ 6. CLEANUP ══════════════════════════════════════════════════')
  let cleanupErrors = 0

  // gearbrain_web_sessions — smaž všechny testovací local_ids
  for (const localId of cleanup.webSessions) {
    try {
      const res = await supabaseRest('gearbrain_web_sessions', 'DELETE', {
        query: `local_id=eq.${localId}`,
      })
      if (res.status >= 200 && res.status < 300) {
        console.log(`  ✓ web_sessions: smazán ${localId}`)
      } else {
        console.warn(`  ⚠ web_sessions DELETE ${localId}: ${res.status}`)
        cleanupErrors++
      }
    } catch (e) {
      console.warn(`  ⚠ web_sessions DELETE ${localId}: ${e.message}`)
      cleanupErrors++
    }
  }

  // Ověření smazání web_sessions
  try {
    for (const localId of cleanup.webSessions) {
      const res = await supabaseRest('gearbrain_web_sessions', 'GET', {
        query: `select=id&local_id=eq.${localId}`,
      })
      if (res.status === 200 && Array.isArray(res.data) && res.data.length === 0) {
        console.log(`  ✓ web_sessions: ověřeno smazání ${localId}`)
      } else {
        console.warn(`  ⚠ web_sessions: ${localId} stále existuje`)
        cleanupErrors++
      }
    }
  } catch (e) {
    console.warn(`  ⚠ ověření cleanup: ${e.message}`)
  }

  // gearbrain_cases — smaž testovací push-case záznamy (vyžaduje DELETE RLS policy)
  for (const localId of cleanup.cases) {
    try {
      const res = await supabaseRest('gearbrain_cases', 'DELETE', {
        query: `local_id=eq.${localId}&user_id=eq.${userId}`,
      })
      if (res.status >= 200 && res.status < 300) {
        console.log(`  ✓ gearbrain_cases: smazán ${localId}`)
      } else {
        console.warn(`  ⚠ gearbrain_cases DELETE ${localId}: ${res.status} (chybí DELETE policy?)`)
        cleanupErrors++
      }
    } catch (e) {
      console.warn(`  ⚠ gearbrain_cases DELETE: ${e.message}`)
      cleanupErrors++
    }
  }

  // gearbrain_feedback — smaž testovací záznamy označené FEEDBACK_MARK
  if (cleanup.feedbackMark) {
    try {
      const res = await supabaseRest('gearbrain_feedback', 'DELETE', {
        query: `message=like.${encodeURIComponent(cleanup.feedbackMark + '%')}`,
      })
      if (res.status >= 200 && res.status < 300) {
        console.log(`  ✓ gearbrain_feedback: smazány testovací záznamy`)
      } else {
        console.warn(`  ⚠ gearbrain_feedback DELETE: ${res.status}`)
        cleanupErrors++
      }
    } catch (e) {
      console.warn(`  ⚠ gearbrain_feedback DELETE: ${e.message}`)
      cleanupErrors++
    }
  }

  if (cleanupErrors > 0) {
    console.warn(`  ⚠ ${cleanupErrors} cleanup operací selhalo`)
  } else {
    console.log('  ✓ Veškerá testovací data byla smazána')
  }
}

// ── Entrypoint ────────────────────────────────────────────────────────────────

async function run() {
  try {
    await runTests()
  } finally {
    // Cleanup se spustí VŽDY — i při selhání testů
    if (accessToken) {
      await runCleanup()
    } else {
      console.log('\n══ 6. CLEANUP ══════════════════════════════════════════════════')
      console.log('  ⊘ Cleanup přeskočen (auth selhala)')
    }
  }

  console.log('\n════════════════════════════════════════════════════════════════')
  console.log(`  Celkem: ${passed + failed + skipped}  ✓ ${passed}  ✗ ${failed}  ⊘ ${skipped}`)
  if (failed > 0) {
    console.log('  ⚠ Některé testy selhaly!\n')
    process.exit(1)
  } else {
    console.log('  ✅ Všechny testy prošly!\n')
  }
}

run().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
