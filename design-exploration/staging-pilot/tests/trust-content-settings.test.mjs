import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DELETE as resetContent, GET as getContent, PUT as putContent } from "../app/api/trust-content/route.ts";
import { GET as getAsset } from "../app/api/trust-content/assets/[assetId]/route.ts";
import { saveTrustAsset } from "../app/data/trustAssetStore.ts";
import { DEFAULT_TRUST_CONTENT_SETTINGS, getTrustContentSettings, resetTrustContentSettings, saveTrustContentSettings } from "../app/data/trustContentStore.ts";
import { TRUST_CARD_PRESENTATION } from "../app/data/trustContentModel.ts";
import { validateTrustContentSettings } from "../app/data/trustContentValidation.mjs";

const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

test("trust content validation preserves six stable photo purposes", () => {
  const valid = cloneDefaults();
  assert.equal(valid.cards.length, 6);
  assert.equal(validateTrustContentSettings(valid).ok, true);
  assert.equal(validateTrustContentSettings({ ...valid, sectionTitle:"" }).ok, false);
  assert.equal(validateTrustContentSettings({ ...valid, cards:[...valid.cards].reverse() }).ok, false);
  assert.equal(validateTrustContentSettings({ ...valid, cards:valid.cards.map((card, index) => index === 0 ? { ...card, imageAssetId:"../../secret.png" } : card) }).ok, false);
});

