# Handover

Aktualizováno: 2026-03-22

## Co je teď důležité

Repo dnes pokrývá čtyři souběžné oblasti:
- webovou aplikaci v `web/` pro AI diagnostiku vozidel nad Supabase
- seed pipeline pro klubová fóra v `scripts/`
- import seedů do Supabase
- live testy interakce aplikace se Supabase v `tests/supabase-live`

Nejčerstvější praktický stav:
- seed metadata nesou `thread_url`, takže každý nový seed lze dohledat k původnímu vláknu
- existují hotové crawlery pro `VW`, `Toyota`, `Ford`, `Peugeot`, `Renault`, `Audi`, `Opel`, `BMW`, `SEAT`, `Citroën`
- pro `Citroën/BMW/Opel/SEAT` je nově připravený sekvenční batch runner nad root fóry
- Audi crawler byl po copy-paste chybě opraven a z druhého signals běhu bylo ručně potvrzeno `5 ready`

## Stav větví a push do GitHubu

Aktuální branch:
- `codex/prepare-main-merge`

Aktuální `HEAD`:
- `c4709c7` `Add Audi forum crawler and tests`

Remote stav při poslední kontrole:
- `origin/main` = `e82444d`
- `origin/codex/prepare-main-merge` = `e82444d`

To znamená:
- branch je lokálně `ahead 1`
- samotný Audi commit ještě není pushnutý na GitHub
- navíc existuje větší množství necommitnutých změn v worktree, takže push do `main` teď není “jen jedním příkazem”, pokud se napřed nerozhodne, co přesně má jít do commitu

## Aktuální stav pracovního stromu

Worktree je záměrně nečistý. Jsou v něm současně:
- starší nepushnutý Audi commit
- novější necommitnuté crawler a dokumentační změny
- pracovní seed a deploy artefakty v rootu

Kódové změny, které teď nejsou bezpečně zapsané v jednom commitu:
- [package.json](/C:/GB/package.json)
- [scripts/forum-seed.mjs](/C:/GB/scripts/forum-seed.mjs)
- [scripts/forum-seed-vw.mjs](/C:/GB/scripts/forum-seed-vw.mjs)
- [scripts/forum-seed-toyota.mjs](/C:/GB/scripts/forum-seed-toyota.mjs)
- [scripts/forum-seed-audi.mjs](/C:/GB/scripts/forum-seed-audi.mjs)
- [scripts/import-seeds-to-supabase.mjs](/C:/GB/scripts/import-seeds-to-supabase.mjs)
- [supabase/functions/push-case/index.ts](/C:/GB/supabase/functions/push-case/index.ts)
- [supabase/functions/search-cases/index.ts](/C:/GB/supabase/functions/search-cases/index.ts)
- [web/src/constants/catalog.js](/C:/GB/web/src/constants/catalog.js)
- [tests/unit.test.js](/C:/GB/tests/unit.test.js)
- [tests/import-seeds-to-supabase.test.js](/C:/GB/tests/import-seeds-to-supabase.test.js)
- [tests/supabase-integration.test.js](/C:/GB/tests/supabase-integration.test.js)
- [tests/forum-seed-audi.test.js](/C:/GB/tests/forum-seed-audi.test.js)

Nové necommitnuté crawler soubory:
- [scripts/forum-seed-club-root.mjs](/C:/GB/scripts/forum-seed-club-root.mjs)
- [scripts/forum-seed-batch.mjs](/C:/GB/scripts/forum-seed-batch.mjs)
- [scripts/forum-seed-opel.mjs](/C:/GB/scripts/forum-seed-opel.mjs)
- [scripts/forum-seed-bmw.mjs](/C:/GB/scripts/forum-seed-bmw.mjs)
- [scripts/forum-seed-seat.mjs](/C:/GB/scripts/forum-seed-seat.mjs)
- [scripts/forum-seed-citroen.mjs](/C:/GB/scripts/forum-seed-citroen.mjs)
- plus starší rozpracované wrappery [forum-seed-ford.mjs](/C:/GB/scripts/forum-seed-ford.mjs), [forum-seed-peugeot.mjs](/C:/GB/scripts/forum-seed-peugeot.mjs), [forum-seed-renault.mjs](/C:/GB/scripts/forum-seed-renault.mjs)

