import { createHash, randomUUID } from "node:crypto";

export const PRODUCT_ENRICHMENT_ENGINE_VERSION = "product-enrichment-v1";

const ACTOR_TYPES = new Set(["HUMAN", "SYSTEM", "AI_ASSISTED"]);
const SECTION_ORDER = new Map([
  ["SUITABLE_TASK", 10],
  ["NOT_SUITABLE_TASK", 20],
  ["ADVANTAGE", 30],
  ["BEFORE_BUYING", 40],
  ["COMPATIBLE_ACCESSORY", 50],
  ["ANALOG", 60],
  ["DIFFERENCE", 70],
  ["FAQ", 80],
]);
const SECTION_LIMITS = new Map([
  ["SUITABLE_TASK", 6],
  ["NOT_SUITABLE_TASK", 6],
  ["ADVANTAGE", 6],
  ["BEFORE_BUYING", 10],
  ["COMPATIBLE_ACCESSORY", 8],
  ["ANALOG", 6],
  ["DIFFERENCE", 8],
  ["FAQ", 6],
]);

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
  if (!ACTOR_TYPES.has(actorType)) throw new Error("actorType must be HUMAN, SYSTEM or AI_ASSISTED");
  if (!actorId) throw new Error("actorId is required");
  return { actorType, actorId };
}

function requireHuman(input, action) {
  const actor = actorFrom(input);
  if (actor.actorType !== "HUMAN") throw new Error(`${action} requires a human actor`);
  return actor;
}

function hasSchema(db) {
  return db.prepare(`
    SELECT COUNT(*) AS count FROM sqlite_schema
    WHERE type = 'table' AND name IN (
      'product_enrichment_sets', 'product_enrichment_items', 'fact_assertions',
      'fact_evidence', 'source_facts', 'sources'
    )
  `).get().count === 6;
}

function productRow(db, productId) {
  const product = db.prepare(`
    SELECT id, slug, title, brand, category, draft FROM products WHERE id = ?
  `).get(productId);
  if (!product || product.draft !== 0) throw new Error("Product enrichment requires a live non-draft product");
  return product;
}

function humanLabel(value) {
  const label = cleanText(value, 300).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return label ? `${label.charAt(0).toLocaleUpperCase("ru-RU")}${label.slice(1)}` : "";
}

function assertionValue(assertion) {
  if (assertion.value_number != null) return `${assertion.value_number}${assertion.unit ? ` ${assertion.unit}` : ""}`;
  if (assertion.value_text) return cleanText(assertion.value_text, 500);
  if (assertion.value_json) {
    try {
      const value = JSON.parse(assertion.value_json);
      if (Array.isArray(value)) return value.map((item) => cleanText(item, 120)).filter(Boolean).join(", ");
      if (value && typeof value === "object") return Object.entries(value).map(([key, item]) => `${humanLabel(key)}: ${cleanText(item, 120)}`).join("; ");
      return cleanText(value, 500);
    } catch {
      return "";
    }
  }
  return "";
}

function assertionRecord(db, assertionId, at = Date.now()) {
  const assertion = db.prepare(`
    SELECT id, subject_type, subject_id, predicate, value_text, value_number, unit,
      value_json, verification_status, verified_by, verified_at, valid_from, valid_to,
      updated_at
    FROM fact_assertions WHERE id = ?
  `).get(assertionId);
  if (!assertion || assertion.verification_status !== "VERIFIED" || !assertion.verified_by || !assertion.verified_at) return null;
  if ((assertion.valid_from != null && assertion.valid_from > at) || (assertion.valid_to != null && assertion.valid_to <= at)) return null;
  const evidence = db.prepare(`
    SELECT fe.evidence_role, sf.id, sf.checksum, sf.status, sf.subject_type, sf.subject_id,
      s.id AS source_id, s.rights_policy, s.active
    FROM fact_evidence fe
    JOIN source_facts sf ON sf.id = fe.source_fact_id
    JOIN sources s ON s.id = sf.source_id
    WHERE fe.assertion_id = ? ORDER BY fe.evidence_role, sf.id
  `).all(assertion.id);
  if (!evidence.length) return null;
  if (evidence.some((row) => row.evidence_role === "CONFLICTING"
    || row.rights_policy !== "PUBLISHABLE_FACTS" || row.active !== 1
    || !new Set(["OBSERVED", "VALID"]).has(row.status))) return null;
  const snapshot = {
    id: assertion.id,
    subjectType: assertion.subject_type,
    subjectId: assertion.subject_id,
    predicate: assertion.predicate,
    valueText: assertion.value_text,
    valueNumber: assertion.value_number,
    unit: assertion.unit,
    valueJson: assertion.value_json,
    verifiedBy: assertion.verified_by,
    verifiedAt: assertion.verified_at,
    validFrom: assertion.valid_from,
    validTo: assertion.valid_to,
    evidence: evidence.map((row) => ({
      role: row.evidence_role,
      id: row.id,
      checksum: row.checksum,
      status: row.status,
      sourceId: row.source_id,
      rightsPolicy: row.rights_policy,
      sourceActive: row.active,
    })),
  };
  return { ...assertion, evidence, snapshot, snapshotChecksum: hash(canonical(snapshot)) };
}

