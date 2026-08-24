// Одноразовая безопасная миграция порядка верхнеуровневых категорий.
// Также переносит оснастку для кромкорезов из отдельного раздела в кромкорезы.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JSON_PATH = process.env.CATALOG_JSON_PATH ?? path.join(ROOT, "src", "lib", "products.json");
const DB_PATH = process.env.SQLITE_PATH ?? path.join(ROOT, "data.db");
const SOURCE_CATEGORY = "osnastka-dlya-kromkorezov";
const TARGET_CATEGORY = "kromkorezy-po-listu";
const PRIORITY = [
  "stanki-sverlilnye",
  "koronchatye-sverla",
  "kromkorezy-po-listu",
  "kromkorezy-dlya-trub",
  "borfrezy",
  "rezbonareznye-manipulyatory",
  "truborezy",
  "karetki-svarochnye",
  "pilnye-diski",
];

const catalog = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
const movedJson = (catalog.products ?? []).filter((product) => product.category === SOURCE_CATEGORY).length;
for (const product of catalog.products ?? []) {
  if (product.category === SOURCE_CATEGORY) product.category = TARGET_CATEGORY;
}
catalog.categories = (catalog.categories ?? []).filter((category) => category.slug !== SOURCE_CATEGORY);

const priority = new Map(PRIORITY.map((slug, index) => [slug, index]));
const originalIndex = new Map(catalog.categories.map((category, index) => [category.slug, index]));
const remainder = catalog.categories
  .filter((category) => !priority.has(category.slug))
  .sort((a, b) =>
    (Number.isFinite(a.sortOrder) ? a.sortOrder : originalIndex.get(a.slug) ?? 0)
    - (Number.isFinite(b.sortOrder) ? b.sortOrder : originalIndex.get(b.slug) ?? 0)
    || String(a.title ?? a.slug).localeCompare(String(b.title ?? b.slug), "ru"),
  );
const remainderOrder = new Map(remainder.map((category, index) => [category.slug, 100 + index]));
for (const category of catalog.categories) {
  category.sortOrder = priority.get(category.slug) ?? remainderOrder.get(category.slug) ?? 999;
}

const liveCounts = new Map();
for (const product of catalog.products ?? []) {
  if (product.draft) continue;
  liveCounts.set(product.category, (liveCounts.get(product.category) ?? 0) + 1);
}
for (const category of catalog.categories) category.count = liveCounts.get(category.slug) ?? 0;
catalog.categories.sort((a, b) => a.sortOrder - b.sortOrder || String(a.title).localeCompare(String(b.title), "ru"));

const tempPath = `${JSON_PATH}.category-order-${process.pid}.tmp`;
fs.writeFileSync(tempPath, JSON.stringify(catalog), "utf8");
fs.renameSync(tempPath, JSON_PATH);

if (!fs.existsSync(DB_PATH)) throw new Error(`SQLite database not found: ${DB_PATH}`);
const database = new Database(DB_PATH);
const movedDb = database.transaction(() => {
  const changed = database.prepare("UPDATE products SET category = ? WHERE category = ?").run(TARGET_CATEGORY, SOURCE_CATEGORY).changes;
  database.prepare("UPDATE subcategories SET category_slug = ? WHERE category_slug = ?").run(TARGET_CATEGORY, SOURCE_CATEGORY);
  database.prepare("DELETE FROM categories WHERE slug = ?").run(SOURCE_CATEGORY);
  const updateOrder = database.prepare("UPDATE categories SET sort_order = ? WHERE slug = ?");
  for (const category of catalog.categories) updateOrder.run(category.sortOrder, category.slug);
  return changed;
})();
database.pragma("optimize");
database.close();

console.log(JSON.stringify({
  ok: true,
  movedJson,
  movedDb,
  targetCategory: TARGET_CATEGORY,
  priority: PRIORITY,
  categoryCount: catalog.categories.length,
}, null, 2));
