-- migrate:up
CREATE TABLE IF NOT EXISTS gsc_import_runs (
  id TEXT PRIMARY KEY,
  property_uri TEXT NOT NULL CHECK (length(property_uri) BETWEEN 8 AND 500),
  period_start TEXT NOT NULL CHECK (period_start GLOB '????-??-??'),
  period_end TEXT NOT NULL CHECK (period_end GLOB '????-??-??'),
  search_type TEXT NOT NULL CHECK (search_type IN (
    'WEB', 'IMAGE', 'VIDEO', 'NEWS', 'DISCOVER', 'GOOGLE_NEWS'
  )),
  dimensions_json TEXT NOT NULL,
  acquisition_method TEXT NOT NULL CHECK (acquisition_method IN (
    'SEARCH_CONSOLE_API', 'SEARCH_CONSOLE_EXPORT'
  )),
  source_ref TEXT NOT NULL CHECK (length(source_ref) BETWEEN 1 AND 500),
  source_sha256 TEXT NOT NULL CHECK (length(source_sha256) = 64),
  run_checksum TEXT NOT NULL UNIQUE CHECK (length(run_checksum) = 64),
  row_count INTEGER NOT NULL CHECK (row_count >= 0),
  status TEXT NOT NULL CHECK (status = 'COMPLETE'),
  imported_at INTEGER NOT NULL,
  CHECK (period_end >= period_start)
);
CREATE INDEX IF NOT EXISTS idx_gsc_import_runs_property_period
  ON gsc_import_runs(property_uri, search_type, period_end DESC, imported_at DESC);

CREATE TABLE IF NOT EXISTS gsc_search_performance_daily (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES gsc_import_runs(id) ON DELETE CASCADE,
  data_date TEXT NOT NULL CHECK (data_date GLOB '????-??-??'),
  search_type TEXT NOT NULL CHECK (search_type IN (
    'WEB', 'IMAGE', 'VIDEO', 'NEWS', 'DISCOVER', 'GOOGLE_NEWS'
  )),
  page_url TEXT NOT NULL CHECK (
    page_url = 'https://7tool.ru/' OR page_url LIKE 'https://7tool.ru/%'
  ),
  page_path TEXT NOT NULL CHECK (page_path LIKE '/%'),
  route_path TEXT NOT NULL CHECK (route_path LIKE '/%' AND instr(route_path, '?') = 0),
  query_text TEXT NOT NULL CHECK (length(query_text) BETWEEN 1 AND 500),
  query_hash TEXT NOT NULL CHECK (length(query_hash) = 64),
  country TEXT NOT NULL CHECK (length(country) = 3),
  device TEXT NOT NULL CHECK (device IN ('DESKTOP', 'MOBILE', 'TABLET')),
  impressions REAL NOT NULL CHECK (impressions >= 0),
  clicks REAL NOT NULL CHECK (clicks >= 0 AND clicks <= impressions),
  ctr REAL NOT NULL CHECK (ctr BETWEEN 0 AND 1),
  average_position REAL NOT NULL CHECK (average_position >= 0),
  is_facet INTEGER NOT NULL CHECK (is_facet IN (0, 1)),
  row_checksum TEXT NOT NULL CHECK (length(row_checksum) = 64),
  imported_at INTEGER NOT NULL,
  UNIQUE (run_id, row_checksum)
);
CREATE INDEX IF NOT EXISTS idx_gsc_performance_quick_wins
  ON gsc_search_performance_daily(search_type, is_facet, data_date, page_path);
CREATE INDEX IF NOT EXISTS idx_gsc_performance_url_queries
  ON gsc_search_performance_daily(page_path, data_date DESC, query_hash, country, device);
CREATE INDEX IF NOT EXISTS idx_gsc_performance_route
  ON gsc_search_performance_daily(route_path, data_date DESC);
CREATE INDEX IF NOT EXISTS idx_gsc_performance_run
  ON gsc_search_performance_daily(run_id);

CREATE TABLE IF NOT EXISTS google_quick_wins (
  id TEXT PRIMARY KEY,
  page_url_id TEXT NOT NULL REFERENCES site_urls(id),
  page_path TEXT NOT NULL CHECK (page_path LIKE '/%'),
  period_start TEXT NOT NULL CHECK (period_start GLOB '????-??-??'),
  period_end TEXT NOT NULL CHECK (period_end GLOB '????-??-??'),
  min_impressions REAL NOT NULL CHECK (min_impressions > 0),
  min_position REAL NOT NULL CHECK (min_position = 6),
  max_position REAL NOT NULL CHECK (max_position = 20),
  impressions REAL NOT NULL CHECK (impressions >= min_impressions),
  clicks REAL NOT NULL CHECK (clicks >= 0 AND clicks <= impressions),
  ctr REAL NOT NULL CHECK (ctr BETWEEN 0 AND 1),
  average_position REAL NOT NULL CHECK (average_position BETWEEN min_position AND max_position),
  query_count INTEGER NOT NULL CHECK (query_count > 0),
  country_count INTEGER NOT NULL CHECK (country_count > 0),
  device_count INTEGER NOT NULL CHECK (device_count > 0),
  source_run_ids_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status = 'HIGH_PRIORITY_UPDATE'),
  decision TEXT NOT NULL CHECK (decision = 'UPDATE'),
  model_version TEXT NOT NULL,
  evidence_checksum TEXT NOT NULL UNIQUE CHECK (length(evidence_checksum) = 64),
  evaluated_at INTEGER NOT NULL,
  CHECK (period_end >= period_start)
);
CREATE INDEX IF NOT EXISTS idx_google_quick_wins_priority
  ON google_quick_wins(status, period_end DESC, impressions DESC);
