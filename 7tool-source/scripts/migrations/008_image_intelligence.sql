-- migrate:up
CREATE TABLE IF NOT EXISTS media_rights_grants (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('SOURCE', 'ASSET')),
  scope_value TEXT NOT NULL,
  source_id TEXT REFERENCES sources(id),
  copyright_holder TEXT NOT NULL,
  license_type TEXT NOT NULL CHECK (license_type IN (
    'OWNED', 'SUPPLIER_CONTRACT', 'EXPLICIT_PERMISSION', 'AI_OUTPUT_TERMS'
  )),
  permitted_uses_json TEXT NOT NULL,
  attribution_required INTEGER NOT NULL DEFAULT 0 CHECK (attribution_required IN (0, 1)),
  attribution_text TEXT,
  evidence_ref TEXT NOT NULL,
  evidence_checksum TEXT NOT NULL,
  valid_from INTEGER NOT NULL,
  valid_until INTEGER,
  status TEXT NOT NULL CHECK (status IN ('PROPOSED', 'APPROVED', 'REVOKED', 'EXPIRED', 'REJECTED')),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (scope_value != ''),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK (scope_type != 'SOURCE' OR source_id IS NOT NULL),
  CHECK (attribution_required = 0 OR attribution_text IS NOT NULL),
  CHECK (status = 'PROPOSED' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_rights_one_approved_scope
  ON media_rights_grants(scope_type, scope_value)
  WHERE status = 'APPROVED';
CREATE INDEX IF NOT EXISTS idx_media_rights_source
  ON media_rights_grants(source_id, status, valid_from, valid_until);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES sources(id),
  source_type TEXT NOT NULL CHECK (source_type IN (
    'SUPPLIER_FEED', 'OWNED_PHOTOGRAPHY', 'INTERNAL_UPLOAD', 'AI_GENERATED'
  )),
  origin_url TEXT UNIQUE,
  origin_host TEXT,
  supplier_product_ref TEXT,
  product_id TEXT REFERENCES products(id),
  variant_id TEXT REFERENCES variants(id),
  category_slug TEXT REFERENCES categories(slug),
  brand TEXT,
  asset_kind TEXT NOT NULL CHECK (asset_kind IN (
    'PRODUCT_PHOTO', 'PRODUCT_CLOSEUP', 'PRODUCT_COMPONENT', 'COMPATIBLE_EQUIPMENT',
    'DIAGRAM', 'INFOGRAPHIC', 'TECHNICAL_ILLUSTRATION', 'COMPARISON_SCHEME', 'CONCEPT_DRAWING'
  )),
  depiction_type TEXT NOT NULL CHECK (depiction_type IN ('PHOTOGRAPH', 'ILLUSTRATION', 'DIAGRAM')),
  semantic_description TEXT NOT NULL,
  ai_generated INTEGER NOT NULL DEFAULT 0 CHECK (ai_generated IN (0, 1)),
  real_product_id TEXT REFERENCES products(id),
  disclosure_text TEXT,
  copyright_status TEXT NOT NULL CHECK (copyright_status IN (
    'UNKNOWN', 'SUPPLIER_CLAIMED', 'OWNED', 'THIRD_PARTY', 'AI_GENERATED'
  )),
  license_status TEXT NOT NULL CHECK (license_status IN (
    'UNKNOWN', 'CONTRACT_REQUIRED', 'VERIFIED', 'OWNED', 'CONTRACT_APPROVED',
    'RESEARCH_ONLY', 'REJECTED', 'EXPIRED'
  )),
  rights_grant_id TEXT REFERENCES media_rights_grants(id),
  status TEXT NOT NULL CHECK (status IN (
    'DISCOVERED', 'METADATA_READY', 'RIGHTS_REVIEW', 'RIGHTS_APPROVED',
    'PROCESSED', 'REJECTED', 'SUPERSEDED'
  )),
  original_storage_key TEXT UNIQUE,
  sha256 TEXT UNIQUE,
  perceptual_hash TEXT,
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  bytes INTEGER CHECK (bytes IS NULL OR bytes > 0),
  mime TEXT,
  alt_default TEXT,
  metadata_checksum TEXT NOT NULL UNIQUE,
  discovered_at INTEGER NOT NULL,
  processed_at INTEGER,
  processed_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (source_type != 'SUPPLIER_FEED' OR (
    source_id IS NOT NULL AND origin_url IS NOT NULL AND origin_host IS NOT NULL
  )),
  CHECK (source_type != 'AI_GENERATED' OR (
    ai_generated = 1 AND origin_url IS NULL AND real_product_id IS NULL AND
    disclosure_text IS NOT NULL AND copyright_status = 'AI_GENERATED' AND
    asset_kind IN ('DIAGRAM', 'INFOGRAPHIC', 'TECHNICAL_ILLUSTRATION', 'COMPARISON_SCHEME', 'CONCEPT_DRAWING')
  )),
  CHECK (ai_generated = 0 OR depiction_type != 'PHOTOGRAPH'),
  CHECK (status NOT IN ('RIGHTS_APPROVED', 'PROCESSED') OR (
    rights_grant_id IS NOT NULL AND license_status IN ('VERIFIED', 'OWNED', 'CONTRACT_APPROVED')
  )),
  CHECK (status != 'PROCESSED' OR (
    original_storage_key IS NOT NULL AND sha256 IS NOT NULL AND perceptual_hash IS NOT NULL AND
    width IS NOT NULL AND height IS NOT NULL AND bytes IS NOT NULL AND mime IS NOT NULL AND
    processed_at IS NOT NULL AND processed_by IS NOT NULL
  ))
);
CREATE INDEX IF NOT EXISTS idx_media_assets_library
  ON media_assets(source_type, status, category_slug, product_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_rights
  ON media_assets(license_status, status, rights_grant_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_perceptual
  ON media_assets(perceptual_hash, status) WHERE perceptual_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS media_tags (
  media_asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  tag_type TEXT NOT NULL CHECK (tag_type IN (
    'PRODUCT', 'VARIANT', 'BRAND', 'CATEGORY', 'COMPONENT', 'EQUIPMENT',
    'FEATURE', 'APPLICATION', 'COMPATIBILITY', 'VIEW'
  )),
  normalized_tag TEXT NOT NULL,
  display_label TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('SUPPLIER_FEED', 'HUMAN', 'AI_ASSISTED')),
  confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  status TEXT NOT NULL CHECK (status IN ('PROPOSED', 'REVIEWED', 'REJECTED')),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  CHECK (normalized_tag != '' AND display_label != ''),
  CHECK (status != 'REVIEWED' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
  PRIMARY KEY (media_asset_id, tag_type, normalized_tag)
);
CREATE INDEX IF NOT EXISTS idx_media_tags_search
  ON media_tags(normalized_tag, status, tag_type, media_asset_id);

CREATE TABLE IF NOT EXISTS media_relations (
  id TEXT PRIMARY KEY,
  media_asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN (
    'PRODUCT', 'VARIANT', 'CATEGORY', 'CONTENT_ASSET', 'COMPONENT'
  )),
  subject_id TEXT NOT NULL,
  relation_type TEXT NOT NULL CHECK (relation_type IN (
    'DEPICTS', 'ASSOCIATED_WITH', 'COMPATIBLE_WITH', 'ALTERNATE_VIEW'
  )),
  evidence_source TEXT NOT NULL CHECK (evidence_source IN ('SUPPLIER_FEED', 'HUMAN', 'AI_ASSISTED')),
  status TEXT NOT NULL CHECK (status IN ('PROPOSED', 'REVIEWED', 'REJECTED')),
  verified_by TEXT,
  verified_at INTEGER,
  created_at INTEGER NOT NULL,
  CHECK (status != 'REVIEWED' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL)),
  UNIQUE (media_asset_id, subject_type, subject_id, relation_type)
);
CREATE INDEX IF NOT EXISTS idx_media_relations_subject
  ON media_relations(subject_type, subject_id, relation_type, status);

