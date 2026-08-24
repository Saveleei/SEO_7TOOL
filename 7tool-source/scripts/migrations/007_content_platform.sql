-- migrate:up
CREATE TABLE IF NOT EXISTS content_assets (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN (
    'ARTICLE', 'GUIDE', 'HOW_TO', 'COMPARISON', 'TROUBLESHOOTING', 'COMPATIBILITY',
    'CASE_STUDY', 'TEST', 'REFERENCE', 'FAQ'
  )),
  site_url_id TEXT REFERENCES site_urls(id),
  opportunity_id TEXT UNIQUE REFERENCES content_opportunities(id),
  source_opportunity_checksum TEXT,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN (
    'DISCOVERED', 'SEMANTIC_REVIEW', 'BRIEF_READY', 'BRIEF_APPROVED', 'CONTENT_DRAFT',
    'FACT_CHECK', 'SEO_REVIEW', 'EXPERT_REVIEW', 'READY', 'PUBLISHED',
    'UPDATE_REQUIRED', 'MERGE_REQUIRED', 'ARCHIVED'
  )),
  title TEXT NOT NULL,
  h1 TEXT NOT NULL,
  meta_title TEXT,
  meta_description TEXT,
  excerpt TEXT,
  category_slug TEXT NOT NULL REFERENCES categories(slug),
  primary_keyword_id TEXT NOT NULL REFERENCES seo_keywords(id),
  primary_keyword TEXT NOT NULL,
  intent_id TEXT NOT NULL REFERENCES search_intents(id),
  cluster_id TEXT NOT NULL REFERENCES keyword_clusters(id),
  author TEXT,
  expert_reviewer TEXT,
  canonical TEXT NOT NULL UNIQUE,
  canonical_url_id TEXT REFERENCES site_urls(id),
  index_status TEXT NOT NULL DEFAULT 'NOINDEX' CHECK (index_status IN (
    'INDEX', 'NOINDEX', 'BLOCKED', 'REDIRECT', 'UNKNOWN'
  )),
  quality_score INTEGER CHECK (quality_score IS NULL OR quality_score BETWEEN 0 AND 100),
  evidence_score INTEGER CHECK (evidence_score IS NULL OR evidence_score BETWEEN 0 AND 100),
  differentiation_score INTEGER CHECK (differentiation_score IS NULL OR differentiation_score BETWEEN 0 AND 100),
  business_score INTEGER CHECK (business_score IS NULL OR business_score BETWEEN 0 AND 100),
  lead_form_type TEXT,
  generated_by_ai INTEGER NOT NULL DEFAULT 0 CHECK (generated_by_ai IN (0, 1)),
  human_reviewed INTEGER NOT NULL DEFAULT 0 CHECK (human_reviewed IN (0, 1)),
  current_brief_id TEXT,
  current_revision_id TEXT,
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (slug != '' AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT LIKE '-%' AND slug NOT LIKE '%-' AND slug NOT LIKE '%--%'),
  CHECK (canonical = '/articles/' || slug),
  CHECK (status != 'PUBLISHED' OR (
    site_url_id IS NOT NULL AND canonical_url_id IS NOT NULL AND current_brief_id IS NOT NULL AND
    current_revision_id IS NOT NULL AND meta_title IS NOT NULL AND meta_description IS NOT NULL AND
    excerpt IS NOT NULL AND author IS NOT NULL AND expert_reviewer IS NOT NULL AND
    quality_score IS NOT NULL AND evidence_score IS NOT NULL AND differentiation_score IS NOT NULL AND
    business_score IS NOT NULL AND human_reviewed = 1 AND index_status = 'INDEX' AND published_at IS NOT NULL
  ))
);
CREATE INDEX IF NOT EXISTS idx_content_assets_workflow
  ON content_assets(status, content_type, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_assets_public
  ON content_assets(status, index_status, human_reviewed, published_at DESC, content_type)
  WHERE status = 'PUBLISHED' AND index_status = 'INDEX' AND human_reviewed = 1;
CREATE INDEX IF NOT EXISTS idx_content_assets_category
  ON content_assets(category_slug, status, published_at DESC);

CREATE TABLE IF NOT EXISTS article_briefs (
  id TEXT PRIMARY KEY,
  content_asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL CHECK (status IN ('READY', 'APPROVED', 'CHANGES_REQUESTED', 'SUPERSEDED')),
  user_intent TEXT NOT NULL,
  problem TEXT NOT NULL,
  audience TEXT NOT NULL,
  short_answer TEXT NOT NULL,
  calculator_requirement TEXT NOT NULL,
  cta TEXT NOT NULL,
  brief_checksum TEXT NOT NULL UNIQUE,
  generated_by_ai INTEGER NOT NULL DEFAULT 0 CHECK (generated_by_ai IN (0, 1)),
  created_by_actor_type TEXT NOT NULL CHECK (created_by_actor_type IN ('HUMAN', 'SYSTEM', 'AI_ASSISTED', 'IMPORT')),
  created_by_actor_id TEXT NOT NULL,
  approved_by TEXT,
  approved_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (status != 'APPROVED' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  UNIQUE (content_asset_id, version)
);
CREATE INDEX IF NOT EXISTS idx_article_briefs_asset
  ON article_briefs(content_asset_id, version DESC);

CREATE TABLE IF NOT EXISTS article_brief_items (
  id TEXT PRIMARY KEY,
  brief_id TEXT NOT NULL REFERENCES article_briefs(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN (
    'KEY_QUESTION', 'VERIFIED_FACT', 'RELEVANT_PRODUCT', 'SUPPLIER_IMAGE',
    'REQUIRED_DIAGRAM', 'REQUIRED_TABLE', 'FAQ_INSIGHT', 'COMPETITOR_GAP',
    'INTERNAL_LINK', 'EVIDENCE_REQUIREMENT'
  )),
  item_text TEXT NOT NULL,
  reference_id TEXT,
  source_ref TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CHECK (item_text != '')
);
CREATE INDEX IF NOT EXISTS idx_article_brief_items_brief
  ON article_brief_items(brief_id, item_type, sort_order);

CREATE TABLE IF NOT EXISTS content_revisions (
  id TEXT PRIMARY KEY,
  content_asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  content_format TEXT NOT NULL CHECK (content_format = 'ARTICLE_BLOCKS_V1'),
  content_body TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  template_hash TEXT NOT NULL,
  created_by_actor_type TEXT NOT NULL CHECK (created_by_actor_type IN ('HUMAN', 'SYSTEM', 'AI_ASSISTED', 'IMPORT')),
  created_by_actor_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (content_asset_id, revision_number),
  UNIQUE (content_asset_id, content_hash)
);
CREATE INDEX IF NOT EXISTS idx_content_revisions_asset
  ON content_revisions(content_asset_id, revision_number DESC);
CREATE INDEX IF NOT EXISTS idx_content_revisions_template
  ON content_revisions(template_hash, content_asset_id);

CREATE TABLE IF NOT EXISTS content_secondary_keywords (
  content_asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  keyword_id TEXT NOT NULL REFERENCES seo_keywords(id),
  PRIMARY KEY (content_asset_id, keyword_id)
);

CREATE TABLE IF NOT EXISTS content_products (
  content_asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  relation_type TEXT NOT NULL CHECK (relation_type IN ('TARGET', 'MENTIONED')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (content_asset_id, product_id, relation_type)
);
CREATE INDEX IF NOT EXISTS idx_content_products_product
  ON content_products(product_id, relation_type, content_asset_id);

CREATE TABLE IF NOT EXISTS content_related (
  content_asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  related_content_asset_id TEXT NOT NULL REFERENCES content_assets(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (content_asset_id, related_content_asset_id),
  CHECK (content_asset_id != related_content_asset_id)
);

CREATE TABLE IF NOT EXISTS content_sources (
  id TEXT PRIMARY KEY,
  content_asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  source_ref TEXT NOT NULL,
  source_id TEXT REFERENCES sources(id),
  source_fact_id TEXT REFERENCES source_facts(id),
  assertion_id TEXT REFERENCES fact_assertions(id),
  claim_text TEXT NOT NULL,
  evidence_status TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED' CHECK (evidence_status IN (
    'REVIEW_REQUIRED', 'VERIFIED', 'REJECTED'
  )),
  verified_by TEXT,
  verified_at INTEGER,
  created_at INTEGER NOT NULL,
  CHECK (evidence_status != 'VERIFIED' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL)),
  UNIQUE (content_asset_id, source_ref, claim_text)
);
CREATE INDEX IF NOT EXISTS idx_content_sources_asset
  ON content_sources(content_asset_id, evidence_status);

CREATE TABLE IF NOT EXISTS content_faq (
  id TEXT PRIMARY KEY,
  content_asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (content_asset_id, question)
);
CREATE INDEX IF NOT EXISTS idx_content_faq_asset
  ON content_faq(content_asset_id, sort_order);

CREATE TABLE IF NOT EXISTS content_internal_links (
  content_asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  target_path TEXT NOT NULL,
  target_site_url_id TEXT REFERENCES site_urls(id),
  anchor_text TEXT NOT NULL,
  link_role TEXT NOT NULL CHECK (link_role IN ('CONTEXT', 'PRODUCT', 'RELATED', 'CTA')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  CHECK (target_path LIKE '/%'),
  PRIMARY KEY (content_asset_id, target_path, link_role)
);

CREATE TABLE IF NOT EXISTS content_approvals (
  id TEXT PRIMARY KEY,
  content_asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  brief_id TEXT REFERENCES article_briefs(id),
  revision_id TEXT REFERENCES content_revisions(id),
  approval_type TEXT NOT NULL CHECK (approval_type IN ('BRIEF', 'FACT', 'SEO', 'EXPERT', 'FINAL')),
  decision TEXT NOT NULL CHECK (decision IN ('APPROVED', 'CHANGES_REQUESTED', 'REJECTED')),
  reviewer TEXT NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL,
  CHECK (brief_id IS NOT NULL OR revision_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_content_approvals_asset
  ON content_approvals(content_asset_id, approval_type, created_at DESC);

CREATE TABLE IF NOT EXISTS workflow_events (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type = 'CONTENT_ASSET'),
  entity_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('HUMAN', 'SYSTEM', 'AI_ASSISTED', 'IMPORT')),
  actor_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workflow_events_entity
  ON workflow_events(entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS content_quality_checks (
  id TEXT PRIMARY KEY,
  content_asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  revision_id TEXT NOT NULL UNIQUE REFERENCES content_revisions(id),
  primary_keyword TEXT NOT NULL,
  issues_json TEXT NOT NULL,
  hard_fail INTEGER NOT NULL CHECK (hard_fail IN (0, 1)),
  checked_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_content_quality_checks_asset
  ON content_quality_checks(content_asset_id, checked_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_content_revisions_no_update
BEFORE UPDATE ON content_revisions BEGIN
  SELECT RAISE(ABORT, 'content revisions are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_content_revisions_no_delete
BEFORE DELETE ON content_revisions BEGIN
  SELECT RAISE(ABORT, 'content revisions are append-only');
END;
CREATE TRIGGER IF NOT EXISTS trg_content_approvals_no_update
BEFORE UPDATE ON content_approvals BEGIN
  SELECT RAISE(ABORT, 'content approvals are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_content_approvals_no_delete
BEFORE DELETE ON content_approvals BEGIN
  SELECT RAISE(ABORT, 'content approvals are append-only');
END;
CREATE TRIGGER IF NOT EXISTS trg_workflow_events_no_update
BEFORE UPDATE ON workflow_events BEGIN
  SELECT RAISE(ABORT, 'workflow events are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_workflow_events_no_delete
BEFORE DELETE ON workflow_events BEGIN
  SELECT RAISE(ABORT, 'workflow events are append-only');
END;
CREATE TRIGGER IF NOT EXISTS trg_content_quality_checks_no_update
BEFORE UPDATE ON content_quality_checks BEGIN
  SELECT RAISE(ABORT, 'content quality checks are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_content_quality_checks_no_delete
BEFORE DELETE ON content_quality_checks BEGIN
  SELECT RAISE(ABORT, 'content quality checks are append-only');
END;
CREATE TRIGGER IF NOT EXISTS trg_article_briefs_content_immutable
BEFORE UPDATE OF user_intent, problem, audience, short_answer, calculator_requirement, cta, brief_checksum
ON article_briefs BEGIN
  SELECT RAISE(ABORT, 'article brief content is immutable; create a new version');
END;
CREATE TRIGGER IF NOT EXISTS trg_article_brief_items_no_update
BEFORE UPDATE ON article_brief_items BEGIN
  SELECT RAISE(ABORT, 'article brief items are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_article_brief_items_no_delete
BEFORE DELETE ON article_brief_items BEGIN
  SELECT RAISE(ABORT, 'article brief items are append-only');
END;

PRAGMA optimize;

-- migrate:down
DROP TRIGGER IF EXISTS trg_article_brief_items_no_delete;
DROP TRIGGER IF EXISTS trg_article_brief_items_no_update;
DROP TRIGGER IF EXISTS trg_article_briefs_content_immutable;
DROP TRIGGER IF EXISTS trg_content_quality_checks_no_delete;
DROP TRIGGER IF EXISTS trg_content_quality_checks_no_update;
DROP TRIGGER IF EXISTS trg_workflow_events_no_delete;
DROP TRIGGER IF EXISTS trg_workflow_events_no_update;
DROP TRIGGER IF EXISTS trg_content_approvals_no_delete;
DROP TRIGGER IF EXISTS trg_content_approvals_no_update;
DROP TRIGGER IF EXISTS trg_content_revisions_no_delete;
DROP TRIGGER IF EXISTS trg_content_revisions_no_update;
DROP TABLE IF EXISTS content_quality_checks;
DROP TABLE IF EXISTS workflow_events;
DROP TABLE IF EXISTS content_approvals;
DROP TABLE IF EXISTS content_internal_links;
DROP TABLE IF EXISTS content_faq;
DROP TABLE IF EXISTS content_sources;
DROP TABLE IF EXISTS content_related;
DROP TABLE IF EXISTS content_products;
DROP TABLE IF EXISTS content_secondary_keywords;
DROP TABLE IF EXISTS content_revisions;
DROP TABLE IF EXISTS article_brief_items;
DROP TABLE IF EXISTS article_briefs;
DROP TABLE IF EXISTS content_assets;