CREATE INDEX IF NOT EXISTS idx_google_quick_wins_page
  ON google_quick_wins(page_url_id, evaluated_at DESC);

CREATE TABLE IF NOT EXISTS core_web_vital_samples (
  id TEXT PRIMARY KEY,
  metric_id TEXT NOT NULL CHECK (length(metric_id) BETWEEN 8 AND 200),
  metric_name TEXT NOT NULL CHECK (metric_name IN ('LCP', 'INP', 'CLS')),
  page_path TEXT NOT NULL CHECK (page_path LIKE '/%'),
  metric_value REAL NOT NULL CHECK (
    (metric_name IN ('LCP', 'INP') AND metric_value BETWEEN 0 AND 60000)
    OR (metric_name = 'CLS' AND metric_value BETWEEN 0 AND 10)
  ),
  rating TEXT NOT NULL CHECK (rating IN ('GOOD', 'NEEDS_IMPROVEMENT', 'POOR')),
  navigation_type TEXT NOT NULL CHECK (navigation_type IN (
    'NAVIGATE', 'RELOAD', 'BACK_FORWARD', 'PRERENDER', 'RESTORE', 'UNKNOWN'
  )),
  captured_at INTEGER NOT NULL,
  UNIQUE (metric_id, metric_name, page_path)
);
CREATE INDEX IF NOT EXISTS idx_core_web_vitals_page_metric
  ON core_web_vital_samples(page_path, metric_name, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_core_web_vitals_rating
  ON core_web_vital_samples(metric_name, rating, captured_at DESC);

CREATE TABLE IF NOT EXISTS facet_indexing_policies (
  id TEXT PRIMARY KEY,
  scope_path TEXT NOT NULL CHECK (scope_path LIKE '/c/%' AND instr(scope_path, '?') = 0),
  facet_key TEXT NOT NULL CHECK (length(facet_key) BETWEEN 1 AND 200),
  facet_value TEXT NOT NULL CHECK (length(facet_value) BETWEEN 1 AND 300),
  classification TEXT NOT NULL CHECK (classification IN (
    'INDEXABLE_SEO_LANDING', 'NON_INDEXABLE_FACET'
  )),
  landing_url_id TEXT REFERENCES site_urls(id),
  rationale TEXT NOT NULL CHECK (length(rationale) BETWEEN 10 AND 1000),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'SUPERSEDED')),
  reviewed_by TEXT NOT NULL CHECK (length(reviewed_by) BETWEEN 2 AND 200),
  reviewed_at INTEGER NOT NULL,
  supersedes_id TEXT REFERENCES facet_indexing_policies(id),
  created_at INTEGER NOT NULL,
  CHECK (
    (classification = 'INDEXABLE_SEO_LANDING' AND landing_url_id IS NOT NULL)
    OR (classification = 'NON_INDEXABLE_FACET' AND landing_url_id IS NULL)
  ),
  CHECK (supersedes_id IS NULL OR supersedes_id != id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_facet_policies_one_active
  ON facet_indexing_policies(scope_path, facet_key, facet_value)
  WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_facet_policies_landing
  ON facet_indexing_policies(landing_url_id, status)
  WHERE landing_url_id IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_gsc_import_runs_no_update
BEFORE UPDATE ON gsc_import_runs BEGIN
  SELECT RAISE(ABORT, 'GSC import runs are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_gsc_performance_no_update
BEFORE UPDATE ON gsc_search_performance_daily BEGIN
  SELECT RAISE(ABORT, 'GSC performance rows are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_google_quick_wins_no_update
BEFORE UPDATE ON google_quick_wins BEGIN
  SELECT RAISE(ABORT, 'Google quick-win evaluations are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_core_web_vitals_no_update
BEFORE UPDATE ON core_web_vital_samples BEGIN
  SELECT RAISE(ABORT, 'Core Web Vital samples are immutable');
END;

PRAGMA optimize;

-- migrate:down
DROP TRIGGER IF EXISTS trg_core_web_vitals_no_update;
DROP TRIGGER IF EXISTS trg_google_quick_wins_no_update;
DROP TRIGGER IF EXISTS trg_gsc_performance_no_update;
DROP TRIGGER IF EXISTS trg_gsc_import_runs_no_update;
DROP TABLE IF EXISTS facet_indexing_policies;
DROP TABLE IF EXISTS core_web_vital_samples;
DROP TABLE IF EXISTS google_quick_wins;
DROP TABLE IF EXISTS gsc_search_performance_daily;
DROP TABLE IF EXISTS gsc_import_runs;
