import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backupPath = process.argv[2];
if (!backupPath) throw new Error("backup products.json path is required");

const jsonPath = path.join(root, "src", "lib", "products.json");
const dbPath = process.env.SQLITE_PATH ?? path.join(root, "data.db");
const before = JSON.parse(fs.readFileSync(backupPath, "utf8"));
const current = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const oldBySlug = new Map((before.categories ?? []).map((category) => [category.slug, category]));
const ownedFields = [
  "title", "icon", "subtitle", "ctaText", "coverImage", "metaTitle",
  "metaDescription", "imageAlt", "h1", "intro", "seoText", "published", "sortOrder",
];

let restoredJson = 0;
let nextNewSortOrder = Math.max(
  -1,
  ...(before.categories ?? []).map((category) => Number.isFinite(category.sortOrder) ? category.sortOrder : -1),
) + 1;
const newCategoryOrders = new Map();
for (const category of current.categories ?? []) {
  const old = oldBySlug.get(category.slug);
  if (!old) {
    category.sortOrder = nextNewSortOrder++;
    newCategoryOrders.set(category.slug, category.sortOrder);
    continue;
  }
  for (const field of ownedFields) {
    if (Object.hasOwn(old, field)) category[field] = old[field];
    else delete category[field];
  }
  restoredJson += 1;
}

const database = new Database(dbPath);
const update = database.prepare(`
  UPDATE categories SET
    title = ?, icon = ?, sort_order = ?, subtitle = ?, cta_text = ?, cover_image = ?,
    meta_title = ?, meta_description = ?, image_alt = ?, h1 = ?, intro = ?, seo_text = ?, published = ?
  WHERE slug = ?
`);
let restoredDb = 0;
database.transaction(() => {
  for (const [slug, category] of oldBySlug) {
    const result = update.run(
      category.title ?? slug,
      category.icon ?? null,
      Number.isFinite(category.sortOrder) ? category.sortOrder : 0,
      category.subtitle ?? null,
      category.ctaText ?? null,
      category.coverImage ?? null,
      category.metaTitle ?? null,
      category.metaDescription ?? null,
      category.imageAlt ?? null,
      category.h1 ?? null,
      category.intro ?? null,
      category.seoText ?? null,
      category.published === false ? 0 : 1,
      slug,
    );
    restoredDb += result.changes;
  }
  const updateNewOrder = database.prepare("UPDATE categories SET sort_order = ? WHERE slug = ?");
  for (const [slug, sortOrder] of newCategoryOrders) updateNewOrder.run(sortOrder, slug);
})();
database.close();

const tempPath = `${jsonPath}.restore-${process.pid}.tmp`;
fs.writeFileSync(tempPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
fs.renameSync(tempPath, jsonPath);

console.log(JSON.stringify({ restoredJson, restoredDb, newCategoriesKept: (current.categories ?? []).length - restoredJson }));
