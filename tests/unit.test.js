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
import { loadInitialSession } from '../web/src/lib/auth-session.js'
import { loadCasesCloudStatus, loadGlobalCaseCount } from '../web/src/lib/app-bootstrap.js'
import { buildCaseIdentLabel } from '../web/src/lib/case-draft.js'
import { getDeleteCaseMessage } from '../web/src/lib/case-dialogs.js'
import { buildSupabaseFunctionsUrl } from '../web/src/lib/runtime-config.js'
import { buildSidebarCaseSubtitle } from '../web/src/lib/sidebar-case-list.js'
import {
  getCloudStatusMeta,
  getGlobalCaseCountLabel,
  getSyncStatusMeta,
} from '../web/src/lib/sidebar-status.js'
import {
  getInputRoundNumber,
  getTokenUsageMeta,
  hasDiagnoses,
} from '../web/src/lib/session-view.js'
import {
  getStorageErrorMessage,
  makeStorageErrorResult,
  makeStorageSuccessResult,
  normalizeSearchCasesResult,
} from '../web/src/lib/storage-result.js'
import {
  buildFeedbackPayload,
  buildPushClosedCasePayload,
  buildSaveCasePayload,
  buildSearchCasesPayload,
  mapStoredCases,
  sanitizeCaseForCloud,
} from '../web/src/lib/storage-payloads.js'
import {
  buildAiRequestPayload,
  buildEdgeFunctionHeaders,
  getEdgeFunctionErrorMessage,
  getEdgeFunctionToken,
} from '../web/src/lib/edge-functions.js'
import {
  buildDiagnosedCaseName,
  buildDiagnosisUserPrompt,
  buildRagInput,
  collectCaseInputs,
  normalizeDiagnosisResult,
  removeMessageById,
  searchSimilarCases,
} from '../web/src/lib/diagnosis.js'
import { validateResolution } from '../web/src/lib/validation.js'
import { translate } from '../web/src/i18n/translate.js'
import { uid, urgColor, fmtDate, fmtMileage } from '../web/src/lib/utils.js'
import { detectEngineTech, getObdCodes, BRAND_OBD_CODES } from '../web/src/constants/obd-codes.js'
import {
  getBrandEntry, ACTIVE_BRAND_SECTIONS, ACTIVE_BRANDS, getBrandModels, getModelPowers,
  getDefaultBrand, setDefaultBrand, getStoredDefaultBrand, makeEmptyVehicle,
  saveIdent, findIdentHistory, loadIdentHistory,
} from '../web/src/constants/helpers.js'

// ── Test runner ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0
const pendingTests = []

function describe(section, fn) {
  console.log(`\n══ ${section} ══`)
  fn()
}

