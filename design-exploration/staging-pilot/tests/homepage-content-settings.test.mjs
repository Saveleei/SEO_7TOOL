import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DELETE as resetContent, GET as getContent, PUT as putContent } from "../app/api/homepage-content/route.ts";
import { GET as getAsset } from "../app/api/homepage-content/assets/[assetId]/route.ts";
import { saveHomepageAsset } from "../app/data/homepageAssetStore.ts";
import { DEFAULT_HOMEPAGE_CONTENT_SETTINGS, getHomepageContentSettings, resetHomepageContentSettings, saveHomepageContentSettings } from "../app/data/homepageContentStore.ts";
import { HOMEPAGE_ASSORTMENT_IDS, HOMEPAGE_CATEGORY_IDS, validateHomepageContentSettings } from "../app/data/homepageContentValidation.mjs";

const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

test("homepage validation keeps catalog destinations complete but permits editorial ordering", () => {
  const valid = cloneDefaults();
  assert.equal(validateHomepageContentSettings(valid).ok, true);
  assert.deepEqual(new Set(valid.assortmentItems.map((item) => item.id)), new Set(HOMEPAGE_ASSORTMENT_IDS));
  assert.deepEqual(new Set(valid.categoryItems.map((item) => item.id)), new Set(HOMEPAGE_CATEGORY_IDS));
  assert.equal(validateHomepageContentSettings({ ...valid, categoryItems:[...valid.categoryItems].reverse() }).ok, true);
  assert.equal(validateHomepageContentSettings({ ...valid, hero:{ ...valid.hero, title:"" } }).ok, false);
  assert.equal(validateHomepageContentSettings({ ...valid, categoryItems:valid.categoryItems.map((item, index) => index === 1 ? { ...item, id:valid.categoryItems[0].id } : item) }).ok, false);
  assert.equal(validateHomepageContentSettings({ ...valid, assortmentItems:valid.assortmentItems.map((item, index) => index === 0 ? { ...item, imageFit:"stretch" } : item) }).ok, false);
  assert.equal(validateHomepageContentSettings({ ...valid, assortmentItems:valid.assortmentItems.map((item, index) => index === 0 ? { ...item, imageAssetId:"../../secret.png" } : item) }).ok, false);
});

