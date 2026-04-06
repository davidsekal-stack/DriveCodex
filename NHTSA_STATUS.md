# NHTSA TSB Status

## Automation Checkpoint

Aktualizováno: 2026-04-06

Tento checkpoint je pro automation workspace [C:\GB-nhtsa](/C:/GB-nhtsa).

Pravidlo:
- Neredo brandy, které jsou níže označené jako `imported clean`.
- Pokud existuje rozdělaný brand artifact v [C:\GB-nhtsa\tmp](/C:/GB-nhtsa/tmp), navazuj na něj přednostně.
- Aktuální rozdělaný brand k navázání je `Volkswagen`.

### TSBS_RECEIVED_2020-2024.txt checkpoint

Source file:
- [C:\Users\sekald\Downloads\TSBS_RECEIVED_2020-2024\TSBS_RECEIVED_2020-2024.txt](/C:/Users/sekald/Downloads/TSBS_RECEIVED_2020-2024/TSBS_RECEIVED_2020-2024.txt)

Clean imported brands already completed in the manual stream:
- `Lincoln` `139`
- `Genesis` `46`
- `Infiniti` `30`
- `Audi` `25`
- `Tesla` `4`
- `Honda` `19`
- `Acura` `5`
- `Volvo` `24`
- `Kia` `29`
- `Mazda` `14`
- `Toyota` `1`
- `Hyundai` `36`
- `Chevrolet` `83`
- `GMC` `52`
- `Ford` `55`
- `Jeep` `101`
- `Polestar` `2`
- `Dodge` `25`
- `Cadillac` `49`
- `Chrysler` `17`
- `Nissan (US)` `23`
- `Mercedes-Benz` `10`

Current imported lower bound from this file:
- `789`

Processed but not imported:
- `Lexus` `0 safe`

Current in-progress handoff copied into this workspace:
- coarse subset: [C:\GB-nhtsa\tmp\nhtsa_2020_2024_volkswagen_subset_20260405](/C:/GB-nhtsa/tmp/nhtsa_2020_2024_volkswagen_subset_20260405)
- first-pass AI output: [C:\GB-nhtsa\tmp\nhtsa_2020_2024_volkswagen_ready_ai_reviewed_20260406](/C:/GB-nhtsa/tmp/nhtsa_2020_2024_volkswagen_ready_ai_reviewed_20260406)

Next preferred queue after Volkswagen:
- `Buick`
- `Subaru`
- `Ram`
- `Mitsubishi`
- `Alfa Romeo`
- `Bentley`
- `Porsche`

Aktualizováno: 2026-04-02

## Scope note

- The raw 2025-2026 NHTSA file contains `240` unique makes.
- The current GearBrain NHTSA pipeline covers `43` catalog-supported makes.
- The remaining `197` unsupported makes are a mix of non-automotive entries (buses, RVs, trailers, components, motorcycles) and additional automotive makes not yet added to our catalog.
- This status file therefore describes the **currently supported automotive slice**, not the entire raw file universe.

## Rule of operation

- `scripts/tsb-seed-nhtsa.mjs` is only a coarse filter.
- Nothing from NHTSA goes to Supabase unless it passes individual AI review.
- Any AI-accepted edge cases still require manual sanity review before import.
- If a bad NHTSA batch slips into Supabase, delete the whole affected date window and rebuild from individually reviewed seeds.

## Clean imports completed

These NHTSA subsets were individually AI-reviewed and then manually checked before import.

- `Jeep`: `174`
- `Ford (US)`: `32`
- `Chevrolet`: `21`
- `GMC`: `20`
- `Cadillac`: `20`
- `Dodge`: `40`
- `Nissan (US)`: `13`
- `Chrysler`: `13`
- `Subaru`: `13`
- `Kia (US)`: `11`
- `Lincoln`: `9`
- `Infiniti`: `11`
- `Genesis`: `9`
- `Alfa Romeo`: `9`
- `Mazda`: `6`
- `Buick`: `8`
- `Honda`: `7`
- `Hyundai (US)`: `6`
- `Tesla (US)`: `6`
- `Lexus`: `5`
- `Volvo`: `4`
- `Bentley`: `4`
- `Mercedes-Benz`: `3`
- `MINI`: `1`
- `Polestar`: `1`
- `Porsche`: `2`
- `Ram`: `2`
- `Volkswagen (US)`: `2`
- `Mitsubishi`: `2`

Current clean imported total from reviewed NHTSA subsets:
- `454`

## Processed but not imported

These supported makes were processed through the parser and individually AI-reviewed where needed, but do not currently have a safe subset worth importing.

