// Импорт products.json → data.db. Идемпотентно (UPSERT по id).
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DB_PATH = process.env.SQLITE_PATH ?? path.join(ROOT, "data.db");
const JSON_PATH = path.join(ROOT, "src", "lib", "products.json");

const d = new Database(DB_PATH);
d.pragma("journal_mode = WAL");
d.pragma("foreign_keys = ON");

// миграции (зеркало lib/db.ts)
d.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS categories (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    subtitle TEXT,
    cta_text TEXT,
    cover_image TEXT,
    meta_title TEXT,
    meta_description TEXT,
    image_alt TEXT,
    h1 TEXT,
    intro TEXT,
    seo_text TEXT,
    published INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    brand TEXT,
    sku TEXT,
    category TEXT,
    icon TEXT,
    description TEXT,
    images TEXT NOT NULL DEFAULT '[]',
    accessories TEXT NOT NULL DEFAULT '[]',
    is_group INTEGER NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    param_axes TEXT NOT NULL DEFAULT '[]',
    price_from INTEGER,
    price_to INTEGER,
    discount_pct INTEGER,
    draft INTEGER NOT NULL DEFAULT 0,
    meta_title TEXT,
    meta_description TEXT,
    seo_text TEXT,
    seo_fingerprint TEXT,
    seo_source TEXT,
    seo_generated_at INTEGER,
    manual_sort_order INTEGER,
    sort_order INTEGER DEFAULT 0,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
  CREATE TABLE IF NOT EXISTS variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT,
    name TEXT,
    barcode TEXT,
    price INTEGER,
    old_price INTEGER,
    quantity INTEGER,
    available INTEGER NOT NULL DEFAULT 1,
    params TEXT NOT NULL DEFAULT '[]',
    images TEXT,
    sort_order INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id);
  CREATE TABLE IF NOT EXISTS subcategories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_slug TEXT NOT NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    short_description TEXT,
    intro TEXT,
    seo_text TEXT,
    meta_title TEXT,
    meta_description TEXT,
    image TEXT,
    image_alt TEXT,
    published INTEGER NOT NULL DEFAULT 1,
    min_products INTEGER NOT NULL DEFAULT 2,
    match_mode TEXT NOT NULL DEFAULT 'any',
    rules_json TEXT NOT NULL DEFAULT '[]',
    manual_product_ids TEXT NOT NULL DEFAULT '[]',
    sort_order INTEGER NOT NULL DEFAULT 0,
    form_enabled INTEGER NOT NULL DEFAULT 1,
    form_position TEXT NOT NULL DEFAULT 'after_products',
    UNIQUE(category_slug, slug)
  );
  CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_slug, sort_order);
`);

// Идемпотентно доводим раннюю схему до текущей до upsert данных.
const categoryColumns = new Set(d.prepare("PRAGMA table_info(categories)").all().map((row) => row.name));
const categoryMigrations = [
  ["subtitle", "TEXT"],
  ["cta_text", "TEXT"],
  ["cover_image", "TEXT"],
  ["meta_title", "TEXT"],
  ["meta_description", "TEXT"],
  ["image_alt", "TEXT"],
  ["h1", "TEXT"],
  ["intro", "TEXT"],
  ["seo_text", "TEXT"],
  ["published", "INTEGER NOT NULL DEFAULT 1"],
];
for (const [name, sqlType] of categoryMigrations) {
  if (!categoryColumns.has(name)) d.exec(`ALTER TABLE categories ADD COLUMN ${name} ${sqlType}`);
}

const productColumns = new Set(d.prepare("PRAGMA table_info(products)").all().map((row) => row.name));
const productMigrations = [
  ["meta_title", "TEXT"],
  ["meta_description", "TEXT"],
  ["seo_text", "TEXT"],
  ["seo_fingerprint", "TEXT"],
  ["seo_source", "TEXT"],
  ["seo_generated_at", "INTEGER"],
  ["manual_sort_order", "INTEGER"],
  ["feed_category_id", "TEXT"],
];
for (const [name, sqlType] of productMigrations) {
  if (!productColumns.has(name)) d.exec(`ALTER TABLE products ADD COLUMN ${name} ${sqlType}`);
}

console.log("loading", JSON_PATH);
const raw = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));

const insCat = d.prepare(`
  INSERT INTO categories (
    slug, title, icon, sort_order, subtitle, cta_text, cover_image,
    meta_title, meta_description, image_alt, h1, intro, seo_text, published
  ) VALUES (
    @slug, @title, @icon, @sort_order, @subtitle, @cta_text, @cover_image,
    @meta_title, @meta_description, @image_alt, @h1, @intro, @seo_text, @published
  )
  ON CONFLICT(slug) DO UPDATE SET
    title=excluded.title, icon=excluded.icon, sort_order=excluded.sort_order,
    subtitle=excluded.subtitle, cta_text=excluded.cta_text, cover_image=excluded.cover_image,
    meta_title=excluded.meta_title, meta_description=excluded.meta_description,
    image_alt=excluded.image_alt, h1=excluded.h1, intro=excluded.intro,
    seo_text=excluded.seo_text, published=excluded.published
