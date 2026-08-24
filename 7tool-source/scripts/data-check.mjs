import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "src", "lib", "products.json");
const analysisDir = path.join(root, ".analysis");
const reportPath = path.join(root, "DATA_QUALITY_REPORT.md");
const jsonReportPath = path.join(analysisDir, "data-quality-report.json");
const conflictPath = path.join(analysisDir, "seo-data-conflicts.json");
const strict = process.argv.includes("--strict") || process.env.DATA_CHECK_FAIL_ON_CONFLICT === "1";

fs.mkdirSync(analysisDir, { recursive: true });
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const allCategories = catalog.categories ?? [];
const products = (catalog.products ?? []).filter((product) => !product.draft);
const categoryBySlug = new Map(allCategories.map((category) => [category.slug, category]));
const issues = [];

function issue({ severity, code, product, variant, sourceA, sourceB, recommendation, blocking = false }) {
  issues.push({
    severity,
    code,
    blocking,
    productId: product?.id ?? null,
    product: product?.title ?? null,
    sku: variant?.sku || product?.sku || null,
    url: product?.slug ? `https://7tool.ru/p/${product.slug}` : null,
    variantId: variant?.id ?? null,
    sourceA,
    sourceB,
    recommendation,
  });
}

const positive = (value) => Number.isFinite(value) && value > 0;
const norm = (value) => String(value ?? "").trim().toLocaleLowerCase("ru");
const productIdOwners = new Map();
const productSlugOwners = new Map();
const variantIdOwners = new Map();
const variantSkuOwners = new Map();

function register(map, key, owner) {
  if (!key) return;
  const owners = map.get(key) ?? [];
  owners.push(owner);
  map.set(key, owners);
}

