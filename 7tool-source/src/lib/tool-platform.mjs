import { createHash, randomUUID } from "node:crypto";

export const TOOL_PLATFORM_ENGINE_VERSION = "interactive-tools-v1";

const ACTOR_TYPES = new Set(["HUMAN", "SYSTEM", "AI_ASSISTED"]);
const SELECTOR_TYPES = new Set([
  "MAGNETIC_DRILL_SELECTOR", "BEVELER_SELECTOR", "PIPE_CUTTER_SELECTOR",
]);
const SELECTOR_CATEGORIES = Object.freeze({
  MAGNETIC_DRILL_SELECTOR: ["stanki-sverlilnye"],
  BEVELER_SELECTOR: ["kromkorezy-po-listu", "kromkorezy-dlya-trub"],
  PIPE_CUTTER_SELECTOR: ["truborezy"],
});

const BLUEPRINTS = Object.freeze({
  ANNULAR_CUTTER_RPM: {
    toolKey: "annular-cutter-rpm",
    slug: "annular-cutter-rpm",
    title: "Калькулятор оборотов корончатого сверла",
    h1: "Расчёт оборотов корончатого сверла",
    metaTitle: "Калькулятор оборотов корончатого сверла",
    metaDescription: "Расчёт оборотов по диаметру, типу коронки и материалу на основе проверенных скоростей резания.",
    description: "Результат рассчитывается по проверенной скорости резания для выбранной пары «тип коронки — материал». Если такой пары нет, расчёт не выполняется.",
  },
  MAGNETIC_DRILL_SELECTOR: {
    toolKey: "magnetic-drill-selector",
    slug: "magnetic-drill-selector",
    title: "Подбор магнитного сверлильного станка",
    h1: "Подбор магнитного станка по задаче",
    metaTitle: "Подбор магнитного сверлильного станка",
    metaDescription: "Подбор магнитных станков по проверенным диаметру, глубине, материалу, резьбе и массе.",
    description: "Фильтр сопоставляет требования только с проверенными характеристиками опубликованных товаров. Отсутствующая характеристика не считается подходящей.",
  },
  BEVELER_SELECTOR: {
    toolKey: "beveler-selector",
    slug: "beveler-selector",
    title: "Подбор кромкореза",
    h1: "Подбор кромкореза по заготовке",
    metaTitle: "Подбор кромкореза по параметрам",
    metaDescription: "Подбор кромкореза по типу заготовки, толщине, углу, ширине фаски и материалу.",
    description: "Результаты формируются только из проверенных параметров оборудования; неполные модели не выдаются как подтверждённое совпадение.",
  },
  PIPE_CUTTER_SELECTOR: {
    toolKey: "pipe-cutter-selector",
    slug: "pipe-cutter-selector",
    title: "Подбор трубореза",
    h1: "Подбор трубореза по параметрам трубы",
    metaTitle: "Подбор трубореза по диаметру и стенке",
    metaDescription: "Подбор трубореза по диаметру, толщине стенки, материалу и применению на основе проверенных данных.",
    description: "Сервис показывает только товары, для которых требуемые параметры подтверждены в Fact Layer.",
  },
  COMPATIBILITY_TABLE: {
    toolKey: "compatibility-table",
    slug: "compatibility-table",
    title: "Таблица совместимости оборудования и оснастки",
    h1: "Проверенная совместимость оборудования и оснастки",
    metaTitle: "Таблица совместимости оборудования и оснастки",
    metaDescription: "Динамическая таблица совместимости с проверенными хвостовиками, диаметрами, глубиной и применением.",
    description: "В таблицу входят только опубликованные товары и подтверждённые связи со статусом COMPATIBLE.",
  },
});

