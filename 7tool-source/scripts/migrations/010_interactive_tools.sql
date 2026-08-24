-- migrate:up
CREATE TABLE IF NOT EXISTS interactive_tool_sets (
  id TEXT PRIMARY KEY,
  tool_key TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  tool_type TEXT NOT NULL CHECK (tool_type IN (
    'ANNULAR_CUTTER_RPM', 'MAGNETIC_DRILL_SELECTOR', 'BEVELER_SELECTOR',
    'PIPE_CUTTER_SELECTOR', 'COMPATIBILITY_TABLE'
  )),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  h1 TEXT NOT NULL,
  meta_title TEXT NOT NULL,
  meta_description TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'DRAFT', 'APPROVED', 'PUBLISHED', 'SUPERSEDED', 'STALE', 'REJECTED'
  )),
  index_status TEXT NOT NULL DEFAULT 'NOINDEX' CHECK (index_status IN ('INDEX', 'NOINDEX')),
  opportunity_id TEXT REFERENCES content_opportunities(id),
  engine_version TEXT NOT NULL,
  evidence_fingerprint TEXT NOT NULL,
  generated_by_actor_type TEXT NOT NULL CHECK (generated_by_actor_type IN (
    'HUMAN', 'SYSTEM', 'AI_ASSISTED'
  )),
  generated_by_actor_id TEXT NOT NULL,
  generated_by_ai INTEGER NOT NULL DEFAULT 0 CHECK (generated_by_ai IN (0, 1)),
  rule_count INTEGER NOT NULL DEFAULT 0 CHECK (rule_count >= 0),
  approved_by TEXT,
  approved_at INTEGER,
  published_by TEXT,
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (slug != '' AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT LIKE '-%' AND slug NOT LIKE '%-' AND slug NOT LIKE '%--%'),
  CHECK (tool_type != 'ANNULAR_CUTTER_RPM' OR rule_count > 0),
  CHECK (tool_type = 'ANNULAR_CUTTER_RPM' OR rule_count = 0),
  CHECK (status NOT IN ('APPROVED', 'PUBLISHED', 'SUPERSEDED', 'STALE') OR (
    approved_by IS NOT NULL AND approved_at IS NOT NULL
  )),
  CHECK (status NOT IN ('PUBLISHED', 'SUPERSEDED', 'STALE') OR (
    published_by IS NOT NULL AND published_at IS NOT NULL
  )),
  UNIQUE (tool_key, version),
  UNIQUE (tool_key, evidence_fingerprint)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_interactive_tools_one_published_key
  ON interactive_tool_sets(tool_key) WHERE status = 'PUBLISHED';
CREATE UNIQUE INDEX IF NOT EXISTS idx_interactive_tools_one_published_slug
  ON interactive_tool_sets(slug) WHERE status = 'PUBLISHED';
CREATE INDEX IF NOT EXISTS idx_interactive_tools_public
  ON interactive_tool_sets(published_at DESC, title, slug)
  WHERE status = 'PUBLISHED';
CREATE INDEX IF NOT EXISTS idx_interactive_tools_queue
  ON interactive_tool_sets(status, updated_at DESC, tool_type);
CREATE INDEX IF NOT EXISTS idx_interactive_tools_history
  ON interactive_tool_sets(tool_key, version DESC, status);

CREATE TABLE IF NOT EXISTS interactive_tool_rules (
  id TEXT PRIMARY KEY,
  tool_set_id TEXT NOT NULL REFERENCES interactive_tool_sets(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type = 'CUTTING_SPEED_M_PER_MIN'),
  cutter_type TEXT NOT NULL,
  material TEXT NOT NULL,
  output_value REAL NOT NULL CHECK (output_value > 0),
  output_unit TEXT NOT NULL CHECK (output_unit = 'm/min'),
  assertion_id TEXT NOT NULL REFERENCES fact_assertions(id),
  evidence_checksum TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  CHECK (cutter_type != '' AND material != ''),
  UNIQUE (tool_set_id, cutter_type, material),
  UNIQUE (tool_set_id, evidence_checksum)
);
CREATE INDEX IF NOT EXISTS idx_interactive_tool_rules_set
  ON interactive_tool_rules(tool_set_id, cutter_type, material, sort_order);