for (const product of products) {
  register(productIdOwners, product.id, product.slug);
  register(productSlugOwners, product.slug, product.id);
  const category = categoryBySlug.get(product.category);
  if (!category) {
    issue({ severity: "P0", code: "UNKNOWN_CATEGORY", product, sourceA: `product.category=${product.category}`, sourceB: "categories: no matching slug", recommendation: "Исправить mapping feed category до публикации товара.", blocking: true });
  } else if (category.published === false) {
    issue({ severity: "P1", code: "PRODUCT_IN_UNPUBLISHED_CATEGORY", product, sourceA: `product.category=${product.category}`, sourceB: "category.published=false", recommendation: "Подтвердить: опубликовать категорию либо исключить товары из публичного sitemap/brand graph." });
  }
  if (!product.title || product.title.trim().length < 2 || /^[-–—\s]+$/.test(product.title)) {
    issue({ severity: "P0", code: "INVALID_PRODUCT_TITLE", product, sourceA: `title=${JSON.stringify(product.title)}`, sourceB: "title is empty or not meaningful", recommendation: "Исправить название в источнике или оставить товар draft до исправления.", blocking: true });
  } else if (product.title.trim().length < 8 || /^\d+$/.test(product.title.trim())) {
    issue({ severity: "P1", code: "WEAK_PRODUCT_TITLE", product, sourceA: `title=${JSON.stringify(product.title)}`, sourceB: "title contains only a short model/article", recommendation: "Дополнить подтверждённым типом товара и брендом в feed; не выдумывать назначение." });
  }
  if (!(product.variants ?? []).length) {
    issue({ severity: "P0", code: "NO_VARIANTS", product, sourceA: "variants.length=0", sourceB: "published catalog requires at least one variant", recommendation: "Не публиковать товар без артикула/варианта.", blocking: true });
  }
  if (!(product.images ?? []).some(Boolean) && !(product.variants ?? []).some((variant) => (variant.images ?? []).some(Boolean))) {
    issue({ severity: "P1", code: "NO_IMAGE", product, sourceA: "product.images=[]", sourceB: "variant.images=[]", recommendation: "Добавить подтверждённое фото в feed/admin; до этого товар остаётся исключённым из витрины." });
  }
  if (!product.brand || product.brand === "—" || norm(product.brand) === "noname") {
    issue({ severity: "P2", code: "WEAK_OR_MISSING_BRAND", product, sourceA: `product.brand=${product.brand || "empty"}`, sourceB: "expected manufacturer/brand", recommendation: "Уточнить бренд у поставщика; не выдумывать значение." });
  }

  const variants = product.variants ?? [];
  const inStock = variants.filter((variant) => variant.available !== false && (variant.quantity ?? 0) > 0);
  const orderable = variants.filter((variant) => variant.available !== false);
  const priceSource = inStock.length ? inStock : orderable;
  const prices = priceSource.map((variant) => variant.price).filter(positive);
  const expectedMin = prices.length ? Math.min(...prices) : undefined;
  const expectedMax = prices.length ? Math.max(...prices) : undefined;
  const expectedStock = inStock.reduce((sum, variant) => sum + Math.max(0, variant.quantity ?? 0), 0);
  if ((product.stock ?? 0) !== expectedStock) {
    issue({ severity: "P0", code: "AGGREGATE_STOCK_MISMATCH", product, sourceA: `product.stock=${product.stock ?? 0}`, sourceB: `sum(available quantity)=${expectedStock}`, recommendation: "Остановить SEO/build и пересчитать агрегаты из вариантов.", blocking: true });
  }
  if ((product.priceFrom ?? undefined) !== expectedMin || (product.priceTo ?? undefined) !== expectedMax) {
    issue({ severity: "P0", code: "AGGREGATE_PRICE_MISMATCH", product, sourceA: `product price=${product.priceFrom ?? "null"}–${product.priceTo ?? "null"}`, sourceB: `variant price=${expectedMin ?? "null"}–${expectedMax ?? "null"}`, recommendation: "Остановить SEO/build и пересчитать агрегаты из доступных вариантов.", blocking: true });
  }

  for (const variant of variants) {
    register(variantIdOwners, variant.id, `${product.id}/${variant.sku || "no-sku"}`);
    if (variant.sku) register(variantSkuOwners, norm(variant.sku), `${product.id}/${variant.id}`);
    else issue({ severity: "P1", code: "MISSING_VARIANT_SKU", product, variant, sourceA: "variant.sku is empty", sourceB: `variant.id=${variant.id}`, recommendation: "Запросить артикул у поставщика; до исправления использовать внутренний ID только как технический fallback." });
    if (variant.price != null && !positive(variant.price)) {
      issue({ severity: "P0", code: "INVALID_PRICE", product, variant, sourceA: `variant.price=${variant.price}`, sourceB: "price must be positive or absent", recommendation: "Не публиковать Offer с нулевой/отрицательной ценой.", blocking: true });
    }
    if (variant.oldPrice != null && !positive(variant.oldPrice)) {
      issue({ severity: "P0", code: "INVALID_OLD_PRICE", product, variant, sourceA: `variant.oldPrice=${variant.oldPrice}`, sourceB: "oldPrice must be positive or absent", recommendation: "Удалить некорректную старую цену из Offer/скидки.", blocking: true });
    }
    if (positive(variant.oldPrice) && positive(variant.price) && variant.oldPrice <= variant.price) {
      issue({ severity: "P1", code: "INVALID_DISCOUNT", product, variant, sourceA: `oldPrice=${variant.oldPrice}`, sourceB: `price=${variant.price}`, recommendation: "Не показывать скидку, пока oldPrice не выше текущей цены." });
    }
    if ((variant.quantity ?? 0) < 0) {
      issue({ severity: "P0", code: "NEGATIVE_QUANTITY", product, variant, sourceA: `quantity=${variant.quantity}`, sourceB: "quantity must be >= 0", recommendation: "Исправить feed и не публиковать availability до исправления.", blocking: true });
    }
    if (variant.available === false && (variant.quantity ?? 0) > 0) {
      issue({ severity: "P1", code: "UNAVAILABLE_WITH_STOCK", product, variant, sourceA: "available=false", sourceB: `quantity=${variant.quantity}`, recommendation: "Уточнить бизнес-статус; JSON-LD и UI должны использовать одно решение." });
    }

    const brandParam = (variant.params ?? []).find((param) => /^(?:k2[_.:/-]*)?бренд$/i.test(String(param.name).trim()));
    if (brandParam?.value && product.brand && norm(brandParam.value) !== norm(product.brand)) {
      issue({ severity: "P0", code: "BRAND_CONFLICT", product, variant, sourceA: `product.brand=${product.brand}`, sourceB: `variant.params.Бренд=${brandParam.value}`, recommendation: "Пометить SEO_DATA_CONFLICT и исправить источник; не генерировать новый SEO-текст.", blocking: false });
    }

    // High-confidence numeric guard: an explicit leading Ø in the variant name
    // must agree with the feed's cutting diameter. Small manufacturing/tolerance
    // deviations up to 1 mm are warnings, not hard conflicts.
    const diameterMatch = String(variant.name || product.title).match(/[Ø⌀]\s*(\d+(?:[.,]\d+)?)/i);
    const cuttingDiameter = (variant.params ?? []).find((param) => /^диаметр режущей части$/i.test(String(param.name).replace(/^(?:k2[\s_.:/-]*)+/i, "").trim()));
    const feedDiameter = cuttingDiameter ? Number(String(cuttingDiameter.value).replace(",", ".")) : NaN;
    const nameDiameter = diameterMatch ? Number(diameterMatch[1].replace(",", ".")) : NaN;
    if (Number.isFinite(feedDiameter) && Number.isFinite(nameDiameter) && Math.abs(feedDiameter - nameDiameter) > 1.01) {
      issue({ severity: "P0", code: "SEO_DATA_CONFLICT_DIAMETER", product, variant, sourceA: `variant.name Ø${nameDiameter} мм`, sourceB: `Диаметр режущей части=${feedDiameter} мм`, recommendation: "Исправить название или характеристику в feed; до этого исключить товар из новой SEO-генерации.", blocking: false });
    }
  }
}

