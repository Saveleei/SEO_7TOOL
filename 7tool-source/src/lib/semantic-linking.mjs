import { createHash, randomUUID } from "node:crypto";
import { getPublicInteractiveTool, listPublicInteractiveTools } from "./tool-platform.mjs";

export const SEMANTIC_LINK_ENGINE_VERSION = "semantic-linking-v1";

const ACTOR_TYPES = new Set(["HUMAN", "SYSTEM", "AI_ASSISTED"]);
const SOURCE_TYPES = new Set(["ARTICLE", "PRODUCT", "CATEGORY", "CALCULATOR", "COMPARISON"]);
const RELATIONS = Object.freeze({
  ARTICLE_TO_CATEGORY: { sourceType: "ARTICLE", targetType: "CATEGORY", from: "LEARN", to: "SHOP" },
  ARTICLE_TO_PRODUCT: { sourceType: "ARTICLE", targetType: "PRODUCT", from: "LEARN", to: "CHOOSE_PRODUCT" },
  ARTICLE_TO_ARTICLE: { sourceType: "ARTICLE", targetType: "ARTICLE", from: "LEARN", to: "LEARN" },
  PRODUCT_TO_ARTICLE: { sourceType: "PRODUCT", targetType: "ARTICLE", from: "SHOP", to: "LEARN" },
  PRODUCT_TO_COMPATIBILITY: { sourceType: "PRODUCT", targetType: "COMPATIBILITY", from: "SHOP", to: "SELECT_ACCESSORY" },
  CATEGORY_TO_GUIDE: { sourceType: "CATEGORY", targetType: "GUIDE", from: "SHOP", to: "LEARN" },
  CALCULATOR_TO_PRODUCT: { sourceType: "CALCULATOR", targetType: "PRODUCT", from: "CALCULATE", to: "CHOOSE_PRODUCT" },
  COMPARISON_TO_PRODUCT: { sourceType: "COMPARISON", targetType: "PRODUCT", from: "COMPARE", to: "CHOOSE_PRODUCT" },
});

