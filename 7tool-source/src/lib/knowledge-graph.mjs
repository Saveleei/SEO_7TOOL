import { randomUUID } from "node:crypto";

export const KNOWLEDGE_PREDICATES = new Set([
  "USES", "COMPATIBLE_WITH", "REQUIRES", "ALTERNATIVE_TO", "BETTER_FOR",
  "NOT_RECOMMENDED_FOR", "SUPPORTS", "DRILLS", "CUTS", "BEVELS", "THREADS",
  "MOUNTS_ON", "HAS_SHANK", "HAS_DIAMETER", "HAS_DEPTH", "USES_ACCESSORY",
]);

function typedValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { value_text: null, value_number: value, value_json: null };
  }
  if (typeof value === "string" && value.trim()) {
    return { value_text: value.trim(), value_number: null, value_json: null };
  }
  if (value !== undefined && value !== null && typeof value === "object") {
    return { value_text: null, value_number: null, value_json: JSON.stringify(value) };
  }
  return { value_text: null, value_number: null, value_json: null };
}

function verifiedAssertion(db, assertionId) {
  const row = db.prepare(`
    SELECT id, subject_type, subject_id, predicate, value_text, value_number, unit, value_json,
      verification_status, verified_by, verified_at
    FROM fact_assertions WHERE id = ?
  `).get(assertionId);
  if (!row || row.verification_status !== "VERIFIED" || !row.verified_by || !row.verified_at) {
    throw new Error(`Assertion ${assertionId} is not VERIFIED`);
  }
  return row;
}

function evidenceRows(db, ids) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  return db.prepare(`
    SELECT sf.id, sf.subject_type, sf.subject_id, sf.status, s.rights_policy
    FROM source_facts sf JOIN sources s ON s.id = sf.source_id
    WHERE sf.id IN (${placeholders})
  `).all(...ids);
}

export function createFactAssertion(db, input) {
  const status = input.verificationStatus ?? "FACT_REQUIRED";
  const evidenceIds = [...new Set(input.evidenceSourceFactIds ?? [])];
  const value = typedValue(input.value);
  if (status !== "FACT_REQUIRED" && value.value_text === null && value.value_number === null && value.value_json === null) {
    throw new Error("A sourced assertion requires a typed value");
  }
  const evidence = evidenceRows(db, evidenceIds);
  if ((status === "SOURCED" || status === "VERIFIED") && evidence.length !== evidenceIds.length) {
    throw new Error("Every sourced assertion needs existing evidence");
  }
  if (status === "VERIFIED") {
    if (!input.verifiedBy) throw new Error("VERIFIED assertions require a real reviewer id");
    if (!evidence.length) throw new Error("VERIFIED assertions require evidence");
    if (!evidence.some((row) => row.subject_type === input.subjectType && row.subject_id === input.subjectId)) {
      throw new Error("VERIFIED assertion needs evidence for the same subject");
    }
    if (evidence.some((row) => row.rights_policy !== "PUBLISHABLE_FACTS" || row.status === "REJECTED")) {
      throw new Error("Evidence source is not approved for publishable facts");
    }
  }

  const id = input.id ?? randomUUID();
  const now = Date.now();
  db.transaction(() => {
    db.prepare(`
      INSERT INTO fact_assertions (
        id, subject_type, subject_id, predicate, value_text, value_number, unit, value_json,
        verification_status, confidence, verified_by, verified_at, valid_from, valid_to,
        supersedes_id, notes, created_at, updated_at
      ) VALUES (
        @id, @subject_type, @subject_id, @predicate, @value_text, @value_number, @unit, @value_json,
        @verification_status, @confidence, @verified_by, @verified_at, @valid_from, @valid_to,
        @supersedes_id, @notes, @created_at, @updated_at
      )
    `).run({
      id, subject_type: input.subjectType, subject_id: input.subjectId, predicate: input.predicate,
      ...value, unit: input.unit ?? null, verification_status: status,
      confidence: input.confidence ?? null, verified_by: input.verifiedBy ?? null,
      verified_at: status === "VERIFIED" ? now : null, valid_from: input.validFrom ?? null,
      valid_to: input.validTo ?? null, supersedes_id: input.supersedesId ?? null,
      notes: input.notes ?? null, created_at: now, updated_at: now,
    });
    const insertEvidence = db.prepare(`
      INSERT INTO fact_evidence (assertion_id, source_fact_id, evidence_role, created_at)
      VALUES (?, ?, ?, ?)
    `);
    for (const sourceFactId of evidenceIds) insertEvidence.run(id, sourceFactId, "PRIMARY", now);
    if (input.supersedesId) {
      db.prepare("UPDATE fact_assertions SET verification_status = 'SUPERSEDED', updated_at = ? WHERE id = ?")
        .run(now, input.supersedesId);
    }
  })();
  return id;
}

