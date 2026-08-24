import { createHash, randomUUID } from "node:crypto";

export const REVIEW_EXTRACTOR_VERSION = "7tool-review-rules-v1";

export function normalizeReviewText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 10_000);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function bucket(rating) {
  if (!Number.isInteger(rating)) return "UNKNOWN";
  if (rating <= 3) return "NEGATIVE";
  if (rating >= 4) return "POSITIVE";
  return "NEUTRAL";
}

const NEGATIVE_RULES = [
  ["FAILURE", "TEETH_BREAK", "Ломаются зубья или режущая часть", /лома[\p{L}]*\s+(?:зуб|рез|корон)|зуб[\p{L}]*\s+лома/iu, 90, 90, "TROUBLESHOOTING"],
  ["PROBLEM", "OVERHEATING", "Инструмент или оборудование перегревается", /перегрева|сильно греет|нагрева/iu, 80, 80, "TROUBLESHOOTING"],
  ["PROBLEM", "VIBRATION", "Возникает сильная вибрация", /вибрац|вибрир|биение/iu, 75, 70, "TROUBLESHOOTING"],
  ["PROBLEM", "BITING", "Инструмент закусывает или застревает", /закусыва|застрева|клинит/iu, 80, 75, "TROUBLESHOOTING"],
  ["PROBLEM", "NOT_HOLDING", "Оснастка или крепление не держит", /не держит|срыва|проскальз/iu, 85, 80, "TROUBLESHOOTING"],
  ["PROBLEM", "DULLS_QUICKLY", "Режущая часть быстро тупится", /быстро туп|затуп|тупится/iu, 70, 75, "TROUBLESHOOTING"],
  ["COMPATIBILITY_ISSUE", "COMPATIBILITY", "Проблема совместимости оборудования и оснастки", /не подош|не подходит|несовмест|хвостовик|weldon/iu, 75, 90, "COMPATIBILITY"],
  ["INSTALLATION_ISSUE", "INSTALLATION", "Возникла проблема установки или настройки", /не установ|установк|креплен|настро/iu, 65, 70, "HOW_TO"],
  ["USER_ERROR", "USER_ERROR", "Возможна ошибка эксплуатации или выбора режима", /неправильно|ошибся|ошибка пользователя|не тот режим/iu, 55, 60, "HOW_TO"],
];

const POSITIVE_RULES = [
  ["BENEFIT", /удобн|качествен|надежн|быстр|точн|мощн/iu],
  ["USE_CASE", /использ|работал|примен|сверлил|резал|снимал фаск/iu],
  ["APPLICATION", /труб|лист|балк|швеллер|двутавр|монтаж|производств/iu],
];

const GENERAL_RULES = [
  ["QUESTION", /\?|^(?:как|какой|какая|подойдет|можно ли)(?=\s|[!?,.]|$)/iu],
  ["FEATURE_REQUEST", /хотелось бы|не хватает|добавили бы|нужна функция/iu],
  ["COMPARISON", /лучше чем|хуже чем|сравнивал|в отличие от| или /iu],
  ["EXPECTATION", /ожидал|ожидание|думал что/iu],
  ["SLANG", /магнитк|нержа|черняг|люминь/iu],
  ["MATERIAL", /нерж|сталь|алюмин|чугун|титан|мед[ьи]|латун|пластик/iu],
  ["DIMENSION", /\d+(?:[.,]\d+)?\s*(?:мм|см|дюйм|inch|″)/iu],
  ["ACCESSORY", /переходник|адаптер|штифт|выталкив|смазк|сож|держатель|хвостовик/iu],
];

function evidenceSentence(text, pattern) {
  const sentences = text.split(/(?<=[.!?])\s+/u);
  return (sentences.find((sentence) => pattern.test(sentence)) ?? text).slice(0, 240);
}

export function extractReviewInsights(input) {
  const text = normalizeReviewText(input.text);
  if (!text) return [];
  const ratingBucket = bucket(input.rating);
  const insights = [];
  if (ratingBucket === "NEGATIVE" || ratingBucket === "UNKNOWN") {
    for (const [type, problemKey, summary, pattern, severity, commercialRelevance, suggestedContentType] of NEGATIVE_RULES) {
      if (!pattern.test(text)) continue;
      insights.push({ type, normalizedText: summary, evidenceSnippet: evidenceSentence(text, pattern), problemKey, severity, commercialRelevance, suggestedContentType });
    }
  }
  if (ratingBucket === "POSITIVE" || ratingBucket === "UNKNOWN") {
    for (const [type, pattern] of POSITIVE_RULES) {
      if (pattern.test(text)) insights.push({ type, normalizedText: evidenceSentence(text, pattern), evidenceSnippet: evidenceSentence(text, pattern) });
    }
  }
  for (const [type, pattern] of GENERAL_RULES) {
    if (pattern.test(text)) insights.push({ type, normalizedText: evidenceSentence(text, pattern), evidenceSnippet: evidenceSentence(text, pattern) });
  }
  return insights.filter((insight, index, all) => all.findIndex((candidate) => candidate.type === insight.type && candidate.normalizedText === insight.normalizedText) === index);
}

