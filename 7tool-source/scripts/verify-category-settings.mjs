import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = path.resolve(process.env.SQLITE_PATH ?? path.join(root, "data.db"));
const jsonPath = path.resolve(process.env.CATALOG_JSON_PATH ?? path.join(root, "src", "lib", "products.json"));

const fields = [
  ["slug", "slug"],
  ["title", "title"],
  ["icon", "icon"],
  ["sort_order", "sortOrder"],
  ["subtitle", "subtitle"],
  ["cta_text", "ctaText"],
  ["cover_image", "coverImage"],
  ["meta_title", "metaTitle"],
  ["meta_description", "metaDescription"],
  ["image_alt", "imageAlt"],
  ["h1", "h1"],
  ["intro", "intro"],
  ["seo_text", "seoText"],
  ["published", "published"],
];

function normalizedValue(field, value) {
  if (field === "sortOrder") return Number.isFinite(Number(value)) ? Number(value) : 0;
  if (field === "published") return Boolean(value);
  return value == null || value === "" ? null : String(value);
}

function normalizeDbCategory(row) {
  return Object.fromEntries(fields.map(([dbField, jsonField]) => [jsonField, normalizedValue(jsonField, row[dbField])]));
}

function normalizeJsonCategory(category) {
  return Object.fromEntries(fields.map(([, jsonField]) => [jsonField, normalizedValue(jsonField, category[jsonField])]));
}

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function bySlug(categories) {
  return new Map(categories.map((category) => [category.slug, category]));
}

function differences(dbCategories, jsonCategories) {
  const dbMap = bySlug(dbCategories);
  const jsonMap = bySlug(jsonCategories);
  const slugs = [...new Set([...dbMap.keys(), ...jsonMap.keys()])].sort((a, b) => a.localeCompare(b));
  return slugs.flatMap((slug) => {
    const dbCategory = dbMap.get(slug);
    const jsonCategory = jsonMap.get(slug);
    if (!dbCategory) return [{ slug, issue: "missing_in_db" }];
    if (!jsonCategory) return [{ slug, issue: "missing_in_json" }];
    const changedFields = fields
      .map(([, jsonField]) => jsonField)
      .filter((field) => dbCategory[field] !== jsonCategory[field]);
    return changedFields.length ? [{ slug, issue: "field_mismatch", fields: changedFields }] : [];
  });
}

if (!fs.existsSync(dbPath)) throw new Error(`SQLite database not found: ${dbPath}`);
if (!fs.existsSync(jsonPath)) throw new Error(`Catalog snapshot not found: ${jsonPath}`);

const database = new Database(dbPath, { readonly: true, fileMustExist: true });
const rows = database.prepare(`
  SELECT slug, title, icon, sort_order, subtitle, cta_text, cover_image,
         meta_title, meta_description, image_alt, h1, intro, seo_text, published
  FROM categories
  ORDER BY slug
`).all();
database.close();

const snapshot = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const dbCategories = rows.map(normalizeDbCategory).sort((a, b) => a.slug.localeCompare(b.slug));
const jsonCategories = (snapshot.categories ?? []).map(normalizeJsonCategory).sort((a, b) => a.slug.localeCompare(b.slug));
const diff = differences(dbCategories, jsonCategories);
const result = {
  ok: diff.length === 0,
  dbCategories: dbCategories.length,
  jsonCategories: jsonCategories.length,
  dbSettingsHash: hash(dbCategories),
  jsonSettingsHash: hash(jsonCategories),
  differences: diff,
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) {
  console.error("CATEGORY_SETTINGS_MISMATCH: feed refresh stopped to protect category settings");
  process.exitCode = 1;
}
