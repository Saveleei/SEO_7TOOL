import { createHash, randomUUID } from "node:crypto";

export const FEED_PARSER_VERSION = "7tool-yml-v1";
export const FEED_FACT_SCHEMA_VERSION = "supplier-facts-v1";

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function safeSourceLabel(value) {
  if (!value) return "configured supplier feed";
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "local supplier feed";
  }
}

function factValue(value) {
  if (typeof value === "number") return { value_number: value, value_text: null, value_json: null };
  if (typeof value === "boolean") return { value_number: value ? 1 : 0, value_text: null, value_json: null };
  if (typeof value === "string") return { value_number: null, value_text: value, value_json: null };
  return { value_number: null, value_text: null, value_json: JSON.stringify(value) };
}

export function offerFacts(offer) {
  const candidates = [
    ["name", offer.name], ["sku", offer.sku], ["vendor", offer.vendor],
    ["category_id", offer.categoryId], ["description", offer.description],
    ["barcode", offer.barcode], ["price", offer.price], ["old_price", offer.oldPrice],
    ["quantity", offer.quantity], ["available", offer.available], ["group", offer.group],
    ["group_id", offer.groupId], ["status", offer.status],
    ["parameters", offer.params?.length ? offer.params : undefined],
    ["images", offer.pictures?.length ? offer.pictures : undefined],
    ["accessories", offer.accessories?.length ? offer.accessories : undefined],
  ];
  return candidates.filter(([, value]) => value !== undefined && value !== null && value !== "");
}

export function recordFeedObservation(db, { sourceId, sourceName, sourceUrl, xml, offers, artifactRef = null }) {
  const required = ["sources", "import_runs", "source_facts"];
  const present = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
  const missing = required.filter((name) => !present.has(name));
  if (missing.length) throw new Error(`Supplier provenance schema is not applied: ${missing.join(", ")}`);

  const now = Date.now();
  const runId = randomUUID();
  const inputChecksum = sha256(xml);
  const sourceBaseUrl = sourceUrl ? safeSourceLabel(sourceUrl) : null;
  const upsertSource = db.prepare(`
    INSERT INTO sources (id, source_type, name, base_url, rights_policy, active, created_at, updated_at)
    VALUES (?, 'SUPPLIER_FEED', ?, ?, 'CONTRACT_REQUIRED', 1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, base_url = excluded.base_url,
      active = 1, updated_at = excluded.updated_at
  `);
  const insertRun = db.prepare(`
    INSERT INTO import_runs (id, source_id, started_at, completed_at, status, input_checksum,
      record_count, rejected_count, parser_version, schema_version, artifact_ref)
    VALUES (?, ?, ?, ?, 'SUCCEEDED', ?, ?, 0, ?, ?, ?)
  `);
  const insertFact = db.prepare(`
    INSERT INTO source_facts (id, source_id, import_run_id, subject_type, subject_id, predicate,
      value_text, value_number, value_json, observed_at, source_locator, checksum, status)
    VALUES (@id, @source_id, @import_run_id, 'SUPPLIER_OFFER', @subject_id, @predicate,
      @value_text, @value_number, @value_json, @observed_at, @source_locator, @checksum, 'OBSERVED')
  `);

  db.transaction(() => {
    upsertSource.run(sourceId, sourceName, sourceBaseUrl, now, now);
    insertRun.run(runId, sourceId, now, now, inputChecksum, offers.length,
      FEED_PARSER_VERSION, FEED_FACT_SCHEMA_VERSION, artifactRef);
    for (const offer of offers) {
      for (const [predicate, rawValue] of offerFacts(offer)) {
        const serialized = typeof rawValue === "object" ? JSON.stringify(rawValue) : String(rawValue);
        const checksum = sha256(`${offer.id}\u0000${predicate}\u0000${serialized}`);
        insertFact.run({
          id: sha256(`${runId}\u0000${checksum}`), source_id: sourceId, import_run_id: runId,
          subject_id: offer.id, predicate, ...factValue(rawValue), observed_at: now,
          source_locator: `offer:${offer.id}`, checksum,
        });
      }
    }
  })();
  return { runId, inputChecksum, factCount: db.prepare("SELECT COUNT(*) AS n FROM source_facts WHERE import_run_id = ?").get(runId).n };
}