`);
raw.categories.forEach((c, i) => {
  insCat.run({
    slug: c.slug,
    title: c.title,
    icon: c.icon ?? null,
    sort_order: c.sortOrder ?? i,
    subtitle: c.subtitle ?? null,
    cta_text: c.ctaText ?? null,
    cover_image: c.coverImage ?? null,
    meta_title: c.metaTitle ?? null,
    meta_description: c.metaDescription ?? null,
    image_alt: c.imageAlt ?? null,
    h1: c.h1 ?? null,
    intro: c.intro ?? null,
    seo_text: c.seoText ?? null,
    published: c.published === false ? 0 : 1,
  });
});
console.log("categories:", raw.categories.length);

if (Array.isArray(raw.subcategories)) {
  const upsertSubcategory = d.prepare(`
    INSERT INTO subcategories (
      category_slug, slug, title, short_description, intro, seo_text,
      meta_title, meta_description, image, image_alt, published, min_products,
      match_mode, rules_json, manual_product_ids, sort_order, form_enabled, form_position
    ) VALUES (
      @category_slug, @slug, @title, @short_description, @intro, @seo_text,
      @meta_title, @meta_description, @image, @image_alt, @published, @min_products,
      @match_mode, @rules_json, @manual_product_ids, @sort_order, @form_enabled, @form_position
    )
    ON CONFLICT(category_slug, slug) DO UPDATE SET
      title=excluded.title, short_description=excluded.short_description,
      intro=excluded.intro, seo_text=excluded.seo_text, meta_title=excluded.meta_title,
      meta_description=excluded.meta_description, image=excluded.image,
      image_alt=excluded.image_alt, published=excluded.published,
      min_products=excluded.min_products, match_mode=excluded.match_mode,
      rules_json=excluded.rules_json, manual_product_ids=excluded.manual_product_ids,
      sort_order=excluded.sort_order, form_enabled=excluded.form_enabled,
      form_position=excluded.form_position
  `);
  raw.subcategories.forEach((item, index) => upsertSubcategory.run({
    category_slug: item.categorySlug,
    slug: item.slug,
    title: item.title,
    short_description: item.shortDescription ?? null,
    intro: item.intro ?? null,
    seo_text: item.seoText ?? null,
    meta_title: item.metaTitle ?? null,
    meta_description: item.metaDescription ?? null,
    image: item.image ?? null,
    image_alt: item.imageAlt ?? null,
    published: item.published === false ? 0 : 1,
    min_products: Number.isFinite(item.minProducts) ? item.minProducts : 2,
    match_mode: item.match === "all" ? "all" : "any",
    rules_json: JSON.stringify(item.rules ?? []),
    manual_product_ids: JSON.stringify(item.manualProductIds ?? []),
    sort_order: Number.isFinite(item.sortOrder) ? item.sortOrder : index,
    form_enabled: item.formEnabled === false ? 0 : 1,
    form_position: item.formPosition === "after_subcategories" ? "after_subcategories" : "after_products",
  }));
  console.log("subcategories:", raw.subcategories.length);
}

const upsertProd = d.prepare(`
  INSERT INTO products (
    id, slug, title, brand, sku, category, icon, description,
    images, accessories, is_group, stock, param_axes,
    price_from, price_to, discount_pct, draft,
    meta_title, meta_description, seo_text, seo_fingerprint, seo_source,
    seo_generated_at, manual_sort_order, sort_order, updated_at, feed_category_id
  ) VALUES (
    @id, @slug, @title, @brand, @sku, @category, @icon, @description,
    @images, @accessories, @is_group, @stock, @param_axes,
    @price_from, @price_to, @discount_pct, @draft,
    @meta_title, @meta_description, @seo_text, @seo_fingerprint, @seo_source,
    @seo_generated_at, @manual_sort_order, @sort_order, @updated_at, @feed_category_id
  )
  ON CONFLICT(id) DO UPDATE SET
    slug = excluded.slug, title = excluded.title, brand = excluded.brand, sku = excluded.sku,
    category = excluded.category, icon = excluded.icon, description = excluded.description,
    images = excluded.images, accessories = excluded.accessories, is_group = excluded.is_group,
    stock = excluded.stock, param_axes = excluded.param_axes,
    price_from = excluded.price_from, price_to = excluded.price_to, discount_pct = excluded.discount_pct,
    draft = excluded.draft,
    meta_title = COALESCE(excluded.meta_title, products.meta_title),
    meta_description = COALESCE(excluded.meta_description, products.meta_description),
    seo_text = COALESCE(excluded.seo_text, products.seo_text),
    seo_fingerprint = COALESCE(excluded.seo_fingerprint, products.seo_fingerprint),
    seo_source = COALESCE(excluded.seo_source, products.seo_source),
    seo_generated_at = COALESCE(excluded.seo_generated_at, products.seo_generated_at),
    manual_sort_order = excluded.manual_sort_order,
    sort_order = excluded.sort_order, updated_at = excluded.updated_at,
    feed_category_id = excluded.feed_category_id