function relatedProduct(db, productId) {
  if (!productId) return null;
  return db.prepare(`
    SELECT id, slug, title, brand, category, draft FROM products WHERE id = ? AND draft = 0
  `).get(productId) ?? null;
}

function makeItem({
  sectionType, templateKey, label = null, body = null, question = null, answer = null,
  primaryAssertion, secondaryAssertion = null, related = null, sourcePredicate, sortOrder = 0,
}) {
  const item = {
    sectionType,
    templateKey,
    label: label ? cleanText(label, 300) : null,
    body: body ? cleanText(body, 1200) : null,
    question: question ? cleanText(question, 500) : null,
    answer: answer ? cleanText(answer, 1200) : null,
    primaryAssertionId: primaryAssertion.id,
    secondaryAssertionId: secondaryAssertion?.id ?? null,
    relatedProductId: related?.id ?? null,
    relatedProductSlug: related?.slug ?? null,
    relatedProductTitle: related?.title ?? null,
    sourcePredicate,
    sortOrder,
    primarySnapshotChecksum: primaryAssertion.snapshotChecksum,
    secondarySnapshotChecksum: secondaryAssertion?.snapshotChecksum ?? null,
  };
  return { ...item, evidenceChecksum: hash(canonical(item)) };
}

function collectApplications(db, product, at) {
  const rows = db.prepare(`
    SELECT application_key, suitability, assertion_id
    FROM product_applications
    WHERE product_id = ? AND status = 'ACTIVE' AND suitability != 'UNKNOWN'
    ORDER BY suitability, application_key, assertion_id
  `).all(product.id);
  const items = [];
  for (const row of rows) {
    const assertion = assertionRecord(db, row.assertion_id, at);
    if (!assertion || assertion.subject_type !== "PRODUCT" || assertion.subject_id !== product.id) continue;
    const label = humanLabel(row.application_key);
    if (!label) continue;
    if (row.suitability === "SUPPORTED" && assertion.predicate === "SUPPORTS") {
      items.push(makeItem({
        sectionType: "SUITABLE_TASK", templateKey: "APPLICATION_SUPPORTED", label,
        body: `Подходит для задачи «${label}» в пределах характеристик, подтверждённых источником.`,
        primaryAssertion: assertion, sourcePredicate: assertion.predicate,
      }));
    } else if (row.suitability === "BETTER_FOR" && assertion.predicate === "BETTER_FOR") {
      items.push(makeItem({
        sectionType: "ADVANTAGE", templateKey: "APPLICATION_BETTER_FOR", label,
        body: `В проверенных данных отмечено преимущество модели для задачи «${label}». Конкретные условия применения следует сопоставить с техническим заданием.`,
        primaryAssertion: assertion, sourcePredicate: assertion.predicate,
      }));
    } else if (row.suitability === "NOT_RECOMMENDED" && assertion.predicate === "NOT_RECOMMENDED_FOR") {
      items.push(makeItem({
        sectionType: "NOT_SUITABLE_TASK", templateKey: "APPLICATION_NOT_RECOMMENDED", label,
        body: `Не рекомендуется для задачи «${label}» согласно проверенному источнику.`,
        primaryAssertion: assertion, sourcePredicate: assertion.predicate,
      }));
    }
  }
  return items;
}

function collectFeatures(db, product, at) {
  const rows = db.prepare(`
    SELECT feature_key, assertion_id, sort_order
    FROM product_features
    WHERE product_id = ? AND status = 'ACTIVE'
    ORDER BY sort_order, feature_key, assertion_id
  `).all(product.id);
  const items = [];
  for (const row of rows) {
    const assertion = assertionRecord(db, row.assertion_id, at);
    if (!assertion || assertion.subject_type !== "PRODUCT" || assertion.subject_id !== product.id) continue;
    const label = humanLabel(row.feature_key);
    const value = assertionValue(assertion);
    if (!label || !value) continue;
    items.push(makeItem({
      sectionType: "BEFORE_BUYING", templateKey: "DECLARED_FEATURE", label,
      body: `Заявленная характеристика «${label}» — ${value} согласно проверенному источнику. Перед покупкой сопоставьте это значение с требованиями задачи.`,
      primaryAssertion: assertion, sourcePredicate: assertion.predicate, sortOrder: row.sort_order,
    }));
  }
  return items;
}

