-- ── 010: Shared diagnostic cases (public read-only links) ──────────────────
-- Frozen snapshots of diagnostic sessions that can be viewed without auth.

CREATE TABLE public.shared_cases (
  id              TEXT PRIMARY KEY,                          -- short nanoid token (8-10 chars)
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id      TEXT NOT NULL,                             -- local_id from the web session
  snapshot        JSONB NOT NULL,                            -- frozen copy of the case (vehicle, messages, resolution)
  vehicle_summary TEXT NOT NULL DEFAULT '',                  -- e.g. "Golf VI 1.4 TSI 118kW" for OG tags
  fault_summary   TEXT NOT NULL DEFAULT '',                  -- e.g. "Netěsnící HPFP — 75%" for OG description
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_shared_cases_user ON public.shared_cases (user_id);

-- RLS: anyone can read, only owner can insert/delete
ALTER TABLE public.shared_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_select_anyone"
  ON public.shared_cases FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "shared_insert_own"
  ON public.shared_cases FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "shared_delete_own"
  ON public.shared_cases FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
