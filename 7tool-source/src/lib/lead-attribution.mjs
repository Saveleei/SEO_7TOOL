import { deriveLeadSource, normalizeLeadCtaKey } from "./lead-generation.mjs";

function contextText(value, max = 500) {
  return typeof value === "string" && value.trim() ? value.trim().replace(/\s+/gu, " ").slice(0, max) : null;
}

function normalizedPagePath(value) {
  if (!value) return null;
  try { return new URL(value).pathname.slice(0, 1_000) || "/"; } catch { return null; }
}

function decodedArticleSlug(path) {
  const raw = path.slice("/articles/".length);
  try { return decodeURIComponent(raw); } catch { return raw; }
}

export function buildLeadAttributionSnapshot(connection, { leadId, payload, extra, attribution, activeTouch, yclid, capturedAt }) {
  const path = normalizedPagePath(payload.pageUrl);
  let articleId = null;
  let keywordClusterId = null;
  let category = contextText(payload.category ?? extra.category, 200);
  let intent = contextText(payload.intent ?? extra.intent, 200);
  if (path?.startsWith("/articles/")) {
    const article = connection.prepare(`
      SELECT a.id, a.cluster_id, a.category_slug, i.intent_key
      FROM content_assets a LEFT JOIN search_intents i ON i.id = a.intent_id
      WHERE a.slug = ? AND a.status = 'PUBLISHED' AND a.human_reviewed = 1
      LIMIT 1
    `).get(decodedArticleSlug(path));
    if (article) {
      articleId = article.id;
      keywordClusterId = article.cluster_id;
      category = article.category_slug;
      intent = article.intent_key;
    }
  }
  let productId = contextText(payload.productId, 200);
  if (productId) {
    const product = connection.prepare("SELECT id, category FROM products WHERE id = ? AND draft = 0").get(productId);
    if (!product) productId = null;
    else if (!articleId) category = product.category;
  }
  const touch = (key) => contextText(activeTouch[key], 500);
  const referrer = touch("referrer") ?? contextText(attribution.referrer, 500);
  const sessionId = contextText(attribution.sessionId, 120);
  const ctaKey = normalizeLeadCtaKey(payload.ctaKey, payload.type);
  const source = deriveLeadSource({ yclid, utmSource: touch("utm_source"), referrer });
  return {
    leadId, leadType: payload.type, articleId, pageUrl: payload.pageUrl ?? null,
    pagePath: path, keywordClusterId, categorySlug: category, productId,
    intentKey: intent, ctaKey, referrer, utmSource: touch("utm_source"),
    utmMedium: touch("utm_medium"), utmCampaign: touch("utm_campaign"),
    utmContent: touch("utm_content"), utmTerm: touch("utm_term"),
    sessionId, source, capturedAt,
  };
}

export function saveLeadAttributionSnapshot(connection, input) {
  const schema = connection.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'lead_attribution_snapshots'").get();
  if (!schema) return null;
  const snapshot = buildLeadAttributionSnapshot(connection, input);
  connection.prepare(`
    INSERT INTO lead_attribution_snapshots (
      lead_id, lead_type, article_id, page_url, page_path, keyword_cluster_id,
      category_slug, product_id, intent_key, cta_key, referrer, utm_source,
      utm_medium, utm_campaign, utm_content, utm_term, session_id, source, captured_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    snapshot.leadId, snapshot.leadType, snapshot.articleId, snapshot.pageUrl,
    snapshot.pagePath, snapshot.keywordClusterId, snapshot.categorySlug,
    snapshot.productId, snapshot.intentKey, snapshot.ctaKey, snapshot.referrer,
    snapshot.utmSource, snapshot.utmMedium, snapshot.utmCampaign,
    snapshot.utmContent, snapshot.utmTerm, snapshot.sessionId, snapshot.source,
    snapshot.capturedAt,
  );
  return snapshot;
}
