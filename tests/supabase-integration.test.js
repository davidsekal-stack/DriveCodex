/**
 * Live Supabase integration suite
 *
 * Spuštění:
 *   TEST_SUPABASE_URL=...
 *   TEST_SUPABASE_ANON_KEY=...
 *   TEST_USER_EMAIL=...
 *   TEST_USER_PASSWORD=...
 *   node tests/supabase-integration.test.js
 *
 * Volitelné pro cross-user RLS:
 *   TEST_SECOND_USER_EMAIL=...
 *   TEST_SECOND_USER_PASSWORD=...
 */

const { createHarness } = require('./supabase-live/harness.js')
const { runWebSessionsSuite } = require('./supabase-live/suites/web-sessions.js')
const { runRlsSuite } = require('./supabase-live/suites/rls.js')
const { runEdgeFunctionsSuite } = require('./supabase-live/suites/edge-functions.js')

async function run() {
  const harness = createHarness()

  try {
    harness.section('1. AUTENTIZACE')
    await harness.test('Přihlášení testovacího uživatele', async () => {
      await harness.authenticatePrimary()
    })

    if (!harness.state.accessToken) {
      console.error('\n⛔ Auth selhala, nelze pokračovat.')
      process.exit(1)
    }

    const webFixtures = await runWebSessionsSuite(harness)
    await runRlsSuite(harness, webFixtures)
    await runEdgeFunctionsSuite(harness)
  } finally {
    if (harness.state.accessToken) {
      await harness.runCleanup()
    } else {
      harness.section('6. CLEANUP')
      console.log('  ⊘ Cleanup přeskočen (auth selhala)')
    }
  }

  harness.printSummary()
  if (harness.state.failed > 0) {
    console.log('  ⚠ Některé testy selhaly!\n')
    process.exit(1)
  }

  console.log('  ✅ Všechny live Supabase testy prošly!\n')
}

run().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