- `Toyota (US)`: no clean accepted subset after review
- `Acura`: no clean accepted subset
- `Fiat`: no clean accepted subset
- `Maserati`: no clean accepted subset
- `Jaguar`: full tail AI review yielded no safe subset
- `Land Rover`: full tail AI review yielded no safe subset
- `Lucid`: full tail AI review yielded no safe subset

## Tail brands closed by full AI review

These brands were fully closed out after individual AI review of the remaining parser candidates:

- `Lexus`: full tail review of `1151` candidates yielded `5` safe imports
- `Jaguar`: full tail review yielded `0` safe imports
- `Land Rover`: full tail review yielded `0` safe imports
- `MINI`: full tail review yielded `1` safe import
- `Rivian`: full tail review yielded `2` safe imports
- `Lucid`: full tail review yielded `0` safe imports

## Important review artifacts

- Initial individually reviewed rebuild:
  - [C:\GB\tmp\nhtsa_reimport_reviewed_20260328_individual](C:/GB/tmp/nhtsa_reimport_reviewed_20260328_individual)
- Lexus final reviewed subset:
  - [C:\GB\tmp\nhtsa_tsb_lexus_us_final_20260328](C:/GB/tmp/nhtsa_tsb_lexus_us_final_20260328)
- MINI/Rivian final reviewed subset:
  - [C:\GB\tmp\nhtsa_tail_small_final_20260328](C:/GB/tmp/nhtsa_tail_small_final_20260328)
- Latest live import log for Lexus + MINI/Rivian tail:
  - [C:\GB\seed_import_supabase_nhtsa_lexus_tail_live_20260328\results.jsonl](C:/GB/seed_import_supabase_nhtsa_lexus_tail_live_20260328/results.jsonl)

## TSBS_RECEIVED_2025-2025.txt progress

Source file:
- [C:\Users\sekald\Downloads\TSBS_RECEIVED_2025-2025\TSBS_RECEIVED_2025-2025.txt](C:/Users/sekald/Downloads/TSBS_RECEIVED_2025-2025/TSBS_RECEIVED_2025-2025.txt)

Current clean imported total from this file:
- `at least 1027` unique cases

Note:
- The previous verified lower bound was `764`.
- The fully reviewed Mercedes pass added `185/185` clean imports.
- The follow-up unsupported-make block added `64/64` reviewed `Mercedes-Maybach` cases plus the earlier small safe block `Maybach 2`, `Mercedes alias 6`, `Smart 6`.
- The final legacy mainstream unsupported block (`Pontiac + Saturn + Saab`) was individually AI-reviewed on 2026-04-02 and yielded `0` safe imports.
- The detailed per-brand breakdown below has not yet been fully recomputed after the March 31 cleanup/reimport passes, so treat it as a lower-fidelity snapshot except where explicitly updated.

Current imported breakdown:
- `Jeep` `121`
- `Ford (US)` `102`
- `Mazda` `84`
- `Cadillac` `65`
- `Dodge` `62`
- `GMC` `58`
- `Kia (US)` `31`
- `Bentley` `27`
- `Genesis` `25`
- `Alfa Romeo` `25`
- `Lincoln` `25`
- `Hyundai (US)` `24`
- `Honda` `21`
- `Chrysler` `15`
- `Nissan (US)` `10`
- `Lexus` `9`
- `Infiniti` `8`
- `Toyota (US)` `6`
- `Ram` `6`
- `Polestar` `4`
- `Mitsubishi` `3`
- `Tesla (US)` `1`
- `Volvo` `32`
- `Mercedes-Benz` `255`
- `Maybach` `2`
- `Smart` `6`

## TSBS_RECEIVED_2020-2024.txt progress

Source file:
- [C:\Users\sekald\Downloads\TSBS_RECEIVED_2020-2024\TSBS_RECEIVED_2020-2024.txt](C:/Users/sekald/Downloads/TSBS_RECEIVED_2020-2024/TSBS_RECEIVED_2020-2024.txt)

Current clean imported total from this file:
- `242` unique cases

Imported breakdown so far:
- `Lincoln` `139`
- `Genesis` `46`
- `Infiniti` `30`
- `Audi` `25`
- `Polestar` `2`

Notes:
- `Lincoln` required a second stricter AI pass over the already AI-reviewed set; first-pass `368 accepted` was reduced to a final safe subset `139`.
- `Genesis` was individually reviewed and reduced to `46` clean imports after rejecting ICCU conditional repair trees and weak comfort/software cases.
- `Infiniti` needed a catalog expansion for legacy `G/M/QX` rows before the final second-pass safe subset could be closed; final import is `30`.
- `Audi` coarse parser output was highly inflated (`210 ready`, `100829 to_review`), but a ready-only AI pass plus strict second pass reduced it to a clean `25`.
- `Polestar` yielded only `2` safe imports after full individual AI review.
- `Lexus` still has a coarse subset prepared, but has not yet been closed into a final safe import subset for this file.