function collectRelations(db, product, at) {
  const rows = db.prepare(`
    SELECT predicate, object_type, object_id, assertion_id
    FROM knowledge_relations
    WHERE subject_type = 'PRODUCT' AND subject_id = ? AND verification_status = 'VERIFIED'
      AND (valid_from IS NULL OR valid_from <= ?) AND (valid_to IS NULL OR valid_to > ?)
      AND predicate IN ('USES_ACCESSORY', 'COMPATIBLE_WITH', 'REQUIRES',
        'ALTERNATIVE_TO', 'BETTER_FOR', 'NOT_RECOMMENDED_FOR')
    ORDER BY predicate, object_type, object_id, assertion_id
  `).all(product.id, at, at);
  const items = [];
  for (const row of rows) {
    if (row.object_type !== "PRODUCT") continue;
    const assertion = assertionRecord(db, row.assertion_id, at);
    const related = relatedProduct(db, row.object_id);
    if (!assertion || !related || assertion.subject_type !== "PRODUCT"
      || assertion.subject_id !== product.id || assertion.predicate !== row.predicate) continue;
    if (row.predicate === "USES_ACCESSORY" || row.predicate === "COMPATIBLE_WITH") {
      items.push(makeItem({
        sectionType: "COMPATIBLE_ACCESSORY", templateKey: "COMPATIBLE_PRODUCT", label: related.title,
        body: `Совместимость с «${related.title}» подтверждена для указанной связи. Перед заказом сверьте конкретные артикулы и модификации.`,
        primaryAssertion: assertion, related, sourcePredicate: row.predicate,
      }));
    } else if (row.predicate === "REQUIRES") {
      items.push(makeItem({
        sectionType: "BEFORE_BUYING", templateKey: "REQUIRES_PRODUCT", label: related.title,
        body: `Для применения требуется «${related.title}» согласно проверенной связи. Перед заказом подтвердите конкретную модификацию.`,
        primaryAssertion: assertion, related, sourcePredicate: row.predicate,
      }));
    } else if (row.predicate === "ALTERNATIVE_TO") {
      items.push(makeItem({
        sectionType: "ANALOG", templateKey: "ALTERNATIVE_PRODUCT", label: related.title,
        body: `«${related.title}» указан как подтверждённая альтернатива. Это не означает идентичность характеристик: сравните параметры и условия задачи.`,
        primaryAssertion: assertion, related, sourcePredicate: row.predicate,
      }));
    } else if (row.predicate === "NOT_RECOMMENDED_FOR") {
      items.push(makeItem({
        sectionType: "NOT_SUITABLE_TASK", templateKey: "RELATION_NOT_RECOMMENDED", label: related.title,
        body: `Сочетание с «${related.title}» не рекомендуется по проверенным данным.`,
        primaryAssertion: assertion, related, sourcePredicate: row.predicate,
      }));
    } else if (row.predicate === "BETTER_FOR") {
      items.push(makeItem({
        sectionType: "ADVANTAGE", templateKey: "APPLICATION_BETTER_FOR", label: related.title,
        body: `В проверенных данных отмечено преимущество модели при выборе вместо «${related.title}». Сопоставьте характеристики обеих моделей с техническим заданием.`,
        primaryAssertion: assertion, related, sourcePredicate: row.predicate,
      }));
    }
  }
  return items;
}

