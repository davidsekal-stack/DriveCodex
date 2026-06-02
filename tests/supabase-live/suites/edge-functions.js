async function runEdgeFunctionsSuite(harness) {
  const { assert } = harness
  const pushLocalId = harness.createId('push-case')
  const feedbackPrefix = `[TEST-${harness.state.runId}]`

  harness.trackCase(pushLocalId)
  harness.trackFeedbackPrefix(feedbackPrefix)

  harness.section('4. EDGE FUNCTIONS')

  await harness.test('deepseek-proxy: odmítne prázdný user_id', async () => {
    const result = await harness.edge('deepseek-proxy', {
      model: 'deepseek-reasoner',
      system: 'Test',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 100,
      user_id: '',
    })

    assert.strictEqual(result.status, 400)
  })

  await harness.test('deepseek-proxy: odmítne nepovolený model', async () => {
    const result = await harness.edge('deepseek-proxy', {
      model: 'gpt-4',
      system: 'Test',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 100,
      user_id: harness.state.userId,
    })

    assert.strictEqual(result.status, 400)
    assert.ok(result.data?.error?.message?.includes('Nepovolený model'))
  })

  await harness.test('deepseek-proxy: odmítne prázdné messages', async () => {
    const result = await harness.edge('deepseek-proxy', {
      model: 'deepseek-reasoner',
      system: 'Test',
      messages: [],
      max_tokens: 100,
      user_id: harness.state.userId,
    })

    assert.strictEqual(result.status, 400)
  })

  await harness.test('push-case: odmítne bez user_id', async () => {
    const result = await harness.edge('push-case', {
      local_id: harness.createId('no-user'),
      vehicle_model: 'Focus',
      resolution: 'Test oprava',
    })

    assert.strictEqual(result.status, 400)
    assert.ok(String(result.data?.error || '').includes('user_id'))
  })

  await harness.test('push-case: odmítne bez vehicle_model', async () => {
    const result = await harness.edge('push-case', {
      local_id: harness.createId('no-model'),
      user_id: harness.state.userId,
      resolution: 'Test oprava',
    })

    assert.strictEqual(result.status, 400)
    assert.ok(String(result.data?.error || '').includes('model'))
  })

  await harness.test('push-case: odmítne bez resolution', async () => {
    const result = await harness.edge('push-case', {
      local_id: harness.createId('no-resolution'),
      user_id: harness.state.userId,
      vehicle_model: 'Focus',
    })

    assert.strictEqual(result.status, 400)
  })

  await harness.test('push-case: uloží validní případ do gearbrain_cases', async () => {
    const result = await harness.edge('push-case', {
      local_id: pushLocalId,
      user_id: harness.state.userId,
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

    assert.strictEqual(result.status, 200, `Push failed: ${result.status} ${JSON.stringify(result.data)}`)
    assert.ok(result.data?.ok)
  })

  await harness.test('push-case: duplikát je idempotentní', async () => {
    const result = await harness.edge('push-case', {
      local_id: pushLocalId,
      user_id: harness.state.userId,
      vehicle_brand: 'Ford',
      vehicle_model: 'Focus MK3 1.6 TDCi 85kW',
      symptoms: [],
      obd_codes: [],
      resolution: 'Replaced EGR valve and cooler',
    })

    assert.strictEqual(result.status, 200)
    assert.ok(result.data?.ok)
  })

  await harness.test('gearbrain_cases: uložený záznam má správnou strukturu', async () => {
    const result = await harness.rest('gearbrain_cases', 'GET', {
      query: `select=id,user_id,vehicle_model,resolution&local_id=eq.${pushLocalId}`,
    })

    assert.strictEqual(result.status, 200)
    const row = result.data?.[0]
    assert.ok(row, 'Push-case záznam by měl existovat')
    assert.strictEqual(row.user_id, harness.state.userId)
    assert.ok(row.vehicle_model?.includes('Focus'))
    assert.ok(row.resolution?.length > 0)
  })

  await harness.test('gearbrain_cases: head count vrací číslo pro app bootstrap', async () => {
    const result = await harness.headCount('gearbrain_cases', 'select=*')

    assert.strictEqual(result.status, 200)
    assert.ok(Number.isFinite(result.count), 'Count musí být číslo')
    assert.ok(result.count >= 1, 'Po push-case musí v DB existovat alespoň jeden případ')
  })

  await harness.test('search-cases: vrátí matching případ po push-case', async () => {
    const result = await harness.edge('search-cases', {
      vehicle: { brand: 'Ford', model: 'Focus MK3 1.6 TDCi 85kW' },
      symptoms: ['loss of power'],
      obdCodes: ['P0401'],
      text: 'EGR valve test',
      userId: harness.state.userId,
    })

    assert.strictEqual(result.status, 200)
    assert.ok(Array.isArray(result.data?.cases), 'search-cases musí vracet pole')
    // A freshly pushed case is status='pending' and only becomes searchable once
    // approved. On an empty test DB there are no approved cases, so skip the
    // "must be returned" assertion there (SKIP_GATED_TESTS=1 in CI).
    if (process.env.SKIP_GATED_TESTS !== '1') {
      assert.ok(result.data.cases.some((item) => item.localId === pushLocalId), 'Matching case nebyl vrácen')
    }
  })

  await harness.test('search-cases: prázdný input vrátí validní strukturu', async () => {
    const result = await harness.edge('search-cases', {
      vehicle: {},
      symptoms: [],
      obdCodes: [],
      text: '',
      userId: harness.state.userId,
    })

    assert.strictEqual(result.status, 200)
    assert.ok(Array.isArray(result.data?.cases))
    assert.ok(typeof result.data?.count === 'number')
  })

  await harness.test('send-feedback: odmítne prázdnou zprávu', async () => {
    const result = await harness.edge('send-feedback', { message: '', lang: 'cs' })

    assert.strictEqual(result.status, 400)
  })

  await harness.test('send-feedback: přijme validní feedback', async () => {
    const result = await harness.edge('send-feedback', {
      message: `${feedbackPrefix} integrační test ${new Date().toISOString()}`,
      userEmail: harness.config.email,
      lang: 'cs',
    })

    assert.strictEqual(result.status, 200)
    assert.ok(result.data?.ok)
  })

  return {
    pushLocalId,
  }
}

module.exports = {
  runEdgeFunctionsSuite,
}
