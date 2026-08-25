-- migrate:up
CREATE TABLE IF NOT EXISTS content_scale_programs (
  id TEXT PRIMARY KEY,
  scope_key TEXT NOT NULL DEFAULT 'GLOBAL' CHECK (scope_key = 'GLOBAL'),
  pilot_id TEXT NOT NULL UNIQUE REFERENCES pilot_programs(id) ON DELETE RESTRICT,
  pilot_kpi_snapshot_id TEXT NOT NULL REFERENCES pilot_kpi_snapshots(id) ON DELETE RESTRICT,
  model_version TEXT NOT NULL,
  current_checkpoint INTEGER NOT NULL CHECK (current_checkpoint IN (25, 50, 100, 250)),
  pilot_success_rationale TEXT NOT NULL CHECK (length(pilot_success_rationale) BETWEEN 40 AND 2000),
  status TEXT NOT NULL CHECK (status IN (
    'REVIEW_REQUIRED', 'ACTIVE', 'SCORE_DRIVEN', 'PAUSED', 'REJECTED', 'COMPLETED'
  )),
  created_by TEXT NOT NULL CHECK (length(created_by) BETWEEN 2 AND 200),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (status = 'REVIEW_REQUIRED' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (status != 'REVIEW_REQUIRED' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_scale_one_active
  ON content_scale_programs(scope_key)
  WHERE status IN ('ACTIVE', 'SCORE_DRIVEN');
CREATE INDEX IF NOT EXISTS idx_content_scale_status
  ON content_scale_programs(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS content_scale_checkpoint_reviews (
  id TEXT PRIMARY KEY,
  scale_program_id TEXT NOT NULL REFERENCES content_scale_programs(id) ON DELETE RESTRICT,
  checkpoint_size INTEGER NOT NULL CHECK (checkpoint_size IN (25, 50, 100, 250)),
  observed_published_count INTEGER NOT NULL CHECK (observed_published_count >= checkpoint_size),
  kpi_snapshot_id TEXT NOT NULL REFERENCES pilot_kpi_snapshots(id) ON DELETE RESTRICT,
  success_rationale TEXT NOT NULL CHECK (length(success_rationale) BETWEEN 40 AND 2000),
  status TEXT NOT NULL CHECK (status IN ('REVIEW_REQUIRED', 'APPROVED', 'REJECTED')),
  created_by TEXT NOT NULL CHECK (length(created_by) BETWEEN 2 AND 200),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (scale_program_id, checkpoint_size),
  CHECK (
    (status = 'REVIEW_REQUIRED' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (status IN ('APPROVED', 'REJECTED') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_scale_checkpoint_review
  ON content_scale_checkpoint_reviews(scale_program_id, status, checkpoint_size DESC);

CREATE TABLE IF NOT EXISTS content_quality_scorecards (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE RESTRICT,
  revision_id TEXT NOT NULL REFERENCES content_revisions(id) ON DELETE RESTRICT,
  intent_match INTEGER NOT NULL CHECK (intent_match BETWEEN 0 AND 100),
  technical_accuracy INTEGER NOT NULL CHECK (technical_accuracy BETWEEN 0 AND 100),
  original_value INTEGER NOT NULL CHECK (original_value BETWEEN 0 AND 100),
  practical_value INTEGER NOT NULL CHECK (practical_value BETWEEN 0 AND 100),
  evidence_component INTEGER NOT NULL CHECK (evidence_component BETWEEN 0 AND 100),
  visual_value INTEGER NOT NULL CHECK (visual_value BETWEEN 0 AND 100),
  seo INTEGER NOT NULL CHECK (seo BETWEEN 0 AND 100),
  internal_linking INTEGER NOT NULL CHECK (internal_linking BETWEEN 0 AND 100),
  conversion_value INTEGER NOT NULL CHECK (conversion_value BETWEEN 0 AND 100),
  readability INTEGER NOT NULL CHECK (readability BETWEEN 0 AND 100),
  quality_score INTEGER NOT NULL CHECK (quality_score BETWEEN 0 AND 100),
  weights_json TEXT NOT NULL,
  evidence_score INTEGER NOT NULL CHECK (evidence_score BETWEEN 0 AND 100),
  evidence_breakdown_json TEXT NOT NULL,
  differentiation_score INTEGER NOT NULL CHECK (differentiation_score BETWEEN 0 AND 100),
  differentiation_rationale TEXT NOT NULL CHECK (length(differentiation_rationale) BETWEEN 40 AND 2000),
  differentiation_proof_json TEXT NOT NULL,
  manual_hard_fail_json TEXT NOT NULL,
  hard_fail INTEGER NOT NULL CHECK (hard_fail IN (0, 1)),
  hard_fail_codes_json TEXT NOT NULL,
  hard_fail_evidence_json TEXT NOT NULL,
  model_version TEXT NOT NULL,
  evidence_checksum TEXT NOT NULL UNIQUE CHECK (length(evidence_checksum) = 64),
  status TEXT NOT NULL CHECK (status IN ('REVIEW_REQUIRED', 'APPROVED', 'REJECTED', 'SUPERSEDED')),
  assessed_by TEXT NOT NULL CHECK (length(assessed_by) BETWEEN 2 AND 200),
  assessed_at INTEGER NOT NULL,
  reviewed_by TEXT,
  reviewed_at INTEGER,
  CHECK (
    quality_score = CAST(ROUND((
      intent_match * 15 + technical_accuracy * 20 + original_value * 15
      + practical_value * 15 + evidence_component * 10 + visual_value * 5
      + seo * 5 + internal_linking * 5 + conversion_value * 5 + readability * 5
    ) / 100.0) AS INTEGER)
  ),
  CHECK (
    (status = 'REVIEW_REQUIRED' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (status != 'REVIEW_REQUIRED' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  ),
  CHECK (
    status != 'APPROVED'
    OR (quality_score >= 85 AND evidence_score >= 80
      AND differentiation_score >= 60 AND hard_fail = 0)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_scorecard_one_approved
  ON content_quality_scorecards(content_id, revision_id)
  WHERE status = 'APPROVED';
CREATE INDEX IF NOT EXISTS idx_content_scorecard_latest
  ON content_quality_scorecards(content_id, revision_id, status, assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_scorecard_review
  ON content_quality_scorecards(status, quality_score DESC, assessed_at DESC);

CREATE TABLE IF NOT EXISTS content_publish_queue (
  id TEXT PRIMARY KEY,
  scale_program_id TEXT NOT NULL REFERENCES content_scale_programs(id) ON DELETE RESTRICT,
  scorecard_id TEXT NOT NULL REFERENCES content_quality_scorecards(id) ON DELETE RESTRICT,
  content_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN (
    'ARTICLE', 'GUIDE', 'HOW_TO', 'COMPARISON', 'TROUBLESHOOTING',
    'COMPATIBILITY', 'CASE_STUDY', 'TEST', 'REFERENCE', 'FAQ'
  )),
  priority INTEGER NOT NULL CHECK (priority BETWEEN 0 AND 100),
  category TEXT NOT NULL REFERENCES categories(slug) ON DELETE RESTRICT,
  scheduled_at INTEGER NOT NULL,
  approved_by TEXT,
  approved_at INTEGER,
  status TEXT NOT NULL CHECK (status IN (
    'REVIEW_REQUIRED', 'APPROVED', 'PUBLISHED', 'REJECTED', 'CANCELLED', 'BLOCKED'
  )),
  requested_by TEXT NOT NULL CHECK (length(requested_by) BETWEEN 2 AND 200),
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (status IN ('APPROVED', 'PUBLISHED') AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
    OR status NOT IN ('APPROVED', 'PUBLISHED')
  ),
  CHECK (status != 'PUBLISHED' OR published_at IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_publish_queue_one_active
  ON content_publish_queue(content_id)
  WHERE status IN ('REVIEW_REQUIRED', 'APPROVED');
CREATE INDEX IF NOT EXISTS idx_content_publish_queue_dispatch
  ON content_publish_queue(status, scheduled_at, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_content_publish_queue_scale
  ON content_publish_queue(scale_program_id, status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_content_publish_queue_category
  ON content_publish_queue(category, status, priority DESC);

CREATE TRIGGER IF NOT EXISTS trg_content_scale_core_immutable
BEFORE UPDATE OF id, scope_key, pilot_id, pilot_kpi_snapshot_id, model_version,
  pilot_success_rationale, created_by, created_at
ON content_scale_programs BEGIN
  SELECT RAISE(ABORT, 'scale program evidence is immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_content_scale_no_delete
BEFORE DELETE ON content_scale_programs BEGIN
  SELECT RAISE(ABORT, 'scale programs are audit records');
END;
CREATE TRIGGER IF NOT EXISTS trg_scale_checkpoint_core_immutable
BEFORE UPDATE OF id, scale_program_id, checkpoint_size, observed_published_count,
  kpi_snapshot_id, success_rationale, created_by, created_at
ON content_scale_checkpoint_reviews BEGIN
  SELECT RAISE(ABORT, 'scale checkpoint evidence is immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_scale_checkpoint_no_delete
BEFORE DELETE ON content_scale_checkpoint_reviews BEGIN
  SELECT RAISE(ABORT, 'scale checkpoint reviews are audit records');
END;
CREATE TRIGGER IF NOT EXISTS trg_content_scorecard_core_immutable
BEFORE UPDATE OF id, content_id, revision_id, intent_match, technical_accuracy,
  original_value, practical_value, evidence_component, visual_value, seo,
  internal_linking, conversion_value, readability, quality_score, weights_json,
  evidence_score, evidence_breakdown_json, differentiation_score,
  differentiation_rationale, differentiation_proof_json, manual_hard_fail_json,
  hard_fail, hard_fail_codes_json, hard_fail_evidence_json, model_version,
  evidence_checksum, assessed_by, assessed_at
ON content_quality_scorecards BEGIN
  SELECT RAISE(ABORT, 'content scorecard evidence is immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_content_scorecard_no_delete
BEFORE DELETE ON content_quality_scorecards BEGIN
  SELECT RAISE(ABORT, 'content scorecards are audit records');
END;
CREATE TRIGGER IF NOT EXISTS trg_content_publish_queue_core_immutable
BEFORE UPDATE OF id, scale_program_id, scorecard_id, content_id, type,
  priority, category, scheduled_at, requested_by, created_at
ON content_publish_queue BEGIN
  SELECT RAISE(ABORT, 'publish queue scope is immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_content_publish_queue_no_delete
BEFORE DELETE ON content_publish_queue BEGIN
  SELECT RAISE(ABORT, 'publish queue entries are audit records');
END;

PRAGMA optimize;

-- migrate:down
DROP TRIGGER IF EXISTS trg_content_publish_queue_no_delete;
DROP TRIGGER IF EXISTS trg_content_publish_queue_core_immutable;
DROP TRIGGER IF EXISTS trg_content_scorecard_no_delete;
DROP TRIGGER IF EXISTS trg_content_scorecard_core_immutable;
DROP TRIGGER IF EXISTS trg_scale_checkpoint_no_delete;
DROP TRIGGER IF EXISTS trg_scale_checkpoint_core_immutable;
DROP TRIGGER IF EXISTS trg_content_scale_no_delete;
DROP TRIGGER IF EXISTS trg_content_scale_core_immutable;
DROP TABLE IF EXISTS content_publish_queue;
DROP TABLE IF EXISTS content_quality_scorecards;
DROP TABLE IF EXISTS content_scale_checkpoint_reviews;
DROP TABLE IF EXISTS content_scale_programs;
