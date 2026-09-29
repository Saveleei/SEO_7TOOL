import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runStalexTestCatalogBuild } from "../scripts/build-stalex-test-catalog.mjs";
import { buildStalexTestCatalog } from "../scripts/lib/stalex-test-catalog.mjs";
import { validateStalexTestCatalogCandidate } from "../scripts/validate-stalex-test-catalog-candidate.mjs";

function category(slug, count = 10) {
  return { slug, title: slug, count, published: true, icon: "machine" };
}

function record(overrides = {}) {
  const id = overrides.id ?? "record-1";
  const name = overrides.name ?? "Редукторный сверлильный станок STALEX GB28 Profi";
  const sku = overrides.sku ?? "NEW-001";
  const categorySlug = overrides.categorySlug ?? "stanki-sverlilnye";
  return {
    id,
    catalogId: id,
    sku,
    name,
    active: true,
    priceRub: 242250,
    oldPriceRub: null,
    availability: { quantity: 3, canPromiseToday: false },
    warranty: "12 месяцев",
    dataPilotReady: true,
    category: {
      chosen: {
        id: `${categorySlug}-source`,
        name: categorySlug,
        decision: "existing-category",
        targetSlug: categorySlug,
      },
    },
    sourceData: {
      images: ["catalog_files/example image.jpg"],
      description: "ООО «СТМ» предлагает купить оборудование. Телефон +7 (800) 700-02-91. Технические данные подтверждены фидом. Гарантия 1 год.",
      catalogProperties: [
        { name: "Бренд", code: "BRAND", value: "16054" },
        { name: "Макс. диаметр сверления (Ст. 3), мм", code: "MAX_DRILL", value: "28" },
        { name: "Цена в рублях", code: "PRICE_RUB", value: "242250" },
      ],
      modificationProperties: [
        { name: "Напряжение питания, В", code: "VOLTAGE", value: "380" },
        { name: "Доставка (шрина)", code: "DELIVERY_WIDTH", value: "650" },
        { name: "Описание к видео", code: "VIDEO_DESCRIPTION", value: "a:2:{s:4:\"TEXT\";s:3:\"bad\";}" },
        { name: "Номер по номенклатуре", code: "SN", value: sku },
      ],
    },
    ...overrides,
  };
}

function snapshot(records) {
  return {
    status: "validated",
    publicationEnabled: false,
    summary: { storefrontPublishable: 0 },
    records,
  };
}

const baseCatalog = {
  categories: [
    category("stanki-sverlilnye"),
    category("lentochnopilnye-stanki", 20),
    category("disko-otreznye-stanki", 30),
  ],
  subcategories: [],
  products: [{
    id: "existing-product",
    slug: "existing-product",
    title: "Существующий станок",
    category: "stanki-sverlilnye",
    variants: [{ id: "existing-variant", sku: "DUP-001", available: true, quantity: 1, params: [] }],
  }],
};

test("test pilot keeps only new equipment in approved existing categories", () => {
  const original = structuredClone(baseCatalog);
  const records = [
    record(),
    record({ id: "band-1", sku: "BAND-001", name: "Станок ленточнопильный Stalex BSM-170G", categorySlug: "lentochnopilnye-stanki", availability: { quantity: 0 } }),
    record({ id: "cut-1", sku: "CUT-001", name: "Станок абразивный отрезной Stalex COM-400T/4", categorySlug: "disko-otreznye-stanki", availability: { quantity: 2 } }),
    record({ id: "duplicate", sku: "DUP-001" }),
    record({ id: "accessory", sku: "ACC-001", name: "Ленточное полотно для STALEX BS-85", categorySlug: "lentochnopilnye-stanki" }),
    record({ id: "future", sku: "FUT-001", category: { chosen: { id:"future", decision:"proposed-category", proposedSlug:"tokarnye-stanki" } } }),
  ];
  const result = buildStalexTestCatalog({ baseCatalog, stalexSnapshot:snapshot(records) });

  assert.deepEqual(baseCatalog, original, "builder must not mutate the supplier catalog");
  assert.equal(result.report.selected, 3);
  assert.equal(result.report.skipped["duplicate-sku"], 1);
  assert.equal(result.report.skipped["not-equipment"], 1);
  assert.equal(result.report.skipped["category-not-approved"], 1);
  assert.deepEqual(result.report.selectedByCategory, {
    "stanki-sverlilnye": 1,
    "lentochnopilnye-stanki": 1,
    "disko-otreznye-stanki": 1,
  });
  assert.equal(result.catalog.products.length, baseCatalog.products.length + 3);
  assert.equal(result.catalog.categories.find((item) => item.slug === "stanki-sverlilnye").count, 11);
  assert.equal(result.catalog.categories.find((item) => item.slug === "lentochnopilnye-stanki").count, 21);
  assert.equal(result.catalog.categories.find((item) => item.slug === "disko-otreznye-stanki").count, 31);
});

