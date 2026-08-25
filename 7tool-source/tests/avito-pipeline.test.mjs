import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { buildAnalyticsReport, parseCsv } from "../src/lib/avito/analytics.mjs";
import {
  buildAvitoPipeline,
  normalizeSupplierOffer,
  stableAvitoId,
  validateGeneratedContent,
} from "../src/lib/avito/core.mjs";
import { deduplicateByPerceptualHash, enhanceImageLocally, generateSpecificationCard, generateWarehouseTrustCard, inspectImage, validateRemoteImageUrl } from "../src/lib/avito/image-pipeline.mjs";
import { parseSupplierFeed } from "../scripts/lib/supplier-feed-parser.mjs";

const root = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(root, "fixtures/avito/config.test.json"), "utf8"));
const source = fs.readFileSync(path.join(root, "fixtures/avito/supplier.xml"), "utf8");
const offers = parseSupplierFeed(source);
const generatedAt = "2026-08-25T10:00:00.000Z";

test("Avito ID стабилен и не зависит от времени", () => {
  assert.equal(stableAvitoId("fixture-1"), "7tool-fixture-1");
  assert.equal(stableAvitoId("fixture-1"), stableAvitoId("fixture-1"));
  assert.match(stableAvitoId("очень длинный идентификатор ".repeat(20)), /^7tool-[a-f0-9]{32}$/);
});

test("фикстура нормализуется, скорится и формирует детерминированный UTF-8 XML", () => {
  const first = buildAvitoPipeline({ offers, config, generatedAt });
  const second = buildAvitoPipeline({ offers, config, generatedAt });
  assert.equal(first.xml, second.xml);
  assert.equal(first.report.selected, 2);
  assert.match(first.xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(first.xml, /Магнитный сверлильный станок/);
  assert.match(first.xml, /Цена 47 999 ₽ с НДС/);
  assert.match(first.xml, /Основные характеристики:\n• Шпиндель/);
  assert.match(first.xml, /https:\/\/7tool\.ru\/warehouse\/01\.webp/);
  assert.equal(first.report.xmlValidation.valid, true);
  assert.equal(Buffer.from(first.xml, "utf8").toString("utf8"), first.xml);
});

test("невалидная цена, отсутствие подтверждённого остатка и ручной запрет исключают товары", () => {
  const { report } = buildAvitoPipeline({ offers, config, generatedAt });
  const reasonsBySku = Object.fromEntries(report.exclusions.map((item) => [item.sku, item.reasons]));
  assert.ok(reasonsBySku["BAD-PRICE"].includes("invalid_price"));
  assert.ok(reasonsBySku["ORDER-60"].includes("not_confirmed_in_stock"));
  assert.ok(reasonsBySku["BLOCKED-1"].includes("manual_exclude"));
  assert.ok(reasonsBySku["UNKNOWN-1"].includes("category_not_mapped"));
});

test("дубли изображений удаляются, XML-символы экранируются", () => {
  const offer = {
    ...offers[0],
    id: "escape-id",
    name: "Станок A & B ]]> модель",
    pictures: ["https://cdn.example.test/a.jpg", "https://cdn.example.test/a.jpg"],
  };
  const normalized = normalizeSupplierOffer(offer, config, generatedAt);
  assert.equal(normalized.images.length, 1);
  const { xml } = buildAvitoPipeline({ offers: [offer], config: { ...config, source: { ...config.source, minOffers: 1 } }, generatedAt });
  assert.match(xml, /<Title>Станок A &amp; B ]]&gt; модель LENZ/);
  assert.match(xml, /]]]]><!\[CDATA\[>/, "CDATA terminator from source text must be split safely");
});

test("AI-черновик отклоняется при появлении новой цифры или рекламного суперлатива", () => {
  const product = normalizeSupplierOffer(offers[0], config, generatedAt);
  const result = validateGeneratedContent(product, {
    title: product.title,
    description: `${product.brand}: производительность 9999 отверстий. Лучшая цена.`,
  }, config);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("unverified_number:9999"));
  assert.ok(result.errors.includes("unsupported_superlative"));
});

test("аварийная защита блокирует резкое сокращение источника", () => {
  const previous = buildAvitoPipeline({ offers, config, generatedAt }).state;
  assert.throws(() => buildAvitoPipeline({ offers: offers.slice(0, 2), config, previousState: previous, generatedAt }), /AVITO_SOURCE_LARGE_DROP/);
});

test("единично исчезнувший товар удерживается один цикл grace period", () => {
  const relaxed = {
    ...config,
    safety: { ...config.safety, dropGuardMinPreviousOffers: 100 },
  };
  const previous = buildAvitoPipeline({ offers: offers.slice(0, 2), config: relaxed, generatedAt }).state;
  const current = buildAvitoPipeline({ offers: offers.slice(0, 1), config: relaxed, previousState: previous, generatedAt });
  assert.equal(current.report.carriedFromPrevious, 1);
  assert.equal(current.report.selected, 2);
  assert.ok(current.report.listings.some((item) => item.stockStatus === "grace"));
});

