-- Migration 008: expand gearbrain_cases.resolution constraint from 200 to 400 chars

ALTER TABLE public.gearbrain_cases
  DROP CONSTRAINT IF EXISTS chk_resolution_length;

ALTER TABLE public.gearbrain_cases
  ADD CONSTRAINT chk_resolution_length
  CHECK (LENGTH(resolution) >= 10 AND LENGTH(resolution) <= 400);