test("pilot products keep supplier stock strict and remove supplier contacts", () => {
  const result = buildStalexTestCatalog({
    baseCatalog,
    stalexSnapshot:snapshot([
      record({ id:"available", sku:"AVAILABLE-1", availability:{ quantity:4 } }),
      record({ id:"request", sku:"REQUEST-1", name:"Станок ленточнопильный Stalex BSM-225G", categorySlug:"lentochnopilnye-stanki", availability:{ quantity:0 } }),
    ]),
  });
  const available = result.catalog.products.find((product) => product.id === "STALEX-available");
  const request = result.catalog.products.find((product) => product.id === "STALEX-request");

  assert.equal(available.variants[0].available, true);
  assert.equal(available.variants[0].quantity, 4);
  assert.equal(request.variants[0].available, false);
  assert.equal(request.variants[0].quantity, 0);
  assert.doesNotMatch(available.description, /ООО|800|предлагает купить/iu);
  assert.match(available.description, /Технические данные подтверждены фидом/u);
  assert.match(available.description, /Гарантия — 12 месяцев/u);
  assert.doesNotMatch(available.description, /Гарантия 1 год/u);
  assert.deepEqual(available.images, ["https://stalex.ru/upload/catalog_files/example%20image.jpg"]);
  assert.equal(available.publicationScope, "test-only");
  assert.equal(available.sourceSupplier, "stalex");
  assert.ok(available.variants[0].params.some((parameter) => parameter.name === "Гарантия" && parameter.value === "12 месяцев"));
  assert.deepEqual(available.variants[0].params.filter((parameter) => parameter.name === "Бренд"), [{ name:"Бренд", value:"Stalex" }]);
  assert.ok(available.variants[0].params.some((parameter) => parameter.name === "Макс. диаметр сверления (Ст. 3)" && parameter.unit === "мм"));
  assert.ok(available.variants[0].params.some((parameter) => parameter.name === "Транспортная ширина" && parameter.value === "650" && parameter.unit === "мм"));
  assert.ok(!available.variants[0].params.some((parameter) => parameter.name === "Цена в рублях"));
  assert.ok(!available.variants[0].params.some((parameter) => parameter.name === "Описание к видео"));
});

test("long supplier table text becomes a readable feed-grounded summary", () => {
  const longDescription = `${"Технический параметр значение ".repeat(35)}Гарантия 1 год`;
  const result = buildStalexTestCatalog({
    baseCatalog,
    stalexSnapshot:snapshot([record({
      id:"long-description",
      sku:"LONG-001",
      sourceData:{
        images:["catalog_files/long.jpg"],
        description:longDescription,
        catalogProperties:[{ name:"Макс. диаметр сверления (Ст. 3), мм", code:"MAX_DRILL", value:"28" }],
        modificationProperties:[],
      },
    })]),
  });
  const product = result.catalog.products.find((item) => item.id === "STALEX-long-description");
  assert.match(product.description, /Подтверждённые характеристики по фиду/u);
  assert.match(product.description, /Макс\. диаметр сверления \(Ст\. 3\) — 28 мм/u);
  assert.match(product.description, /Гарантия — 12 месяцев/u);
  assert.ok(product.description.length < 700);
  assert.doesNotMatch(product.description, /Технический параметр значение Технический параметр/iu);
});