Review artifacts:
- Lincoln final reviewed subset: [C:\GB\tmp\nhtsa_2020_2024_lincoln_reviewed_final_20260402](C:/GB/tmp/nhtsa_2020_2024_lincoln_reviewed_final_20260402)
- Lincoln audit: [C:\GB\tmp\nhtsa_2020_2024_lincoln_reviewed_final_20260402\MANUAL_REVIEW.md](C:/GB/tmp/nhtsa_2020_2024_lincoln_reviewed_final_20260402/MANUAL_REVIEW.md)
- Lincoln dry import: [C:\GB\tmp\nhtsa_2020_2024_lincoln_dry_20260402\results.jsonl](C:/GB/tmp/nhtsa_2020_2024_lincoln_dry_20260402/results.jsonl)
- Lincoln live import: [C:\GB\seed_import_supabase_nhtsa_2020_2024_lincoln_live_20260402\results.jsonl](C:/GB/seed_import_supabase_nhtsa_2020_2024_lincoln_live_20260402/results.jsonl)
- Genesis final reviewed subset: [C:\GB\tmp\nhtsa_2020_2024_genesis_reviewed_final_20260402](C:/GB/tmp/nhtsa_2020_2024_genesis_reviewed_final_20260402)
- Polestar final reviewed subset: [C:\GB\tmp\nhtsa_2020_2024_polestar_reviewed_final_20260402](C:/GB/tmp/nhtsa_2020_2024_polestar_reviewed_final_20260402)
- Infiniti final reviewed subset: [C:\GB\tmp\nhtsa_2020_2024_infiniti_second_pass_20260403](C:/GB/tmp/nhtsa_2020_2024_infiniti_second_pass_20260403)
- Infiniti audit: [C:\GB\tmp\nhtsa_2020_2024_infiniti_second_pass_20260403\MANUAL_REVIEW.md](C:/GB/tmp/nhtsa_2020_2024_infiniti_second_pass_20260403/MANUAL_REVIEW.md)
- Infiniti dry import: [C:\GB\tmp\nhtsa_2020_2024_infiniti_dry_20260403\results.jsonl](C:/GB/tmp/nhtsa_2020_2024_infiniti_dry_20260403/results.jsonl)
- Infiniti live import: [C:\GB\seed_import_supabase_nhtsa_2020_2024_infiniti_live_20260403\results.jsonl](C:/GB/seed_import_supabase_nhtsa_2020_2024_infiniti_live_20260403/results.jsonl)
- Audi final reviewed subset: [C:\GB\tmp\nhtsa_2020_2024_audi_second_pass_20260402](C:/GB/tmp/nhtsa_2020_2024_audi_second_pass_20260402)
- Audi audit: [C:\GB\tmp\nhtsa_2020_2024_audi_second_pass_20260402\MANUAL_REVIEW.md](C:/GB/tmp/nhtsa_2020_2024_audi_second_pass_20260402/MANUAL_REVIEW.md)
- Audi dry import: [C:\GB\tmp\nhtsa_2020_2024_audi_dry_20260402\results.jsonl](C:/GB/tmp/nhtsa_2020_2024_audi_dry_20260402/results.jsonl)
- Audi live import: [C:\GB\seed_import_supabase_nhtsa_2020_2024_audi_live_20260402\results.jsonl](C:/GB/seed_import_supabase_nhtsa_2020_2024_audi_live_20260402/results.jsonl)

Newly completed in the latest pass:
- `GMC` `58`
- `Volvo` `32`
- `Mercedes-Benz` `185`
- `Mercedes-Maybach` block `64`
- `Mercedes` alias block `6`
- `Maybach` `2`
- `Smart` `6`

Closed with no safe subset in the latest pass:
- `Volkswagen (US)` `0`
- `Scion` `0`
- `Hummer` `0`
- `Pontiac` `0`
- `Saturn` `0`
- `Saab` `0`

Explicitly excluded from this file's current passenger-car scope:
- `Geo` — all observed rows are pre-2000 legacy models (`Metro/Prizm/Tracker`)
- `Isuzu` — observed rows are commercial truck lines (`N/F/H/T-Series`), not passenger-car scope

Supported-slice backlog status:
- no remaining large backlog inside the currently catalog-supported slice
- the remaining work on `TSBS_RECEIVED_2025-2025.txt` is primarily catalog expansion for additional automotive makes not yet supported in the app catalog