function collectCompatibility(db, product, at) {
  const rows = db.prepare(`
    SELECT pc.*, CASE WHEN pc.product_a_id = ? THEN pc.product_b_id ELSE pc.product_a_id END AS related_id
    FROM product_compatibility pc
    WHERE (pc.product_a_id = ? OR pc.product_b_id = ?) AND pc.verified = 1
    ORDER BY pc.compatibility_type, related_id, pc.assertion_id
  `).all(product.id, product.id, product.id);
  const items = [];
  for (const row of rows) {
    const assertion = assertionRecord(db, row.assertion_id, at);
    const related = relatedProduct(db, row.related_id);
    if (!assertion || !related || assertion.predicate !== "COMPATIBLE_WITH") continue;
    const compatibilityType = humanLabel(row.compatibility_type);
    if (row.compatibility_status === "COMPATIBLE") {
      items.push(makeItem({
        sectionType: "COMPATIBLE_ACCESSORY", templateKey: "COMPATIBLE_PRODUCT", label: related.title,
        body: `Совместимость с «${related.title}» подтверждена для типа связи «${compatibilityType}». Перед заказом сверьте конкретные артикулы.`,
        primaryAssertion: assertion, related, sourcePredicate: assertion.predicate,
      }));
    } else if (row.compatibility_status === "INCOMPATIBLE") {
      items.push(makeItem({
        sectionType: "NOT_SUITABLE_TASK", templateKey: "INCOMPATIBLE_PRODUCT", label: related.title,
        body: `По проверенным данным модель несовместима с «${related.title}» в рамках типа связи «${compatibilityType}».`,
        primaryAssertion: assertion, related, sourcePredicate: assertion.predicate,
      }));
    } else if (row.compatibility_status === "CONDITIONAL") {
      items.push(makeItem({
        sectionType: "BEFORE_BUYING", templateKey: "CONDITIONAL_COMPATIBILITY", label: related.title,
        body: `Совместимость с «${related.title}» условная для типа связи «${compatibilityType}». Конкретные условия необходимо подтвердить до заказа.`,
        primaryAssertion: assertion, related, sourcePredicate: assertion.predicate,
      }));
    }
  }
  return items;
}

function collectDifferences(db, product, analogItems, at) {
  const items = [];
  const analogIds = [...new Set(analogItems.map((item) => item.relatedProductId).filter(Boolean))];
  for (const relatedId of analogIds) {
    const related = relatedProduct(db, relatedId);
    if (!related) continue;
    const pairs = db.prepare(`
      SELECT current.feature_key,
        current.assertion_id AS current_assertion_id,
        alternative.assertion_id AS alternative_assertion_id
      FROM product_features current
      JOIN product_features alternative ON alternative.feature_key = current.feature_key
      WHERE current.product_id = ? AND alternative.product_id = ?
        AND current.status = 'ACTIVE' AND alternative.status = 'ACTIVE'
      ORDER BY current.sort_order, current.feature_key, current.assertion_id, alternative.assertion_id
    `).all(product.id, related.id);
    for (const pair of pairs) {
      const currentAssertion = assertionRecord(db, pair.current_assertion_id, at);
      const relatedAssertion = assertionRecord(db, pair.alternative_assertion_id, at);
      if (!currentAssertion || !relatedAssertion) continue;
      const currentValue = assertionValue(currentAssertion);
      const relatedValue = assertionValue(relatedAssertion);
      if (!currentValue || !relatedValue || currentValue === relatedValue) continue;
      const label = humanLabel(pair.feature_key);
      items.push(makeItem({
        sectionType: "DIFFERENCE", templateKey: "VERIFIED_FEATURE_DIFFERENCE", label,
        body: `По характеристике «${label}»: у «${product.title}» заявлено ${currentValue}, у «${related.title}» — ${relatedValue}. Оба значения приведены по проверенным источникам.`,
        primaryAssertion: currentAssertion, secondaryAssertion: relatedAssertion,
        related, sourcePredicate: currentAssertion.predicate,
      }));
    }
  }
  return items;
}

function collectFaq(product, items) {
  const faq = [];
  const application = items.find((item) => item.templateKey === "APPLICATION_SUPPORTED");
  if (application) {
    faq.push(makeItem({
      sectionType: "FAQ", templateKey: "FAQ_APPLICATION",
      question: `Подходит ли «${product.title}» для задачи «${application.label}»?`,
      answer: application.body,
      primaryAssertion: { id: application.primaryAssertionId, snapshotChecksum: application.primarySnapshotChecksum },
      sourcePredicate: application.sourcePredicate,
    }));
  }
  for (const feature of items.filter((item) => item.templateKey === "DECLARED_FEATURE").slice(0, 2)) {
    faq.push(makeItem({
      sectionType: "FAQ", templateKey: "FAQ_FEATURE",
      question: `Какое значение характеристики «${feature.label}» заявлено для «${product.title}»?`,
      answer: feature.body,
      primaryAssertion: { id: feature.primaryAssertionId, snapshotChecksum: feature.primarySnapshotChecksum },
      sourcePredicate: feature.sourcePredicate,
    }));
  }
  for (const compatibility of items.filter((item) => new Set([
    "COMPATIBLE_PRODUCT", "INCOMPATIBLE_PRODUCT", "CONDITIONAL_COMPATIBILITY",
  ]).has(item.templateKey)).slice(0, 2)) {
    faq.push(makeItem({
      sectionType: "FAQ", templateKey: "FAQ_COMPATIBILITY",
      question: `Совместим ли «${product.title}» с «${compatibility.relatedProductTitle}»?`,
      answer: compatibility.body,
      primaryAssertion: { id: compatibility.primaryAssertionId, snapshotChecksum: compatibility.primarySnapshotChecksum },
      related: compatibility.relatedProductId ? {
        id: compatibility.relatedProductId,
        slug: compatibility.relatedProductSlug,
        title: compatibility.relatedProductTitle,
      } : null,
      sourcePredicate: compatibility.sourcePredicate,
    }));
  }
  return faq;
}