test("pilot build fails closed for an unvalidated or publishable Stalex snapshot", () => {
  assert.throws(
    () => buildStalexTestCatalog({ baseCatalog, stalexSnapshot:{ ...snapshot([]), status:"failed" } }),
    /не прошёл безопасную валидацию/u,
  );
  assert.throws(
    () => buildStalexTestCatalog({ baseCatalog, stalexSnapshot:{ ...snapshot([]), summary:{ storefrontPublishable:1 } } }),
    /неожиданно разрешает публикацию/u,
  );
});

test("CLI builder writes freshness metadata for the exact combined catalog", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "stalex-test-catalog-"));
  const basePath = path.join(directory, "base.json");
  const stalexPath = path.join(directory, "stalex.json");
  const baseMetadataPath = path.join(directory, "base-meta.json");
  const outputPath = path.join(directory, "products.json");
  const reportPath = path.join(directory, "pilot-report.json");
  const metadataOutputPath = path.join(directory, "catalog-snapshot-meta.json");
  try {
    const baseSource = JSON.stringify(baseCatalog);
    await writeFile(basePath, baseSource, "utf8");
    await writeFile(stalexPath, JSON.stringify({ ...snapshot([record()]), refreshedAt:"2026-09-28T00:35:00.000Z" }), "utf8");
    await writeFile(baseMetadataPath, JSON.stringify({ status:"complete", completedAt:"2026-09-28T00:25:00.000Z", catalogSha256:createHash("sha256").update(baseSource).digest("hex") }), "utf8");
    const report = runStalexTestCatalogBuild({
      basePath,
      stalexPath,
      outputPath,
      reportPath,
      baseMetadataPath,
      metadataOutputPath,
    });
    const catalogSource = await readFile(outputPath, "utf8");
    const metadata = JSON.parse(await readFile(metadataOutputPath, "utf8"));
    const persistedReport = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(metadata.catalogSha256, createHash("sha256").update(catalogSource).digest("hex"));
    assert.equal(metadata.completedAt, "2026-09-28T00:25:00.000Z");
    assert.equal(metadata.stalexRefreshedAt, "2026-09-28T00:35:00.000Z");
    assert.equal(metadata.publicationScope, "test-only");
    assert.equal(report.catalogSha256, metadata.catalogSha256);
    assert.equal(persistedReport.catalogSha256, metadata.catalogSha256);
  } finally {
    await rm(directory, { recursive:true, force:true });
  }
});

test("nightly candidate guard accepts price refreshes but blocks an unreviewed product-set change", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "stalex-test-catalog-guard-"));
  const catalogPath = path.join(directory, "products.json");
  const metadataPath = path.join(directory, "catalog-snapshot-meta.json");
  const reportPath = path.join(directory, "pilot-report.json");
  const currentReportPath = path.join(directory, "current-report.json");
  try {
    const product = { id:"STALEX-approved", sourceSupplier:"stalex", publicationScope:"test-only", variants:[{ id:"variant" }] };
    const catalogSource = `${JSON.stringify({ categories:[], products:[product] }, null, 2)}\n`;
    const catalogSha256 = createHash("sha256").update(catalogSource).digest("hex");
    const report = { mode:"test-only", selected:1, productIds:[product.id], catalogSha256 };
    await writeFile(catalogPath, catalogSource, "utf8");
    await writeFile(metadataPath, JSON.stringify({ status:"complete", sourceId:"test-stalex-pilot", publicationScope:"test-only", catalogSha256 }), "utf8");
    await writeFile(reportPath, JSON.stringify(report), "utf8");
    await writeFile(currentReportPath, JSON.stringify({ ...report, catalogSha256:"older-price-snapshot" }), "utf8");

    const accepted = validateStalexTestCatalogCandidate({ catalogPath, metadataPath, reportPath, currentReportPath });
    assert.equal(accepted.catalogSha256, catalogSha256);
    assert.deepEqual(accepted.productIds, [product.id]);

    await writeFile(currentReportPath, JSON.stringify({ mode:"test-only", selected:1, productIds:["STALEX-other"] }), "utf8");
    assert.throws(
      () => validateStalexTestCatalogCandidate({ catalogPath, metadataPath, reportPath, currentReportPath }),
      /состав Stalex-каталога изменился/iu,
    );
  } finally {
    await rm(directory, { recursive:true, force:true });
  }
});