const SELECTOR_CRITERIA = Object.freeze({
  MAGNETIC_DRILL_SELECTOR: [
    { name: "diameter", label: "Диаметр", capability: "maxDiameter", operator: "NUMBER_GTE", unit: "мм" },
    { name: "depth", label: "Глубина", capability: "maxDepth", operator: "NUMBER_GTE", unit: "мм" },
    { name: "material", label: "Материал", capability: "materials", operator: "INCLUDES" },
    { name: "threadRequirement", label: "Требование к резьбе", capability: "threadRequirements", operator: "INCLUDES" },
    { name: "weightLimit", label: "Ограничение по массе", capability: "weight", operator: "NUMBER_LTE", unit: "кг" },
  ],
  BEVELER_SELECTOR: [
    { name: "workpiece", label: "Плита или труба", capability: "workpieceTypes", operator: "INCLUDES" },
    { name: "thickness", label: "Толщина", capability: "maxThickness", operator: "NUMBER_GTE", unit: "мм" },
    { name: "angle", label: "Угол фаски", capability: "angleRange", operator: "RANGE_CONTAINS", unit: "°" },
    { name: "bevelWidth", label: "Ширина фаски", capability: "maxBevelWidth", operator: "NUMBER_GTE", unit: "мм" },
    { name: "material", label: "Материал", capability: "materials", operator: "INCLUDES" },
  ],
  PIPE_CUTTER_SELECTOR: [
    { name: "diameter", label: "Диаметр трубы", capability: "maxPipeDiameter", operator: "NUMBER_GTE", unit: "мм" },
    { name: "wallThickness", label: "Толщина стенки", capability: "maxWallThickness", operator: "NUMBER_GTE", unit: "мм" },
    { name: "material", label: "Материал", capability: "materials", operator: "INCLUDES" },
    { name: "application", label: "Применение", capability: "applications", operator: "INCLUDES" },
  ],
});

const FEATURE_ALIASES = new Map();
function aliases(capability, values) {
  for (const value of values) FEATURE_ALIASES.set(normalize(value), capability);
}
aliases("maxDiameter", ["max diameter", "max_diameter", "максимальный диаметр", "максимальный диаметр сверления", "максимальный диаметр корончатого сверления"]);
aliases("maxDepth", ["max depth", "max_depth", "максимальная глубина", "максимальная глубина сверления"]);
aliases("materials", ["material", "materials", "материал", "обрабатываемый материал", "обрабатываемые материалы"]);
aliases("threadRequirements", ["thread requirement", "thread_requirement", "резьба", "нарезание резьбы", "требование к резьбе"]);
aliases("weight", ["weight", "масса", "вес", "масса оборудования"]);
aliases("workpieceTypes", ["workpiece type", "workpiece_type", "тип заготовки", "плита или труба"]);
aliases("maxThickness", ["max thickness", "max_thickness", "максимальная толщина", "толщина заготовки"]);
aliases("angleMin", ["min angle", "angle_min", "минимальный угол", "минимальный угол фаски"]);
aliases("angleMax", ["max angle", "angle_max", "максимальный угол", "максимальный угол фаски"]);
aliases("maxBevelWidth", ["max bevel width", "max_bevel_width", "максимальная ширина фаски", "ширина фаски"]);
aliases("maxPipeDiameter", ["max pipe diameter", "max_pipe_diameter", "максимальный диаметр трубы"]);
aliases("maxWallThickness", ["max wall thickness", "max_wall_thickness", "максимальная толщина стенки", "толщина стенки"]);
aliases("shank", ["shank", "хвостовик", "тип хвостовика"]);

function clean(value, max = 500) {
  return typeof value === "string" ? value.trim().replace(/\s+/gu, " ").slice(0, max) : "";
}

function normalize(value) {
  return clean(String(value ?? ""), 300).toLocaleLowerCase("ru").replaceAll("ё", "е")
    .replace(/[_/\\-]+/gu, " ").replace(/[^\p{L}\p{N}.]+/gu, " ").trim().replace(/\s+/gu, " ");
}

function normalizeUnit(value) {
  return clean(String(value ?? ""), 30).toLocaleLowerCase("ru").replace(/\s+/gu, "");
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
  return db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'interactive_tool_sets'").get() !== undefined;
}

function blueprint(toolType) {
  const item = BLUEPRINTS[clean(toolType, 60)];
  if (!item) throw new Error("Unsupported interactive tool type");
  return item;
}