function deduplicateAndLimit(items) {
  const seen = new Set();
  const counts = new Map();
  return items
    .sort((left, right) => (SECTION_ORDER.get(left.sectionType) ?? 999) - (SECTION_ORDER.get(right.sectionType) ?? 999)
      || left.sortOrder - right.sortOrder
      || left.evidenceChecksum.localeCompare(right.evidenceChecksum))
    .filter((item) => {
      const key = `${item.sectionType}\u0000${item.templateKey}\u0000${item.primaryAssertionId}\u0000${item.relatedProductId ?? ""}\u0000${item.label ?? item.question}`;
      if (seen.has(key)) return false;
      const count = counts.get(item.sectionType) ?? 0;
      if (count >= (SECTION_LIMITS.get(item.sectionType) ?? 10)) return false;
      seen.add(key);
      counts.set(item.sectionType, count + 1);
      return true;
    });
}

export function scanProductEnrichment(items) {
  const issues = [];
  const add = (code, message, item) => issues.push({ code, message, evidenceChecksum: item.evidenceChecksum });
  for (const item of items) {
    const text = `${item.label ?? ""} ${item.body ?? ""} ${item.question ?? ""} ${item.answer ?? ""}`;
    if (/<[^>]+>/u.test(text)) add("HTML_FORBIDDEN", "HTML is forbidden in product enrichment", item);
    if (/идеал(?:ен|ьн)|в любых условиях|лучши[йея]|№\s*1|гарантирован|универсальн(?:ый|ая|ое)/iu.test(text)) {
      add("UNSUPPORTED_PROMOTION", "Unsupported promotional or absolute language", item);
    }
    if (item.sectionType === "ADVANTAGE" && item.sourcePredicate !== "BETTER_FOR") {
      add("ADVANTAGE_WITHOUT_FACT", "Advantage requires a verified BETTER_FOR assertion", item);
    }
    if (item.templateKey === "APPLICATION_SUPPORTED" && item.sourcePredicate !== "SUPPORTS") {
      add("APPLICATION_WITHOUT_FACT", "Suitable task requires a verified SUPPORTS assertion", item);
    }
    if (new Set(["APPLICATION_NOT_RECOMMENDED", "RELATION_NOT_RECOMMENDED"]).has(item.templateKey)
      && item.sourcePredicate !== "NOT_RECOMMENDED_FOR") {
      add("LIMITATION_WITHOUT_FACT", "Not-recommended language requires an explicit assertion", item);
    }
    if (item.templateKey === "DECLARED_FEATURE"
      && (!/заявлен/iu.test(item.body ?? "") || !/проверенн.*источник/iu.test(item.body ?? ""))) {
      add("UNQUALIFIED_SPECIFICATION", "Declared specifications must carry source-qualified wording", item);
    }
    if (item.templateKey === "VERIFIED_FEATURE_DIFFERENCE" && !item.secondaryAssertionId) {
      add("ONE_SIDED_COMPARISON", "Product difference requires assertions for both products", item);
    }
    if (!item.primaryAssertionId) add("MISSING_ASSERTION", "Every item requires a primary assertion", item);
  }
  return { hardFail: issues.length > 0, issues };
}

function buildEvidenceModel(db, productId, at = Date.now()) {
  const product = productRow(db, productId);
  const applicationItems = collectApplications(db, product, at);
  const featureItems = collectFeatures(db, product, at);
  const relationItems = collectRelations(db, product, at);
  const compatibilityItems = collectCompatibility(db, product, at);
  const analogItems = relationItems.filter((item) => item.sectionType === "ANALOG");
  const differenceItems = collectDifferences(db, product, analogItems, at);
  const nonFaqItems = deduplicateAndLimit([
    ...applicationItems, ...featureItems, ...relationItems, ...compatibilityItems, ...differenceItems,
  ]);
  const items = deduplicateAndLimit([...nonFaqItems, ...collectFaq(product, nonFaqItems)]);
  const safety = scanProductEnrichment(items);
  const fingerprintPayload = {
    engineVersion: PRODUCT_ENRICHMENT_ENGINE_VERSION,
    product: { id: product.id, slug: product.slug, title: product.title, brand: product.brand, category: product.category, draft: product.draft },
    items: items.map((item) => ({
      sectionType: item.sectionType,
      templateKey: item.templateKey,
      label: item.label,
      body: item.body,
      question: item.question,
      answer: item.answer,
      primaryAssertionId: item.primaryAssertionId,
      secondaryAssertionId: item.secondaryAssertionId,
      relatedProductId: item.relatedProductId,
      relatedProductSlug: item.relatedProductSlug,
      relatedProductTitle: item.relatedProductTitle,
      sourcePredicate: item.sourcePredicate,
      evidenceChecksum: item.evidenceChecksum,
    })),
  };
  return { product, items, safety, evidenceFingerprint: hash(canonical(fingerprintPayload)) };
}

