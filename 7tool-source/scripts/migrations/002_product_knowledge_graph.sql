-- migrate:up
CREATE TABLE IF NOT EXISTS fact_assertions (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  predicate TEXT NOT NULL,
  value_text TEXT,
  value_number REAL,
  unit TEXT,
  value_json TEXT,
  verification_status TEXT NOT NULL CHECK (verification_status IN (
    'FACT_REQUIRED', 'SOURCED', 'VERIFIED', 'SUPERSEDED', 'REJECTED'
  )),
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  verified_by TEXT,
  verified_at INTEGER,
  valid_from INTEGER,
  valid_to INTEGER,
  supersedes_id TEXT REFERENCES fact_assertions(id),
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (verification_status = 'FACT_REQUIRED' OR
    value_text IS NOT NULL OR value_number IS NOT NULL OR value_json IS NOT NULL),
  CHECK (verification_status != 'VERIFIED' OR
    (verified_by IS NOT NULL AND verified_at IS NOT NULL)),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from)
);
CREATE INDEX IF NOT EXISTS idx_fact_assertions_subject
  ON fact_assertions(subject_type, subject_id, predicate, verification_status);

CREATE TABLE IF NOT EXISTS fact_evidence (
  assertion_id TEXT NOT NULL REFERENCES fact_assertions(id) ON DELETE CASCADE,
  source_fact_id TEXT NOT NULL REFERENCES source_facts(id),
  evidence_role TEXT NOT NULL CHECK (evidence_role IN ('PRIMARY', 'SUPPORTING', 'CONFLICTING')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (assertion_id, source_fact_id)
);
CREATE INDEX IF NOT EXISTS idx_fact_evidence_source ON fact_evidence(source_fact_id);

CREATE TABLE IF NOT EXISTS product_features (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id TEXT REFERENCES variants(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  value_text TEXT,
  value_number REAL,
  unit TEXT,
  value_json TEXT,
  assertion_id TEXT NOT NULL REFERENCES fact_assertions(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'REJECTED')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (value_text IS NOT NULL OR value_number IS NOT NULL OR value_json IS NOT NULL),
  UNIQUE (product_id, variant_id, feature_key, assertion_id)
);
CREATE INDEX IF NOT EXISTS idx_product_features_product
  ON product_features(product_id, status, feature_key);

CREATE TABLE IF NOT EXISTS product_applications (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  application_key TEXT NOT NULL,
  suitability TEXT NOT NULL CHECK (suitability IN (
    'SUPPORTED', 'BETTER_FOR', 'NOT_RECOMMENDED', 'UNKNOWN'
  )),
  assertion_id TEXT NOT NULL REFERENCES fact_assertions(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'REJECTED')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (product_id, application_key, assertion_id)
);
CREATE INDEX IF NOT EXISTS idx_product_applications_product
  ON product_applications(product_id, status, application_key);

CREATE TABLE IF NOT EXISTS problems (
  id TEXT PRIMARY KEY,
  problem_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MERGED', 'ARCHIVED')),
  merged_into_id TEXT REFERENCES problems(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS product_problems (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  category_slug TEXT REFERENCES categories(slug) ON DELETE CASCADE,
  problem_id TEXT NOT NULL REFERENCES problems(id),
  relation_type TEXT NOT NULL CHECK (relation_type IN (
    'AFFECTED_BY', 'SOLVES', 'MAY_CAUSE', 'NOT_RECOMMENDED_FOR'
  )),
  assertion_id TEXT NOT NULL REFERENCES fact_assertions(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'REJECTED')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (product_id IS NOT NULL OR category_slug IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_product_problems_product ON product_problems(product_id, status);
CREATE INDEX IF NOT EXISTS idx_product_problems_category ON product_problems(category_slug, status);

CREATE TABLE IF NOT EXISTS knowledge_relations (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  predicate TEXT NOT NULL CHECK (predicate IN (
    'USES', 'COMPATIBLE_WITH', 'REQUIRES', 'ALTERNATIVE_TO', 'BETTER_FOR',
    'NOT_RECOMMENDED_FOR', 'SUPPORTS', 'DRILLS', 'CUTS', 'BEVELS', 'THREADS',
    'MOUNTS_ON', 'HAS_SHANK', 'HAS_DIAMETER', 'HAS_DEPTH', 'USES_ACCESSORY'
  )),
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  assertion_id TEXT NOT NULL REFERENCES fact_assertions(id),
  verification_status TEXT NOT NULL CHECK (verification_status IN (
    'FACT_REQUIRED', 'SOURCED', 'VERIFIED', 'SUPERSEDED', 'REJECTED'
  )),
  valid_from INTEGER,
  valid_to INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (NOT (subject_type = object_type AND subject_id = object_id)),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from),
  UNIQUE (subject_type, subject_id, predicate, object_type, object_id, assertion_id)
);
CREATE INDEX IF NOT EXISTS idx_knowledge_relations_subject
  ON knowledge_relations(subject_type, subject_id, predicate, verification_status);
CREATE INDEX IF NOT EXISTS idx_knowledge_relations_object
  ON knowledge_relations(object_type, object_id, predicate, verification_status);

CREATE TABLE IF NOT EXISTS product_compatibility (
  id TEXT PRIMARY KEY,
  product_a_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_b_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  compatibility_type TEXT NOT NULL,
  compatibility_status TEXT NOT NULL CHECK (compatibility_status IN (
    'COMPATIBLE', 'INCOMPATIBLE', 'CONDITIONAL', 'UNKNOWN'
  )),
  assertion_id TEXT NOT NULL REFERENCES fact_assertions(id),
  verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
  verified_by TEXT,
  verified_at INTEGER,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (product_a_id != product_b_id),
  CHECK (verified = 0 OR (verified_by IS NOT NULL AND verified_at IS NOT NULL)),
  CHECK (verified = 0 OR compatibility_status != 'UNKNOWN'),
  UNIQUE (product_a_id, product_b_id, compatibility_type)
);
CREATE INDEX IF NOT EXISTS idx_product_compatibility_a
  ON product_compatibility(product_a_id, compatibility_type, verified);
CREATE INDEX IF NOT EXISTS idx_product_compatibility_b
  ON product_compatibility(product_b_id, compatibility_type, verified);

-- migrate:down
DROP TABLE IF EXISTS product_compatibility;
DROP TABLE IF EXISTS knowledge_relations;
DROP TABLE IF EXISTS product_problems;
DROP TABLE IF EXISTS problems;
DROP TABLE IF EXISTS product_applications;
DROP TABLE IF EXISTS product_features;
DROP TABLE IF EXISTS fact_evidence;
DROP TABLE IF EXISTS fact_assertions;
