import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { GET as getAsset } from "../app/api/catalog-media/assets/[assetId]/route.ts";
import { PATCH as patchMedia } from "../app/api/catalog-media/[productId]/route.ts";
import { POST as postMedia } from "../app/api/catalog-media/route.ts";
import {
  catalogProductMediaAssetAccess,
  getCatalogProductMediaSettings,
  getRuntimeCatalogProductMediaUrl,
  updateCatalogProductMedia,
  uploadCatalogProductMedia,
} from "../app/data/catalogProductMediaStore.ts";
import { getFeedProductImage, getPublishedFeedCatalogSnapshot } from "../app/data/feedCatalog.ts";

const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const actor = { id:"admin-1", name:"Администратор" };
const product = { id:"test-product-1", slug:"test-product", brand:"Exact", sku:"EX-1", title:"Точный товар EX-1" };

test("catalog media keeps drafts private, validates identity and publishes exact assets", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-catalog-media-"));
  try {
    await assert.rejects(() => uploadCatalogProductMedia({ product, file:new File(["<svg></svg>"], "wrong.png", { type:"image/png" }), sourceUrl:"https://manufacturer.example/ex-1", revision:0, actor }, { dataDir }), /PNG, JPG или WebP/u);
    await assert.rejects(() => uploadCatalogProductMedia({ product, file:new File([onePixelPng], "photo.png", { type:"image/png" }), sourceUrl:"file:///secret", revision:0, actor }, { dataDir }), /публичную ссылку/u);

    const draft = await uploadCatalogProductMedia({ product, file:new File([onePixelPng], "photo.png", { type:"image/png" }), sourceUrl:"https://manufacturer.example/ex-1", revision:0, actor }, { dataDir, now:"2026-09-23T09:00:00.000Z" });
    const record = draft.records[0];
    assert.equal(draft.revision, 1);
    assert.match(record.draftAssetId, /^catalog-[0-9a-f]{64}\.png$/u);
    assert.equal(record.publishedAssetId, "");
    assert.equal(await catalogProductMediaAssetAccess(record.draftAssetId, { dataDir }), "private");
    assert.equal(getRuntimeCatalogProductMediaUrl(product, { dataDir }), undefined);

    await assert.rejects(() => updateCatalogProductMedia({ product:{ ...product, title:"Другое исполнение" }, action:"publish", revision:1, actor }, { dataDir }), /изменились/u);
    const published = await updateCatalogProductMedia({ product, action:"publish", revision:1, actor }, { dataDir, now:"2026-09-23T09:05:00.000Z" });
    assert.equal(published.revision, 2);
    assert.equal(published.records[0].draftAssetId, "");
    assert.equal(published.records[0].publishedAssetId, record.draftAssetId);
    assert.equal(await catalogProductMediaAssetAccess(record.draftAssetId, { dataDir }), "published");
    assert.equal(getRuntimeCatalogProductMediaUrl(product, { dataDir }), `/api/catalog-media/assets/${record.draftAssetId}`);
    assert.equal(getRuntimeCatalogProductMediaUrl({ ...product, sku:"CHANGED" }, { dataDir }), undefined);

    const disabled = await updateCatalogProductMedia({ product, action:"disable", revision:2, actor }, { dataDir });
    assert.equal(disabled.records[0].disabled, true);
    assert.equal(getRuntimeCatalogProductMediaUrl(product, { dataDir }), undefined);
    const restored = await updateCatalogProductMedia({ product, action:"enable", revision:3, actor }, { dataDir });
    assert.equal(restored.records[0].disabled, false);
    assert.equal(restored.records[0].events.length, 4);
    assert.equal((await getCatalogProductMediaSettings({ dataDir })).revision, 4);
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("feed image always wins over runtime media", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-catalog-feed-priority-"));
  const previous = process.env.QUOTE_TEST_DATA_DIR;
  try {
    process.env.QUOTE_TEST_DATA_DIR = dataDir;
    const draft = await uploadCatalogProductMedia({ product, file:new File([onePixelPng], "photo.png", { type:"image/png" }), sourceUrl:"https://manufacturer.example/ex-1", revision:0, actor }, { dataDir });
    await updateCatalogProductMedia({ product, action:"publish", revision:draft.revision, actor }, { dataDir });
    assert.equal(getFeedProductImage({ ...product, category:"test", images:["https://feed.example/exact.webp"], variants:[], stock:1, paramAxes:[] }), "https://feed.example/exact.webp");
  } finally {
    if (previous === undefined) delete process.env.QUOTE_TEST_DATA_DIR; else process.env.QUOTE_TEST_DATA_DIR = previous;
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("catalog media API is admin-only, same-origin and never calls an external delivery channel", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-catalog-media-api-"));
  const previous = { mode:process.env.QUOTE_TEST_MODE, dataDir:process.env.QUOTE_TEST_DATA_DIR, admins:process.env.MANAGER_AUTH_ADMIN_EMAILS };
  try {
    process.env.QUOTE_TEST_MODE = "1";
    process.env.QUOTE_TEST_DATA_DIR = dataDir;
    process.env.MANAGER_AUTH_ADMIN_EMAILS = "admin@example.test";
    const candidate = getPublishedFeedCatalogSnapshot().products.find((entry) => !entry.images.some(Boolean) && !entry.variants.some((variant) => variant.images?.some(Boolean)));
    assert.ok(candidate);
    const anonymousForm = uploadForm(candidate.id, 0);
    assert.equal((await postMedia(new Request("http://local.test/api/catalog-media", { method:"POST", body:anonymousForm }))).status, 401);
    const crossOrigin = await postMedia(new Request("http://local.test/api/catalog-media", { method:"POST", headers:staffHeaders("https://attacker.example"), body:uploadForm(candidate.id, 0) }));
    assert.equal(crossOrigin.status, 403);
    const uploaded = await postMedia(new Request("http://local.test/api/catalog-media", { method:"POST", headers:staffHeaders(), body:uploadForm(candidate.id, 0) }));
    assert.equal(uploaded.status, 201);
    const payload = await uploaded.json();
    const assetId = payload.record.draftAssetId;
    const privateAsset = await getAsset(new Request(`http://local.test/api/catalog-media/assets/${assetId}`), { params:Promise.resolve({ assetId }) });
    assert.equal(privateAsset.status, 401);
    const publish = await patchMedia(new Request(`http://local.test/api/catalog-media/${candidate.id}`, { method:"PATCH", headers:{ ...staffHeaders(), "content-type":"application/json" }, body:JSON.stringify({ action:"publish", revision:1 }) }), { params:Promise.resolve({ productId:candidate.id }) });
    assert.equal(publish.status, 200);
    const publicAsset = await getAsset(new Request(`http://local.test/api/catalog-media/assets/${assetId}`), { params:Promise.resolve({ assetId }) });
    assert.equal(publicAsset.status, 200);
    assert.equal(publicAsset.headers.get("content-type"), "image/png");
    const sources = await Promise.all([
      readFile(new URL("../app/api/catalog-media/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/catalog-media/[productId]/route.ts", import.meta.url), "utf8"),
    ]);
    assert.doesNotMatch(sources.join("\n"), /sendMail|smtp|crm\.|fetch\(["']https/iu);
  } finally {
    restoreEnv("QUOTE_TEST_MODE", previous.mode);
    restoreEnv("QUOTE_TEST_DATA_DIR", previous.dataDir);
    restoreEnv("MANAGER_AUTH_ADMIN_EMAILS", previous.admins);
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("catalog media workspace exposes queue, source proof, preview and audit controls", async () => {
  const [page, form, productPage, gallery, header, styles] = await Promise.all([
    readFile(new URL("../app/test/catalog-media/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/CatalogMediaManager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/product/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/FeedProductGallery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/PilotHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /requireManagerPageAccess\("settings:manage"/u);
  assert.match(page, /stocked_source_ready/u);
  assert.match(form, /Точная страница-источник/u);
  assert.match(form, /Предпросмотр в каталоге/u);
  assert.match(form, /Журнал действий/u);
  assert.match(form, /Опубликовать черновик/u);
  assert.match(productPage, /getFeedProductImage\(product\)/u);
  assert.match(gallery, /Проверенное фото товара/u);
  assert.match(header, /\/test\/catalog-media/u);
  assert.match(styles, /\.catalog-media-item/u);
  assert.match(styles, /@media \(max-width:680px\)/u);
});

function uploadForm(productId, revision) {
  const form = new FormData();
  form.set("productId", productId);
  form.set("revision", String(revision));
  form.set("sourceUrl", "https://manufacturer.example/exact-product");
  form.set("file", new File([onePixelPng], "photo.png", { type:"image/png" }));
  return form;
}

function staffHeaders(origin = "http://local.test") {
  return { origin, "oai-authenticated-user-id":"admin-1", "oai-authenticated-user-email":"admin@example.test" };
}

function restoreEnv(key, value) {
  if (value === undefined) delete process.env[key]; else process.env[key] = value;
}