`);

const upsertVar = d.prepare(`
  INSERT INTO variants (
    id, product_id, sku, name, barcode, price, old_price, quantity,
    available, params, images, sort_order
  ) VALUES (
    @id, @product_id, @sku, @name, @barcode, @price, @old_price, @quantity,
    @available, @params, @images, @sort_order
  )
  ON CONFLICT(id) DO UPDATE SET
    product_id = excluded.product_id, sku = excluded.sku, name = excluded.name,
    barcode = excluded.barcode, price = excluded.price, old_price = excluded.old_price,
    quantity = excluded.quantity, available = excluded.available,
    params = excluded.params, images = excluded.images, sort_order = excluded.sort_order
`);

const now = Date.now();
const tx = d.transaction(() => {
  for (let i = 0; i < raw.products.length; i++) {
    const p = raw.products[i];
    upsertProd.run({
      id: p.id,
      slug: p.slug,
      title: p.title,
      brand: p.brand ?? null,
      sku: p.sku ?? null,
      category: p.category ?? null,
      icon: p.icon ?? null,
      description: p.description ?? null,
      images: JSON.stringify(p.images ?? []),
      accessories: JSON.stringify(p.accessories ?? []),
      is_group: p.isGroup ? 1 : 0,
      stock: p.stock ?? 0,
      param_axes: JSON.stringify(p.paramAxes ?? []),
      price_from: p.priceFrom ?? null,
      price_to: p.priceTo ?? null,
      discount_pct: p.discountPct ?? null,
      draft: p.draft ? 1 : 0,
      meta_title: p.metaTitle ?? null,
      meta_description: p.metaDescription ?? null,
      seo_text: p.seoText ?? null,
      seo_fingerprint: p.seoFingerprint ?? null,
      seo_source: p.seoSource ?? null,
      seo_generated_at: p.seoGeneratedAt ?? null,
      manual_sort_order: Number.isFinite(p.manualSortOrder) ? Math.trunc(p.manualSortOrder) : null,
      sort_order: i,
      updated_at: now,
      feed_category_id: p.feedCategoryId ?? null,
    });
    (p.variants ?? []).forEach((v, vi) => {
      upsertVar.run({
        id: v.id,
        product_id: p.id,
        sku: v.sku ?? null,
        name: v.name ?? null,
        barcode: v.barcode ?? null,
        price: v.price ?? null,
        old_price: v.oldPrice ?? null,
        quantity: v.quantity ?? null,
        available: v.available === false ? 0 : 1,
        params: JSON.stringify(v.params ?? []),
        images: v.images ? JSON.stringify(v.images) : null,
        sort_order: vi,
      });
    });
  }
});
tx();
console.log("products:", raw.products.length, "→ db");
console.log("variants:", d.prepare("SELECT COUNT(*) AS n FROM variants").get().n);
d.pragma("optimize");

// seed admin (если ещё нет ни одного пользователя)
const userCount = d.prepare("SELECT COUNT(*) AS n FROM users").get().n;
if (userCount === 0) {
  const email = process.env.ADMIN_EMAIL || "admin@7tool.local";
  const pwd = process.env.ADMIN_PASSWORD || "admin-7tool-" + now.toString(36).slice(-6);
  const hash = bcrypt.hashSync(pwd, 10);
  d.prepare("INSERT INTO users (email, password_hash, name, role, created_at) VALUES (?, ?, ?, 'admin', ?)").run(
    email,
    hash,
    "Admin",
    Date.now(),
  );
  console.log(`\n>> Создан admin: ${email} / ${pwd}`);
  console.log(">> Запиши пароль и смени его в админке после первого входа.");
}

console.log("\nDB ready at", DB_PATH);