function enrichmentSet(db, setId) {
  const set = db.prepare("SELECT * FROM product_enrichment_sets WHERE id = ?").get(setId);
  if (!set) throw new Error("Product enrichment set not found");
  return set;
}

function audit(db, { setId, productId, action, actor, details = {}, now = Date.now() }) {
  db.prepare(`
    INSERT INTO product_enrichment_audit_events (
      id, enrichment_set_id, product_id, action, actor_type, actor_id, details_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), setId, productId, action, actor.actorType, actor.actorId, canonical(details), now);
}

function addReview(db, { set, decision, reviewerType, reviewerId, notes, now = Date.now() }) {
  db.prepare(`
    INSERT INTO product_enrichment_reviews (
      id, enrichment_set_id, decision, reviewer_type, reviewer_id,
      evidence_fingerprint, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), set.id, decision, reviewerType, reviewerId,
    set.evidence_fingerprint, requireText(notes, "notes", 2000), now);
}

function validateSetAgainstCurrentEvidence(db, set) {
  const model = buildEvidenceModel(db, set.product_id);
  if (model.evidenceFingerprint !== set.evidence_fingerprint) {
    throw new Error("Verified product evidence changed; create a new enrichment version");
  }
  const stored = db.prepare(`
    SELECT section_type AS sectionType, template_key AS templateKey, label, body,
      question, answer, primary_assertion_id AS primaryAssertionId,
      secondary_assertion_id AS secondaryAssertionId, related_product_id AS relatedProductId,
      source_predicate AS sourcePredicate, evidence_checksum AS evidenceChecksum,
      sort_order AS sortOrder
    FROM product_enrichment_items WHERE enrichment_set_id = ?
    ORDER BY section_type, sort_order, id
  `).all(set.id);
  const storedChecksums = stored.map((item) => item.evidenceChecksum).sort();
  const currentChecksums = model.items.map((item) => item.evidenceChecksum).sort();
  if (canonical(storedChecksums) !== canonical(currentChecksums)) {
    throw new Error("Stored enrichment items do not match current verified evidence");
  }
  const safety = scanProductEnrichment(stored);
  if (safety.hardFail) throw new Error(`Product enrichment safety hard fail: ${safety.issues.map((issue) => issue.code).join(", ")}`);
  return model;
}