function assertionSnapshot(db, assertionId, at = Date.now()) {
  const assertion = db.prepare(`
    SELECT id, subject_type, subject_id, predicate, value_text, value_number, unit,
      value_json, verification_status, verified_by, verified_at, valid_from, valid_to
    FROM fact_assertions WHERE id = ?
  `).get(assertionId);
  if (!assertion || assertion.verification_status !== "VERIFIED" || !assertion.verified_by || !assertion.verified_at) return null;
  if ((assertion.valid_from !== null && assertion.valid_from > at) || (assertion.valid_to !== null && assertion.valid_to <= at)) return null;
  const evidence = db.prepare(`
    SELECT fe.evidence_role, sf.subject_type, sf.subject_id, sf.predicate, sf.checksum,
      sf.status, s.id AS source_id, s.rights_policy, s.active
    FROM fact_evidence fe
    JOIN source_facts sf ON sf.id = fe.source_fact_id
    JOIN sources s ON s.id = sf.source_id
    WHERE fe.assertion_id = ? ORDER BY sf.id
  `).all(assertionId);
  if (!evidence.length || evidence.some((row) => row.evidence_role === "CONFLICTING"
    || !new Set(["OBSERVED", "VALID"]).has(row.status)
    || row.rights_policy !== "PUBLISHABLE_FACTS" || row.active !== 1
    || row.subject_type !== assertion.subject_type || row.subject_id !== assertion.subject_id
    || row.predicate !== assertion.predicate)) return null;
  const snapshotChecksum = hash({
    assertion: {
      id: assertion.id, subjectType: assertion.subject_type, subjectId: assertion.subject_id,
      predicate: assertion.predicate, valueText: assertion.value_text,
      valueNumber: assertion.value_number, unit: assertion.unit, valueJson: assertion.value_json,
      verifiedBy: assertion.verified_by, verifiedAt: assertion.verified_at,
      validFrom: assertion.valid_from, validTo: assertion.valid_to,
    },
    evidence: evidence.map((row) => ({
      role: row.evidence_role, checksum: row.checksum, status: row.status,
      sourceId: row.source_id, rightsPolicy: row.rights_policy, active: row.active,
    })),
  });
  return { ...assertion, snapshotChecksum };
}

function normalizeRpmRules(db, tool, rawRules, at = Date.now()) {
  if (!Array.isArray(rawRules) || !rawRules.length) throw new Error("RPM calculator requires at least one reviewed cutting-speed rule");
  const seen = new Set();
  return rawRules.map((raw, index) => {
    const cutterType = clean(raw.cutterType, 120);
    const material = clean(raw.material, 120);
    const cuttingSpeed = Number(raw.cuttingSpeed);
    const assertionId = clean(raw.assertionId, 200);
    if (!cutterType || !material || !Number.isFinite(cuttingSpeed) || cuttingSpeed <= 0 || cuttingSpeed > 1000 || !assertionId) {
      throw new Error("Every RPM rule requires cutterType, material, a positive cuttingSpeed and assertionId");
    }
    const key = `${normalize(cutterType)}\u0000${normalize(material)}`;
    if (seen.has(key)) throw new Error("Duplicate cutter type/material RPM rule");
    seen.add(key);
    const assertion = assertionSnapshot(db, assertionId, at);
    const expectedSubject = `${tool.toolKey}:${normalize(cutterType).replaceAll(" ", "-")}:${normalize(material).replaceAll(" ", "-")}`;
    if (!assertion || assertion.subject_type !== "TOOL_RULE" || assertion.subject_id !== expectedSubject
      || assertion.predicate !== "CUTTING_SPEED_M_PER_MIN" || assertion.value_number !== cuttingSpeed
      || normalizeUnit(assertion.unit) !== "m/min") {
      throw new Error(`RPM rule ${cutterType}/${material} is not backed by a matching current VERIFIED assertion`);
    }
    return {
      ruleType: "CUTTING_SPEED_M_PER_MIN", cutterType, material, outputValue: cuttingSpeed,
      outputUnit: "m/min", assertionId, assertionSnapshotChecksum: assertion.snapshotChecksum,
      evidenceChecksum: hash({ key, cuttingSpeed, assertion: assertion.snapshotChecksum }), sortOrder: index,
    };
  }).sort((left, right) => left.cutterType.localeCompare(right.cutterType, "ru") || left.material.localeCompare(right.material, "ru"));
}

