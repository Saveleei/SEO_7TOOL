-- migrate:up
CREATE TABLE IF NOT EXISTS serp_source_candidates (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  engine TEXT NOT NULL CHECK (engine IN ('GOOGLE', 'YANDEX', 'OTHER')),
  base_url TEXT NOT NULL,
  discovery_source TEXT NOT NULL,
  acquisition_method TEXT NOT NULL CHECK (acquisition_method IN (
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
  UNIQUE (engine, base_url),
  CHECK (status != 'APPROVED' OR (
    reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND
    terms_status = 'ALLOWED' AND robots_status IN ('ALLOWED', 'NOT_APPLICABLE') AND
    acquisition_method != 'NONE'
  ))
);

CREATE TABLE IF NOT EXISTS serp_snapshots (
  id TEXT PRIMARY KEY,
  source_candidate_id TEXT NOT NULL REFERENCES serp_source_candidates(id),
  source_id TEXT NOT NULL REFERENCES sources(id),
  import_run_id TEXT NOT NULL REFERENCES import_runs(id),
  engine TEXT NOT NULL CHECK (engine IN ('GOOGLE', 'YANDEX', 'OTHER')),
  query TEXT NOT NULL CHECK (length(query) BETWEEN 1 AND 400),
  normalized_query TEXT NOT NULL CHECK (length(normalized_query) BETWEEN 1 AND 400),
  region TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'ru',
  device TEXT NOT NULL CHECK (device IN ('DESKTOP', 'MOBILE')),
  cluster_id TEXT NOT NULL REFERENCES keyword_clusters(id),
  intent_id TEXT NOT NULL REFERENCES search_intents(id),
  captured_at INTEGER NOT NULL,
  top_n INTEGER NOT NULL CHECK (top_n BETWEEN 1 AND 20),
  result_count INTEGER NOT NULL CHECK (result_count BETWEEN 1 AND 20),
  input_checksum TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'REJECTED')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (source_candidate_id, input_checksum)
);
CREATE INDEX IF NOT EXISTS idx_serp_snapshots_intent
  ON serp_snapshots(intent_id, captured_at DESC, engine, status);
CREATE INDEX IF NOT EXISTS idx_serp_snapshots_cluster
  ON serp_snapshots(cluster_id, captured_at DESC, engine, status);

CREATE TABLE IF NOT EXISTS serp_results (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES serp_snapshots(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 20),
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  title TEXT CHECK (title IS NULL OR length(title) <= 300),
  page_type TEXT NOT NULL CHECK (page_type IN (
    'PRODUCT', 'CATEGORY', 'ARTICLE', 'FORUM', 'VIDEO', 'TABLE', 'CALCULATOR',
    'MARKETPLACE', 'MANUFACTURER', 'ECOMMERCE', 'PDF_MANUAL', 'OTHER'
  )),
  site_class TEXT NOT NULL CHECK (site_class IN (
    'OWNED', 'COMPETITOR', 'MARKETPLACE', 'MANUFACTURER', 'FORUM', 'VIDEO_PLATFORM', 'OTHER'
  )),
  mime_type TEXT,
  has_table INTEGER NOT NULL DEFAULT 0 CHECK (has_table IN (0, 1)),
  has_calculator INTEGER NOT NULL DEFAULT 0 CHECK (has_calculator IN (0, 1)),
  has_video INTEGER NOT NULL DEFAULT 0 CHECK (has_video IN (0, 1)),
  has_faq INTEGER NOT NULL DEFAULT 0 CHECK (has_faq IN (0, 1)),
  checksum TEXT NOT NULL,
  rights_status TEXT NOT NULL DEFAULT 'RESEARCH_ONLY' CHECK (rights_status = 'RESEARCH_ONLY'),
  created_at INTEGER NOT NULL,
  UNIQUE (snapshot_id, position),
  UNIQUE (snapshot_id, url)
);
CREATE INDEX IF NOT EXISTS idx_serp_results_type
  ON serp_results(snapshot_id, page_type, position);
CREATE INDEX IF NOT EXISTS idx_serp_results_domain
  ON serp_results(domain, page_type, site_class);

CREATE TABLE IF NOT EXISTS serp_competitor_insights (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES serp_snapshots(id) ON DELETE CASCADE,
  result_id TEXT REFERENCES serp_results(id) ON DELETE SET NULL,
  insight_type TEXT NOT NULL CHECK (insight_type IN (
    'COVERED_TOPIC', 'MISSING_TOPIC', 'MISSING_QUESTION', 'MISSING_COMPARISON',
    'WEAK_EXPLANATION', 'MISSING_TABLE', 'OUTDATED_INFORMATION', 'UX_WEAKNESS'
  )),
  summary TEXT NOT NULL CHECK (length(summary) BETWEEN 1 AND 500),
  evidence_url TEXT,
  severity INTEGER NOT NULL DEFAULT 50 CHECK (severity BETWEEN 0 AND 100),
  checksum TEXT NOT NULL,
  rights_status TEXT NOT NULL DEFAULT 'RESEARCH_ONLY' CHECK (rights_status = 'RESEARCH_ONLY'),
  status TEXT NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'REVIEWED', 'REJECTED')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (snapshot_id, checksum)
);
CREATE INDEX IF NOT EXISTS idx_serp_insights_type
  ON serp_competitor_insights(snapshot_id, insight_type, status);

