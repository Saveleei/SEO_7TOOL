-- migrate:up
CREATE TABLE IF NOT EXISTS yandex_import_runs (
  id TEXT PRIMARY KEY,
  source_system TEXT NOT NULL CHECK (source_system IN (
    'YANDEX_WEBMASTER', 'WORDSTAT', 'YANDEX_METRIKA'
  )),
  dataset_type TEXT NOT NULL CHECK (dataset_type IN (
    'WEBMASTER_URL_QUERIES', 'WORDSTAT_DEMAND', 'METRIKA_ORGANIC_LANDINGS'
  )),
  subject_ref TEXT NOT NULL CHECK (length(subject_ref) BETWEEN 1 AND 300),
  period_start TEXT NOT NULL CHECK (period_start GLOB '????-??-??'),
  period_end TEXT NOT NULL CHECK (period_end GLOB '????-??-??'),
  dimensions_json TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  acquisition_method TEXT NOT NULL CHECK (acquisition_method IN (
    'YANDEX_WEBMASTER_API', 'YANDEX_WORDSTAT_API', 'YANDEX_METRIKA_REPORTS_API',
    'OFFICIAL_EXPORT'
  )),
  source_ref TEXT NOT NULL CHECK (length(source_ref) BETWEEN 1 AND 500),
  source_sha256 TEXT NOT NULL CHECK (length(source_sha256) = 64),
  run_checksum TEXT NOT NULL UNIQUE CHECK (length(run_checksum) = 64),
  row_count INTEGER NOT NULL CHECK (row_count > 0),
  semantic_import_run_id TEXT REFERENCES import_runs(id),
  status TEXT NOT NULL CHECK (status = 'COMPLETE'),
  imported_at INTEGER NOT NULL,
  CHECK (period_end >= period_start),
  CHECK (
    (source_system = 'YANDEX_WEBMASTER' AND dataset_type = 'WEBMASTER_URL_QUERIES')
    OR (source_system = 'WORDSTAT' AND dataset_type = 'WORDSTAT_DEMAND')
    OR (source_system = 'YANDEX_METRIKA' AND dataset_type = 'METRIKA_ORGANIC_LANDINGS')
  ),
  CHECK (semantic_import_run_id IS NULL OR source_system = 'WORDSTAT')
);
CREATE INDEX IF NOT EXISTS idx_yandex_import_runs_source_period
  ON yandex_import_runs(source_system, dataset_type, period_end DESC, imported_at DESC);

CREATE TABLE IF NOT EXISTS yandex_webmaster_performance_daily (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES yandex_import_runs(id) ON DELETE CASCADE,
  data_date TEXT NOT NULL CHECK (data_date GLOB '????-??-??'),
  query_id TEXT,
  query_text TEXT NOT NULL CHECK (length(query_text) BETWEEN 1 AND 500),
  query_hash TEXT NOT NULL CHECK (length(query_hash) = 64),
  page_url TEXT NOT NULL CHECK (
    page_url = 'https://7tool.ru/' OR page_url LIKE 'https://7tool.ru/%'
  ),
  page_path TEXT NOT NULL CHECK (page_path LIKE '/%'),
  route_path TEXT NOT NULL CHECK (route_path LIKE '/%' AND instr(route_path, '?') = 0),
  region_id INTEGER NOT NULL CHECK (region_id >= 0),
  device TEXT NOT NULL CHECK (device IN (
    'ALL', 'DESKTOP', 'MOBILE_AND_TABLET', 'MOBILE', 'TABLET', 'UNKNOWN'
  )),
  impressions REAL NOT NULL CHECK (impressions >= 0),
  clicks REAL NOT NULL CHECK (clicks >= 0 AND clicks <= impressions),
  ctr REAL NOT NULL CHECK (ctr BETWEEN 0 AND 1),
  average_position REAL CHECK (average_position IS NULL OR average_position >= 0),
  is_facet INTEGER NOT NULL CHECK (is_facet IN (0, 1)),
  row_checksum TEXT NOT NULL CHECK (length(row_checksum) = 64),
  imported_at INTEGER NOT NULL,
  UNIQUE (run_id, row_checksum)
);
CREATE INDEX IF NOT EXISTS idx_yandex_webmaster_existing_performance
  ON yandex_webmaster_performance_daily(is_facet, data_date, page_path);
