-- migrate:up
CREATE TABLE IF NOT EXISTS analytics_import_runs (
  id TEXT PRIMARY KEY,
  source_system TEXT NOT NULL CHECK (source_system IN ('YANDEX_METRIKA', 'CRM')),
  dataset_type TEXT NOT NULL CHECK (dataset_type IN ('METRIKA_PAGE_METRICS', 'CRM_BUSINESS_OUTCOMES')),
  subject_ref TEXT NOT NULL CHECK (length(subject_ref) BETWEEN 1 AND 300),
  period_start TEXT NOT NULL CHECK (period_start GLOB '????-??-??'),
  period_end TEXT NOT NULL CHECK (period_end GLOB '????-??-??'),
  dimensions_json TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  acquisition_method TEXT NOT NULL CHECK (acquisition_method IN (
    'YANDEX_METRIKA_REPORTS_API', 'OFFICIAL_EXPORT', 'CRM_EXPORT'
  )),
  source_ref TEXT NOT NULL CHECK (length(source_ref) BETWEEN 1 AND 500),
  source_sha256 TEXT NOT NULL CHECK (length(source_sha256) = 64),
  run_checksum TEXT NOT NULL UNIQUE CHECK (length(run_checksum) = 64),
  row_count INTEGER NOT NULL CHECK (row_count >= 0),
  status TEXT NOT NULL CHECK (status = 'COMPLETE'),
  imported_at INTEGER NOT NULL,
  CHECK (period_end >= period_start),
  CHECK (row_count > 0 OR dataset_type = 'CRM_BUSINESS_OUTCOMES'),
  CHECK (
    (source_system = 'YANDEX_METRIKA' AND dataset_type = 'METRIKA_PAGE_METRICS'
      AND acquisition_method IN ('YANDEX_METRIKA_REPORTS_API', 'OFFICIAL_EXPORT'))
    OR (source_system = 'CRM' AND dataset_type = 'CRM_BUSINESS_OUTCOMES'
      AND acquisition_method = 'CRM_EXPORT')
  )
);
CREATE INDEX IF NOT EXISTS idx_analytics_import_runs_latest
  ON analytics_import_runs(dataset_type, subject_ref, period_start, period_end, imported_at DESC);

CREATE TABLE IF NOT EXISTS analytics_page_metrics_daily (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES analytics_import_runs(id) ON DELETE CASCADE,
  data_date TEXT NOT NULL CHECK (data_date GLOB '????-??-??'),
  page_path TEXT NOT NULL CHECK (page_path LIKE '/%' AND instr(page_path, '?') = 0),
  page_type TEXT NOT NULL CHECK (page_type IN (
    'ARTICLE', 'TOOL', 'PRODUCT', 'CATEGORY', 'LANDING', 'OTHER'
  )),
  metric_name TEXT NOT NULL CHECK (metric_name IN (
    'ARTICLE_VIEW', 'ARTICLE_50_SCROLL', 'ARTICLE_90_SCROLL',
    'PRODUCT_CLICK_FROM_ARTICLE', 'CATEGORY_CLICK_FROM_ARTICLE',
    'CALCULATOR_START', 'CALCULATOR_COMPLETE', 'SELECTOR_START',
    'SELECTOR_COMPLETE', 'LEAD_FORM_OPEN', 'LEAD_FORM_SUCCESS',
    'PHONE_CLICK', 'EMAIL_CLICK', 'ORGANIC_PRODUCT_VIEWS'
  )),
  metric_value INTEGER NOT NULL CHECK (metric_value >= 0),
  row_checksum TEXT NOT NULL CHECK (length(row_checksum) = 64),
  imported_at INTEGER NOT NULL,
  UNIQUE (run_id, row_checksum),
  UNIQUE (run_id, data_date, page_path, metric_name)
);
CREATE INDEX IF NOT EXISTS idx_analytics_page_metrics_roi
  ON analytics_page_metrics_daily(run_id, page_path, metric_name, data_date);
CREATE INDEX IF NOT EXISTS idx_analytics_page_metrics_kpi
  ON analytics_page_metrics_daily(run_id, metric_name, data_date);

CREATE TABLE IF NOT EXISTS analytics_business_outcomes (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES analytics_import_runs(id) ON DELETE CASCADE,
  external_outcome_id TEXT NOT NULL CHECK (length(external_outcome_id) BETWEEN 1 AND 200),
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE RESTRICT,
  outcome_type TEXT NOT NULL CHECK (outcome_type IN ('QUALIFIED_LEAD', 'QUOTE', 'ORDER')),
  occurred_at INTEGER NOT NULL,
  revenue_minor INTEGER,
  gross_margin_minor INTEGER,
  currency TEXT,
  row_checksum TEXT NOT NULL CHECK (length(row_checksum) = 64),
  imported_at INTEGER NOT NULL,
  CHECK (
    (outcome_type IN ('QUALIFIED_LEAD', 'QUOTE')
      AND revenue_minor IS NULL AND gross_margin_minor IS NULL AND currency IS NULL)
    OR (outcome_type = 'ORDER'
      AND revenue_minor IS NOT NULL AND revenue_minor >= 0
      AND gross_margin_minor IS NOT NULL AND gross_margin_minor <= revenue_minor
      AND currency = 'RUB')
  ),
  UNIQUE (run_id, row_checksum),
  UNIQUE (run_id, lead_id, outcome_type)
);
CREATE INDEX IF NOT EXISTS idx_analytics_business_outcomes_kpi
  ON analytics_business_outcomes(run_id, outcome_type, occurred_at);
