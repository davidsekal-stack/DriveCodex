# NHTSA Supercrawler Spec

## Cíl

Vytvořit plně automatizovaný pipeline pro zpracování NHTSA TSB souborů, který:

- vezme jako vstup jednu složku se souborem nebo více soubory `TSBS_RECEIVED_*.txt`
- projede soubor po souboru
- uvnitř každého souboru pojede značku po značce
- použije parser jen jako hrubý filtr
- použije AI review a následně 2 nezávislé Codex review kroky
- do Supabase pustí jen high-confidence subset
- průběžně ukládá auditní artefakty, stav a rozhodnutí
- umí iterativně zpřísnit filtr/postup, pokud je kandidátní sada moc špinavá

Primární priorita:

- neznehodnotit databázi špatnými nebo slabými případy

Sekundární priorita:

- minimalizovat potřebu lidského vstupu

## Shrnutí navrženého workflow

Pro každou značku v každém souboru:

1. Hrubé roztřídění a načtení struktury
2. Druhé, detailnější roztřídění podle zjištěných patternů
3. AI DeepSeek review
4. Codex review `ready` a `to_review`, včetně katalogové validace a doplnění chybějících modelů
5. Nezávislá Codex validace finální import sady
6. Dry import
7. Live import do Supabase

Import se provede pouze tehdy, když:

- DeepSeek krok proběhne bez chyb
- Codex reviewer neoznačí kritické problémy
- nezávislý Codex validator potvrdí, že subset splňuje import pravidla
- dry import projde `100%`

## Technická hranice: co je čistý skript a co je agentická vrstva

### Čistě skriptem jde řešit

- načtení všech NHTSA souborů ze složky
- deduplikace, grouping, coarse filtering
- pattern-level refined filtering
- spuštění DeepSeek review
- generování review sheetů a auditních JSON/CSV/MD souborů
- finální formální validace
- dry/live import do Supabase
- checkpointing a resume

### Agentickou vrstvu je vhodné použít na

- Codex review `ready` a `to_review`
- nezávislý druhý Codex pass, který se chová jako gatekeeper
- rozhodnutí nad borderline případy
- případné bezpečné rozšíření katalogu po ověření z více zdrojů

Důležité:

- čistý Node skript sám o sobě neumí "spustit Codex agenta" bez okolní agentické runtime vrstvy
- proto je potřeba rozdělit systém na:
  - `orchestrator script`
  - `Codex runner layer`

## Navržená architektura

### 1. Orchestrátor

Nový hlavní skript:

- `C:\GB\scripts\nhtsa-supercrawler.mjs`

Jeho odpovědnost:

- najít vstupní soubory ve zvolené složce
- pro každý soubor sestavit seznam automotive značek
- přeskočit již uzavřené značky
- pouštět jednotlivé kroky ve správném pořadí
- ukládat stav do manifestů
- nikdy nespouštět live import bez všech gate checků

### 2. Stavový manifest

Pro každý soubor:

- `C:\GB\tmp\nhtsa_runs\<file_key>\run_manifest.json`

Pro každou značku:

- `C:\GB\tmp\nhtsa_runs\<file_key>\<brand_key>\brand_manifest.json`

Navržené stavy:

- `discovered`
- `coarse_done`
- `refined_done`
- `deepseek_done`
- `codex_review_done`
- `codex_verify_done`
- `dry_import_done`
- `live_import_done`
- `blocked`
- `rejected`

Každý manifest by měl obsahovat:

- vstupní soubor
- značku
- timestampy
- použité outdir
- počty `ready / to_review / discarded`
- odkazy na review artefakty
- import logy
- finální verdict

### Výsledek reviewer/validator kroku

Aby se orchestrátor obešel bez ručního lepení stavů, reviewer a validator mají zapisovat explicitní result markery:

- `C:\GB\tmp\nhtsa_runs\<file_key>\<brand_key>\05_codex_review\review_result.json`
- `C:\GB\tmp\nhtsa_runs\<file_key>\<brand_key>\06_codex_validate\validate_result.json`

