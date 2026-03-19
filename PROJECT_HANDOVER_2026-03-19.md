# Project Handover (2026-03-19)

Tento dokument doplňuje starší [GEARBRAIN_HANDOVER.md](/C:/GB/GEARBRAIN_HANDOVER.md).
Starší dokument je užitečný pro obecnou architekturu projektu, ale neobsahuje aktuální práci kolem forum seedingu, VW crawleru a review katalogů v `web/src/constants`.

## 1. Aktuální cíl projektu

Projekt se aktuálně posouvá od původní Ford-only varianty k širší automotive AI diagnostice:

- aplikace používá LLM + RAG
- cílem je seedovat počáteční databázi resolved case z automobilových fór
- matching musí být co nejpřesnější, protože seed má být malý, ale kvalitní
- katalog vozidel v `web/src/constants` je teď kritická část systému

## 2. Důležité soubory

- [package.json](/C:/GB/package.json)
- [scripts/forum-seed.mjs](/C:/GB/scripts/forum-seed.mjs)
- [scripts/forum-seed-vw.mjs](/C:/GB/scripts/forum-seed-vw.mjs)
- [tests/forum-seed.test.js](/C:/GB/tests/forum-seed.test.js)
- [tests/forum-seed-vw.test.js](/C:/GB/tests/forum-seed-vw.test.js)
- [web/src/constants/catalog.js](/C:/GB/web/src/constants/catalog.js)
- [web/src/constants/catalog-us.js](/C:/GB/web/src/constants/catalog-us.js)
- [web/src/constants/helpers.js](/C:/GB/web/src/constants/helpers.js)
- [web/src/constants/obd-codes.js](/C:/GB/web/src/constants/obd-codes.js)
- [web/src/constants/symptoms.js](/C:/GB/web/src/constants/symptoms.js)

## 3. Aktuální npm skripty

Z [package.json](/C:/GB/package.json):

- `npm run forum:seed`
- `npm run forum:seed:vw`
- `npm test`
- `npm run test:integration`

## 4. Seed pipeline

### Škoda fórum

Skript: [scripts/forum-seed.mjs](/C:/GB/scripts/forum-seed.mjs)

Účel:
- umí zpracovat jednotlivý thread, sekci i preset
- podporuje crawl sekcí a child sekcí
- defaultně používá evropský katalog
- čte celá vlákna
- z jednoho vlákna může vytvořit více seedů

Příklady:

```powershell
cd C:\GB
$env:DEEPSEEK_API_KEY="..."
npm.cmd run forum:seed -- "https://forum.skodahome.cz/topic/..." .\seed_out
```

```powershell
cd C:\GB
$env:DEEPSEEK_API_KEY="..."
npm.cmd run forum:seed -- --preset skoda-mega .\seed_skoda_mega --crawl --index-pages 100 --max-threads 10000 --sleep-ms 0
```

Env:
- `DEEPSEEK_API_KEY` required unless `--dry`
- `FORUM_COOKIE` optional

### VW fórum

Skript: [scripts/forum-seed-vw.mjs](/C:/GB/scripts/forum-seed-vw.mjs)

Účel:
- samostatný crawler pro odlišnou strukturu `vw-club.cz`
- umí model root fora a z nich listing vláken
- má heuristický filtr na nerelevantní témata
- cíl je odfiltrovat velkou část balastu typu bazar/pokec/tuning

Příklady:

```powershell
cd C:\GB
$env:DEEPSEEK_API_KEY="..."
npm.cmd run forum:seed:vw -- "https://www.vw-club.cz/golf-v-jetta/" .\seed_golf5 --index-pages 20 --max-threads 5000
```

```powershell
cd C:\GB
$env:DEEPSEEK_API_KEY="..."
npm.cmd run forum:seed:vw -- .\seed_vw --index-pages 100 --max-threads 50000
```

## 5. Co se při seedingu ukázalo jako problém

### Škoda fórum

- původně byl crawler moc přísný
- pak byl příliš vázaný na autora vlákna
- to bylo uvolněno na logiku `stejný uživatel popíše fault + stejné vlákno obsahuje jeho potvrzené řešení`
- z jednoho vlákna může vzniknout více case

### VW fórum

Na modelu `Golf V / Jetta` se ukázalo:

- zhruba po 153 vláknech nebyl žádný `ready` seed
- řada vláken už byla diagnosticky zajímavá, ale padala na canonical matchingu
- největší problém byl mix modelového kontextu typu `Golf V / Jetta` a slabé mapování `model_raw -> canonical model`

Závěr:
- forum heuristiky nejsou hlavní problém
- hlavní problém je kvalita a aktuálnost katalogů

## 6. Review constants databází

Byl udělán hlubší audit:

- [web/src/constants/catalog.js](/C:/GB/web/src/constants/catalog.js)
- [web/src/constants/catalog-us.js](/C:/GB/web/src/constants/catalog-us.js)
- [web/src/constants/helpers.js](/C:/GB/web/src/constants/helpers.js)
- [web/src/constants/obd-codes.js](/C:/GB/web/src/constants/obd-codes.js)
- [web/src/constants/symptoms.js](/C:/GB/web/src/constants/symptoms.js)

### Hlavní závěry

