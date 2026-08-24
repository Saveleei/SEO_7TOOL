import crypto from "node:crypto";
import Database from "better-sqlite3";

const dbPath = process.env.SQLITE_PATH;
if (!dbPath) throw new Error("SQLITE_PATH is required");
const mode = process.argv[2] || "settings";
const excluded = ["sverla-i-zenkovki", "stanki-lazernoy-rezki", "svarochnye-roboty", "stanochnaya-osnastka"];
const database = new Database(dbPath, { readonly: true });
const fields = mode === "protected"
  ? "slug, sort_order, cover_image, published, subtitle, cta_text, meta_title, meta_description, h1, intro, seo_text"
  : "slug, sort_order, cover_image, published, subtitle, cta_text";
const where = mode === "protected" ? `WHERE slug NOT IN (${excluded.map(() => "?").join(",")})` : "";
const rows = database.prepare(`SELECT ${fields} FROM categories ${where} ORDER BY slug`).all(...(mode === "protected" ? excluded : []));
database.close();
console.log(crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex"));
