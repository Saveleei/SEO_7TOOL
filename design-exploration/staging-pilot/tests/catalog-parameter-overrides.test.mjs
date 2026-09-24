import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  applyRuntimeCatalogParameterOverrides,
  catalogParameterOverrideState,
  getCatalogParameterOverrideSettings,
  getRuntimeCatalogParameterOverrideRevision,
  saveCatalogParameterOverrideDraft,
  updateCatalogParameterOverride,
} from "../app/data/catalogParameterOverrideStore.ts";
import { canManager } from "../app/data/managerAccess.ts";

const actor = { id:"admin-1", name:"Администратор" };
const product = {
  id:"product-1",
  slug:"product-1",
  brand:"LENZ",
  sku:"SERIES-1",
  title:"Тестовая серия",
  variants:[
    { id:"variant-10", sku:"V-10", name:"Ø10" },
    { id:"variant-20", sku:"V-20", name:"Ø20" },
  ],
};
const runtimeProduct = {
  ...product,
  category:"test",
  images:[],
  stock:0,
  paramAxes:[],
  variants:[
    { ...product.variants[0], available:false, params:[{ name:"Материал", value:"не указан" }] },
    { ...product.variants[1], available:false, params:[] },
  ],
};

test("catalog parameter overrides stay private as drafts and publish by explicit scope", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-parameter-overrides-"));
  try {
    await assert.rejects(() => saveCatalogParameterOverrideDraft({ product, parameters:[{ target:"variant", variantId:"missing", name:"Диаметр", value:"10", unit:"мм" }], sourceUrl:"https://supplier.example/passport", revision:0, actor }, { dataDir }), /отсутствует/u);
    await assert.rejects(() => saveCatalogParameterOverrideDraft({ product, parameters:[{ target:"product", name:"Материал", value:"Сталь" }], sourceUrl:"file:///secret", revision:0, actor }, { dataDir }), /публичную ссылку/u);

    const draft = await saveCatalogParameterOverrideDraft({
      product,
      parameters:[
        { target:"product", name:"Материал", value:"Нержавеющая сталь" },
        { target:"variant", variantId:"variant-10", name:"Диаметр", value:"10", unit:"мм" },
      ],
      sourceUrl:"https://supplier.example/passport.pdf",
      note:"Паспорт, таблица 2",
      revision:0,
      actor,
    }, { dataDir, now:"2026-09-24T08:00:00.000Z" });
    assert.equal(draft.revision, 1);
    assert.equal(catalogParameterOverrideState(draft.records[0]), "draft");
    assert.equal(getRuntimeCatalogParameterOverrideRevision({ dataDir }), 1);
    assert.equal(applyRuntimeCatalogParameterOverrides(runtimeProduct, { dataDir }), runtimeProduct, "draft must not affect the storefront");

    await assert.rejects(() => updateCatalogParameterOverride({ product:{ ...product, title:"Другая серия" }, action:"publish", revision:1, actor }, { dataDir }), /изменились/u);
    const published = await updateCatalogParameterOverride({ product, action:"publish", revision:1, actor }, { dataDir, now:"2026-09-24T08:05:00.000Z" });
    assert.equal(published.revision, 2);
    assert.equal(catalogParameterOverrideState(published.records[0]), "published");
    const enriched = applyRuntimeCatalogParameterOverrides(runtimeProduct, { dataDir });
    assert.notEqual(enriched, runtimeProduct);
    assert.deepEqual(enriched.variants[0].params.find((entry) => entry.name === "Материал"), { name:"Материал", value:"Нержавеющая сталь", manualOverride:true });
    assert.deepEqual(enriched.variants[1].params.find((entry) => entry.name === "Материал"), { name:"Материал", value:"Нержавеющая сталь", manualOverride:true });
    assert.deepEqual(enriched.variants[0].params.find((entry) => entry.name === "Диаметр"), { name:"Диаметр", value:"10", unit:"мм", manualOverride:true });
    assert.equal(enriched.variants[1].params.some((entry) => entry.name === "Диаметр"), false, "variant value must not leak to another size");
    assert.ok(enriched.paramAxes.includes("Материал"));

    const disabled = await updateCatalogParameterOverride({ product, action:"disable", revision:2, actor }, { dataDir });
    assert.equal(catalogParameterOverrideState(disabled.records[0]), "disabled");
    assert.equal(applyRuntimeCatalogParameterOverrides(runtimeProduct, { dataDir }), runtimeProduct);
    const enabled = await updateCatalogParameterOverride({ product, action:"enable", revision:3, actor }, { dataDir });
    assert.equal(catalogParameterOverrideState(enabled.records[0]), "published");
    assert.equal(applyRuntimeCatalogParameterOverrides(runtimeProduct, { dataDir }).variants[0].params.some((entry) => entry.manualOverride), true);

    const stored = JSON.parse(await readFile(path.join(dataDir, "settings", "catalog-parameter-overrides.json"), "utf8"));
    assert.deepEqual(stored.records[0].events.map((event) => event.action), ["save_draft", "publish", "disable", "enable"]);
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("catalog parameter versions support optimistic locking, discard and audited restore", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-parameter-versions-"));
  try {
    const firstDraft = await saveCatalogParameterOverrideDraft({ product, parameters:[{ target:"product", name:"Тип привода", value:"Электрический" }], sourceUrl:"https://supplier.example/v1", revision:0, actor }, { dataDir, now:"2026-09-24T09:00:00.000Z" });
    const firstVersion = firstDraft.records[0].draftVersionId;
    await assert.rejects(() => saveCatalogParameterOverrideDraft({ product, parameters:[{ target:"product", name:"Тип привода", value:"Пневматический" }], sourceUrl:"https://supplier.example/v2", revision:0, actor }, { dataDir }), /другой вкладке/u);
    await updateCatalogParameterOverride({ product, action:"publish", revision:1, actor }, { dataDir });
    const secondDraft = await saveCatalogParameterOverrideDraft({ product, parameters:[{ target:"product", name:"Тип привода", value:"Комбинированный" }], sourceUrl:"https://supplier.example/v2", revision:2, actor }, { dataDir });
    assert.equal(secondDraft.records[0].versions.length, 2);
    const discarded = await updateCatalogParameterOverride({ product, action:"discard_draft", revision:3, actor }, { dataDir });
    assert.equal(discarded.records[0].publishedVersionId, firstVersion);
    const restored = await updateCatalogParameterOverride({ product, action:"restore", versionId:firstVersion, revision:4, actor }, { dataDir });
    assert.equal(restored.records[0].publishedVersionId, firstVersion);
    assert.deepEqual(restored.records[0].events.map((event) => event.action), ["save_draft", "publish", "save_draft", "discard_draft", "restore"]);
    assert.equal((await getCatalogParameterOverrideSettings({ dataDir })).revision, 5);
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("catalog parameter management is admin-only and routes are guarded", async () => {
  assert.equal(canManager({ id:"admin", name:"Admin", email:"", role:"admin", roleLabel:"Администратор", source:"local-demo" }, "catalog:manage"), true);
  assert.equal(canManager({ id:"manager", name:"Manager", email:"", role:"manager", roleLabel:"Менеджер", source:"local-demo" }, "catalog:manage"), false);
  assert.equal(canManager({ id:"approver", name:"Approver", email:"", role:"approver", roleLabel:"Согласующий", source:"local-demo" }, "catalog:manage"), false);
  const page = await readFile(new URL("../app/test/catalog-parameters/page.tsx", import.meta.url), "utf8");
  const manager = await readFile(new URL("../app/ui/CatalogParameterManager.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/catalog-parameters/route.ts", import.meta.url), "utf8");
  const actionApi = await readFile(new URL("../app/api/catalog-parameters/[productId]/route.ts", import.meta.url), "utf8");
  const feed = await readFile(new URL("../app/data/feedCatalog.ts", import.meta.url), "utf8");
  const quality = await readFile(new URL("../app/test/catalog-quality/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /requireManagerPageAccess\("catalog:manage"/u);
  assert.match(api, /authorizeManagerRequest\(request, "catalog:manage"\)/u);
  assert.match(api, /isSameOriginRequest\(request\)/u);
  assert.match(api, /content-length/u);
  assert.match(api, /createMemoryRateLimiter/u);
  assert.match(actionApi, /new Set\(\["publish", "discard_draft", "disable", "enable", "restore"\]\)/u);
  assert.match(manager, /Сохранить как черновик/u);
  assert.match(manager, /Опубликовать после проверки/u);
  assert.match(manager, /Вся серия · общее значение/u);
  assert.match(manager, /конкретное исполнение/u);
  assert.match(manager, /Журнал действий/u);
  assert.match(feed, /applyRuntimeCatalogParameterOverrides/u);
  assert.match(feed, /getRuntimeCatalogParameterOverrideRevision/u);
  assert.match(quality, /Исправить характеристики/u);
  assert.match(css, /@media \(max-width:720px\)[\s\S]*\.catalog-parameter-row \{ grid-template-columns:26px minmax\(0,1fr\) 38px; \}/u);
  assert.doesNotMatch(manager, /mailto:|tel:|telegram|fetch\([^)]*https?:/iu);
});

test("published parameters reach product pages, catalog snapshots and search without rewriting the feed", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-parameter-runtime-"));
  const previousDataDir = process.env.QUOTE_TEST_DATA_DIR;
  process.env.QUOTE_TEST_DATA_DIR = dataDir;
  try {
    const { getFeedProductBySlug, getPublishedFeedCatalogSnapshot } = await import("../app/data/feedCatalog.ts");
    const { searchCatalog } = await import("../app/data/catalogSearch.ts");
    const candidate = getPublishedFeedCatalogSnapshot().products.find((entry) => entry.variants.length > 0);
    assert.ok(candidate);
    const identity = { id:candidate.id, slug:candidate.slug, brand:candidate.brand, sku:candidate.sku, title:candidate.title, variants:candidate.variants.map((variant) => ({ id:variant.id, sku:variant.sku, name:variant.name })) };
    await saveCatalogParameterOverrideDraft({ product:identity, parameters:[{ target:"product", name:"Проверочный параметр", value:"ZXQ Runtime Override 924" }], sourceUrl:"https://supplier.example/runtime-proof", revision:0, actor }, { dataDir });
    await updateCatalogParameterOverride({ product:identity, action:"publish", revision:1, actor }, { dataDir });

    const productPageProduct = getFeedProductBySlug(candidate.slug);
    assert.equal(productPageProduct?.variants.every((variant) => variant.params.some((parameter) => parameter.value === "ZXQ Runtime Override 924")), true);
    const snapshotProduct = getPublishedFeedCatalogSnapshot().products.find((entry) => entry.id === candidate.id);
    assert.equal(snapshotProduct?.variants[0].params.some((parameter) => parameter.manualOverride), true);
    assert.equal(searchCatalog("ZXQ Runtime Override 924", { products:10 }).products.some((hit) => hit.href.includes(candidate.slug)), true);

    const storedFeed = await readFile(new URL("../../../7tool-source/src/lib/products.json", import.meta.url), "utf8");
    assert.doesNotMatch(storedFeed, /ZXQ Runtime Override 924/u);
  } finally {
    if (previousDataDir === undefined) delete process.env.QUOTE_TEST_DATA_DIR;
    else process.env.QUOTE_TEST_DATA_DIR = previousDataDir;
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("catalog parameter API enforces admin auth and same-origin before draft and publish", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-parameter-api-"));
  const previous = {
    dataDir:process.env.QUOTE_TEST_DATA_DIR,
    mode:process.env.QUOTE_TEST_MODE,
    admins:process.env.MANAGER_AUTH_ADMIN_EMAILS,
  };
  process.env.QUOTE_TEST_DATA_DIR = dataDir;
  process.env.QUOTE_TEST_MODE = "1";
  process.env.MANAGER_AUTH_ADMIN_EMAILS = "catalog-admin@example.test";
  try {
    const { getPublishedFeedCatalogSnapshot, getFeedProductBySlug } = await import("../app/data/feedCatalog.ts");
    const { POST } = await import("../app/api/catalog-parameters/route.ts");
    const { PATCH } = await import("../app/api/catalog-parameters/[productId]/route.ts");
    const candidate = getPublishedFeedCatalogSnapshot().products.find((entry) => entry.variants.length > 0);
    assert.ok(candidate);
    const payload = JSON.stringify({ productId:candidate.id, revision:0, sourceUrl:"https://supplier.example/api-proof", parameters:[{ target:"variant", variantId:candidate.variants[0].id, name:"API проверка", value:"Подтверждено" }] });
    const unauthorized = await POST(new Request("http://localhost/api/catalog-parameters", { method:"POST", headers:{ "Content-Type":"application/json", Origin:"http://localhost" }, body:payload }));
    assert.equal(unauthorized.status, 401);
    const authHeaders = {
      "Content-Type":"application/json",
      Origin:"http://localhost",
      "oai-authenticated-user-id":"catalog-admin",
      "oai-authenticated-user-email":"catalog-admin@example.test",
    };
    const rejectedOrigin = await POST(new Request("http://localhost/api/catalog-parameters", { method:"POST", headers:{ ...authHeaders, Origin:"https://attacker.example" }, body:payload }));
    assert.equal(rejectedOrigin.status, 403);
    const saved = await POST(new Request("http://localhost/api/catalog-parameters", { method:"POST", headers:authHeaders, body:payload }));
    assert.equal(saved.status, 201);
    assert.equal((await saved.json()).record.draftVersionId.length > 0, true);
    const published = await PATCH(new Request(`http://localhost/api/catalog-parameters/${encodeURIComponent(candidate.id)}`, { method:"PATCH", headers:authHeaders, body:JSON.stringify({ action:"publish", revision:1 }) }), { params:Promise.resolve({ productId:candidate.id }) });
    assert.equal(published.status, 200);
    assert.equal(getFeedProductBySlug(candidate.slug)?.variants[0].params.some((parameter) => parameter.name === "API проверка" && parameter.manualOverride), true);
  } finally {
    restoreEnv("QUOTE_TEST_DATA_DIR", previous.dataDir);
    restoreEnv("QUOTE_TEST_MODE", previous.mode);
    restoreEnv("MANAGER_AUTH_ADMIN_EMAILS", previous.admins);
    await rm(dataDir, { recursive:true, force:true });
  }
});

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
