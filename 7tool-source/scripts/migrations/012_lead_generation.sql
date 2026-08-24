-- migrate:up
CREATE TABLE IF NOT EXISTS lead_attribution_snapshots (
  lead_id INTEGER PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
  lead_type TEXT NOT NULL,
  article_id TEXT,
  page_url TEXT,
  page_path TEXT,
  keyword_cluster_id TEXT,
  category_slug TEXT,
  product_id TEXT,
  intent_key TEXT,
  cta_key TEXT NOT NULL,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  session_id TEXT,
  source TEXT NOT NULL,
  captured_at INTEGER NOT NULL,
  CHECK (cta_key != '' AND source != ''),
  CHECK (page_url IS NULL OR page_url LIKE 'https://7tool.ru/%'),
  CHECK (page_path IS NULL OR page_path LIKE '/%'),
  CHECK (session_id IS NULL OR length(session_id) BETWEEN 8 AND 120)
);
CREATE INDEX IF NOT EXISTS idx_lead_attribution_article
  ON lead_attribution_snapshots(article_id, captured_at DESC)
  WHERE article_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_attribution_cluster
  ON lead_attribution_snapshots(keyword_cluster_id, captured_at DESC)
  WHERE keyword_cluster_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_attribution_cta
  ON lead_attribution_snapshots(cta_key, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_attribution_session
  ON lead_attribution_snapshots(session_id, captured_at DESC)
  WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_attribution_source
  ON lead_attribution_snapshots(source, captured_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_lead_attribution_no_update
BEFORE UPDATE ON lead_attribution_snapshots BEGIN
  SELECT RAISE(ABORT, 'lead attribution snapshots are immutable');
END;

PRAGMA optimize;

-- migrate:down
DROP TRIGGER IF EXISTS trg_lead_attribution_no_update;
DROP TABLE IF EXISTS lead_attribution_snapshots;
