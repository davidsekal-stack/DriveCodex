/**
 * Unit testy pro web/src/lib/utils.js — lokalizované fmtDate a fmtMileage
 * Spuštění: node tests/utils-i18n.test.js
 */

const assert = require('assert')

async function run() {
  const { fmtDate, fmtMileage } = await import('../web/src/lib/utils.js')

  let passed = 0, failed = 0

  function test(name, fn) {
    try { fn(); console.log(`  ✓ ${name}`); passed++ }
    catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++ }
  }

  const ISO = '2024-06-15T14:30:00.000Z'

  // ── fmtDate ────────────────────────────────────────────────────────────────
  console.log('\n── fmtDate: lokalizace ──────────────────────────────────────────')

  test('fmtDate bez lang → cs-CZ formát (DD.MM.)', () => {
    const r = fmtDate(ISO)
    // Český formát: "15. 06." nebo "15.06."
    assert(r.includes('15'), `Chybí den: ${r}`)
    assert(r.includes('06'), `Chybí měsíc: ${r}`)
  })

  test('fmtDate s lang=cs → cs-CZ formát', () => {
    const r = fmtDate(ISO, 'cs')
    assert(r.includes('15'), `Chybí den: ${r}`)
    assert(r.includes('06'), `Chybí měsíc: ${r}`)
  })

  test('fmtDate s lang=en → en-GB formát', () => {
    const r = fmtDate(ISO, 'en')
    assert(r.includes('15'), `Chybí den: ${r}`)
    // en-GB formát: "15/06" nebo "15.06"
    assert(r.includes('06'), `Chybí měsíc: ${r}`)
  })

  test('fmtDate s lang=de → de-DE formát', () => {
    const r = fmtDate(ISO, 'de')
    assert(r.includes('15'), `Chybí den: ${r}`)
    assert(r.includes('06'), `Chybí měsíc: ${r}`)
  })

  test('fmtDate s neznámým lang → fallback na cs-CZ', () => {
    const r = fmtDate(ISO, 'xx')
    const ref = fmtDate(ISO, 'cs')
    assert.strictEqual(r, ref, `xx=${r}, cs=${ref}`)
  })

  test('fmtDate obsahuje čas', () => {
    const r = fmtDate(ISO, 'en')
    // Čas by měl být zobrazen (14:30 UTC → lokální čas)
    assert(r.includes(':'), `Neobsahuje čas: ${r}`)
  })

  // ── fmtMileage ─────────────────────────────────────────────────────────────
  console.log('\n── fmtMileage: lokalizace ───────────────────────────────────────')

  test('fmtMileage bez lang → cs-CZ formát', () => {
    const r = fmtMileage(185000)
    assert(r.includes('km'), `Chybí jednotka: ${r}`)
    assert(r.includes('185'), `Chybí číslo: ${r}`)
  })

  test('fmtMileage s lang=cs → tečka jako oddělovač tisíců', () => {
    const r = fmtMileage(185000, 'cs')
    // cs-CZ: "185 000 km" (s mezerou jako oddělovačem)
    assert(r.includes('185'), `Chybí: ${r}`)
    assert(r.endsWith('km'), `Nekončí na km: ${r}`)
  })

  test('fmtMileage s lang=en → en-GB formát', () => {
    const r = fmtMileage(185000, 'en')
    // en-GB: "185,000 km" (s čárkou jako oddělovačem)
    assert(r.includes('185'), `Chybí: ${r}`)
    assert(r.endsWith('km'), `Nekončí na km: ${r}`)
  })

  test('fmtMileage s lang=de → de-DE formát', () => {
    const r = fmtMileage(185000, 'de')
    // de-DE: "185.000 km" (s tečkou jako oddělovačem)
    assert(r.includes('185'), `Chybí: ${r}`)
    assert(r.endsWith('km'), `Nekončí na km: ${r}`)
  })

  test('fmtMileage s falsy hodnotou → prázdný string', () => {
    assert.strictEqual(fmtMileage(0, 'en'), '')
    assert.strictEqual(fmtMileage(null, 'cs'), '')
    assert.strictEqual(fmtMileage('', 'de'), '')
  })

  test('fmtMileage s neznámým lang → fallback na cs-CZ', () => {
    const r = fmtMileage(185000, 'xx')
    const ref = fmtMileage(185000, 'cs')
    assert.strictEqual(r, ref)
  })

  // ── Výsledky ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Výsledky: ${passed} prošlo, ${failed} selhalo`)
  if (failed > 0) process.exit(1)
  else console.log('✓ Všechny testy prošly\n')
}

run().catch(e => { console.error(e); process.exit(1) })
