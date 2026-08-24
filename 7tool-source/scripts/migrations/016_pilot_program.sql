-- migrate:up
CREATE TABLE IF NOT EXISTS pilot_programs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 3 AND 200),
  model_version TEXT NOT NULL,
  category_limit INTEGER NOT NULL CHECK (category_limit = 5),
  candidate_limit_per_category INTEGER NOT NULL CHECK (candidate_limit_per_category = 500),
  top_limit_per_category INTEGER NOT NULL CHECK (top_limit_per_category = 20),
  content_items_per_category INTEGER NOT NULL CHECK (content_items_per_category = 5),
  config_checksum TEXT NOT NULL UNIQUE CHECK (length(config_checksum) = 64),
  status TEXT NOT NULL CHECK (status IN ('REVIEW_REQUIRED', 'APPROVED', 'REJECTED')),
  created_by TEXT NOT NULL CHECK (length(created_by) BETWEEN 2 AND 200),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (status = 'REVIEW_REQUIRED' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (status IN ('APPROVED', 'REJECTED') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_pilot_programs_review
  ON pilot_programs(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS pilot_categories (
  pilot_id TEXT NOT NULL REFERENCES pilot_programs(id) ON DELETE RESTRICT,
  category_slug TEXT NOT NULL REFERENCES categories(slug) ON DELETE RESTRICT,
  category_title TEXT NOT NULL CHECK (length(category_title) BETWEEN 2 AND 200),
  category_ordinal INTEGER NOT NULL CHECK (category_ordinal BETWEEN 1 AND 5),
  baseline_path TEXT NOT NULL CHECK (
    baseline_path = '/c/' || category_slug AND instr(baseline_path, '?') = 0
  ),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (pilot_id, category_slug),
  UNIQUE (pilot_id, category_ordinal)
);
CREATE INDEX IF NOT EXISTS idx_pilot_categories_slug
  ON pilot_categories(category_slug, pilot_id);

CREATE TABLE IF NOT EXISTS pilot_selection_runs (
  id TEXT PRIMARY KEY,
  pilot_id TEXT NOT NULL REFERENCES pilot_programs(id) ON DELETE RESTRICT,
  candidate_limit_per_category INTEGER NOT NULL CHECK (candidate_limit_per_category = 500),
  top_limit_per_category INTEGER NOT NULL CHECK (top_limit_per_category = 20),
  source_opportunity_count INTEGER NOT NULL CHECK (source_opportunity_count >= 100),
  selected_candidate_count INTEGER NOT NULL CHECK (
    selected_candidate_count BETWEEN 100 AND 2500
  ),
  selected_top_count INTEGER NOT NULL CHECK (selected_top_count = 100),
  planned_content_count INTEGER NOT NULL CHECK (planned_content_count = 25),
  selection_checksum TEXT NOT NULL UNIQUE CHECK (length(selection_checksum) = 64),
  model_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status = 'REVIEW_REQUIRED'),
  evaluated_at INTEGER NOT NULL,
  UNIQUE (id, pilot_id)
);
CREATE INDEX IF NOT EXISTS idx_pilot_selection_runs_latest
  ON pilot_selection_runs(pilot_id, evaluated_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS pilot_opportunity_selections (
  selection_run_id TEXT NOT NULL,
  pilot_id TEXT NOT NULL,
  category_slug TEXT NOT NULL,
  opportunity_id TEXT NOT NULL REFERENCES content_opportunities(id) ON DELETE RESTRICT,
  candidate_rank INTEGER NOT NULL CHECK (candidate_rank BETWEEN 1 AND 500),
  top_rank INTEGER CHECK (top_rank IS NULL OR top_rank BETWEEN 1 AND 20),
  opportunity_score INTEGER NOT NULL CHECK (opportunity_score BETWEEN 0 AND 100),
  source_status TEXT NOT NULL CHECK (source_status IN ('PROPOSED', 'REVIEWED')),
  source_decision TEXT NOT NULL CHECK (source_decision IN ('CREATE', 'UPDATE', 'MERGE')),
  recommended_page_type TEXT NOT NULL,
  topic TEXT NOT NULL CHECK (length(topic) BETWEEN 1 AND 500),
  source_evaluation_checksum TEXT NOT NULL,
  selected_at INTEGER NOT NULL,
  PRIMARY KEY (selection_run_id, opportunity_id),
  UNIQUE (selection_run_id, category_slug, candidate_rank),
  FOREIGN KEY (selection_run_id, pilot_id)
    REFERENCES pilot_selection_runs(id, pilot_id) ON DELETE RESTRICT,
  FOREIGN KEY (pilot_id, category_slug)
    REFERENCES pilot_categories(pilot_id, category_slug) ON DELETE RESTRICT,
  CHECK (top_rank IS NULL OR top_rank = candidate_rank)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pilot_selections_top_rank
  ON pilot_opportunity_selections(selection_run_id, category_slug, top_rank)
  WHERE top_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pilot_selections_category_rank
  ON pilot_opportunity_selections(selection_run_id, category_slug, candidate_rank);

CREATE TABLE IF NOT EXISTS pilot_content_work_items (
  id TEXT PRIMARY KEY,
  selection_run_id TEXT NOT NULL,
  pilot_id TEXT NOT NULL,
  category_slug TEXT NOT NULL,
  slot_ordinal INTEGER NOT NULL CHECK (slot_ordinal BETWEEN 1 AND 5),
  slot_type TEXT NOT NULL CHECK (slot_type IN (
    'ARTICLE', 'TROUBLESHOOTING', 'COMPARISON_TABLE',
    'PRODUCT_CATEGORY_ENHANCEMENT'
  )),
  opportunity_id TEXT NOT NULL REFERENCES content_opportunities(id) ON DELETE RESTRICT,
  top_rank INTEGER NOT NULL CHECK (top_rank BETWEEN 1 AND 20),
  recommended_action TEXT NOT NULL CHECK (recommended_action IN ('CREATE', 'UPDATE', 'MERGE')),
  target_url_id TEXT REFERENCES site_urls(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('REVIEW_REQUIRED', 'APPROVED', 'REJECTED')),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (selection_run_id, category_slug, slot_ordinal),
  UNIQUE (selection_run_id, opportunity_id),
  FOREIGN KEY (selection_run_id, opportunity_id)
    REFERENCES pilot_opportunity_selections(selection_run_id, opportunity_id) ON DELETE RESTRICT,
  FOREIGN KEY (selection_run_id, pilot_id)
    REFERENCES pilot_selection_runs(id, pilot_id) ON DELETE RESTRICT,
  FOREIGN KEY (pilot_id, category_slug)
    REFERENCES pilot_categories(pilot_id, category_slug) ON DELETE RESTRICT,
  CHECK (
    (status = 'REVIEW_REQUIRED' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (status IN ('APPROVED', 'REJECTED') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_pilot_content_review
  ON pilot_content_work_items(pilot_id, status, category_slug, slot_ordinal);
CREATE INDEX IF NOT EXISTS idx_pilot_content_selection
  ON pilot_content_work_items(selection_run_id, category_slug, top_rank);

CREATE TABLE IF NOT EXISTS pilot_kpi_snapshots (
  id TEXT PRIMARY KEY,
  pilot_id TEXT NOT NULL REFERENCES pilot_programs(id) ON DELETE RESTRICT,
  selection_run_id TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('PILOT', 'CATEGORY')),
  category_slug TEXT,
  period_start TEXT NOT NULL CHECK (period_start GLOB '????-??-??'),
  period_end TEXT NOT NULL CHECK (period_end GLOB '????-??-??'),
  tracked_url_count INTEGER NOT NULL CHECK (tracked_url_count > 0),
  indexed_url_count INTEGER NOT NULL CHECK (
    indexed_url_count >= 0 AND indexed_url_count <= tracked_url_count
  ),
  indexation_rate REAL NOT NULL CHECK (indexation_rate BETWEEN 0 AND 1),
  impressions REAL NOT NULL CHECK (impressions >= 0),
  query_count INTEGER NOT NULL CHECK (query_count >= 0),
  clicks REAL NOT NULL CHECK (clicks >= 0 AND clicks <= impressions),
  ctr REAL NOT NULL CHECK (ctr BETWEEN 0 AND 1),
  average_position REAL CHECK (average_position IS NULL OR average_position >= 0),
  organic_sessions INTEGER NOT NULL CHECK (organic_sessions >= 0),
  product_clicks INTEGER NOT NULL CHECK (product_clicks >= 0),
  organic_leads INTEGER NOT NULL CHECK (organic_leads >= 0),
  lead_rate REAL NOT NULL CHECK (lead_rate BETWEEN 0 AND 1),
  revenue_minor INTEGER NOT NULL CHECK (revenue_minor >= 0),
  currency TEXT NOT NULL CHECK (currency = 'RUB'),
  gsc_run_id TEXT NOT NULL REFERENCES gsc_import_runs(id) ON DELETE RESTRICT,
  yandex_webmaster_run_id TEXT NOT NULL REFERENCES yandex_import_runs(id) ON DELETE RESTRICT,
  source_roi_snapshot_ids_json TEXT NOT NULL,
  evidence_checksum TEXT NOT NULL UNIQUE CHECK (length(evidence_checksum) = 64),
  model_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status = 'REVIEW_REQUIRED'),
  evaluated_at INTEGER NOT NULL,
  FOREIGN KEY (selection_run_id, pilot_id)
    REFERENCES pilot_selection_runs(id, pilot_id) ON DELETE RESTRICT,
  FOREIGN KEY (pilot_id, category_slug)
    REFERENCES pilot_categories(pilot_id, category_slug) ON DELETE RESTRICT,
  CHECK (period_end >= period_start),
  CHECK (
    (scope_type = 'PILOT' AND category_slug IS NULL)
    OR (scope_type = 'CATEGORY' AND category_slug IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_pilot_kpi_latest
  ON pilot_kpi_snapshots(pilot_id, scope_type, category_slug, period_end DESC, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pilot_kpi_review
  ON pilot_kpi_snapshots(status, period_end DESC, evaluated_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_pilot_programs_core_immutable
BEFORE UPDATE OF id, name, model_version, category_limit, candidate_limit_per_category,
  top_limit_per_category, content_items_per_category, config_checksum, created_by, created_at
ON pilot_programs BEGIN
  SELECT RAISE(ABORT, 'pilot program configuration is immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_pilot_programs_no_delete
BEFORE DELETE ON pilot_programs BEGIN
  SELECT RAISE(ABORT, 'pilot programs are audit records');
END;
CREATE TRIGGER IF NOT EXISTS trg_pilot_categories_no_update
BEFORE UPDATE ON pilot_categories BEGIN
  SELECT RAISE(ABORT, 'pilot category scope is immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_pilot_categories_no_delete
BEFORE DELETE ON pilot_categories BEGIN
  SELECT RAISE(ABORT, 'pilot category scope is immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_pilot_selection_runs_no_update
BEFORE UPDATE ON pilot_selection_runs BEGIN
  SELECT RAISE(ABORT, 'pilot selection runs are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_pilot_selection_runs_no_delete
BEFORE DELETE ON pilot_selection_runs BEGIN
  SELECT RAISE(ABORT, 'pilot selection runs are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_pilot_selections_no_update
BEFORE UPDATE ON pilot_opportunity_selections BEGIN
  SELECT RAISE(ABORT, 'pilot opportunity selections are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_pilot_selections_no_delete
BEFORE DELETE ON pilot_opportunity_selections BEGIN
  SELECT RAISE(ABORT, 'pilot opportunity selections are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_pilot_content_core_immutable
BEFORE UPDATE OF id, selection_run_id, pilot_id, category_slug, slot_ordinal, slot_type,
  opportunity_id, top_rank, recommended_action, target_url_id, created_at
ON pilot_content_work_items BEGIN
  SELECT RAISE(ABORT, 'pilot content work-item scope is immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_pilot_content_no_delete
BEFORE DELETE ON pilot_content_work_items BEGIN
  SELECT RAISE(ABORT, 'pilot content work items are audit records');
END;
CREATE TRIGGER IF NOT EXISTS trg_pilot_kpi_no_update
BEFORE UPDATE ON pilot_kpi_snapshots BEGIN
  SELECT RAISE(ABORT, 'pilot KPI snapshots are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_pilot_kpi_no_delete
BEFORE DELETE ON pilot_kpi_snapshots BEGIN
  SELECT RAISE(ABORT, 'pilot KPI snapshots are immutable');
END;

PRAGMA optimize;

-- migrate:down
DROP TRIGGER IF EXISTS trg_pilot_kpi_no_delete;
DROP TRIGGER IF EXISTS trg_pilot_kpi_no_update;
DROP TRIGGER IF EXISTS trg_pilot_content_no_delete;
DROP TRIGGER IF EXISTS trg_pilot_content_core_immutable;
DROP TRIGGER IF EXISTS trg_pilot_selections_no_delete;
DROP TRIGGER IF EXISTS trg_pilot_selections_no_update;
DROP TRIGGER IF EXISTS trg_pilot_selection_runs_no_delete;
DROP TRIGGER IF EXISTS trg_pilot_selection_runs_no_update;
DROP TRIGGER IF EXISTS trg_pilot_categories_no_delete;
DROP TRIGGER IF EXISTS trg_pilot_categories_no_update;
DROP TRIGGER IF EXISTS trg_pilot_programs_no_delete;
DROP TRIGGER IF EXISTS trg_pilot_programs_core_immutable;
DROP TABLE IF EXISTS pilot_kpi_snapshots;
DROP TABLE IF EXISTS pilot_content_work_items;
DROP TABLE IF EXISTS pilot_opportunity_selections;
DROP TABLE IF EXISTS pilot_selection_runs;
DROP TABLE IF EXISTS pilot_categories;
DROP TABLE IF EXISTS pilot_programs;