function test(name, fn) {
  pendingTests.push({ name, fn })
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

describe('diagnosis helpers — workflow extrakce', () => {
  test('collectCaseInputs sloučí vstupy do unikátních symptomů a OBD', () => {
    const existingMessages = [
      { id: 'm1', type: 'input', symptoms: ['sym.loss'], obdCodes: ['P0401'], text: 'První popis' },
      { id: 'm2', type: 'diagnosis', result: {} },
    ]
    const inputMsg = { id: 'm3', type: 'input', symptoms: ['sym.smoke', 'sym.loss'], obdCodes: ['P0401', 'P0299'], text: 'Druhý popis' }

    const result = collectCaseInputs(existingMessages, inputMsg)

    deepStrictEqual(result.allSymptoms, ['sym.loss', 'sym.smoke'])
    deepStrictEqual(result.allObdCodes, ['P0401', 'P0299'])
    deepStrictEqual(result.allTexts, ['První popis', 'Druhý popis'])
  })

  test('buildRagInput spojí texty do jednoho řetězce', () => {
    const ragInput = buildRagInput({ brand: 'Ford' }, ['sym.loss'], ['P0401'], ['A', 'B'])

    deepStrictEqual(ragInput, {
      vehicle: { brand: 'Ford' },
      symptoms: ['sym.loss'],
      obdCodes: ['P0401'],
      text: 'A B',
    })
  })

  test('searchSimilarCases převede nečekanou chybu lookupu na bezpečný fallback', async () => {
    const result = await searchSimilarCases(
      async () => { throw new Error('network down') },
      { vehicle: { brand: 'Ford' } },
    )

    deepStrictEqual(result.cases, [])
    strictEqual(result.ok, false)
    strictEqual(result.error.message, 'network down')
  })

  test('buildDiagnosisUserPrompt použije lokalizované labely', () => {
    const tr = (key) => ({
      'app.userVehicle': 'Vozidlo',
      'app.userMileage': 'Nájezd',
      'app.userSymptoms': 'Příznaky',
      'app.userObd': 'OBD',
      'app.userMechDesc': 'Popis mechanika',
      'sym.loss': 'Ztráta výkonu',
    }[key] ?? key)

    const prompt = buildDiagnosisUserPrompt({
      vehicle: { brand: 'Ford', model: 'Focus', enginePower: '85 kW', mileage: '185000' },
      allSymptoms: ['sym.loss'],
      allObdCodes: ['P0401'],
      allTexts: ['Motor netáhne'],
      tr,
    })

    ok(prompt.includes('Vozidlo: Ford Focus 85 kW'))
    ok(prompt.includes('Nájezd: 185000 km'))
    ok(prompt.includes('Příznaky: Ztráta výkonu'))
    ok(prompt.includes('OBD: P0401'))
    ok(prompt.includes('Popis mechanika:\nMotor netáhne'))
  })

  test('normalizeDiagnosisResult doplní chybějící závady a nastaví počet shod', () => {
    const tr = (key, params) => {
      if (key === 'diag.additionalCause') return `Další příčina ${params.num}`
      if (key === 'diag.additionalCauseDesc') return 'Doplněný popis'
      if (key === 'diag.additionalCauseNote') return 'Doplněná poznámka'
      return key
    }

    const normalized = normalizeDiagnosisResult({
      shrnutí: 'Test',
      závady: [
        { název: 'EGR', pravděpodobnost: 80, zdroj: 'databáze' },
        { název: 'Turbo', pravděpodobnost: 55, zdroj: 'ai' },
      ],
    }, tr, 4)

    strictEqual(normalized.závady.length, 3)
    strictEqual(normalized.závady[0].početShod, 4)
    strictEqual(normalized.závady[1].početShod, 0)
    strictEqual(normalized.závady[2].název, 'Další příčina 3')
  })

  test('buildDiagnosedCaseName skládá název z vozidla a primární závady', () => {
    strictEqual(
      buildDiagnosedCaseName({ brand: 'Ford', model: 'Focus MK3 1.6 TDCi' }, 'EGR ventil', 'Nový případ'),
      'Focus MK3 1.6 | EGR ventil',
    )
    strictEqual(
      buildDiagnosedCaseName({ brand: 'Ford' }, '', 'Nový případ'),
      'Nový případ',
    )
  })

  test('removeMessageById odstraní jen cílovou zprávu', () => {
    const messages = [
      { id: 'a', type: 'input' },
      { id: 'b', type: 'diagnosis' },
    ]

    deepStrictEqual(removeMessageById(messages, 'a'), [{ id: 'b', type: 'diagnosis' }])
  })
})

describe('runtime config — URL skládání', () => {
  test('buildSupabaseFunctionsUrl odvodí functions endpoint z base URL', () => {
    strictEqual(
      buildSupabaseFunctionsUrl('https://example.supabase.co', null),
      'https://example.supabase.co/functions/v1',
    )
  })

  test('buildSupabaseFunctionsUrl respektuje explicitní override a ořeže trailing slash', () => {
    strictEqual(
      buildSupabaseFunctionsUrl('https://example.supabase.co', 'https://edge.example.com/custom/'),
      'https://edge.example.com/custom',
    )
  })
})

describe('app bootstrap helpers — načtení po přihlášení', () => {
  test('loadCasesCloudStatus vrátí ok při úspěšném loadCases', async () => {
    strictEqual(await loadCasesCloudStatus(async () => ['case-1']), 'ok')
  })

  test('loadCasesCloudStatus vrátí error při selhání loadCases', async () => {
    strictEqual(await loadCasesCloudStatus(async () => { throw new Error('boom') }), 'error')
  })

  test('loadGlobalCaseCount vrátí count při úspěchu', async () => {
    deepStrictEqual(
      await loadGlobalCaseCount(async () => 42),
      { globalCaseCount: 42, hasGlobalCaseCount: true },
    )
  })

  test('loadGlobalCaseCount nepropaguje chybu při selhání', async () => {
    deepStrictEqual(
      await loadGlobalCaseCount(async () => { throw new Error('offline') }),
      { globalCaseCount: null, hasGlobalCaseCount: false },
    )
  })
})

describe('auth session helpers — inicializace session', () => {
  test('loadInitialSession vrátí session při úspěšném načtení', async () => {
    deepStrictEqual(
      await loadInitialSession(async () => ({
        data: {
          session: { user: { id: 'user-1' } },
        },
      })),
      {
        appReady: true,
        session: { user: { id: 'user-1' } },
      },
    )
  })

  test('loadInitialSession bezpečně fallbackuje na null při chybě', async () => {
    deepStrictEqual(
      await loadInitialSession(async () => { throw new Error('unavailable') }),
      {
        appReady: true,
        session: null,
      },
    )
  })
})

describe('case dialogs helpers — delete messaging', () => {
  test('getDeleteCaseMessage vrátí hlášku pro uzavřený případ', () => {
    const tr = (key) => ({
      'app.deleteClosedMsg': 'closed',
      'app.deleteOpenMsg': 'open',
    }[key] ?? key)

    strictEqual(
      getDeleteCaseMessage([{ id: '1', status: 'uzavřený' }], '1', tr),
      'closed',
    )
  })

  test('getDeleteCaseMessage fallbackuje na hlášku pro otevřený případ', () => {
    const tr = (key) => ({
      'app.deleteClosedMsg': 'closed',
      'app.deleteOpenMsg': 'open',
    }[key] ?? key)

    strictEqual(
      getDeleteCaseMessage([{ id: '1', status: 'rozpracovaný' }], '1', tr),
      'open',
    )
    strictEqual(
      getDeleteCaseMessage([], 'missing', tr),
      'open',
    )
  })
})

describe('case draft helpers — lokální label identifikátoru', () => {
  test('buildCaseIdentLabel složí značku a model', () => {
    strictEqual(
      buildCaseIdentLabel({ brand: 'Ford', model: 'Transit Custom' }, 'Nový případ'),
      'Ford Transit Custom',
    )
  })

  test('buildCaseIdentLabel fallbackuje na defaultní název', () => {
    strictEqual(
      buildCaseIdentLabel({ brand: '', model: '' }, 'Nový případ'),
      'Nový případ',
    )
  })
})

describe('sidebar status helpers — mapování stavů', () => {
  const tr = (key, params) => ({
    'app.cloudCount': `count:${params?.count}`,
    'app.cloudEmpty': 'empty',
    'app.ragConnecting': 'connecting',
    'app.ragActive': 'active',
    'app.ragUnavailable': 'unavailable',
    'app.syncSyncing': 'syncing',
    'app.syncSynced': 'synced',
    'app.syncError': 'sync error',
    'app.syncIdle': 'idle',
  }[key] ?? key)

  test('getGlobalCaseCountLabel vrátí správný text pro count, empty i loading', () => {
    strictEqual(getGlobalCaseCountLabel(42, tr), 'count:42')
    strictEqual(getGlobalCaseCountLabel(0, tr), 'empty')
    strictEqual(getGlobalCaseCountLabel(null, tr), 'connecting')
  })

  test('getCloudStatusMeta mapuje ok/error/idle stavy', () => {
    deepStrictEqual(getCloudStatusMeta('ok', tr), {
      icon: '●',
      label: 'active',
      tone: 'success',
    })
    deepStrictEqual(getCloudStatusMeta('error', tr), {
      icon: '✕',
      label: 'unavailable',
      tone: 'danger',
    })
    deepStrictEqual(getCloudStatusMeta('idle', tr), {
      icon: '○',
      label: 'connecting',
      tone: 'muted',
    })
  })

  test('getSyncStatusMeta mapuje syncing/synced/error/idle stavy', () => {
    deepStrictEqual(getSyncStatusMeta('syncing', tr), {
      icon: '↻',
      label: 'syncing',
      tone: 'muted',
      showWarning: false,
    })
    deepStrictEqual(getSyncStatusMeta('synced', tr), {
      icon: '✓',
      label: 'synced',
      tone: 'success',
      showWarning: false,
    })
    deepStrictEqual(getSyncStatusMeta('error', tr), {
      icon: '⚠',
      label: 'sync error',
      tone: 'danger',
      showWarning: true,
    })
    deepStrictEqual(getSyncStatusMeta('idle', tr), {
      icon: '○',
      label: 'idle',
      tone: 'muted',
      showWarning: false,
    })
  })
})

describe('sidebar case list helpers — sekundární řádek případu', () => {
  test('buildSidebarCaseSubtitle spojí datum a model', () => {
    const kase = {
      createdAt: '2026-03-19T10:15:00.000Z',
      vehicle: { model: 'Transit Custom L2H1' },
    }

    strictEqual(
      buildSidebarCaseSubtitle(kase, 'cs'),
      `${fmtDate(kase.createdAt, 'cs')} · Transit Custom`,
    )
  })

  test('buildSidebarCaseSubtitle funguje i bez modelu', () => {
    const kase = {
      createdAt: '2026-03-19T10:15:00.000Z',
      vehicle: {},
    }

    strictEqual(
      buildSidebarCaseSubtitle(kase, 'cs'),
      fmtDate(kase.createdAt, 'cs'),
    )
  })
})

describe('session view helpers — tokeny a kola vstupů', () => {
  test('getTokenUsageMeta vrátí muted/warning/danger podle využití', () => {
    deepStrictEqual(getTokenUsageMeta(100, 10000), {
      label: '▓ <1%',
      tone: 'muted',
      usagePercent: 1,
    })
    deepStrictEqual(getTokenUsageMeta(7500, 10000), {
      label: '▓ 75%',
      tone: 'warning',
      usagePercent: 75,
    })
    deepStrictEqual(getTokenUsageMeta(9500, 10000), {
      label: '▓ 95%',
      tone: 'danger',
      usagePercent: 95,
    })
  })

  test('getInputRoundNumber počítá jen input zprávy do aktuální pozice', () => {
    const messages = [
      { type: 'input' },
      { type: 'diagnosis' },
      { type: 'input' },
      { type: 'diagnosis' },
    ]

    strictEqual(getInputRoundNumber(messages, 0), 1)
    strictEqual(getInputRoundNumber(messages, 2), 2)
  })

  test('hasDiagnoses pozná přítomnost diagnostické zprávy', () => {
    strictEqual(hasDiagnoses([{ type: 'input' }]), false)
    strictEqual(hasDiagnoses([{ type: 'input' }, { type: 'diagnosis' }]), true)
  })
})

describe('storage result helpers — sjednocení cloud kontraktů', () => {
  test('getStorageErrorMessage vezme string nebo Error.message', () => {
    strictEqual(getStorageErrorMessage(' offline '), 'offline')
    strictEqual(getStorageErrorMessage(new Error('boom')), 'boom')
    strictEqual(getStorageErrorMessage(null, 'fallback'), 'fallback')
  })

  test('makeStorageSuccessResult a makeStorageErrorResult vrací jednotný shape', () => {
    deepStrictEqual(
      makeStorageSuccessResult({ data: { id: 1 } }),
      { ok: true, error: null, data: { id: 1 } },
    )
    deepStrictEqual(
      makeStorageErrorResult(new Error('failed'), 'fallback', { cases: [] }),
      { ok: false, error: 'failed', cases: [] },
    )
  })

  test('normalizeSearchCasesResult doplní cases/count a nastaví ok=true', () => {
    deepStrictEqual(
      normalizeSearchCasesResult({ cases: [{ id: 'a' }] }),
      { ok: true, error: null, cases: [{ id: 'a' }], count: 1 },
    )
    deepStrictEqual(
      normalizeSearchCasesResult({ count: 5 }),
      { ok: true, error: null, count: 5, cases: [] },
    )
  })
})

describe('storage payload helpers — transformace persistence dat', () => {
  test('mapStoredCases obohatí řádky o _rowId a _status', () => {
    deepStrictEqual(
      mapStoredCases([{ id: 'row-1', status: 'open', data: { id: 'case-1', name: 'Test' } }]),
      [{ id: 'case-1', name: 'Test', _rowId: 'row-1', _status: 'open' }],
    )
  })

  test('sanitizeCaseForCloud odstraní lokální identifikátory vozidla', () => {
    deepStrictEqual(
      sanitizeCaseForCloud({
        id: 'case-1',
        vehicle: {
          brand: 'Ford',
          identType: 'spz',
          identValue: '1AB2345',
        },
      }),
      {
        id: 'case-1',
        vehicle: {
          brand: 'Ford',
        },
      },
    )
  })

  test('buildSaveCasePayload skládá upsert payload', () => {
    deepStrictEqual(
      buildSaveCasePayload('user-1', {
        id: 'case-1',
        vehicle: { brand: 'Ford', identType: 'spz', identValue: 'ABC' },
      }, 'open', '2026-03-19T10:00:00.000Z'),
      {
        user_id: 'user-1',
        local_id: 'case-1',
        data: { id: 'case-1', vehicle: { brand: 'Ford' } },
        status: 'open',
        updated_at: '2026-03-19T10:00:00.000Z',
      },
    )
  })

  test('buildPushClosedCasePayload deduplikuje symptomy a OBD', () => {
    const payload = buildPushClosedCasePayload({
      id: 'case-1',
      vehicle: {
        brand: 'Ford',
        model: 'Transit',
        enginePower: '96 kW',
        mileage: '185000',
      },
      messages: [
        { type: 'input', symptoms: ['sym.loss'], obdCodes: ['P0401'], text: 'A' },
        { type: 'input', symptoms: ['sym.loss', 'sym.smoke'], obdCodes: ['P0401', 'P0299'], text: 'B' },
      ],
      resolution: 'Vyměněn EGR ventil',
      closedAt: '2026-03-19T11:00:00.000Z',
    }, 'user-1')

    deepStrictEqual(payload, {
      local_id: 'case-1',
      user_id: 'user-1',
      vehicle_brand: 'Ford',
      vehicle_model: 'Transit',
      mileage: 185000,
      engine_power: '96 kW',
      symptoms: ['sym.loss', 'sym.smoke'],
      obd_codes: ['P0401', 'P0299'],
      description: 'A B',
      resolution: 'Vyměněn EGR ventil',
      closed_at: '2026-03-19T11:00:00.000Z',
    })
  })

  test('buildFeedbackPayload a buildSearchCasesPayload používají bezpečné fallbacky', () => {
    deepStrictEqual(
      buildFeedbackPayload('Test', '', null),
      { message: 'Test', userEmail: null, lang: 'cs' },
    )
    deepStrictEqual(
      buildSearchCasesPayload({ vehicle: {}, symptoms: [], obdCodes: [], text: '' }, null),
      { vehicle: {}, symptoms: [], obdCodes: [], text: '', userId: 'web-anonymous' },
    )
  })
})

describe('edge function helpers — gateway kontrakt', () => {
  test('getEdgeFunctionToken použije session token nebo anon fallback', () => {
    strictEqual(getEdgeFunctionToken({ access_token: 'user-token' }, 'anon-token'), 'user-token')
    strictEqual(getEdgeFunctionToken(null, 'anon-token'), 'anon-token')
  })

  test('buildEdgeFunctionHeaders vrátí očekávané hlavičky', () => {
    deepStrictEqual(
      buildEdgeFunctionHeaders('user-token', 'anon-token'),
      {
        'Content-Type': 'application/json',
        Authorization: 'Bearer user-token',
        apikey: 'anon-token',
      },
    )
  })

  test('getEdgeFunctionErrorMessage čte JSON message i text fallback', () => {
    strictEqual(
      getEdgeFunctionErrorMessage('search-cases', 500, '{"message":"Broken"}'),
      'Broken',
    )
    strictEqual(
      getEdgeFunctionErrorMessage('search-cases', 502, 'Gateway timeout'),
      'Edge Function search-cases: HTTP 502 — Gateway timeout',
    )
  })

  test('buildAiRequestPayload skládá payload pro proxy', () => {
    deepStrictEqual(
      buildAiRequestPayload({
        systemPrompt: 'SYS',
        userMessage: 'USER',
        maxTokens: 123,
        model: 'deepseek-reasoner',
        userId: 'user-1',
      }),
      {
        model: 'deepseek-reasoner',
        system: 'SYS',
        messages: [{ role: 'user', content: 'USER' }],
        max_tokens: 123,
        user_id: 'user-1',
      },
    )
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

  test('příliš dlouhý text (>400 znaků) = chyba', () => {
    const long = 'a '.repeat(250)
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

  test('SEAT použije VAG canonical OBD lookup', () => {
    const codes = getObdCodes('SEAT', 'Leon IV (2020–dosud)', '150 kW - 1.5 e-HYBRID')
    deepStrictEqual(codes.brand, BRAND_OBD_CODES.Volkswagen)
  })

  test('Opel použije PSA canonical OBD lookup pro novější EU modely', () => {
    const codes = getObdCodes('Opel', 'Astra L (2021–dosud)', '96 kW - 1.5 Diesel')
    deepStrictEqual(codes.brand, BRAND_OBD_CODES.Peugeot)
  })

  test('Cupra použije VAG canonical OBD lookup', () => {
    const codes = getObdCodes('Cupra', 'Formentor (2020–dosud)', '150 kW - 1.5 e-HYBRID')
    deepStrictEqual(codes.brand, BRAND_OBD_CODES.Volkswagen)
  })

  test('Volvo použije vlastní brand-specific OBD lookup', () => {
    const codes = getObdCodes('Volvo', 'XC60 (2025–dosud)', '299 kW - T8 AWD Plug-in Hybrid')
    deepStrictEqual(codes.brand, BRAND_OBD_CODES.Volvo)
  })

  test('Suzuki použije vlastní brand-specific OBD lookup', () => {
    const codes = getObdCodes('Suzuki', 'Vitara Hybrid (2024–dosud)', '95 kW - 1.4 BoosterJet Mild Hybrid')
    deepStrictEqual(codes.brand, BRAND_OBD_CODES.Suzuki)
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

  test('ACTIVE_BRAND_SECTIONS řadí dropdown do EU a US sekcí abecedně', () => {
    deepStrictEqual(ACTIVE_BRAND_SECTIONS.map((entry) => entry.section), ['EU', 'US'])

    const euBrands = ACTIVE_BRAND_SECTIONS[0].brands.map((entry) => entry.brand)
    const usBrands = ACTIVE_BRAND_SECTIONS[1].brands.map((entry) => entry.brand)
    const sortBrands = (brands) => [...brands].sort((a, b) => a.localeCompare(b, 'cs', { sensitivity: 'base' }))

    deepStrictEqual(euBrands, sortBrands(euBrands))
    deepStrictEqual(usBrands, sortBrands(usBrands))
    ok(euBrands.includes('SEAT'))
    ok(euBrands.includes('Opel'))
    ok(euBrands.includes('Mazda'))
    ok(euBrands.includes('Cupra'))
    ok(euBrands.includes('Volvo'))
    ok(euBrands.includes('Suzuki'))
    ok(euBrands.includes('Ford'))
    ok(usBrands.includes('Ford (US)'))
    ok(usBrands.includes('Hyundai (US)'))
    ok(usBrands.includes('Kia (US)'))
    ok(!euBrands.includes('Ford (US)'))
  })

  test('getBrandModels vrátí modely pro Ford', () => {
    const models = getBrandModels('Ford')
    ok(models.length > 0, 'Ford by měl mít modely')
    // Zkontroluj že obsahuje Focus
    const hasGroup = models.some(m => m.group && m.group.toLowerCase().includes('focus'))
    const hasLabel = models.some(m => m.label && m.label.toLowerCase().includes('focus'))
    ok(hasGroup || hasLabel, 'Ford by měl obsahovat Focus')
  })

  test('Ford katalog obsahuje starší ověřené generace pro remap seedů', () => {
    const entry = getBrandEntry('Ford')
    ok(entry.expertise.includes('Escort'))
    ok(entry.expertise.includes('1995'))

    const labels = getBrandModels('Ford').map(m => m.label).filter(Boolean)
    ok(labels.includes('Fiesta MK4 / MK5 (1995–2002)'))
    ok(labels.includes('Focus MK1 (1998–2005)'))
    ok(labels.includes('Escort MkVII / Classic (1995–2000)'))
    ok(labels.includes('Mondeo II (1996–2000)'))
    ok(labels.includes('Mondeo MK III (2000–2007)'))
    ok(labels.includes('Ka I (1996–2008)'))
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

  test('SEAT katalog obsahuje starší ověřené generace i elektrifikované motorizace', () => {
    const entry = getBrandEntry('SEAT')
    ok(entry)
    ok(entry.expertise.includes('Exeo'))

    const models = getBrandModels('SEAT')
    ok(models.some(m => m.group === 'Mii'))
    ok(models.some(m => m.label === 'Mii (2012–2020)'))

    const ibizaIv = models.find(m => m.label === 'Ibiza IV (2008–2017)')
    ok(ibizaIv)
    ok(ibizaIv.powers.includes('132 kW – 1.4 TSI Cupra'))
    ok(ibizaIv.powers.includes('105 kW – 2.0 TDI'))

    const leonIii = models.find(m => m.label === 'Leon III (2012–2020)')
    ok(leonIii)
    ok(leonIii.powers.includes('96 kW – 1.5 TGI'))
    ok(leonIii.powers.includes('135 kW – 2.0 TDI'))

    const leon = models.find(m => m.label === 'Leon IV (2020–dosud)')
    ok(leon)
    ok(leon.powers.includes('150 kW – 1.5 e-HYBRID'))
    ok(leon.powers.includes('110 kW – 2.0 TDI'))

    const toledo = models.find(m => m.label === 'Toledo IV (2012–2019)')
    ok(toledo)
    ok(toledo.powers.includes('55 kW – 1.2 MPI'))
    ok(toledo.powers.includes('90 kW – 1.4 TSI'))

    const altea = models.find(m => m.label === 'Altea / Altea XL / Freetrack (2004–2015)')
    ok(altea)
    ok(altea.powers.includes('118 kW – 1.8 TSI'))

    const exeo = models.find(m => m.label === 'Exeo / Exeo ST (2009–2013)')
    ok(exeo)
    ok(exeo.powers.includes('125 kW – 2.0 TDI'))

    const tarraco = models.find(m => m.label === 'Tarraco (2018–dosud)')
    ok(tarraco)
    ok(tarraco.powers.includes('180 kW – 1.4 e-HYBRID'))
  })

  test('Opel katalog obsahuje ověřené starší generace i elektrifikaci', () => {
    const entry = getBrandEntry('Opel')
    ok(entry)
    ok(entry.expertise.includes('Grandland'))

    const models = getBrandModels('Opel')
    const astraK = models.find(m => m.label === 'Astra K (2015–2021)')
    ok(astraK)
    ok(astraK.powers.includes('147 kW – 1.6 Turbo'))
    ok(astraK.powers.includes('100 kW – 1.6 CDTI'))

    const mokkaX = models.find(m => m.label === 'Mokka X (2016–2020)')
    ok(mokkaX)
    ok(mokkaX.powers.includes('103 kW – 1.4 Turbo'))

    const crosslandX = models.find(m => m.label === 'Crossland X (2017–2020)')
    ok(crosslandX)
    ok(crosslandX.powers.includes('60 kW – 1.2 LPG'))
    ok(crosslandX.powers.includes('88 kW – 1.5 Diesel'))

    const grandlandI = models.find(m => m.label === 'Grandland I (2017–2024)')
    ok(grandlandI)
    ok(grandlandI.powers.includes('165 kW – 1.6 Plug-in Hybrid'))
    ok(grandlandI.powers.includes('221 kW – Hybrid4'))

    const corsa = models.find(m => m.label === 'Corsa F (2019–dosud)')
    ok(corsa)
    ok(corsa.powers.includes('100 kW – 1.2 Hybrid'))
    ok(corsa.powers.includes('115 kW – Electric'))

    const zafira = models.find(m => m.label === 'Zafira Life / Zafira Electric (2019–dosud)')
    ok(zafira)
    ok(zafira.powers.includes('100 kW – Electric 75'))

    const movanoElectric = models.find(m => m.label === 'Movano Electric (2021–dosud)')
    ok(movanoElectric)
    ok(movanoElectric.powers.includes('205 kW – Electric'))
  })

  test('Mazda katalog obsahuje ověřené současné EU modely a výkonové větve', () => {
    const entry = getBrandEntry('Mazda')
    ok(entry)
    ok(entry.expertise.includes('CX-60'))

    const models = getBrandModels('Mazda')
    const mazda2Hybrid = models.find(m => m.label === 'Mazda2 Hybrid (2022–dosud)')
    ok(mazda2Hybrid)
    ok(mazda2Hybrid.powers.includes('85 kW – 1.5 Hybrid'))

    const mazda3 = models.find(m => m.label === 'Mazda3 BP (2019–dosud)')
    ok(mazda3)
    ok(mazda3.powers.includes('103 kW – 2.5 e-SKYACTIV G140'))
    ok(mazda3.powers.includes('137 kW – 2.0 e-SKYACTIV X186'))

    const cx5 = models.find(m => m.label === 'CX-5 KF FL (2022–dosud)')
    ok(cx5)
    ok(cx5.powers.includes('121 kW – 2.0 e-SKYACTIV G'))

    const cx60 = models.find(m => m.label === 'CX-60 (2022–dosud)')
    ok(cx60)
    ok(cx60.powers.includes('241 kW – 2.5 e-SKYACTIV PHEV'))
  })

  test('Cupra katalog obsahuje ověřené TSI, e-HYBRID i BEV modely', () => {
    const entry = getBrandEntry('Cupra')
    ok(entry)
    ok(entry.expertise.includes('Terramar'))

    const models = getBrandModels('Cupra')
    const ateca = models.find(m => m.label === 'Ateca (2018–dosud)')
    ok(ateca)
    ok(ateca.powers.includes('221 kW – 2.0 TSI VZ'))

    const leon = models.find(m => m.label === 'Leon / Leon Sportstourer (2020–dosud)')
    ok(leon)
    ok(leon.powers.includes('150 kW – 1.5 e-HYBRID'))
    ok(leon.powers.includes('221 kW – 2.0 TSI VZ'))

    const formentor = models.find(m => m.label === 'Formentor (2020–dosud)')
    ok(formentor)
    ok(formentor.powers.includes('200 kW – 1.5 e-HYBRID VZ'))
    ok(formentor.powers.includes('245 kW – 2.0 TSI 4Drive VZ'))

    const born = models.find(m => m.label === 'Born (2022–dosud)')
    ok(born)
    ok(born.powers.includes('240 kW – Electric VZ'))

    const tavascan = models.find(m => m.label === 'Tavascan (2024–dosud)')
    ok(tavascan)
    ok(tavascan.powers.includes('250 kW – Electric AWD VZ'))

    const terramar = models.find(m => m.label === 'Terramar (2025–dosud)')
    ok(terramar)
    ok(terramar.powers.includes('195 kW – 2.0 TSI 4Drive VZ'))
    ok(terramar.powers.includes('200 kW – 1.5 e-HYBRID VZ'))
  })

  test('Volvo katalog obsahuje ověřenou současnou elektrifikovanou EU nabídku', () => {
    const entry = getBrandEntry('Volvo')
    ok(entry)
    ok(entry.expertise.includes('EX40'))

    const models = getBrandModels('Volvo')
    const ex30 = models.find(m => m.label === 'EX30 (2024–dosud)')
    ok(ex30)
    ok(ex30.powers.includes('200 kW – Single Motor'))
    ok(ex30.powers.includes('315 kW – Twin Motor Performance'))

    const ex40 = models.find(m => m.label === 'XC40 Recharge / EX40 (2021–dosud)')
    ok(ex40)
    ok(ex40.powers.includes('185 kW – Single Motor Extended Range'))
    ok(ex40.powers.includes('325 kW – Twin Motor Performance'))

    const ec40 = models.find(m => m.label === 'C40 Recharge / EC40 (2022–dosud)')
    ok(ec40)
    ok(ec40.powers.includes('300 kW – Twin Motor'))

    const xc60 = models.find(m => m.label === 'XC60 (2025–dosud)')
    ok(xc60)
    ok(xc60.powers.includes('184 kW – B5 AWD Mild Hybrid'))
    ok(xc60.powers.includes('299 kW – T8 AWD Plug-in Hybrid'))

    const xc90 = models.find(m => m.label === 'XC90 (2025–dosud)')
    ok(xc90)
    ok(xc90.powers.includes('184 kW – B5 AWD Mild Hybrid'))
  })

  test('Suzuki katalog obsahuje ověřené hybridní a elektrické EU modely', () => {
    const entry = getBrandEntry('Suzuki')
    ok(entry)
    ok(entry.expertise.includes('e Vitara'))

    const models = getBrandModels('Suzuki')
    const swift = models.find(m => m.label === 'Swift VI Hybrid (2024–dosud)')
    ok(swift)
    ok(swift.powers.includes('61 kW – 1.2 Mild Hybrid'))

    const ignis = models.find(m => m.label === 'Ignis Hybrid (2020–2024)')
    ok(ignis)
    ok(ignis.powers.includes('61 kW – 1.2 DualJet Hybrid'))

    const vitara = models.find(m => m.label === 'Vitara Hybrid (2024–dosud)')
    ok(vitara)
    ok(vitara.powers.includes('85 kW – 1.5 Full Hybrid'))
    ok(vitara.powers.includes('95 kW – 1.4 BoosterJet Mild Hybrid'))

    const sCross = models.find(m => m.label === 'S-Cross Hybrid (2024–dosud)')
    ok(sCross)
    ok(sCross.powers.includes('95 kW – 1.4 BoosterJet Mild Hybrid'))

    const eVitara = models.find(m => m.label === 'e Vitara (2025–dosud)')
    ok(eVitara)
    ok(eVitara.powers.includes('106 kW – Electric 49 kWh FWD'))
    ok(eVitara.powers.includes('135 kW – Electric 61 kWh ALLGRIP-e'))
  })

  test('Volkswagen Golf V katalog obsahuje 103 kW - 1.4 TSI pro BMY thready', () => {
    const golfV = getBrandModels('Volkswagen').find(m => m.label === 'Golf V (2006–2008)')
    ok(golfV)
    ok(golfV.powers.includes('103 kW – 1.4 TSI'))
  })

  test('Toyota katalog obsahuje nové modelové řady z Toyota Club fóra', () => {
    const models = getBrandModels('Toyota')

    const avensisT25 = models.find(m => m.label === 'Avensis T25 (2003–2009)')
    ok(avensisT25)

    const prius3 = models.find(m => m.label === 'Prius III (2009–2016)')
    ok(prius3)
    ok(prius3.powers.includes('100 kW – 1.8 Hybrid'))

    const prius2 = models.find(m => m.label === 'Prius II (2004–2009)')
    ok(prius2)

    const prius = models.find(m => m.label === 'Prius IV (2016–2022)')
    ok(prius)
    ok(prius.powers.length > 0)

    const corollaCross = models.find(m => m.label === 'Corolla Cross (2022–dosud)')
    ok(corollaCross)
    ok(corollaCross.powers.includes('103 kW – 1.8 Hybrid'))

    const highlander = models.find(m => m.label === 'Highlander / Kluger IV (2020–dosud)')
    ok(highlander)
    ok(highlander.powers.includes('182 kW – 2.5 Hybrid AWD'))

    const rav4ii = models.find(m => m.label === 'RAV4 II (2000–2006)')
    ok(rav4ii)

    const oldVerso = models.find(m => m.label === 'Corolla Verso / Verso II (2004–2009)')
    ok(oldVerso)
  })

  test('Toyota katalog obsahuje sportovní a globální Toyota Club modely', () => {
    const models = getBrandModels('Toyota')

    const gt86 = models.find(m => m.label === 'GT86 (2012–2021)')
    ok(gt86)
    ok(gt86.powers.includes('147 kW – 2.0 Boxer'))

    const gr86 = models.find(m => m.label === 'GR86 (2022–dosud)')
    ok(gr86)
    ok(gr86.powers.includes('172 kW – 2.4 Boxer'))

    const fourRunner = models.find(m => m.label === '4Runner (2009–dosud)')
    ok(fourRunner)
    strictEqual(Array.isArray(fourRunner.powers), false)

    const tacoma = models.find(m => m.label === 'Tacoma (2016–dosud)')
    ok(tacoma)
    strictEqual(Array.isArray(tacoma.powers), false)
  })

  test('Peugeot katalog pokrývá chybějící modelové řady z plánovaných Peugeot fór', () => {
    const entry = getBrandEntry('Peugeot')
    ok(entry)
    ok(entry.expertise.includes('107'))
    ok(entry.expertise.includes('Traveller'))

    const labels = getBrandModels('Peugeot').map(m => m.label).filter(Boolean)
    ok(labels.includes('107'))
    ok(labels.includes('206 / 206+'))
    ok(labels.includes('301'))
    ok(labels.includes('307'))
    ok(labels.includes('405'))
    ok(labels.includes('4007'))
    ok(labels.includes('4008'))
    ok(labels.includes('607'))
    ok(labels.includes('807'))
    ok(labels.includes('RCZ'))
    ok(labels.includes('Bipper / Bipper Tepee'))
    ok(labels.includes('Expert / Traveller II (2007–2016)'))
    ok(labels.includes('Traveller (2016–dosud)'))
    ok(labels.includes('Boxer I (1994–2006)'))
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
for (const { name, fn } of pendingTests) {
  try {
    await fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`)
    failed++
  }
}

console.log('\n════════════════════════════════════════════════════════════════')
console.log(`  Celkem: ${passed + failed}  ✓ ${passed}  ✗ ${failed}`)
if (failed > 0) {
  console.log('  ⚠ Některé testy selhaly!\n')
  process.exit(1)
} else {
  console.log('  ✅ Všechny unit testy prošly!\n')
}