function modelFromInput(db, input, at = Date.now()) {
  const toolType = clean(input.toolType, 60);
  const tool = blueprint(toolType);
  const indexStatus = input.indexStatus === "INDEX" ? "INDEX" : "NOINDEX";
  const opportunityId = clean(input.opportunityId, 200) || null;
  if (indexStatus === "INDEX" && !opportunityId) {
    throw new Error("INDEX tools require an explicit reviewed content opportunity");
  }
  if (opportunityId) {
    const opportunity = db.prepare(`
      SELECT status, decision, recommended_page_type, cannibalization_risk
      FROM content_opportunities WHERE id = ?
    `).get(opportunityId);
    const allowedPageTypes = toolType === "COMPATIBILITY_TABLE"
      ? new Set(["TABLE", "COMPATIBILITY"])
      : new Set(["CALCULATOR"]);
    if (!opportunity || opportunity.status !== "REVIEWED" || opportunity.decision !== "CREATE"
      || opportunity.cannibalization_risk !== "LOW" || !allowedPageTypes.has(opportunity.recommended_page_type)) {
      throw new Error("Interactive tool opportunity must be REVIEWED CREATE with LOW cannibalization and a matching page type");
    }
  }
  const rules = toolType === "ANNULAR_CUTTER_RPM" ? normalizeRpmRules(db, tool, input.rules, at) : [];
  if (toolType !== "ANNULAR_CUTTER_RPM" && Array.isArray(input.rules) && input.rules.length) {
    throw new Error("Selectors and compatibility tables read live VERIFIED product facts and do not accept manual rules");
  }
  const fingerprint = hash({ toolType, tool, indexStatus, opportunityId, engineVersion: TOOL_PLATFORM_ENGINE_VERSION, rules: rules.map((rule) => rule.evidenceChecksum) });
  return { toolType, tool, indexStatus, opportunityId, rules, evidenceFingerprint: fingerprint };
}

function setRow(db, setId) {
  const row = db.prepare("SELECT * FROM interactive_tool_sets WHERE id = ?").get(setId);
  if (!row) throw new Error("Interactive tool set not found");
  return row;
}

function currentModel(db, set) {
  const rules = db.prepare(`
    SELECT cutter_type AS cutterType, material, output_value AS cuttingSpeed,
      assertion_id AS assertionId FROM interactive_tool_rules
    WHERE tool_set_id = ? ORDER BY cutter_type, material, sort_order
  `).all(set.id);
  const model = modelFromInput(db, {
    toolType: set.tool_type, indexStatus: set.index_status,
    opportunityId: set.opportunity_id, rules,
  });
  const storedChecksums = db.prepare(`SELECT evidence_checksum AS checksum FROM interactive_tool_rules WHERE tool_set_id = ? ORDER BY evidence_checksum`).all(set.id).map((row) => row.checksum);
  const currentChecksums = model.rules.map((rule) => rule.evidenceChecksum).sort();
  if (canonical(storedChecksums) !== canonical(currentChecksums) || model.evidenceFingerprint !== set.evidence_fingerprint) {
    throw new Error("Interactive tool set no longer matches current verified evidence");
  }
  return model;
}

function audit(db, { set, action, actor, details = {}, now }) {
  db.prepare(`
    INSERT INTO interactive_tool_audit_events (
      id, tool_set_id, tool_key, action, actor_type, actor_id, details_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), set.id, set.tool_key, action, actor.actorType, actor.actorId, canonical(details), now);
}

function review(db, { set, decision, actor, notes, now }) {
  db.prepare(`
    INSERT INTO interactive_tool_reviews (
      id, tool_set_id, decision, reviewer_type, reviewer_id,
      evidence_fingerprint, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), set.id, decision, actor.actorType, actor.actorId, set.evidence_fingerprint,
    clean(notes, 2000) || `${decision} after verified-data review`, now);
}

