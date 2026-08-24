-- migrate:up
CREATE TABLE IF NOT EXISTS semantic_link_sets (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'ARTICLE', 'PRODUCT', 'CATEGORY', 'CALCULATOR', 'COMPARISON'
  )),
  source_id TEXT NOT NULL,
  source_path TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL CHECK (status IN (
    'DRAFT', 'APPROVED', 'PUBLISHED', 'SUPERSEDED', 'STALE', 'REJECTED'
  )),
  engine_version TEXT NOT NULL,
  evidence_fingerprint TEXT NOT NULL,
  generated_by_actor_type TEXT NOT NULL CHECK (generated_by_actor_type IN (
    'HUMAN', 'SYSTEM', 'AI_ASSISTED'
  )),
  generated_by_actor_id TEXT NOT NULL,
  generated_by_ai INTEGER NOT NULL DEFAULT 0 CHECK (generated_by_ai IN (0, 1)),
  safety_issues_json TEXT NOT NULL,
  hard_fail INTEGER NOT NULL CHECK (hard_fail IN (0, 1)),
  item_count INTEGER NOT NULL CHECK (item_count > 0),
  approved_by TEXT,
  approved_at INTEGER,
  published_by TEXT,
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (source_id != '' AND source_path LIKE '/%'),
  CHECK (status NOT IN ('APPROVED', 'PUBLISHED', 'SUPERSEDED', 'STALE') OR (
    approved_by IS NOT NULL AND approved_at IS NOT NULL AND hard_fail = 0
  )),
  CHECK (status NOT IN ('PUBLISHED', 'SUPERSEDED', 'STALE') OR (
    published_by IS NOT NULL AND published_at IS NOT NULL
  )),
  UNIQUE (source_type, source_id, version),
  UNIQUE (source_type, source_id, evidence_fingerprint)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_semantic_links_one_published
  ON semantic_link_sets(source_type, source_id) WHERE status = 'PUBLISHED';
CREATE INDEX IF NOT EXISTS idx_semantic_links_public
  ON semantic_link_sets(source_type, source_id, version DESC)
  WHERE status = 'PUBLISHED';
CREATE INDEX IF NOT EXISTS idx_semantic_links_queue
  ON semantic_link_sets(status, updated_at DESC, source_type);
CREATE INDEX IF NOT EXISTS idx_semantic_links_history
  ON semantic_link_sets(source_type, source_id, version DESC, status);