export function registerReviewSourceCandidate(db, input) {
  const url = new URL(input.baseUrl);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Review source must use HTTP(S)");
  if (url.username || url.password) throw new Error("Credentials are forbidden in source URLs");
  const baseUrl = `${url.protocol}//${url.host}`;
  const id = input.id ?? `review-source-${hash(baseUrl).slice(0, 20)}`;
  const now = Date.now();
  db.prepare(`
    INSERT INTO review_source_candidates (
      id, platform, base_url, discovery_source, access_method, terms_status,
      robots_status, status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DISCOVERED', ?, ?, ?)
    ON CONFLICT(base_url) DO UPDATE SET platform = excluded.platform,
      discovery_source = excluded.discovery_source, access_method = excluded.access_method,
      terms_status = excluded.terms_status, robots_status = excluded.robots_status,
      notes = excluded.notes, updated_at = excluded.updated_at
  `).run(id, input.platform, baseUrl, input.discoverySource,
    input.accessMethod ?? "NONE", input.termsStatus ?? "REVIEW_REQUIRED",
    input.robotsStatus ?? "UNKNOWN", input.notes ?? null, now, now);
  return db.prepare("SELECT * FROM review_source_candidates WHERE base_url = ?").get(baseUrl);
}

export function approveReviewSourceCandidate(db, input) {
  if (!input.reviewedBy) throw new Error("Source approval requires a real reviewer");
  const now = Date.now();
  const result = db.prepare(`
    UPDATE review_source_candidates SET access_method = ?, terms_status = 'ALLOWED',
      robots_status = ?, status = 'APPROVED', reviewed_by = ?, reviewed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(input.accessMethod, input.robotsStatus, input.reviewedBy, now, now, input.id);
  if (!result.changes) throw new Error("Review source candidate not found");
}

export function importReviewResearchBatch(db, input) {
  const allowedMethods = new Set(["OFFICIAL_API", "AUTHORIZED_EXPORT", "MANUAL_RESEARCH"]);
  if (!allowedMethods.has(input.accessMethod)) throw new Error("Only approved research acquisition methods are accepted");
  if (input.termsStatus !== "ALLOWED") throw new Error("Source terms must be reviewed and explicitly allowed before import");
  if (!input.baseUrl) throw new Error("Approved review source baseUrl is required");
  const url = new URL(input.baseUrl);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Review source must use HTTP(S)");
  if (url.username || url.password) throw new Error("Credentials are forbidden in source URLs");
  const sourceBaseUrl = `${url.protocol}//${url.host}`;
  const approvedSource = db.prepare(`
    SELECT id, platform, access_method FROM review_source_candidates
    WHERE base_url = ? AND status = 'APPROVED' AND terms_status = 'ALLOWED'
      AND robots_status IN ('ALLOWED', 'NOT_APPLICABLE')
  `).get(sourceBaseUrl);
  if (!approvedSource) throw new Error("Review source must pass recorded human approval before import");
  if (approvedSource.platform !== input.platform || approvedSource.access_method !== input.accessMethod) {
    throw new Error("Review import does not match the approved platform or access method");
  }
  const now = Date.now();
  const sourceId = input.sourceId ?? `marketplace-${hash(input.platform).slice(0, 16)}`;
  const prepared = input.rows.map((row) => {
    if (!row.categorySlug || !row.sourceUrl) throw new Error("Every review row needs categorySlug and sourceUrl");
    const sourceUrl = new URL(row.sourceUrl);
    if (!/^https?:$/.test(sourceUrl.protocol)) throw new Error("Review evidence URL must use HTTP(S)");
    if (sourceUrl.username || sourceUrl.password) throw new Error("Credentials are forbidden in review evidence URLs");
    const text = normalizeReviewText(row.text);
    if (!text) return { row, text, insights: [], reviewHash: null };
    const rating = row.rating == null ? null : Number(row.rating);
    if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) throw new Error(`Invalid review rating: ${row.rating}`);
    return { row: { ...row, rating }, text, insights: extractReviewInsights({ text, rating }), reviewHash: hash(`${row.sourceUrl}\u0000${row.sourceProductRef ?? ""}\u0000${rating ?? ""}\u0000${text}`) };
  });
  const runId = randomUUID();
  const inputChecksum = hash(JSON.stringify(prepared.map(({ row, reviewHash }) => ({ sourceUrl: row.sourceUrl, reviewHash }))));
  let insertedInsights = 0;
  let insertedPainMentions = 0;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO sources (id, source_type, name, base_url, rights_policy, active, created_at, updated_at)
      VALUES (?, 'MARKETPLACE', ?, ?, 'RESEARCH_ONLY', 1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, base_url = excluded.base_url,
        rights_policy = 'RESEARCH_ONLY', active = 1, updated_at = excluded.updated_at
    `).run(sourceId, input.platform, sourceBaseUrl, now, now);
    db.prepare(`
      INSERT INTO import_runs (id, source_id, started_at, completed_at, status, input_checksum,
        record_count, rejected_count, parser_version, schema_version)
      VALUES (?, ?, ?, ?, 'SUCCEEDED', ?, ?, ?, ?, 'review-insights-v1')
    `).run(runId, sourceId, now, now, inputChecksum, prepared.length,
      prepared.filter((item) => !item.insights.length).length, REVIEW_EXTRACTOR_VERSION);

    const insertInsight = db.prepare(`
      INSERT OR IGNORE INTO review_insights (
        id, source_id, source_url, source_product_ref, product_id, category_slug,
        insight_type, normalized_text, evidence_snippet, rating, rating_bucket,
        aggregate_count, observed_at, rights_status, checksum, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'RESEARCH_ONLY', ?, 'ACTIVE', ?, ?)
    `);
    for (const item of prepared) {
      for (const insight of item.insights) {
        const checksum = hash(`${item.reviewHash}\u0000${insight.type}\u0000${insight.normalizedText}`);
        const result = insertInsight.run(randomUUID(), sourceId, item.row.sourceUrl,
          item.row.sourceProductRef ?? null, item.row.productId ?? null, item.row.categorySlug,
          insight.type, insight.normalizedText.slice(0, 1000), insight.evidenceSnippet?.slice(0, 240) ?? null,
          item.row.rating, bucket(item.row.rating), item.row.observedAt ?? now, checksum, now, now);
        if (!result.changes) continue;
        insertedInsights++;
        if (item.row.rating !== null && item.row.rating <= 3 && insight.problemKey) {
          const productType = item.row.productType ?? "";
          const priority = Math.round(insight.severity * 0.55 + insight.commercialRelevance * 0.45);
          const painId = `pain-${hash(`${item.row.categorySlug}\u0000${productType}\u0000${insight.problemKey}`).slice(0, 24)}`;
          db.prepare(`
            INSERT INTO pain_points (
              id, category_slug, product_type, problem_key, problem, mentions, sources_count,
              severity, commercial_relevance, suggested_content_type, priority, status,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, 'DISCOVERED', ?, ?)
            ON CONFLICT(category_slug, product_type, problem_key) DO UPDATE SET
              mentions = pain_points.mentions + 1,
              severity = MAX(pain_points.severity, excluded.severity),
              commercial_relevance = MAX(pain_points.commercial_relevance, excluded.commercial_relevance),
              priority = MAX(pain_points.priority, excluded.priority), updated_at = excluded.updated_at
          `).run(painId, item.row.categorySlug, productType, insight.problemKey, insight.normalizedText,
            insight.severity, insight.commercialRelevance, insight.suggestedContentType, priority, now, now);
          db.prepare(`
            INSERT INTO pain_point_sources (pain_point_id, source_id, platform, mentions, first_seen_at, last_seen_at)
            VALUES (?, ?, ?, 1, ?, ?)
            ON CONFLICT(pain_point_id, source_id) DO UPDATE SET
              mentions = pain_point_sources.mentions + 1, last_seen_at = excluded.last_seen_at
          `).run(painId, sourceId, input.platform, now, now);
          db.prepare(`UPDATE pain_points SET sources_count =
            (SELECT COUNT(*) FROM pain_point_sources WHERE pain_point_id = ?), updated_at = ? WHERE id = ?`
          ).run(painId, now, painId);
          insertedPainMentions++;
        }
      }
    }
  })();
  return { runId, sourceId, reviews: prepared.length, insertedInsights, insertedPainMentions, inputChecksum };
}

export function listPriorityPainPoints(db, categorySlug, limit = 50) {
  return db.prepare(`
    SELECT * FROM pain_points WHERE category_slug = ? AND status IN ('DISCOVERED', 'REVIEWED')
    ORDER BY priority DESC, mentions DESC, problem_key LIMIT ?
  `).all(categorySlug, Math.max(1, Math.min(500, limit)));
}