Nové necommitnuté testy:
- [tests/forum-seed-batch.test.js](/C:/GB/tests/forum-seed-batch.test.js)
- [tests/forum-seed-opel.test.js](/C:/GB/tests/forum-seed-opel.test.js)
- [tests/forum-seed-bmw.test.js](/C:/GB/tests/forum-seed-bmw.test.js)
- [tests/forum-seed-seat.test.js](/C:/GB/tests/forum-seed-seat.test.js)
- [tests/forum-seed-citroen.test.js](/C:/GB/tests/forum-seed-citroen.test.js)
- [tests/forum-seed-ford.test.js](/C:/GB/tests/forum-seed-ford.test.js)
- [tests/forum-seed-peugeot.test.js](/C:/GB/tests/forum-seed-peugeot.test.js)
- [tests/forum-seed-renault.test.js](/C:/GB/tests/forum-seed-renault.test.js)
- nová složka [tests/supabase-live](/C:/GB/tests/supabase-live)

Artefakty, které si neplést se source of truth:
- [seed_*](/C:/GB) běhy a review adresáře
- [\.deploy-head-web*](/C:/GB/.deploy-head-web)
- [\.merge-main](/C:/GB/.merge-main)
- [\.tools](/C:/GB/.tools)

Pozor:
- `node.exe` i `npm.cmd` jsou v tomto Codex sandboxu blokované na `Přístup byl odepřen`; skutečné běhy testů a crawlerů se musí spouštět lokálně mimo sandbox

## Hlavní vstupní body projektu

- web app shell: [web/src/App.jsx](/C:/GB/web/src/App.jsx)
- persistence pro web sessions: [web/src/lib/storage-sessions.js](/C:/GB/web/src/lib/storage-sessions.js)
- edge volání z webu: [web/src/lib/storage-edge.js](/C:/GB/web/src/lib/storage-edge.js)
- storage facade: [web/src/lib/storage.js](/C:/GB/web/src/lib/storage.js)
- Supabase klient/runtime config:
  - [web/src/lib/supabase.js](/C:/GB/web/src/lib/supabase.js)
  - [web/src/lib/runtime-config.js](/C:/GB/web/src/lib/runtime-config.js)
- edge functions:
  - [push-case](/C:/GB/supabase/functions/push-case/index.ts)
  - [search-cases](/C:/GB/supabase/functions/search-cases/index.ts)
  - [send-feedback](/C:/GB/supabase/functions/send-feedback/index.ts)
  - [deepseek-proxy](/C:/GB/supabase/functions/deepseek-proxy/index.ts)
- společný crawler základ:
  - [scripts/forum-seed.mjs](/C:/GB/scripts/forum-seed.mjs)
  - [scripts/forum-seed-club-root.mjs](/C:/GB/scripts/forum-seed-club-root.mjs)

## Co bylo uděláno naposledy

### 1. Seed metadata teď nesou původní URL vlákna

Do seed recordů bylo doplněno `thread_url`, takže každá nová položka jde zpětně ručně zkontrolovat proti originálnímu vláknu.

Dotčené vrstvy:
- [scripts/forum-seed.mjs](/C:/GB/scripts/forum-seed.mjs)
- importér [scripts/import-seeds-to-supabase.mjs](/C:/GB/scripts/import-seeds-to-supabase.mjs)
- edge `push-case` [push-case/index.ts](/C:/GB/supabase/functions/push-case/index.ts)
- edge `search-cases` [search-cases/index.ts](/C:/GB/supabase/functions/search-cases/index.ts)
- migrace [009_add_thread_url_to_cases.sql](/C:/GB/supabase/migrations/009_add_thread_url_to_cases.sql)

### 2. Audi crawler byl dokončen a opraven

Nové nebo změněné soubory:
- [scripts/forum-seed-audi.mjs](/C:/GB/scripts/forum-seed-audi.mjs)
- [tests/forum-seed-audi.test.js](/C:/GB/tests/forum-seed-audi.test.js)

Původní copy-paste problém:
- record assembly ještě používala Peugeot logiku a nedefinované `PEUGEOT_ENTRY`

Po opravě:
- malý smoke běh prošel
- signals retry běh `seed_audi_full_signals_retry_20260321_204709` po ruční kontrole skončil na `5 ready`
- audit je v [MANUAL_REVIEW.md](/C:/GB/seed_audi_full_signals_retry_20260321_204709/MANUAL_REVIEW.md)

### 3. Připraveny nové root crawlery pro Opel, BMW, SEAT a Citroën

