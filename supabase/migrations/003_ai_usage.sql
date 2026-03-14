-- ═══════════════════════════════════════════════════════════════════════════════
-- GearBrain — tabulka pro rate-limiting AI volání
-- Používá Edge Function anthropic-proxy
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.gearbrain_ai_usage (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  installation_id TEXT NOT NULL,
  model           TEXT,
  input_tokens    INTEGER DEFAULT 0,
  output_tokens   INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pro rychlé dotazy: kolik volání za posledních 24h pro daný installation_id
CREATE INDEX idx_ai_usage_installation_id ON public.gearbrain_ai_usage(installation_id, created_at);