export function createProductEnrichmentDraft(db, input) {
  if (!hasSchema(db)) throw new Error("Product Enrichment schema is missing; apply migration 009 first");
  const actor = actorFrom(input);
  const productId = requireText(input.productId, "productId", 200);
  const model = buildEvidenceModel(db, productId);
  if (!model.items.length) throw new Error("No publishable verified facts are available for product enrichment");
  if (model.safety.hardFail) throw new Error(`Product enrichment safety hard fail: ${model.safety.issues.map((issue) => issue.code).join(", ")}`);
  const existing = db.prepare(`
    SELECT * FROM product_enrichment_sets WHERE product_id = ? AND evidence_fingerprint = ?
  `).get(productId, model.evidenceFingerprint);
  if (existing) return { set: existing, items: db.prepare("SELECT * FROM product_enrichment_items WHERE enrichment_set_id = ? ORDER BY section_type, sort_order, id").all(existing.id), duplicate: true };
  const version = db.prepare(`
    SELECT COALESCE(MAX(version), 0) + 1 AS version FROM product_enrichment_sets WHERE product_id = ?
  `).get(productId).version;
  const setId = `product-enrichment-${hash(`${productId}\u0000${model.evidenceFingerprint}`).slice(0, 24)}`;
  const now = Date.now();
  db.transaction(() => {
    db.prepare(`
      INSERT INTO product_enrichment_sets (
        id, product_id, version, status, evidence_fingerprint, engine_version,
        generated_by_actor_type, generated_by_actor_id, generated_by_ai,
        safety_issues_json, hard_fail, item_count, created_at, updated_at
      ) VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(
      setId, productId, version, model.evidenceFingerprint, PRODUCT_ENRICHMENT_ENGINE_VERSION,
      actor.actorType, actor.actorId, actor.actorType === "AI_ASSISTED" ? 1 : 0,
      canonical(model.safety.issues), model.items.length, now, now,
    );
    const insert = db.prepare(`
      INSERT INTO product_enrichment_items (
        id, enrichment_set_id, section_type, template_key, label, body, question,
        answer, primary_assertion_id, secondary_assertion_id, related_product_id,
        source_predicate, evidence_checksum, sort_order, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    model.items.forEach((item, index) => insert.run(
      `product-enrichment-item-${hash(`${setId}\u0000${item.sectionType}\u0000${item.evidenceChecksum}`).slice(0, 24)}`,
      setId, item.sectionType, item.templateKey, item.label, item.body, item.question,
      item.answer, item.primaryAssertionId, item.secondaryAssertionId, item.relatedProductId,
      item.sourcePredicate, item.evidenceChecksum, index, now,
    ));
    audit(db, { setId, productId, action: "DRAFT_CREATED", actor, details: { version, itemCount: model.items.length, evidenceFingerprint: model.evidenceFingerprint }, now });
  })();
  return {
    set: enrichmentSet(db, setId),
    items: db.prepare("SELECT * FROM product_enrichment_items WHERE enrichment_set_id = ? ORDER BY section_type, sort_order, id").all(setId),
    duplicate: false,
  };
}

export function approveProductEnrichment(db, input) {
  const actor = requireHuman(input, "Product enrichment approval");
  const set = enrichmentSet(db, requireText(input.setId, "setId", 200));
  if (set.status === "APPROVED") return set;
  if (set.status !== "DRAFT") throw new Error("Only a DRAFT product enrichment set can be approved");
  validateSetAgainstCurrentEvidence(db, set);
  const now = Date.now();
  db.transaction(() => {
    db.prepare(`
      UPDATE product_enrichment_sets SET status = 'APPROVED', approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?
    `).run(actor.actorId, now, now, set.id);
    addReview(db, { set, decision: "APPROVE", reviewerType: "HUMAN", reviewerId: actor.actorId, notes: input.notes, now });
    audit(db, { setId: set.id, productId: set.product_id, action: "APPROVED", actor, now });
  })();
  return enrichmentSet(db, set.id);
}

export function publishProductEnrichment(db, input) {
  const actor = requireHuman(input, "Product enrichment publication");
  const set = enrichmentSet(db, requireText(input.setId, "setId", 200));
  if (set.status === "PUBLISHED") return set;
  if (set.status !== "APPROVED") throw new Error("Only an APPROVED product enrichment set can be published");
  validateSetAgainstCurrentEvidence(db, set);
  const now = Date.now();
  db.transaction(() => {
    db.prepare(`
      UPDATE product_enrichment_sets SET status = 'SUPERSEDED', updated_at = ?
      WHERE product_id = ? AND status = 'PUBLISHED' AND id != ?
    `).run(now, set.product_id, set.id);
    db.prepare(`
      UPDATE product_enrichment_sets SET status = 'PUBLISHED', published_by = ?, published_at = ?, updated_at = ? WHERE id = ?
    `).run(actor.actorId, now, now, set.id);
    addReview(db, { set, decision: "PUBLISH", reviewerType: "HUMAN", reviewerId: actor.actorId, notes: input.notes, now });
    audit(db, { setId: set.id, productId: set.product_id, action: "PUBLISHED", actor, now });
  })();
  return enrichmentSet(db, set.id);
}

export function rejectProductEnrichment(db, input) {
  const actor = requireHuman(input, "Product enrichment rejection");
  const set = enrichmentSet(db, requireText(input.setId, "setId", 200));
  if (set.status === "REJECTED") return set;
  if (!new Set(["DRAFT", "APPROVED"]).has(set.status)) throw new Error("Only a DRAFT or APPROVED set can be rejected");
  const now = Date.now();
  db.transaction(() => {
    db.prepare("UPDATE product_enrichment_sets SET status = 'REJECTED', updated_at = ? WHERE id = ?").run(now, set.id);
    addReview(db, { set, decision: "REJECT", reviewerType: "HUMAN", reviewerId: actor.actorId, notes: input.notes, now });
    audit(db, { setId: set.id, productId: set.product_id, action: "REJECTED", actor, now });
  })();
  return enrichmentSet(db, set.id);
}

export function markStaleProductEnrichments(db, input) {
  const actor = actorFrom(input);
  if (!new Set(["HUMAN", "SYSTEM"]).has(actor.actorType)) throw new Error("Stale scan requires a human or deterministic system actor");
  const productId = cleanText(input.productId, 200);
  const sets = db.prepare(`
    SELECT * FROM product_enrichment_sets
    WHERE status = 'PUBLISHED' AND (? = '' OR product_id = ?)
    ORDER BY product_id
  `).all(productId, productId);
  const stale = [];
  const now = Date.now();
  for (const set of sets) {
    let current = null;
    try { current = buildEvidenceModel(db, set.product_id); } catch { current = null; }
    if (current?.evidenceFingerprint === set.evidence_fingerprint) continue;
    db.transaction(() => {
      db.prepare("UPDATE product_enrichment_sets SET status = 'STALE', updated_at = ? WHERE id = ?").run(now, set.id);
      addReview(db, {
        set, decision: "MARK_STALE", reviewerType: actor.actorType, reviewerId: actor.actorId,
        notes: cleanText(input.notes, 2000) || "Verified evidence fingerprint changed", now,
      });
      audit(db, { setId: set.id, productId: set.product_id, action: "MARKED_STALE", actor, details: { previousFingerprint: set.evidence_fingerprint, currentFingerprint: current?.evidenceFingerprint ?? null }, now });
    })();
    stale.push(set.id);
  }
  return { checked: sets.length, staleSetIds: stale };
}

function publicArticles(db, productId) {
  const schema = db.prepare(`
    SELECT COUNT(*) AS count FROM sqlite_schema
    WHERE type = 'table' AND name IN ('content_assets', 'content_products')
  `).get().count;
  if (schema !== 2) return [];
  return db.prepare(`
    SELECT a.slug, a.title, a.excerpt
    FROM content_products cp JOIN content_assets a ON a.id = cp.content_asset_id
    WHERE cp.product_id = ? AND a.status = 'PUBLISHED' AND a.index_status = 'INDEX'
      AND a.human_reviewed = 1
    ORDER BY cp.relation_type = 'TARGET' DESC, cp.sort_order, a.published_at DESC, a.title
    LIMIT 6
  `).all(productId).map((article) => ({ ...article, href: `/articles/${article.slug}` }));
}

export function getPublicProductEnrichment(db, productId) {
  if (!hasSchema(db)) return null;
  const set = db.prepare(`
    SELECT * FROM product_enrichment_sets
    WHERE product_id = ? AND status = 'PUBLISHED' ORDER BY version DESC LIMIT 1
  `).get(productId);
  if (!set) return null;
  let model;
  try { model = buildEvidenceModel(db, productId); } catch { return null; }
  if (model.evidenceFingerprint !== set.evidence_fingerprint || model.safety.hardFail) return null;
  const rows = db.prepare(`
    SELECT i.id, i.section_type, i.template_key, i.label, i.body, i.question,
      i.answer, i.related_product_id, i.evidence_checksum, i.sort_order,
      p.slug AS related_slug, p.title AS related_title
    FROM product_enrichment_items i
    LEFT JOIN products p ON p.id = i.related_product_id AND p.draft = 0
    WHERE i.enrichment_set_id = ?
    ORDER BY i.sort_order, i.id
  `).all(set.id);
  const currentChecksums = new Set(model.items.map((item) => item.evidenceChecksum));
  if (rows.length !== model.items.length || rows.some((row) => !currentChecksums.has(row.evidence_checksum))) return null;
  const sections = [];
  for (const sectionType of [...SECTION_ORDER.keys()].filter((value) => value !== "FAQ")) {
    const items = rows.filter((row) => row.section_type === sectionType).map((row) => ({
      id: row.id,
      label: row.label,
      body: row.body,
      relatedProduct: row.related_product_id && row.related_slug ? {
        id: row.related_product_id,
        title: row.related_title,
        href: `/p/${row.related_slug}`,
      } : null,
    }));
    if (items.length) sections.push({ type: sectionType, items });
  }
  const faq = rows.filter((row) => row.section_type === "FAQ").map((row) => ({
    id: row.id,
    question: row.question,
    answer: row.answer,
  }));
  return {
    id: set.id,
    version: set.version,
    productId,
    sections,
    faq,
    articles: publicArticles(db, productId),
    reviewedBy: set.approved_by,
    publishedAt: set.published_at,
  };
}

export function listProductEnrichmentQueue(db, input = {}) {
  const status = cleanText(input.status, 30);
  const limit = Math.max(1, Math.min(500, Math.trunc(Number(input.limit ?? 100))));
  return db.prepare(`
    SELECT e.*, p.slug, p.title FROM product_enrichment_sets e
    JOIN products p ON p.id = e.product_id
    WHERE (? = '' OR e.status = ?)
    ORDER BY e.updated_at DESC, e.product_id LIMIT ?
  `).all(status, status, limit);
}