Likely next unsupported automotive makes from this file (not yet added to catalog):
- `McLaren`
- `BrightDrop`
- `Workhorse`
- `Karma`
- `Ineos`
- `Lotus`
- `Rolls-Royce`
- `Lamborghini`
- `Koenigsegg`

Latest legacy mainstream review artifacts:
- Pontiac reviewed subset: [C:\GB\tmp\nhtsa_2025_pontiac_ai_reviewed_20260402](C:/GB/tmp/nhtsa_2025_pontiac_ai_reviewed_20260402)
- Saturn reviewed subset: [C:\GB\tmp\nhtsa_2025_saturn_ai_reviewed_20260402](C:/GB/tmp/nhtsa_2025_saturn_ai_reviewed_20260402)
- Saab reviewed subset: [C:\GB\tmp\nhtsa_2025_saab_ai_reviewed_20260402](C:/GB/tmp/nhtsa_2025_saab_ai_reviewed_20260402)

Latest Mercedes-Maybach review artifacts:
- reviewed subset: [C:\GB\tmp\nhtsa_2025_mercedes_maybach_reviewed_final_20260402](C:/GB/tmp/nhtsa_2025_mercedes_maybach_reviewed_final_20260402)
- audit: [C:\GB\tmp\nhtsa_2025_mercedes_maybach_reviewed_final_20260402\MANUAL_REVIEW.md](C:/GB/tmp/nhtsa_2025_mercedes_maybach_reviewed_final_20260402/MANUAL_REVIEW.md)
- dry import: [C:\GB\seed_import_supabase_nhtsa_2025_mercedes_maybach_dry_20260402_r2\results.jsonl](C:/GB/seed_import_supabase_nhtsa_2025_mercedes_maybach_dry_20260402_r2/results.jsonl)
- live import: [C:\GB\seed_import_supabase_nhtsa_2025_mercedes_maybach_live_20260402\results.jsonl](C:/GB/seed_import_supabase_nhtsa_2025_mercedes_maybach_live_20260402/results.jsonl)

Latest Volvo review artifacts:
- reviewed subset: [C:\GB\tmp\nhtsa_2025_volvo_ai_reviewed_full_20260331](C:/GB/tmp/nhtsa_2025_volvo_ai_reviewed_full_20260331)
- audit: [C:\GB\tmp\nhtsa_2025_volvo_ai_reviewed_full_20260331\MANUAL_REVIEW.md](C:/GB/tmp/nhtsa_2025_volvo_ai_reviewed_full_20260331/MANUAL_REVIEW.md)
- dry import: [C:\GB\seed_import_supabase_nhtsa_2025_volvo_dry_20260331\results.jsonl](C:/GB/seed_import_supabase_nhtsa_2025_volvo_dry_20260331/results.jsonl)
- live import: [C:\GB\seed_import_supabase_nhtsa_2025_volvo_live_20260331\results.jsonl](C:/GB/seed_import_supabase_nhtsa_2025_volvo_live_20260331/results.jsonl)

## Key pipeline changes already in place

- post-catalog canonical dedupe in parser
- revision-aware dedupe (`REV. A`, `REV. B`, `_R1`, etc.)
- AI review stage in `scripts/tsb-review-nhtsa-ai.mjs`
- hard normalization of NHTSA symptom tags to short labels (`1-4` words max)
- generic symptom tags like `MIL on` or `Warning light` must be dropped whenever a more specific symptom already exists
- if a reviewed NHTSA case contains explicit DTCs in the description, those codes should be backfilled into `obd_codes`, and redundant DTC symptom tags should then be pruned
- accepted NHTSA seeds now prune redundant DTC symptom tags whenever explicit `obd_codes` are present
- `push-case` skips translation for NHTSA reviewed seeds, so short symptom tags are not expanded back into prose on import
- `push-case` duplicate handling now overwrites the full case payload, not just `thread_url` / `source_ref`
- stale EU/US mapping fixes for US imports
- runtime/source metadata support in Supabase (`source_ref`, bulletin URL)
- subset extraction and AI review must run sequentially; if they run in parallel, the reviewer may only see the first partially copied files and produce a false partial review result
- `scripts/tsb-review-nhtsa-ai.mjs` now resumes from an existing `ai_review_decisions.jsonl`, so a network `fetch failed` no longer forces a full brand review restart
- `scripts/tsb-second-pass-nhtsa-ai.mjs` provides a stricter per-case safety pass over already AI-reviewed `ready + to_review` sets; use it when first-pass acceptance is still too broad for production import
