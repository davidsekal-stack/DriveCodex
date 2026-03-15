# GearBrain – AI Diagnostika Ford Transit EU

Webová aplikace pro AI diagnostiku poruch Ford Transit. Kombinuje symptomy, OBD kódy a popis mechanika s AI analýzou (Claude) a databází ověřených oprav (RAG).

## Požadavky

- [Node.js](https://nodejs.org) verze 18+
- Supabase projekt (viz [SUPABASE_SETUP.md](SUPABASE_SETUP.md))

## Spuštění (vývoj)

```bash
cd web
npm install
npm run dev
```

Aplikace poběží na `http://localhost:5173`.

## Build

```bash
cd web
npm run build
```

Výstup: `web/dist/` — statické soubory připravené k nasazení.

## Deployment

Aplikace je nasazena na **Vercel** s automatickým deploy z GitHub:
- Push do `main` → production deploy
- Push do feature branch → preview deploy

## Testy

```bash
npm test
```

## Struktura projektu

```
gearbrain/
├── web/                    ← Webová aplikace (React + Vite)
│   ├── src/
│   │   ├── App.jsx         ← Hlavní komponenta
│   │   ├── components/     ← UI komponenty
│   │   ├── hooks/          ← React hooks
│   │   ├── lib/            ← AI, validace, storage, utils
│   │   ├── i18n/           ← Lokalizace (CS/EN/DE)
│   │   └── constants/      ← Katalog vozidel, symptomy
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── supabase/               ← Edge Functions + DB migrace
│   ├── functions/
│   │   ├── anthropic-proxy/ ← Claude API proxy
│   │   ├── push-case/       ← Uložení případu do RAG
│   │   └── search-cases/    ← Vyhledání podobných případů
│   └── migrations/
├── tests/                  ← Unit testy
└── package.json            ← Root (testy)
```

## Dokumentace

- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) — nastavení Supabase projektu
- [SUPABASE_EDGE_FUNCTION.md](SUPABASE_EDGE_FUNCTION.md) — Edge Functions
- [SUPABASE_GATEKEEPER.md](SUPABASE_GATEKEEPER.md) — RLS a bezpečnost
