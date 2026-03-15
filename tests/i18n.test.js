/**
 * Unit testy pro i18n — překlady a translate() helper
 * Spuštění: node tests/i18n.test.js
 */

const assert = require('assert')

async function run() {
  const cs = await import('../web/src/i18n/cs.js')
  const en = await import('../web/src/i18n/en.js')
  const de = await import('../web/src/i18n/de.js')
  const { translate, getStrings, allStrings } = await import('../web/src/i18n/translate.js')

  let passed = 0, failed = 0

  function test(name, fn) {
    try { fn(); console.log(`  ✓ ${name}`); passed++ }
    catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++ }
  }

  // ── Slovníky: úplnost ───────────────────────────────────────────────────────
  console.log('\n── i18n: dictionary completeness ─────────────────────────────────')

  const csKeys = Object.keys(cs.strings).sort()
  const enKeys = Object.keys(en.strings).sort()
  const deKeys = Object.keys(de.strings).sort()

  test('CS, EN, DE mají stejný počet klíčů', () => {
    assert.strictEqual(csKeys.length, enKeys.length, `CS=${csKeys.length}, EN=${enKeys.length}`)
    assert.strictEqual(csKeys.length, deKeys.length, `CS=${csKeys.length}, DE=${deKeys.length}`)
  })

  test('EN obsahuje všechny klíče z CS', () => {
    const missing = csKeys.filter(k => !(k in en.strings))
    assert.strictEqual(missing.length, 0, `Chybí v EN: ${missing.join(', ')}`)
  })

  test('DE obsahuje všechny klíče z CS', () => {
    const missing = csKeys.filter(k => !(k in de.strings))
    assert.strictEqual(missing.length, 0, `Chybí v DE: ${missing.join(', ')}`)
  })

  test('CS neobsahuje klíče navíc oproti EN', () => {
    const extra = enKeys.filter(k => !(k in cs.strings))
    assert.strictEqual(extra.length, 0, `Navíc v EN: ${extra.join(', ')}`)
  })

  // ── Slovníky: parametry ────────────────────────────────────────────────────
  console.log('\n── i18n: parameter consistency ───────────────────────────────────')

  const paramPattern = /\{(\w+)\}/g

  function getParams(str) {
    const params = new Set()
    let m
    while ((m = paramPattern.exec(str)) !== null) params.add(m[1])
    return params
  }

  test('Parametrizované klíče mají stejné {params} ve všech jazycích', () => {
    const errors = []
    for (const key of csKeys) {
      const csParams = getParams(cs.strings[key])
      if (csParams.size === 0) continue
      const enParams = getParams(en.strings[key])
      const deParams = getParams(de.strings[key])

      for (const p of csParams) {
        if (!enParams.has(p)) errors.push(`EN[${key}] chybí {${p}}`)
        if (!deParams.has(p)) errors.push(`DE[${key}] chybí {${p}}`)
      }
    }
    assert.strictEqual(errors.length, 0, errors.join('; '))
  })

  // ── Slovníky: příznaky (key-based) ────────────────────────────────────────
  console.log('\n── i18n: symptom key coverage ────────────────────────────────────')

  const { SYMPTOM_CATEGORIES } = await import('../web/src/constants/index.js')

  test('Všechny catKey ze SYMPTOM_CATEGORIES existují v CS/EN/DE', () => {
    const errors = []
    for (const { catKey } of SYMPTOM_CATEGORIES) {
      if (!(catKey in cs.strings)) errors.push(`CS chybí ${catKey}`)
      if (!(catKey in en.strings)) errors.push(`EN chybí ${catKey}`)
      if (!(catKey in de.strings)) errors.push(`DE chybí ${catKey}`)
    }
    assert.strictEqual(errors.length, 0, errors.join('; '))
  })

  test('Všechny symptom keys ze SYMPTOM_CATEGORIES existují v CS/EN/DE', () => {
    const errors = []
    for (const { symptoms } of SYMPTOM_CATEGORIES) {
      for (const symKey of symptoms) {
        if (!(symKey in cs.strings)) errors.push(`CS chybí ${symKey}`)
        if (!(symKey in en.strings)) errors.push(`EN chybí ${symKey}`)
        if (!(symKey in de.strings)) errors.push(`DE chybí ${symKey}`)
      }
    }
    assert.strictEqual(errors.length, 0, errors.join('; '))
  })

  test('SYMPTOM_CATEGORIES má alespoň 5 kategorií', () => {
    assert(SYMPTOM_CATEGORIES.length >= 5, `Pouze ${SYMPTOM_CATEGORIES.length} kategorií`)
  })

  // ── translate() ────────────────────────────────────────────────────────────
  console.log('\n── translate() ──────────────────────────────────────────────────')

  test('translate s lang=cs vrací český text', () => {
    assert.strictEqual(translate('app.loading', null, 'cs'), 'Načítám...')
  })

  test('translate s lang=en vrací anglický text', () => {
    assert.strictEqual(translate('app.loading', null, 'en'), 'Loading...')
  })

  test('translate s lang=de vrací německý text', () => {
    assert.strictEqual(translate('app.loading', null, 'de'), 'Laden...')
  })

  test('translate s neznámým jazykem fallbackuje na CS', () => {
    assert.strictEqual(translate('app.loading', null, 'xx'), 'Načítám...')
  })

  test('translate s neznámým klíčem vrací klíč samotný', () => {
    assert.strictEqual(translate('nonexistent.key', null, 'en'), 'nonexistent.key')
  })

  test('translate interpoluje parametry', () => {
    const result = translate('app.casesCount', { count: 42 }, 'en')
    assert.strictEqual(result, '42 cases')
  })

  test('translate interpoluje více parametrů', () => {
    const result = translate('validation.resolutionTooShort', { length: 5, min: 10 }, 'en')
    assert(result.includes('5'), 'Obsahuje length')
    assert(result.includes('10'), 'Obsahuje min')
  })

  test('translate interpoluje parametry v CS', () => {
    const result = translate('app.casesCount', { count: 7 }, 'cs')
    assert.strictEqual(result, '7 případů')
  })

  test('translate interpoluje parametry v DE', () => {
    const result = translate('app.casesCount', { count: 3 }, 'de')
    assert.strictEqual(result, '3 Fälle')
  })

  // ── getStrings() ───────────────────────────────────────────────────────────
  console.log('\n── getStrings() ─────────────────────────────────────────────────')

  test('getStrings("en") vrací EN slovník', () => {
    const s = getStrings('en')
    assert.strictEqual(s['app.loading'], 'Loading...')
  })

  test('getStrings("cs") vrací CS slovník', () => {
    const s = getStrings('cs')
    assert.strictEqual(s['app.loading'], 'Načítám...')
  })

  test('getStrings("de") vrací DE slovník', () => {
    const s = getStrings('de')
    assert.strictEqual(s['app.loading'], 'Laden...')
  })

  test('getStrings s neznámým jazykem fallbackuje na CS', () => {
    const s = getStrings('fr')
    assert.strictEqual(s['app.loading'], 'Načítám...')
  })

  // ── allStrings ─────────────────────────────────────────────────────────────
  console.log('\n── allStrings registry ──────────────────────────────────────────')

  test('allStrings obsahuje cs, en, de', () => {
    assert('cs' in allStrings)
    assert('en' in allStrings)
    assert('de' in allStrings)
  })

  test('Žádný string v CS není prázdný', () => {
    const empty = Object.entries(cs.strings).filter(([, v]) => !v.trim())
    assert.strictEqual(empty.length, 0, `Prázdné klíče: ${empty.map(([k]) => k).join(', ')}`)
  })

  test('Žádný string v EN není prázdný', () => {
    const empty = Object.entries(en.strings).filter(([, v]) => !v.trim())
    assert.strictEqual(empty.length, 0, `Prázdné klíče: ${empty.map(([k]) => k).join(', ')}`)
  })

  test('Žádný string v DE není prázdný', () => {
    const empty = Object.entries(de.strings).filter(([, v]) => !v.trim())
    assert.strictEqual(empty.length, 0, `Prázdné klíče: ${empty.map(([k]) => k).join(', ')}`)
  })

  // ── Výsledky ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Výsledky: ${passed} prošlo, ${failed} selhalo`)
  if (failed > 0) process.exit(1)
  else console.log('✓ Všechny testy prošly\n')
}

run().catch(e => { console.error(e); process.exit(1) })