CREATE INDEX IF NOT EXISTS idx_analytics_business_outcomes_lead
  ON analytics_business_outcomes(lead_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS analytics_business_kpi_snapshots (
  id TEXT PRIMARY KEY,
  period_start TEXT NOT NULL CHECK (period_start GLOB '????-??-??'),
  period_end TEXT NOT NULL CHECK (period_end GLOB '????-??-??'),
  organic_product_views INTEGER NOT NULL CHECK (organic_product_views >= 0),
  qualified_leads INTEGER NOT NULL CHECK (qualified_leads >= 0),
  quotes INTEGER NOT NULL CHECK (quotes >= 0),
  orders INTEGER NOT NULL CHECK (orders >= 0),
  revenue_minor INTEGER NOT NULL CHECK (revenue_minor >= 0),
  gross_margin_minor INTEGER NOT NULL,
  currency TEXT NOT NULL CHECK (currency = 'RUB'),
  page_metric_run_id TEXT NOT NULL REFERENCES analytics_import_runs(id),
  business_outcome_run_id TEXT NOT NULL REFERENCES analytics_import_runs(id),
  evidence_checksum TEXT NOT NULL UNIQUE CHECK (length(evidence_checksum) = 64),
  model_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status = 'REVIEW_REQUIRED'),
  evaluated_at INTEGER NOT NULL,
  CHECK (period_end >= period_start)
);
CREATE INDEX IF NOT EXISTS idx_analytics_business_kpi_review
  ON analytics_business_kpi_snapshots(status, period_end DESC, evaluated_at DESC);

CREATE TABLE IF NOT EXISTS content_roi_snapshots (
  id TEXT PRIMARY KEY,
  page_path TEXT NOT NULL CHECK (page_path LIKE '/%' AND instr(page_path, '?') = 0),
  page_type TEXT NOT NULL CHECK (page_type IN (
    'ARTICLE', 'TOOL', 'PRODUCT', 'CATEGORY', 'LANDING', 'OTHER'
  )),
  period_start TEXT NOT NULL CHECK (period_start GLOB '????-??-??'),
  period_end TEXT NOT NULL CHECK (period_end GLOB '????-??-??'),
  organic_sessions INTEGER NOT NULL CHECK (organic_sessions >= 0),
  product_clicks INTEGER NOT NULL CHECK (product_clicks >= 0),
  leads INTEGER NOT NULL CHECK (leads >= 0),
  qualified_leads INTEGER NOT NULL CHECK (qualified_leads >= 0),
  quotes INTEGER NOT NULL CHECK (quotes >= 0),
  orders INTEGER NOT NULL CHECK (orders >= 0),
  revenue_minor INTEGER NOT NULL CHECK (revenue_minor >= 0),
  gross_margin_minor INTEGER NOT NULL,
  currency TEXT NOT NULL CHECK (currency = 'RUB'),
  yandex_organic_run_id TEXT NOT NULL REFERENCES yandex_import_runs(id),
  page_metric_run_id TEXT NOT NULL REFERENCES analytics_import_runs(id),
  business_outcome_run_id TEXT NOT NULL REFERENCES analytics_import_runs(id),
  evidence_checksum TEXT NOT NULL UNIQUE CHECK (length(evidence_checksum) = 64),
  model_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status = 'REVIEW_REQUIRED'),
  evaluated_at INTEGER NOT NULL,
  CHECK (period_end >= period_start)
);
CREATE INDEX IF NOT EXISTS idx_content_roi_page
  ON content_roi_snapshots(page_path, period_end DESC, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_roi_review
  ON content_roi_snapshots(status, period_end DESC, evaluated_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_analytics_import_runs_no_update
BEFORE UPDATE ON analytics_import_runs BEGIN
  SELECT RAISE(ABORT, 'Analytics import runs are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_analytics_page_metrics_no_update
BEFORE UPDATE ON analytics_page_metrics_daily BEGIN
  SELECT RAISE(ABORT, 'Analytics page metrics are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_analytics_business_outcomes_no_update
BEFORE UPDATE ON analytics_business_outcomes BEGIN
  SELECT RAISE(ABORT, 'Analytics business outcomes are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_analytics_business_kpi_no_update
BEFORE UPDATE ON analytics_business_kpi_snapshots BEGIN
  SELECT RAISE(ABORT, 'Analytics business KPI snapshots are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_content_roi_no_update
BEFORE UPDATE ON content_roi_snapshots BEGIN
  SELECT RAISE(ABORT, 'Content ROI snapshots are immutable');
END;

PRAGMA optimize;

-- migrate:down
DROP TRIGGER IF EXISTS trg_content_roi_no_update;
DROP TRIGGER IF EXISTS trg_analytics_business_kpi_no_update;
DROP TRIGGER IF EXISTS trg_analytics_business_outcomes_no_update;
DROP TRIGGER IF EXISTS trg_analytics_page_metrics_no_update;
DROP TRIGGER IF EXISTS trg_analytics_import_runs_no_update;
DROP TABLE IF EXISTS content_roi_snapshots;
DROP TABLE IF EXISTS analytics_business_kpi_snapshots;
DROP TABLE IF EXISTS analytics_business_outcomes;
DROP TABLE IF EXISTS analytics_page_metrics_daily;
DROP TABLE IF EXISTS analytics_import_runs;