Navržený tvar `review_result.json`:

```json
{
  "status": "approved",
  "final_subset_dir": "C:\\GB\\tmp\\nhtsa_runs\\...\\07_final_subset",
  "manual_review_path": "C:\\GB\\tmp\\nhtsa_runs\\...\\07_final_subset\\MANUAL_REVIEW.md",
  "ready_count": 123,
  "rejected_count": 57,
  "reviewed_at": "2026-04-05T10:00:00.000Z"
}
```

Navržený tvar `validate_result.json`:

```json
{
  "status": "approved",
  "notes": "Subset passed independent Codex gatekeeper review.",
  "validated_at": "2026-04-05T10:30:00.000Z"
}
```

Povolené `status`:

- `approved`
- `rejected`
- `blocked`

### 3. Brand workspace layout

Pro jednu značku:

`C:\GB\tmp\nhtsa_runs\<file_key>\<brand_key>\`

Navržené podsložky:

- `01_coarse`
- `02_refined`
- `03_deepseek_review`
- `04_codex_review`
- `05_codex_verify`
- `06_final_subset`
- `07_import_dry`
- `08_import_live`

To usnadní:

- resume
- audit
- debugging
- možnost pustit jen konkrétní krok znovu

## Detail jednotlivých kroků

### Krok 1: Hrubé roztřídění

Použít existující:

- `C:\GB\scripts\tsb-seed-nhtsa.mjs`

Úkol:

- načíst TSV
- seskupit duplicity
- odfiltrovat zjevný balast
- provést základní mapování na katalog
- vyrobit:
  - `ready`
  - `to_review`
  - `discarded`

Poznámka:

- tohle je jen coarse filter
- nic z toho se ještě nesmí importovat

### Krok 2: Druhé detailnější třídění

Navržený nový skript:

- `C:\GB\scripts\nhtsa-refine-pass.mjs`

Úkol:

- analyzovat coarse `ready` a `to_review`
- dělat pattern-level pruning
- agresivně odhazovat:
  - NVH
  - trim/interior
  - maintenance-like případy
  - generic software updates bez silného symptomu
  - conditional diagnose trees
- priorizovat:
  - DTC/MIL
  - no start / stall
  - reduced propulsion
  - braking / ABS / steering / PTU / transmission
  - leaks / overheating / charging / inoperative systems

Výstup:

- menší a kvalitnější kandidátní sada pro DeepSeek

### Krok 3: AI DeepSeek krok

Použít existující:

- `C:\GB\scripts\tsb-review-nhtsa-ai.mjs`
- `C:\GB\scripts\tsb-second-pass-nhtsa-ai.mjs`
- `C:\GB\scripts\tsb-reuse-nhtsa-review.mjs`

Doporučený režim:

1. first pass nad refined `ready`
2. second pass nad accepted
3. reuse decision logů tam, kde už existují

Výstup:

- `accepted`
- `to_review`
- `rejected`

Pravidla:

- symptom tagy musí být krátké
- redundantní `DTC ...` symptom tagy se mají odstranit
- second pass musí být přísnější než first pass

### Krok 4: Codex review `ready` a `to_review`

Tady už vstupuje agentická vrstva.

Navržený Codex reviewer:

- čte:
  - accepted subset z DeepSeek
  - `to_review`
  - raw `summary_raw`
  - `source_ref`
  - mapped model
- rozhoduje case-by-case, ne jen pattern-level

Úkol revieweru:

- projít finální kandidáty individuálně
- odhodit slabé software-only, comfort, nuisance a conditional cases
- u borderline případů upravit symptom tagy / description / resolution
- ověřit, že mapping na katalog není podezřelý
- identifikovat chybějící nebo špatně mapované modely
- pokud je to potřeba:
  - ověřit model z více oficiálních zdrojů
  - rozhodnout správný market `EU vs US`
  - připravit bezpečné doplnění do katalogu
  - seed po doplnění katalogu znovu zvalidovat
- vytvořit:
  - `MANUAL_REVIEW.md`
  - `review_decisions.csv`
  - finální `ready`
  - `rejected_ready`
  - případně `promoted_from_review`

Tento krok může běžet:

- jako Codex automation run
- nebo jako parent Codex task, který obsluhuje jednu značku po druhé

### Katalogová validace patří do prvního Codex review

Tohle je závazné pravidlo:

- podezřelý mapping na katalog se nesmí nechávat až na gatekeepera
- musí se řešit už v prvním Codex review kroku

Reviewer tedy dělá nejen obsahové review seedů, ale i:

- kontrolu katalogového mappingu
- doplnění validních chybějících modelů do katalogu
- opravu špatně resolved modelů

Gatekeeper už katalog nerozšiřuje.

Gatekeeper pouze:

- ověřuje, že finální subset už katalogově sedí
- a že reviewer nepustil dál chybný mapping

### Krok 5: Nezávislé ověření druhým Codex agentem

Tohle má fungovat jako gatekeeper.

Vstup:

- finální subset z kroku 4
- explicitní checklist, co musí seed splňovat

Checklist pro validator:

- je seed relevantní pro diagnostiku?
- má jasný symptom?
- má jasné uzavřené řešení?
- není to jen service update / guideline / noise bulletin?
- nejsou symptom tagy moc dlouhé?
- nejsou redundantní vůči `obd_codes`?
- není mapping na katalog podezřelý?
- není case conditional?
- není to duplicitní semantic variant?

Validator nesmí seed přepisovat.

Má jen:

- `approve`
- `reject`
- `flag`

Live import se povolí jen když:

- validator nemá otevřený `reject`

Poznámka:

- pokud validator najde podezřelý katalogový mapping, vrací subset zpět reviewer vrstvě
- katalogová oprava ale patří revieweru, ne validatoru

Technicky:

- tohle je ideální kandidát na samostatný Codex sub-agent nebo oddělený automation run
- role reviewer a validator mají být oddělené

## Import vrstva

Použít existující:

- `C:\GB\scripts\import-seeds-to-supabase.mjs`
- `C:\GB\scripts\nhtsa-validate-final-subset.mjs`

Režim:

1. nezávislá deterministická validace finálního subsetu
2. dry import
3. pokud `Success == Total` a nejsou gate violations, teprve live import

Povinné podmínky před live importem:

- `duplicateRows == 0`
- `longSymptomTags == 0`
- `redundantDtcSymptomHits == 0`
- žádné known bad mappingy
- validator verdict `approved`

## Rozšíření katalogu

Rozšíření katalogu nesmí být automatické bez evidence.

Navržený režim:

- pokud coarse/refined krok narazí na unresolved model s vysokým potenciálem
- vytvoří `catalog_gap.json`
- Codex reviewer dostane úkol:
  - ověřit model z více oficiálních zdrojů
  - rozhodnout EU vs US
  - navrhnout konkrétní katalogový zápis
  - případně ho rovnou připravit v kódu
- až po doplnění katalogu a opětovné validaci se seed může dostat do finální `ready` sady
- katalog se pak přidá do:
  - `C:\GB\web\src\constants\catalog.js`
  - nebo `C:\GB\web\src\constants\catalog-us.js`

Nepřidávat automaticky:

- truck/commercial-only značky
- pre-2000 legacy balast
- fleet trim názvy bez bezpečného mappingu

## Iterační smyčka při špinavém setu

Pipeline nesmí být rigidní ve stylu:

- coarse
- DeepSeek
- Codex
- import

V některých případech bude refined nebo DeepSeek kandidátní sada pořád moc špinavá.

Typické signály:

- příliš nízký accept rate
- příliš mnoho obvious false positives v first-pass review
- vysoký podíl NVH / comfort / software-only bulletinů
- opakované katalogové chyby
- vysoká koncentrace weak patternů v jedné značce

V takové chvíli má vstoupit Codex ještě před dalším review kolem a:

- analyzovat, proč je set špinavý
- upravit filtr / heuristiky / mapping / pattern rules
- případně upravit skript
- přegenerovat refined subset
- znovu použít předchozí review decisions tam, kde to jde
- a až potom pustit další AI krok

Správný workflow je tedy:

1. coarse
2. refine
3. vyhodnocení čistoty setu
4. když je set moc špinavý:
   - Codex upraví skript/postup
   - rerun refine
   - reuse předchozích rozhodnutí
5. teprve potom DeepSeek / second-pass / Codex review

Do manifestu se má zapisovat:

- `iteration_count`
- `why_refined_again`
- `reused_decisions_count`
- `refined_from_previous_run`

## Jak by to běželo bez lidského inputu

### Varianta A: čistý lokální orchestrátor + Codex automation

Nejrealističtější varianta.

Flow:

1. `nhtsa-supercrawler.mjs` připraví coarse/refined/DeepSeek artefakty
2. zapíše job manifest pro Codex review
3. Codex automation vezme job, provede reviewer krok
4. druhá Codex automation vezme finální subset a provede gatekeeper validaci
5. orchestrátor po potvrzení pustí dry/live import

Výhoda:

- oddělení rolí
- lepší audit
- minimální lidský zásah

### Automatizace a bezpečný režim

Automatizace nesmí běžet přímo nad hlavním repem, kde se dělá jiná práce.

Bezpečný režim automatizace:

- běží jen v separátním workspace
  - `C:\GB-nhtsa`
- běží jen na separátní branchi
  - `codex/nhtsa-automation`
- nikdy přímo nepushuje do `main`
- do `main` se změny dostanou až:
  - ručním mergem
  - nebo přes PR / draft PR

Automatizace má dělat jen toto:

- zkontrolovat backlog
- navázat na rozpracovaný soubor / značku
- spustit další bezpečný krok pipeline
- zapsat stav do manifestu
- případně commitnout relevantní source změny jen do automation branch

Automatizace nesmí dělat:

- direct push do `main`
- commit `tmp`, `seed_*`, import logů nebo jiných artefaktů
- spouštět duplicitní běh nad stejným brandem
- běžet dál „na prázdno“, když není co zpracovávat

### Guard pravidla pro automatizaci

Před každým během musí automatizace udělat:

1. zkontrolovat, jestli neběží jiný aktivní run
2. zkontrolovat lock file / running process
3. zkontrolovat, jestli existuje neuzavřený backlog
4. zkontrolovat, jestli je workspace čistý nebo změny odpovídají jen automation branch práci

Pokud je některá z těchto podmínek false:

- automatizace nic nového nespustí
- jen zapíše stav a skončí

### Locking

Navržený lock soubor:

- `C:\GB-nhtsa\tmp\nhtsa_runs\automation.lock.json`

Obsah:

- `run_id`
- `started_at`
- `file_key`
- `brand_key`
- `active_step`
- `pid` pokud existuje child process

Pravidlo:

- pokud lock existuje a běh je stále živý, další automation run se okamžitě ukončí
- pokud lock existuje, ale proces už neběží, automation může provést recovery nebo lock označit jako stale

### Kdy se má automatizace sama zastavit

Automatizace nemá běžet donekonečna bez práce.

Má přejít do `done/idle` režimu, pokud:

- ve vstupní složce nejsou další neuzavřené soubory
- v aktuálním souboru nejsou další neuzavřené automotive značky
- nejsou otevřené catalog gap tasky
- nejsou otevřené blocked runy čekající na retry nebo zásah

To znamená:

- další scheduled run jen ověří stav
- a pokud backlog zůstává prázdný, nic neudělá

### Doporučené chování při source změnách

Pokud automation run upraví zdrojový kód:

- commitne jen whitelist source souborů
- například:
  - `scripts/*.mjs`
  - `tests/*.js`
  - `web/src/constants/catalog*.js`
  - `NHTSA_STATUS.md`
  - `HANDOVER.md`
- nikdy necommitne:
  - `tmp/*`
  - `seed_*`
  - `seed_import_*`
  - review output adresáře
  - runtime locky a manifest logy, pokud nejsou explicitně určeny k verzování

### Doporučení k rollout režimu

První produkční verze automation workflow by měla běžet takto:

- automation branch only
- no direct main push
- no auto-merge
- maximálně draft PR nebo připravený commit na automation branch

Teprve po ověření stability má smysl zvažovat agresivnější režim.

### Varianta B: jeden parent Codex task

Jedna dlouho běžící agentická úloha:

- pouští skripty
- sama reviewuje
- sama spouští validator sub-agent
- sama importuje

Výhoda:

- jednodušší start

Nevýhoda:

- větší riziko dlouhého kontextu
- horší resume
- horší auditovatelnost

### Doporučení

Preferovat variantu A.

## Navržené nové soubory

- `C:\GB\scripts\nhtsa-supercrawler.mjs`
- `C:\GB\scripts\nhtsa-refine-pass.mjs`
- `C:\GB\scripts\nhtsa-validate-final-subset.mjs`
- `C:\GB\tests\nhtsa-supercrawler.test.js`
- `C:\GB\tests\nhtsa-refine-pass.test.js`
- `C:\GB\NHTSA_SUPERCRAWLER_STATUS.md`

Volitelně:

- `C:\GB\scripts\nhtsa-build-codex-job.mjs`
- `C:\GB\scripts\nhtsa-collect-codex-results.mjs`

## Safety pravidla

Pipeline musí failnout nebo přejít do `blocked`, pokud:

- běží jiný aktivní import pro stejný brand/file
- subset obsahuje prázdné review artefakty
- dry import neprojde `100%`
- validator vrátí `reject`
- mapping na katalog je podezřelý
- symptomy jsou verbose
- je detekována duplicate canonical skupina

## Aktuálně implementované skripty

První implementační vlna už reálně existuje v repu:

- `C:\GB\scripts\nhtsa-supercrawler.mjs`
- `C:\GB\scripts\nhtsa-refine-pass.mjs`
- `C:\GB\scripts\nhtsa-validate-final-subset.mjs`

Co umí už teď:

- discovery vstupních NHTSA souborů
- file/brand manifesty
- lock file a branch safety guard
- coarse -> refine -> DeepSeek -> second pass
- vytvoření Codex review jobů
- převzetí `review_result.json`
- převzetí `validate_result.json`
- deterministickou finální validaci subsetu
- dry import
- volitelně live import

Co stále zůstává mimo čistý Node orchestrátor:

- samotné Codex reviewer rozhodování
- nezávislé Codex gatekeeper rozhodování
- bezpečné katalogové doplnění po vícezdrojovém ověření

## Minimální implementační plán

### Fáze 1

- vytvořit `nhtsa-supercrawler.mjs`
- zadrátovat kroky 1, 2, 3 a 6
- zavést manifesty a folder layout

### Fáze 2

- přidat Codex reviewer integration
- generovat `MANUAL_REVIEW.md` a `review_decisions.csv`
- přidat katalog gap workflow přímo do reviewer kroku
- přidat iterativní refine loop

### Fáze 3

- přidat nezávislý validator agent
- udělat live-import gate

### Fáze 4

- přidat safe katalog gap workflow
- automatické pokračování file-by-file, brand-by-brand

## Praktický závěr

Ano, tenhle "supercrawler" jde technicky postavit.

Ne jako jeden parser skript, ale jako:

- orchestrátor nad existujícími NHTSA skripty
- s checkpointy a manifesty
- s DeepSeek review
- s Codex reviewer krokem
- s druhým nezávislým Codex validator krokem
- a s tvrdými import gate podmínkami

To je realistická cesta, jak:

- odstranit potřebu tvého průběžného inputu
- zachovat vysokou kvalitu
- a nepoškodit DB špatnými seedy
