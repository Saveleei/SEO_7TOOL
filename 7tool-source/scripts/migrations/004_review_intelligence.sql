-- migrate:up
CREATE TABLE IF NOT EXISTS review_source_candidates (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  base_url TEXT NOT NULL UNIQUE,
  discovery_source TEXT NOT NULL,
  access_method TEXT NOT NULL CHECK (access_method IN (
    'OFFICIAL_API', 'AUTHORIZED_EXPORT', 'MANUAL_RESEARCH', 'NONE'
  )),
  terms_status TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED' CHECK (terms_status IN (
    'ALLOWED', 'PROHIBITED', 'REVIEW_REQUIRED', 'UNKNOWN'
  )),
  robots_status TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (robots_status IN (
    'ALLOWED', 'DISALLOWED', 'NOT_APPLICABLE', 'UNKNOWN'
  )),
  status TEXT NOT NULL DEFAULT 'DISCOVERED' CHECK (status IN (
    'DISCOVERED', 'REVIEWED', 'APPROVED', 'REJECTED'
  )),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (status != 'APPROVED' OR (
    reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND
    terms_status = 'ALLOWED' AND robots_status IN ('ALLOWED', 'NOT_APPLICABLE') AND
    access_method != 'NONE'
  ))
);

CREATE TABLE IF NOT EXISTS review_insights (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  source_url TEXT NOT NULL,
  source_product_ref TEXT,
  product_id TEXT REFERENCES products(id),
  category_slug TEXT NOT NULL REFERENCES categories(slug),
  insight_type TEXT NOT NULL CHECK (insight_type IN (
    'PROBLEM', 'BENEFIT', 'QUESTION', 'USE_CASE', 'FAILURE', 'USER_ERROR',
    'EXPECTATION', 'COMPATIBILITY_ISSUE', 'FEATURE_REQUEST', 'COMPARISON', 'SLANG',
    'MATERIAL', 'APPLICATION', 'DIMENSION', 'ACCESSORY', 'INSTALLATION_ISSUE'
  )),
  normalized_text TEXT NOT NULL CHECK (length(normalized_text) BETWEEN 1 AND 1000),
  evidence_snippet TEXT CHECK (evidence_snippet IS NULL OR length(evidence_snippet) <= 240),
  rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  rating_bucket TEXT NOT NULL CHECK (rating_bucket IN ('NEGATIVE', 'POSITIVE', 'NEUTRAL', 'UNKNOWN')),
  aggregate_count INTEGER NOT NULL DEFAULT 1 CHECK (aggregate_count > 0),
  observed_at INTEGER NOT NULL,
  rights_status TEXT NOT NULL DEFAULT 'RESEARCH_ONLY' CHECK (rights_status IN (
    'RESEARCH_ONLY', 'INTERNAL_SUMMARY', 'PUBLISHABLE_WITH_PERMISSION'
  )),
  checksum TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MERGED', 'REJECTED')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (source_id, checksum)
);
CREATE INDEX IF NOT EXISTS idx_review_insights_category
  ON review_insights(category_slug, insight_type, rating_bucket, status);
CREATE INDEX IF NOT EXISTS idx_review_insights_product
  ON review_insights(product_id, insight_type, status);

CREATE TABLE IF NOT EXISTS pain_points (
  id TEXT PRIMARY KEY,
  category_slug TEXT NOT NULL REFERENCES categories(slug),
  product_type TEXT NOT NULL DEFAULT '',
  problem_key TEXT NOT NULL,
  problem TEXT NOT NULL,
  mentions INTEGER NOT NULL DEFAULT 0 CHECK (mentions >= 0),
  sources_count INTEGER NOT NULL DEFAULT 0 CHECK (sources_count >= 0),
  severity INTEGER NOT NULL CHECK (severity BETWEEN 0 AND 100),
  commercial_relevance INTEGER NOT NULL CHECK (commercial_relevance BETWEEN 0 AND 100),
  keyword_match REAL CHECK (keyword_match IS NULL OR (keyword_match >= 0 AND keyword_match <= 1)),
  content_url_id TEXT REFERENCES site_urls(id),
  suggested_content_type TEXT NOT NULL,
  priority INTEGER NOT NULL CHECK (priority BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'DISCOVERED' CHECK (status IN (
    'DISCOVERED', 'REVIEWED', 'CONTENT_EXISTS', 'MERGED', 'REJECTED'
  )),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (category_slug, product_type, problem_key)
);
CREATE INDEX IF NOT EXISTS idx_pain_points_priority
  ON pain_points(category_slug, status, priority DESC);

CREATE TABLE IF NOT EXISTS pain_point_sources (
  pain_point_id TEXT NOT NULL REFERENCES pain_points(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id),
  platform TEXT NOT NULL,
  mentions INTEGER NOT NULL DEFAULT 0 CHECK (mentions >= 0),
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (pain_point_id, source_id)
);
CREATE INDEX IF NOT EXISTS idx_pain_point_sources_platform
  ON pain_point_sources(platform, last_seen_at DESC);

-- migrate:down
DROP TABLE IF EXISTS pain_point_sources;
DROP TABLE IF EXISTS pain_points;
DROP TABLE IF EXISTS review_insights;
DROP TABLE IF EXISTS review_source_candidates;
