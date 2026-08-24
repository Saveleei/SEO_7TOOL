import { createHash, randomUUID } from "node:crypto";
import { processMediaFile } from "./media-storage.mjs";

const ACTOR_TYPES = new Set(["HUMAN", "SYSTEM", "AI_ASSISTED", "IMPORT"]);
const MUTATION_ACTORS = new Set(["HUMAN", "SYSTEM", "AI_ASSISTED"]);
const REQUIRED_PUBLIC_USES = Object.freeze(["WEBSITE", "CONTENT", "DERIVATIVES"]);
const PERMITTED_USES = new Set([...REQUIRED_PUBLIC_USES, "SOCIAL", "ADVERTISING"]);
const PHOTO_KINDS = new Set(["PRODUCT_PHOTO", "PRODUCT_CLOSEUP", "PRODUCT_COMPONENT", "COMPATIBLE_EQUIPMENT"]);
const DIAGRAM_KINDS = new Set(["DIAGRAM", "INFOGRAPHIC", "TECHNICAL_ILLUSTRATION", "COMPARISON_SCHEME", "CONCEPT_DRAWING"]);
const PUBLIC_LICENSES = new Set(["VERIFIED", "OWNED", "CONTRACT_APPROVED"]);
const COMPONENT_PATTERN = /weldon|шпиндел|хвостов|патрон|коронк|сверл|держател|адаптер|переходник|резьб|креплен|оправк/iu;

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

function normalize(value) {
  return cleanText(value, 1000)
    .toLocaleLowerCase("ru-RU")
    .replace(/[^a-zа-яё0-9]+/giu, " ")
    .trim();
}

function tokens(value) {
  return new Set(normalize(value).split(/\s+/u).filter((token) => token.length > 1));
}

function actorFrom(input) {
  const actorType = cleanText(input.actorType, 30);
  const actorId = cleanText(input.actorId, 200);
  if (!ACTOR_TYPES.has(actorType)) throw new Error("actorType must be HUMAN, SYSTEM, AI_ASSISTED or IMPORT");
  if (!actorId) throw new Error("actorId is required");
  return { actorType, actorId };
}

function requireMutationActor(input) {
  const actor = actorFrom(input);
  if (!MUTATION_ACTORS.has(actor.actorType)) throw new Error("Import actors cannot mutate the reviewed media library");
  return actor;
}

function requireHuman(input, action) {
  const actor = actorFrom(input);
  if (actor.actorType !== "HUMAN") throw new Error(`${action} requires a human actor`);
  return actor;
}

