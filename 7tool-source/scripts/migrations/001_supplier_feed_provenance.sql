-- migrate:up
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'SUPPLIER_FEED', 'MANUFACTURER', 'MANUAL', 'GSC', 'YANDEX_WEBMASTER',
    'WORDSTAT', 'MARKETPLACE', 'SERP', 'INTERNAL_SEARCH'
  )),
  name TEXT NOT NULL,
  base_url TEXT,
  rights_policy TEXT NOT NULL CHECK (rights_policy IN (
    'PUBLISHABLE_FACTS', 'RESEARCH_ONLY', 'CONTRACT_REQUIRED'
  )),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS import_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  status TEXT NOT NULL CHECK (status IN ('RUNNING', 'SUCCEEDED', 'FAILED', 'REJECTED')),
  input_checksum TEXT NOT NULL,
  record_count INTEGER,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  parser_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  error_summary TEXT,
  artifact_ref TEXT
);
CREATE INDEX IF NOT EXISTS idx_import_runs_source_started
  ON import_runs(source_id, started_at DESC);

CREATE TABLE IF NOT EXISTS source_facts (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  import_run_id TEXT NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  predicate TEXT NOT NULL,
  value_text TEXT,
  value_number REAL,
  unit TEXT,
  value_json TEXT,
  observed_at INTEGER NOT NULL,
  source_locator TEXT,
  checksum TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OBSERVED' CHECK (status IN (
    'OBSERVED', 'VALID', 'CONFLICTING', 'REJECTED', 'SUPERSEDED'
  )),
  CHECK (
    value_text IS NOT NULL OR value_number IS NOT NULL OR value_json IS NOT NULL
  )
);
CREATE INDEX IF NOT EXISTS idx_source_facts_subject
  ON source_facts(subject_type, subject_id, predicate, status);
CREATE INDEX IF NOT EXISTS idx_source_facts_run
  ON source_facts(import_run_id);
CREATE INDEX IF NOT EXISTS idx_source_facts_checksum
  ON source_facts(source_id, checksum);

-- migrate:down
DROP TABLE IF EXISTS source_facts;
DROP TABLE IF EXISTS import_runs;
DROP TABLE IF EXISTS sources;
