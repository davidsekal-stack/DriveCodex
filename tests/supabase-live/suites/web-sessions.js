function buildBaseCase(localId) {
  return {
    id: localId,
    name: 'TEST: Ford Focus diagnostika',
    status: 'otevřený',
    createdAt: new Date().toISOString(),
    vehicle: {
      brand: 'Ford',
      model: 'Focus MK3 1.6 TDCi 85kW',
      enginePower: '1.6 TDCi 85kW',
      mileage: '185000',
      identType: 'spz',
      identValue: '1AB2345',
    },
    messages: [{
      id: 'msg1',
      type: 'input',
      symptoms: ['nerovnoměrný chod motoru'],
      obdCodes: ['P0300'],
      text: 'Motor se třese na volnoběh',
      timestamp: new Date().toISOString(),
    }],
    resolution: null,
  }
}

function stripVehicleIdentifiers(caseData) {
  const safeData = { ...caseData }
  if (safeData.vehicle) {
    const { identType, identValue, ...safeVehicle } = safeData.vehicle
    safeData.vehicle = safeVehicle
  }
  return safeData
}

async function runWebSessionsSuite(harness) {
  const { assert } = harness
  const sessionId = harness.createId('session')
  const deleteId = harness.createId('delete-session')
  const vinCaseId = harness.createId('vin-session')

  harness.trackWebSession(sessionId)
  harness.trackWebSession(deleteId)
  harness.trackWebSession(vinCaseId)

  const testCase = buildBaseCase(sessionId)

  harness.section('2. CRUD — gearbrain_web_sessions')

  await harness.test('CREATE: upsert nového případu', async () => {
    const result = await harness.rest('gearbrain_web_sessions', 'POST', {
      query: 'on_conflict=user_id,local_id',
      body: {
        user_id: harness.state.userId,
        local_id: sessionId,
        data: stripVehicleIdentifiers(testCase),
        status: 'open',
        updated_at: new Date().toISOString(),
      },
    })

    assert.ok(result.status >= 200 && result.status < 300, `INSERT failed: ${result.status} ${JSON.stringify(result.data)}`)
  })

  await harness.test('READ: načtení případů pro přihlášeného uživatele', async () => {
    const result = await harness.rest('gearbrain_web_sessions', 'GET', {
      query: 'select=id,data,status,created_at,updated_at&order=created_at.desc',
    })

    assert.strictEqual(result.status, 200, `SELECT failed: ${result.status}`)
    assert.ok(Array.isArray(result.data), 'Odpověď není pole')
    const found = result.data.find((row) => row.data?.id === sessionId)
    assert.ok(found, 'Testovací případ nebyl nalezen')
    assert.strictEqual(found.status, 'open')
  })

  await harness.test('READ: data neobsahují VIN/SPZ', async () => {
    const result = await harness.rest('gearbrain_web_sessions', 'GET', {
      query: `select=data&local_id=eq.${sessionId}`,
    })

    assert.strictEqual(result.status, 200)
    const row = result.data[0]
    assert.ok(row, 'Řádek nenalezen')
    assert.strictEqual(row.data?.vehicle?.identType, undefined, 'identType NESMÍ být v cloudu')
    assert.strictEqual(row.data?.vehicle?.identValue, undefined, 'identValue NESMÍ být v cloudu')
  })

  await harness.test('UPDATE: změna statusu na closed', async () => {
    const result = await harness.rest('gearbrain_web_sessions', 'PATCH', {
      query: `local_id=eq.${sessionId}`,
      body: {
        data: stripVehicleIdentifiers({ ...testCase, resolution: 'Vyměněny zapalovací svíčky a kabely' }),
        status: 'closed',
        updated_at: new Date().toISOString(),
      },
    })

    assert.ok(result.status >= 200 && result.status < 300, `UPDATE failed: ${result.status}`)
  })

  await harness.test('READ: ověření statusu po update', async () => {
    const result = await harness.rest('gearbrain_web_sessions', 'GET', {
      query: `select=status&local_id=eq.${sessionId}`,
    })

    assert.strictEqual(result.status, 200)
    assert.strictEqual(result.data[0]?.status, 'closed')
  })

  await harness.test('CREATE: VIN/SPZ se stripuje i u VIN případu', async () => {
    const vinCase = {
      ...buildBaseCase(vinCaseId),
      vehicle: {
        brand: 'Ford',
        model: 'Focus MK3',
        identType: 'vin',
        identValue: 'WF0XXXGCDX1234567',
      },
    }

    const insertResult = await harness.rest('gearbrain_web_sessions', 'POST', {
      query: 'on_conflict=user_id,local_id',
      body: {
        user_id: harness.state.userId,
        local_id: vinCaseId,
        data: stripVehicleIdentifiers(vinCase),
        status: 'open',
        updated_at: new Date().toISOString(),
      },
    })
    assert.ok(insertResult.status >= 200 && insertResult.status < 300, `VIN insert failed: ${insertResult.status}`)

    const readResult = await harness.rest('gearbrain_web_sessions', 'GET', {
      query: `select=data&local_id=eq.${vinCaseId}`,
    })
    const row = readResult.data?.[0]

    assert.ok(row, 'VIN záznam by měl existovat')
    assert.strictEqual(row.data?.vehicle?.identType, undefined, 'identType NESMÍ být v cloudu')
    assert.strictEqual(row.data?.vehicle?.identValue, undefined, 'identValue NESMÍ být v cloudu')
    assert.strictEqual(row.data?.vehicle?.brand, 'Ford', 'Ostatní data musí zůstat zachována')
  })

  await harness.test('DELETE: smazání případu funguje a záznam zmizí', async () => {
    const deleteCase = buildBaseCase(deleteId)
    const insertResult = await harness.rest('gearbrain_web_sessions', 'POST', {
      query: 'on_conflict=user_id,local_id',
      body: {
        user_id: harness.state.userId,
        local_id: deleteId,
        data: stripVehicleIdentifiers(deleteCase),
        status: 'open',
        updated_at: new Date().toISOString(),
      },
    })
    assert.ok(insertResult.status >= 200 && insertResult.status < 300, `Delete fixture insert failed: ${insertResult.status}`)

    const deleteResult = await harness.rest('gearbrain_web_sessions', 'DELETE', {
      query: `local_id=eq.${deleteId}`,
    })
    assert.ok(deleteResult.status >= 200 && deleteResult.status < 300, `DELETE failed: ${deleteResult.status}`)

    const readResult = await harness.rest('gearbrain_web_sessions', 'GET', {
      query: `select=id&local_id=eq.${deleteId}`,
    })
    assert.strictEqual(readResult.status, 200)
    assert.deepStrictEqual(readResult.data, [])
  })

  return {
    sessionId,
    vinCaseId,
  }
}

module.exports = {
  runWebSessionsSuite,
}
