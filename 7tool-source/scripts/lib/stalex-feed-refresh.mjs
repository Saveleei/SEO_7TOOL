import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildStalexPreview } from "./stalex-feed-preview.mjs";

const DEFAULT_STALE_LOCK_MS = 6 * 60 * 60 * 1_000;

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function recordFingerprint(record) {
  return sha256(JSON.stringify({
    active: record.active,
    availability: record.availability,
    category: record.category,
    descriptionPreview: record.descriptionPreview,
    image: record.image,
    issues: record.issues,
    name: record.name,
    oldPriceRub: record.oldPriceRub,
    priceRub: record.priceRub,
    sku: record.sku,
    sourceData: record.sourceData,
    warranty: record.warranty,
  }));
}

function readJsonIfPresent(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function diffStalexSnapshots(previousRecords = [], currentRecords = []) {
  const previous = new Map(previousRecords.map((record) => [record.id, record]));
  const current = new Map(currentRecords.map((record) => [record.id, record]));
  const added = [];
  const removed = [];
  const changed = [];
  const priceChanged = [];
  const availabilityChanged = [];

  for (const [id, record] of current) {
    const before = previous.get(id);
    if (!before) {
      added.push(id);
      continue;
    }
    if (recordFingerprint(before) !== recordFingerprint(record)) changed.push(id);
    if (before.priceRub !== record.priceRub || before.oldPriceRub !== record.oldPriceRub) priceChanged.push(id);
    if (before.availability?.code !== record.availability?.code
      || before.availability?.stock !== record.availability?.stock
      || before.availability?.quantity !== record.availability?.quantity) {
      availabilityChanged.push(id);
    }
  }
  for (const id of previous.keys()) {
    if (!current.has(id)) removed.push(id);
  }
  return {
    previousRecords: previous.size,
    currentRecords: current.size,
    added: added.length,
    removed: removed.length,
    changed: changed.length,
    priceChanged: priceChanged.length,
    availabilityChanged: availabilityChanged.length,
    sampleIds: {
      added: added.slice(0, 20),
      removed: removed.slice(0, 20),
      changed: changed.slice(0, 20),
    },
  };
}

export function validateStalexSnapshot(snapshot, { minModifications = 1, minRetainedRatio = 0.9 } = {}) {
  if (snapshot.publicationEnabled !== false || snapshot.summary?.storefrontPublishable !== 0) {
    throw new Error("Stalex snapshot must keep storefront publication disabled");
  }
  if (!Array.isArray(snapshot.records) || snapshot.records.length !== snapshot.summary?.modifications) {
    throw new Error("Stalex snapshot record count does not match the parsed feed summary");
  }
  if (snapshot.records.length < minModifications) {
    throw new Error(`Stalex feed contains ${snapshot.records.length} modifications; minimum is ${minModifications}`);
  }
  const previousRecords = Number(snapshot.changes?.previousRecords || 0);
  if (previousRecords > 0 && snapshot.records.length < Math.ceil(previousRecords * minRetainedRatio)) {
    throw new Error(`Stalex feed retained ${snapshot.records.length} of ${previousRecords} previous records; minimum ratio is ${minRetainedRatio}`);
  }
  const ids = new Set(snapshot.records.map((record) => record.id));
  if (ids.size !== snapshot.records.length) throw new Error("Stalex feed contains duplicate modification ids");
  if (!snapshot.records.some((record) => record.active)) throw new Error("Stalex feed contains no active modifications");
  if (snapshot.records.some((record) => record.storefrontPublishable !== false)) {
    throw new Error("Stalex daily refresh cannot mark records as storefront publishable");
  }
  if (snapshot.records.some((record) => record.availability?.canPromiseToday !== false)) {
    throw new Error("Stalex supplier stock cannot promise same-day dispatch");
  }
  const warrantyMonths = Number(snapshot.commercialGate?.warrantyOverrideMonths);
  if (Number.isFinite(warrantyMonths)
    && snapshot.records.some((record) => record.warranty !== `${warrantyMonths} месяцев`)) {
    throw new Error("Stalex warranty override was not applied to every record");
  }
  return snapshot;
}

export function writeJsonAtomic(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const temporary = path.join(
    path.dirname(resolved),
    `.${path.basename(resolved)}.${process.pid}.${crypto.randomUUID()}.tmp`,
  );
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    fs.renameSync(temporary, resolved);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

export function acquireStalexLock(lockPath, { now = Date.now(), staleMs = DEFAULT_STALE_LOCK_MS } = {}) {
  const resolved = path.resolve(lockPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  if (fs.existsSync(resolved)) {
    const ageMs = now - fs.statSync(resolved).mtimeMs;
    if (ageMs <= staleMs) {
      const error = new Error(`Stalex refresh is already running (lock: ${resolved})`);
      error.code = "STALEX_LOCKED";
      throw error;
    }
    fs.unlinkSync(resolved);
  }
  const token = crypto.randomUUID();
  fs.writeFileSync(resolved, `${JSON.stringify({ pid: process.pid, startedAt: new Date(now).toISOString(), token })}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  return () => {
    const lock = readJsonIfPresent(resolved);
    if (lock?.token === token) fs.unlinkSync(resolved);
  };
}

export function buildValidatedStalexSnapshot({
  catalogXml,
  modificationsXml,
  policy,
  previousSnapshot = null,
  sources = {},
  refreshedAt = new Date().toISOString(),
  minModifications = 1,
  minRetainedRatio = 0.9,
}) {
  const preview = buildStalexPreview({ catalogXml, modificationsXml, policy, includeRecords: true });
  const snapshot = {
    schemaVersion: 1,
    kind: "stalex-last-good",
    status: "validated",
    refreshedAt,
    publicationEnabled: false,
    sources,
    sourceChecksums: {
      catalogSha256: sha256(catalogXml),
      modificationsSha256: sha256(modificationsXml),
    },
    commercialGate: preview.commercialGate,
    summary: preview.summary,
    categories: preview.categories,
    sourceSchema: preview.sourceSchema,
    changes: diffStalexSnapshots(previousSnapshot?.records, preview.records),
    records: preview.records,
    safety: {
      writesStorefrontCatalog: false,
      writesDatabase: false,
      publishesProducts: false,
      preservesLastGoodOnFailure: true,
    },
  };
  return validateStalexSnapshot(snapshot, { minModifications, minRetainedRatio });
}

export function persistValidatedStalexSnapshot({
  catalogXml,
  modificationsXml,
  policy,
  outputPath,
  lockPath = `${outputPath}.lock`,
  statusPath = `${outputPath}.status.json`,
  sources = {},
  refreshedAt = new Date().toISOString(),
  minModifications = 1,
  minRetainedRatio = 0.9,
  staleLockMs = DEFAULT_STALE_LOCK_MS,
  lockAlreadyHeld = false,
}) {
  const release = lockAlreadyHeld ? () => {} : acquireStalexLock(lockPath, { staleMs: staleLockMs });
  try {
    const previousSnapshot = readJsonIfPresent(outputPath);
    const snapshot = buildValidatedStalexSnapshot({
      catalogXml,
      modificationsXml,
      policy,
      previousSnapshot,
      sources,
      refreshedAt,
      minModifications,
      minRetainedRatio,
    });
    writeJsonAtomic(outputPath, snapshot);
    writeJsonAtomic(statusPath, {
      status: "ok",
      completedAt: refreshedAt,
      snapshotPath: path.resolve(outputPath),
      summary: snapshot.summary,
      changes: snapshot.changes,
    });
    return snapshot;
  } finally {
    release();
  }
}

export function writeStalexRefreshFailure(statusPath, error, outputPath) {
  const lastGood = readJsonIfPresent(outputPath);
  writeJsonAtomic(statusPath, {
    status: "error",
    failedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    lastGoodPreserved: Boolean(lastGood?.status === "validated"),
    lastGoodRefreshedAt: lastGood?.refreshedAt || null,
  });
}
