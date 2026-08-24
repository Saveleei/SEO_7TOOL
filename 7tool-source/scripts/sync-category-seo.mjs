// Синхронизирует экспертный SEO-профиль категорий с JSON-каталогом и SQLite.
// Обложки, порядок, публикация и остальные ручные настройки категории не меняются.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JSON_PATH = path.join(ROOT, "src", "lib", "products.json");
const PROFILE_PATH = path.join(ROOT, "src", "lib", "category-seo.json");
const DB_PATH = process.env.SQLITE_PATH ?? path.join(ROOT, "data.db");
const refreshExisting = process.argv.includes("--refresh-existing");
const categoryArgIndex = process.argv.indexOf("--category");
const categoryArg = process.argv.find((value) => value.startsWith("--category="))?.split("=", 2)[1]
  || (categoryArgIndex >= 0 ? process.argv[categoryArgIndex + 1] : undefined);

const catalog = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
const profiles = JSON.parse(fs.readFileSync(PROFILE_PATH, "utf8"));
const missing = [];
let updated = 0;
const updates = [];

for (const category of catalog.categories || []) {
  if (categoryArg && category.slug !== categoryArg) continue;
  const profile = profiles[category.slug];
  if (!profile) {
    missing.push(category.slug);
    continue;
  }
  const values = {
    h1: profile.h1,
    intro: profile.intro,
    metaTitle: profile.metaTitle,
    metaDescription: profile.metaDescription,
    seoText: profile.seoText.join("\n\n"),
    imageAlt: category.imageAlt || `${profile.h1} — оборудование и инструмент`,
  };
  const patch = Object.fromEntries(Object.entries(values).filter(([key]) => refreshExisting || !category[key]));
  if (!Object.keys(patch).length) continue;
  Object.assign(category, patch);
  updates.push({ category, profile, values });
  updated += 1;
}

if (missing.length) throw new Error(`Нет SEO-профилей категорий: ${missing.join(", ")}`);

const temp = `${JSON_PATH}.category-seo-${process.pid}.tmp`;
fs.writeFileSync(temp, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
fs.renameSync(temp, JSON_PATH);

if (fs.existsSync(DB_PATH)) {
  const database = new Database(DB_PATH);
  const update = database.prepare(refreshExisting ? `
    UPDATE categories
    SET h1 = ?, intro = ?, meta_title = ?, meta_description = ?, seo_text = ?, image_alt = COALESCE(NULLIF(image_alt, ''), ?)
    WHERE slug = ?
  ` : `
    UPDATE categories
    SET h1 = COALESCE(NULLIF(h1, ''), ?), intro = COALESCE(NULLIF(intro, ''), ?),
        meta_title = COALESCE(NULLIF(meta_title, ''), ?), meta_description = COALESCE(NULLIF(meta_description, ''), ?),
        seo_text = COALESCE(NULLIF(seo_text, ''), ?), image_alt = COALESCE(NULLIF(image_alt, ''), ?)
    WHERE slug = ?
  `);
  database.transaction(() => {
    for (const { category, values } of updates) {
      update.run(values.h1, values.intro, values.metaTitle, values.metaDescription,
        values.seoText, values.imageAlt, category.slug);
    }
  })();
  database.pragma("optimize");
  database.close();
}

console.log(`SEO категорий: синхронизировано ${updated}; обложки и ручной порядок сохранены`);