CREATE INDEX IF NOT EXISTS idx_yandex_webmaster_query
  ON yandex_webmaster_performance_daily(query_hash, data_date DESC, page_path);
CREATE INDEX IF NOT EXISTS idx_yandex_webmaster_run
  ON yandex_webmaster_performance_daily(run_id);

CREATE TABLE IF NOT EXISTS yandex_wordstat_demand (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES yandex_import_runs(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL CHECK (length(query_text) BETWEEN 1 AND 500),
  query_hash TEXT NOT NULL CHECK (length(query_hash) = 64),
  seed_phrase TEXT NOT NULL CHECK (length(seed_phrase) BETWEEN 1 AND 500),
  region_ids_json TEXT NOT NULL,
  region_key TEXT NOT NULL CHECK (length(region_key) BETWEEN 1 AND 100),
  device TEXT NOT NULL CHECK (device IN ('ALL', 'DESKTOP', 'PHONE', 'TABLET')),
  demand_count INTEGER NOT NULL CHECK (demand_count >= 0),
  source_keyword_id TEXT,
  category_slug TEXT REFERENCES categories(slug),
  row_checksum TEXT NOT NULL CHECK (length(row_checksum) = 64),
  imported_at INTEGER NOT NULL,
  UNIQUE (run_id, row_checksum)
);
CREATE INDEX IF NOT EXISTS idx_yandex_wordstat_demand_discovery
  ON yandex_wordstat_demand(region_key, device, demand_count DESC, query_hash);
CREATE INDEX IF NOT EXISTS idx_yandex_wordstat_query
  ON yandex_wordstat_demand(query_hash, imported_at DESC);
CREATE INDEX IF NOT EXISTS idx_yandex_wordstat_run
  ON yandex_wordstat_demand(run_id);

CREATE TABLE IF NOT EXISTS yandex_metrica_organic_daily (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES yandex_import_runs(id) ON DELETE CASCADE,
  data_date TEXT NOT NULL CHECK (data_date GLOB '????-??-??'),
  page_url TEXT NOT NULL CHECK (
    page_url = 'https://7tool.ru/' OR page_url LIKE 'https://7tool.ru/%'
  ),
  page_path TEXT NOT NULL CHECK (page_path LIKE '/%'),
  route_path TEXT NOT NULL CHECK (route_path LIKE '/%' AND instr(route_path, '?') = 0),
  search_engine TEXT NOT NULL CHECK (length(search_engine) BETWEEN 1 AND 100),
  query_text TEXT,
  query_hash TEXT,
  visits INTEGER NOT NULL CHECK (visits >= 0),
  users INTEGER NOT NULL CHECK (users >= 0 AND users <= visits),
  pageviews INTEGER NOT NULL CHECK (pageviews >= visits),
  bounce_rate REAL NOT NULL CHECK (bounce_rate BETWEEN 0 AND 1),
  row_checksum TEXT NOT NULL CHECK (length(row_checksum) = 64),
  imported_at INTEGER NOT NULL,
  CHECK (
    (query_text IS NULL AND query_hash IS NULL)
    OR (length(query_text) BETWEEN 1 AND 500 AND length(query_hash) = 64)
  ),
  UNIQUE (run_id, row_checksum)
);
CREATE INDEX IF NOT EXISTS idx_yandex_metrica_landing
  ON yandex_metrica_organic_daily(page_path, data_date DESC, search_engine);
CREATE INDEX IF NOT EXISTS idx_yandex_metrica_query
  ON yandex_metrica_organic_daily(query_hash, data_date DESC)
  WHERE query_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_yandex_metrica_run
  ON yandex_metrica_organic_daily(run_id);

CREATE TABLE IF NOT EXISTS yandex_query_opportunity_snapshots (
  id TEXT PRIMARY KEY,
  query_text TEXT NOT NULL CHECK (length(query_text) BETWEEN 1 AND 500),
  query_hash TEXT NOT NULL CHECK (length(query_hash) = 64),
  category_slug TEXT REFERENCES categories(slug),
  existing_url_id TEXT REFERENCES site_urls(id),
  page_path TEXT,
  period_start TEXT NOT NULL CHECK (period_start GLOB '????-??-??'),
  period_end TEXT NOT NULL CHECK (period_end GLOB '????-??-??'),
  wordstat_demand INTEGER CHECK (wordstat_demand IS NULL OR wordstat_demand >= 0),
  webmaster_impressions REAL CHECK (webmaster_impressions IS NULL OR webmaster_impressions >= 0),
  webmaster_clicks REAL CHECK (webmaster_clicks IS NULL OR webmaster_clicks >= 0),
  webmaster_ctr REAL CHECK (webmaster_ctr IS NULL OR webmaster_ctr BETWEEN 0 AND 1),
  webmaster_position REAL CHECK (webmaster_position IS NULL OR webmaster_position >= 0),
  metrica_organic_visits INTEGER CHECK (metrica_organic_visits IS NULL OR metrica_organic_visits >= 0),
  discovery_basis TEXT NOT NULL CHECK (discovery_basis IN (
    'WORDSTAT_DEMAND', 'WEBMASTER_EXISTING_PERFORMANCE'
  )),
  recommended_action TEXT NOT NULL CHECK (recommended_action IN (
    'DEMAND_REVIEW', 'UPDATE_EXISTING'
  )),
  source_run_ids_json TEXT NOT NULL,
  evidence_checksum TEXT NOT NULL UNIQUE CHECK (length(evidence_checksum) = 64),
  status TEXT NOT NULL CHECK (status = 'REVIEW_REQUIRED'),
  model_version TEXT NOT NULL,
  evaluated_at INTEGER NOT NULL,
  CHECK (period_end >= period_start),
  CHECK (page_path IS NULL OR page_path LIKE '/%'),
  CHECK (
    webmaster_clicks IS NULL
    OR (webmaster_impressions IS NOT NULL AND webmaster_clicks <= webmaster_impressions)
  ),
  CHECK (
    (discovery_basis = 'WEBMASTER_EXISTING_PERFORMANCE'
      AND recommended_action = 'UPDATE_EXISTING'
      AND existing_url_id IS NOT NULL AND page_path IS NOT NULL
      AND webmaster_impressions IS NOT NULL)
    OR (discovery_basis = 'WORDSTAT_DEMAND'
      AND recommended_action = 'DEMAND_REVIEW'
      AND existing_url_id IS NULL AND page_path IS NULL
      AND wordstat_demand IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_yandex_opportunities_review
  ON yandex_query_opportunity_snapshots(status, discovery_basis, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_yandex_opportunities_existing_url
  ON yandex_query_opportunity_snapshots(existing_url_id, evaluated_at DESC)
  WHERE existing_url_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_yandex_opportunities_query
  ON yandex_query_opportunity_snapshots(query_hash, evaluated_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_yandex_import_runs_no_update
BEFORE UPDATE ON yandex_import_runs BEGIN
  SELECT RAISE(ABORT, 'Yandex import runs are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_yandex_webmaster_no_update
BEFORE UPDATE ON yandex_webmaster_performance_daily BEGIN
  SELECT RAISE(ABORT, 'Yandex Webmaster observations are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_yandex_wordstat_no_update
BEFORE UPDATE ON yandex_wordstat_demand BEGIN
  SELECT RAISE(ABORT, 'Wordstat observations are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_yandex_metrica_no_update
BEFORE UPDATE ON yandex_metrica_organic_daily BEGIN
  SELECT RAISE(ABORT, 'Yandex Metrica observations are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_yandex_opportunities_no_update
BEFORE UPDATE ON yandex_query_opportunity_snapshots BEGIN
  SELECT RAISE(ABORT, 'Yandex opportunity snapshots are immutable');
END;

PRAGMA optimize;

-- migrate:down
DROP TRIGGER IF EXISTS trg_yandex_opportunities_no_update;
DROP TRIGGER IF EXISTS trg_yandex_metrica_no_update;
DROP TRIGGER IF EXISTS trg_yandex_wordstat_no_update;
DROP TRIGGER IF EXISTS trg_yandex_webmaster_no_update;
DROP TRIGGER IF EXISTS trg_yandex_import_runs_no_update;
DROP TABLE IF EXISTS yandex_query_opportunity_snapshots;
DROP TABLE IF EXISTS yandex_metrica_organic_daily;
DROP TABLE IF EXISTS yandex_wordstat_demand;
DROP TABLE IF EXISTS yandex_webmaster_performance_daily;
DROP TABLE IF EXISTS yandex_import_runs;