CREATE TABLE IF NOT EXISTS semantic_link_items (
  id TEXT PRIMARY KEY,
  link_set_id TEXT NOT NULL REFERENCES semantic_link_sets(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'ARTICLE', 'PRODUCT', 'CATEGORY', 'CALCULATOR', 'COMPARISON'
  )),
  relation_type TEXT NOT NULL CHECK (relation_type IN (
    'ARTICLE_TO_CATEGORY', 'ARTICLE_TO_PRODUCT', 'ARTICLE_TO_ARTICLE',
    'PRODUCT_TO_ARTICLE', 'PRODUCT_TO_COMPATIBILITY', 'CATEGORY_TO_GUIDE',
    'CALCULATOR_TO_PRODUCT', 'COMPARISON_TO_PRODUCT'
  )),
  target_type TEXT NOT NULL CHECK (target_type IN (
    'ARTICLE', 'PRODUCT', 'CATEGORY', 'GUIDE', 'COMPATIBILITY'
  )),
  target_id TEXT NOT NULL,
  target_path TEXT NOT NULL,
  anchor_text TEXT NOT NULL,
  next_question TEXT NOT NULL,
  journey_stage_from TEXT NOT NULL CHECK (journey_stage_from IN (
    'LEARN', 'COMPARE', 'SELECT_ACCESSORY', 'CALCULATE', 'OPERATE', 'CHOOSE_PRODUCT', 'SHOP'
  )),
  journey_stage_to TEXT NOT NULL CHECK (journey_stage_to IN (
    'LEARN', 'COMPARE', 'SELECT_ACCESSORY', 'CALCULATE', 'OPERATE', 'CHOOSE_PRODUCT', 'SHOP'
  )),
  proof_type TEXT NOT NULL CHECK (proof_type IN (
    'CONTENT_CATEGORY', 'CONTENT_PRODUCT', 'CONTENT_RELATED', 'PRODUCT_CONTENT',
    'PRODUCT_COMPATIBILITY', 'CATEGORY_GUIDE', 'TOOL_DATASET', 'CURATED_HUMAN'
  )),
  proof_ref TEXT NOT NULL,
  evidence_checksum TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at INTEGER NOT NULL,
  CHECK (target_id != '' AND target_path LIKE '/%' AND anchor_text != '' AND proof_ref != ''),
  CHECK (substr(next_question, -1, 1) = '?'),
  CHECK (
    (relation_type = 'ARTICLE_TO_CATEGORY' AND source_type = 'ARTICLE' AND target_type = 'CATEGORY') OR
    (relation_type = 'ARTICLE_TO_PRODUCT' AND source_type = 'ARTICLE' AND target_type = 'PRODUCT') OR
    (relation_type = 'ARTICLE_TO_ARTICLE' AND source_type = 'ARTICLE' AND target_type = 'ARTICLE') OR
    (relation_type = 'PRODUCT_TO_ARTICLE' AND source_type = 'PRODUCT' AND target_type = 'ARTICLE') OR
    (relation_type = 'PRODUCT_TO_COMPATIBILITY' AND source_type = 'PRODUCT' AND target_type = 'COMPATIBILITY') OR
    (relation_type = 'CATEGORY_TO_GUIDE' AND source_type = 'CATEGORY' AND target_type = 'GUIDE') OR
    (relation_type = 'CALCULATOR_TO_PRODUCT' AND source_type = 'CALCULATOR' AND target_type = 'PRODUCT') OR
    (relation_type = 'COMPARISON_TO_PRODUCT' AND source_type = 'COMPARISON' AND target_type = 'PRODUCT')
  ),
  CHECK (proof_type != 'CURATED_HUMAN' OR relation_type = 'CALCULATOR_TO_PRODUCT'),
  UNIQUE (link_set_id, relation_type, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_semantic_link_items_set
  ON semantic_link_items(link_set_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_semantic_link_items_target
  ON semantic_link_items(target_type, target_id, relation_type);

CREATE TABLE IF NOT EXISTS semantic_link_reviews (
  id TEXT PRIMARY KEY,
  link_set_id TEXT NOT NULL REFERENCES semantic_link_sets(id),
  decision TEXT NOT NULL CHECK (decision IN ('APPROVE', 'PUBLISH', 'REJECT', 'MARK_STALE')),
  reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('HUMAN', 'SYSTEM')),
  reviewer_id TEXT NOT NULL,
  evidence_fingerprint TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_semantic_link_reviews_set
  ON semantic_link_reviews(link_set_id, created_at DESC);

CREATE TABLE IF NOT EXISTS semantic_link_audit_events (
  id TEXT PRIMARY KEY,
  link_set_id TEXT NOT NULL REFERENCES semantic_link_sets(id),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('HUMAN', 'SYSTEM', 'AI_ASSISTED')),
  actor_id TEXT NOT NULL,
  details_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_semantic_link_audit_set
  ON semantic_link_audit_events(link_set_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_semantic_link_audit_source
  ON semantic_link_audit_events(source_type, source_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_semantic_link_item_parent_matches
BEFORE INSERT ON semantic_link_items
WHEN NOT EXISTS (
  SELECT 1 FROM semantic_link_sets parent
  WHERE parent.id = NEW.link_set_id AND parent.source_type = NEW.source_type
)
BEGIN
  SELECT RAISE(ABORT, 'semantic link item source must match its set');
END;
CREATE TRIGGER IF NOT EXISTS trg_semantic_link_items_no_update
BEFORE UPDATE ON semantic_link_items BEGIN
  SELECT RAISE(ABORT, 'semantic link items are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_semantic_link_items_no_delete
BEFORE DELETE ON semantic_link_items BEGIN
  SELECT RAISE(ABORT, 'semantic link items are append-only');
END;
CREATE TRIGGER IF NOT EXISTS trg_semantic_link_reviews_no_update
BEFORE UPDATE ON semantic_link_reviews BEGIN
  SELECT RAISE(ABORT, 'semantic link reviews are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_semantic_link_reviews_no_delete
BEFORE DELETE ON semantic_link_reviews BEGIN
  SELECT RAISE(ABORT, 'semantic link reviews are append-only');
END;
CREATE TRIGGER IF NOT EXISTS trg_semantic_link_audit_no_update
BEFORE UPDATE ON semantic_link_audit_events BEGIN
  SELECT RAISE(ABORT, 'semantic link audit events are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_semantic_link_audit_no_delete
BEFORE DELETE ON semantic_link_audit_events BEGIN
  SELECT RAISE(ABORT, 'semantic link audit events are append-only');
END;
CREATE TRIGGER IF NOT EXISTS trg_semantic_link_set_content_immutable
BEFORE UPDATE OF source_type, source_id, source_path, version, engine_version,
  evidence_fingerprint, generated_by_actor_type, generated_by_actor_id,
  generated_by_ai, safety_issues_json, hard_fail, item_count, created_at
ON semantic_link_sets BEGIN
  SELECT RAISE(ABORT, 'semantic link set content is immutable; create a new version');
END;

PRAGMA optimize;

-- migrate:down
DROP TRIGGER IF EXISTS trg_semantic_link_set_content_immutable;
DROP TRIGGER IF EXISTS trg_semantic_link_audit_no_delete;
DROP TRIGGER IF EXISTS trg_semantic_link_audit_no_update;
DROP TRIGGER IF EXISTS trg_semantic_link_reviews_no_delete;
DROP TRIGGER IF EXISTS trg_semantic_link_reviews_no_update;
DROP TRIGGER IF EXISTS trg_semantic_link_items_no_delete;
DROP TRIGGER IF EXISTS trg_semantic_link_items_no_update;
DROP TRIGGER IF EXISTS trg_semantic_link_item_parent_matches;
DROP TABLE IF EXISTS semantic_link_audit_events;
DROP TABLE IF EXISTS semantic_link_reviews;
DROP TABLE IF EXISTS semantic_link_items;
DROP TABLE IF EXISTS semantic_link_sets;
