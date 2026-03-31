-- Workshop manual section text storage
-- Stores pre-extracted text from PDF sections for on-demand retrieval

CREATE TABLE IF NOT EXISTS manual_section_text (
  id TEXT PRIMARY KEY,               -- matches Neo4j section ID, e.g. "1,9_TDI_77kW_BKC_BXE_BLS_RG19"
  manual_filename TEXT NOT NULL,
  section_title TEXT NOT NULL,
  repair_group TEXT,
  pdf_page INT,
  page_count INT,
  extracted_pages INT,
  content TEXT NOT NULL,
  char_count INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for lookup by manual + section
CREATE INDEX idx_manual_section_lookup ON manual_section_text (manual_filename, section_title);

-- RLS: allow authenticated users to read
ALTER TABLE manual_section_text ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read manual text"
  ON manual_section_text FOR SELECT
  TO authenticated
  USING (true);