Sdílený základ:
- [scripts/forum-seed-club-root.mjs](/C:/GB/scripts/forum-seed-club-root.mjs)

Nové wrappery:
- [scripts/forum-seed-opel.mjs](/C:/GB/scripts/forum-seed-opel.mjs)
- [scripts/forum-seed-bmw.mjs](/C:/GB/scripts/forum-seed-bmw.mjs)
- [scripts/forum-seed-seat.mjs](/C:/GB/scripts/forum-seed-seat.mjs)
- [scripts/forum-seed-citroen.mjs](/C:/GB/scripts/forum-seed-citroen.mjs)

Nové testy:
- [tests/forum-seed-opel.test.js](/C:/GB/tests/forum-seed-opel.test.js)
- [tests/forum-seed-bmw.test.js](/C:/GB/tests/forum-seed-bmw.test.js)
- [tests/forum-seed-seat.test.js](/C:/GB/tests/forum-seed-seat.test.js)
- [tests/forum-seed-citroen.test.js](/C:/GB/tests/forum-seed-citroen.test.js)

Pravidla těchto crawlerů:
- root discovery z klubového rootu
- pouze modely, které začaly od roku 2000
- generické family fórum radši vrací `model_family` než agresivní konkrétní generaci
- nové modely v katalogu se nemají přidávat jen podle názvu fóra; musí být ověřené z více důvěryhodných zdrojů

### 4. Připraven sekvenční batch runner pro více klubů

Nové soubory:
- [scripts/forum-seed-batch.mjs](/C:/GB/scripts/forum-seed-batch.mjs)
- [tests/forum-seed-batch.test.js](/C:/GB/tests/forum-seed-batch.test.js)

Batch runner defaultně spouští:
- `https://www.citroen-club.cz/forum`
- `https://www.bmw-club.cz/forum`
- `https://www.club-opel.com/forum`
- `https://www.seatclub.cz/forum`

Je sekvenční, ne paralelní, aby byly čitelné logy a nerozbily se rate limity.

Poznámka k aktuálnímu stavu:
- při prvním batch discovery běhu byl nalezen a opraven blocker v root discovery: kategorie se předávaly do inventory pod špatnými klíči `forum_url/forum_title` místo `forumUrl/forumTitle`
- po tomto fixu je potřeba discovery nad těmito čtyřmi kluby pustit znovu

### 5. Live Supabase testy jsou rozdělené do procesních suite

Původní monolitický live test v [tests/supabase-integration.test.js](/C:/GB/tests/supabase-integration.test.js) byl rozdělen na harness + suite:

- shared harness: [tests/supabase-live/harness.js](/C:/GB/tests/supabase-live/harness.js)
- CRUD + privacy: [tests/supabase-live/suites/web-sessions.js](/C:/GB/tests/supabase-live/suites/web-sessions.js)
- RLS: [tests/supabase-live/suites/rls.js](/C:/GB/tests/supabase-live/suites/rls.js)
- edge functions + `gearbrain_cases`: [tests/supabase-live/suites/edge-functions.js](/C:/GB/tests/supabase-live/suites/edge-functions.js)

Tento refaktor stále čeká na první plný lokální běh.

## Jak jsou live Supabase testy zamýšlené

Cíl není mockovat Supabase, ale ověřit skutečné kritické toky:

- login test usera
- CRUD nad `gearbrain_web_sessions`
- že se VIN/SPZ do cloudu neukládají
- `push-case`
- `search-cases`
- `send-feedback`
- základní validace `deepseek-proxy`
- anon restrikce
- volitelně cross-user RLS

### Aktuální autentizační model live testů

Harness očekává **email + heslo** test usera, ne OAuth login přes GitHub.

To znamená:
- GitHub-only účet pro tyto live testy nestačí
- je potřeba vytvořit samostatného test usera v Supabase Auth

## Jak live testy pustit

Požadované env:
- `TEST_SUPABASE_URL`
- `TEST_SUPABASE_ANON_KEY`
- `TEST_USER_EMAIL`
- `TEST_USER_PASSWORD`

Volitelně:
- `TEST_SECOND_USER_EMAIL`
- `TEST_SECOND_USER_PASSWORD`

Příklad:

```powershell
Set-Location C:\GB

$env:TEST_SUPABASE_URL="https://nmvjthfezyjcwuzphiuu.supabase.co"
$env:TEST_SUPABASE_ANON_KEY="SEM_VLOZ_ANON_KEY"
$env:TEST_USER_EMAIL="gb-test-user@gearbrain.local"
$env:TEST_USER_PASSWORD="SEM_VLOZ_TEST_HESLO"

& "$env:LOCALAPPDATA\Programs\nodejs\npm.cmd" run test:supabase:live
```

