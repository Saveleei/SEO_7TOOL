import { createHash, randomUUID } from "node:crypto";

export const SEMANTIC_MODEL_VERSION = "7tool-ru-rules-v1";
export const CLUSTER_MODEL_VERSION = "7tool-token-jaccard-v1";

const STOP_WORDS = new Set([
  "и", "в", "во", "на", "для", "по", "с", "со", "к", "из", "от", "до", "под",
  "над", "при", "а", "или", "это", "как", "какой", "какая", "какие", "ли",
]);

export function normalizeKeyword(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[“”„«»]/g, '"')
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return normalizeKeyword(value).split(" ").filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function containsAny(query, patterns) {
  return patterns.some((pattern) => pattern.test(query));
}

export function classifySearchIntent(value) {
  const query = normalizeKeyword(value);
  const rules = [
    ["COMPARISON", [/(?:^|\s)vs(?:\s|$)/, /(?:^|\s)или(?:\s|$)/, /сравн/, /разниц/, /отлич/]],
    ["PROBLEM", [/перегрева/, /лома/, /тупит/, /тупится/, /не держит/, /закусыва/, /вибрир/, /почему/, /ошибк/, /не работа/]],
    ["COMPATIBILITY", [/совместим/, /подходит ли/, /какая коронк/, /какой хвостовик/, /weldon/, /подойдет ли/, /оснастк.*для/]],
    ["SELECTION", [/как выбрать/, /какой выбрать/, /подбор/, /подобрать/, /лучший/, /рейтинг/]],
    ["HOW_TO", [/^как /, /инструкц/, /установить/, /настроить/, /пользоваться/, /сверлить/, /резать/, /снять фаск/]],
    ["COMMERCIAL", [/купить/, /цена/, /стоимость/, /в наличии/, /заказать/, /поставка/]],
    ["SPECIFICATION", [/диаметр/, /мощност/, /оборот/, /вес/, /глубин/, /посадк/, /момент/, /размер/, /мм\b/, /вольт/, /ватт/]],
    ["MATERIAL", [/нержав/, /hardox/, /алюмин/, /чугун/, /сталь/, /титан/, /материал/]],
    ["APPLICATION", [/двутавр/, /швеллер/, /балк/, /лист/, /труб/, /монтаж/, /производств/, /для чего/, /применен/]],
  ];
  for (const [intentClass, patterns] of rules) {
    if (containsAny(query, patterns)) return { intentClass, confidence: 0.85, rule: patterns.find((pattern) => pattern.test(query)).source };
  }
  if (query) return { intentClass: "PRODUCT", confidence: 0.55, rule: "fallback_product" };
  return { intentClass: "UNKNOWN", confidence: 0, rule: "empty" };
}

export function keywordSimilarity(left, right) {
  const a = new Set(tokens(left));
  const b = new Set(tokens(right));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

export function clusterKeywordRecords(records, threshold = 0.72) {
  const items = records.map((record, index) => ({
    ...record, index, normalizedQuery: normalizeKeyword(record.normalizedQuery ?? record.query),
    intentClass: record.intentClass ?? classifySearchIntent(record.query).intentClass,
  }));
  const parent = items.map((_, index) => index);
  const find = (index) => parent[index] === index ? index : (parent[index] = find(parent[index]));
  const union = (a, b) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent[rb] = ra; };
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].intentClass !== items[j].intentClass) continue;
      if (items[i].normalizedQuery === items[j].normalizedQuery || keywordSimilarity(items[i].normalizedQuery, items[j].normalizedQuery) >= threshold) {
        union(i, j);
      }
    }
  }
  const groups = new Map();
  for (const item of items) {
    const root = find(item.index);
    const group = groups.get(root) ?? [];
    group.push(item);
    groups.set(root, group);
  }
  return [...groups.values()].map((members) => ({
    intentClass: members[0].intentClass,
    centroid: [...members].sort((a, b) => a.normalizedQuery.length - b.normalizedQuery.length || a.normalizedQuery.localeCompare(b.normalizedQuery, "ru"))[0].normalizedQuery,
    members: members.map(({ index, ...member }) => member),
  }));
}

