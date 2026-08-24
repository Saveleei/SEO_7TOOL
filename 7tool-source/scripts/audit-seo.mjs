// Полный статический аудит SEO-контента каталога с машиночитаемым отчётом.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "lib", "products.json"), "utf8"));
const profiles = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "lib", "category-seo.json"), "utf8"));
const OUTPUT = path.join(ROOT, ".analysis");
fs.mkdirSync(OUTPUT, { recursive: true });

const compact = (value) => String(value || "").replace(/\s+/g, " ").trim();
const csv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const duplicateGroups = (items, field) => {
  const groups = new Map();
  for (const item of items) {
    const key = compact(item[field]).toLocaleLowerCase("ru");
    if (!key) continue;
    const list = groups.get(key) || [];
    list.push(item.id || item.slug);
    groups.set(key, list);
  }
  return Array.from(groups.values()).filter((group) => group.length > 1);
};

const products = (catalog.products || []).filter((product) => !product.draft);
const categories = (catalog.categories || []).filter((category) => category.published !== false);
const issues = [];
for (const product of products) {
  const titleLength = compact(product.metaTitle).length;
  const descriptionLength = compact(product.metaDescription).length;
  const textLength = compact(product.seoText).length;
  if (titleLength < 30 || titleLength > 82) issues.push({ type: "product_title_length", id: product.id, value: titleLength });
  if (descriptionLength < 100 || descriptionLength > 205) issues.push({ type: "product_description_length", id: product.id, value: descriptionLength });
  if (textLength < 320 || textLength > 1800) issues.push({ type: "product_text_length", id: product.id, value: textLength });
  if (/\bk2[_.:/-]/i.test(`${product.metaTitle} ${product.metaDescription} ${product.seoText}`)) issues.push({ type: "technical_param", id: product.id });
  if (!profiles[product.category]) issues.push({ type: "missing_category_profile", id: product.id, category: product.category });
}
for (const category of categories) {
  const profile = profiles[category.slug];
  if (!profile) issues.push({ type: "missing_category_profile", id: category.slug });
  if (compact(category.metaTitle).length < 35 || compact(category.metaTitle).length > 80) issues.push({ type: "category_title_length", id: category.slug, value: compact(category.metaTitle).length });
  if (compact(category.metaDescription).length < 110 || compact(category.metaDescription).length > 200) issues.push({ type: "category_description_length", id: category.slug, value: compact(category.metaDescription).length });
}

const duplicateTitles = duplicateGroups(products, "metaTitle");
const duplicateDescriptions = duplicateGroups(products, "metaDescription");
if (duplicateTitles.length) issues.push({ type: "duplicate_product_titles", groups: duplicateTitles.length });
if (duplicateDescriptions.length) issues.push({ type: "duplicate_product_descriptions", groups: duplicateDescriptions.length });

const sourceCounts = Object.fromEntries(Array.from(products.reduce((map, product) => {
  const key = product.seoSource || "missing";
  map.set(key, (map.get(key) || 0) + 1);
  return map;
}, new Map())).sort((a, b) => b[1] - a[1]));
const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    categories: categories.length,
    productGroups: products.length,
    variants: products.reduce((sum, product) => sum + (product.variants || []).length, 0),
    categoryProfiles: Object.keys(profiles).length,
    duplicateTitles: duplicateTitles.length,
    duplicateDescriptions: duplicateDescriptions.length,
    issues: issues.length,
    sourceCounts,
  },
  issues,
};
fs.writeFileSync(path.join(OUTPUT, "seo-audit-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

const rows = [["url", "category", "primary_query", "sku", "meta_title", "meta_description", "seo_source"]];
for (const product of products) {
  const profile = profiles[product.category] || {};
  rows.push([`https://7tool.ru/p/${product.slug}`, product.category, profile.primaryQuery || "", product.sku || "", product.metaTitle || "", product.metaDescription || "", product.seoSource || ""]);
}
fs.writeFileSync(path.join(OUTPUT, "seo-products.csv"), `\uFEFF${rows.map((row) => row.map(csv).join(";")).join("\n")}\n`, "utf8");

console.log(JSON.stringify(report.summary, null, 2));
if (issues.length) process.exitCode = 1;