for (const [id, owners] of productIdOwners) if (owners.length > 1) {
  issue({ severity: "P0", code: "DUPLICATE_PRODUCT_ID", sourceA: `id=${id}`, sourceB: owners.join(", "), recommendation: "Остановить import и устранить дубли ID.", blocking: true });
}
for (const [slug, owners] of productSlugOwners) if (owners.length > 1) {
  issue({ severity: "P0", code: "DUPLICATE_PRODUCT_SLUG", sourceA: `slug=${slug}`, sourceB: owners.join(", "), recommendation: "Остановить build и назначить уникальный стабильный URL.", blocking: true });
}
for (const [id, owners] of variantIdOwners) if (owners.length > 1) {
  issue({ severity: "P0", code: "DUPLICATE_VARIANT_ID", sourceA: `variant.id=${id}`, sourceB: owners.join(", "), recommendation: "Остановить import: variant ID является ключом live price/availability.", blocking: true });
}
for (const [sku, owners] of variantSkuOwners) if (owners.length > 1) {
  issue({ severity: "P1", code: "DUPLICATE_VARIANT_SKU", sourceA: `sku=${sku}`, sourceB: owners.join(", "), recommendation: "Подтвердить у поставщика; exact-search должен дополнительно различать внутренний ID/бренд." });
}

const severityOrder = { P0: 0, P1: 1, P2: 2 };
issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  || a.code.localeCompare(b.code) || String(a.productId).localeCompare(String(b.productId)));
const countsByCode = Object.fromEntries([...issues.reduce((map, current) => map.set(current.code, (map.get(current.code) ?? 0) + 1), new Map())]);
const summary = {
  categories: allCategories.length,
  publishedCategories: allCategories.filter((category) => category.published !== false).length,
  products: products.length,
  variants: products.reduce((sum, product) => sum + (product.variants ?? []).length, 0),
  p0: issues.filter((current) => current.severity === "P0").length,
  blockingP0: issues.filter((current) => current.severity === "P0" && current.blocking).length,
  p1: issues.filter((current) => current.severity === "P1").length,
  p2: issues.filter((current) => current.severity === "P2").length,
  totalIssues: issues.length,
  countsByCode,
};
const generatedAt = new Date().toISOString();
fs.writeFileSync(jsonReportPath, `${JSON.stringify({ generatedAt, summary, issues }, null, 2)}\n`, "utf8");

const conflicts = issues.filter((current) => current.code.startsWith("SEO_DATA_CONFLICT") || current.code === "BRAND_CONFLICT");
fs.writeFileSync(conflictPath, `${JSON.stringify({
  generatedAt,
  productIds: [...new Set(conflicts.map((current) => current.productId).filter(Boolean))],
  issues: conflicts,
}, null, 2)}\n`, "utf8");

const esc = (value) => String(value ?? "—").replaceAll("|", "\\|").replace(/\s+/g, " ");
const lines = [
  "# Data Quality Report — 7TOOL.ru",
  "",
  `Дата проверки: ${generatedAt}. Источник: \`src/lib/products.json\` после feed sync.`,
  "",
  "## Summary",
  "",
  `- Категории: ${summary.categories}, опубликованы: ${summary.publishedCategories}.`,
  `- Товарные группы: ${summary.products}; варианты: ${summary.variants}.`,
  `- P0: ${summary.p0} (блокирующие pipeline: ${summary.blockingP0}).`,
  `- P1: ${summary.p1}; P2: ${summary.p2}.`,
  `- SEO_DATA_CONFLICT products: ${new Set(conflicts.map((current) => current.productId)).size}.`,
  "",
  "Полный machine-readable список находится в `.analysis/data-quality-report.json`; manifest для SEO guard — `.analysis/seo-data-conflicts.json`.",
  "",
  "## Issue classes",
  "",
  "| Code | Count | Meaning |",
  "|---|---:|---|",
  ...Object.entries(countsByCode).map(([code, count]) => `| ${code} | ${count} | См. детальные строки ниже |`),
  "",
  "## Detailed findings",
  "",
  "| Severity | Code | Product / SKU | URL | Source A | Source B | Recommendation |",
  "|---|---|---|---|---|---|---|",
  ...issues.map((current) => `| ${current.severity} | ${current.code} | ${esc(current.product)} / ${esc(current.sku)} | ${current.url ? `[open](${current.url})` : "—"} | ${esc(current.sourceA)} | ${esc(current.sourceB)} | ${esc(current.recommendation)} |`),
  "",
  "## Pipeline policy",
  "",
  "- Structural P0 (`blocking=true`) stops nightly/hourly SEO/build.",
  "- Isolated source conflicts generate `SEO_DATA_CONFLICT`; affected product IDs are skipped by SEO generators, while the rest of the catalog can update.",
  "- The checker never changes feed facts automatically.",
  "",
];
fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");

console.log(JSON.stringify(summary, null, 2));
if (summary.blockingP0 > 0 || (strict && summary.p0 > 0)) process.exitCode = 1;
