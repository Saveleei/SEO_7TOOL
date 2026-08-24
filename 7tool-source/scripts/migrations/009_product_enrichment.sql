-- migrate:up
CREATE TABLE IF NOT EXISTS product_enrichment_sets (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL CHECK (status IN (
    'DRAFT', 'APPROVED', 'PUBLISHED', 'SUPERSEDED', 'STALE', 'REJECTED'
  )),
  evidence_fingerprint TEXT NOT NULL,
  engine_version TEXT NOT NULL,
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
  CHECK (status NOT IN ('APPROVED', 'PUBLISHED', 'SUPERSEDED', 'STALE') OR (
    approved_by IS NOT NULL AND approved_at IS NOT NULL AND hard_fail = 0
  )),
  CHECK (status NOT IN ('PUBLISHED', 'SUPERSEDED', 'STALE') OR (
    published_by IS NOT NULL AND published_at IS NOT NULL
  )),
  UNIQUE (product_id, version),
  UNIQUE (product_id, evidence_fingerprint)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_enrichment_one_published
  ON product_enrichment_sets(product_id) WHERE status = 'PUBLISHED';
CREATE INDEX IF NOT EXISTS idx_product_enrichment_queue
  ON product_enrichment_sets(status, updated_at DESC, product_id);
CREATE INDEX IF NOT EXISTS idx_product_enrichment_product_history
  ON product_enrichment_sets(product_id, version DESC, status);

CREATE TABLE IF NOT EXISTS product_enrichment_items (
  id TEXT PRIMARY KEY,
  enrichment_set_id TEXT NOT NULL REFERENCES product_enrichment_sets(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL CHECK (section_type IN (
    'SUITABLE_TASK', 'NOT_SUITABLE_TASK', 'ADVANTAGE', 'BEFORE_BUYING',
    'COMPATIBLE_ACCESSORY', 'ANALOG', 'DIFFERENCE', 'FAQ'
  )),
  template_key TEXT NOT NULL CHECK (template_key IN (
    'APPLICATION_SUPPORTED', 'APPLICATION_BETTER_FOR', 'APPLICATION_NOT_RECOMMENDED',
    'DECLARED_FEATURE', 'REQUIRES_PRODUCT', 'RELATION_NOT_RECOMMENDED',
    'COMPATIBLE_PRODUCT', 'INCOMPATIBLE_PRODUCT', 'CONDITIONAL_COMPATIBILITY',
    'ALTERNATIVE_PRODUCT', 'VERIFIED_FEATURE_DIFFERENCE',
    'FAQ_APPLICATION', 'FAQ_FEATURE', 'FAQ_COMPATIBILITY'
  )),
  label TEXT,
  body TEXT,
  question TEXT,
  answer TEXT,
  primary_assertion_id TEXT NOT NULL REFERENCES fact_assertions(id),
  secondary_assertion_id TEXT REFERENCES fact_assertions(id),
  related_product_id TEXT REFERENCES products(id),
  source_predicate TEXT NOT NULL,
  evidence_checksum TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  CHECK (
    (section_type = 'FAQ' AND question IS NOT NULL AND answer IS NOT NULL AND label IS NULL AND body IS NULL)
    OR
    (section_type != 'FAQ' AND label IS NOT NULL AND body IS NOT NULL AND question IS NULL AND answer IS NULL)
  ),
  CHECK (secondary_assertion_id IS NULL OR secondary_assertion_id != primary_assertion_id),
  UNIQUE (enrichment_set_id, section_type, evidence_checksum)
);
CREATE INDEX IF NOT EXISTS idx_product_enrichment_items_set
  ON product_enrichment_items(enrichment_set_id, section_type, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_product_enrichment_items_assertion
  ON product_enrichment_items(primary_assertion_id, secondary_assertion_id);
CREATE INDEX IF NOT EXISTS idx_product_enrichment_items_related
  ON product_enrichment_items(related_product_id, section_type);

CREATE TABLE IF NOT EXISTS product_enrichment_reviews (
  id TEXT PRIMARY KEY,
  enrichment_set_id TEXT NOT NULL REFERENCES product_enrichment_sets(id),
  decision TEXT NOT NULL CHECK (decision IN ('APPROVE', 'PUBLISH', 'REJECT', 'MARK_STALE')),
  reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('HUMAN', 'SYSTEM')),
  reviewer_id TEXT NOT NULL,
  evidence_fingerprint TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_product_enrichment_reviews_set
  ON product_enrichment_reviews(enrichment_set_id, created_at DESC);

CREATE TABLE IF NOT EXISTS product_enrichment_audit_events (
  id TEXT PRIMARY KEY,
  enrichment_set_id TEXT NOT NULL REFERENCES product_enrichment_sets(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('HUMAN', 'SYSTEM', 'AI_ASSISTED')),
  actor_id TEXT NOT NULL,
  details_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_product_enrichment_audit_set
  ON product_enrichment_audit_events(enrichment_set_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_enrichment_audit_product
  ON product_enrichment_audit_events(product_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_product_enrichment_items_no_update
BEFORE UPDATE ON product_enrichment_items BEGIN
  SELECT RAISE(ABORT, 'product enrichment items are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_product_enrichment_items_no_delete
BEFORE DELETE ON product_enrichment_items BEGIN
  SELECT RAISE(ABORT, 'product enrichment items are append-only');
END;
CREATE TRIGGER IF NOT EXISTS trg_product_enrichment_reviews_no_update
BEFORE UPDATE ON product_enrichment_reviews BEGIN
  SELECT RAISE(ABORT, 'product enrichment reviews are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_product_enrichment_reviews_no_delete
BEFORE DELETE ON product_enrichment_reviews BEGIN
  SELECT RAISE(ABORT, 'product enrichment reviews are append-only');
END;
CREATE TRIGGER IF NOT EXISTS trg_product_enrichment_audit_no_update
BEFORE UPDATE ON product_enrichment_audit_events BEGIN
  SELECT RAISE(ABORT, 'product enrichment audit events are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_product_enrichment_audit_no_delete
BEFORE DELETE ON product_enrichment_audit_events BEGIN
  SELECT RAISE(ABORT, 'product enrichment audit events are append-only');
END;
CREATE TRIGGER IF NOT EXISTS trg_product_enrichment_set_content_immutable
BEFORE UPDATE OF product_id, version, evidence_fingerprint, engine_version,
  generated_by_actor_type, generated_by_actor_id, generated_by_ai,
  safety_issues_json, hard_fail, item_count, created_at
ON product_enrichment_sets BEGIN
  SELECT RAISE(ABORT, 'product enrichment set content is immutable; create a new version');
END;

PRAGMA optimize;

-- migrate:down
DROP TRIGGER IF EXISTS trg_product_enrichment_set_content_immutable;
DROP TRIGGER IF EXISTS trg_product_enrichment_audit_no_delete;
DROP TRIGGER IF EXISTS trg_product_enrichment_audit_no_update;
DROP TRIGGER IF EXISTS trg_product_enrichment_reviews_no_delete;
DROP TRIGGER IF EXISTS trg_product_enrichment_reviews_no_update;
DROP TRIGGER IF EXISTS trg_product_enrichment_items_no_delete;
DROP TRIGGER IF EXISTS trg_product_enrichment_items_no_update;
DROP TABLE IF EXISTS product_enrichment_audit_events;
DROP TABLE IF EXISTS product_enrichment_reviews;
DROP TABLE IF EXISTS product_enrichment_items;
DROP TABLE IF EXISTS product_enrichment_sets;
