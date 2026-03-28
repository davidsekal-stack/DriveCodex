-- Migration 010: persist optional human-readable bulletin/source reference

ALTER TABLE public.gearbrain_cases
  ADD COLUMN IF NOT EXISTS source_ref TEXT;
