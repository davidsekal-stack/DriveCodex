# GearBrain

Webová aplikace pro AI diagnostiku vozidel nad Supabase a současně pracovní repozitář pro seed pipeline, která z klubových fór skládá databázi ověřených oprav.

Repo dnes pokrývá dvě hlavní oblasti:
- `web/` obsahuje zákaznickou aplikaci pro zadání vozidla, symptomů a průběžnou diagnostiku
- `scripts/` a `tests/` obsahují crawler/import tooling pro seedování databáze případů z fór

## Co aplikace umí

- vést diagnostický case nad konkrétním vozidlem
- ukládat pracovní session do Supabase
- hledat podobné uzavřené případy přes `search-cases`
- posílat uzavřené případy do znalostní databáze přes `push-case`
- sbírat zpětnou vazbu přes `send-feedback`

## Požadavky

- [Node.js](https://nodejs.org) 18+
- Supabase projekt s nasazenými Edge Functions
- pro forum crawlery navíc `DEEPSEEK_API_KEY`

## Vývoj webové aplikace

```bash
cd web
npm install
npm run dev
```

Web poběží na `http://localhost:5173`.

## Build webu

```bash
cd web
npm run build
```

Výstup je v `web/dist/`.

## Root testy

```bash
npm test
```

Root `package.json` obsahuje hlavně:
- unit testy katalogu, helperů a validace
- testy forum crawlerů
- import testy seedů

## Live Supabase testy

```powershell
Set-Location C:\GB

$env:TEST_SUPABASE_URL="https://TVUJ_PROJEKT.supabase.co"
$env:TEST_SUPABASE_ANON_KEY="TVUJ_ANON_KEY"
$env:TEST_USER_EMAIL="test-user@example.com"
$env:TEST_USER_PASSWORD="heslo"

& "$env:LOCALAPPDATA\Programs\nodejs\npm.cmd" run test:supabase:live
```

Aktuální live suite ověřuje:
- login test usera
- CRUD nad `gearbrain_web_sessions`
- že se VIN/SPZ neukládají do cloudu
- `push-case`
- `search-cases`
- `send-feedback`
- základní guard rails `deepseek-proxy`

## Seed pipeline

Každá značka má vlastní wrapper skript, například:
- `npm run forum:seed:vw`
- `npm run forum:seed:toyota`
- `npm run forum:seed:ford`
- `npm run forum:seed:peugeot`
- `npm run forum:seed:renault`
- `npm run forum:seed:audi`
- `npm run forum:seed:opel`
- `npm run forum:seed:bmw`
- `npm run forum:seed:seat`
- `npm run forum:seed:citroen`

Typický workflow:

1. discovery-only běh nad root fórem nebo kategoriemi
2. konzervativní `signals-only` běh s `--keep-review`
3. ruční kontrola `ready` a nejsilnější části `to_review`
4. import přes `seed:import:supabase`

Seed JSONy nově nesou i `thread_url`, takže jde každý nový case zpětně otevřít na původní vlákno.

## Batch runner pro více klubů naráz

Pro Citroën, BMW, Opel a SEAT je připravený sekvenční batch runner:

```powershell
Set-Location C:\GB
$stamp = Get-Date -Format yyyyMMdd_HHmmss

& "$env:LOCALAPPDATA\Programs\nodejs\npm.cmd" run forum:seed:batch -- `
  "seed_batch_clubs_titles_$stamp" `
  --discover-only --index-pages 999 --min-posts 2 --sleep-ms 400
```

První ostrý běh:

```powershell
Set-Location C:\GB
$env:DEEPSEEK_API_KEY="TVUJ_KLIC"
$stamp = Get-Date -Format yyyyMMdd_HHmmss

& "$env:LOCALAPPDATA\Programs\nodejs\npm.cmd" run forum:seed:batch -- `
  "seed_batch_clubs_full_$stamp" `
  --signals-only --keep-review --index-pages 999 --pages 3 --sleep-ms 400 --min-posts 2
```

Bez explicitních targetů bere:
- `https://www.citroen-club.cz/forum`
- `https://www.bmw-club.cz/forum`
- `https://www.club-opel.com/forum`
- `https://www.seatclub.cz/forum`

## Import seedů do Supabase

```powershell
Set-Location C:\GB
$stamp = Get-Date -Format yyyyMMdd_HHmmss

& "$env:LOCALAPPDATA\Programs\nodejs\npm.cmd" run seed:import:supabase -- `
  "C:\GB\seed_neco_ready" `
  --user-id "UUID_UZIVATELE_Z_auth.users" `
  --sleep-ms 200 `
  --out-dir "seed_import_supabase_$stamp"
```

## Produkční deploy

Vercel je navázaný na GitHub:
- push do `main` -> production deploy
- push do feature větve -> preview deploy

Ruční production deploy z lokálního stroje:

```powershell
Set-Location C:\GB\web
vercel --prod
```

## Důležité soubory

- web shell: [web/src/App.jsx](/C:/GB/web/src/App.jsx)
- katalog vozidel: [web/src/constants/catalog.js](/C:/GB/web/src/constants/catalog.js)
- web persistence: [web/src/lib/storage-sessions.js](/C:/GB/web/src/lib/storage-sessions.js)
- edge bridge: [web/src/lib/storage-edge.js](/C:/GB/web/src/lib/storage-edge.js)
- společný crawler základ: [scripts/forum-seed-club-root.mjs](/C:/GB/scripts/forum-seed-club-root.mjs)
- root/import validation helpery: [scripts/forum-seed.mjs](/C:/GB/scripts/forum-seed.mjs)

## Další dokumentace

- [handover.md](handover.md)
- [SUPABASE_SETUP.md](SUPABASE_SETUP.md)
- [SUPABASE_EDGE_FUNCTION.md](SUPABASE_EDGE_FUNCTION.md)
- [SUPABASE_GATEKEEPER.md](SUPABASE_GATEKEEPER.md)