export function addKnowledgeRelation(db, input) {
  if (!KNOWLEDGE_PREDICATES.has(input.predicate)) throw new Error(`Unsupported predicate: ${input.predicate}`);
  if (input.subjectType === input.objectType && input.subjectId === input.objectId) {
    throw new Error("Self-relations are forbidden");
  }
  const assertion = verifiedAssertion(db, input.assertionId);
  if (assertion.subject_type !== input.subjectType || assertion.subject_id !== input.subjectId || assertion.predicate !== input.predicate) {
    throw new Error("Relation does not match its verified assertion");
  }
  const id = input.id ?? randomUUID();
  const now = Date.now();
  db.prepare(`
    INSERT INTO knowledge_relations (
      id, subject_type, subject_id, predicate, object_type, object_id, assertion_id,
      verification_status, valid_from, valid_to, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'VERIFIED', ?, ?, ?, ?)
  `).run(id, input.subjectType, input.subjectId, input.predicate, input.objectType,
    input.objectId, input.assertionId, input.validFrom ?? null, input.validTo ?? null, now, now);
  return id;
}

export function listVerifiedRelations(db, subjectType, subjectId, at = Date.now()) {
  return db.prepare(`
    SELECT kr.* FROM knowledge_relations kr
    JOIN fact_assertions fa ON fa.id = kr.assertion_id
    WHERE kr.subject_type = ? AND kr.subject_id = ?
      AND kr.verification_status = 'VERIFIED' AND fa.verification_status = 'VERIFIED'
      AND (kr.valid_from IS NULL OR kr.valid_from <= ?)
      AND (kr.valid_to IS NULL OR kr.valid_to > ?)
    ORDER BY kr.predicate, kr.object_type, kr.object_id
  `).all(subjectType, subjectId, at, at);
}

export function addVerifiedProductFeature(db, input) {
  const assertion = verifiedAssertion(db, input.assertionId);
  if (assertion.subject_type !== "PRODUCT" || assertion.subject_id !== input.productId) {
    throw new Error("Feature assertion must target the same product");
  }
  const id = input.id ?? randomUUID();
  const now = Date.now();
  db.prepare(`
    INSERT INTO product_features (
      id, product_id, variant_id, feature_key, value_text, value_number, unit, value_json,
      assertion_id, status, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
  `).run(id, input.productId, input.variantId ?? null, input.featureKey,
    assertion.value_text, assertion.value_number, assertion.unit, assertion.value_json,
    input.assertionId, input.sortOrder ?? 0, now, now);
  return id;
}

export function addVerifiedProductApplication(db, input) {
  const allowed = {
    SUPPORTED: "SUPPORTS", BETTER_FOR: "BETTER_FOR", NOT_RECOMMENDED: "NOT_RECOMMENDED_FOR",
  };
  const expectedPredicate = allowed[input.suitability];
  if (!expectedPredicate) throw new Error("UNKNOWN application suitability cannot be published");
  const assertion = verifiedAssertion(db, input.assertionId);
  if (assertion.subject_type !== "PRODUCT" || assertion.subject_id !== input.productId || assertion.predicate !== expectedPredicate) {
    throw new Error("Application does not match its verified assertion");
  }
  const id = input.id ?? randomUUID();
  const now = Date.now();
  db.prepare(`
    INSERT INTO product_applications (
      id, product_id, application_key, suitability, assertion_id, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
  `).run(id, input.productId, input.applicationKey, input.suitability, input.assertionId, now, now);
  return id;
}

function normalizedPair(productAId, productBId) {
  if (!productAId || !productBId || productAId === productBId) throw new Error("Compatibility requires two different products");
  return productAId.localeCompare(productBId) <= 0 ? [productAId, productBId] : [productBId, productAId];
}

export function setVerifiedCompatibility(db, input) {
  if (input.compatibilityStatus === "UNKNOWN") throw new Error("UNKNOWN compatibility cannot be verified");
  const assertion = verifiedAssertion(db, input.assertionId);
  if (assertion.predicate !== "COMPATIBLE_WITH") throw new Error("Compatibility requires a COMPATIBLE_WITH assertion");
  const [productAId, productBId] = normalizedPair(input.productAId, input.productBId);
  if (assertion.subject_type !== "PRODUCT" || assertion.subject_id !== productAId) {
    throw new Error("Compatibility assertion must target normalized product A");
  }
  const id = input.id ?? randomUUID();
  const now = Date.now();
  db.prepare(`
    INSERT INTO product_compatibility (
      id, product_a_id, product_b_id, compatibility_type, compatibility_status,
      assertion_id, verified, verified_by, verified_at, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    ON CONFLICT(product_a_id, product_b_id, compatibility_type) DO UPDATE SET
      compatibility_status = excluded.compatibility_status, assertion_id = excluded.assertion_id,
      verified = 1, verified_by = excluded.verified_by, verified_at = excluded.verified_at,
      notes = excluded.notes, updated_at = excluded.updated_at
  `).run(id, productAId, productBId, input.compatibilityType, input.compatibilityStatus,
    input.assertionId, assertion.verified_by, assertion.verified_at, input.notes ?? null, now, now);
  return { productAId, productBId, compatibilityType: input.compatibilityType };
}

export function listVerifiedCompatibility(db, productId) {
  return db.prepare(`
    SELECT pc.* FROM product_compatibility pc
    JOIN fact_assertions fa ON fa.id = pc.assertion_id
    WHERE (pc.product_a_id = ? OR pc.product_b_id = ?)
      AND pc.verified = 1 AND fa.verification_status = 'VERIFIED'
    ORDER BY pc.compatibility_type, pc.product_a_id, pc.product_b_id
  `).all(productId, productId);
}
