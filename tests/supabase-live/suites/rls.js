async function runRlsSuite(harness, fixtures) {
  const { assert } = harness

  harness.section('3. RLS — izolace a přístup')

  await harness.test('ANON nemůže číst gearbrain_web_sessions', async () => {
    const response = await fetch(`${harness.config.restUrl}/gearbrain_web_sessions?select=id&limit=1`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${harness.config.anonKey}`,
        'apikey': harness.config.anonKey,
      },
    })
    const data = await response.json()

    assert.ok(response.status === 200 || response.status === 401)
    if (response.status === 200) {
      assert.deepStrictEqual(data, [], 'Anon nemá vidět data web_sessions')
    }
  })

  await harness.test('ANON nemůže číst gearbrain_cases', async () => {
    const response = await fetch(`${harness.config.restUrl}/gearbrain_cases?select=id&limit=1`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${harness.config.anonKey}`,
        'apikey': harness.config.anonKey,
      },
    })
    const data = await response.json()

    assert.ok(response.status === 200 || response.status === 401)
    if (response.status === 200) {
      assert.deepStrictEqual(data, [], 'Anon nemá vidět gearbrain_cases')
    }
  })

  await harness.test('ANON nemůže číst gearbrain_ai_usage', async () => {
    const response = await fetch(`${harness.config.restUrl}/gearbrain_ai_usage?select=id&limit=1`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${harness.config.anonKey}`,
        'apikey': harness.config.anonKey,
      },
    })
    const data = await response.json()

    assert.ok(response.status === 200 || response.status === 401)
    if (response.status === 200) {
      assert.deepStrictEqual(data, [], 'Anon nemá vidět gearbrain_ai_usage')
    }
  })

  if (!harness.config.secondUserEmail || !harness.config.secondUserPassword) {
    harness.skip('Cross-user RLS izolace', 'vyžaduje TEST_SECOND_USER_EMAIL a TEST_SECOND_USER_PASSWORD')
    return
  }

  await harness.test('Druhý uživatel nevidí náš web session záznam', async () => {
    const secondary = await harness.authenticateSecondary()
    const result = await harness.rest('gearbrain_web_sessions', 'GET', {
      query: `select=id,data&local_id=eq.${fixtures.sessionId}`,
      token: secondary.accessToken,
    })

    assert.strictEqual(result.status, 200)
    assert.deepStrictEqual(result.data, [])
  })

  await harness.test('Druhý uživatel nesmaže náš web session záznam', async () => {
    const secondary = await harness.authenticateSecondary()
    const deleteResult = await harness.rest('gearbrain_web_sessions', 'DELETE', {
      query: `local_id=eq.${fixtures.sessionId}`,
      token: secondary.accessToken,
    })

    assert.ok(deleteResult.status >= 200 && deleteResult.status < 300)

    const readResult = await harness.rest('gearbrain_web_sessions', 'GET', {
      query: `select=id&local_id=eq.${fixtures.sessionId}`,
    })
    assert.strictEqual(readResult.status, 200)
    assert.strictEqual(readResult.data.length, 1, 'Primární záznam musí po cizím DELETE pokusu zůstat')
  })
}

module.exports = {
  runRlsSuite,
}