CREATE TABLE IF NOT EXISTS media_generation_records (
  id TEXT PRIMARY KEY,
  media_asset_id TEXT NOT NULL UNIQUE REFERENCES media_assets(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_ref TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  generation_ref TEXT,
  terms_ref TEXT NOT NULL,
  created_by_actor_type TEXT NOT NULL CHECK (created_by_actor_type IN ('HUMAN', 'SYSTEM', 'AI_ASSISTED')),
  created_by_actor_id TEXT NOT NULL,
  generated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS media_variants (
  id TEXT PRIMARY KEY,
  media_asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  format TEXT NOT NULL CHECK (format IN ('WEBP', 'AVIF')),
  mime TEXT NOT NULL CHECK (mime IN ('image/webp', 'image/avif')),
  storage_key TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL UNIQUE,
  bytes INTEGER NOT NULL CHECK (bytes > 0),
  status TEXT NOT NULL CHECK (status IN ('READY', 'REJECTED')),
  created_at INTEGER NOT NULL,
  UNIQUE (media_asset_id, width, format)
);
CREATE INDEX IF NOT EXISTS idx_media_variants_asset
  ON media_variants(media_asset_id, status, width, format);

CREATE TABLE IF NOT EXISTS media_selection_requests (
  id TEXT PRIMARY KEY,
  content_asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  brief_id TEXT NOT NULL REFERENCES article_briefs(id),
  brief_item_id TEXT UNIQUE REFERENCES article_brief_items(id),
  semantic_need TEXT NOT NULL,
  normalized_need TEXT NOT NULL,
  context_text TEXT NOT NULL,
  desired_kind TEXT CHECK (desired_kind IS NULL OR desired_kind IN (
    'PRODUCT_PHOTO', 'PRODUCT_CLOSEUP', 'PRODUCT_COMPONENT', 'COMPATIBLE_EQUIPMENT',
    'DIAGRAM', 'INFOGRAPHIC', 'TECHNICAL_ILLUSTRATION', 'COMPARISON_SCHEME', 'CONCEPT_DRAWING'
  )),
  candidate_limit INTEGER NOT NULL DEFAULT 20 CHECK (candidate_limit BETWEEN 1 AND 100),
  status TEXT NOT NULL CHECK (status IN (
    'DRAFT', 'RANKED', 'NO_MATCH', 'NO_MATCH_REVIEWED', 'SELECTED', 'CLOSED'
  )),
  requested_by_actor_type TEXT NOT NULL CHECK (requested_by_actor_type IN ('HUMAN', 'SYSTEM', 'AI_ASSISTED')),
  requested_by_actor_id TEXT NOT NULL,
  generated_by_ai INTEGER NOT NULL DEFAULT 0 CHECK (generated_by_ai IN (0, 1)),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (status != 'NO_MATCH_REVIEWED' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_media_selection_content
  ON media_selection_requests(content_asset_id, brief_id, status, created_at);

CREATE TABLE IF NOT EXISTS media_selection_candidates (
  request_id TEXT NOT NULL REFERENCES media_selection_requests(id) ON DELETE CASCADE,
  media_asset_id TEXT NOT NULL REFERENCES media_assets(id),
  semantic_score INTEGER NOT NULL CHECK (semantic_score BETWEEN 0 AND 100),
  score_breakdown_json TEXT NOT NULL,
  candidate_rank INTEGER NOT NULL CHECK (candidate_rank > 0),
  rights_eligible INTEGER NOT NULL CHECK (rights_eligible IN (0, 1)),
  status TEXT NOT NULL CHECK (status IN ('RANKED', 'SELECTED', 'REJECTED')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (request_id, media_asset_id),
  UNIQUE (request_id, candidate_rank)
);
CREATE INDEX IF NOT EXISTS idx_media_candidates_asset
  ON media_selection_candidates(media_asset_id, status, rights_eligible);

CREATE TABLE IF NOT EXISTS content_media (
  id TEXT PRIMARY KEY,
  content_asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL UNIQUE REFERENCES media_selection_requests(id),
  media_asset_id TEXT NOT NULL REFERENCES media_assets(id),
  slot_type TEXT NOT NULL CHECK (slot_type IN ('HERO', 'INLINE', 'DIAGRAM', 'COMPARISON')),
  section_heading TEXT,
  semantic_need TEXT NOT NULL,
  contextual_alt TEXT NOT NULL,
  caption TEXT,
  attribution_text TEXT,
  disclosure_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('PROPOSED', 'APPROVED', 'PUBLISHED', 'REJECTED')),
  selected_by TEXT NOT NULL,
  approved_by TEXT,
  approved_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (contextual_alt != ''),
  CHECK (status NOT IN ('APPROVED', 'PUBLISHED') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_content_media_public
  ON content_media(content_asset_id, status, sort_order, slot_type);

CREATE TABLE IF NOT EXISTS media_audit_events (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'MEDIA_ASSET', 'RIGHTS_GRANT', 'MEDIA_TAG', 'SELECTION_REQUEST', 'CONTENT_MEDIA'
  )),
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('HUMAN', 'SYSTEM', 'AI_ASSISTED', 'IMPORT')),
  actor_id TEXT NOT NULL,
  details_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_audit_entity
  ON media_audit_events(entity_type, entity_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_media_variants_no_update
BEFORE UPDATE ON media_variants BEGIN
  SELECT RAISE(ABORT, 'media variants are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_media_variants_no_delete
BEFORE DELETE ON media_variants BEGIN
  SELECT RAISE(ABORT, 'media variants are append-only');
END;
CREATE TRIGGER IF NOT EXISTS trg_media_generation_no_update
BEFORE UPDATE ON media_generation_records BEGIN
  SELECT RAISE(ABORT, 'media generation records are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_media_generation_no_delete
BEFORE DELETE ON media_generation_records BEGIN
  SELECT RAISE(ABORT, 'media generation records are append-only');
END;
CREATE TRIGGER IF NOT EXISTS trg_media_audit_no_update
BEFORE UPDATE ON media_audit_events BEGIN
  SELECT RAISE(ABORT, 'media audit events are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_media_audit_no_delete
BEFORE DELETE ON media_audit_events BEGIN
  SELECT RAISE(ABORT, 'media audit events are append-only');
END;
CREATE TRIGGER IF NOT EXISTS trg_media_rights_content_immutable
BEFORE UPDATE OF scope_type, scope_value, source_id, copyright_holder, license_type,
  permitted_uses_json, attribution_required, attribution_text, evidence_ref, evidence_checksum,
  valid_from, valid_until
ON media_rights_grants BEGIN
  SELECT RAISE(ABORT, 'media rights grant content is immutable; create a new grant');
END;

PRAGMA optimize;

-- migrate:down
DROP TRIGGER IF EXISTS trg_media_rights_content_immutable;
DROP TRIGGER IF EXISTS trg_media_audit_no_delete;
DROP TRIGGER IF EXISTS trg_media_audit_no_update;
DROP TRIGGER IF EXISTS trg_media_generation_no_delete;
DROP TRIGGER IF EXISTS trg_media_generation_no_update;
DROP TRIGGER IF EXISTS trg_media_variants_no_delete;
DROP TRIGGER IF EXISTS trg_media_variants_no_update;
DROP TABLE IF EXISTS media_audit_events;
DROP TABLE IF EXISTS content_media;
DROP TABLE IF EXISTS media_selection_candidates;
DROP TABLE IF EXISTS media_selection_requests;
DROP TABLE IF EXISTS media_variants;
DROP TABLE IF EXISTS media_generation_records;
DROP TABLE IF EXISTS media_relations;
DROP TABLE IF EXISTS media_tags;
DROP TABLE IF EXISTS media_assets;
DROP TABLE IF EXISTS media_rights_grants;
