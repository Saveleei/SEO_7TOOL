-- migrate:up
CREATE TABLE IF NOT EXISTS score_models (
  id TEXT PRIMARY KEY,
  score_type TEXT NOT NULL CHECK (score_type = 'CONTENT_OPPORTUNITY'),
  version TEXT NOT NULL,
  weights_json TEXT NOT NULL,
  thresholds_json TEXT NOT NULL,
  model_checksum TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'APPROVED', 'RETIRED')),
  approved_by TEXT,
  approved_at INTEGER,
  created_at INTEGER NOT NULL,
  CHECK (status != 'APPROVED' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  UNIQUE (score_type, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_score_models_one_active
  ON score_models(score_type) WHERE status = 'APPROVED';

CREATE TABLE IF NOT EXISTS opportunity_business_inputs (
  id TEXT PRIMARY KEY,
  category_slug TEXT NOT NULL REFERENCES categories(slug),
  cluster_id TEXT NOT NULL REFERENCES keyword_clusters(id),
  business_priority INTEGER NOT NULL CHECK (business_priority BETWEEN 0 AND 100),
  margin_business_score INTEGER NOT NULL CHECK (margin_business_score BETWEEN 0 AND 100),
  source_ref TEXT NOT NULL CHECK (length(source_ref) BETWEEN 1 AND 500),
  input_checksum TEXT NOT NULL UNIQUE,
  valid_from INTEGER NOT NULL,
  valid_until INTEGER,
  supersedes_id TEXT REFERENCES opportunity_business_inputs(id),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'REJECTED')),
  reviewed_by TEXT NOT NULL,
  reviewed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK (supersedes_id IS NULL OR supersedes_id != id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunity_business_one_active
  ON opportunity_business_inputs(cluster_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS content_opportunities (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL CHECK (length(topic) BETWEEN 1 AND 500),
  category_slug TEXT NOT NULL REFERENCES categories(slug),
  cluster_id TEXT NOT NULL REFERENCES keyword_clusters(id),
  intent_id TEXT NOT NULL UNIQUE REFERENCES search_intents(id),
  primary_keyword_id TEXT NOT NULL REFERENCES seo_keywords(id),
  serp_assessment_id TEXT NOT NULL REFERENCES serp_assessments(id),
  score_model_id TEXT NOT NULL REFERENCES score_models(id),
  business_input_id TEXT NOT NULL REFERENCES opportunity_business_inputs(id),
  wordstat_demand INTEGER CHECK (wordstat_demand IS NULL OR wordstat_demand >= 0),
  google_demand INTEGER CHECK (google_demand IS NULL OR google_demand >= 0),
  search_demand_score INTEGER NOT NULL CHECK (search_demand_score BETWEEN 0 AND 100),
  intent_value INTEGER NOT NULL CHECK (intent_value BETWEEN 0 AND 100),
  business_priority INTEGER NOT NULL CHECK (business_priority BETWEEN 0 AND 100),
  product_relevance INTEGER NOT NULL CHECK (product_relevance BETWEEN 0 AND 100),
  content_gap_score INTEGER NOT NULL CHECK (content_gap_score BETWEEN 0 AND 100),
  pain_point_strength INTEGER NOT NULL CHECK (pain_point_strength BETWEEN 0 AND 100),
  product_availability INTEGER NOT NULL CHECK (product_availability BETWEEN 0 AND 100),
  margin_business_score INTEGER NOT NULL CHECK (margin_business_score BETWEEN 0 AND 100),
  differentiation_score INTEGER NOT NULL CHECK (differentiation_score BETWEEN 0 AND 100),
  competition_score INTEGER NOT NULL CHECK (competition_score BETWEEN 0 AND 100),
  cannibalization_risk TEXT NOT NULL CHECK (cannibalization_risk IN ('LOW', 'MEDIUM', 'HIGH')),
  duplicate_risk TEXT NOT NULL CHECK (duplicate_risk IN ('LOW', 'MEDIUM', 'HIGH')),
  cannibalization_penalty INTEGER NOT NULL CHECK (cannibalization_penalty BETWEEN 0 AND 100),
  duplicate_penalty INTEGER NOT NULL CHECK (duplicate_penalty BETWEEN 0 AND 100),
  existing_url_count INTEGER NOT NULL CHECK (existing_url_count >= 0),
  recommended_page_type TEXT NOT NULL CHECK (recommended_page_type IN (
    'PILLAR_GUIDE', 'HOW_TO', 'TROUBLESHOOTING', 'COMPARISON', 'TABLE', 'CALCULATOR',
    'COMPATIBILITY', 'CASE_STUDY', 'TEST', 'REFERENCE', 'CATEGORY_ENRICHMENT',
    'PRODUCT_ENRICHMENT', 'FAQ', 'VIDEO', 'SEO_LANDING'
  )),
  recommended_url_id TEXT REFERENCES site_urls(id),
  merge_into_opportunity_id TEXT REFERENCES content_opportunities(id),
  decision TEXT NOT NULL CHECK (decision IN ('CREATE', 'UPDATE', 'MERGE', 'REJECT')),
  opportunity_score INTEGER NOT NULL CHECK (opportunity_score BETWEEN 0 AND 100),
  score_breakdown_json TEXT NOT NULL,
  decision_reason_code TEXT NOT NULL CHECK (decision_reason_code IN (
    'NEW_INTENT', 'EXISTING_PAGE', 'OVERLAPPING_PAGES', 'DUPLICATE_INTENT',
    'NO_DIFFERENTIATION', 'NO_PRODUCT_AVAILABILITY', 'SERP_REJECTED',
    'SERP_INCONCLUSIVE', 'HIGH_CANNIBALIZATION', 'CANNIBALIZATION_REVIEW_REQUIRED', 'LOW_SCORE'
  )),
  decision_reason TEXT NOT NULL CHECK (length(decision_reason) BETWEEN 1 AND 1000),
  evaluation_checksum TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PROPOSED' CHECK (status IN (
    'PROPOSED', 'REVIEWED', 'REJECTED', 'SUPERSEDED'
  )),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (merge_into_opportunity_id IS NULL OR merge_into_opportunity_id != id),
  CHECK (decision != 'CREATE' OR (recommended_url_id IS NULL AND merge_into_opportunity_id IS NULL)),
  CHECK (decision != 'CREATE' OR (
    differentiation_score > 0 AND product_availability > 0 AND
    cannibalization_risk = 'LOW' AND duplicate_risk != 'HIGH'
  )),
  CHECK (decision != 'UPDATE' OR (recommended_url_id IS NOT NULL AND merge_into_opportunity_id IS NULL)),
  CHECK (decision != 'MERGE' OR (recommended_url_id IS NOT NULL OR merge_into_opportunity_id IS NOT NULL)),
  CHECK (status = 'PROPOSED' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_content_opportunities_priority
  ON content_opportunities(category_slug, status, decision, opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_content_opportunities_cluster
  ON content_opportunities(cluster_id, status);
CREATE INDEX IF NOT EXISTS idx_content_opportunities_target
  ON content_opportunities(recommended_url_id, merge_into_opportunity_id, decision);

CREATE TABLE IF NOT EXISTS opportunity_pain_points (
  opportunity_id TEXT NOT NULL REFERENCES content_opportunities(id) ON DELETE CASCADE,
  pain_point_id TEXT NOT NULL REFERENCES pain_points(id),
  relevance INTEGER NOT NULL CHECK (relevance BETWEEN 0 AND 100),
  PRIMARY KEY (opportunity_id, pain_point_id)
);

CREATE TABLE IF NOT EXISTS opportunity_evaluations (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL REFERENCES content_opportunities(id) ON DELETE CASCADE,
  score_model_id TEXT NOT NULL REFERENCES score_models(id),
  serp_assessment_id TEXT NOT NULL REFERENCES serp_assessments(id),
  business_input_id TEXT NOT NULL REFERENCES opportunity_business_inputs(id),
  opportunity_score INTEGER NOT NULL CHECK (opportunity_score BETWEEN 0 AND 100),
  decision TEXT NOT NULL CHECK (decision IN ('CREATE', 'UPDATE', 'MERGE', 'REJECT')),
  score_breakdown_json TEXT NOT NULL,
  decision_reason_code TEXT NOT NULL CHECK (decision_reason_code IN (
    'NEW_INTENT', 'EXISTING_PAGE', 'OVERLAPPING_PAGES', 'DUPLICATE_INTENT',
    'NO_DIFFERENTIATION', 'NO_PRODUCT_AVAILABILITY', 'SERP_REJECTED',
    'SERP_INCONCLUSIVE', 'HIGH_CANNIBALIZATION', 'CANNIBALIZATION_REVIEW_REQUIRED', 'LOW_SCORE'
  )),
  decision_reason TEXT NOT NULL,
  evaluation_checksum TEXT NOT NULL,
  evaluated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_opportunity_evaluations_history
  ON opportunity_evaluations(opportunity_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunity_evaluations_checksum
  ON opportunity_evaluations(evaluation_checksum, evaluated_at DESC);

CREATE TABLE IF NOT EXISTS opportunity_evaluation_pain_points (
  evaluation_id TEXT NOT NULL REFERENCES opportunity_evaluations(id) ON DELETE CASCADE,
  pain_point_id TEXT NOT NULL REFERENCES pain_points(id),
  relevance INTEGER NOT NULL CHECK (relevance BETWEEN 0 AND 100),
  PRIMARY KEY (evaluation_id, pain_point_id)
);

-- migrate:down
DROP TABLE IF EXISTS opportunity_evaluation_pain_points;
DROP TABLE IF EXISTS opportunity_evaluations;
DROP TABLE IF EXISTS opportunity_pain_points;
DROP TABLE IF EXISTS content_opportunities;
DROP TABLE IF EXISTS opportunity_business_inputs;
DROP TABLE IF EXISTS score_models;