function parseJsonArray(value) {
  try {
    const result = JSON.parse(value || "[]");
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

function publicHost(value) {
  try {
    const url = new URL(value);
    if (!new Set(["http:", "https:"]).has(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLocaleLowerCase("en-US").replace(/\.$/, "");
    if (!host || host === "localhost" || host === "::1" || host.endsWith(".local")) return null;
    if (/^127\.|^10\.|^192\.168\.|^169\.254\./.test(host)) return null;
    const private172 = /^172\.(\d{1,2})\./.exec(host);
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return null;
    return { url: url.toString(), host };
  } catch {
    return null;
  }
}

function isSupplierUrl(sourceBaseUrl, candidateUrl) {
  const base = publicHost(sourceBaseUrl);
  const candidate = publicHost(candidateUrl);
  if (!base || !candidate) return null;
  if (candidate.host !== base.host && !candidate.host.endsWith(`.${base.host}`)) return null;
  return candidate;
}

function audit(db, { entityType, entityId, action, actor, details = {}, now = Date.now() }) {
  db.prepare(`
    INSERT INTO media_audit_events (
      id, entity_type, entity_id, action, actor_type, actor_id, details_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), entityType, entityId, action, actor.actorType, actor.actorId, canonical(details), now);
}

function mediaAsset(db, assetId) {
  const asset = db.prepare("SELECT * FROM media_assets WHERE id = ?").get(assetId);
  if (!asset) throw new Error("Media asset not found");
  return asset;
}

function rightsGrant(db, grantId) {
  const grant = db.prepare("SELECT * FROM media_rights_grants WHERE id = ?").get(grantId);
  if (!grant) throw new Error("Media rights grant not found");
  return grant;
}

function grantUses(grant) {
  return new Set(parseJsonArray(grant.permitted_uses_json));
}

export function isActivePublicGrant(grant, now = Date.now()) {
  if (!grant || grant.status !== "APPROVED" || grant.valid_from > now || (grant.valid_until && grant.valid_until <= now)) return false;
  const uses = grantUses(grant);
  return REQUIRED_PUBLIC_USES.every((use) => uses.has(use));
}

export function isAssetPublicationRightsEligible(asset, grant, now = Date.now()) {
  if (!asset || !grant || !isActivePublicGrant(grant, now)) return false;
  if (asset.rights_grant_id && grant.id && asset.rights_grant_id !== grant.id) return false;
  if (grant.scope_type === "ASSET") return grant.scope_value === asset.id;
  if (grant.scope_type === "SOURCE") {
    return Boolean(asset.source_id) && grant.scope_value === asset.source_id && grant.source_id === asset.source_id;
  }
  return false;
}

function activeGrantForAsset(db, asset, now = Date.now()) {
  if (!asset.rights_grant_id) return null;
  const grant = db.prepare("SELECT * FROM media_rights_grants WHERE id = ?").get(asset.rights_grant_id);
  return isAssetPublicationRightsEligible(asset, grant, now) ? grant : null;
}

function insertTag(db, {
  assetId, tagType, label, sourceType = "SUPPLIER_FEED", confidence = 0.8,
  status = "PROPOSED", reviewer = null, now = Date.now(),
}) {
  const display = cleanText(label, 300);
  const normalized = normalize(display);
  if (!normalized) return;
  db.prepare(`
    INSERT INTO media_tags (
      media_asset_id, tag_type, normalized_tag, display_label, source_type,
      confidence, status, reviewed_by, reviewed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(media_asset_id, tag_type, normalized_tag) DO NOTHING
  `).run(assetId, tagType, normalized, display, sourceType, confidence, status,
    status === "REVIEWED" ? reviewer : null, status === "REVIEWED" ? now : null, now);
}

function insertRelation(db, { assetId, subjectType, subjectId, relationType = "ASSOCIATED_WITH", now }) {
  db.prepare(`
    INSERT INTO media_relations (
      id, media_asset_id, subject_type, subject_id, relation_type, evidence_source, status, created_at
    ) VALUES (?, ?, ?, ?, ?, 'SUPPLIER_FEED', 'PROPOSED', ?)
    ON CONFLICT(media_asset_id, subject_type, subject_id, relation_type) DO NOTHING
  `).run(`media-rel-${hash(`${assetId}\u0000${subjectType}\u0000${subjectId}\u0000${relationType}`).slice(0, 24)}`,
    assetId, subjectType, subjectId, relationType, now);
}

function componentLabels(params) {
  const result = [];
  for (const raw of params) {
    const name = cleanText(raw?.name, 160);
    const value = cleanText(raw?.value, 160);
    const unit = cleanText(raw?.unit, 40);
    if (!name || !value) continue;
    const label = `${name} ${value}${unit ? ` ${unit}` : ""}`;
    if (COMPONENT_PATTERN.test(label)) result.push(label);
  }
  return result;
}

export function discoverSupplierMediaLibrary(db, input) {
  const actor = requireMutationActor(input);
  const sourceId = requireText(input.sourceId, "sourceId", 200);
  const source = db.prepare("SELECT * FROM sources WHERE id = ?").get(sourceId);
  if (!source || source.source_type !== "SUPPLIER_FEED" || source.active !== 1) {
    throw new Error("Media discovery accepts only an active Supplier Feed source");
  }
  if (!publicHost(source.base_url)) throw new Error("Supplier source needs a public base_url to prove image ownership domain");
  const approvedSourceGrant = db.prepare(`
    SELECT * FROM media_rights_grants
    WHERE scope_type = 'SOURCE' AND scope_value = ? AND source_id = ? AND status = 'APPROVED'
    ORDER BY reviewed_at DESC LIMIT 1
  `).get(sourceId, sourceId);
  const sourceRightsApproved = isActivePublicGrant(approvedSourceGrant);
  const products = db.prepare(`
    SELECT id, title, brand, category, images FROM products
    WHERE images IS NOT NULL AND images != '[]' ORDER BY id
  `).all();
  const variants = db.prepare(`
    SELECT id, product_id, name, params, images FROM variants
    WHERE images IS NOT NULL AND images != '[]' ORDER BY product_id, id
  `).all();
  const variantsByProduct = new Map();
  for (const variant of variants) {
    const group = variantsByProduct.get(variant.product_id) ?? [];
    group.push(variant);
    variantsByProduct.set(variant.product_id, group);
  }
  const discovered = [];
  const rejected = [];
  const now = Date.now();
  db.transaction(() => {
    for (const product of products) {
      const candidates = parseJsonArray(product.images).map((url) => ({ url, variant: null }));
      for (const variant of variantsByProduct.get(product.id) ?? []) {
        for (const url of parseJsonArray(variant.images)) candidates.push({ url, variant });
      }
      const seen = new Set();
      for (const candidate of candidates) {
        const checked = isSupplierUrl(source.base_url, candidate.url);
        if (!checked) {
          rejected.push({ productId: product.id, url: cleanText(candidate.url, 1000), reason: "OUTSIDE_SUPPLIER_DOMAIN" });
          continue;
        }
        if (seen.has(checked.url)) continue;
        seen.add(checked.url);
        const assetId = `media-${hash(checked.url).slice(0, 24)}`;
        const description = [product.title, candidate.variant?.name].filter(Boolean).join(" — ");
        const status = sourceRightsApproved ? "RIGHTS_APPROVED" : "RIGHTS_REVIEW";
        const license = sourceRightsApproved ? "CONTRACT_APPROVED" : "CONTRACT_REQUIRED";
        const metadataChecksum = hash(canonical({ sourceId, originUrl: checked.url }));
        db.prepare(`
          INSERT INTO media_assets (
            id, source_id, source_type, origin_url, origin_host, supplier_product_ref,
            product_id, variant_id, category_slug, brand, asset_kind, depiction_type,
            semantic_description, ai_generated, copyright_status, license_status,
            rights_grant_id, status, metadata_checksum, discovered_at, created_at, updated_at
          ) VALUES (
            ?, ?, 'SUPPLIER_FEED', ?, ?, ?, ?, ?, ?, ?, 'PRODUCT_PHOTO', 'PHOTOGRAPH',
            ?, 0, 'SUPPLIER_CLAIMED', ?, ?, ?, ?, ?, ?, ?
          )
          ON CONFLICT(origin_url) DO UPDATE SET
            category_slug = COALESCE(media_assets.category_slug, excluded.category_slug),
            brand = COALESCE(media_assets.brand, excluded.brand),
            rights_grant_id = CASE WHEN media_assets.status IN ('PROCESSED', 'SUPERSEDED')
              THEN media_assets.rights_grant_id ELSE excluded.rights_grant_id END,
            license_status = CASE WHEN media_assets.status IN ('PROCESSED', 'SUPERSEDED')
              THEN media_assets.license_status ELSE excluded.license_status END,
            status = CASE WHEN media_assets.status IN ('PROCESSED', 'SUPERSEDED')
              THEN media_assets.status ELSE excluded.status END,
            updated_at = excluded.updated_at
        `).run(
          assetId, sourceId, checked.url, checked.host, product.id, product.id,
          candidate.variant?.id ?? null, product.category, cleanText(product.brand, 160) || null,
          description, license, sourceRightsApproved ? approvedSourceGrant.id : null,
          status, metadataChecksum, now, now, now,
        );
        const actual = db.prepare("SELECT id FROM media_assets WHERE origin_url = ?").get(checked.url);
        const actualId = actual.id;
        insertRelation(db, { assetId: actualId, subjectType: "PRODUCT", subjectId: product.id, relationType: "DEPICTS", now });
        insertTag(db, { assetId: actualId, tagType: "PRODUCT", label: product.title, now });
        if (product.brand) insertTag(db, { assetId: actualId, tagType: "BRAND", label: product.brand, confidence: 1, now });
        if (product.category) insertTag(db, { assetId: actualId, tagType: "CATEGORY", label: product.category, confidence: 1, now });
        if (candidate.variant) {
          insertRelation(db, { assetId: actualId, subjectType: "VARIANT", subjectId: candidate.variant.id, relationType: "ASSOCIATED_WITH", now });
          if (candidate.variant.name) insertTag(db, { assetId: actualId, tagType: "VARIANT", label: candidate.variant.name, now });
          const params = parseJsonArray(candidate.variant.params);
          for (const param of params) {
            const label = [param?.name, param?.value, param?.unit].filter(Boolean).join(" ");
            if (label) insertTag(db, { assetId: actualId, tagType: "FEATURE", label, confidence: 0.75, now });
          }
          for (const label of componentLabels(params)) insertTag(db, { assetId: actualId, tagType: "COMPONENT", label, confidence: 0.8, now });
        }
        discovered.push(actualId);
      }
    }
    audit(db, {
      entityType: "MEDIA_ASSET", entityId: sourceId, action: "SUPPLIER_LIBRARY_DISCOVERED", actor,
      details: { discovered: [...new Set(discovered)].length, rejected: rejected.length, networkDownloaded: false }, now,
    });
  })();
  return {
    sourceId,
    discoveredAssetIds: [...new Set(discovered)],
    rejected,
    rightsStatus: sourceRightsApproved ? "RIGHTS_APPROVED" : "CONTRACT_REQUIRED",
    downloaded: 0,
  };
}

export function proposeMediaRightsGrant(db, input) {
  const actor = requireHuman(input, "Media rights proposal");
  const scopeType = requireText(input.scopeType, "scopeType", 20);
  if (!new Set(["SOURCE", "ASSET"]).has(scopeType)) throw new Error("scopeType must be SOURCE or ASSET");
  const scopeValue = requireText(input.scopeValue, "scopeValue", 200);
  let sourceId = cleanText(input.sourceId, 200) || null;
  if (scopeType === "SOURCE") {
    const source = db.prepare("SELECT * FROM sources WHERE id = ?").get(scopeValue);
    if (!source || source.source_type !== "SUPPLIER_FEED") throw new Error("SOURCE grants are limited to Supplier Feed sources");
    sourceId = source.id;
  } else {
    const asset = mediaAsset(db, scopeValue);
    sourceId = asset.source_id;
  }
  const licenseType = requireText(input.licenseType, "licenseType", 40);
  if (!new Set(["OWNED", "SUPPLIER_CONTRACT", "EXPLICIT_PERMISSION", "AI_OUTPUT_TERMS"]).has(licenseType)) {
    throw new Error("Unknown media license type");
  }
  if (scopeType === "SOURCE" && licenseType !== "SUPPLIER_CONTRACT") throw new Error("Supplier source grants require SUPPLIER_CONTRACT");
  if (scopeType === "ASSET") {
    const asset = mediaAsset(db, scopeValue);
    if (asset.ai_generated === 1 && licenseType !== "AI_OUTPUT_TERMS") throw new Error("AI-generated media requires AI_OUTPUT_TERMS");
  }
  const permittedUses = [...new Set((input.permittedUses ?? []).map((value) => requireText(value, "permittedUse", 40).toUpperCase()))].sort();
  if (!permittedUses.length || permittedUses.some((value) => !PERMITTED_USES.has(value))) throw new Error("permittedUses contains an unsupported use");
  if (!REQUIRED_PUBLIC_USES.every((use) => permittedUses.includes(use))) {
    throw new Error(`Publication rights require ${REQUIRED_PUBLIC_USES.join(", ")}`);
  }
  const evidenceRef = requireText(input.evidenceRef, "evidenceRef", 1000);
  const evidenceChecksum = requireText(input.evidenceChecksum, "evidenceChecksum", 64).toLocaleLowerCase("en-US");
  if (!/^[a-f0-9]{64}$/.test(evidenceChecksum)) throw new Error("evidenceChecksum must be a SHA-256 checksum");
  const validFrom = Number(input.validFrom ?? Date.now());
  const validUntil = input.validUntil == null ? null : Number(input.validUntil);
  if (!Number.isInteger(validFrom) || (validUntil != null && (!Number.isInteger(validUntil) || validUntil <= validFrom))) {
    throw new Error("Rights validity dates are invalid");
  }
  const attributionRequired = Boolean(input.attributionRequired);
  const attributionText = cleanText(input.attributionText, 500) || null;
  if (attributionRequired && !attributionText) throw new Error("attributionText is required");
  const now = Date.now();
  const id = `rights-${hash(canonical({ scopeType, scopeValue, evidenceChecksum, validFrom })).slice(0, 24)}`;
  const existing = db.prepare("SELECT * FROM media_rights_grants WHERE id = ?").get(id);
  if (existing) return { grant: existing, duplicate: true };
  db.transaction(() => {
    db.prepare(`
      INSERT INTO media_rights_grants (
        id, scope_type, scope_value, source_id, copyright_holder, license_type,
        permitted_uses_json, attribution_required, attribution_text, evidence_ref,
        evidence_checksum, valid_from, valid_until, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PROPOSED', ?, ?)
    `).run(
      id, scopeType, scopeValue, sourceId, requireText(input.copyrightHolder, "copyrightHolder", 300),
      licenseType, canonical(permittedUses), attributionRequired ? 1 : 0, attributionText,
      evidenceRef, evidenceChecksum, validFrom, validUntil, now, now,
    );
    audit(db, { entityType: "RIGHTS_GRANT", entityId: id, action: "RIGHTS_PROPOSED", actor, details: { scopeType, scopeValue }, now });
  })();
  return { grant: rightsGrant(db, id), duplicate: false };
}

export function approveMediaRightsGrant(db, input) {
  const actor = requireHuman(input, "Media rights approval");
  const grant = rightsGrant(db, requireText(input.grantId, "grantId", 200));
  if (grant.status === "APPROVED") return grant;
  if (grant.status !== "PROPOSED") throw new Error("Only a proposed rights grant can be approved");
  if (grant.valid_until && grant.valid_until <= Date.now()) throw new Error("Rights grant has already expired");
  const collision = db.prepare(`
    SELECT id FROM media_rights_grants
    WHERE scope_type = ? AND scope_value = ? AND status = 'APPROVED' AND id != ?
  `).get(grant.scope_type, grant.scope_value, grant.id);
  if (collision) throw new Error("The scope already has an approved rights grant; revoke it before replacement");
  const now = Date.now();
  db.transaction(() => {
    db.prepare(`
      UPDATE media_rights_grants SET status = 'APPROVED', reviewed_by = ?, reviewed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(actor.actorId, now, now, grant.id);
    if (grant.scope_type === "SOURCE") {
      db.prepare(`
        UPDATE media_assets SET rights_grant_id = ?, license_status = 'CONTRACT_APPROVED',
          status = CASE WHEN status IN ('DISCOVERED', 'METADATA_READY', 'RIGHTS_REVIEW') THEN 'RIGHTS_APPROVED' ELSE status END,
          updated_at = ? WHERE source_id = ? AND source_type = 'SUPPLIER_FEED'
      `).run(grant.id, now, grant.scope_value);
    } else {
      const asset = mediaAsset(db, grant.scope_value);
      const license = grant.license_type === "OWNED" ? "OWNED" : "VERIFIED";
      db.prepare(`
        UPDATE media_assets SET rights_grant_id = ?, license_status = ?,
          status = CASE WHEN status IN ('DISCOVERED', 'METADATA_READY', 'RIGHTS_REVIEW') THEN 'RIGHTS_APPROVED' ELSE status END,
          updated_at = ? WHERE id = ?
      `).run(grant.id, license, now, asset.id);
    }
    audit(db, { entityType: "RIGHTS_GRANT", entityId: grant.id, action: "RIGHTS_APPROVED", actor, now });
  })();
  return rightsGrant(db, grant.id);
}

export function revokeMediaRightsGrant(db, input) {
  const actor = requireHuman(input, "Media rights revocation");
  const grant = rightsGrant(db, requireText(input.grantId, "grantId", 200));
  if (grant.status === "REVOKED") return grant;
  if (grant.status !== "APPROVED") throw new Error("Only an approved rights grant can be revoked");
  const reason = requireText(input.reason, "reason", 1000);
  const now = Date.now();
  db.transaction(() => {
    db.prepare(`
      UPDATE media_rights_grants SET status = 'REVOKED', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?
    `).run(actor.actorId, now, now, grant.id);
    db.prepare(`
      UPDATE media_assets SET license_status = 'EXPIRED', status = 'RIGHTS_REVIEW', updated_at = ?
      WHERE rights_grant_id = ? AND status != 'SUPERSEDED'
    `).run(now, grant.id);
    db.prepare(`
      UPDATE content_media SET status = 'REJECTED', updated_at = ?
      WHERE media_asset_id IN (SELECT id FROM media_assets WHERE rights_grant_id = ?)
        AND status IN ('PROPOSED', 'APPROVED', 'PUBLISHED')
    `).run(now, grant.id);
    audit(db, { entityType: "RIGHTS_GRANT", entityId: grant.id, action: "RIGHTS_REVOKED", actor, details: { reason }, now });
  })();
  return rightsGrant(db, grant.id);
}

export function registerAiDiagram(db, input) {
  const actor = requireMutationActor(input);
  const kind = requireText(input.assetKind, "assetKind", 40);
  if (!DIAGRAM_KINDS.has(kind)) throw new Error("AI media is limited to diagrams, infographics and clearly illustrative drawings");
  const disclosure = requireText(input.disclosureText, "disclosureText", 300);
  if (!/(?:\bai\b|ии|сгенерирован|искусственн)/iu.test(disclosure)) throw new Error("AI disclosure must explicitly identify generated media");
  if (input.originUrl || input.realProductId || PHOTO_KINDS.has(kind)) throw new Error("AI media cannot masquerade as a real product photograph");
  const semanticDescription = requireText(input.semanticDescription, "semanticDescription", 1000);
  const promptRef = requireText(input.promptRef, "promptRef", 1000);
  const promptHash = requireText(input.promptHash, "promptHash", 64).toLocaleLowerCase("en-US");
  if (!/^[a-f0-9]{64}$/.test(promptHash)) throw new Error("promptHash must be a SHA-256 checksum");
  const now = Date.now();
  const id = cleanText(input.assetId, 80) || `media-ai-${hash(canonical({ promptHash, semanticDescription, kind })).slice(0, 24)}`;
  if (!/^[a-z0-9][a-z0-9-]{9,79}$/i.test(id)) throw new Error("Invalid media asset id");
  const existing = db.prepare("SELECT * FROM media_assets WHERE id = ?").get(id);
  if (existing) return { asset: existing, duplicate: true };
  db.transaction(() => {
    db.prepare(`
      INSERT INTO media_assets (
        id, source_type, category_slug, asset_kind, depiction_type, semantic_description,
        ai_generated, real_product_id, disclosure_text, copyright_status, license_status,
        status, metadata_checksum, discovered_at, created_at, updated_at
      ) VALUES (?, 'AI_GENERATED', ?, ?, ?, ?, 1, NULL, ?, 'AI_GENERATED', 'UNKNOWN',
        'RIGHTS_REVIEW', ?, ?, ?, ?)
    `).run(
      id, cleanText(input.categorySlug, 200) || null, kind,
      kind === "DIAGRAM" || kind === "COMPARISON_SCHEME" ? "DIAGRAM" : "ILLUSTRATION",
      semanticDescription, disclosure, hash(canonical({ id, promptHash, kind, semanticDescription })), now, now, now,
    );
    db.prepare(`
      INSERT INTO media_generation_records (
        id, media_asset_id, provider, model, prompt_ref, prompt_hash, generation_ref,
        terms_ref, created_by_actor_type, created_by_actor_id, generated_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `media-gen-${hash(id).slice(0, 24)}`, id, requireText(input.provider, "provider", 200),
      requireText(input.model, "model", 200), promptRef, promptHash,
      cleanText(input.generationRef, 1000) || null, requireText(input.termsRef, "termsRef", 1000),
      actor.actorType, actor.actorId, Number(input.generatedAt ?? now), now,
    );
    audit(db, { entityType: "MEDIA_ASSET", entityId: id, action: "AI_DIAGRAM_REGISTERED", actor, details: { kind, disclosure }, now });
  })();
  return { asset: mediaAsset(db, id), duplicate: false };
}

export async function processApprovedMedia(db, input) {
  const actor = actorFrom(input);
  if (!new Set(["HUMAN", "SYSTEM"]).has(actor.actorType)) throw new Error("Media processing requires a human or deterministic system actor");
  const asset = mediaAsset(db, requireText(input.assetId, "assetId", 200));
  if (asset.status === "PROCESSED") {
    return { asset, variants: db.prepare("SELECT * FROM media_variants WHERE media_asset_id = ? ORDER BY width, format").all(asset.id), duplicate: false };
  }
  if (asset.status !== "RIGHTS_APPROVED" || !PUBLIC_LICENSES.has(asset.license_status) || !activeGrantForAsset(db, asset)) {
    throw new Error("Media must have an active reviewed publication grant before local processing");
  }
  const result = await processMediaFile({ inputPath: requireText(input.inputPath, "inputPath", 2000), assetId: asset.id });
  const duplicate = db.prepare("SELECT id FROM media_assets WHERE sha256 = ? AND id != ?").get(result.sha256, asset.id);
  const now = Date.now();
  if (duplicate) {
    db.transaction(() => {
      db.prepare("UPDATE media_assets SET status = 'SUPERSEDED', updated_at = ? WHERE id = ?").run(now, asset.id);
      audit(db, { entityType: "MEDIA_ASSET", entityId: asset.id, action: "DUPLICATE_SUPERSEDED", actor, details: { duplicateOf: duplicate.id }, now });
    })();
    return { asset: mediaAsset(db, asset.id), variants: [], duplicate: true, duplicateOf: duplicate.id };
  }
  db.transaction(() => {
    for (const variant of result.variants) {
      db.prepare(`
        INSERT INTO media_variants (
          id, media_asset_id, width, height, format, mime, storage_key, checksum, bytes, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'READY', ?)
      `).run(
        `media-var-${hash(`${asset.id}\u0000${variant.storageKey}\u0000${variant.checksum}`).slice(0, 24)}`,
        asset.id, variant.width, variant.height, variant.format, variant.mime,
        variant.storageKey, variant.checksum, variant.bytes, now,
      );
    }
    db.prepare(`
      UPDATE media_assets SET original_storage_key = ?, sha256 = ?, perceptual_hash = ?,
        width = ?, height = ?, bytes = ?, mime = ?, status = 'PROCESSED',
        processed_at = ?, processed_by = ?, updated_at = ? WHERE id = ?
    `).run(
      result.originalStorageKey, result.sha256, result.perceptualHash, result.width, result.height,
      result.bytes, result.mime, now, actor.actorId, now, asset.id,
    );
    audit(db, { entityType: "MEDIA_ASSET", entityId: asset.id, action: "MEDIA_PROCESSED", actor, details: { variants: result.variants.length, sha256: result.sha256 }, now });
  })();
  return { asset: mediaAsset(db, asset.id), variants: db.prepare("SELECT * FROM media_variants WHERE media_asset_id = ? ORDER BY width, format").all(asset.id), duplicate: false };
}

function desiredKind(need, itemType = "SUPPLIER_IMAGE") {
  const value = normalize(need);
  if (itemType === "REQUIRED_DIAGRAM" || /схем|диаграм|инфограф|иллюстрац|чертеж/u.test(value)) return "DIAGRAM";
  if (/сравнен/u.test(value)) return "COMPARISON_SCHEME";
  if (/крупн|close up|closeup|детал/u.test(value)) return "PRODUCT_CLOSEUP";
  if (/совместим|оборудован/u.test(value)) return "COMPATIBLE_EQUIPMENT";
  if (COMPONENT_PATTERN.test(value)) return "PRODUCT_COMPONENT";
  return "PRODUCT_PHOTO";
}

export function createMediaSelectionRequests(db, input) {
  const actor = requireMutationActor(input);
  const articleId = requireText(input.articleId, "articleId", 200);
  const article = db.prepare("SELECT * FROM content_assets WHERE id = ?").get(articleId);
  if (!article || !article.current_brief_id) throw new Error("Article with a current brief is required");
  const brief = db.prepare("SELECT * FROM article_briefs WHERE id = ? AND content_asset_id = ?").get(article.current_brief_id, article.id);
  if (!brief || brief.status !== "APPROVED") throw new Error("Media requests require the current human-approved ArticleBrief");
  const items = db.prepare(`
    SELECT * FROM article_brief_items
    WHERE brief_id = ? AND item_type IN ('SUPPLIER_IMAGE', 'REQUIRED_DIAGRAM')
    ORDER BY sort_order, id
  `).all(brief.id);
  const candidateLimit = Number(input.candidateLimit ?? 20);
  if (!Number.isInteger(candidateLimit) || candidateLimit < 1 || candidateLimit > 100) {
    throw new Error("candidateLimit must be an integer from 1 to 100");
  }
  const now = Date.now();
  const ids = [];
  db.transaction(() => {
    for (const item of items) {
      const id = `media-req-${hash(item.id).slice(0, 24)}`;
      const need = requireText(item.item_text, "semanticNeed", 1000);
      const context = cleanText(input.contextByBriefItemId?.[item.id], 2000) || `${article.h1}. ${need}`;
      db.prepare(`
        INSERT INTO media_selection_requests (
          id, content_asset_id, brief_id, brief_item_id, semantic_need, normalized_need,
          context_text, desired_kind, candidate_limit, status, requested_by_actor_type,
          requested_by_actor_id, generated_by_ai, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?)
        ON CONFLICT(brief_item_id) DO NOTHING
      `).run(
        id, article.id, brief.id, item.id, need, normalize(need), context,
        desiredKind(need, item.item_type), candidateLimit,
        actor.actorType, actor.actorId, actor.actorType === "AI_ASSISTED" ? 1 : 0, now, now,
      );
      const actual = db.prepare("SELECT id FROM media_selection_requests WHERE brief_item_id = ?").get(item.id);
      ids.push(actual.id);
      audit(db, { entityType: "SELECTION_REQUEST", entityId: actual.id, action: "SELECTION_REQUEST_CREATED", actor, details: { briefItemId: item.id }, now });
    }
  })();
  return db.prepare(`SELECT * FROM media_selection_requests WHERE id IN (${ids.map(() => "?").join(",") || "NULL"}) ORDER BY created_at, id`).all(...ids);
}

function selectionRequest(db, requestId) {
  const request = db.prepare("SELECT * FROM media_selection_requests WHERE id = ?").get(requestId);
  if (!request) throw new Error("Media selection request not found");
  return request;
}

function candidateScore(db, request, asset, targetProducts) {
  const tagRows = db.prepare(`
    SELECT normalized_tag, display_label, tag_type FROM media_tags
    WHERE media_asset_id = ? AND status != 'REJECTED'
  `).all(asset.id);
  const corpus = `${asset.semantic_description} ${asset.brand ?? ""} ${tagRows.map((tag) => tag.display_label).join(" ")}`;
  const needTokens = tokens(`${request.semantic_need} ${request.context_text}`);
  const corpusTokens = tokens(corpus);
  const overlap = [...needTokens].filter((token) => corpusTokens.has(token)).length;
  const semantic = needTokens.size ? Math.round((overlap / needTokens.size) * 55) : 0;
  const exact = normalize(corpus).includes(request.normalized_need) ? 15 : 0;
  const product = targetProducts.has(asset.product_id) ? 20 : 0;
  const category = asset.category_slug === request.category_slug ? 10 : 0;
  const kind = asset.asset_kind === request.desired_kind ? 15 : 0;
  const component = request.desired_kind === "PRODUCT_COMPONENT" && tagRows.some((tag) => tag.tag_type === "COMPONENT" && [...tokens(tag.normalized_tag)].some((token) => needTokens.has(token))) ? 15 : 0;
  const total = Math.min(100, semantic + exact + product + category + kind + component);
  return { total, breakdown: { semantic, exact, product, category, kind, component, overlap, needTokenCount: needTokens.size } };
}

export function rankMediaSelection(db, input) {
  const actor = requireMutationActor(input);
  const request = db.prepare(`
    SELECT r.*, a.category_slug FROM media_selection_requests r
    JOIN content_assets a ON a.id = r.content_asset_id WHERE r.id = ?
  `).get(requireText(input.requestId, "requestId", 200));
  if (!request) throw new Error("Media selection request not found");
  if (request.status === "RANKED" || request.status === "SELECTED") {
    return db.prepare("SELECT * FROM media_selection_candidates WHERE request_id = ? ORDER BY candidate_rank").all(request.id);
  }
  if (!new Set(["DRAFT", "NO_MATCH"]).has(request.status)) throw new Error("Selection request cannot be ranked in its current state");
  const wantsDiagram = DIAGRAM_KINDS.has(request.desired_kind);
  const targetProducts = new Set(db.prepare(`
    SELECT product_id FROM content_products WHERE content_asset_id = ? AND relation_type = 'TARGET'
  `).all(request.content_asset_id).map((row) => row.product_id));
  const pool = db.prepare(`
    SELECT * FROM media_assets
    WHERE status = 'PROCESSED' AND license_status IN ('VERIFIED', 'OWNED', 'CONTRACT_APPROVED')
      AND source_type = ? AND (category_slug = ? OR product_id IN (
        SELECT product_id FROM content_products WHERE content_asset_id = ?
      ))
    ORDER BY id LIMIT 5000
  `).all(wantsDiagram ? "AI_GENERATED" : "SUPPLIER_FEED", request.category_slug, request.content_asset_id);
  const ranked = pool
    .filter((asset) => activeGrantForAsset(db, asset))
    .map((asset) => ({ asset, ...candidateScore(db, request, asset, targetProducts) }))
    .filter((entry) => entry.total >= 20)
    .sort((left, right) => right.total - left.total || left.asset.id.localeCompare(right.asset.id))
    .slice(0, request.candidate_limit);
  const now = Date.now();
  db.transaction(() => {
    db.prepare("DELETE FROM media_selection_candidates WHERE request_id = ?").run(request.id);
    const insert = db.prepare(`
      INSERT INTO media_selection_candidates (
        request_id, media_asset_id, semantic_score, score_breakdown_json,
        candidate_rank, rights_eligible, status, created_at
      ) VALUES (?, ?, ?, ?, ?, 1, 'RANKED', ?)
    `);
    ranked.forEach((entry, index) => insert.run(request.id, entry.asset.id, entry.total, canonical(entry.breakdown), index + 1, now));
    db.prepare("UPDATE media_selection_requests SET status = ?, updated_at = ? WHERE id = ?")
      .run(ranked.length ? "RANKED" : "NO_MATCH", now, request.id);
    audit(db, { entityType: "SELECTION_REQUEST", entityId: request.id, action: ranked.length ? "CANDIDATES_RANKED" : "NO_MATCH_FOUND", actor, details: { candidates: ranked.length, sourcePolicy: wantsDiagram ? "AI_DIAGRAMS_ONLY" : "SUPPLIER_FEED_ONLY" }, now });
  })();
  return db.prepare("SELECT * FROM media_selection_candidates WHERE request_id = ? ORDER BY candidate_rank").all(request.id);
}

export function reviewMediaNoMatch(db, input) {
  const actor = requireHuman(input, "No-match review");
  const request = selectionRequest(db, requireText(input.requestId, "requestId", 200));
  if (request.status === "NO_MATCH_REVIEWED") return request;
  if (request.status !== "NO_MATCH") throw new Error("Only a NO_MATCH request can be reviewed as intentionally empty");
  const now = Date.now();
  db.transaction(() => {
    db.prepare(`
      UPDATE media_selection_requests SET status = 'NO_MATCH_REVIEWED', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?
    `).run(actor.actorId, now, now, request.id);
    audit(db, { entityType: "SELECTION_REQUEST", entityId: request.id, action: "NO_MATCH_REVIEWED", actor, details: { reason: requireText(input.reason, "reason", 1000) }, now });
  })();
  return selectionRequest(db, request.id);
}

function contextualAltSuggestion(db, request, asset) {
  const product = asset.product_id ? db.prepare("SELECT title FROM products WHERE id = ?").get(asset.product_id) : null;
  const component = db.prepare(`
    SELECT display_label FROM media_tags
    WHERE media_asset_id = ? AND tag_type = 'COMPONENT' AND status != 'REJECTED'
    ORDER BY status = 'REVIEWED' DESC, confidence DESC, display_label LIMIT 1
  `).get(asset.id);
  if (asset.ai_generated === 1) return cleanText(`Схема: ${request.semantic_need}`, 180);
  if (component && product) return cleanText(`${component.display_label} — узел ${product.title}`, 180);
  if (product) return cleanText(`${request.semantic_need} на примере ${product.title}`, 180);
  return cleanText(`${request.semantic_need}: изображение из медиатеки поставщика`, 180);
}

export function suggestContextualAlt(db, input) {
  const request = selectionRequest(db, requireText(input.requestId, "requestId", 200));
  const asset = mediaAsset(db, requireText(input.assetId, "assetId", 200));
  return contextualAltSuggestion(db, request, asset);
}

export function validateContextualAlt(value, { semanticNeed, productTitle = "", aiGenerated = false } = {}) {
  const alt = cleanText(value, 500);
  if (alt.length < 10 || alt.length > 180) throw new Error("Contextual ALT must contain 10-180 characters");
  if (/https?:\/\/|\.(?:jpe?g|png|webp|avif)\b/iu.test(alt)) throw new Error("Contextual ALT cannot contain a URL or filename");
  const altTokens = [...tokens(alt)];
  const needTokens = tokens(semanticNeed);
  if (needTokens.size && !altTokens.some((token) => needTokens.has(token))) throw new Error("Contextual ALT must describe the semantic need");
  if (productTitle && normalize(alt) === normalize(productTitle)) throw new Error("Contextual ALT cannot be only a product title");
  const counts = new Map();
  for (const token of altTokens.length ? normalize(alt).split(/\s+/u) : []) counts.set(token, (counts.get(token) ?? 0) + 1);
  if ([...counts.entries()].some(([token, count]) => token.length > 3 && count > 3)) throw new Error("Contextual ALT appears to contain keyword stuffing");
  const words = normalize(alt).split(/\s+/u);
  const bigrams = words.slice(0, -1).map((word, index) => `${word} ${words[index + 1]}`);
  if (bigrams.some((bigram, index) => bigrams.indexOf(bigram) !== index && bigrams.lastIndexOf(bigram) !== index)) {
    throw new Error("Contextual ALT repeats the same phrase");
  }
  if (aiGenerated) {
    if (!/схем|иллюстрац|инфограф|эскиз|концепт/iu.test(alt)) throw new Error("AI ALT must identify the asset as a scheme or illustration");
    if (/фотограф|реальн(?:ый|ая|ое).*товар/iu.test(alt)) throw new Error("AI media cannot be described as a real product photograph");
  }
  return alt;
}

export function approveMediaSelection(db, input) {
  const actor = requireHuman(input, "Media selection approval");
  const request = selectionRequest(db, requireText(input.requestId, "requestId", 200));
  if (request.status === "SELECTED") return db.prepare("SELECT * FROM content_media WHERE request_id = ?").get(request.id);
  if (request.status !== "RANKED") throw new Error("Only a ranked request can be selected");
  const asset = mediaAsset(db, requireText(input.assetId, "assetId", 200));
  const candidate = db.prepare(`
    SELECT * FROM media_selection_candidates
    WHERE request_id = ? AND media_asset_id = ? AND status = 'RANKED' AND rights_eligible = 1
  `).get(request.id, asset.id);
  if (!candidate) throw new Error("Selected media is not an eligible ranked candidate");
  const grant = activeGrantForAsset(db, asset);
  if (asset.status !== "PROCESSED" || !PUBLIC_LICENSES.has(asset.license_status) || !grant) {
    throw new Error("Selected media no longer has processed files and active publication rights");
  }
  const confirmedKind = requireText(input.confirmedKind, "confirmedKind", 40);
  if (asset.ai_generated === 1) {
    if (!DIAGRAM_KINDS.has(confirmedKind) || confirmedKind !== asset.asset_kind) throw new Error("AI diagram kind must match its generation record");
  } else if (!PHOTO_KINDS.has(confirmedKind)) {
    throw new Error("Supplier media must remain a confirmed photograph kind");
  }
  const product = asset.product_id ? db.prepare("SELECT title FROM products WHERE id = ?").get(asset.product_id) : null;
  const contextualAlt = validateContextualAlt(input.contextualAlt || contextualAltSuggestion(db, request, asset), {
    semanticNeed: request.semantic_need, productTitle: product?.title, aiGenerated: asset.ai_generated === 1,
  });
  const depictionLabel = requireText(input.depictionLabel, "depictionLabel", 300);
  let slotType = cleanText(input.slotType, 30) || (asset.ai_generated === 1 ? "DIAGRAM" : "INLINE");
  if (!new Set(["HERO", "INLINE", "DIAGRAM", "COMPARISON"]).has(slotType)) throw new Error("Unknown media slotType");
  if (asset.ai_generated === 1 && !new Set(["DIAGRAM", "COMPARISON"]).has(slotType)) {
    throw new Error("AI-generated media must be visibly placed as a diagram or comparison");
  }
  const article = db.prepare("SELECT status FROM content_assets WHERE id = ?").get(request.content_asset_id);
  const status = article?.status === "PUBLISHED" ? "PUBLISHED" : "APPROVED";
  const now = Date.now();
  const contentMediaId = `content-media-${hash(request.id).slice(0, 24)}`;
  db.transaction(() => {
    db.prepare("UPDATE media_selection_candidates SET status = 'REJECTED' WHERE request_id = ? AND media_asset_id != ?").run(request.id, asset.id);
    db.prepare("UPDATE media_selection_candidates SET status = 'SELECTED' WHERE request_id = ? AND media_asset_id = ?").run(request.id, asset.id);
    db.prepare(`
      UPDATE media_selection_requests SET status = 'SELECTED', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?
    `).run(actor.actorId, now, now, request.id);
    db.prepare("UPDATE media_assets SET asset_kind = ?, updated_at = ? WHERE id = ?").run(confirmedKind, now, asset.id);
    insertTag(db, {
      assetId: asset.id,
      tagType: confirmedKind === "PRODUCT_COMPONENT" ? "COMPONENT" : confirmedKind === "COMPATIBLE_EQUIPMENT" ? "EQUIPMENT" : "VIEW",
      label: depictionLabel, sourceType: "HUMAN", confidence: 1, status: "REVIEWED", reviewer: actor.actorId, now,
    });
    db.prepare(`
      INSERT INTO content_media (
        id, content_asset_id, request_id, media_asset_id, slot_type, section_heading,
        semantic_need, contextual_alt, caption, attribution_text, disclosure_text,
        sort_order, status, selected_by, approved_by, approved_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      contentMediaId, request.content_asset_id, request.id, asset.id, slotType,
      cleanText(input.sectionHeading, 300) || null, request.semantic_need, contextualAlt,
      cleanText(input.caption, 500) || null,
      grant.attribution_required ? grant.attribution_text : cleanText(input.attributionText, 500) || null,
      asset.ai_generated === 1 ? asset.disclosure_text : null,
      Number.isInteger(Number(input.sortOrder)) ? Number(input.sortOrder) : 0,
      status, actor.actorId, actor.actorId, now, now, now,
    );
    audit(db, { entityType: "CONTENT_MEDIA", entityId: contentMediaId, action: "MEDIA_SELECTION_APPROVED", actor, details: { requestId: request.id, assetId: asset.id, contextualAlt, confirmedKind }, now });
  })();
  return db.prepare("SELECT * FROM content_media WHERE id = ?").get(contentMediaId);
}

export function listMediaLibrary(db, input = {}) {
  const sourceType = cleanText(input.sourceType, 40);
  const status = cleanText(input.status, 40);
  const limit = Math.max(1, Math.min(500, Math.trunc(Number(input.limit ?? 100))));
  return db.prepare(`
    SELECT a.*, COUNT(v.id) AS variant_count
    FROM media_assets a LEFT JOIN media_variants v ON v.media_asset_id = a.id AND v.status = 'READY'
    WHERE (? = '' OR a.source_type = ?) AND (? = '' OR a.status = ?)
    GROUP BY a.id ORDER BY a.updated_at DESC, a.id LIMIT ?
  `).all(sourceType, sourceType, status, status, limit);
}