## Praktické příkazy relevantní teď

### Batch discovery pro Citroën/BMW/Opel/SEAT

```powershell
Set-Location C:\GB
$stamp = Get-Date -Format yyyyMMdd_HHmmss
& "$env:LOCALAPPDATA\Programs\nodejs\npm.cmd" run forum:seed:batch -- `
  "seed_batch_clubs_titles_$stamp" `
  --discover-only --index-pages 999 --min-posts 2 --sleep-ms 400
```

### Batch signals běh

```powershell
Set-Location C:\GB
$env:DEEPSEEK_API_KEY="TVUJ_KLIC"
$stamp = Get-Date -Format yyyyMMdd_HHmmss
& "$env:LOCALAPPDATA\Programs\nodejs\npm.cmd" run forum:seed:batch -- `
  "seed_batch_clubs_full_$stamp" `
  --signals-only --keep-review --index-pages 999 --pages 3 --sleep-ms 400 --min-posts 2
```

### Audi import

Aktuální bezpečný Audi dataset:
- [seed_audi_full_signals_retry_20260321_204709](/C:/GB/seed_audi_full_signals_retry_20260321_204709)

Import:

```powershell
Set-Location C:\GB
$stamp = Get-Date -Format yyyyMMdd_HHmmss
& "$env:LOCALAPPDATA\Programs\nodejs\npm.cmd" run seed:import:supabase -- `
  "C:\GB\seed_audi_full_signals_retry_20260321_204709" `
  --user-id "8463d502-7bf6-464b-9fb2-e6dec5b9d4d3" `
  --sleep-ms 200 `
  --out-dir "seed_import_supabase_audi_retry_$stamp"
```

## Důležité externí závislosti a secrets

Web / runtime:
- Supabase URL
- Supabase anon key

Seed crawlery:
- `DEEPSEEK_API_KEY`

Edge functions:
- `DEEPSEEK_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- pro `push-case` může být relevantní `IMPORTER_USER_ID`
- pro `send-feedback` může být relevantní `RESEND_API_KEY`

Live tests:
- `TEST_SUPABASE_URL`
- `TEST_SUPABASE_ANON_KEY`
- `TEST_USER_EMAIL`
- `TEST_USER_PASSWORD`
- volitelně druhý test user

## Co si neplést se source of truth

V rootu repa jsou seed výstupy, review adresáře a deploy artefakty. Jsou užitečné jako data/debug artefakty, ale nejsou to zdrojové moduly aplikace.

Historické dokumenty:
- [PROJECT_HANDOVER_2026-03-19.md](/C:/GB/PROJECT_HANDOVER_2026-03-19.md) je starý snapshot
- tento [handover.md](/C:/GB/handover.md) má být aktuální pracovní přehled

## Doporučené další kroky

1. Znovu pustit batch discovery pro `Citroën/BMW/Opel/SEAT` po fixu root discovery.
2. Rozhodnout, které z necommitnutých crawler změn opravdu mají jít do commitu před push do `main`.
3. Pushnout Audi commit a případně nový crawler/batch commit do `origin/codex/prepare-main-merge`, teprve potom řešit merge do `main`.
4. Dotáhnout první úspěšný běh `test:supabase:live`.
4. Až live testy budou stabilní, přidat app-layer contract testy pro:
   - [web/src/lib/storage-sessions.js](/C:/GB/web/src/lib/storage-sessions.js)
   - [web/src/lib/storage-edge.js](/C:/GB/web/src/lib/storage-edge.js)
5. Teprve potom má smysl přidávat browser E2E smoke flow.

## Kdybych na to navazoval znovu já

Začal bych tímto:

```powershell
Set-Location C:\GB
git status --short
& "$env:LOCALAPPDATA\Programs\nodejs\npm.cmd" run forum:seed:renault -- "seed_renault_titles_$(Get-Date -Format yyyyMMdd_HHmmss)" --discover-only --index-pages 999 --min-posts 2 --sleep-ms 400
```

Pak bych řešil první konkrétní výsledek v tomto pořadí:
- správnost discovery inventory a kept ratio
- až potom první `signals-only` crawl
- vedle toho nezávisle první reálný běh `test:supabase:live`
