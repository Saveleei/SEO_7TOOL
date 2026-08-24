import { createHash, randomUUID } from "node:crypto";
import { isAssetPublicationRightsEligible } from "./image-intelligence.mjs";

export const ARTICLE_STATUSES = Object.freeze([
  "DISCOVERED", "SEMANTIC_REVIEW", "BRIEF_READY", "BRIEF_APPROVED", "CONTENT_DRAFT",
  "FACT_CHECK", "SEO_REVIEW", "EXPERT_REVIEW", "READY", "PUBLISHED",
  "UPDATE_REQUIRED", "MERGE_REQUIRED", "ARCHIVED",
]);

export const ARTICLE_SCORE_GATES = Object.freeze({
  quality: 85,
  evidence: 80,
  differentiation: 60,
});

const ACTOR_TYPES = new Set(["HUMAN", "SYSTEM", "AI_ASSISTED", "IMPORT"]);
const ARTICLE_TYPE_BY_OPPORTUNITY = Object.freeze({
  PILLAR_GUIDE: "GUIDE",
  HOW_TO: "HOW_TO",
  TROUBLESHOOTING: "TROUBLESHOOTING",
  COMPARISON: "COMPARISON",
  COMPATIBILITY: "COMPATIBILITY",
  CASE_STUDY: "CASE_STUDY",
  TEST: "TEST",
  REFERENCE: "REFERENCE",
  FAQ: "FAQ",
});

const GENERIC_TRANSITIONS = new Map([
  ["DISCOVERED", new Set(["SEMANTIC_REVIEW", "ARCHIVED"])],
  ["CONTENT_DRAFT", new Set(["FACT_CHECK", "ARCHIVED"])],
  ["FACT_CHECK", new Set(["SEO_REVIEW", "CONTENT_DRAFT", "ARCHIVED"])],
  ["SEO_REVIEW", new Set(["EXPERT_REVIEW", "CONTENT_DRAFT", "ARCHIVED"])],
  ["EXPERT_REVIEW", new Set(["READY", "CONTENT_DRAFT", "ARCHIVED"])],
  ["READY", new Set(["PUBLISHED", "CONTENT_DRAFT", "ARCHIVED"])],
  ["PUBLISHED", new Set(["UPDATE_REQUIRED", "MERGE_REQUIRED"])],
  ["UPDATE_REQUIRED", new Set(["SEMANTIC_REVIEW", "ARCHIVED"])],
  ["MERGE_REQUIRED", new Set(["ARCHIVED"])],
]);

const HUMAN_ONLY_TARGETS = new Set(["SEO_REVIEW", "EXPERT_REVIEW", "READY", "PUBLISHED", "ARCHIVED"]);

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function cleanText(value, limit = 2000) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\t\r ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, limit);
}

function requireText(value, name, limit = 2000) {
  const result = cleanText(value, limit);
  if (!result) throw new Error(`${name} is required`);
  return result;
}

function actorFrom(input) {
  const actorType = cleanText(input.actorType, 30);
  const actorId = cleanText(input.actorId, 200);
  if (!ACTOR_TYPES.has(actorType)) throw new Error("actorType must be HUMAN, SYSTEM, AI_ASSISTED or IMPORT");
  if (!actorId) throw new Error("actorId is required");
  return { actorType, actorId };
}

function requireHuman(input, action) {
  const actor = actorFrom(input);
  if (actor.actorType !== "HUMAN") throw new Error(`${action} requires a human actor`);
  return actor;
}

function validateSlug(value) {
  const slug = cleanText(value, 160).toLocaleLowerCase("en-US");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("slug must contain lowercase latin letters, digits and single hyphens");
  }
  return slug;
}

function integerScore(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 100) throw new Error(`${name} must be an integer from 0 to 100`);
  return number;
}

function sentenceCount(value) {
  const text = cleanText(value, 4000);
  if (!text) return 0;
  const terminal = text.match(/[.!?]+(?=\s|$)/g)?.length ?? 0;
  return Math.max(1, terminal);
}

function textArray(value, name, { minimum = 0, maximum = 100, limit = 2000 } = {}) {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  const result = value.map((item, index) => requireText(item, `${name}[${index}]`, limit));
  if (result.length < minimum || result.length > maximum) throw new Error(`${name} must contain ${minimum}-${maximum} items`);
  return result;
}

function contentAsset(db, articleId) {
  const row = db.prepare("SELECT * FROM content_assets WHERE id = ?").get(articleId);
  if (!row) throw new Error("Content asset not found");
  return row;
}