function clean(value, max = 500) {
  return typeof value === "string" ? value.trim().replace(/\s+/gu, " ").slice(0, max) : "";
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function hash(value) {
  return createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");
}

function actorFrom(input) {
  const actorType = clean(input?.actorType, 30);
  const actorId = clean(input?.actorId, 200);
  if (!ACTOR_TYPES.has(actorType)) throw new Error("actorType must be HUMAN, SYSTEM or AI_ASSISTED");
  if (!actorId) throw new Error("actorId is required");
  return { actorType, actorId };
}

function requireHuman(input, action) {
  const actor = actorFrom(input);
  if (actor.actorType !== "HUMAN") throw new Error(`${action} requires a HUMAN actor`);
  return actor;
}

function hasSchema(db) {
  return db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'semantic_link_sets'").get() !== undefined;
}

const PUBLIC_PRODUCT_WHERE = `
  p.draft = 0
  AND EXISTS (SELECT 1 FROM categories c WHERE c.slug = p.category AND c.published = 1)
  AND (p.images != '[]' OR EXISTS (
    SELECT 1 FROM variants v WHERE v.product_id = p.id AND COALESCE(v.images, '[]') != '[]'
  ))`;

function publicContent(db, id) {
  return db.prepare(`
    SELECT id, content_type, slug, title, h1, excerpt, category_slug, canonical,
      published_at, updated_at
    FROM content_assets
    WHERE id = ? AND status = 'PUBLISHED' AND index_status = 'INDEX' AND human_reviewed = 1
  `).get(id);
}

function publicCategory(db, id) {
  return db.prepare(`
    SELECT c.slug, c.title, c.h1, c.published,
      (SELECT COUNT(*) FROM products p WHERE p.category = c.slug AND p.draft = 0
        AND (p.images != '[]' OR EXISTS (
          SELECT 1 FROM variants v WHERE v.product_id = p.id AND COALESCE(v.images, '[]') != '[]'
        ))) AS product_count
    FROM categories c
    WHERE c.slug = ? AND c.published = 1
  `).get(id);
}

function resolveSource(db, sourceType, sourceId) {
  if (!SOURCE_TYPES.has(sourceType) || !sourceId) throw new Error("A supported sourceType and sourceId are required");
  if (sourceType === "ARTICLE" || sourceType === "COMPARISON") {
    const row = publicContent(db, sourceId);
    if (!row || (sourceType === "COMPARISON" ? row.content_type !== "COMPARISON" : row.content_type !== "ARTICLE")) {
      throw new Error(`Source ${sourceType}/${sourceId} is not public`);
    }
    return {
      type: sourceType, id: row.id, path: `/articles/${row.slug}`, title: row.title,
      categorySlug: row.category_slug, contentType: row.content_type,
      checksum: hash(row),
    };
  }
  if (sourceType === "PRODUCT") {
    const row = db.prepare(`SELECT p.id, p.slug, p.title, p.category, p.updated_at FROM products p WHERE p.id = ? AND ${PUBLIC_PRODUCT_WHERE}`).get(sourceId);
    if (!row) throw new Error(`Source PRODUCT/${sourceId} is not public`);
    return { type: sourceType, id: row.id, path: `/p/${row.slug}`, title: row.title, categorySlug: row.category, checksum: hash(row) };
  }
  if (sourceType === "CATEGORY") {
    const row = publicCategory(db, sourceId);
    if (!row || row.product_count < 1) throw new Error(`Source CATEGORY/${sourceId} is not public`);
    return { type: sourceType, id: row.slug, path: `/c/${row.slug}`, title: row.h1 || row.title, categorySlug: row.slug, checksum: hash(row) };
  }
  const summary = listPublicInteractiveTools(db).find((tool) => tool.key === sourceId && tool.type !== "COMPATIBILITY_TABLE");
  if (!summary || !getPublicInteractiveTool(db, summary.slug)) throw new Error(`Source CALCULATOR/${sourceId} is not public`);
  return { type: sourceType, id: summary.key, path: `/tools/${summary.slug}`, title: summary.title, tool: getPublicInteractiveTool(db, summary.slug), checksum: hash(summary) };
}

function resolveTarget(db, targetType, targetId) {
  if (targetType === "PRODUCT") {
    const row = db.prepare(`SELECT p.id, p.slug, p.title, p.category, p.updated_at FROM products p WHERE p.id = ? AND ${PUBLIC_PRODUCT_WHERE}`).get(targetId);
    if (!row) throw new Error(`Target PRODUCT/${targetId} is not public`);
    return { type: targetType, id: row.id, path: `/p/${row.slug}`, title: row.title, categorySlug: row.category, checksum: hash(row) };
  }
  if (targetType === "CATEGORY") {
    const row = publicCategory(db, targetId);
    if (!row || row.product_count < 1) throw new Error(`Target CATEGORY/${targetId} is not public`);
    return { type: targetType, id: row.slug, path: `/c/${row.slug}`, title: row.h1 || row.title, categorySlug: row.slug, checksum: hash(row) };
  }
  if (targetType === "ARTICLE" || targetType === "GUIDE") {
    const row = publicContent(db, targetId);
    const typeMatches = targetType === "GUIDE" ? row?.content_type === "GUIDE" : row?.content_type === "ARTICLE";
    if (!row || !typeMatches) throw new Error(`Target ${targetType}/${targetId} is not public`);
    return { type: targetType, id: row.id, path: `/articles/${row.slug}`, title: row.title, categorySlug: row.category_slug, contentType: row.content_type, checksum: hash(row) };
  }
  if (targetType === "COMPATIBILITY") {
    const summary = listPublicInteractiveTools(db).find((tool) => tool.key === targetId && tool.type === "COMPATIBILITY_TABLE");
    const tool = summary ? getPublicInteractiveTool(db, summary.slug) : null;
    if (!summary || !tool) throw new Error(`Target COMPATIBILITY/${targetId} is not public`);
    return { type: targetType, id: summary.key, path: `/tools/${summary.slug}`, title: summary.title, tool, checksum: hash(summary) };
  }
  throw new Error("Unsupported semantic link target type");
}

function proofFor(db, source, target, relationType, input, actor, revalidating) {
  if (relationType === "ARTICLE_TO_CATEGORY") {
    if (source.categorySlug !== target.id) throw new Error("Article/category link requires the article's category");
    return { type: "CONTENT_CATEGORY", ref: `${source.id}:${target.id}`, checksum: hash({ source: source.checksum, category: target.checksum }) };
  }
  if (relationType === "ARTICLE_TO_PRODUCT" || relationType === "COMPARISON_TO_PRODUCT") {
    const row = db.prepare("SELECT relation_type, sort_order FROM content_products WHERE content_asset_id = ? AND product_id = ? ORDER BY relation_type LIMIT 1").get(source.id, target.id);
    if (!row) throw new Error("Content/product semantic link requires content_products evidence");
    return { type: "CONTENT_PRODUCT", ref: `${source.id}:${target.id}:${row.relation_type}`, checksum: hash(row) };
  }
  if (relationType === "ARTICLE_TO_ARTICLE") {
    const row = db.prepare("SELECT sort_order FROM content_related WHERE content_asset_id = ? AND related_content_asset_id = ?").get(source.id, target.id);
    if (!row) throw new Error("Article/article semantic link requires content_related evidence");
    return { type: "CONTENT_RELATED", ref: `${source.id}:${target.id}`, checksum: hash(row) };
  }
  if (relationType === "PRODUCT_TO_ARTICLE") {
    const row = db.prepare("SELECT relation_type, sort_order FROM content_products WHERE content_asset_id = ? AND product_id = ? ORDER BY relation_type LIMIT 1").get(target.id, source.id);
    if (!row) throw new Error("Product/article semantic link requires content_products evidence");
    return { type: "PRODUCT_CONTENT", ref: `${source.id}:${target.id}:${row.relation_type}`, checksum: hash(row) };
  }
  if (relationType === "PRODUCT_TO_COMPATIBILITY") {
    const rows = target.tool.rows.filter((row) => row.product.id === source.id || row.accessory.id === source.id);
    if (!rows.length) throw new Error("Product/compatibility link requires a current public compatibility row");
    return { type: "PRODUCT_COMPATIBILITY", ref: `${source.id}:${target.id}`, checksum: hash(rows.map((row) => ({ id: row.id, assertionId: row.assertionId, directionAssertionId: row.directionAssertionId }))) };
  }
  if (relationType === "CATEGORY_TO_GUIDE") {
    if (source.id !== target.categorySlug) throw new Error("Category/guide link requires a guide in the same category");
    return { type: "CATEGORY_GUIDE", ref: `${source.id}:${target.id}`, checksum: hash({ source: source.checksum, guide: target.checksum }) };
  }
  if (relationType === "CALCULATOR_TO_PRODUCT") {
    const product = source.tool.products?.find((candidate) => candidate.id === target.id);
    if (product) {
      return { type: "TOOL_DATASET", ref: `${source.id}:${target.id}`, checksum: hash({ tool: source.checksum, product: target.checksum, facts: product.facts }) };
    }
    const reviewBasis = clean(input.reviewBasis ?? input.proofRef, 1000);
    const storedCurated = input.proofType === "CURATED_HUMAN";
    if (!reviewBasis || (!revalidating && actor?.actorType !== "HUMAN") || (revalidating && !storedCurated)) {
      throw new Error("Calculator/product link outside a verified tool dataset requires a HUMAN curator and reviewBasis");
    }
    return { type: "CURATED_HUMAN", ref: reviewBasis, checksum: hash({ tool: source.checksum, product: target.checksum, reviewBasis }) };
  }
  throw new Error("Unsupported semantic proof relation");
}

function anchorFor(relationType, target) {
  if (relationType === "ARTICLE_TO_CATEGORY") return `Оборудование по теме: ${target.title}`;
  if (relationType === "PRODUCT_TO_COMPATIBILITY") return "Проверить совместимость";
  if (relationType === "CATEGORY_TO_GUIDE") return `Руководство: ${target.title}`;
  return target.title;
}

function defaultQuestion(relationType, target) {
  const questions = {
    ARTICLE_TO_CATEGORY: "Какие товары доступны в этой категории?",
    ARTICLE_TO_PRODUCT: `Подходит ли модель «${target.title}» под задачу?`,
    ARTICLE_TO_ARTICLE: `Что важно знать дальше по теме «${target.title}»?`,
    PRODUCT_TO_ARTICLE: `Как правильно выбрать и применять «${target.title}»?`,
    PRODUCT_TO_COMPATIBILITY: "Какая оснастка совместима с этой моделью?",
    CATEGORY_TO_GUIDE: `Как разобраться в выборе по руководству «${target.title}»?`,
    CALCULATOR_TO_PRODUCT: `Какие проверенные характеристики есть у модели «${target.title}»?`,
    COMPARISON_TO_PRODUCT: `Какие параметры заявлены для модели «${target.title}»?`,
  };
  return questions[relationType];
}

export function scanSemanticLinks(items) {
  const issues = [];
  const add = (code, message, item) => issues.push({ code, message, relationType: item.relationType, targetId: item.targetId });
  for (const item of items) {
    const text = `${item.anchorText} ${item.nextQuestion}`;
    if (/<[^>]+>|https?:\/\//iu.test(text)) add("UNSAFE_MARKUP_OR_URL", "Anchors and questions cannot contain markup or external URLs", item);
    if (/лучш(?:ий|ая|ее)|идеальн|гарантирован|№\s*1|купите сейчас|оставьте телефон/iu.test(text)) add("PROMOTIONAL_OR_LEAD_COPY", "Semantic links must stay navigational and neutral", item);
    if (!item.nextQuestion.endsWith("?") || item.nextQuestion.length < 10 || item.nextQuestion.length > 240) add("INVALID_NEXT_QUESTION", "Every link requires one concise next user question", item);
    if (!item.anchorText || item.anchorText.length > 240) add("INVALID_ANCHOR", "Anchor text is missing or too long", item);
    if (item.sourcePath === item.targetPath) add("SELF_LINK", "Source and target paths must differ", item);
  }
  return { issues, hardFail: issues.length > 0 };
}

function buildModel(db, input, actor = null, revalidating = false) {
  const sourceType = clean(input.sourceType, 30);
  const sourceId = clean(input.sourceId, 200);
  const source = resolveSource(db, sourceType, sourceId);
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 8) throw new Error("A semantic link set requires 1-8 items");
  const seen = new Set();
  const items = input.items.map((raw, index) => {
    const relationType = clean(raw.relationType, 50);
    const contract = RELATIONS[relationType];
    const targetType = clean(raw.targetType, 30);
    const targetId = clean(raw.targetId, 200);
    if (!contract || contract.sourceType !== sourceType || contract.targetType !== targetType) throw new Error("Semantic link relation does not match source/target types");
    const unique = `${relationType}\u0000${targetType}\u0000${targetId}`;
    if (seen.has(unique)) throw new Error("Duplicate semantic link target");
    seen.add(unique);
    const target = resolveTarget(db, targetType, targetId);
    const proof = proofFor(db, source, target, relationType, raw, actor, revalidating);
    const anchorText = anchorFor(relationType, target);
    const nextQuestion = clean(raw.nextQuestion, 240) || defaultQuestion(relationType, target);
    const evidenceChecksum = hash({
      relationType, source: source.checksum, target: target.checksum, proof,
      anchorText, nextQuestion, from: contract.from, to: contract.to,
    });
    return {
      sourceType, sourcePath: source.path, relationType, targetType, targetId,
      targetPath: target.path, targetTitle: target.title, anchorText, nextQuestion,
      journeyStageFrom: contract.from, journeyStageTo: contract.to,
      proofType: proof.type, proofRef: proof.ref, evidenceChecksum,
      sortOrder: Number.isInteger(raw.sortOrder) && raw.sortOrder >= 0 ? raw.sortOrder : index,
    };
  }).sort((left, right) => left.sortOrder - right.sortOrder || left.targetPath.localeCompare(right.targetPath));
  const safety = scanSemanticLinks(items);
  const evidenceFingerprint = hash({ sourceType, sourceId, sourcePath: source.path, engineVersion: SEMANTIC_LINK_ENGINE_VERSION, items: items.map((item) => item.evidenceChecksum) });
  return { source, items, safety, evidenceFingerprint };
}

function setRow(db, setId) {
  const row = db.prepare("SELECT * FROM semantic_link_sets WHERE id = ?").get(setId);
  if (!row) throw new Error("Semantic link set not found");
  return row;
}

function currentModel(db, set) {
  const items = db.prepare(`
    SELECT relation_type AS relationType, target_type AS targetType, target_id AS targetId,
      next_question AS nextQuestion, proof_type AS proofType, proof_ref AS proofRef,
      sort_order AS sortOrder, evidence_checksum AS evidenceChecksum
    FROM semantic_link_items WHERE link_set_id = ? ORDER BY sort_order, id
  `).all(set.id);
  const model = buildModel(db, { sourceType: set.source_type, sourceId: set.source_id, items }, null, true);
  if (model.evidenceFingerprint !== set.evidence_fingerprint || model.source.path !== set.source_path || model.safety.hardFail) {
    throw new Error("Semantic link set no longer matches current public entities and evidence");
  }
  const stored = items.map((item) => item.evidenceChecksum).sort();
  const current = model.items.map((item) => item.evidenceChecksum).sort();
  if (canonical(stored) !== canonical(current)) throw new Error("Stored semantic links differ from current evidence");
  return model;
}

function audit(db, { set, action, actor, details = {}, now }) {
  db.prepare(`
    INSERT INTO semantic_link_audit_events (
      id, link_set_id, source_type, source_id, action, actor_type,
      actor_id, details_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), set.id, set.source_type, set.source_id, action, actor.actorType, actor.actorId, canonical(details), now);
}

function review(db, { set, decision, actor, notes, now }) {
  db.prepare(`
    INSERT INTO semantic_link_reviews (
      id, link_set_id, decision, reviewer_type, reviewer_id,
      evidence_fingerprint, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), set.id, decision, actor.actorType, actor.actorId, set.evidence_fingerprint,
    clean(notes, 2000) || `${decision} after semantic-link review`, now);
}

export function createSemanticLinkDraft(db, input) {
  if (!hasSchema(db)) throw new Error("Semantic Linking schema is missing; apply migration 011 first");
  const actor = actorFrom(input);
  const model = buildModel(db, input, actor, false);
  if (model.safety.hardFail) throw new Error(`Semantic link safety hard fail: ${model.safety.issues.map((issue) => issue.code).join(", ")}`);
  const existing = db.prepare("SELECT * FROM semantic_link_sets WHERE source_type = ? AND source_id = ? AND evidence_fingerprint = ?")
    .get(model.source.type, model.source.id, model.evidenceFingerprint);
  if (existing) return { set: existing, duplicate: true };
  const version = db.prepare("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM semantic_link_sets WHERE source_type = ? AND source_id = ?")
    .get(model.source.type, model.source.id).version;
  const setId = `semantic-links-${hash(`${model.source.type}\u0000${model.source.id}\u0000${model.evidenceFingerprint}`).slice(0, 24)}`;
  const now = Date.now();
  db.transaction(() => {
    db.prepare(`
      INSERT INTO semantic_link_sets (
        id, source_type, source_id, source_path, version, status, engine_version,
        evidence_fingerprint, generated_by_actor_type, generated_by_actor_id,
        generated_by_ai, safety_issues_json, hard_fail, item_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(setId, model.source.type, model.source.id, model.source.path, version,
      SEMANTIC_LINK_ENGINE_VERSION, model.evidenceFingerprint, actor.actorType, actor.actorId,
      actor.actorType === "AI_ASSISTED" ? 1 : 0, canonical(model.safety.issues), model.items.length, now, now);
    const insert = db.prepare(`
      INSERT INTO semantic_link_items (
        id, link_set_id, source_type, relation_type, target_type, target_id,
        target_path, anchor_text, next_question, journey_stage_from, journey_stage_to,
        proof_type, proof_ref, evidence_checksum, sort_order, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    model.items.forEach((item) => insert.run(
      `semantic-link-${hash(`${setId}\u0000${item.evidenceChecksum}`).slice(0, 24)}`,
      setId, item.sourceType, item.relationType, item.targetType, item.targetId,
      item.targetPath, item.anchorText, item.nextQuestion, item.journeyStageFrom,
      item.journeyStageTo, item.proofType, item.proofRef, item.evidenceChecksum,
      item.sortOrder, now,
    ));
    audit(db, { set: { id: setId, source_type: model.source.type, source_id: model.source.id }, action: "DRAFT_CREATED", actor, details: { version, itemCount: model.items.length }, now });
  })();
  return { set: setRow(db, setId), duplicate: false };
}

export function approveSemanticLinkSet(db, input) {
  const actor = requireHuman(input, "Semantic link approval");
  const set = setRow(db, clean(input.setId, 200));
  if (set.status === "APPROVED") return set;
  if (set.status !== "DRAFT") throw new Error("Only a DRAFT semantic link set can be approved");
  currentModel(db, set);
  const now = Date.now();
  db.transaction(() => {
    db.prepare("UPDATE semantic_link_sets SET status = 'APPROVED', approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?").run(actor.actorId, now, now, set.id);
    review(db, { set, decision: "APPROVE", actor, notes: input.notes, now });
    audit(db, { set, action: "APPROVED", actor, now });
  })();
  return setRow(db, set.id);
}

export function publishSemanticLinkSet(db, input) {
  const actor = requireHuman(input, "Semantic link publication");
  const set = setRow(db, clean(input.setId, 200));
  if (set.status === "PUBLISHED") return set;
  if (set.status !== "APPROVED") throw new Error("Only an APPROVED semantic link set can be published");
  currentModel(db, set);
  const now = Date.now();
  db.transaction(() => {
    db.prepare("UPDATE semantic_link_sets SET status = 'SUPERSEDED', updated_at = ? WHERE source_type = ? AND source_id = ? AND status = 'PUBLISHED' AND id != ?")
      .run(now, set.source_type, set.source_id, set.id);
    db.prepare("UPDATE semantic_link_sets SET status = 'PUBLISHED', published_by = ?, published_at = ?, updated_at = ? WHERE id = ?")
      .run(actor.actorId, now, now, set.id);
    review(db, { set, decision: "PUBLISH", actor, notes: input.notes, now });
    audit(db, { set, action: "PUBLISHED", actor, now });
  })();
  return setRow(db, set.id);
}

export function rejectSemanticLinkSet(db, input) {
  const actor = requireHuman(input, "Semantic link rejection");
  const set = setRow(db, clean(input.setId, 200));
  if (set.status === "REJECTED") return set;
  if (!new Set(["DRAFT", "APPROVED"]).has(set.status)) throw new Error("Only a DRAFT or APPROVED semantic link set can be rejected");
  const now = Date.now();
  db.transaction(() => {
    db.prepare("UPDATE semantic_link_sets SET status = 'REJECTED', updated_at = ? WHERE id = ?").run(now, set.id);
    review(db, { set, decision: "REJECT", actor, notes: input.notes, now });
    audit(db, { set, action: "REJECTED", actor, now });
  })();
  return setRow(db, set.id);
}

export function markStaleSemanticLinks(db, input) {
  const actor = actorFrom(input);
  if (!new Set(["HUMAN", "SYSTEM"]).has(actor.actorType)) throw new Error("Stale scan requires a HUMAN or SYSTEM actor");
  const sourceType = clean(input.sourceType, 30);
  const sourceId = clean(input.sourceId, 200);
  const sets = db.prepare(`
    SELECT * FROM semantic_link_sets WHERE status = 'PUBLISHED'
      AND (? = '' OR source_type = ?) AND (? = '' OR source_id = ?)
    ORDER BY source_type, source_id
  `).all(sourceType, sourceType, sourceId, sourceId);
  const staleSetIds = [];
  const now = Date.now();
  for (const set of sets) {
    try { currentModel(db, set); continue; } catch { /* mark below */ }
    db.transaction(() => {
      db.prepare("UPDATE semantic_link_sets SET status = 'STALE', updated_at = ? WHERE id = ?").run(now, set.id);
      review(db, { set, decision: "MARK_STALE", actor, notes: input.notes || "Source, target or semantic proof changed", now });
      audit(db, { set, action: "MARKED_STALE", actor, now });
    })();
    staleSetIds.push(set.id);
  }
  return { checked: sets.length, staleSetIds };
}

export function getPublicSemanticLinks(db, sourceType, sourceId) {
  if (!hasSchema(db)) return null;
  const set = db.prepare(`
    SELECT * FROM semantic_link_sets
    WHERE source_type = ? AND source_id = ? AND status = 'PUBLISHED'
    ORDER BY version DESC LIMIT 1
  `).get(sourceType, sourceId);
  if (!set) return null;
  let model;
  try { model = currentModel(db, set); } catch { return null; }
  return {
    id: set.id, version: set.version, sourceType, sourceId,
    reviewedBy: set.approved_by, publishedAt: set.published_at,
    items: model.items.map((item) => ({
      id: `semantic-link-${hash(`${set.id}\u0000${item.evidenceChecksum}`).slice(0, 24)}`,
      relationType: item.relationType, targetType: item.targetType, targetId: item.targetId,
      href: item.targetPath, anchorText: item.anchorText, nextQuestion: item.nextQuestion,
      journeyStageFrom: item.journeyStageFrom, journeyStageTo: item.journeyStageTo,
    })),
  };
}

export function discoverSemanticLinkItems(db, input) {
  const sourceType = clean(input.sourceType, 30);
  const sourceId = clean(input.sourceId, 200);
  const source = resolveSource(db, sourceType, sourceId);
  const items = [];
  const push = (relationType, targetType, targetId, extra = {}) => {
    const candidate = { relationType, targetType, targetId, ...extra };
    try {
      const target = resolveTarget(db, targetType, targetId);
      proofFor(db, source, target, relationType, candidate, null, false);
      items.push(candidate);
    } catch { /* discovery returns only candidates that pass the current proof contract */ }
  };
  if (sourceType === "ARTICLE") {
    push("ARTICLE_TO_CATEGORY", "CATEGORY", source.categorySlug);
    for (const row of db.prepare("SELECT product_id FROM content_products WHERE content_asset_id = ? ORDER BY sort_order, product_id LIMIT 4").all(source.id)) push("ARTICLE_TO_PRODUCT", "PRODUCT", row.product_id);
    for (const row of db.prepare(`
      SELECT related.related_content_asset_id
      FROM content_related related
      JOIN content_assets target ON target.id = related.related_content_asset_id
      WHERE related.content_asset_id = ?
        AND target.content_type NOT IN ('GUIDE', 'COMPARISON')
        AND target.status = 'PUBLISHED' AND target.index_status = 'INDEX' AND target.human_reviewed = 1
      ORDER BY related.sort_order, related.related_content_asset_id LIMIT 4
    `).all(source.id)) push("ARTICLE_TO_ARTICLE", "ARTICLE", row.related_content_asset_id);
  } else if (sourceType === "PRODUCT") {
    for (const row of db.prepare(`
      SELECT related.content_asset_id
      FROM content_products related
      JOIN content_assets target ON target.id = related.content_asset_id
      WHERE related.product_id = ?
        AND target.content_type NOT IN ('GUIDE', 'COMPARISON')
        AND target.status = 'PUBLISHED' AND target.index_status = 'INDEX' AND target.human_reviewed = 1
      ORDER BY related.sort_order, related.content_asset_id LIMIT 6
    `).all(source.id)) push("PRODUCT_TO_ARTICLE", "ARTICLE", row.content_asset_id);
    for (const tool of listPublicInteractiveTools(db).filter((candidate) => candidate.type === "COMPATIBILITY_TABLE")) {
      const detail = getPublicInteractiveTool(db, tool.slug);
      if (detail?.rows.some((row) => row.product.id === source.id || row.accessory.id === source.id)) push("PRODUCT_TO_COMPATIBILITY", "COMPATIBILITY", tool.key);
    }
  } else if (sourceType === "CATEGORY") {
    for (const row of db.prepare("SELECT id FROM content_assets WHERE category_slug = ? AND content_type = 'GUIDE' AND status = 'PUBLISHED' AND index_status = 'INDEX' AND human_reviewed = 1 ORDER BY published_at DESC LIMIT 6").all(source.id)) push("CATEGORY_TO_GUIDE", "GUIDE", row.id);
  } else if (sourceType === "CALCULATOR") {
    for (const product of source.tool.products?.slice(0, 8) ?? []) push("CALCULATOR_TO_PRODUCT", "PRODUCT", product.id);
  } else {
    for (const row of db.prepare("SELECT product_id FROM content_products WHERE content_asset_id = ? ORDER BY sort_order, product_id LIMIT 8").all(source.id)) push("COMPARISON_TO_PRODUCT", "PRODUCT", row.product_id);
  }
  return { source: { type: source.type, id: source.id, path: source.path, title: source.title }, items };
}

export function listSemanticLinkQueue(db, input = {}) {
  const status = clean(input.status, 30);
  const limit = Math.max(1, Math.min(500, Math.trunc(Number(input.limit ?? 100))));
  return db.prepare("SELECT * FROM semantic_link_sets WHERE (? = '' OR status = ?) ORDER BY updated_at DESC, source_type, source_id LIMIT ?")
    .all(status, status, limit);
}
