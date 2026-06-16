/**
 * Unit testy pro web/src/lib/ai.js — lokalizace system promptu a checkTopicRelevance
 * Spuštění: node tests/ai-i18n.test.js
 */

const assert = require('assert')

async function run() {
  const { buildSystemPrompt, checkTopicRelevance } = await import('../web/src/lib/ai.js')

  let passed = 0, failed = 0

  function test(name, fn) {
    try { fn(); console.log(`  ✓ ${name}`); passed++ }
    catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++ }
  }

  const VEHICLE = { brand: 'Ford', model: 'Transit MK8 2.0 EcoBlue' }

  // ── buildSystemPrompt: lokalizace ──────────────────────────────────────────
  console.log('\n── buildSystemPrompt: lokalizace ────────────────────────────────')

  test('Bez lang → český system prompt (default)', () => {
    const p = buildSystemPrompt([], VEHICLE)
    assert(p.includes('Jsi expertní AI diagnostika'), `Chybí CZ intro: ${p.slice(0, 80)}`)
    assert(p.includes('"závady"'), 'Chybí český JSON klíč závady')
    assert(p.includes('"naléhavost"'), 'Chybí český JSON klíč naléhavost')
  })

  test('lang=cs → český system prompt', () => {
    const p = buildSystemPrompt([], VEHICLE, 'cs')
    assert(p.includes('Jsi expertní'), `CZ intro: ${p.slice(0, 60)}`)
    assert(p.includes('VRAŤ POUZE JSON'), 'Chybí CZ závěr')
  })

  test('lang=en → anglický system prompt', () => {
    const p = buildSystemPrompt([], VEHICLE, 'en')
    assert(p.includes('expert AI diagnostics'), `EN intro: ${p.slice(0, 80)}`)
    assert(p.includes('RETURN ONLY JSON'), 'Chybí EN závěr')
  })

  test('lang=de → německý system prompt', () => {
    const p = buildSystemPrompt([], VEHICLE, 'de')
    assert(p.includes('Experten-AI-Diagnosesystem'), `DE intro: ${p.slice(0, 80)}`)
    assert(p.includes('GIB NUR JSON ZURÜCK'), 'Chybí DE závěr')
  })

  test('EN/DE prompty stále obsahují české JSON klíče', () => {
    const en = buildSystemPrompt([], VEHICLE, 'en')
    const de = buildSystemPrompt([], VEHICLE, 'de')
    for (const key of ['"závady"', '"naléhavost"', '"shrnutí"', '"postup"', '"pravděpodobnost"']) {
      assert(en.includes(key), `EN chybí ${key}`)
      assert(de.includes(key), `DE chybí ${key}`)
    }
  })

  test('System prompt obsahuje expertise z katalogu', () => {
    const p = buildSystemPrompt([], VEHICLE, 'en')
    assert(p.includes('Ford'), `Chybí expertise: ${p.slice(0, 120)}`)
  })

  test('System prompt bez vehicle → fallback expertise', () => {
    const p = buildSystemPrompt([], {}, 'cs')
    assert(p.includes('užitková vozidla'), `Chybí fallback expertise: ${p.slice(0, 120)}`)
  })

  // ── buildSystemPrompt: RAG blok ───────────────────────────────────────────
  console.log('\n── buildSystemPrompt: RAG block ─────────────────────────────────')

  const RAG_CASE = {
    id: 'test-1',
    ragScore: 9.5,
    ragMatchRatio: 0.85,
    vehicle: { brand: 'Ford', model: 'Transit MK8', enginePower: '96 kW' },
    resolution: 'Replaced EGR valve',
    messages: [{ type: 'input', symptoms: ['Loss of power'], obdCodes: ['P0401'], text: '' }],
  }

  test('RAG blok v CS obsahuje české labely', () => {
    const p = buildSystemPrompt([RAG_CASE], VEHICLE, 'cs')
    assert(p.includes('VYSOKÁ SHODA'), 'Chybí CZ label')
    assert(p.includes('OVĚŘENÉ OPRAVY'), 'Chybí CZ title')
    assert(p.includes('Ověřené řešení'), 'Chybí CZ solution label')
  })

  test('RAG blok v EN obsahuje anglické labely', () => {
    const p = buildSystemPrompt([RAG_CASE], VEHICLE, 'en')
    assert(p.includes('HIGH MATCH'), 'Chybí EN label')
    assert(p.includes('VERIFIED REPAIRS'), 'Chybí EN title')
    assert(p.includes('Verified solution'), 'Chybí EN solution label')
  })

  test('RAG blok v DE obsahuje německé labely', () => {
    const p = buildSystemPrompt([RAG_CASE], VEHICLE, 'de')
    assert(p.includes('HOHE ÜBEREINSTIMMUNG'), 'Chybí DE label')
    assert(p.includes('VERIFIZIERTE REPARATUREN'), 'Chybí DE title')
    assert(p.includes('Verifizierte Lösung'), 'Chybí DE solution label')
  })

  // Pozn.: edge fn pouští dál jen F1 ≥ 0.5 (MATCH_RATIO_MIN), takže na web nikdy nedorazí ratio < 0.5.
  test('RAG matchRatio určuje sílu shody (F1 ≥0.72 = vysoká)', () => {
    const high = { ...RAG_CASE, ragMatchRatio: 0.80 }
    const mid  = { ...RAG_CASE, ragMatchRatio: 0.65 }
    const low  = { ...RAG_CASE, ragMatchRatio: 0.52 }

    const pH = buildSystemPrompt([high], VEHICLE, 'en')
    const pM = buildSystemPrompt([mid], VEHICLE, 'en')
    const pL = buildSystemPrompt([low], VEHICLE, 'en')

    assert(pH.includes('HIGH MATCH'), 'ratio ≥0.72 → HIGH')
    assert(pM.includes('MEDIUM MATCH'), 'ratio ≥0.58 → MEDIUM')
    assert(pL.includes('PARTIAL MATCH'), 'ratio <0.58 → PARTIAL')
  })

  test('RAG fallback na absolutní skóre když chybí matchRatio', () => {
    const base = { ...RAG_CASE }
    delete base.ragMatchRatio
    const high = { ...base, ragScore: 9.5 }
    const mid  = { ...base, ragScore: 6.0 }
    const low  = { ...base, ragScore: 3.0 }

    const pH = buildSystemPrompt([high], VEHICLE, 'en')
    const pM = buildSystemPrompt([mid], VEHICLE, 'en')
    const pL = buildSystemPrompt([low], VEHICLE, 'en')

    assert(pH.includes('HIGH MATCH'), 'score ≥8 → HIGH (legacy)')
    assert(pM.includes('MEDIUM MATCH'), 'score ≥5 → MEDIUM (legacy)')
    assert(pL.includes('PARTIAL MATCH'), 'score <5 → PARTIAL (legacy)')
  })

  test('RAG korroborace renderuje „potvrzeno N" (cs/en/de)', () => {
    const c = { ...RAG_CASE, ragCorroboration: 5 }
    assert(buildSystemPrompt([c], VEHICLE, 'cs').includes('potvrzeno v 5 případech'), 'CS confirmed')
    assert(buildSystemPrompt([c], VEHICLE, 'en').includes('confirmed by 5 cases'), 'EN confirmed')
    assert(buildSystemPrompt([c], VEHICLE, 'de').includes('bestätigt durch 5 Fälle'), 'DE confirmed')
  })

  test('RAG korroborace ≤1 nebo chybějící → bez přípony (žádná regrese)', () => {
    const one  = { ...RAG_CASE, ragCorroboration: 1 }
    const none = { ...RAG_CASE }
    delete none.ragCorroboration
    // Pozn.: „confirmed by N cases" je i v instrukci promptu — render přípony má navíc
    // pomlčkovou předponu „ — ", takže testujeme tu (jinak bychom chytali instrukční text).
    for (const c of [one, none]) {
      assert(!buildSystemPrompt([c], VEHICLE, 'en').includes(' — confirmed by'), 'count ≤1 / chybějící → bez přípony')
    }
  })

  // ── checkTopicRelevance: lokalizace ────────────────────────────────────────
  console.log('\n── checkTopicRelevance: lokalizace ──────────────────────────────')

  test('Krátký text → ok (bez ohledu na jazyk)', () => {
    assert.strictEqual(checkTopicRelevance('Motor problem', 'en').ok, true)
    assert.strictEqual(checkTopicRelevance('Motorschaden', 'de').ok, true)
    assert.strictEqual(checkTopicRelevance('Závada', 'cs').ok, true)
  })

  test('Text s OBD kódem → ok', () => {
    assert.strictEqual(
      checkTopicRelevance('After replacing EGR valve and clearing code P0401 the engine still stalls randomly during cold starts.', 'en').ok,
      true
    )
  })

  test('Text s technickou zkratkou → ok', () => {
    assert.strictEqual(
      checkTopicRelevance('The DPF system is showing regeneration failures repeatedly and the vehicle enters limp mode automatically.', 'en').ok,
      true
    )
  })

  test('Topic relevance check je vypnutý — vše projde (CS)', () => {
    const r = checkTopicRelevance(
      'Dnes jsem šel do obchodu a koupil jsem si nové boty. Pak jsem navštívil kamarádku a povídali jsme si o počasí.', 'cs'
    )
    assert.strictEqual(r.ok, true)
  })

  test('Topic relevance check je vypnutý — vše projde (EN)', () => {
    const r = checkTopicRelevance(
      'Today I went to the store and bought new shoes. Then I visited my friend and we talked about the weather for a while.', 'en'
    )
    assert.strictEqual(r.ok, true)
  })

  test('Topic relevance check je vypnutý — vše projde (DE)', () => {
    const r = checkTopicRelevance(
      'Heute bin ich in den Laden gegangen und habe neue Schuhe gekauft. Dann besuchte ich meine Freundin und wir sprachen über Dinge.', 'de'
    )
    assert.strictEqual(r.ok, true)
  })

  test('Topic relevance check bez lang → vše projde', () => {
    const r = checkTopicRelevance(
      'Dnes jsem šel do obchodu a koupil jsem si nové boty. Pak jsem navštívil kamarádku a povídali jsme si o počasí.'
    )
    assert.strictEqual(r.ok, true)
  })

  // ── Výsledky ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Výsledky: ${passed} prošlo, ${failed} selhalo`)
  if (failed > 0) process.exit(1)
  else console.log('✓ Všechny testy prošly\n')
}

run().catch(e => { console.error(e); process.exit(1) })
