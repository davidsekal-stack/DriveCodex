/**
 * Unit testy — čistá JS logika (bez React, bez sítě)
 *
 * Testuje: helpers, validation, ai (smartRepair, checkTopicRelevance),
 *          rag (computeSimilarity, extractSignals), i18n (translate), utils
 *
 * Spuštění:  node tests/unit.test.js
 */

// ── Polyfills for Node (modules use browser APIs) ────────────────────────────
import { randomUUID } from 'node:crypto'
if (!globalThis.crypto) globalThis.crypto = { randomUUID }

// Mock localStorage
const _store = {}
globalThis.localStorage = {
  getItem: (k) => _store[k] ?? null,
  setItem: (k, v) => { _store[k] = String(v) },
  removeItem: (k) => { delete _store[k] },
}

// ── Imports ──────────────────────────────────────────────────────────────────
import { strictEqual, deepStrictEqual, ok } from 'node:assert'

import { computeSimilarity, extractSignals } from '../web/src/lib/rag.js'
import { smartRepair, checkTopicRelevance } from '../web/src/lib/ai.js'
import { validateResolution } from '../web/src/lib/validation.js'
import { translate } from '../web/src/i18n/translate.js'
import { uid, urgColor, fmtMileage } from '../web/src/lib/utils.js'
import { detectEngineTech, getObdCodes, BRAND_OBD_CODES } from '../web/src/constants/obd-codes.js'
import {
  getBrandEntry, ACTIVE_BRANDS, getBrandModels, getModelPowers,
  getDefaultBrand, setDefaultBrand, getStoredDefaultBrand, makeEmptyVehicle,
  saveIdent, findIdentHistory, loadIdentHistory,
} from '../web/src/constants/helpers.js'

// ── Test runner ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0

