import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

// Путь к файлу БД: на проде — рядом с приложением, в dev — в корне web/.
const DB_PATH = process.env.SQLITE_PATH ?? path.join(process.cwd(), "data.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  const d = new Database(DB_PATH);
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");
  migrate(d);
  _db = d;
  return d;
}

function migrate(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      v INTEGER PRIMARY KEY
    );
    INSERT OR IGNORE INTO schema_version (v) VALUES (0);
  `);
  // Накатим колонки в categories если их нет
  const colInfo = d.prepare("PRAGMA table_info(categories)").all() as { name: string }[];
  const has = (n: string) => colInfo.some((c) => c.name === n);
  const adds: string[] = [];
  if (colInfo.length) {
    if (!has("subtitle")) adds.push("ALTER TABLE categories ADD COLUMN subtitle TEXT");
    if (!has("cta_text")) adds.push("ALTER TABLE categories ADD COLUMN cta_text TEXT");
    if (!has("cover_image")) adds.push("ALTER TABLE categories ADD COLUMN cover_image TEXT");
    if (!has("meta_title")) adds.push("ALTER TABLE categories ADD COLUMN meta_title TEXT");
    if (!has("meta_description")) adds.push("ALTER TABLE categories ADD COLUMN meta_description TEXT");
    if (!has("image_alt")) adds.push("ALTER TABLE categories ADD COLUMN image_alt TEXT");
    if (!has("h1")) adds.push("ALTER TABLE categories ADD COLUMN h1 TEXT");
    if (!has("intro")) adds.push("ALTER TABLE categories ADD COLUMN intro TEXT");
    if (!has("seo_text")) adds.push("ALTER TABLE categories ADD COLUMN seo_text TEXT");
    if (!has("published")) adds.push("ALTER TABLE categories ADD COLUMN published INTEGER NOT NULL DEFAULT 1");
  }
  if (adds.length) {
    d.exec(adds.join(";\n") + ";");
  }
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
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

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

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at INTEGER NOT NULL,
      type TEXT NOT NULL,
      name TEXT,
      phone TEXT,
      email TEXT,
      company TEXT,
      inn TEXT,
      message TEXT,
      product_id TEXT,
      product_title TEXT,
      product_url TEXT,
      page_url TEXT,
      ip TEXT,
      user_agent TEXT,
      payload TEXT,
      email_sent INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_leads_type ON leads(type);

    -- Ручной контент рекламных посадочных хранится отдельно от каталога.
    -- Синхронизация товарного фида эту таблицу не изменяет.
    CREATE TABLE IF NOT EXISTS landing_content (
      category_slug TEXT NOT NULL,
      intent_slug TEXT NOT NULL,
      content_json TEXT NOT NULL DEFAULT '{}',
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (category_slug, intent_slug)
    );
  `);

  // SEO-контент хранится отдельно от данных фида: обновление цены, наличия и
  // фотографий не должно стирать уже проверенный текст карточки.
  const productColumns = d.prepare("PRAGMA table_info(products)").all() as { name: string }[];
  const productColumnNames = new Set(productColumns.map((column) => column.name));
  const productMigrations: Array<[string, string]> = [
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
    if (!productColumnNames.has(name)) d.exec(`ALTER TABLE products ADD COLUMN ${name} ${sqlType}`);
  }

  // Рекламная атрибуция и жизненный цикл заявки хранятся отдельными полями,
  // чтобы выгрузка офлайн-конверсий не зависела от разбора JSON payload.
  const leadColumns = d.prepare("PRAGMA table_info(leads)").all() as { name: string }[];
  const leadColumnNames = new Set(leadColumns.map((column) => column.name));
  const leadMigrations: Array<[string, string]> = [
    ["request_id", "TEXT"],
    ["status", "TEXT NOT NULL DEFAULT 'new'"],
    ["category", "TEXT"],
    ["intent", "TEXT"],
    ["landing", "TEXT"],
    ["yclid", "TEXT"],
    ["client_id", "TEXT"],
    ["internal_client_id", "TEXT"],
    ["first_touch", "TEXT"],
    ["last_non_direct", "TEXT"],
    ["referrer", "TEXT"],
    ["first_visit_at", "TEXT"],
    ["variant_id", "TEXT"],
    ["submission_id", "TEXT"],
    ["utm_source", "TEXT"],
    ["utm_medium", "TEXT"],
    ["utm_campaign", "TEXT"],
    ["utm_content", "TEXT"],
    ["utm_term", "TEXT"],
    ["revenue", "INTEGER"],
    ["uploaded_file", "TEXT"],
    ["uploaded_files", "TEXT"],
    ["email_error", "TEXT"],
    ["email_last_attempt_at", "INTEGER"],
    ["max_sent", "INTEGER NOT NULL DEFAULT 0"],
    ["max_error", "TEXT"],
    ["max_last_attempt_at", "INTEGER"],
    ["qualified_at", "INTEGER"],
    ["won_at", "INTEGER"],
  ];
  for (const [name, sqlType] of leadMigrations) {
    if (!leadColumnNames.has(name)) d.exec(`ALTER TABLE leads ADD COLUMN ${name} ${sqlType}`);
  }
  d.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_request_id ON leads(request_id) WHERE request_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_leads_yclid ON leads(yclid) WHERE yclid IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_submission_id ON leads(submission_id) WHERE submission_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS notification_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      channel TEXT NOT NULL CHECK(channel IN ('email', 'max')),
      state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending', 'processing', 'sent', 'failed')),
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL,
      last_attempt_at INTEGER,
      sent_at INTEGER,
      last_error TEXT,
      provider_message_id TEXT,
      provider_response TEXT,
      UNIQUE(lead_id, channel)
    );
    CREATE INDEX IF NOT EXISTS idx_notification_outbox_due ON notification_outbox(state, next_attempt_at);

    CREATE TABLE IF NOT EXISTS offline_conversions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      target TEXT NOT NULL CHECK(target IN ('qualified_call', 'lead_qualified', 'lead_won')),
      conversion_id TEXT NOT NULL UNIQUE,
      state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending', 'uploading', 'accepted', 'processed', 'failed', 'rejected')),
      attempt_count INTEGER NOT NULL DEFAULT 0,
      retry_at INTEGER,
      uploaded_at INTEGER,
      upload_error TEXT,
      provider_upload_id INTEGER,
      provider_status TEXT,
      source_quantity INTEGER,
      line_quantity INTEGER,
      conversion_at INTEGER NOT NULL,
      revenue INTEGER,
      UNIQUE(lead_id, target)
    );
    CREATE INDEX IF NOT EXISTS idx_offline_conversions_state ON offline_conversions(state, retry_at);

    CREATE TABLE IF NOT EXISTS call_tracking_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_call_id TEXT NOT NULL UNIQUE,
      request_id TEXT,
      client_id TEXT,
      yclid TEXT,
      source TEXT,
      campaign TEXT,
      answered INTEGER NOT NULL DEFAULT 0,
      is_unique INTEGER NOT NULL DEFAULT 0,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      qualified INTEGER NOT NULL DEFAULT 0,
      result TEXT,
      started_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_call_tracking_request ON call_tracking_events(request_id);
  `);
  d.pragma("optimize");
}

export function tables(d = db()) {
  return {
    productCount: () => (d.prepare("SELECT COUNT(*) AS n FROM products").get() as { n: number }).n,
    variantCount: () => (d.prepare("SELECT COUNT(*) AS n FROM variants").get() as { n: number }).n,
    categoryCount: () => (d.prepare("SELECT COUNT(*) AS n FROM categories").get() as { n: number }).n,
    userCount: () => (d.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n,
  };
}