1. `Škoda Elroq` v katalogu chybí
2. `Superb` a `Kodiaq` jsou generačně zastaralé
3. `Octavia IV` je neúplná o elektrifikované varianty
4. `adblue` logika v [obd-codes.js](/C:/GB/web/src/constants/obd-codes.js) je příliš široká a prakticky označí skoro každý diesel
5. US značky se suffixem `(US)` nedostanou brand-specific OBD lookup kvůli exact matchi
6. katalog nemá per-record provenance, takže je těžké auditovat zdroje
7. výchozí export míchá EU a US katalog do jedné aktivní sady, což zhoršuje precision pro evropská fóra

### Důležitá poznámka

Tyto návrhy byly v review posuzovány jen tam, kde šly podložit konkrétními relevantními zdroji.
Neproběhla ještě úplná OEM verifikace všech značek a všech řádků v celém katalogu.

## 7. Co je doporučené opravit jako další krok

Priorita 1:

- doplnit `Elroq`
- rozdělit `Superb III / IV`
- rozdělit `Kodiaq I / II`
- doplnit `Octavia IV` o `iV` / `e-TEC` / faceliftové varianty
- opravit `adblue` detekci
- přidat OBD canonical lookup pro US značky

Priorita 2:

- oddělit explicitně EU a US katalog při lookupu
- zavést provenance/source metadata pro katalog
- pak teprve rozšiřovat další značky

## 8. Co znamená canonical lookup pro OBD

Problém:

- katalog má značky jako `Ford (US)` nebo `Volkswagen (US)`
- `BRAND_OBD_CODES` má klíče jen `Ford`, `Volkswagen`, `Toyota`, ...
- exact lookup proto pro `(US)` varianty vrací prázdno

Navržený fix:

```js
const BRAND_CANONICAL_FOR_OBD = {
  "Ford (US)": "Ford",
  "Toyota (US)": "Toyota",
  "Nissan (US)": "Nissan",
  "Hyundai (US)": "Hyundai",
  "Kia (US)": "Kia",
  "Volkswagen (US)": "Volkswagen",
}
```

a v `getObdCodes()`:

```js
const obdBrand = BRAND_CANONICAL_FOR_OBD[brand] ?? brand
const brandCodes = BRAND_OBD_CODES[obdBrand] ?? []
```

To není alias pro celý katalog, jen pro OBD vrstvu.

## 9. Testy

Aktuálně funguje:

```powershell
cd C:\GB
npm.cmd test
```

Test suite zahrnuje i:

- [tests/forum-seed.test.js](/C:/GB/tests/forum-seed.test.js)
- [tests/forum-seed-vw.test.js](/C:/GB/tests/forum-seed-vw.test.js)

## 10. Důležité env proměnné

- `DEEPSEEK_API_KEY`
- `FORUM_COOKIE` volitelně pro fórum scraping

Poznámka:
- v projektu jsou i Supabase edge funkce, které také používají `DEEPSEEK_API_KEY`

## 11. Složky vzniklé během experimentů

V rootu repa jsou i výstupní složky z běhů:

- `seed_golf5`
- `seed_motor_relaxed`
- `seed_skoda_mega`
- `seed_skoda_mega_v2`
- `seed_vw_dry`

Jsou užitečné jako ukázka výstupu/debug artefakty, ale nejsou to zdrojové soubory aplikace.

## 12. Doporučený restart práce na jiném počítači

1. přenést nebo naklonovat celé repo `C:\GB`
2. otevřít repo v Codexu
3. nastavit `DEEPSEEK_API_KEY`
4. spustit:

```powershell
cd C:\GB
npm.cmd test
```

5. jako první pokračovat v opravě:
- [web/src/constants/catalog.js](/C:/GB/web/src/constants/catalog.js)
- [web/src/constants/obd-codes.js](/C:/GB/web/src/constants/obd-codes.js)

## 13. Nejbližší doporučený krok

Pokračovat patchem pro:

1. `catalog.js`
2. `obd-codes.js`
3. až potom znovu pustit VW a Škoda seed skripty na větším vzorku

## 14. Externí zdroje použité při posledním review

- https://www.skoda-storyboard.com/en/press-releases/skoda-releases-the-first-silhouette-of-the-all-new-battery-electric-elroq/
- https://www.skoda-storyboard.com/en/press-kits/skoda-elroq-press-kit/batteries-and-powertrains-long-range-and-reduced-charging-times-for-an-even-better-customer-experience/
- https://www.skoda-storyboard.com/en/press-releases/skoda-launches-all-new-superb-production-in-bratislava/
- https://www.skoda-storyboard.com/en/press-kits/all-new-skoda-superb-world-premiere-press-kit/powertrains-six-engine-variants-premiere-of-mild-hybrid-technology-and-improved-plug-in-hybrid-drive/
- https://www.skoda-storyboard.com/en/press-releases/world-premiere-of-the-all-new-skoda-kodiaq-pictures-on-the-skoda-storyboard/
- https://www.skoda-storyboard.com/en/press-kits/the-all-new-skoda-kodiaq-press-kit/powertrains-introducing-hybrid-technology-with-more-than-100-km-of-electric-range-to-skodas-suv-portfolio/
- https://www.skoda-storyboard.com/en/press-kits/skoda-kodiaq-press-kit/kodiaq-rs-sports-variant-offers-even-more-dynamic-performance-in-its-second-generation/
- https://www.skoda-storyboard.com/en/press-releases/skoda-octavia-rs-iv-sustainable-yet-sporty/
- https://cdn.skoda-storyboard.com/2024/02/04_Press_Kit_Skoda_Octavia_WP_Powertrains_e134b548.pdf
- https://www.volkswagen-newsroom.com/en/vehicle-data-golf-7-variant-profile-20042