test("квоты категорий и товарных линеек не дают вариантам одной серии занять выдачу", () => {
  const familyOffers = [
    { ...offers[0], id: "family-a", groupId: "GROUP-X", sku: "FAMILY-A", pictures: ["https://cdn.example.test/a.jpg"] },
    { ...offers[0], id: "family-b", groupId: "GROUP-X", sku: "FAMILY-B", pictures: ["https://cdn.example.test/b.jpg"] },
    { ...offers[0], id: "family-c", groupId: "GROUP-Y", sku: "FAMILY-C", pictures: ["https://cdn.example.test/c.jpg"] },
    offers[1],
  ];
  const mixedConfig = {
    ...config,
    selection: {
      ...config.selection,
      limit: 4,
      maxPerFamily: 1,
      categoryLimits: { "54": 1, "114": 2 },
      pinnedSkus: [],
    },
  };
  const { report } = buildAvitoPipeline({ offers: familyOffers, config: mixedConfig, generatedAt });
  assert.deepEqual(report.selectedByCategory, { "54": 1, "114": 1 });
  assert.equal(report.selected, 2);
  assert.ok(report.exclusions.some((item) => item.reasons.includes("category_limit") || item.reasons.includes("family_limit")));
});

test("аналитика рассчитывает стоимость квалифицированного лида и ROI", () => {
  const rows = parseCsv(fs.readFileSync(path.join(root, "fixtures/avito/analytics.csv"), "utf8"));
  const report = buildAnalyticsReport(rows);
  assert.equal(report.items.length, 2);
  assert.equal(report.totals.contacts, 21);
  assert.equal(report.totals.qualifiedLeads, 13);
  assert.ok(report.totals.roi > 0);
});

test("CLI повторно использует общий K2Tool FEED_FILE, если AVITO_FEED не задан", (t) => {
  fs.mkdirSync(path.join(root, ".avito"), { recursive: true });
  const temp = fs.mkdtempSync(path.join(root, ".avito", "test-cli-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [
    "scripts/avito-pipeline.mjs",
    "--config", "fixtures/avito/config.test.json",
    "--output", temp,
    "--dry-run",
  ], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      FEED_FILE: "fixtures/avito/supplier.xml",
      FEED_URL: "",
      AVITO_FEED_FILE: "",
      AVITO_FEED_URL: "",
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"selected": 2/);
  assert.ok(fs.existsSync(path.join(temp, "candidate-avito.xml")));
});

test("фотоконвейер оценивает качество, сохраняет производную и создаёт честный складской слайд", async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-avito-test-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const sourcePath = path.join(temp, "warehouse.png");
  await sharp({ create: { width: 1_000, height: 700, channels: 3, background: "#8090a0" } })
    .composite([{ input: Buffer.from('<svg width="1000" height="700"><rect x="120" y="100" width="760" height="500" fill="#304050"/><circle cx="500" cy="350" r="170" fill="#d8a321"/></svg>') }])
    .png().toFile(sourcePath);
  const buffer = fs.readFileSync(sourcePath);
  const inspected = await inspectImage(buffer, { minSharpness: 0 });
  assert.equal(inspected.width, 1_000);
  const duplicates = deduplicateByPerceptualHash([{ id: "a", ...inspected }, { id: "b", ...inspected }]);
  assert.equal(duplicates.kept.length, 1);
  assert.equal(duplicates.rejected[0].duplicateOf, "a");
  const enhanced = await enhanceImageLocally(buffer, path.join(temp, "processed"), "fixture", { minSharpness: 0 });
  assert.ok(fs.existsSync(enhanced.outputPath));
  assert.ok(enhanced.transformations.includes("no_upscale"));
  const card = await generateWarehouseTrustCard(sourcePath, path.join(temp, "trust.webp"));
  assert.equal(card.width, 1_280);
  assert.equal(card.height, 960);
  const specification = await generateSpecificationCard({
    title: "Магнитный сверлильный станок LENZ STEYR-35",
    sku: "STEYR-35",
    price: 47_999,
    params: [{ name: "Шпиндель", value: "Weldon 19" }, { name: "Мощность", value: "1550", unit: "Вт" }],
  }, path.join(temp, "spec.webp"));
  assert.equal(specification.width, 1_280);
  await assert.rejects(validateRemoteImageUrl("http://127.0.0.1/a.jpg", ["127.0.0.1"]), /IMAGE_URL_HTTPS_REQUIRED/);
});
