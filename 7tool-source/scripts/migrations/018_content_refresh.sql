-- migrate:up
CREATE TABLE IF NOT EXISTS content_refresh_runs (
  id TEXT PRIMARY KEY,
  period_start TEXT NOT NULL CHECK (period_start GLOB '????-??-??'),
  period_end TEXT NOT NULL CHECK (period_end GLOB '????-??-??'),
  previous_period_start TEXT NOT NULL CHECK (previous_period_start GLOB '????-??-??'),
  previous_period_end TEXT NOT NULL CHECK (previous_period_end GLOB '????-??-??'),
  google_property_uri TEXT NOT NULL CHECK (length(google_property_uri) BETWEEN 8 AND 500),
  yandex_subject_ref TEXT NOT NULL CHECK (length(yandex_subject_ref) BETWEEN 1 AND 300),
  high_impressions_threshold REAL NOT NULL CHECK (high_impressions_threshold > 0),
  expected_ctr_curve_json TEXT NOT NULL,
  expected_ctr_source_ref TEXT NOT NULL CHECK (length(expected_ctr_source_ref) BETWEEN 10 AND 500),
  minimum_pruning_days INTEGER NOT NULL CHECK (minimum_pruning_days >= 30),
  semantic_similarity_threshold REAL NOT NULL CHECK (
    semantic_similarity_threshold >= 0.5 AND semantic_similarity_threshold <= 1
  ),
  source_run_ids_json TEXT NOT NULL,
  model_version TEXT NOT NULL,
  evidence_checksum TEXT NOT NULL UNIQUE CHECK (length(evidence_checksum) = 64),
  evaluated_by TEXT NOT NULL CHECK (length(evaluated_by) BETWEEN 2 AND 200),
  evaluated_at INTEGER NOT NULL,
  CHECK (period_end >= period_start),
  CHECK (previous_period_end >= previous_period_start),
  CHECK (previous_period_end < period_start)
);
CREATE INDEX IF NOT EXISTS idx_content_refresh_runs_period
  ON content_refresh_runs(period_end DESC, evaluated_at DESC);