test("homepage content persists atomically, checks revisions and restores defaults", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-homepage-content-"));
  try {
    const first = await saveHomepageContentSettings({ ...cloneDefaults(), hero:{ ...cloneDefaults().hero, title:"Редактируемая промышленная витрина" }, categoryItems:[...cloneDefaults().categoryItems].reverse() }, { dataDir, now:"2026-09-15T11:00:00.000Z" });
    assert.equal(first.revision, 1);
    const stored = await getHomepageContentSettings({ dataDir });
    assert.equal(stored.hero.title, "Редактируемая промышленная витрина");
    assert.equal(stored.categoryItems[0].id, DEFAULT_HOMEPAGE_CONTENT_SETTINGS.categoryItems.at(-1).id);
    await assert.rejects(() => saveHomepageContentSettings({ ...cloneDefaults(), hero:{ ...cloneDefaults().hero, title:"Устаревшее изменение" } }, { dataDir }), /другой вкладке/u);
    const restored = await resetHomepageContentSettings(first.revision, { dataDir, now:"2026-09-15T12:00:00.000Z" });
    assert.equal(restored.revision, 2);
    assert.equal(restored.hero.title, DEFAULT_HOMEPAGE_CONTENT_SETTINGS.hero.title);
    const raw = await readFile(path.join(dataDir, "settings", "homepage-content.json"), "utf8");
    assert.doesNotMatch(raw, /Устаревшее изменение/u);
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("homepage photos are signature-checked, publicly readable by hash and safely fall back", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-homepage-assets-"));
  const previousDataDir = process.env.QUOTE_TEST_DATA_DIR;
  try {
    process.env.QUOTE_TEST_DATA_DIR = dataDir;
    await assert.rejects(() => saveHomepageAsset(new File(["<svg></svg>"], "photo.png", { type:"image/png" }), { dataDir }), /PNG, JPG или WebP/u);
    const asset = await saveHomepageAsset(new File([onePixelPng], "photo.png", { type:"image/png" }), { dataDir });
    assert.match(asset.assetId, /^homepage-[0-9a-f]{64}\.png$/u);
    const input = cloneDefaults();
    input.categoryItems[0].imageAssetId = asset.assetId;
    const saved = await saveHomepageContentSettings(input, { dataDir });
    assert.equal(saved.categoryItems[0].imageAssetId, asset.assetId);
    const response = await getAsset(new Request(`http://local.test/api/homepage-content/assets/${asset.assetId}`), { params:Promise.resolve({ assetId:asset.assetId }) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    await rm(path.join(dataDir, "settings", "homepage-content-assets", asset.assetId));
    assert.equal((await getHomepageContentSettings({ dataDir })).categoryItems[0].imageAssetId, "");
  } finally {
    if (previousDataDir === undefined) delete process.env.QUOTE_TEST_DATA_DIR; else process.env.QUOTE_TEST_DATA_DIR = previousDataDir;
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("homepage settings API is administrator-only, same-origin and has an explicit reset", async () => {
  const previousMode = process.env.QUOTE_TEST_MODE;
  const previousDataDir = process.env.QUOTE_TEST_DATA_DIR;
  const previousAdmins = process.env.MANAGER_AUTH_ADMIN_EMAILS;
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-homepage-api-"));
  try {
    process.env.QUOTE_TEST_MODE = "0";
    assert.equal((await getContent(new Request("http://local.test/api/homepage-content"))).status, 503);
    process.env.QUOTE_TEST_MODE = "1";
    process.env.QUOTE_TEST_DATA_DIR = dataDir;
    process.env.MANAGER_AUTH_ADMIN_EMAILS = "admin@example.test";
    assert.equal((await getContent(new Request("http://local.test/api/homepage-content"))).status, 401);
    assert.equal((await getContent(new Request("http://local.test/api/homepage-content", { headers:staffHeaders() }))).status, 200);
    const crossOrigin = await putContent(new Request("http://local.test/api/homepage-content", { method:"PUT", headers:staffHeaders("https://attacker.example", true), body:JSON.stringify(cloneDefaults()) }));
    assert.equal(crossOrigin.status, 403);
    const sameOrigin = await putContent(new Request("http://local.test/api/homepage-content", { method:"PUT", headers:staffHeaders("http://local.test", true), body:JSON.stringify({ ...cloneDefaults(), categories:{ ...cloneDefaults().categories, title:"Выберите раздел оборудования" } }) }));
    assert.equal(sameOrigin.status, 200);
    const reset = await resetContent(new Request("http://local.test/api/homepage-content", { method:"DELETE", headers:staffHeaders("http://local.test", true), body:JSON.stringify({ revision:1 }) }));
    assert.equal(reset.status, 200);
    assert.equal((await reset.json()).settings.categories.title, DEFAULT_HOMEPAGE_CONTENT_SETTINGS.categories.title);
    const api = await readFile(new URL("../app/api/homepage-content/route.ts", import.meta.url), "utf8");
    const uploadApi = await readFile(new URL("../app/api/homepage-content/assets/route.ts", import.meta.url), "utf8");
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

test("homepage reads editable content and enforces stable media frames", async () => {
  const [page, tiles, styles, settingsPage] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/HomepageCategoryTiles.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/test/settings/homepage/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /getHomepageContentSettings/u);
  assert.match(page, /homepageContent\.assortmentItems/u);
  assert.match(tiles, /data-fit/u);
  assert.match(styles, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\); grid-auto-rows:216px/u);
  assert.match(styles, /\.hero-assortment-map>a \{ height:120px; min-height:120px/u);
  assert.match(styles, /data-fit="cover"/u);
  assert.match(settingsPage, /requireManagerPageAccess\("settings:manage"/u);
});

function staffHeaders(origin = "http://local.test", json = false) {
  return { origin, ...(json ? { "content-type":"application/json" } : {}), "oai-authenticated-user-id":"admin-1", "oai-authenticated-user-email":"admin@example.test" };
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_CONTENT_SETTINGS));
}