function describe(section, fn) {
  console.log(`\n══ ${section} ══`)
  fn()
}

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`)
    failed++
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTY
// ═══════════════════════════════════════════════════════════════════════════════

describe('smartRepair — JSON oprava', () => {
  test('parsuje validní JSON', () => {
    const raw = '{"shrnutí":"ok","závady":[{"název":"test"}],"doporučené_testy":[],"varování":null,"další_info":null}'
    const result = smartRepair(raw)
    ok(result)
    strictEqual(result.shrnutí, 'ok')
    strictEqual(result.závady.length, 1)
  })

  test('parsuje JSON s textem před ním', () => {
    const raw = 'Here is the result: {"shrnutí":"ok","závady":[],"doporučené_testy":[],"varování":null,"další_info":null}'
    const result = smartRepair(raw)
    ok(result)
    strictEqual(result.shrnutí, 'ok')
  })

  test('vrátí null pro non-JSON', () => {
    strictEqual(smartRepair('just text'), null)
    strictEqual(smartRepair(''), null)
  })

  test('opraví zkrácený JSON s kompletní závadou', () => {
    const raw = '{"shrnutí":"ok","závady":[{"název":"EGR","pravděpodobnost":85,"popis":"EGR ventil","příznaky_shoda":[],"obd_kódy":[],"díly":[],"postup":"vyměnit","naléhavost":"vysoká","poznámka":"","zdroj":"ai","početShod":0}],"doporučen'
    const result = smartRepair(raw)
    ok(result, 'Měl by opravit zkrácený JSON')
    ok(result.závady?.length >= 1)
    strictEqual(result.závady[0].název, 'EGR')
  })
})

describe('checkTopicRelevance — off-topic detekce', () => {
  test('krátký text vždy projde', () => {
    ok(checkTopicRelevance('motor se třese', 'cs').ok)
    ok(checkTopicRelevance('nevím', 'cs').ok)
    ok(checkTopicRelevance('', 'cs').ok)
  })

  test('dlouhý text bez technických signálů = odmítnuto', () => {
    const long = 'Jak se má vaše rodina? Doufám že všichni jsou v pořádku a můžeme si popovídat o počasí a dalších věcech.'
    const res = checkTopicRelevance(long, 'cs')
    strictEqual(res.ok, false)
  })

  test('dlouhý text s OBD kódem = přijato', () => {
    const long = 'Vozidlo má problém po nastartování a svítí kontrolka motoru, diagnostika ukázala P0401 a motor má špatný výkon'
    ok(checkTopicRelevance(long, 'cs').ok)
  })

  test('dlouhý text s technickou zkratkou = přijato', () => {
    const long = 'Po výměně DPF filtru a regeneraci vozidlo stále vykazuje problémy se sníženým výkonem a občasným černým kouřem'
    ok(checkTopicRelevance(long, 'cs').ok)
  })

  test('dlouhý text s číslem+jednotkou = přijato', () => {
    const long = 'Vozidlo má najeto 185000 km a v poslední době se objevují problémy při studeném startu a zvýšená spotřeba'
    ok(checkTopicRelevance(long, 'cs').ok)
  })
})

describe('validateResolution — validace opravy', () => {
  test('prázdný text = chyba', () => {
    strictEqual(validateResolution('', 'cs').ok, false)
    strictEqual(validateResolution(null, 'cs').ok, false)
    strictEqual(validateResolution(undefined, 'cs').ok, false)
  })

  test('příliš krátký text = chyba', () => {
    strictEqual(validateResolution('krátké', 'cs').ok, false)
  })

  test('příliš dlouhý text (>200 znaků) = chyba', () => {
    const long = 'a '.repeat(150)
    strictEqual(validateResolution(long, 'cs').ok, false)
  })

  test('opakující se znaky = chyba', () => {
    strictEqual(validateResolution('aaaaaaaaaa', 'cs').ok, false)
  })

  test('méně než 2 unikátní slova = chyba', () => {
    strictEqual(validateResolution('test test test', 'cs').ok, false)
  })

  test('validní popis opravy = OK', () => {
    ok(validateResolution('Vyměněn EGR ventil a provedena regenerace DPF', 'cs').ok)
  })

  test('hraniční délka 10 znaků = OK', () => {
    ok(validateResolution('Nový filtr.', 'cs').ok)
  })

  test('lokalizované chybové hlášky (EN)', () => {
    const res = validateResolution('', 'en')
    ok(res.reason.includes('missing') || res.reason.includes('Missing'), `Chybová hláška: ${res.reason}`)
  })
})

describe('computeSimilarity — RAG scoring', () => {
  const closedCase = {
    vehicle: { brand: 'Ford', model: 'Focus MK3 1.6 TDCi 85kW', enginePower: '1.6 TDCi 85kW' },
    messages: [{
      type: 'input',
      symptoms: ['loss of power', 'black smoke'],
      obdCodes: ['P0401'],
      text: 'EGR valve blocked',
    }],
  }

  test('plná shoda modelu + motoru + OBD = vysoké skóre', () => {
    const input = {
      vehicle: { model: 'Focus MK3 1.6 TDCi 85kW', enginePower: '1.6 TDCi 85kW' },
      obdCodes: ['P0401'],
      symptoms: ['loss of power'],
      text: '',
    }
    const score = computeSimilarity(closedCase, input)
    ok(score >= 10, `Skóre by mělo být ≥10, je ${score}`)
  })

  test('žádná shoda = skóre 0', () => {
    const input = {
      vehicle: { model: 'Transit Custom 2.0 EcoBlue 130kW' },
      obdCodes: ['P0171'],
      symptoms: ['overheating'],
      text: '',
    }
    strictEqual(computeSimilarity(closedCase, input), 0)
  })

  test('OBD kód má nejvyšší váhu (+4)', () => {
    const input = {
      vehicle: { model: 'Jiný model' },
      obdCodes: ['P0401'],
      symptoms: [],
      text: '',
    }
    strictEqual(computeSimilarity(closedCase, input), 4)
  })

  test('textové skóre je omezeno na MAX_TEXT_SCORE=2', () => {
    const input = {
      vehicle: {},
      obdCodes: [],
      symptoms: [],
      text: 'valve blocked power smoke',
    }
    const score = computeSimilarity(closedCase, input)
    ok(score <= 2, `Textové skóre by mělo být ≤2, je ${score}`)
  })
})

describe('extractSignals', () => {
  test('extrahuje unikátní příznaky a OBD kódy', () => {
    const kase = {
      messages: [
        { type: 'input', symptoms: ['a', 'b'], obdCodes: ['P0401'] },
        { type: 'input', symptoms: ['b', 'c'], obdCodes: ['P0401', 'P0300'] },
        { type: 'diagnosis', symptoms: ['should-be-ignored'] },
      ],
    }
    const { symptoms, obdCodes } = extractSignals(kase)
    deepStrictEqual(symptoms, ['a', 'b', 'c'])
    deepStrictEqual(obdCodes, ['P0401', 'P0300'])
  })
})

describe('translate — i18n', () => {
  test('české překlady', () => {
    strictEqual(translate('app.loading', null, 'cs'), 'Načítám...')
  })

  test('anglické překlady', () => {
    strictEqual(translate('app.loading', null, 'en'), 'Loading...')
  })

  test('německé překlady', () => {
    strictEqual(translate('app.loading', null, 'de'), 'Laden...')
  })

  test('parametrizovaný překlad', () => {
    const result = translate('app.casesCount', { count: 5 }, 'cs')
    strictEqual(result, '5 případů')
  })

  test('fallback na češtinu pro neznámý jazyk', () => {
    strictEqual(translate('app.loading', null, 'xx'), 'Načítám...')
  })

  test('neznámý klíč vrací klíč samotný', () => {
    strictEqual(translate('nonexistent.key', null, 'cs'), 'nonexistent.key')
  })

  test('i18n klíč app.identPlate je lokalizovaný', () => {
    strictEqual(translate('app.identPlate', null, 'cs'), 'SPZ')
    strictEqual(translate('app.identPlate', null, 'en'), 'LP')
    strictEqual(translate('app.identPlate', null, 'de'), 'KZ')
  })
})

describe('obd-codes', () => {
  test('diesel bez explicitního SCR/DEF signálu nedostane adblue tag', () => {
    const tags = detectEngineTech('Ford', 'Focus MK4', '110 kW - 2.0 EcoBlue')
    ok(tags.includes('diesel'))
    strictEqual(tags.includes('adblue'), false)
  })

  test('explicitní SCR/AdBlue signál přidá adblue tag', () => {
    const tags = detectEngineTech('Mercedes-Benz', 'Sprinter', '140 kW - 2.0 Diesel SCR AdBlue')
    ok(tags.includes('diesel'))
    ok(tags.includes('adblue'))
  })

  test('US značka použije canonical OBD lookup', () => {
    const codes = getObdCodes('Ford (US)', 'F-150', '298 kW - 3.5 EcoBoost')
    deepStrictEqual(codes.brand, BRAND_OBD_CODES.Ford)
  })
})

describe('helpers — vehicle catalog', () => {
  test('getBrandEntry najde Ford', () => {
    const entry = getBrandEntry('Ford')
    ok(entry)
    strictEqual(entry.brand, 'Ford')
    ok(entry.active)
  })

  test('getBrandEntry je case-insensitive', () => {
    ok(getBrandEntry('ford'))
    ok(getBrandEntry('FORD'))
  })

  test('getBrandEntry vrátí null pro neexistující', () => {
    strictEqual(getBrandEntry('NeexistujícíZnačka'), null)
    strictEqual(getBrandEntry(null), null)
    strictEqual(getBrandEntry(''), null)
  })

  test('ACTIVE_BRANDS obsahuje alespoň jednu značku', () => {
    ok(ACTIVE_BRANDS.length >= 1)
  })

  test('getBrandModels vrátí modely pro Ford', () => {
    const models = getBrandModels('Ford')
    ok(models.length > 0, 'Ford by měl mít modely')
    // Zkontroluj že obsahuje Focus
    const hasGroup = models.some(m => m.group && m.group.toLowerCase().includes('focus'))
    const hasLabel = models.some(m => m.label && m.label.toLowerCase().includes('focus'))
    ok(hasGroup || hasLabel, 'Ford by měl obsahovat Focus')
  })

  test('Škoda katalog obsahuje Elroq i v expertise', () => {
    const entry = getBrandEntry('Škoda')
    ok(entry.expertise.includes('Elroq'))
    const models = getBrandModels('Škoda')
    ok(models.some(m => m.group === 'Elroq'))
    ok(models.some(m => m.label === 'Elroq (2024–dosud)'))
  })

  test('Škoda katalog rozlišuje Octavia IV před a po faceliftu', () => {
    const models = getBrandModels('Škoda')
    const octaviaIv = models.find(m => m.label === 'Octavia IV (2020–2024)')
    const octaviaIvFl = models.find(m => m.label === 'Octavia IV FL (2024–dosud)')
    ok(octaviaIv)
    ok(octaviaIvFl)
    ok(octaviaIv.powers.includes('150 kW – 1.4 TSI iV'))
    ok(octaviaIv.powers.includes('110 kW – 1.5 TSI e-TEC'))
    ok(octaviaIvFl.powers.includes('110 kW – 1.5 TSI mHEV'))
    ok(octaviaIvFl.powers.includes('150 kW – 2.0 TSI 4x4'))
  })

  test('Škoda katalog rozlišuje Superb a Kodiaq po generacích', () => {
    const labels = getBrandModels('Škoda').map(m => m.label).filter(Boolean)
    ok(labels.includes('Superb III (2015–2024)'))
    ok(labels.includes('Superb IV (2024–dosud)'))
    ok(labels.includes('Kodiaq I (2016–2024)'))
    ok(labels.includes('Kodiaq II (2024–dosud)'))
  })

  test('Volkswagen Golf V katalog obsahuje 103 kW - 1.4 TSI pro BMY thready', () => {
    const golfV = getBrandModels('Volkswagen').find(m => m.label === 'Golf V (2006–2008)')
    ok(golfV)
    ok(golfV.powers.includes('103 kW – 1.4 TSI'))
  })
  test('getBrandModels vrátí prázdné pole pro neznámou značku', () => {
    deepStrictEqual(getBrandModels('Neznámá'), [])
    deepStrictEqual(getBrandModels(''), [])
  })

  test('getModelPowers vrátí výkony pro konkrétní model', () => {
    const models = getBrandModels('Ford')
    const focusModel = models.find(m => m.label && m.label.includes('Focus') && m.powers)
    if (focusModel) {
      const powers = getModelPowers(focusModel.label)
      ok(powers.length > 0, `Model ${focusModel.label} by měl mít výkony`)
    }
  })
})

describe('helpers — defaultBrand', () => {
  test('getDefaultBrand vrátí uloženou značku', () => {
    setDefaultBrand('Ford')
    strictEqual(getDefaultBrand(), 'Ford')
  })

  test('getStoredDefaultBrand vrátí raw hodnotu', () => {
    setDefaultBrand('Ford')
    strictEqual(getStoredDefaultBrand(), 'Ford')
  })

  test('setDefaultBrand(null) odstraní uloženou značku', () => {
    setDefaultBrand('Ford')
    setDefaultBrand(null)
    strictEqual(getStoredDefaultBrand(), '')
  })

  test('getDefaultBrand fallback na první aktivní značku', () => {
    setDefaultBrand(null)
    const brand = getDefaultBrand()
    ok(brand, 'Měl by vrátit fallback značku')
    strictEqual(brand, ACTIVE_BRANDS[0]?.brand)
  })
})

describe('helpers — VIN/SPZ identHistory', () => {
  test('saveIdent + findIdentHistory fungují', () => {
    // Clear
    localStorage.removeItem('gb_vehicleIdents')

    saveIdent('1AB2345', 'case1', 'Ford Focus')
    const history = findIdentHistory('1AB2345')
    strictEqual(history.length, 1)
    strictEqual(history[0].caseId, 'case1')
    strictEqual(history[0].caseName, 'Ford Focus')
  })

  test('saveIdent je case-insensitive (uppercase)', () => {
    localStorage.removeItem('gb_vehicleIdents')

    saveIdent('abc1234', 'case1', 'Test')
    const h1 = findIdentHistory('ABC1234')
    strictEqual(h1.length, 1, 'Mělo by najít i přes jiný case')
  })

  test('saveIdent ignoruje prázdný vstup', () => {
    localStorage.removeItem('gb_vehicleIdents')
    saveIdent('', 'case1', 'Test')
    saveIdent(null, 'case1', 'Test')
    saveIdent(undefined, 'case1', 'Test')
    deepStrictEqual(loadIdentHistory(), {})
  })

  test('saveIdent nepřidá duplikát (same caseId)', () => {
    localStorage.removeItem('gb_vehicleIdents')
    saveIdent('XYZ999', 'case1', 'A')
    saveIdent('XYZ999', 'case1', 'B')
    const h = findIdentHistory('XYZ999')
    strictEqual(h.length, 1, 'Neměl by přidat duplikát')
  })

  test('saveIdent přidá různé caseId', () => {
    localStorage.removeItem('gb_vehicleIdents')
    saveIdent('XYZ999', 'case1', 'A')
    saveIdent('XYZ999', 'case2', 'B')
    const h = findIdentHistory('XYZ999')
    strictEqual(h.length, 2)
  })

  test('findIdentHistory vrátí [] pro neznámé SPZ', () => {
    deepStrictEqual(findIdentHistory('NEEXISTUJE'), [])
    deepStrictEqual(findIdentHistory(''), [])
    deepStrictEqual(findIdentHistory(null), [])
  })
})

describe('helpers — makeEmptyVehicle', () => {
  test('vrátí objekt se všemi povinnými poli', () => {
    const v = makeEmptyVehicle()
    ok('brand' in v)
    ok('model' in v)
    ok('mileage' in v)
    ok('enginePower' in v)
    ok('identType' in v)
    ok('identValue' in v)
  })

  test('identType je "spz" a identValue je prázdný', () => {
    const v = makeEmptyVehicle()
    strictEqual(v.identType, 'spz')
    strictEqual(v.identValue, '')
  })

  test('respektuje uloženou defaultBrand', () => {
    setDefaultBrand('Ford')
    const v = makeEmptyVehicle()
    strictEqual(v.brand, 'Ford')
    setDefaultBrand(null) // cleanup
  })
})

describe('utils', () => {
  test('uid generuje 8-znakové ID', () => {
    const id = uid()
    strictEqual(id.length, 8)
    ok(/^[a-f0-9]+$/.test(id), `ID by mělo být hex: ${id}`)
  })

  test('uid je unikátní', () => {
    const ids = new Set(Array.from({ length: 100 }, uid))
    strictEqual(ids.size, 100, 'Všech 100 ID by mělo být unikátních')
  })

  test('urgColor vrátí správné barvy', () => {
    strictEqual(urgColor('kritická'), '#dc2626')
    strictEqual(urgColor('vysoká'), '#1a3c6e')
    strictEqual(urgColor('střední'), '#d97706')
    strictEqual(urgColor('nízká'), '#16a34a')
    strictEqual(urgColor('unknown'), '#16a34a') // fallback
  })

  test('fmtMileage formátuje nájezd', () => {
    const result = fmtMileage(185000, 'cs')
    ok(result.includes('km'), `Výstup: ${result}`)
    ok(result.includes('185'), `Výstup: ${result}`)
  })

  test('fmtMileage prázdný vstup = prázdný řetězec', () => {
    strictEqual(fmtMileage('', 'cs'), '')
    strictEqual(fmtMileage(0, 'cs'), '')
    strictEqual(fmtMileage(null, 'cs'), '')
  })
})

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════════════════════════════')
console.log(`  Celkem: ${passed + failed}  ✓ ${passed}  ✗ ${failed}`)
if (failed > 0) {
  console.log('  ⚠ Některé testy selhaly!\n')
  process.exit(1)
} else {
  console.log('  ✅ Všechny unit testy prošly!\n')
}
