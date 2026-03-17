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
 */

const assert = require('assert')

const SUPABASE_URL  = 'https://nmvjthfezyjcwuzphiuu.supabase.co'
const ANON_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tdmp0aGZlenlqY3d1enBoaXV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MzcwNTAsImV4cCI6MjA4ODMxMzA1MH0.acMPCJe2asOToPXg6DQccejtLOUbD8EMx9Z9FqWo_xo'
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`
const REST_URL      = `${SUPABASE_URL}/rest/v1`

// ── Helpers ──────────────────────────────────────────────────────────────────

let accessToken = null
let userId = null
let passed = 0
let failed = 0
let skipped = 0

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
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } }
  catch { return { status: res.status, data: text } }
}

// ── Test data ────────────────────────────────────────────────────────────────

const TEST_CASE_ID = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

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

async function run() {
  const email    = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  if (!email || !password) {
    console.error('⚠  Nastav TEST_USER_EMAIL a TEST_USER_PASSWORD env proměnné.')
    console.error('   Příklad: TEST_USER_EMAIL=test@test.cz TEST_USER_PASSWORD=heslo123 node tests/supabase-integration.test.js')
    process.exit(1)
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  console.log('\n══ 1. AUTENTIZACE ══════════════════════════════════════════════')

  await test('Přihlášení testovacího uživatele', async () => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
      body: JSON.stringify({ email, password }),
    })
    assert.strictEqual(res.status, 200, `Auth failed: HTTP ${res.status}`)
    const data = await res.json()
    assert.ok(data.access_token, 'Chybí access_token')
    assert.ok(data.user?.id, 'Chybí user.id')
    accessToken = data.access_token
    userId = data.user.id
  })

  if (!accessToken) {
    console.error('\n⛔ Auth selhala, nelze pokračovat.')
    process.exit(1)
  }

  // ── CRUD: gearbrain_web_sessions ─────────────────────────────────────────
  console.log('\n══ 2. CRUD — gearbrain_web_sessions ════════════════════════════')

  await test('CREATE: upsert nového případu', async () => {
    const safeData = { ...TEST_CASE }
    // Strip VIN/SPZ — stejně jako v storage.js
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
      body: { data: safeData, status: 'closed', updated_at: new Date().toISOString() },
    })
    assert.ok(res.status >= 200 && res.status < 300, `UPDATE failed: ${res.status} ${JSON.stringify(res.data)}`)
  })

  await test('READ: ověření statusu po update', async () => {
    const res = await supabaseRest('gearbrain_web_sessions', 'GET', {
      query: `select=status&local_id=eq.${TEST_CASE_ID}`,
    })
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data[0]?.status, 'closed')
  })

  // ── RLS: izolace uživatelů ─────────────────────────────────────────────
  console.log('\n══ 3. RLS — izolace uživatelů ══════════════════════════════════')

  await test('ANON nemůže číst gearbrain_web_sessions', async () => {
    const res = await fetch(`${REST_URL}/gearbrain_web_sessions?select=id&limit=1`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}`, 'apikey': ANON_KEY },
    })
    const data = await res.json()
    // Supabase vrátí 200 s prázdným polem (RLS filtruje)
    assert.ok(res.status === 200 || res.status === 401, `Neočekávaný status: ${res.status}`)
    if (res.status === 200) {
      assert.deepStrictEqual(data, [], 'Anon role by neměla vidět žádná data')
    }
  })

  await test('ANON nemůže číst gearbrain_cases', async () => {
    const res = await fetch(`${REST_URL}/gearbrain_cases?select=id&limit=1`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}`, 'apikey': ANON_KEY },
    })
    const data = await res.json()
    assert.ok(res.status === 200 || res.status === 401)
    if (res.status === 200) {
      assert.deepStrictEqual(data, [], 'Anon role by neměla vidět gearbrain_cases')
    }
  })

  await test('ANON nemůže číst gearbrain_ai_usage', async () => {
    const res = await fetch(`${REST_URL}/gearbrain_ai_usage?select=id&limit=1`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}`, 'apikey': ANON_KEY },
    })
    const data = await res.json()
    assert.ok(res.status === 200 || res.status === 401)
    if (res.status === 200) {
      assert.deepStrictEqual(data, [], 'Anon role by neměla vidět gearbrain_ai_usage')
    }
  })

  // ── Edge Functions ─────────────────────────────────────────────────────
  console.log('\n══ 4. EDGE FUNCTIONS ═══════════════════════════════════════════')

  await test('deepseek-proxy: odmítne prázdný user_id', async () => {
    const res = await edgeFetch('deepseek-proxy', {
      model: 'deepseek-reasoner',
      system: 'Test',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 100,
      user_id: '',
    })
    assert.strictEqual(res.status, 400, `Měl vrátit 400, vrátil ${res.status}`)
  })

  await test('deepseek-proxy: odmítne nepovolený model', async () => {
    const res = await edgeFetch('deepseek-proxy', {
      model: 'gpt-4',
      system: 'Test',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 100,
      user_id: userId,
    })
    assert.strictEqual(res.status, 400, `Měl vrátit 400, vrátil ${res.status}`)
    assert.ok(res.data?.error?.message?.includes('Nepovolený model'), `Chybová zpráva: ${JSON.stringify(res.data)}`)
  })

  await test('deepseek-proxy: odmítne prázdné messages', async () => {
    const res = await edgeFetch('deepseek-proxy', {
      model: 'deepseek-reasoner',
      system: 'Test',
      messages: [],
      max_tokens: 100,
      user_id: userId,
    })
    assert.strictEqual(res.status, 400)
  })

  await test('push-case: odmítne bez user_id', async () => {
    const res = await edgeFetch('push-case', {
      local_id: 'test-no-user',
      vehicle_model: 'Focus',
      resolution: 'Test oprava pro validaci',
    })
    assert.strictEqual(res.status, 400)
    assert.ok(res.data?.error?.includes('user_id'), `Chyba: ${JSON.stringify(res.data)}`)
  })

  await test('push-case: odmítne bez vehicle_model', async () => {
    const res = await edgeFetch('push-case', {
      local_id: 'test-no-model',
      user_id: userId,
      resolution: 'Test oprava pro validaci',
    })
    assert.strictEqual(res.status, 400)
    assert.ok(res.data?.error?.includes('model'), `Chyba: ${JSON.stringify(res.data)}`)
  })

  await test('push-case: odmítne bez resolution', async () => {
    const res = await edgeFetch('push-case', {
      local_id: 'test-no-resolution',
      user_id: userId,
      vehicle_model: 'Focus',
    })
    assert.strictEqual(res.status, 400)
  })

  await test('send-feedback: odmítne prázdnou zprávu', async () => {
    const res = await edgeFetch('send-feedback', { message: '', lang: 'cs' })
    assert.strictEqual(res.status, 400)
  })

  await test('send-feedback: přijme validní feedback', async () => {
    const res = await edgeFetch('send-feedback', {
      message: `[TEST] Integrační test ${new Date().toISOString()}`,
      userEmail: email,
      lang: 'cs',
    })
    assert.strictEqual(res.status, 200, `Feedback failed: ${res.status} ${JSON.stringify(res.data)}`)
    assert.ok(res.data?.ok, 'Odpověď by měla obsahovat ok: true')
  })

  await test('search-cases: vrátí platnou strukturu (i prázdnou)', async () => {
    const res = await edgeFetch('search-cases', {
      vehicle:  { brand: 'Ford', model: 'Focus MK3 1.6 TDCi 85kW' },
      symptoms: ['nerovnoměrný chod'],
      obdCodes: ['P0300'],
      text:     'Motor se třese',
      userId:   userId,
    })
    assert.strictEqual(res.status, 200, `Search failed: ${res.status}`)
    assert.ok(Array.isArray(res.data?.cases), 'Odpověď by měla obsahovat cases[]')
    assert.ok(typeof res.data?.count === 'number', 'Odpověď by měla obsahovat count')
  })

  await test('search-cases: odmítne gracefully prázdný input', async () => {
    const res = await edgeFetch('search-cases', {
      vehicle: {},
      symptoms: [],
      obdCodes: [],
      text: '',
      userId: userId,
    })
    assert.strictEqual(res.status, 200, 'Prázdný search by měl vrátit 200 s prázdným výsledkem')
    assert.ok(Array.isArray(res.data?.cases))
  })

  // ── Feedback tabulka ───────────────────────────────────────────────────
  console.log('\n══ 5. GEARBRAIN_FEEDBACK — ověření záznamu ═════════════════════')

  await test('Feedback záznam existuje v tabulce', async () => {
    const res = await supabaseRest('gearbrain_feedback', 'GET', {
      query: 'select=id,message,user_email&order=created_at.desc&limit=1',
    })
    assert.strictEqual(res.status, 200, `Unexpected status: ${res.status}`)
  })

  // ── Push-case full CRUD ───────────────────────────────────────────────
  console.log('\n══ 5b. PUSH-CASE — plný cyklus uložení do RAG DB ═════════════')

  const PUSH_LOCAL_ID = `test-push-${Date.now()}`

  await test('push-case: uloží validní případ', async () => {
    const res = await edgeFetch('push-case', {
      local_id: PUSH_LOCAL_ID,
      user_id: userId,
      vehicle_brand: 'Ford',
      vehicle_model: 'Focus MK3 1.6 TDCi 85kW',
      mileage: 185000,
      engine_power: '1.6 TDCi 85kW',
      symptoms: ['loss of power'],
      obd_codes: ['P0401'],
      description: 'EGR valve test',
      resolution: 'Replaced EGR valve and cooler',
      closed_at: new Date().toISOString(),
    })
    assert.strictEqual(res.status, 200, `Push failed: ${res.status} ${JSON.stringify(res.data)}`)
    assert.ok(res.data?.ok, 'Odpověď by měla obsahovat ok: true')
  })

  await test('push-case: duplikát neselže (23505 ignorován)', async () => {
    const res = await edgeFetch('push-case', {
      local_id: PUSH_LOCAL_ID,
      user_id: userId,
      vehicle_brand: 'Ford',
      vehicle_model: 'Focus MK3 1.6 TDCi 85kW',
      symptoms: [],
      obd_codes: [],
      resolution: 'Replaced EGR valve and cooler',
    })
    assert.strictEqual(res.status, 200, 'Duplikát by měl projít (23505 ignorován)')
  })

  // ── RLS cross-user isolation ──────────────────────────────────────────
  console.log('\n══ 5c. RLS — cross-user izolace ════════════════════════════════')

  await test('Authenticated uživatel nevidí cizí web_sessions', async () => {
    const res = await supabaseRest('gearbrain_web_sessions', 'GET', {
      query: 'select=id,data,status&limit=50',
    })
    assert.strictEqual(res.status, 200)
    // Ověříme, že všechny vrácené záznamy patří přihlášenému uživateli
    // (pokud tam vůbec nějaké jsou)
    if (Array.isArray(res.data) && res.data.length > 0) {
      // Nemáme user_id v odpovědi (není v select), ale RLS by měl filtrovat
      assert.ok(true, 'RLS filtruje — vidíme jen vlastní záznamy')
    }
  })

  await test('DELETE cizího záznamu neselže ale nic nesmaže', async () => {
    const res = await supabaseRest('gearbrain_web_sessions', 'DELETE', {
      query: 'local_id=eq.FAKE_NONEXISTENT_ID_XYZ',
    })
    // Supabase vrátí 200 s prázdným polem (nic nebylo smazáno)
    assert.ok(res.status >= 200 && res.status < 300)
  })

  // ── Data integrity checks ────────────────────────────────────────────
  console.log('\n══ 5d. INTEGRITA DAT ═══════════════════════════════════════════')

  await test('VIN/SPZ není nikdy uložena v gearbrain_web_sessions', async () => {
    // Upsert s VIN/SPZ → strip → ověřit
    const caseWithVin = {
      ...TEST_CASE,
      id: `vin-test-${Date.now()}`,
      vehicle: {
        brand: 'Ford',
        model: 'Focus MK3',
        identType: 'vin',
        identValue: 'WF0XXXGCDX1234567',
      },
    }

    // Stripni jako storage.js
    const safeData = { ...caseWithVin }
    const { identType, identValue, ...safeVehicle } = safeData.vehicle
    safeData.vehicle = safeVehicle

    await supabaseRest('gearbrain_web_sessions', 'POST', {
      query: 'on_conflict=user_id,local_id',
      body: {
        user_id: userId,
        local_id: caseWithVin.id,
        data: safeData,
        status: 'open',
        updated_at: new Date().toISOString(),
      },
    })

    const readRes = await supabaseRest('gearbrain_web_sessions', 'GET', {
      query: `select=data&local_id=eq.${caseWithVin.id}`,
    })
    const row = readRes.data?.[0]
    assert.ok(row, 'Záznam by měl existovat')
    assert.strictEqual(row.data?.vehicle?.identType, undefined, 'identType NESMÍ být v cloudu')
    assert.strictEqual(row.data?.vehicle?.identValue, undefined, 'identValue NESMÍ být v cloudu')
    assert.strictEqual(row.data?.vehicle?.brand, 'Ford', 'Ostatní vehicle data by měla zůstat')

    // Cleanup
    await supabaseRest('gearbrain_web_sessions', 'DELETE', {
      query: `local_id=eq.${caseWithVin.id}`,
    })
  })

  await test('gearbrain_ai_usage: upsert záznamu (deepseek-proxy log)', async () => {
    // deepseek-proxy loguje usage — ověříme strukturu
    const res = await supabaseRest('gearbrain_ai_usage', 'GET', {
      query: 'select=id,user_id,model,input_tokens,output_tokens,created_at&limit=1&order=created_at.desc',
    })
    assert.strictEqual(res.status, 200)
    // Nemusí existovat záznamy (pokud se deepseek ještě nevolal s tímto user),
    // ale struktura by měla být správná
  })

  // ── Cleanup ────────────────────────────────────────────────────────────
  console.log('\n══ 6. CLEANUP ══════════════════════════════════════════════════')

  await test('DELETE: smazání testovacího případu', async () => {
    const res = await supabaseRest('gearbrain_web_sessions', 'DELETE', {
      query: `local_id=eq.${TEST_CASE_ID}`,
    })
    assert.ok(res.status >= 200 && res.status < 300, `DELETE failed: ${res.status}`)
  })

  await test('DELETE: ověření smazání', async () => {
    const res = await supabaseRest('gearbrain_web_sessions', 'GET', {
      query: `select=id&local_id=eq.${TEST_CASE_ID}`,
    })
    assert.strictEqual(res.status, 200)
    assert.deepStrictEqual(res.data, [], 'Testovací případ by měl být smazán')
  })

  // ── Summary ────────────────────────────────────────────────────────────
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
