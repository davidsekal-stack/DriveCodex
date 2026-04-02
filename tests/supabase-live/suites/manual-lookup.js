/**
 * manual-lookup edge function integration tests
 *
 * POST body format (from edge function docs):
 *   brand:        string    "Volkswagen"
 *   model:        string    "Passat B6 (2006–2010)"
 *   engine_power: string    "77 kW – 1.9 TDI"
 *   components:   string[]  ["turbocharger"]
 *   fault_names:  string[]  ["Turbocharger Boost Pressure Failure"]
 *
 * Ověřuje:
 *  - match_tier je přítomen na každém výsledku
 *  - VW Passat 1.9 TDI + turbocharger → tier 1a/1b/1c (vehicle-constrained)
 *  - Honda Civic + turbocharger       → žádný vehicle-specific tier
 *  - chybějící components             → tier 3 nebo 4 (fallback)
 *  - prázdný vstup → 400 "No search criteria."
 */

const RELEVANT_TIERS = new Set(['1a', '1b', '1c'])

async function runManualLookupSuite(harness) {
  const { assert } = harness

  harness.section('5. MANUAL LOOKUP')

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function assertMatchTierPresent(results, label) {
    assert.ok(Array.isArray(results), `${label}: výsledky musí být pole`)
    for (const r of results) {
      assert.ok(
        typeof r.match_tier === 'string' && r.match_tier.length > 0,
        `${label}: každý výsledek musí mít match_tier, dostal: ${JSON.stringify(r.match_tier)}`
      )
    }
  }

  // ── Tests ────────────────────────────────────────────────────────────────────

  await harness.test('manual-lookup: VW Passat 1.9 TDI + turbocharger → vehicle-constrained tier', async () => {
    const result = await harness.edge('manual-lookup', {
      brand: 'VW',
      model: 'Passat B6 (2006–2010)',
      engine_power: '77 kW – 1.9 TDI',
      components: ['turbocharger'],
      fault_names: ['Turbocharger Boost Pressure Failure'],
    })

    assert.strictEqual(result.status, 200, `HTTP ${result.status}: ${JSON.stringify(result.data)}`)
    const refs = result.data?.results ?? []
    assertMatchTierPresent(refs, 'VW Passat turbocharger')
    assert.ok(refs.length > 0, 'Měl vrátit alespoň jeden výsledek pro VW Passat turbocharger')
    const tiers = refs.map(r => r.match_tier)
    assert.ok(
      tiers.some(t => RELEVANT_TIERS.has(t)),
      `Alespoň jeden výsledek musí mít vehicle-constrained tier (1a/1b/1c), dostal: ${JSON.stringify(tiers)}`
    )
  })

  await harness.test('manual-lookup: Honda Civic + turbocharger → žádný vehicle-specific tier', async () => {
    const result = await harness.edge('manual-lookup', {
      brand: 'Honda',
      model: 'Civic',
      engine_power: '1.0 VTEC',
      components: ['turbocharger'],
      fault_names: ['Turbocharger fault'],
    })

    assert.strictEqual(result.status, 200, `HTTP ${result.status}: ${JSON.stringify(result.data)}`)
    const refs = result.data?.results ?? []
    // Honda Civic není ve VW-centrickém manuálu — žádný vehicle-constrained tier
    const relevantRefs = refs.filter(r => RELEVANT_TIERS.has(r.match_tier))
    assert.strictEqual(
      relevantRefs.length, 0,
      `Honda Civic turbocharger neměl vrátit vehicle-specific tiery, dostal: ${JSON.stringify(refs.map(r => r.match_tier))}`
    )
  })

  await harness.test('manual-lookup: bez components → fallback (tier mimo 1a/1b/1c)', async () => {
    const result = await harness.edge('manual-lookup', {
      brand: 'VW',
      model: 'Passat B6 (2006–2010)',
      engine_power: '77 kW – 1.9 TDI',
      components: [],
      fault_names: [],
    })

    assert.strictEqual(result.status, 200, `HTTP ${result.status}: ${JSON.stringify(result.data)}`)
    const refs = result.data?.results ?? []
    assertMatchTierPresent(refs, 'VW Passat no-components')
    if (refs.length > 0) {
      const tier = refs[0].match_tier
      assert.ok(
        !RELEVANT_TIERS.has(tier),
        `Bez components nesmí být vehicle-specific tier, dostal: ${tier}`
      )
    }
  })

  await harness.test('manual-lookup: prázdný vstup vrátí 400 "No search criteria."', async () => {
    const result = await harness.edge('manual-lookup', {
      brand: '',
      model: '',
      engine_power: '',
      components: [],
      fault_names: [],
    })

    assert.strictEqual(result.status, 400, `Očekáváno 400, dostal: ${result.status}`)
    assert.ok(
      String(result.data?.error || '').includes('No search criteria'),
      `Chybová zpráva musí obsahovat "No search criteria", dostal: ${JSON.stringify(result.data)}`
    )
  })

  await harness.test('manual-lookup: každý výsledek má povinná pole (title, match_tier)', async () => {
    const result = await harness.edge('manual-lookup', {
      brand: 'VW',
      model: 'Passat B6 (2006–2010)',
      engine_power: '77 kW – 1.9 TDI',
      components: ['turbocharger'],
    })

    assert.strictEqual(result.status, 200)
    const refs = result.data?.results ?? []
    for (const r of refs) {
      assert.ok(typeof r.section === 'string', `section chybí: ${JSON.stringify(r)}`)
      assert.ok(typeof r.manual === 'string', `manual chybí: ${JSON.stringify(r)}`)
      assert.ok(typeof r.match_tier === 'string', `match_tier chybí: ${JSON.stringify(r)}`)
    }
  })
}

module.exports = { runManualLookupSuite }