CREATE TABLE IF NOT EXISTS serp_assessments (
  id TEXT PRIMARY KEY,
  cluster_id TEXT NOT NULL REFERENCES keyword_clusters(id),
  intent_id TEXT NOT NULL REFERENCES search_intents(id),
  dominant_serp_type TEXT NOT NULL CHECK (dominant_serp_type IN (
    'PRODUCT', 'CATEGORY', 'ARTICLE', 'FORUM', 'VIDEO', 'TABLE', 'CALCULATOR',
    'MARKETPLACE', 'MANUFACTURER', 'ECOMMERCE', 'PDF_MANUAL', 'OTHER', 'MIXED'
  )),
  dominant_share REAL NOT NULL CHECK (dominant_share BETWEEN 0 AND 1),
  sample_size INTEGER NOT NULL CHECK (sample_size BETWEEN 2 AND 40),
  distribution_json TEXT NOT NULL,
  commercial_density REAL NOT NULL CHECK (commercial_density BETWEEN 0 AND 1),
  marketplace_share REAL NOT NULL CHECK (marketplace_share BETWEEN 0 AND 1),
  content_gap_score INTEGER NOT NULL CHECK (content_gap_score BETWEEN 0 AND 100),
  differentiation_score INTEGER NOT NULL CHECK (differentiation_score BETWEEN 0 AND 100),
  differentiation_signals_json TEXT NOT NULL,
  score_model_version TEXT NOT NULL,
  assessment_checksum TEXT NOT NULL UNIQUE,
  recommended_page_type TEXT NOT NULL CHECK (recommended_page_type IN (
    'PRODUCT_ENRICHMENT', 'CATEGORY_ENRICHMENT', 'ARTICLE_CANDIDATE', 'CALCULATOR',
    'VIDEO', 'TABLE_REFERENCE', 'HUMAN_REVIEW', 'REJECT'
  )),
  recommendation TEXT NOT NULL CHECK (recommendation IN (
    'KEEP_FOR_OPPORTUNITY_REVIEW', 'HUMAN_REVIEW', 'REJECT'
  )),
  rationale TEXT NOT NULL CHECK (length(rationale) BETWEEN 1 AND 1000),
  status TEXT NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'REVIEWED', 'REJECTED')),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (differentiation_score > 0 OR recommendation = 'REJECT'),
  CHECK (status = 'PROPOSED' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_serp_assessments_intent
  ON serp_assessments(intent_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS serp_assessment_snapshots (
  assessment_id TEXT NOT NULL REFERENCES serp_assessments(id) ON DELETE CASCADE,
  snapshot_id TEXT NOT NULL REFERENCES serp_snapshots(id),
  PRIMARY KEY (assessment_id, snapshot_id)
);

-- migrate:down
DROP TABLE IF EXISTS serp_assessment_snapshots;
DROP TABLE IF EXISTS serp_assessments;
DROP TABLE IF EXISTS serp_competitor_insights;
DROP TABLE IF EXISTS serp_results;
DROP TABLE IF EXISTS serp_snapshots;
DROP TABLE IF EXISTS serp_source_candidates;
