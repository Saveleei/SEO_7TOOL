-- migrate:up
CREATE TABLE IF NOT EXISTS site_urls (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  page_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  canonical_url_id TEXT REFERENCES site_urls(id),
  index_status TEXT NOT NULL CHECK (index_status IN (
    'INDEX', 'NOINDEX', 'BLOCKED', 'REDIRECT', 'UNKNOWN'
  )),
  http_status INTEGER,
  content_fingerprint TEXT,
  last_crawled_at INTEGER,
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (path LIKE '/%'),
  CHECK (canonical_url_id IS NULL OR canonical_url_id != id)
);
CREATE INDEX IF NOT EXISTS idx_site_urls_entity ON site_urls(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_site_urls_indexation ON site_urls(index_status, http_status);

CREATE TABLE IF NOT EXISTS keyword_clusters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_slug TEXT REFERENCES categories(slug),
  centroid_text TEXT NOT NULL,
  cluster_method TEXT NOT NULL,
  model_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PROPOSED', 'REVIEWED', 'MERGED', 'REJECTED')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_keyword_clusters_category
  ON keyword_clusters(category_slug, status);

CREATE TABLE IF NOT EXISTS search_intents (
  id TEXT PRIMARY KEY,
  intent_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  intent_class TEXT NOT NULL CHECK (intent_class IN (
    'PRODUCT', 'COMMERCIAL', 'SELECTION', 'COMPARISON', 'SPECIFICATION', 'MATERIAL',
    'APPLICATION', 'PROBLEM', 'COMPATIBILITY', 'HOW_TO', 'INFORMATIONAL', 'UNKNOWN'
  )),
  dominant_serp_type TEXT,
  category_slug TEXT REFERENCES categories(slug),
  preferred_url_id TEXT REFERENCES site_urls(id),
  status TEXT NOT NULL CHECK (status IN ('PROPOSED', 'REVIEWED', 'MERGED', 'REJECTED')),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (status != 'REVIEWED' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
  CHECK (preferred_url_id IS NULL OR status = 'REVIEWED')
);
CREATE INDEX IF NOT EXISTS idx_search_intents_category
  ON search_intents(category_slug, status, intent_class);

CREATE TABLE IF NOT EXISTS seo_keywords (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES sources(id),
  source_keyword_id TEXT,
  region TEXT NOT NULL DEFAULT 'RU',
  language TEXT NOT NULL DEFAULT 'ru',
  frequency INTEGER,
  exact_frequency INTEGER,
  seasonality_json TEXT,
  category_slug TEXT REFERENCES categories(slug),
  product_id TEXT REFERENCES products(id),
  intent_id TEXT REFERENCES search_intents(id),
  cluster_id TEXT REFERENCES keyword_clusters(id),
  intent_class TEXT NOT NULL DEFAULT 'UNKNOWN',
  intent_confidence REAL CHECK (intent_confidence IS NULL OR (intent_confidence >= 0 AND intent_confidence <= 1)),
  commercial_score REAL,
  business_value REAL,
  opportunity_score REAL,
  existing_url_id TEXT REFERENCES site_urls(id),
  cannibalization_risk TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (cannibalization_risk IN (
    'LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'
  )),
  status TEXT NOT NULL DEFAULT 'DISCOVERED' CHECK (status IN (
    'DISCOVERED', 'NORMALIZED', 'CLUSTERED', 'REVIEWED', 'REJECTED'
  )),
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (normalized_query, source_id, region, language)
);
CREATE INDEX IF NOT EXISTS idx_seo_keywords_category
  ON seo_keywords(category_slug, status, cluster_id);
CREATE INDEX IF NOT EXISTS idx_seo_keywords_intent ON seo_keywords(intent_id, status);
CREATE INDEX IF NOT EXISTS idx_seo_keywords_existing_url ON seo_keywords(existing_url_id);

CREATE TABLE IF NOT EXISTS intent_url_mappings (
  intent_id TEXT NOT NULL REFERENCES search_intents(id) ON DELETE CASCADE,
  site_url_id TEXT NOT NULL REFERENCES site_urls(id) ON DELETE CASCADE,
  mapping_role TEXT NOT NULL CHECK (mapping_role IN ('PRIMARY', 'CANDIDATE', 'OVERLAP')),
  status TEXT NOT NULL CHECK (status IN ('PROPOSED', 'APPROVED', 'REJECTED')),
  evidence TEXT,
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (intent_id, site_url_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_intent_one_approved_primary
  ON intent_url_mappings(intent_id)
  WHERE mapping_role = 'PRIMARY' AND status = 'APPROVED';
CREATE INDEX IF NOT EXISTS idx_intent_url_overlap
  ON intent_url_mappings(site_url_id, status, mapping_role);

-- migrate:down
DROP TABLE IF EXISTS intent_url_mappings;
DROP TABLE IF EXISTS seo_keywords;
DROP TABLE IF EXISTS search_intents;
DROP TABLE IF EXISTS keyword_clusters;
DROP TABLE IF EXISTS site_urls;