function addWorkflowEvent(db, articleId, fromStatus, toStatus, actor, reason, now = Date.now()) {
  db.prepare(`
    INSERT INTO workflow_events (
      id, entity_type, entity_id, from_status, to_status, actor_type, actor_id, reason, created_at
    ) VALUES (?, 'CONTENT_ASSET', ?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), articleId, fromStatus, toStatus, actor.actorType, actor.actorId, requireText(reason, "reason", 1000), now);
}

function addApproval(db, { articleId, briefId = null, revisionId = null, approvalType, reviewer, notes = null, now = Date.now() }) {
  db.prepare(`
    INSERT INTO content_approvals (
      id, content_asset_id, brief_id, revision_id, approval_type, decision, reviewer, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, 'APPROVED', ?, ?, ?)
  `).run(randomUUID(), articleId, briefId, revisionId, approvalType, reviewer, cleanText(notes, 2000) || null, now);
}

export function createArticleCandidate(db, input) {
  const actor = actorFrom(input);
  const slug = validateSlug(input.slug);
  const opportunity = db.prepare(`
    SELECT o.*, k.query AS primary_keyword, i.status AS intent_status, c.status AS cluster_status
    FROM content_opportunities o
    JOIN seo_keywords k ON k.id = o.primary_keyword_id
    JOIN search_intents i ON i.id = o.intent_id
    JOIN keyword_clusters c ON c.id = o.cluster_id
    WHERE o.id = ?
  `).get(input.opportunityId);
  if (!opportunity) throw new Error("Content opportunity not found");
  if (opportunity.status !== "REVIEWED" || opportunity.decision !== "CREATE") {
    throw new Error("Only a human-reviewed CREATE opportunity can create an article candidate");
  }
  const contentType = ARTICLE_TYPE_BY_OPPORTUNITY[opportunity.recommended_page_type];
  if (!contentType) {
    throw new Error(`${opportunity.recommended_page_type} belongs to a later dedicated content phase`);
  }
  const existing = db.prepare("SELECT * FROM content_assets WHERE opportunity_id = ? OR slug = ?").get(opportunity.id, slug);
  if (existing) {
    if (existing.opportunity_id === opportunity.id && existing.slug === slug) return { article: existing, duplicate: true };
    throw new Error("Article opportunity or slug is already in use");
  }
  const title = requireText(input.title || opportunity.topic, "title", 300);
  const h1 = requireText(input.h1 || title, "h1", 300);
  const now = Date.now();
  const id = `content-${hash(opportunity.id).slice(0, 24)}`;
  db.transaction(() => {
    db.prepare(`
      INSERT INTO content_assets (
        id, content_type, opportunity_id, source_opportunity_checksum, slug, status,
        title, h1, category_slug, primary_keyword_id, primary_keyword, intent_id,
        cluster_id, canonical, index_status, differentiation_score, business_score,
        generated_by_ai, human_reviewed, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, 'DISCOVERED', ?, ?, ?, ?, ?, ?, ?, ?, 'NOINDEX', ?, ?, 0, 0, ?, ?
      )
    `).run(
      id, contentType, opportunity.id, opportunity.evaluation_checksum, slug, title, h1,
      opportunity.category_slug, opportunity.primary_keyword_id, opportunity.primary_keyword,
      opportunity.intent_id, opportunity.cluster_id, `/articles/${slug}`,
      opportunity.differentiation_score, opportunity.business_priority, now, now,
    );
    const secondary = db.prepare(`
      SELECT id FROM seo_keywords
      WHERE cluster_id = ? AND id != ? AND status IN ('CLUSTERED', 'REVIEWED')
      ORDER BY COALESCE(exact_frequency, frequency, 0) DESC, normalized_query
      LIMIT 50
    `).all(opportunity.cluster_id, opportunity.primary_keyword_id);
    const insertSecondary = db.prepare("INSERT INTO content_secondary_keywords (content_asset_id, keyword_id) VALUES (?, ?)");
    for (const keyword of secondary) insertSecondary.run(id, keyword.id);
    addWorkflowEvent(db, id, null, "DISCOVERED", actor, "Article candidate created from a reviewed CREATE opportunity", now);
  })();
  return { article: contentAsset(db, id), duplicate: false };
}

function normalizeVerifiedFacts(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error("verifiedFacts must contain at least one sourced fact");
  return value.map((fact, index) => {
    if (!fact || typeof fact !== "object") throw new Error(`verifiedFacts[${index}] must be an object`);
    return {
      text: requireText(fact.text, `verifiedFacts[${index}].text`, 2000),
      sourceRef: requireText(fact.sourceRef, `verifiedFacts[${index}].sourceRef`, 500),
      sourceId: cleanText(fact.sourceId, 200) || null,
      sourceFactId: cleanText(fact.sourceFactId, 200) || null,
      assertionId: cleanText(fact.assertionId, 200) || null,
    };
  });
}

function normalizeSupplierImages(value) {
  if (!Array.isArray(value)) throw new Error("relevantSupplierImages must be an array");
  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`relevantSupplierImages[${index}] must be an object`);
    return {
      description: requireText(item.description, `relevantSupplierImages[${index}].description`, 1000),
      sourceRef: requireText(item.sourceRef, `relevantSupplierImages[${index}].sourceRef`, 500),
    };
  });
}

function addBriefItems(items, type, values, projector = (value) => ({ text: value })) {
  values.forEach((value, sortOrder) => {
    const projected = projector(value);
    items.push({ type, sortOrder, text: projected.text, referenceId: projected.referenceId ?? null, sourceRef: projected.sourceRef ?? null });
  });
}

export function createArticleBrief(db, input) {
  const actor = actorFrom(input);
  const article = contentAsset(db, input.articleId);
  if (article.status !== "SEMANTIC_REVIEW") throw new Error("Article must be in SEMANTIC_REVIEW before a brief is created");
  const semantic = db.prepare(`
    SELECT i.status AS intent_status, c.status AS cluster_status
    FROM content_assets a
    JOIN search_intents i ON i.id = a.intent_id
    JOIN keyword_clusters c ON c.id = a.cluster_id
    WHERE a.id = ?
  `).get(article.id);
  if (semantic.intent_status !== "REVIEWED" || semantic.cluster_status !== "REVIEWED") {
    throw new Error("Intent and keyword cluster require human semantic review before briefing");
  }
  const userIntent = requireText(input.userIntent, "userIntent", 1000);
  const problem = requireText(input.problem, "problem", 2000);
  const audience = requireText(input.audience, "audience", 1000);
  const shortAnswer = requireText(input.shortAnswer, "shortAnswer", 3000);
  const shortAnswerSentences = sentenceCount(shortAnswer);
  if (shortAnswerSentences < 2 || shortAnswerSentences > 5) throw new Error("shortAnswer must contain 2-5 sentences");
  const calculatorRequirement = requireText(input.calculatorRequirement, "calculatorRequirement", 1000);
  const cta = requireText(input.cta, "cta", 1000);
  const keyQuestions = textArray(input.keyQuestions, "keyQuestions", { minimum: 1, maximum: 40 });
  const verifiedFacts = normalizeVerifiedFacts(input.verifiedFacts);
  const relevantProducts = textArray(input.relevantProducts, "relevantProducts", { minimum: 1, maximum: 100, limit: 200 });
  const relevantSupplierImages = normalizeSupplierImages(input.relevantSupplierImages ?? []);
  const requiredDiagrams = textArray(input.requiredDiagrams ?? [], "requiredDiagrams", { maximum: 40 });
  const requiredTables = textArray(input.requiredTables ?? [], "requiredTables", { maximum: 40 });
  const faqInsights = textArray(input.faqInsights ?? [], "faqInsights", { maximum: 100 });
  const competitorGaps = textArray(input.competitorGaps, "competitorGaps", { minimum: 1, maximum: 100 });
  const internalLinks = textArray(input.internalLinks ?? [], "internalLinks", { maximum: 100, limit: 500 });
  const evidenceRequirements = textArray(input.evidenceRequirements, "evidenceRequirements", { minimum: 1, maximum: 100 });

  const productRows = relevantProducts.map((productId) => {
    const row = db.prepare("SELECT id, category, draft FROM products WHERE id = ?").get(productId);
    if (!row || row.draft !== 0 || row.category !== article.category_slug) {
      throw new Error(`Relevant product ${productId} must be a live product in article category ${article.category_slug}`);
    }
    return row;
  });
  for (const fact of verifiedFacts) {
    if (fact.sourceId && !db.prepare("SELECT 1 FROM sources WHERE id = ?").get(fact.sourceId)) throw new Error(`Unknown source: ${fact.sourceId}`);
    if (fact.sourceFactId) {
      const sourceFact = db.prepare("SELECT source_id, status FROM source_facts WHERE id = ?").get(fact.sourceFactId);
      if (!sourceFact) throw new Error(`Unknown source fact: ${fact.sourceFactId}`);
      if (fact.sourceId && fact.sourceId !== sourceFact.source_id) throw new Error(`Source fact ${fact.sourceFactId} does not belong to ${fact.sourceId}`);
      fact.sourceId ??= sourceFact.source_id;
      if (!new Set(["VALID", "OBSERVED"]).has(sourceFact.status)) throw new Error(`Source fact ${fact.sourceFactId} is not usable evidence`);
    }
    if (fact.assertionId) {
      const assertion = db.prepare("SELECT verification_status FROM fact_assertions WHERE id = ?").get(fact.assertionId);
      if (!assertion) throw new Error(`Unknown fact assertion: ${fact.assertionId}`);
      if (assertion.verification_status !== "VERIFIED") throw new Error(`Fact assertion ${fact.assertionId} is not VERIFIED`);
    }
  }

  const items = [];
  addBriefItems(items, "KEY_QUESTION", keyQuestions);
  addBriefItems(items, "VERIFIED_FACT", verifiedFacts, (value) => ({ text: value.text, referenceId: value.sourceFactId || value.assertionId, sourceRef: value.sourceRef }));
  addBriefItems(items, "RELEVANT_PRODUCT", productRows, (value) => ({ text: value.id, referenceId: value.id }));
  addBriefItems(items, "SUPPLIER_IMAGE", relevantSupplierImages, (value) => ({ text: value.description, sourceRef: value.sourceRef }));
  addBriefItems(items, "REQUIRED_DIAGRAM", requiredDiagrams);
  addBriefItems(items, "REQUIRED_TABLE", requiredTables);
  addBriefItems(items, "FAQ_INSIGHT", faqInsights);
  addBriefItems(items, "COMPETITOR_GAP", competitorGaps);
  addBriefItems(items, "INTERNAL_LINK", internalLinks);
  addBriefItems(items, "EVIDENCE_REQUIREMENT", evidenceRequirements);

  const checksum = hash(canonical({
    articleId: article.id, userIntent, problem, audience, shortAnswer, calculatorRequirement,
    cta, items: items.map(({ type, text, referenceId, sourceRef }) => ({ type, text, referenceId, sourceRef })),
  }));
  const duplicate = db.prepare("SELECT * FROM article_briefs WHERE content_asset_id = ? AND brief_checksum = ?").get(article.id, checksum);
  if (duplicate) return { brief: duplicate, duplicate: true };
  const version = db.prepare("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM article_briefs WHERE content_asset_id = ?").get(article.id).version;
  const briefId = randomUUID();
  const now = Date.now();
  db.transaction(() => {
    db.prepare(`
      INSERT INTO article_briefs (
        id, content_asset_id, version, status, user_intent, problem, audience, short_answer,
        calculator_requirement, cta, brief_checksum, generated_by_ai,
        created_by_actor_type, created_by_actor_id, created_at, updated_at
      ) VALUES (?, ?, ?, 'READY', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      briefId, article.id, version, userIntent, problem, audience, shortAnswer,
      calculatorRequirement, cta, checksum, input.generatedByAi ? 1 : 0,
      actor.actorType, actor.actorId, now, now,
    );
    const insertItem = db.prepare(`
      INSERT INTO article_brief_items (id, brief_id, item_type, item_text, reference_id, source_ref, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of items) insertItem.run(randomUUID(), briefId, item.type, item.text, item.referenceId, item.sourceRef, item.sortOrder);
    const insertProduct = db.prepare(`
      INSERT OR IGNORE INTO content_products (content_asset_id, product_id, relation_type, sort_order)
      VALUES (?, ?, 'TARGET', ?)
    `);
    productRows.forEach((row, index) => insertProduct.run(article.id, row.id, index));
    const insertSource = db.prepare(`
      INSERT OR IGNORE INTO content_sources (
        id, content_asset_id, source_ref, source_id, source_fact_id, assertion_id,
        claim_text, evidence_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'REVIEW_REQUIRED', ?)
    `);
    for (const fact of verifiedFacts) {
      insertSource.run(randomUUID(), article.id, fact.sourceRef, fact.sourceId, fact.sourceFactId, fact.assertionId, fact.text, now);
    }
    db.prepare(`
      UPDATE content_assets SET current_brief_id = ?, status = 'BRIEF_READY', updated_at = ? WHERE id = ?
    `).run(briefId, now, article.id);
    addWorkflowEvent(db, article.id, article.status, "BRIEF_READY", actor, "Complete ArticleBrief saved before content drafting", now);
  })();
  return { brief: db.prepare("SELECT * FROM article_briefs WHERE id = ?").get(briefId), duplicate: false };
}

export function approveArticleBrief(db, input) {
  const actor = requireHuman(input, "ArticleBrief approval");
  const article = contentAsset(db, input.articleId);
  if (article.status !== "BRIEF_READY" || !article.current_brief_id) throw new Error("Article is not waiting for brief approval");
  const brief = db.prepare("SELECT * FROM article_briefs WHERE id = ? AND content_asset_id = ?").get(article.current_brief_id, article.id);
  if (!brief || brief.status !== "READY") throw new Error("Current ArticleBrief is not ready for approval");
  const now = Date.now();
  db.transaction(() => {
    db.prepare("UPDATE article_briefs SET status = 'APPROVED', approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?")
      .run(actor.actorId, now, now, brief.id);
    addApproval(db, { articleId: article.id, briefId: brief.id, approvalType: "BRIEF", reviewer: actor.actorId, notes: input.notes, now });
    db.prepare("UPDATE content_assets SET status = 'BRIEF_APPROVED', updated_at = ? WHERE id = ?").run(now, article.id);
    addWorkflowEvent(db, article.id, article.status, "BRIEF_APPROVED", actor, "ArticleBrief approved by a human editor", now);
  })();
  return contentAsset(db, article.id);
}

function normalizeSourceRefs(value, name) {
  if (value === undefined) return [];
  return [...new Set(textArray(value, name, { maximum: 50, limit: 500 }))];
}

function normalizeTextEntry(value, name) {
  if (typeof value === "string") return { text: requireText(value, name, 5000), sourceRefs: [] };
  if (!value || typeof value !== "object") throw new Error(`${name} must be text or an object`);
  return { text: requireText(value.text, `${name}.text`, 5000), sourceRefs: normalizeSourceRefs(value.sourceRefs, `${name}.sourceRefs`) };
}

export function validateArticleContent(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("content must be an object");
  if (!Array.isArray(input.shortAnswer) || input.shortAnswer.length === 0) throw new Error("content.shortAnswer must be an array");
  const shortAnswer = input.shortAnswer.map((entry, index) => normalizeTextEntry(entry, `content.shortAnswer[${index}]`));
  const shortAnswerSentences = sentenceCount(shortAnswer.map((entry) => entry.text).join(" "));
  if (shortAnswerSentences < 2 || shortAnswerSentences > 5) throw new Error("content.shortAnswer must contain 2-5 sentences");
  if (!Array.isArray(input.sections) || input.sections.length === 0) throw new Error("content.sections must contain at least one section");
  const headingKeys = new Set();
  const sections = input.sections.map((section, sectionIndex) => {
    if (!section || typeof section !== "object") throw new Error(`content.sections[${sectionIndex}] must be an object`);
    const heading = requireText(section.heading, `content.sections[${sectionIndex}].heading`, 300);
    const headingKey = heading.toLocaleLowerCase("ru-RU");
    if (headingKeys.has(headingKey)) throw new Error(`Duplicate section heading: ${heading}`);
    headingKeys.add(headingKey);
    if (!Array.isArray(section.blocks) || section.blocks.length === 0) throw new Error(`Section ${heading} must contain blocks`);
    const blocks = section.blocks.map((block, blockIndex) => {
      const name = `content.sections[${sectionIndex}].blocks[${blockIndex}]`;
      if (!block || typeof block !== "object") throw new Error(`${name} must be an object`);
      const type = cleanText(block.type, 30);
      const sourceRefs = normalizeSourceRefs(block.sourceRefs, `${name}.sourceRefs`);
      if (type === "paragraph" || type === "note") {
        return { type, text: requireText(block.text, `${name}.text`, 10_000), sourceRefs };
      }
      if (type === "list") {
        return { type, items: textArray(block.items, `${name}.items`, { minimum: 1, maximum: 100, limit: 3000 }), sourceRefs };
      }
      if (type === "table") {
        const caption = requireText(block.caption, `${name}.caption`, 500);
        const columns = textArray(block.columns, `${name}.columns`, { minimum: 2, maximum: 20, limit: 300 });
        if (!Array.isArray(block.rows) || block.rows.length === 0 || block.rows.length > 200) throw new Error(`${name}.rows must contain 1-200 rows`);
        const rows = block.rows.map((row, rowIndex) => {
          const values = textArray(row, `${name}.rows[${rowIndex}]`, { minimum: columns.length, maximum: columns.length, limit: 1000 });
          return values;
        });
        return { type, caption, columns, rows, sourceRefs };
      }
      throw new Error(`${name}.type must be paragraph, note, list or table`);
    });
    return { heading, blocks };
  });
  const faq = (input.faq ?? []).map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`content.faq[${index}] must be an object`);
    return {
      question: requireText(item.question, `content.faq[${index}].question`, 500),
      answer: requireText(item.answer, `content.faq[${index}].answer`, 4000),
      sourceRef: requireText(item.sourceRef, `content.faq[${index}].sourceRef`, 500),
    };
  });
  const internalLinks = (input.internalLinks ?? []).map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`content.internalLinks[${index}] must be an object`);
    const targetPath = requireText(item.targetPath, `content.internalLinks[${index}].targetPath`, 500);
    if (!/^\/[a-z0-9/_-]*$/.test(targetPath) || targetPath.includes("//")) throw new Error(`Invalid internal target path: ${targetPath}`);
    const role = cleanText(item.role || "CONTEXT", 30);
    if (!new Set(["CONTEXT", "PRODUCT", "RELATED", "CTA"]).has(role)) throw new Error(`Invalid internal link role: ${role}`);
    return { targetPath, anchorText: requireText(item.anchorText, `content.internalLinks[${index}].anchorText`, 500), role };
  });
  return { shortAnswer, sections, faq, internalLinks };
}

function contentBlocks(content) {
  const blocks = content.shortAnswer.map((entry) => ({ text: entry.text, sourceRefs: entry.sourceRefs }));
  for (const section of content.sections) {
    for (const block of section.blocks) {
      if (block.type === "paragraph" || block.type === "note") blocks.push({ text: block.text, sourceRefs: block.sourceRefs });
      if (block.type === "list") blocks.push({ text: block.items.join(". "), sourceRefs: block.sourceRefs });
      if (block.type === "table") blocks.push({ text: `${block.caption}. ${block.columns.join(". ")}. ${block.rows.flat().join(". ")}`, sourceRefs: block.sourceRefs });
    }
  }
  for (const item of content.faq) blocks.push({ text: `${item.question}. ${item.answer}`, sourceRefs: [item.sourceRef] });
  return blocks;
}

function normalizedWords(value) {
  return cleanText(value, 1_000_000).toLocaleLowerCase("ru-RU").replace(/[^a-zа-яё0-9\s-]/giu, " ").replace(/\s+/g, " ").trim();
}

function issue(code, message, snippet = null, severity = "HARD") {
  return { code, severity, message, snippet: snippet ? cleanText(snippet, 180) : null };
}

export function scanProhibitedAiContent(contentInput, options = {}) {
  const content = validateArticleContent(contentInput);
  const blocks = contentBlocks(content);
  const whole = blocks.map((block) => block.text).join("\n");
  const lower = whole.toLocaleLowerCase("ru-RU");
  const issues = [];
  const phraseRules = [
    ["AI_CLICHE_MODERN_WORLD", /в современном мире/iu, "Шаблонное вступление «В современном мире»"],
    ["AI_CLICHE_NO_SECRET", /ни для кого не секрет/iu, "Шаблонное вступление «Ни для кого не секрет»"],
  ];
  for (const [code, pattern, message] of phraseRules) {
    const match = whole.match(pattern);
    if (match) issues.push(issue(code, message, match[0]));
  }
  const firstAnswer = content.shortAnswer.map((entry) => entry.text).join(" ");
  if (/^(важно (?:понимать|отметить)|следует отметить|данная статья|в этой статье|тема .{0,40} актуальна)/iu.test(firstAnswer)) {
    issues.push(issue("EMPTY_INTRO", "Короткий ответ начинается с бессодержательного вступления", firstAnswer));
  }
  const fillerMatches = lower.match(/(?:следует отметить|важно понимать|необходимо подчеркнуть|как известно|безусловно|в целом)/giu) ?? [];
  if (fillerMatches.length >= 3) issues.push(issue("ARTIFICIAL_PADDING", "Обнаружено искусственное увеличение объёма вводными фразами", fillerMatches.join(", ")));
  const obvious = whole.match(/(?:правильный выбор (?:очень )?важен|качество имеет большое значение|безопасность превыше всего)/iu);
  if (obvious) issues.push(issue("OBVIOUS_STATEMENT", "Очевидное утверждение не добавляет технической ценности", obvious[0]));

  const sentences = whole.split(/(?<=[.!?])\s+/u).map((value) => normalizedWords(value)).filter((value) => value.length >= 45);
  const seen = new Set();
  const repeated = new Set();
  for (const sentence of sentences) {
    if (seen.has(sentence)) repeated.add(sentence);
    seen.add(sentence);
  }
  if (repeated.size) issues.push(issue("REPETITION", "Обнаружено дословное повторение содержательных предложений", [...repeated][0]));

  for (const block of blocks) {
    if (block.sourceRefs.length) continue;
    if (/(?:наши эксперты|эксперты 7tool|по мнению наших специалистов|наш многолетний опыт доказывает)/iu.test(block.text)) {
      issues.push(issue("INVENTED_EXPERTISE", "Заявление об экспертизе не связано с проверяемым источником", block.text));
    }
    if (/(?:мы (?:протестировали|испытали|проверили)|(?:наши эксперты|специалисты 7tool) (?:протестировали|испытали|проверили)|в ходе (?:нашего )?(?:теста|испытания)|результаты (?:нашего )?теста)/iu.test(block.text)) {
      issues.push(issue("INVENTED_TEST_RESULT", "Результат теста не связан с доказательством", block.text));
    }
    if (/\d+(?:[.,]\d+)?\s?(?:мм|см|м|кг|вт|квт|об\/мин|нм|бар|°c|в)(?![а-яёa-z])/iu.test(block.text)) {
      issues.push(issue("INVENTED_SPECIFICATION", "Числовая техническая характеристика не имеет sourceRef", block.text));
    }
  }

  const normalized = normalizedWords(whole);
  const primaryKeyword = normalizedWords(options.primaryKeyword ?? "");
  if (primaryKeyword) {
    const occurrences = normalized.split(primaryKeyword).length - 1;
    const wordCount = Math.max(1, normalized.split(" ").length);
    const phraseWords = primaryKeyword.split(" ").length;
    if (occurrences >= 6 && (occurrences * phraseWords) / wordCount > 0.04) {
      issues.push(issue("KEYWORD_STUFFING", "Основной запрос повторяется с неестественной плотностью", `${occurrences} occurrences`));
    }
  }
  if (options.duplicateTemplate) issues.push(issue("DUPLICATE_TEMPLATE", "Структура полностью повторяет шаблон другой активной статьи"));
  const headings = content.sections.map((section) => section.heading).join(" ").toLocaleLowerCase("ru-RU");
  if (!/огранич|нельзя|не подходит|услови/u.test(headings)) issues.push(issue("MISSING_LIMITATIONS", "Структура не выделяет ограничения применения", null, "WARN"));
  if (!/ошиб|проблем|провер/u.test(headings)) issues.push(issue("MISSING_ERRORS", "Структура не выделяет типовые ошибки или проверки", null, "WARN"));
  return { content, issues, hardFail: issues.some((item) => item.severity === "HARD") };
}

function templateShape(content) {
  return {
    headings: content.sections.map((section) => normalizedWords(section.heading)),
    blocks: content.sections.map((section) => section.blocks.map((block) => block.type)),
  };
}

function referencedSourceRefs(content) {
  const refs = new Set();
  for (const block of contentBlocks(content)) for (const sourceRef of block.sourceRefs) refs.add(sourceRef);
  return [...refs];
}

export function saveArticleRevision(db, input) {
  const actor = actorFrom(input);
  const article = contentAsset(db, input.articleId);
  if (!new Set(["BRIEF_APPROVED", "CONTENT_DRAFT"]).has(article.status)) {
    throw new Error("A revision can be saved only after ArticleBrief approval or while editing CONTENT_DRAFT");
  }
  const brief = db.prepare("SELECT * FROM article_briefs WHERE id = ? AND content_asset_id = ?").get(article.current_brief_id, article.id);
  if (!brief || brief.status !== "APPROVED") throw new Error("Current ArticleBrief requires human approval before writing");
  const normalized = validateArticleContent(input.content);
  const body = canonical(normalized);
  const contentHash = hash(body);
  const existing = db.prepare("SELECT * FROM content_revisions WHERE content_asset_id = ? AND content_hash = ?").get(article.id, contentHash);
  if (existing) return { revision: existing, duplicate: true, qualityCheck: db.prepare("SELECT * FROM content_quality_checks WHERE revision_id = ?").get(existing.id) };
  const templateHash = hash(canonical(templateShape(normalized)));
  const duplicateTemplate = Boolean(db.prepare(`
    SELECT 1 FROM content_revisions r
    JOIN content_assets a ON a.id = r.content_asset_id
    WHERE r.template_hash = ? AND r.content_asset_id != ? AND a.status != 'ARCHIVED'
    LIMIT 1
  `).get(templateHash, article.id));
  const scan = scanProhibitedAiContent(normalized, { primaryKeyword: article.primary_keyword, duplicateTemplate });
  const sourceRefs = referencedSourceRefs(normalized);
  for (const sourceRef of sourceRefs) {
    if (!db.prepare("SELECT 1 FROM content_sources WHERE content_asset_id = ? AND source_ref = ?").get(article.id, sourceRef)) {
      throw new Error(`Content sourceRef is not present in the approved brief evidence: ${sourceRef}`);
    }
  }
  const title = requireText(input.title ?? article.title, "title", 300);
  const h1 = requireText(input.h1 ?? article.h1, "h1", 300);
  const metaTitle = cleanText(input.metaTitle ?? article.meta_title, 300) || null;
  const metaDescription = cleanText(input.metaDescription ?? article.meta_description, 500) || null;
  const excerpt = requireText(input.excerpt ?? article.excerpt, "excerpt", 1000);
  const leadFormType = cleanText(input.leadFormType ?? article.lead_form_type, 100) || null;
  const revisionNumber = db.prepare("SELECT COALESCE(MAX(revision_number), 0) + 1 AS revision FROM content_revisions WHERE content_asset_id = ?").get(article.id).revision;
  const revisionId = randomUUID();
  const now = Date.now();
  db.transaction(() => {
    db.prepare(`
      INSERT INTO content_revisions (
        id, content_asset_id, revision_number, content_format, content_body, content_hash,
        template_hash, created_by_actor_type, created_by_actor_id, created_at
      ) VALUES (?, ?, ?, 'ARTICLE_BLOCKS_V1', ?, ?, ?, ?, ?, ?)
    `).run(revisionId, article.id, revisionNumber, body, contentHash, templateHash, actor.actorType, actor.actorId, now);
    db.prepare(`
      INSERT INTO content_quality_checks (
        id, content_asset_id, revision_id, primary_keyword, issues_json, hard_fail, checked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), article.id, revisionId, article.primary_keyword, canonical(scan.issues), scan.hardFail ? 1 : 0, now);
    db.prepare("DELETE FROM content_faq WHERE content_asset_id = ?").run(article.id);
    const insertFaq = db.prepare(`
      INSERT INTO content_faq (id, content_asset_id, question, answer, source_ref, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    normalized.faq.forEach((item, index) => insertFaq.run(randomUUID(), article.id, item.question, item.answer, item.sourceRef, index));
    db.prepare("DELETE FROM content_internal_links WHERE content_asset_id = ?").run(article.id);
    const insertLink = db.prepare(`
      INSERT INTO content_internal_links (
        content_asset_id, target_path, target_site_url_id, anchor_text, link_role, sort_order
      ) VALUES (?, ?, (SELECT id FROM site_urls WHERE path = ?), ?, ?, ?)
    `);
    normalized.internalLinks.forEach((item, index) => insertLink.run(article.id, item.targetPath, item.targetPath, item.anchorText, item.role, index));
    db.prepare(`
      UPDATE content_assets SET
        status = 'CONTENT_DRAFT', title = ?, h1 = ?, meta_title = ?, meta_description = ?,
        excerpt = ?, lead_form_type = ?, current_revision_id = ?, generated_by_ai = ?,
        human_reviewed = 0, quality_score = NULL, evidence_score = NULL,
        author = NULL, expert_reviewer = NULL, updated_at = ?
      WHERE id = ?
    `).run(
      title, h1, metaTitle, metaDescription, excerpt, leadFormType, revisionId,
      input.generatedByAi ? 1 : 0, now, article.id,
    );
    addWorkflowEvent(db, article.id, article.status, "CONTENT_DRAFT", actor, "Immutable article revision saved after brief approval", now);
  })();
  return {
    revision: db.prepare("SELECT * FROM content_revisions WHERE id = ?").get(revisionId),
    duplicate: false,
    qualityCheck: db.prepare("SELECT * FROM content_quality_checks WHERE revision_id = ?").get(revisionId),
  };
}

export function reviewContentSource(db, input) {
  const actor = requireHuman(input, "Evidence review");
  const decision = cleanText(input.decision, 30);
  if (!new Set(["VERIFY", "REJECT"]).has(decision)) throw new Error("decision must be VERIFY or REJECT");
  const source = db.prepare("SELECT * FROM content_sources WHERE id = ? AND content_asset_id = ?").get(input.sourceId, input.articleId);
  if (!source) throw new Error("Content source not found");
  if (source.evidence_status !== "REVIEW_REQUIRED") throw new Error("Content source was already reviewed");
  if (decision === "VERIFY" && source.source_id) {
    const policy = db.prepare("SELECT rights_policy, active FROM sources WHERE id = ?").get(source.source_id);
    if (!policy || policy.active !== 1 || policy.rights_policy !== "PUBLISHABLE_FACTS") {
      throw new Error("RESEARCH_ONLY or inactive sources cannot become publishable article evidence");
    }
  }
  if (decision === "VERIFY" && source.source_fact_id) {
    const sourceFact = db.prepare("SELECT status FROM source_facts WHERE id = ?").get(source.source_fact_id);
    if (!sourceFact || !new Set(["VALID", "OBSERVED"]).has(sourceFact.status)) throw new Error("Source fact is no longer valid evidence");
  }
  if (decision === "VERIFY" && source.assertion_id) {
    const assertion = db.prepare("SELECT verification_status FROM fact_assertions WHERE id = ?").get(source.assertion_id);
    if (!assertion || assertion.verification_status !== "VERIFIED") throw new Error("Fact assertion is no longer VERIFIED");
  }
  const article = contentAsset(db, input.articleId);
  const now = Date.now();
  db.transaction(() => {
    db.prepare(`
      UPDATE content_sources SET evidence_status = ?, verified_by = ?, verified_at = ? WHERE id = ?
    `).run(decision === "VERIFY" ? "VERIFIED" : "REJECTED", actor.actorId, now, source.id);
    addWorkflowEvent(db, article.id, article.status, article.status, actor, `Evidence ${source.source_ref} ${decision === "VERIFY" ? "verified" : "rejected"}`, now);
  })();
  return db.prepare("SELECT * FROM content_sources WHERE id = ?").get(source.id);
}

function currentRevisionGate(db, article) {
  if (!article.current_revision_id) throw new Error("Article has no current revision");
  const quality = db.prepare("SELECT * FROM content_quality_checks WHERE revision_id = ?").get(article.current_revision_id);
  if (!quality || quality.hard_fail !== 0) throw new Error("Current revision has a prohibited-content hard fail");
  return quality;
}

function requireApprovedEvidence(db, article) {
  const counts = db.prepare(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN evidence_status = 'VERIFIED' THEN 1 ELSE 0 END) AS verified,
      SUM(CASE WHEN evidence_status != 'VERIFIED' THEN 1 ELSE 0 END) AS unresolved
    FROM content_sources WHERE content_asset_id = ?
  `).get(article.id);
  if (!counts.total || counts.verified !== counts.total || counts.unresolved) {
    throw new Error("Every article claim source must be human-verified before expert readiness");
  }
  const products = db.prepare(`
    SELECT COUNT(*) AS count FROM content_products cp
    JOIN products p ON p.id = cp.product_id
    WHERE cp.content_asset_id = ? AND cp.relation_type = 'TARGET' AND p.draft = 0
  `).get(article.id).count;
  if (!products) throw new Error("Article must use at least one real live target product");
}

function hasApproval(db, article, type) {
  return Boolean(db.prepare(`
    SELECT 1 FROM content_approvals
    WHERE content_asset_id = ? AND revision_id = ? AND approval_type = ? AND decision = 'APPROVED'
    LIMIT 1
  `).get(article.id, article.current_revision_id, type));
}

function requireApprovedSupplierMedia(db, article) {
  const required = db.prepare(`
    SELECT COUNT(*) AS count FROM article_brief_items
    WHERE brief_id = ? AND item_type = 'SUPPLIER_IMAGE'
  `).get(article.current_brief_id).count;
  if (!required) return;
  const schema = db.prepare(`
    SELECT COUNT(*) AS count FROM sqlite_schema
    WHERE type = 'table' AND name IN (
      'media_selection_requests', 'content_media', 'media_assets', 'media_rights_grants'
    )
  `).get().count;
  if (schema !== 4) throw new Error("Image Intelligence schema is required for Supplier Image publication gates");
  const rows = db.prepare(`
    SELECT bi.id AS brief_item_id, r.status AS request_status,
      cm.status AS placement_status, a.id AS asset_id, a.source_id AS asset_source_id,
      a.rights_grant_id, a.status AS asset_status, a.license_status,
      g.id AS grant_id, g.scope_type, g.scope_value, g.source_id AS grant_source_id,
      g.status AS grant_status, g.permitted_uses_json, g.valid_from, g.valid_until
    FROM article_brief_items bi
    LEFT JOIN media_selection_requests r
      ON r.brief_item_id = bi.id AND r.brief_id = bi.brief_id
    LEFT JOIN content_media cm ON cm.request_id = r.id
    LEFT JOIN media_assets a ON a.id = cm.media_asset_id
    LEFT JOIN media_rights_grants g ON g.id = a.rights_grant_id
    WHERE bi.brief_id = ? AND bi.item_type = 'SUPPLIER_IMAGE'
    ORDER BY bi.sort_order, bi.id
  `).all(article.current_brief_id);
  if (rows.length !== required) throw new Error("Every Supplier Image brief item needs a reviewed selection request");
  for (const row of rows) {
    if (row.request_status === "NO_MATCH_REVIEWED") continue;
    if (row.request_status !== "SELECTED" || row.placement_status !== "APPROVED"
      || row.asset_status !== "PROCESSED"
      || !new Set(["VERIFIED", "OWNED", "CONTRACT_APPROVED"]).has(row.license_status)
      || !isAssetPublicationRightsEligible({
        id: row.asset_id,
        source_id: row.asset_source_id,
        rights_grant_id: row.rights_grant_id,
      }, {
        id: row.grant_id,
        status: row.grant_status,
        scope_type: row.scope_type,
        scope_value: row.scope_value,
        source_id: row.grant_source_id,
        permitted_uses_json: row.permitted_uses_json,
        valid_from: row.valid_from,
        valid_until: row.valid_until,
      })) {
      throw new Error(`Supplier Image ${row.brief_item_id} is not human-selected, processed and rights-approved`);
    }
  }
}

function publishArticle(db, article, actor, reason, now) {
  currentRevisionGate(db, article);
  requireApprovedEvidence(db, article);
  for (const type of ["FACT", "SEO", "EXPERT"]) {
    if (!hasApproval(db, article, type)) throw new Error(`Current revision is missing ${type} approval`);
  }
  const brief = db.prepare("SELECT status FROM article_briefs WHERE id = ? AND content_asset_id = ?").get(article.current_brief_id, article.id);
  if (!brief || brief.status !== "APPROVED") throw new Error("Current ArticleBrief is not approved");
  requireApprovedSupplierMedia(db, article);
  if ((article.quality_score ?? 0) < ARTICLE_SCORE_GATES.quality) throw new Error(`qualityScore must be at least ${ARTICLE_SCORE_GATES.quality}`);
  if ((article.evidence_score ?? 0) < ARTICLE_SCORE_GATES.evidence) throw new Error(`evidenceScore must be at least ${ARTICLE_SCORE_GATES.evidence}`);
  if ((article.differentiation_score ?? 0) < ARTICLE_SCORE_GATES.differentiation) throw new Error(`differentiationScore must be at least ${ARTICLE_SCORE_GATES.differentiation}`);
  const opportunity = db.prepare("SELECT * FROM content_opportunities WHERE id = ?").get(article.opportunity_id);
  if (!opportunity || opportunity.status !== "REVIEWED" || opportunity.decision !== "CREATE"
    || opportunity.evaluation_checksum !== article.source_opportunity_checksum
    || opportunity.cannibalization_risk !== "LOW" || opportunity.duplicate_risk === "HIGH") {
    throw new Error("Opportunity evidence changed or carries publication risk; reevaluation is required");
  }
  const route = db.prepare("SELECT * FROM site_urls WHERE path = ?").get(article.canonical);
  if (route && (route.entity_type !== "CONTENT_ASSET" || route.entity_id !== article.id)) throw new Error("Canonical route is already owned by another entity");
  const siteUrlId = route?.id ?? `content-url-${hash(article.canonical).slice(0, 24)}`;
  db.prepare(`
    INSERT INTO site_urls (
      id, path, page_type, entity_type, entity_id, canonical_url_id, index_status,
      http_status, content_fingerprint, published_at, created_at, updated_at
    ) VALUES (?, ?, 'ARTICLE', 'CONTENT_ASSET', ?, NULL, 'INDEX', 200,
      (SELECT content_hash FROM content_revisions WHERE id = ?), ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      page_type = 'ARTICLE', entity_type = 'CONTENT_ASSET', entity_id = excluded.entity_id,
      canonical_url_id = NULL, index_status = 'INDEX', http_status = 200,
      content_fingerprint = excluded.content_fingerprint,
      published_at = COALESCE(site_urls.published_at, excluded.published_at), updated_at = excluded.updated_at
  `).run(siteUrlId, article.canonical, article.id, article.current_revision_id, now, now, now);
  addApproval(db, {
    articleId: article.id, briefId: article.current_brief_id, revisionId: article.current_revision_id,
    approvalType: "FINAL", reviewer: actor.actorId, notes: reason, now,
  });
  db.prepare(`
    UPDATE content_assets SET
      site_url_id = ?, canonical_url_id = ?, status = 'PUBLISHED', index_status = 'INDEX',
      published_at = COALESCE(published_at, ?), updated_at = ?
    WHERE id = ?
  `).run(siteUrlId, siteUrlId, now, now, article.id);
  const mediaSchema = db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'content_media'").get();
  if (mediaSchema) {
    db.prepare(`
      UPDATE content_media SET status = 'PUBLISHED', updated_at = ?
      WHERE content_asset_id = ? AND status = 'APPROVED'
    `).run(now, article.id);
  }
  addWorkflowEvent(db, article.id, article.status, "PUBLISHED", actor, reason, now);
}

export function transitionArticle(db, input) {
  const actor = actorFrom(input);
  const article = contentAsset(db, input.articleId);
  const toStatus = cleanText(input.toStatus, 40);
  if (!ARTICLE_STATUSES.includes(toStatus)) throw new Error("Unknown article status");
  if (!GENERIC_TRANSITIONS.get(article.status)?.has(toStatus)) {
    throw new Error(`Invalid article transition ${article.status} -> ${toStatus}`);
  }
  if ((HUMAN_ONLY_TARGETS.has(toStatus) || ["FACT_CHECK", "SEO_REVIEW", "EXPERT_REVIEW", "READY"].includes(article.status))
    && actor.actorType !== "HUMAN") {
    throw new Error(`${article.status} -> ${toStatus} requires a human actor`);
  }
  if (new Set(["UPDATE_REQUIRED", "MERGE_REQUIRED"]).has(toStatus)
    && !new Set(["HUMAN", "SYSTEM"]).has(actor.actorType)) {
    throw new Error(`${toStatus} can be raised only by a human or deterministic system actor`);
  }
  const reason = requireText(input.reason, "reason", 1000);
  const now = Date.now();
  db.transaction(() => {
    if (toStatus === "FACT_CHECK") currentRevisionGate(db, article);
    if (article.status === "FACT_CHECK" && toStatus === "SEO_REVIEW") {
      requireApprovedEvidence(db, article);
      addApproval(db, { articleId: article.id, revisionId: article.current_revision_id, approvalType: "FACT", reviewer: actor.actorId, notes: reason, now });
    }
    if (article.status === "SEO_REVIEW" && toStatus === "EXPERT_REVIEW") {
      addApproval(db, { articleId: article.id, revisionId: article.current_revision_id, approvalType: "SEO", reviewer: actor.actorId, notes: reason, now });
    }
    if (article.status === "EXPERT_REVIEW" && toStatus === "READY") {
      currentRevisionGate(db, article);
      requireApprovedEvidence(db, article);
      if (!hasApproval(db, article, "FACT") || !hasApproval(db, article, "SEO")) {
        throw new Error("Current revision is missing FACT or SEO approval");
      }
      const author = requireText(input.author, "author", 200);
      const expertReviewer = requireText(input.expertReviewer || actor.actorId, "expertReviewer", 200);
      const qualityScore = integerScore(input.qualityScore, "qualityScore");
      const evidenceScore = integerScore(input.evidenceScore, "evidenceScore");
      const differentiationScore = integerScore(input.differentiationScore, "differentiationScore");
      const businessScore = integerScore(input.businessScore, "businessScore");
      addApproval(db, { articleId: article.id, revisionId: article.current_revision_id, approvalType: "EXPERT", reviewer: actor.actorId, notes: reason, now });
      db.prepare(`
        UPDATE content_assets SET author = ?, expert_reviewer = ?, quality_score = ?,
          evidence_score = ?, differentiation_score = ?, business_score = ?, human_reviewed = 1,
          status = 'READY', updated_at = ? WHERE id = ?
      `).run(author, expertReviewer, qualityScore, evidenceScore, differentiationScore, businessScore, now, article.id);
      addWorkflowEvent(db, article.id, article.status, "READY", actor, reason, now);
      return;
    }
    if (toStatus === "PUBLISHED") {
      publishArticle(db, article, actor, reason, now);
      return;
    }
    if (toStatus === "CONTENT_DRAFT") {
      db.prepare(`
        UPDATE content_assets SET status = 'CONTENT_DRAFT', human_reviewed = 0,
          quality_score = NULL, evidence_score = NULL, author = NULL, expert_reviewer = NULL,
          updated_at = ? WHERE id = ?
      `).run(now, article.id);
    } else if (toStatus === "UPDATE_REQUIRED" || toStatus === "MERGE_REQUIRED") {
      db.prepare("UPDATE content_assets SET status = ?, index_status = 'NOINDEX', updated_at = ? WHERE id = ?").run(toStatus, now, article.id);
      if (article.site_url_id) db.prepare("UPDATE site_urls SET index_status = 'NOINDEX', updated_at = ? WHERE id = ?").run(now, article.site_url_id);
    } else {
      db.prepare("UPDATE content_assets SET status = ?, updated_at = ? WHERE id = ?").run(toStatus, now, article.id);
    }
    addWorkflowEvent(db, article.id, article.status, toStatus, actor, reason, now);
  })();
  return contentAsset(db, article.id);
}

export function replaceRelatedArticles(db, input) {
  const actor = actorFrom(input);
  const article = contentAsset(db, input.articleId);
  const relatedIds = textArray(input.relatedArticleIds ?? [], "relatedArticleIds", { maximum: 20, limit: 200 });
  if (new Set(relatedIds).size !== relatedIds.length || relatedIds.includes(article.id)) throw new Error("Related articles must be unique and cannot reference themselves");
  for (const relatedId of relatedIds) {
    if (!db.prepare("SELECT 1 FROM content_assets WHERE id = ? AND status = 'PUBLISHED'").get(relatedId)) {
      throw new Error(`Related article must be published: ${relatedId}`);
    }
  }
  const now = Date.now();
  db.transaction(() => {
    db.prepare("DELETE FROM content_related WHERE content_asset_id = ?").run(article.id);
    const insert = db.prepare("INSERT INTO content_related (content_asset_id, related_content_asset_id, sort_order) VALUES (?, ?, ?)");
    relatedIds.forEach((relatedId, index) => insert.run(article.id, relatedId, index));
    addWorkflowEvent(db, article.id, article.status, article.status, actor, "Related article links updated", now);
  })();
  return db.prepare("SELECT * FROM content_related WHERE content_asset_id = ? ORDER BY sort_order").all(article.id);
}

export function listEditorialArticles(db, { status = null, categorySlug = null, limit = 100 } = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const clauses = [];
  const values = [];
  if (status) {
    if (!ARTICLE_STATUSES.includes(status)) throw new Error("Unknown article status");
    clauses.push("status = ?"); values.push(status);
  }
  if (categorySlug) { clauses.push("category_slug = ?"); values.push(categorySlug); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db.prepare(`
    SELECT * FROM content_assets ${where}
    ORDER BY updated_at DESC, title LIMIT ?
  `).all(...values, safeLimit);
}