CREATE INDEX IF NOT EXISTS idx_interactive_tool_rules_assertion
  ON interactive_tool_rules(assertion_id, tool_set_id);

CREATE TABLE IF NOT EXISTS interactive_tool_reviews (
  id TEXT PRIMARY KEY,
  tool_set_id TEXT NOT NULL REFERENCES interactive_tool_sets(id),
  decision TEXT NOT NULL CHECK (decision IN ('APPROVE', 'PUBLISH', 'REJECT', 'MARK_STALE')),
  reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('HUMAN', 'SYSTEM')),
  reviewer_id TEXT NOT NULL,
  evidence_fingerprint TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_interactive_tool_reviews_set
  ON interactive_tool_reviews(tool_set_id, created_at DESC);

CREATE TABLE IF NOT EXISTS interactive_tool_audit_events (
  id TEXT PRIMARY KEY,
  tool_set_id TEXT NOT NULL REFERENCES interactive_tool_sets(id),
  tool_key TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('HUMAN', 'SYSTEM', 'AI_ASSISTED')),
  actor_id TEXT NOT NULL,
  details_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_interactive_tool_audit_set
  ON interactive_tool_audit_events(tool_set_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactive_tool_audit_key
  ON interactive_tool_audit_events(tool_key, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_interactive_tool_rules_no_update
BEFORE UPDATE ON interactive_tool_rules BEGIN
  SELECT RAISE(ABORT, 'interactive tool rules are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_interactive_tool_rules_no_delete
BEFORE DELETE ON interactive_tool_rules BEGIN
  SELECT RAISE(ABORT, 'interactive tool rules are append-only');
END;
CREATE TRIGGER IF NOT EXISTS trg_interactive_tool_reviews_no_update
BEFORE UPDATE ON interactive_tool_reviews BEGIN
  SELECT RAISE(ABORT, 'interactive tool reviews are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_interactive_tool_reviews_no_delete
BEFORE DELETE ON interactive_tool_reviews BEGIN
  SELECT RAISE(ABORT, 'interactive tool reviews are append-only');
END;
CREATE TRIGGER IF NOT EXISTS trg_interactive_tool_audit_no_update
BEFORE UPDATE ON interactive_tool_audit_events BEGIN
  SELECT RAISE(ABORT, 'interactive tool audit events are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_interactive_tool_audit_no_delete
BEFORE DELETE ON interactive_tool_audit_events BEGIN
  SELECT RAISE(ABORT, 'interactive tool audit events are append-only');
END;
CREATE TRIGGER IF NOT EXISTS trg_interactive_tool_set_content_immutable
BEFORE UPDATE OF tool_key, version, tool_type, slug, title, h1, meta_title,
  meta_description, description, index_status, opportunity_id, engine_version,
  evidence_fingerprint, generated_by_actor_type, generated_by_actor_id,
  generated_by_ai, rule_count, created_at
ON interactive_tool_sets BEGIN
  SELECT RAISE(ABORT, 'interactive tool set content is immutable; create a new version');
END;

PRAGMA optimize;

-- migrate:down
DROP TRIGGER IF EXISTS trg_interactive_tool_set_content_immutable;
DROP TRIGGER IF EXISTS trg_interactive_tool_audit_no_delete;
DROP TRIGGER IF EXISTS trg_interactive_tool_audit_no_update;
DROP TRIGGER IF EXISTS trg_interactive_tool_reviews_no_delete;
DROP TRIGGER IF EXISTS trg_interactive_tool_reviews_no_update;
DROP TRIGGER IF EXISTS trg_interactive_tool_rules_no_delete;
DROP TRIGGER IF EXISTS trg_interactive_tool_rules_no_update;
DROP TABLE IF EXISTS interactive_tool_audit_events;
DROP TABLE IF EXISTS interactive_tool_reviews;
DROP TABLE IF EXISTS interactive_tool_rules;
DROP TABLE IF EXISTS interactive_tool_sets;