test("legacy three-card trust settings gain the new photos without losing saved content", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-trust-legacy-"));
  try {
    const legacy = cloneDefaults();
    legacy.cards = legacy.cards.slice(0, 3);
    legacy.cards[0].title = "Сохранённый заголовок склада";
    assert.equal(validateTrustContentSettings(legacy).ok, true);
    const saved = await saveTrustContentSettings(legacy, { dataDir });
    assert.equal(saved.cards.length, 6);
    assert.equal(saved.cards[0].title, "Сохранённый заголовок склада");
    assert.equal(saved.cards[5].id, "selection");
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("trust links use existing public routes", () => {
  assert.equal(TRUST_CARD_PRESENTATION.terms.href, "/delivery");
  assert.equal(TRUST_CARD_PRESENTATION.selection.href, "/catalog");
});

test("trust content persists atomically, checks revisions and restores defaults", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-trust-content-"));
  try {
    const first = await saveTrustContentSettings({ ...cloneDefaults(), sectionTitle:"Проверяем закупку до оплаты" }, { dataDir, now:"2026-09-15T08:00:00.000Z" });
    assert.equal(first.revision, 1);
    assert.equal((await getTrustContentSettings({ dataDir })).sectionTitle, "Проверяем закупку до оплаты");
    await assert.rejects(() => saveTrustContentSettings({ ...cloneDefaults(), sectionTitle:"Устаревшая версия" }, { dataDir }), /другой вкладке/u);
    const restored = await resetTrustContentSettings(first.revision, { dataDir, now:"2026-09-15T09:00:00.000Z" });
    assert.equal(restored.revision, 2);
    assert.equal(restored.sectionTitle, DEFAULT_TRUST_CONTENT_SETTINGS.sectionTitle);
    const stored = await readFile(path.join(dataDir, "settings", "trust-content.json"), "utf8");
    assert.doesNotMatch(stored, /Устаревшая версия/u);
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("trust photos are signature-checked and missing assets fall back safely", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-trust-assets-"));
  const previousDataDir = process.env.QUOTE_TEST_DATA_DIR;
  try {
    process.env.QUOTE_TEST_DATA_DIR = dataDir;
    await assert.rejects(() => saveTrustAsset(new File(["<svg></svg>"], "photo.png", { type:"image/png" }), { dataDir }), /PNG, JPG или WebP/u);
    const asset = await saveTrustAsset(new File([onePixelPng], "photo.png", { type:"image/png" }), { dataDir });
    assert.match(asset.assetId, /^trust-[0-9a-f]{64}\.png$/u);
    const input = cloneDefaults();
    input.cards[0].imageAssetId = asset.assetId;
    const saved = await saveTrustContentSettings(input, { dataDir });
    assert.equal(saved.cards[0].imageAssetId, asset.assetId);
    const response = await getAsset(new Request(`http://local.test/api/trust-content/assets/${asset.assetId}`), { params:Promise.resolve({ assetId:asset.assetId }) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    const filePath = path.join(dataDir, "settings", "trust-content-assets", asset.assetId);
    await rm(filePath);
    assert.equal((await getTrustContentSettings({ dataDir })).cards[0].imageAssetId, "");
  } finally {
    if (previousDataDir === undefined) delete process.env.QUOTE_TEST_DATA_DIR; else process.env.QUOTE_TEST_DATA_DIR = previousDataDir;
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("trust settings API is administrator-only, same-origin and has an explicit reset", async () => {
  const previousMode = process.env.QUOTE_TEST_MODE;
  const previousDataDir = process.env.QUOTE_TEST_DATA_DIR;
  const previousAdmins = process.env.MANAGER_AUTH_ADMIN_EMAILS;
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-trust-api-"));
  try {
    process.env.QUOTE_TEST_MODE = "0";
    assert.equal((await getContent(new Request("http://local.test/api/trust-content"))).status, 503);
    process.env.QUOTE_TEST_MODE = "1";
    process.env.QUOTE_TEST_DATA_DIR = dataDir;
    process.env.MANAGER_AUTH_ADMIN_EMAILS = "admin@example.test";
    assert.equal((await getContent(new Request("http://local.test/api/trust-content"))).status, 401);
    assert.equal((await getContent(new Request("http://local.test/api/trust-content", { headers:staffHeaders() }))).status, 200);
    const crossOrigin = await putContent(new Request("http://local.test/api/trust-content", { method:"PUT", headers:staffHeaders("https://attacker.example", true), body:JSON.stringify(cloneDefaults()) }));
    assert.equal(crossOrigin.status, 403);
    const sameOrigin = await putContent(new Request("http://local.test/api/trust-content", { method:"PUT", headers:staffHeaders("http://local.test", true), body:JSON.stringify({ ...cloneDefaults(), sectionTitle:"Проверено администратором" }) }));
    assert.equal(sameOrigin.status, 200);
    const reset = await resetContent(new Request("http://local.test/api/trust-content", { method:"DELETE", headers:staffHeaders("http://local.test", true), body:JSON.stringify({ revision:1 }) }));
    assert.equal(reset.status, 200);
    assert.equal((await reset.json()).settings.sectionTitle, DEFAULT_TRUST_CONTENT_SETTINGS.sectionTitle);
    const api = await readFile(new URL("../app/api/trust-content/route.ts", import.meta.url), "utf8");
    const uploadApi = await readFile(new URL("../app/api/trust-content/assets/route.ts", import.meta.url), "utf8");
    assert.match(api, /authorizeManagerRequest/u);
    assert.match(api, /isSameOriginRequest\(request\)/u);
    assert.match(uploadApi, /isSameOriginRequest\(request\)/u);
    assert.doesNotMatch(`${api}\n${uploadApi}`, /sendMail|smtp|crm\.|fetch\(["']https/iu);
  } finally {
    if (previousMode === undefined) delete process.env.QUOTE_TEST_MODE; else process.env.QUOTE_TEST_MODE = previousMode;
    if (previousDataDir === undefined) delete process.env.QUOTE_TEST_DATA_DIR; else process.env.QUOTE_TEST_DATA_DIR = previousDataDir;
    if (previousAdmins === undefined) delete process.env.MANAGER_AUTH_ADMIN_EMAILS; else process.env.MANAGER_AUTH_ADMIN_EMAILS = previousAdmins;
    await rm(dataDir, { recursive:true, force:true });
  }
});

function staffHeaders(origin = "http://local.test", json = false) {
  return { origin, ...(json ? { "content-type":"application/json" } : {}), "oai-authenticated-user-id":"admin-1", "oai-authenticated-user-email":"admin@example.test" };
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_TRUST_CONTENT_SETTINGS));
}
