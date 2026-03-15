/**
 * Unit testy pro web/src/lib/validation.js — lokalizované chybové hlášky
 * Spuštění: node tests/validation-i18n.test.js
 */

const assert = require('assert')

async function run() {
  const { validateResolution } = await import('../web/src/lib/validation.js')

  let passed = 0, failed = 0

  function test(name, fn) {
    try { fn(); console.log(`  ✓ ${name}`); passed++ }
    catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++ }
  }

  // ── Validní vstupy (stejné ve všech jazycích) ─────────────────────────────
  console.log('\n── validateResolution: platné (všechny jazyky) ──────────────────')

  test('Platný popis → ok (cs)', () => {
    assert.strictEqual(validateResolution('Vyměněn EGR ventil a vyčištěn sací trakt.', 'cs').ok, true)
  })

  test('Platný popis → ok (en)', () => {
    assert.strictEqual(validateResolution('Replaced EGR valve and cleaned intake manifold.', 'en').ok, true)
  })

  test('Platný popis → ok (de)', () => {
    assert.strictEqual(validateResolution('EGR-Ventil ersetzt und Ansaugkrümmer gereinigt.', 'de').ok, true)
  })

  // ── Chybí popis — lokalizované hlášky ─────────────────────────────────────
  console.log('\n── validateResolution: prázdný popis ────────────────────────────')

  test('Prázdný → CS chybová hláška', () => {
    const r = validateResolution('', 'cs')
    assert.strictEqual(r.ok, false)
    assert(r.reason.includes('Chybí'), `CS: ${r.reason}`)
  })

  test('Prázdný → EN chybová hláška', () => {
    const r = validateResolution('', 'en')
    assert.strictEqual(r.ok, false)
    assert(r.reason.includes('missing'), `EN: ${r.reason}`)
  })

  test('Prázdný → DE chybová hláška', () => {
    const r = validateResolution('', 'de')
    assert.strictEqual(r.ok, false)
    assert(r.reason.includes('fehlt'), `DE: ${r.reason}`)
  })

  // ── Příliš krátký — lokalizované hlášky ───────────────────────────────────
  console.log('\n── validateResolution: příliš krátký ────────────────────────────')

  test('Krátký → CS hláška s délkou', () => {
    const r = validateResolution('Hotovo.', 'cs')
    assert.strictEqual(r.ok, false)
    assert(r.reason.includes('krátký'), `CS: ${r.reason}`)
    assert(r.reason.includes('7'), `CS délka: ${r.reason}`)
  })

  test('Krátký → EN hláška s délkou', () => {
    const r = validateResolution('Fix it.', 'en')
    assert.strictEqual(r.ok, false)
    assert(r.reason.includes('short'), `EN: ${r.reason}`)
    assert(r.reason.includes('7'), `EN délka: ${r.reason}`)
  })

  test('Krátký → DE hláška s délkou', () => {
    const r = validateResolution('Fertig.', 'de')
    assert.strictEqual(r.ok, false)
    assert(r.reason.includes('kurz'), `DE: ${r.reason}`)
    assert(r.reason.includes('7'), `DE délka: ${r.reason}`)
  })

  // ── Příliš dlouhý — lokalizované hlášky ───────────────────────────────────
  console.log('\n── validateResolution: příliš dlouhý ────────────────────────────')

  test('Dlouhý → CS hláška', () => {
    const r = validateResolution('Opraveno '.repeat(26), 'cs')
    assert.strictEqual(r.ok, false)
    assert(r.reason.includes('dlouhý'), `CS: ${r.reason}`)
  })

  test('Dlouhý → EN hláška', () => {
    const r = validateResolution('Repaired '.repeat(26), 'en')
    assert.strictEqual(r.ok, false)
    assert(r.reason.includes('long'), `EN: ${r.reason}`)
  })

  test('Dlouhý → DE hláška', () => {
    const r = validateResolution('Repariert '.repeat(26), 'de')
    assert.strictEqual(r.ok, false)
    assert(r.reason.includes('lang'), `DE: ${r.reason}`)
  })

  // ── Opakující se znaky ─────────────────────────────────────────────────────
  console.log('\n── validateResolution: opakující se znaky ───────────────────────')

  test('Repeating → CS', () => {
    const r = validateResolution('aaaaaaaaa oprava ventilu provedena', 'cs')
    assert.strictEqual(r.ok, false)
    assert(r.reason.includes('opakující'), `CS: ${r.reason}`)
  })

  test('Repeating → EN', () => {
    const r = validateResolution('aaaaaaaaa replaced valve and fixed', 'en')
    assert.strictEqual(r.ok, false)
    assert(r.reason.includes('repeating'), `EN: ${r.reason}`)
  })

  test('Repeating → DE', () => {
    const r = validateResolution('aaaaaaaaa Ventil ersetzt und repariert', 'de')
    assert.strictEqual(r.ok, false)
    assert(r.reason.includes('wiederholende'), `DE: ${r.reason}`)
  })

  // ── Příliš stručný ─────────────────────────────────────────────────────────
  console.log('\n── validateResolution: příliš stručný ───────────────────────────')

  test('Terse → CS', () => {
    const r = validateResolution('ok ok ok ok ok ok ok', 'cs')
    assert.strictEqual(r.ok, false)
    assert(r.reason.includes('stručný'), `CS: ${r.reason}`)
  })

  test('Terse → EN', () => {
    const r = validateResolution('ok ok ok ok ok ok ok', 'en')
    assert.strictEqual(r.ok, false)
    assert(r.reason.includes('brief'), `EN: ${r.reason}`)
  })

  test('Terse → DE', () => {
    const r = validateResolution('ok ok ok ok ok ok ok', 'de')
    assert.strictEqual(r.ok, false)
    assert(r.reason.includes('knapp'), `DE: ${r.reason}`)
  })

  // ── Bez lang → CS fallback ─────────────────────────────────────────────────
  console.log('\n── validateResolution: fallback na CS ───────────────────────────')

  test('Bez lang → CS chyba', () => {
    const r = validateResolution('')
    assert.strictEqual(r.ok, false)
    assert(r.reason.includes('Chybí'), `Fallback: ${r.reason}`)
  })

  // ── Výsledky ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Výsledky: ${passed} prošlo, ${failed} selhalo`)
  if (failed > 0) process.exit(1)
  else console.log('✓ Všechny testy prošly\n')
}

run().catch(e => { console.error(e); process.exit(1) })