export function createInteractiveToolDraft(db, input) {
  if (!hasSchema(db)) throw new Error("Interactive Tools schema is missing; apply migration 010 first");
  const actor = actorFrom(input);
  const model = modelFromInput(db, input);
  const existing = db.prepare("SELECT * FROM interactive_tool_sets WHERE tool_key = ? AND evidence_fingerprint = ?")
    .get(model.tool.toolKey, model.evidenceFingerprint);
  if (existing) return { set: existing, duplicate: true };
  const version = db.prepare("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM interactive_tool_sets WHERE tool_key = ?")
    .get(model.tool.toolKey).version;
  const setId = `interactive-tool-${hash(`${model.tool.toolKey}\u0000${model.evidenceFingerprint}`).slice(0, 24)}`;
  const now = Date.now();
  db.transaction(() => {
    db.prepare(`
      INSERT INTO interactive_tool_sets (
        id, tool_key, version, tool_type, slug, title, h1, meta_title, meta_description,
        description, status, index_status, opportunity_id, engine_version,
        evidence_fingerprint, generated_by_actor_type, generated_by_actor_id,
        generated_by_ai, rule_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      setId, model.tool.toolKey, version, model.toolType, model.tool.slug, model.tool.title,
      model.tool.h1, model.tool.metaTitle, model.tool.metaDescription, model.tool.description,
      model.indexStatus, model.opportunityId, TOOL_PLATFORM_ENGINE_VERSION, model.evidenceFingerprint,
      actor.actorType, actor.actorId, actor.actorType === "AI_ASSISTED" ? 1 : 0,
      model.rules.length, now, now,
    );
    const insert = db.prepare(`
      INSERT INTO interactive_tool_rules (
        id, tool_set_id, rule_type, cutter_type, material, output_value, output_unit,
        assertion_id, evidence_checksum, sort_order, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    model.rules.forEach((rule, index) => insert.run(
      `interactive-rule-${hash(`${setId}\u0000${rule.evidenceChecksum}`).slice(0, 24)}`,
      setId, rule.ruleType, rule.cutterType, rule.material, rule.outputValue, rule.outputUnit,
      rule.assertionId, rule.evidenceChecksum, index, now,
    ));
    audit(db, { set: { id: setId, tool_key: model.tool.toolKey }, action: "DRAFT_CREATED", actor, details: { version, ruleCount: model.rules.length }, now });
  })();
  return { set: setRow(db, setId), duplicate: false };
}

export function approveInteractiveTool(db, input) {
  const actor = requireHuman(input, "Interactive tool approval");
  const set = setRow(db, clean(input.setId, 200));
  if (set.status === "APPROVED") return set;
  if (set.status !== "DRAFT") throw new Error("Only a DRAFT interactive tool can be approved");
  currentModel(db, set);
  const now = Date.now();
  db.transaction(() => {
    db.prepare("UPDATE interactive_tool_sets SET status = 'APPROVED', approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?")
      .run(actor.actorId, now, now, set.id);
    review(db, { set, decision: "APPROVE", actor, notes: input.notes, now });
    audit(db, { set, action: "APPROVED", actor, now });
  })();
  return setRow(db, set.id);
}

export function publishInteractiveTool(db, input) {
  const actor = requireHuman(input, "Interactive tool publication");
  const set = setRow(db, clean(input.setId, 200));
  if (set.status === "PUBLISHED") return set;
  if (set.status !== "APPROVED") throw new Error("Only an APPROVED interactive tool can be published");
  currentModel(db, set);
  const now = Date.now();
  db.transaction(() => {
    db.prepare("UPDATE interactive_tool_sets SET status = 'SUPERSEDED', updated_at = ? WHERE tool_key = ? AND status = 'PUBLISHED' AND id != ?")
      .run(now, set.tool_key, set.id);
    db.prepare("UPDATE interactive_tool_sets SET status = 'PUBLISHED', published_by = ?, published_at = ?, updated_at = ? WHERE id = ?")
      .run(actor.actorId, now, now, set.id);
    review(db, { set, decision: "PUBLISH", actor, notes: input.notes, now });
    audit(db, { set, action: "PUBLISHED", actor, now });
  })();
  return setRow(db, set.id);
}

export function rejectInteractiveTool(db, input) {
  const actor = requireHuman(input, "Interactive tool rejection");
  const set = setRow(db, clean(input.setId, 200));
  if (set.status === "REJECTED") return set;
  if (!new Set(["DRAFT", "APPROVED"]).has(set.status)) throw new Error("Only a DRAFT or APPROVED interactive tool can be rejected");
  const now = Date.now();
  db.transaction(() => {
    db.prepare("UPDATE interactive_tool_sets SET status = 'REJECTED', updated_at = ? WHERE id = ?").run(now, set.id);
    review(db, { set, decision: "REJECT", actor, notes: input.notes, now });
    audit(db, { set, action: "REJECTED", actor, now });
  })();
  return setRow(db, set.id);
}

export function markStaleInteractiveTools(db, input) {
  const actor = actorFrom(input);
  if (!new Set(["HUMAN", "SYSTEM"]).has(actor.actorType)) throw new Error("Stale scan requires a HUMAN or SYSTEM actor");
  const toolKey = clean(input.toolKey, 100);
  const sets = db.prepare("SELECT * FROM interactive_tool_sets WHERE status = 'PUBLISHED' AND (? = '' OR tool_key = ?) ORDER BY tool_key")
    .all(toolKey, toolKey);
  const staleSetIds = [];
  const now = Date.now();
  for (const set of sets) {
    try { currentModel(db, set); continue; } catch { /* mark below */ }
    db.transaction(() => {
      db.prepare("UPDATE interactive_tool_sets SET status = 'STALE', updated_at = ? WHERE id = ?").run(now, set.id);
      review(db, { set, decision: "MARK_STALE", actor, notes: input.notes || "Verified tool evidence changed", now });
      audit(db, { set, action: "MARKED_STALE", actor, now });
    })();
    staleSetIds.push(set.id);
  }
  return { checked: sets.length, staleSetIds };
}

function publicProductWhere(alias) {
  return `${alias}.draft = 0
    AND EXISTS (SELECT 1 FROM categories public_category WHERE public_category.slug = ${alias}.category AND public_category.published = 1)
    AND (${alias}.images != '[]' OR EXISTS (
      SELECT 1 FROM variants public_variant WHERE public_variant.product_id = ${alias}.id
        AND COALESCE(public_variant.images, '[]') != '[]'
    ))`;
}

function parsedValues(row) {
  if (row.value_number !== null && Number.isFinite(row.value_number)) return row.value_number;
  if (row.value_json) {
    try {
      const value = JSON.parse(row.value_json);
      if (Array.isArray(value)) return value.map((item) => clean(String(item), 120)).filter(Boolean);
    } catch { /* fall through */ }
  }
  return clean(row.value_text, 300).split(/[;,|]/u).map((item) => clean(item, 120)).filter(Boolean);
}

function acceptedNumericUnit(capability, unit) {
  const normalized = normalizeUnit(unit);
  if (new Set(["maxDiameter", "maxDepth", "maxThickness", "maxBevelWidth", "maxPipeDiameter", "maxWallThickness"]).has(capability)) {
    return new Set(["mm", "мм"]).has(normalized);
  }
  if (capability === "weight") return new Set(["kg", "кг"]).has(normalized);
  if (new Set(["angleMin", "angleMax"]).has(capability)) return new Set(["deg", "degree", "degrees", "град", "градус", "°"]).has(normalized);
  return false;
}

function selectorDataset(db, toolType) {
  if (!SELECTOR_TYPES.has(toolType)) return [];
  const categories = SELECTOR_CATEGORIES[toolType];
  const categoryPlaceholders = categories.map(() => "?").join(",");
  const rows = db.prepare(`
    SELECT pf.product_id, pf.feature_key, pf.value_text, pf.value_number, pf.value_json,
      pf.unit, pf.assertion_id, p.slug, p.title, p.brand, p.category
    FROM product_features pf JOIN products p ON p.id = pf.product_id
    WHERE pf.status = 'ACTIVE' AND p.category IN (${categoryPlaceholders})
      AND ${publicProductWhere("p")}
    ORDER BY pf.product_id, pf.sort_order, pf.feature_key, pf.assertion_id
  `).all(...categories);
  const byProduct = new Map();
  const assertionCache = new Map();
  for (const row of rows) {
    const capability = FEATURE_ALIASES.get(normalize(row.feature_key));
    if (!capability) continue;
    let assertion = assertionCache.get(row.assertion_id);
    if (assertion === undefined) {
      assertion = assertionSnapshot(db, row.assertion_id);
      assertionCache.set(row.assertion_id, assertion);
    }
    if (!assertion || assertion.subject_type !== "PRODUCT" || assertion.subject_id !== row.product_id) continue;
    const value = parsedValues(row);
    if (typeof value === "number" && !acceptedNumericUnit(capability, row.unit)) continue;
    if (Array.isArray(value) && !value.length) continue;
    const product = byProduct.get(row.product_id) ?? {
      id: row.product_id, slug: row.slug, title: row.title, brand: row.brand || "", category: row.category,
      facts: {}, conflictCapabilities: new Set(),
    };
    const signature = canonical({ value, unit: row.unit });
    const existing = product.facts[capability];
    if (existing && existing.signature !== signature) {
      product.conflictCapabilities.add(capability);
      delete product.facts[capability];
    } else if (!product.conflictCapabilities.has(capability)) {
      product.facts[capability] = {
        value, unit: row.unit || "", label: row.feature_key, display: Array.isArray(value) ? value.join(", ") : `${value}${row.unit ? ` ${row.unit}` : ""}`,
        assertionIds: [...new Set([...(existing?.assertionIds ?? []), row.assertion_id])], signature,
      };
    }
    byProduct.set(row.product_id, product);
  }
  const applications = db.prepare(`
    SELECT pa.product_id, pa.application_key, pa.assertion_id
    FROM product_applications pa JOIN products p ON p.id = pa.product_id
    WHERE pa.status = 'ACTIVE' AND pa.suitability IN ('SUPPORTED', 'BETTER_FOR')
      AND p.category IN (${categoryPlaceholders})
      AND ${publicProductWhere("p")}
    ORDER BY pa.product_id, pa.application_key
  `).all(...categories);
  for (const row of applications) {
    const product = byProduct.get(row.product_id);
    if (!product) continue;
    let assertion = assertionCache.get(row.assertion_id);
    if (assertion === undefined) {
      assertion = assertionSnapshot(db, row.assertion_id);
      assertionCache.set(row.assertion_id, assertion);
    }
    if (!assertion || assertion.subject_type !== "PRODUCT" || assertion.subject_id !== row.product_id) continue;
    const existing = product.facts.applications ?? { value: [], unit: "", label: "Применение", display: "", assertionIds: [], signature: "" };
    existing.value = [...new Set([...existing.value, row.application_key])];
    existing.display = existing.value.join(", ");
    existing.assertionIds = [...new Set([...existing.assertionIds, row.assertion_id])];
    existing.signature = canonical(existing.value);
    product.facts.applications = existing;
  }
  return [...byProduct.values()].map((product) => {
    product.conflictCapabilities.forEach((capability) => delete product.facts[capability]);
    delete product.conflictCapabilities;
    for (const fact of Object.values(product.facts)) delete fact.signature;
    return product;
  }).sort((left, right) => left.title.localeCompare(right.title, "ru"));
}

function includesValue(candidate, requested) {
  const values = Array.isArray(candidate) ? candidate : [candidate];
  return values.some((value) => normalize(value) === normalize(requested));
}

export function filterSelectorProducts(products, criteria, inputs = {}) {
  const active = criteria.filter((criterion) => clean(String(inputs[criterion.name] ?? ""), 120));
  if (!active.length) return products;
  return products.filter((product) => active.every((criterion) => {
    const fact = product.facts[criterion.capability];
    if (criterion.operator === "RANGE_CONTAINS") {
      const min = product.facts.angleMin?.value;
      const max = product.facts.angleMax?.value;
      const requested = Number(inputs[criterion.name]);
      return Number.isFinite(requested) && typeof min === "number" && typeof max === "number" && min <= requested && max >= requested;
    }
    if (!fact) return false;
    if (criterion.operator === "INCLUDES") return includesValue(fact.value, inputs[criterion.name]);
    const requested = Number(inputs[criterion.name]);
    if (!Number.isFinite(requested) || typeof fact.value !== "number") return false;
    if (criterion.operator === "NUMBER_GTE") return fact.value >= requested;
    if (criterion.operator === "NUMBER_LTE") return fact.value <= requested;
    return false;
  }));
}

export function selectVerifiedProducts(db, toolType, inputs = {}) {
  const criteria = SELECTOR_CRITERIA[toolType];
  if (!criteria) throw new Error("Tool type is not a selector");
  return filterSelectorProducts(selectorDataset(db, toolType), criteria, inputs);
}

function compatibilityRows(db) {
  const rows = db.prepare(`
    SELECT pc.id, pc.product_a_id, pc.product_b_id, pc.compatibility_type,
      pc.assertion_id, direction.assertion_id AS direction_assertion_id,
      equipment.id AS product_id, equipment.slug AS product_slug, equipment.title AS product_title,
      accessory.id AS accessory_id, accessory.slug AS accessory_slug, accessory.title AS accessory_title
    FROM product_compatibility pc
    JOIN knowledge_relations direction
      ON direction.subject_type = 'PRODUCT' AND direction.object_type = 'PRODUCT'
      AND direction.predicate = 'USES_ACCESSORY' AND direction.verification_status = 'VERIFIED'
      AND ((direction.subject_id = pc.product_a_id AND direction.object_id = pc.product_b_id)
        OR (direction.subject_id = pc.product_b_id AND direction.object_id = pc.product_a_id))
    JOIN products equipment ON equipment.id = direction.subject_id
    JOIN products accessory ON accessory.id = direction.object_id
    WHERE pc.verified = 1 AND pc.compatibility_status = 'COMPATIBLE'
      AND ${publicProductWhere("equipment")} AND ${publicProductWhere("accessory")}
    ORDER BY equipment.title, accessory.title, pc.compatibility_type
  `).all();
  const allProductFacts = new Map();
  for (const toolType of SELECTOR_TYPES) {
    for (const product of selectorDataset(db, toolType)) {
      const existing = allProductFacts.get(product.id) ?? product;
      existing.facts = { ...existing.facts, ...product.facts };
      allProductFacts.set(product.id, existing);
    }
  }
  return rows.flatMap((row) => {
    const assertion = assertionSnapshot(db, row.assertion_id);
    const directionAssertion = assertionSnapshot(db, row.direction_assertion_id);
    if (!assertion || assertion.subject_type !== "PRODUCT" || assertion.subject_id !== row.product_a_id || assertion.predicate !== "COMPATIBLE_WITH"
      || !directionAssertion || directionAssertion.subject_type !== "PRODUCT" || directionAssertion.subject_id !== row.product_id
      || directionAssertion.predicate !== "USES_ACCESSORY") return [];
    const facts = allProductFacts.get(row.product_id)?.facts ?? {};
    return [{
      id: row.id,
      product: { id: row.product_id, slug: row.product_slug, title: row.product_title },
      accessory: { id: row.accessory_id, slug: row.accessory_slug, title: row.accessory_title },
      compatibilityType: row.compatibility_type,
      shank: facts.shank?.display ?? null,
      maxDiameter: facts.maxDiameter?.display ?? null,
      depth: facts.maxDepth?.display ?? null,
      application: facts.applications?.display ?? null,
      assertionId: row.assertion_id,
      directionAssertionId: row.direction_assertion_id,
    }];
  });
}

function publicBase(set) {
  return {
    id: set.id, key: set.tool_key, version: set.version, type: set.tool_type,
    slug: set.slug, title: set.title, h1: set.h1, metaTitle: set.meta_title,
    metaDescription: set.meta_description, description: set.description,
    indexStatus: set.index_status, reviewedBy: set.approved_by, publishedAt: set.published_at,
  };
}

export function listPublicInteractiveTools(db) {
  if (!hasSchema(db)) return [];
  const rows = db.prepare("SELECT * FROM interactive_tool_sets WHERE status = 'PUBLISHED' ORDER BY published_at DESC, title").all();
  return rows.flatMap((set) => {
    try { currentModel(db, set); return [publicBase(set)]; } catch { return []; }
  });
}

export function getPublicInteractiveTool(db, slug) {
  if (!hasSchema(db)) return null;
  const set = db.prepare("SELECT * FROM interactive_tool_sets WHERE slug = ? AND status = 'PUBLISHED' ORDER BY version DESC LIMIT 1").get(slug);
  if (!set) return null;
  let model;
  try { model = currentModel(db, set); } catch { return null; }
  const base = publicBase(set);
  if (set.tool_type === "ANNULAR_CUTTER_RPM") {
    return { ...base, rules: model.rules.map((rule) => ({
      cutterType: rule.cutterType, material: rule.material, cuttingSpeed: rule.outputValue,
      unit: rule.outputUnit, assertionId: rule.assertionId,
    })) };
  }
  if (SELECTOR_TYPES.has(set.tool_type)) {
    return { ...base, criteria: SELECTOR_CRITERIA[set.tool_type], products: selectorDataset(db, set.tool_type) };
  }
  return { ...base, rows: compatibilityRows(db) };
}

export function calculateAnnularCutterRpm(tool, input) {
  if (!tool || tool.type !== "ANNULAR_CUTTER_RPM") throw new Error("A published RPM calculator is required");
  const cutterType = clean(input.cutterType, 120);
  const material = clean(input.material, 120);
  const diameter = Number(input.diameter);
  if (!cutterType || !material || !Number.isFinite(diameter) || diameter <= 0 || diameter > 1000) {
    throw new Error("cutterType, material and a positive diameter up to 1000 mm are required");
  }
  const rule = tool.rules.find((item) => normalize(item.cutterType) === normalize(cutterType) && normalize(item.material) === normalize(material));
  if (!rule) return null;
  const rpm = Math.round((1000 * rule.cuttingSpeed) / (Math.PI * diameter));
  return { rpm, diameter, cutterType: rule.cutterType, material: rule.material, cuttingSpeed: rule.cuttingSpeed, assertionId: rule.assertionId };
}

export function listInteractiveToolQueue(db, input = {}) {
  const status = clean(input.status, 30);
  const limit = Math.max(1, Math.min(500, Math.trunc(Number(input.limit ?? 100))));
  return db.prepare("SELECT * FROM interactive_tool_sets WHERE (? = '' OR status = ?) ORDER BY updated_at DESC, tool_key LIMIT ?")
    .all(status, status, limit);
}