function stableId(prefix, value) {
  return `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
}

export function normalizeSitePath(value) {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error("Site path is required");
  let url;
  try { url = new URL(raw, "https://7tool.ru"); } catch { throw new Error(`Invalid site URL: ${raw}`); }
  const path = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  return url.search && ![...url.searchParams.keys()].every((key) => key.startsWith("utm_")) ? `${path}${url.search}` : path;
}

export function registerSiteUrl(db, input) {
  const path = normalizeSitePath(input.path);
  const id = input.id ?? stableId("url", path);
  const now = Date.now();
  db.prepare(`
    INSERT INTO site_urls (id, path, page_type, entity_type, entity_id, index_status,
      http_status, content_fingerprint, last_crawled_at, published_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET page_type = excluded.page_type,
      entity_type = excluded.entity_type, entity_id = excluded.entity_id,
      index_status = excluded.index_status, http_status = excluded.http_status,
      content_fingerprint = excluded.content_fingerprint,
      last_crawled_at = excluded.last_crawled_at, updated_at = excluded.updated_at
  `).run(id, path, input.pageType, input.entityType ?? null, input.entityId ?? null,
    input.indexStatus ?? "UNKNOWN", input.httpStatus ?? null, input.contentFingerprint ?? null,
    input.lastCrawledAt ?? null, input.publishedAt ?? null, now, now);
  return db.prepare("SELECT id, path FROM site_urls WHERE path = ?").get(path);
}

export function importKeywordBatch(db, input) {
  const allowedSources = new Set(["WORDSTAT", "GSC", "YANDEX_WEBMASTER", "INTERNAL_SEARCH", "MANUAL"]);
  if (!allowedSources.has(input.sourceType)) throw new Error(`Unsupported keyword source: ${input.sourceType}`);
  const normalizedRows = input.rows.map((row) => {
    const normalizedQuery = normalizeKeyword(row.query);
    if (!normalizedQuery) throw new Error("Keyword query cannot be empty");
    const intent = classifySearchIntent(normalizedQuery);
    return { ...row, normalizedQuery, intent };
  });
  const now = Date.now();
  const sourceId = input.sourceId ?? input.sourceType.toLocaleLowerCase("en-US");
  const runId = randomUUID();
  const checksum = createHash("sha256").update(JSON.stringify(normalizedRows)).digest("hex");
  const insertKeyword = db.prepare(`
    INSERT INTO seo_keywords (
      id, query, normalized_query, source_id, source_keyword_id, region, language,
      frequency, exact_frequency, seasonality_json, category_slug, product_id,
      intent_class, intent_confidence, commercial_score, business_value,
      existing_url_id, status, first_seen_at, last_seen_at, created_at, updated_at
    ) VALUES (
      @id, @query, @normalized_query, @source_id, @source_keyword_id, @region, @language,
      @frequency, @exact_frequency, @seasonality_json, @category_slug, @product_id,
      @intent_class, @intent_confidence, @commercial_score, @business_value,
      @existing_url_id, 'NORMALIZED', @first_seen_at, @last_seen_at, @created_at, @updated_at
    )
    ON CONFLICT(normalized_query, source_id, region, language) DO UPDATE SET
      query = excluded.query, frequency = excluded.frequency,
      exact_frequency = excluded.exact_frequency, seasonality_json = excluded.seasonality_json,
      category_slug = COALESCE(excluded.category_slug, seo_keywords.category_slug),
      product_id = COALESCE(excluded.product_id, seo_keywords.product_id),
      intent_class = excluded.intent_class, intent_confidence = excluded.intent_confidence,
      commercial_score = excluded.commercial_score, business_value = excluded.business_value,
      existing_url_id = COALESCE(excluded.existing_url_id, seo_keywords.existing_url_id),
      last_seen_at = excluded.last_seen_at, updated_at = excluded.updated_at
  `);
  db.transaction(() => {
    db.prepare(`
      INSERT INTO sources (id, source_type, name, rights_policy, active, created_at, updated_at)
      VALUES (?, ?, ?, 'PUBLISHABLE_FACTS', 1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET active = 1, updated_at = excluded.updated_at
    `).run(sourceId, input.sourceType, input.sourceName ?? input.sourceType, now, now);
    db.prepare(`
      INSERT INTO import_runs (id, source_id, started_at, completed_at, status, input_checksum,
        record_count, rejected_count, parser_version, schema_version)
      VALUES (?, ?, ?, ?, 'SUCCEEDED', ?, ?, 0, ?, 'seo-keywords-v1')
    `).run(runId, sourceId, now, now, checksum, normalizedRows.length, input.parserVersion ?? "keyword-import-v1");
    for (const row of normalizedRows) {
      const existingUrl = row.existingUrl ? registerSiteUrl(db, {
        path: row.existingUrl, pageType: row.pageType ?? "UNKNOWN", indexStatus: row.indexStatus ?? "UNKNOWN",
      }) : null;
      insertKeyword.run({
        id: row.id ?? randomUUID(), query: String(row.query).trim(), normalized_query: row.normalizedQuery,
        source_id: sourceId, source_keyword_id: row.sourceKeywordId ?? null,
        region: input.region ?? "RU", language: input.language ?? "ru",
        frequency: row.frequency ?? null, exact_frequency: row.exactFrequency ?? null,
        seasonality_json: row.seasonality ? JSON.stringify(row.seasonality) : null,
        category_slug: row.categorySlug ?? input.categorySlug ?? null,
        product_id: row.productId ?? null, intent_class: row.intent.intentClass,
        intent_confidence: row.intent.confidence,
        commercial_score: row.commercialScore ?? null, business_value: row.businessValue ?? null,
        existing_url_id: existingUrl?.id ?? null,
        first_seen_at: now, last_seen_at: now, created_at: now, updated_at: now,
      });
    }
  })();
  return { runId, sourceId, count: normalizedRows.length, checksum };
}

export function persistConservativeClusters(db, { categorySlug, sourceId, threshold = 0.72 }) {
  const rows = db.prepare(`
    SELECT id, query, normalized_query AS normalizedQuery, intent_class AS intentClass
    FROM seo_keywords WHERE category_slug = ? AND source_id = ? AND status != 'REJECTED'
    ORDER BY normalized_query
  `).all(categorySlug, sourceId);
  const groups = clusterKeywordRecords(rows, threshold);
  const now = Date.now();
  db.transaction(() => {
    for (const group of groups) {
      const clusterId = stableId("cluster", `${categorySlug}\u0000${group.intentClass}\u0000${group.centroid}`);
      const intentKey = `${categorySlug}:${group.intentClass.toLocaleLowerCase("en-US")}:${clusterId.slice(-12)}`;
      const intentId = stableId("intent", intentKey);
      db.prepare(`
        INSERT INTO keyword_clusters (id, name, category_slug, centroid_text, cluster_method, model_version, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'TOKEN_JACCARD', ?, 'PROPOSED', ?, ?)
        ON CONFLICT(id) DO UPDATE SET centroid_text = excluded.centroid_text, updated_at = excluded.updated_at
      `).run(clusterId, group.centroid, categorySlug, group.centroid, CLUSTER_MODEL_VERSION, now, now);
      db.prepare(`
        INSERT INTO search_intents (id, intent_key, label, intent_class, category_slug, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'PROPOSED', ?, ?)
        ON CONFLICT(intent_key) DO UPDATE SET label = excluded.label, updated_at = excluded.updated_at
      `).run(intentId, intentKey, group.centroid, group.intentClass, categorySlug, now, now);
      const update = db.prepare("UPDATE seo_keywords SET cluster_id = ?, intent_id = ?, status = 'CLUSTERED', updated_at = ? WHERE id = ?");
      for (const member of group.members) update.run(clusterId, intentId, now, member.id);
    }
  })();
  return groups;
}

export function reviewIntentWithPreferredUrl(db, input) {
  if (!input.reviewedBy) throw new Error("A real reviewer id is required");
  const url = db.prepare("SELECT id, index_status, http_status FROM site_urls WHERE id = ?").get(input.siteUrlId);
  if (!url) throw new Error("Preferred URL is not registered");
  if (url.index_status !== "INDEX" || (url.http_status !== null && url.http_status !== 200)) {
    throw new Error("Preferred URL must be indexable and return 200");
  }
  const now = Date.now();
  db.transaction(() => {
    db.prepare(`UPDATE search_intents SET preferred_url_id = ?, status = 'REVIEWED',
      reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`
    ).run(input.siteUrlId, input.reviewedBy, now, now, input.intentId);
    db.prepare(`
      INSERT INTO intent_url_mappings (intent_id, site_url_id, mapping_role, status, evidence,
        reviewed_by, reviewed_at, created_at, updated_at)
      VALUES (?, ?, 'PRIMARY', 'APPROVED', ?, ?, ?, ?, ?)
      ON CONFLICT(intent_id, site_url_id) DO UPDATE SET mapping_role = 'PRIMARY', status = 'APPROVED',
        evidence = excluded.evidence, reviewed_by = excluded.reviewed_by,
        reviewed_at = excluded.reviewed_at, updated_at = excluded.updated_at
    `).run(input.intentId, input.siteUrlId, input.evidence ?? null, input.reviewedBy, now, now, now);
  })();
}

export function detectCannibalizationCandidates(db, categorySlug) {
  return db.prepare(`
    SELECT k.cluster_id, kc.name AS cluster_name, COUNT(DISTINCT k.existing_url_id) AS url_count,
      GROUP_CONCAT(DISTINCT su.path) AS paths
    FROM seo_keywords k
    JOIN keyword_clusters kc ON kc.id = k.cluster_id
    JOIN site_urls su ON su.id = k.existing_url_id
    WHERE k.category_slug = ? AND k.cluster_id IS NOT NULL AND k.existing_url_id IS NOT NULL
      AND su.index_status = 'INDEX'
    GROUP BY k.cluster_id HAVING COUNT(DISTINCT k.existing_url_id) > 1
    ORDER BY url_count DESC, kc.name
  `).all(categorySlug);
}
