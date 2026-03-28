# NHTSA TSB Status

Aktualizováno: 2026-03-28

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

## Key pipeline changes already in place

- post-catalog canonical dedupe in parser
- revision-aware dedupe (`REV. A`, `REV. B`, `_R1`, etc.)
- AI review stage in `scripts/tsb-review-nhtsa-ai.mjs`
- hard normalization of NHTSA symptom tags to short labels (`1-4` words max)
- accepted NHTSA seeds now prune redundant DTC symptom tags whenever explicit `obd_codes` are present
- `push-case` skips translation for NHTSA reviewed seeds, so short symptom tags are not expanded back into prose on import
- `push-case` duplicate handling now overwrites the full case payload, not just `thread_url` / `source_ref`
- stale EU/US mapping fixes for US imports
- runtime/source metadata support in Supabase (`source_ref`, bulletin URL)