CREATE TABLE IF NOT EXISTS content_refresh_assessments (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES content_refresh_runs(id) ON DELETE RESTRICT,
  content_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE RESTRICT,
  revision_id TEXT NOT NULL REFERENCES content_revisions(id) ON DELETE RESTRICT,
  site_url_id TEXT NOT NULL REFERENCES site_urls(id) ON DELETE RESTRICT,
  page_path TEXT NOT NULL CHECK (page_path LIKE '/%' AND instr(page_path, '?') = 0),
  impressions REAL NOT NULL CHECK (impressions >= 0),
  clicks REAL NOT NULL CHECK (clicks >= 0 AND clicks <= impressions),
  ctr REAL NOT NULL CHECK (ctr BETWEEN 0 AND 1),
  expected_ctr REAL NOT NULL CHECK (expected_ctr BETWEEN 0 AND 1),
  average_position REAL CHECK (average_position IS NULL OR average_position >= 0),
  current_query_count INTEGER NOT NULL CHECK (current_query_count >= 0),
  previous_query_count INTEGER NOT NULL CHECK (previous_query_count >= 0),
  new_query_count INTEGER NOT NULL CHECK (new_query_count >= 0),
  query_cluster_expanded INTEGER NOT NULL CHECK (query_cluster_expanded IN (0, 1)),
  inbound_link_count INTEGER NOT NULL CHECK (inbound_link_count >= 0),
  organic_leads INTEGER CHECK (organic_leads IS NULL OR organic_leads >= 0),
  roi_snapshot_id TEXT REFERENCES content_roi_snapshots(id) ON DELETE RESTRICT,
  update_priority TEXT NOT NULL CHECK (update_priority IN ('NONE', 'NORMAL', 'HIGH')),
  recommended_update TEXT NOT NULL CHECK (recommended_update IN (
    'MONITOR', 'IMPROVE_TITLE_DESCRIPTION', 'EXPAND_CONTENT', 'COMPREHENSIVE_UPDATE'
  )),
  duplicate_similarity REAL NOT NULL CHECK (duplicate_similarity BETWEEN 0 AND 1),
  duplicate_page_path TEXT,
  duplicate_risk TEXT NOT NULL CHECK (duplicate_risk IN ('LOW', 'MEDIUM', 'HIGH')),
  duplicate_evidence_json TEXT NOT NULL,
  cannibalization_risk TEXT NOT NULL CHECK (cannibalization_risk IN ('LOW', 'MEDIUM', 'HIGH')),
  cannibalization_evidence_json TEXT NOT NULL,
  pruning_eligible INTEGER NOT NULL CHECK (pruning_eligible IN (0, 1)),
  system_recommendation TEXT NOT NULL CHECK (system_recommendation IN ('KEEP', 'UPDATE', 'MERGE')),
  reason_codes_json TEXT NOT NULL,
  evidence_checksum TEXT NOT NULL UNIQUE CHECK (length(evidence_checksum) = 64),
  status TEXT NOT NULL CHECK (status = 'REVIEW_REQUIRED'),
  evaluated_at INTEGER NOT NULL,
  UNIQUE (run_id, content_id)
);
CREATE INDEX IF NOT EXISTS idx_content_refresh_review_queue
  ON content_refresh_assessments(status, update_priority, impressions DESC, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_refresh_content_history
  ON content_refresh_assessments(content_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_refresh_decay
  ON content_refresh_assessments(pruning_eligible, system_recommendation, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_refresh_collisions
  ON content_refresh_assessments(cannibalization_risk, duplicate_risk, evaluated_at DESC);

CREATE TABLE IF NOT EXISTS content_refresh_reviews (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES content_refresh_assessments(id) ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK (decision IN (
    'KEEP', 'UPDATE', 'MERGE', 'REDIRECT', 'NOINDEX', 'DELETE'
  )),
  target_site_url_id TEXT REFERENCES site_urls(id) ON DELETE RESTRICT,
  rationale TEXT NOT NULL CHECK (length(rationale) BETWEEN 40 AND 2000),
  reviewed_by TEXT NOT NULL CHECK (length(reviewed_by) BETWEEN 2 AND 200),
  reviewed_at INTEGER NOT NULL,
  CHECK (
    (decision IN ('MERGE', 'REDIRECT') AND target_site_url_id IS NOT NULL)
    OR (decision NOT IN ('MERGE', 'REDIRECT') AND target_site_url_id IS NULL)
  ),
  UNIQUE (assessment_id)
);
CREATE INDEX IF NOT EXISTS idx_content_refresh_reviews_decision
  ON content_refresh_reviews(decision, reviewed_at DESC);

CREATE TABLE IF NOT EXISTS experts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK (length(name) BETWEEN 3 AND 200),
  photo_path TEXT NOT NULL CHECK (
    photo_path LIKE '/media/%' OR photo_path LIKE '/uploads/%'
  ),
  photo_rights_ref TEXT NOT NULL CHECK (length(photo_rights_ref) BETWEEN 10 AND 500),
  specialization TEXT NOT NULL CHECK (length(specialization) BETWEEN 20 AND 1000),
  experience_text TEXT NOT NULL CHECK (length(experience_text) BETWEEN 20 AND 2000),
  identity_evidence_ref TEXT NOT NULL CHECK (length(identity_evidence_ref) BETWEEN 10 AND 500),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
  reviewed_by TEXT NOT NULL CHECK (length(reviewed_by) BETWEEN 2 AND 200),
  reviewed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_experts_active
  ON experts(status, name);

CREATE TABLE IF NOT EXISTS expert_categories (
  expert_id TEXT NOT NULL REFERENCES experts(id) ON DELETE RESTRICT,
  category_slug TEXT NOT NULL REFERENCES categories(slug) ON DELETE RESTRICT,
  PRIMARY KEY (expert_id, category_slug)
);
CREATE INDEX IF NOT EXISTS idx_expert_categories_scope
  ON expert_categories(category_slug, expert_id);

CREATE TABLE IF NOT EXISTS expert_brands (
  expert_id TEXT NOT NULL REFERENCES experts(id) ON DELETE RESTRICT,
  brand TEXT NOT NULL CHECK (length(brand) BETWEEN 1 AND 200),
  PRIMARY KEY (expert_id, brand)
);
CREATE INDEX IF NOT EXISTS idx_expert_brands_scope
  ON expert_brands(brand, expert_id);

CREATE TABLE IF NOT EXISTS content_expert_reviews (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE RESTRICT,
  revision_id TEXT NOT NULL REFERENCES content_revisions(id) ON DELETE RESTRICT,
  expert_id TEXT NOT NULL REFERENCES experts(id) ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
  review_statement TEXT NOT NULL CHECK (length(review_statement) BETWEEN 40 AND 2000),
  assigned_by TEXT NOT NULL CHECK (length(assigned_by) BETWEEN 2 AND 200),
  reviewed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (content_id, revision_id, expert_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_expert_one_approved
  ON content_expert_reviews(content_id, revision_id)
  WHERE decision = 'APPROVED';
CREATE INDEX IF NOT EXISTS idx_content_expert_profile
  ON content_expert_reviews(expert_id, decision, reviewed_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_content_refresh_runs_no_update
BEFORE UPDATE ON content_refresh_runs BEGIN
  SELECT RAISE(ABORT, 'content refresh runs are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_content_refresh_runs_no_delete
BEFORE DELETE ON content_refresh_runs BEGIN
  SELECT RAISE(ABORT, 'content refresh runs are audit records');
END;
CREATE TRIGGER IF NOT EXISTS trg_content_refresh_assessments_no_update
BEFORE UPDATE ON content_refresh_assessments BEGIN
  SELECT RAISE(ABORT, 'content refresh assessments are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_content_refresh_assessments_no_delete
BEFORE DELETE ON content_refresh_assessments BEGIN
  SELECT RAISE(ABORT, 'content refresh assessments are audit records');
END;
CREATE TRIGGER IF NOT EXISTS trg_content_refresh_reviews_no_update
BEFORE UPDATE ON content_refresh_reviews BEGIN
  SELECT RAISE(ABORT, 'content refresh reviews are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_content_refresh_reviews_no_delete
BEFORE DELETE ON content_refresh_reviews BEGIN
  SELECT RAISE(ABORT, 'content refresh reviews are audit records');
END;
CREATE TRIGGER IF NOT EXISTS trg_experts_core_immutable
BEFORE UPDATE OF id, name, photo_path, photo_rights_ref, specialization,
  experience_text, identity_evidence_ref, reviewed_by, reviewed_at, created_at
ON experts BEGIN
  SELECT RAISE(ABORT, 'expert identity evidence is immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_experts_no_delete
BEFORE DELETE ON experts BEGIN
  SELECT RAISE(ABORT, 'expert profiles are audit records');
END;
CREATE TRIGGER IF NOT EXISTS trg_expert_categories_no_update
BEFORE UPDATE ON expert_categories BEGIN
  SELECT RAISE(ABORT, 'expert category scope is immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_expert_categories_no_delete
BEFORE DELETE ON expert_categories BEGIN
  SELECT RAISE(ABORT, 'expert category scope is an audit record');
END;
CREATE TRIGGER IF NOT EXISTS trg_expert_brands_no_update
BEFORE UPDATE ON expert_brands BEGIN
  SELECT RAISE(ABORT, 'expert brand scope is immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_expert_brands_no_delete
BEFORE DELETE ON expert_brands BEGIN
  SELECT RAISE(ABORT, 'expert brand scope is an audit record');
END;
CREATE TRIGGER IF NOT EXISTS trg_content_expert_reviews_no_update
BEFORE UPDATE ON content_expert_reviews BEGIN
  SELECT RAISE(ABORT, 'expert reviews are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_content_expert_reviews_no_delete
BEFORE DELETE ON content_expert_reviews BEGIN
  SELECT RAISE(ABORT, 'expert reviews are audit records');
END;

PRAGMA optimize;

-- migrate:down
DROP TRIGGER IF EXISTS trg_content_expert_reviews_no_delete;
DROP TRIGGER IF EXISTS trg_content_expert_reviews_no_update;
DROP TRIGGER IF EXISTS trg_expert_brands_no_delete;
DROP TRIGGER IF EXISTS trg_expert_brands_no_update;
DROP TRIGGER IF EXISTS trg_expert_categories_no_delete;
DROP TRIGGER IF EXISTS trg_expert_categories_no_update;
DROP TRIGGER IF EXISTS trg_experts_no_delete;
DROP TRIGGER IF EXISTS trg_experts_core_immutable;
DROP TRIGGER IF EXISTS trg_content_refresh_reviews_no_delete;
DROP TRIGGER IF EXISTS trg_content_refresh_reviews_no_update;
DROP TRIGGER IF EXISTS trg_content_refresh_assessments_no_delete;
DROP TRIGGER IF EXISTS trg_content_refresh_assessments_no_update;
DROP TRIGGER IF EXISTS trg_content_refresh_runs_no_delete;
DROP TRIGGER IF EXISTS trg_content_refresh_runs_no_update;
DROP TABLE IF EXISTS content_expert_reviews;
DROP TABLE IF EXISTS expert_brands;
DROP TABLE IF EXISTS expert_categories;
DROP TABLE IF EXISTS experts;
DROP TABLE IF EXISTS content_refresh_reviews;
DROP TABLE IF EXISTS content_refresh_assessments;
DROP TABLE IF EXISTS content_refresh_runs;
