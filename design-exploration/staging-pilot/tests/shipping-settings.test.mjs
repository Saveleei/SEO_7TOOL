import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { GET as getSettingsApi, PUT as putSettingsApi } from "../app/api/shipping-settings/route.ts";
import { getShippingSettings, saveShippingSettings } from "../app/data/shippingSettingsStore.ts";
import { getVariantShippingPromise } from "../app/data/shippingPromise.mjs";
import {
  getShippingRuntimeDiagnostic,
  invalidateCatalogSnapshotMetadataCache,
  invalidateShippingRuntimeSettingsCache,
  registerCatalogSnapshotSha256,
} from "../app/data/shippingRuntimeSettings.mjs";
import { validateShippingSettings } from "../app/data/shippingSettingsValidation.mjs";

test("shipping settings validate cutoff, freshness window, calendar and work days", () => {
  assert.equal(validateShippingSettings(validInput()).ok, true);
  assert.equal(validateShippingSettings({ ...validInput(), cutoffHour:24 }).ok, false);
  assert.equal(validateShippingSettings({ ...validInput(), maxSnapshotAgeMinutes:5 }).ok, false);
  assert.equal(validateShippingSettings({ ...validInput(), workingDays:[] }).ok, false);
  assert.equal(validateShippingSettings({ ...validInput(), holidays:["04.11.2026"] }).ok, false);
});

test("shipping settings persist atomically and reject a stale revision", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-shipping-settings-"));
  try {
    const initial = await getShippingSettings({ dataDir });
    assert.equal(initial.cutoffHour, 18);
    const first = await saveShippingSettings({ ...validInput(), cutoffHour:17 }, { dataDir, now:"2026-09-14T12:00:00.000Z" });
    assert.equal(first.revision, 1);
    assert.equal((await getShippingSettings({ dataDir })).cutoffHour, 17);
    await assert.rejects(() => saveShippingSettings({ ...validInput(), cutoffHour:19 }, { dataDir }), /другой вкладке/u);
    const stored = JSON.parse(await readFile(path.join(dataDir, "settings", "shipping.json"), "utf8"));
    assert.equal(stored.cutoffHour, 17);
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("buyer promises read persisted administrator rules and fail closed on corruption", async () => {
  const snapshot = snapshotEnv(["QUOTE_TEST_DATA_DIR", "CATALOG_SNAPSHOT_UPDATED_AT"]);
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-shipping-runtime-"));
  try {
    process.env.QUOTE_TEST_DATA_DIR = dataDir;
    process.env.CATALOG_SNAPSHOT_UPDATED_AT = "2026-09-14T14:45:00.000Z";
    await saveShippingSettings({ ...validInput(), cutoffHour:19 }, { dataDir });
    invalidateShippingRuntimeSettingsCache();
    assert.equal(getShippingRuntimeDiagnostic(new Date("2026-09-14T15:00:00.000Z")).settings.cutoffHour, 19);
    assert.equal(getVariantShippingPromise({ available:true, quantity:2 }, { now:new Date("2026-09-14T15:00:00.000Z") }).state, "today");
    await mkdir(path.join(dataDir, "settings"), { recursive:true });
    await writeFile(path.join(dataDir, "settings", "shipping.json"), "{broken", "utf8");
    invalidateShippingRuntimeSettingsCache();
    assert.equal(getVariantShippingPromise({ available:true, quantity:2 }, { now:new Date("2026-09-14T15:00:00.000Z") }).reason, "shipping-disabled");
  } finally {
    invalidateShippingRuntimeSettingsCache();
    restoreEnv(snapshot);
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("runtime metadata must identify the exact catalog loaded by the storefront", async () => {
  const snapshot = snapshotEnv(["CATALOG_SNAPSHOT_META_PATH", "CATALOG_SNAPSHOT_UPDATED_AT"]);
  const directory = await mkdtemp(path.join(os.tmpdir(), "7tool-shipping-identity-"));
  const metadataPath = path.join(directory, "catalog-snapshot-meta.json");
  try {
    process.env.CATALOG_SNAPSHOT_META_PATH = metadataPath;
    delete process.env.CATALOG_SNAPSHOT_UPDATED_AT;
    registerCatalogSnapshotSha256("catalog-a");
    await writeFile(metadataPath, JSON.stringify({ status:"complete", completedAt:"2026-09-14T14:45:00.000Z", catalogSha256:"catalog-a" }), "utf8");
    invalidateCatalogSnapshotMetadataCache();
    const matching = getShippingRuntimeDiagnostic(new Date("2026-09-14T14:59:00.000Z"));
    assert.equal(matching.fresh, true);
    assert.equal(matching.snapshotIdentityMatches, true);

    await writeFile(metadataPath, JSON.stringify({ status:"complete", completedAt:"2026-09-14T14:50:00.000Z", catalogSha256:"catalog-b" }), "utf8");
    invalidateCatalogSnapshotMetadataCache();
    const mismatched = getShippingRuntimeDiagnostic(new Date("2026-09-14T14:59:00.000Z"));
    assert.equal(mismatched.fresh, false);
    assert.equal(mismatched.snapshotIdentityMatches, false);
  } finally {
    registerCatalogSnapshotSha256("");
    invalidateCatalogSnapshotMetadataCache();
    restoreEnv(snapshot);
    await rm(directory, { recursive:true, force:true });
  }
});

test("shipping settings API requires admin access and same origin", async () => {
  const snapshot = snapshotEnv(["QUOTE_TEST_MODE", "QUOTE_TEST_DATA_DIR", "MANAGER_AUTH_ADMIN_EMAILS"]);
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-shipping-settings-api-"));
  try {
    process.env.QUOTE_TEST_MODE = "0";
    assert.equal((await getSettingsApi(new Request("http://local.test/api/shipping-settings"))).status, 503);
    process.env.QUOTE_TEST_MODE = "1";
    process.env.QUOTE_TEST_DATA_DIR = dataDir;
    process.env.MANAGER_AUTH_ADMIN_EMAILS = "admin@example.test";
    assert.equal((await getSettingsApi(new Request("http://local.test/api/shipping-settings"))).status, 401);
    assert.equal((await getSettingsApi(new Request("http://local.test/api/shipping-settings", { headers:staffHeaders() }))).status, 200);
    const crossOrigin = await putSettingsApi(new Request("http://local.test/api/shipping-settings", { method:"PUT", headers:staffHeaders("https://attacker.example", true), body:JSON.stringify(validInput()) }));
    assert.equal(crossOrigin.status, 403);
    const sameOrigin = await putSettingsApi(new Request("http://local.test/api/shipping-settings", { method:"PUT", headers:staffHeaders("http://local.test", true), body:JSON.stringify(validInput()) }));
    assert.equal(sameOrigin.status, 200);
    assert.equal((await sameOrigin.json()).settings.revision, 1);
  } finally {
    restoreEnv(snapshot);
    await rm(dataDir, { recursive:true, force:true });
  }
});

function validInput() {
  return { revision:0, todayShippingEnabled:true, cutoffHour:18, workingDays:[1, 2, 3, 4, 5], holidays:["2026-11-04"], maxSnapshotAgeMinutes:180 };
}

function staffHeaders(origin = "http://local.test", json = false) {
  return { origin, ...(json ? { "content-type":"application/json" } : {}), "oai-authenticated-user-id":"admin-1", "oai-authenticated-user-email":"admin@example.test" };
}

function snapshotEnv(names) {
  return Object.fromEntries(names.map((name) => [name, process.env[name]]));
}

function restoreEnv(snapshot) {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
}
