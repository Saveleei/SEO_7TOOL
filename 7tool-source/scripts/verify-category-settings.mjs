import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = process.env.SQLITE_PATH ?? path.join(root, "data.db");
const jsonPath = path.join(root, "src", "lib", "products.json");
const db = new Database(dbPath, { readonly: true });

const rows = db.prepare(`
  SELECT slug, title, icon, sort_order, subtitle, cta_text, cover_image,
         meta_title, meta_description, image_alt, h1, intro, seo_text, published
  FROM categories
  ORDER BY slug
`).all();
db.close();

const ownedFields = [
  "slug", "title", "icon", "sortOrder", "subtitle", "ctaText", "coverImage",
  "metaTitle", "metaDescription", "imageAlt", "h1", "intro", "seoText", "published",
];
const snapshot = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const jsonCategories = (snapshot.categories ?? [])
  .map((category) => Object.fromEntries(ownedFields.map((field) => [field, category[field] ?? null])))
  .sort((a, b) => a.slug.localeCompare(b.slug));

const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
console.log(JSON.stringify({
  dbCategories: rows.length,
  jsonCategories: jsonCategories.length,
  dbSettingsHash: hash(rows),
  jsonSettingsHash: hash(jsonCategories),
}));
