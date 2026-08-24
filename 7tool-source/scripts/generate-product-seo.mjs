// Генерация предметного SEO по фактам из товарного фида.
// Результат сохраняется в products.json и SQLite и не стирается синхронизацией фида.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const JSON_PATH = path.join(ROOT, "src", "lib", "products.json");
const PROFILE_PATH = path.join(ROOT, "src", "lib", "category-seo.json");
const CONFLICT_PATH = path.join(ROOT, ".analysis", "seo-data-conflicts.json");
const DB_PATH = process.env.SQLITE_PATH ?? path.join(ROOT, "data.db");
const Database = fs.existsSync(DB_PATH) ? (await import("better-sqlite3")).default : null;
const API_KEY = process.env.SEO_AI_API_KEY || process.env.OPENAI_API_KEY;
const API_URL = process.env.SEO_AI_API_URL || "https://api.openai.com/v1/responses";
const MODEL = process.env.SEO_AI_MODEL || "gpt-5.6-terra";
const BATCH_SIZE = Math.max(1, Math.min(12, Number(process.env.SEO_AI_BATCH_SIZE || 8)));
const args = new Set(process.argv.slice(2));
const configuredOnly = args.has("--if-configured");
const bestEffort = args.has("--best-effort");
const force = args.has("--force");
const refreshExisting = args.has("--refresh-existing");
const all = args.has("--all");
const categoryArgIndex = process.argv.indexOf("--category");
const categoryArg = process.argv.find((value) => value.startsWith("--category="))?.split("=", 2)[1]
  || (categoryArgIndex >= 0 ? process.argv[categoryArgIndex + 1] : undefined);
const limitArgIndex = process.argv.indexOf("--limit");
const requestedLimit = limitArgIndex >= 0 ? Number(process.argv[limitArgIndex + 1]) : Number(process.env.SEO_AI_LIMIT || 24);
const limit = all ? Number.POSITIVE_INFINITY : Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 24);

if (!API_KEY) {
  const message = "SEO AI: ключ не настроен (SEO_AI_API_KEY или OPENAI_API_KEY)";
  if (configuredOnly) {
    console.log(`${message}; генерация пропущена`);
    process.exit(0);
  }
  throw new Error(message);
}

const catalog = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
const profiles = JSON.parse(fs.readFileSync(PROFILE_PATH, "utf8"));
const categories = new Map((catalog.categories || []).map((item) => [item.slug, item.title]));
const conflictProductIds = new Set(
  fs.existsSync(CONFLICT_PATH)
    ? (JSON.parse(fs.readFileSync(CONFLICT_PATH, "utf8")).productIds || []).map(String)
    : [],
);

function normalizedFacts(product) {
  const variants = (product.variants || []).slice(0, 18).map((variant) => ({
    sku: variant.sku || "",
    name: variant.name || "",
    params: (variant.params || []).slice(0, 16).map((param) => ({
      name: param.name,
      value: param.value,
      unit: param.unit || "",
    })),
  }));
  return {
    id: product.id,
    title: product.title,
    brand: product.brand || "",
    sku: product.sku || "",
    category: categories.get(product.category) || product.category,
    searchIntent: profiles[product.category] ? {
      primaryQuery: profiles[product.category].primaryQuery,
      relatedQueries: profiles[product.category].keywords,
      purpose: profiles[product.category].productPurpose,
    } : undefined,
    description: String(product.description || "").slice(0, 3_000),
    variants,
  };
}

function fingerprint(product) {
  return crypto.createHash("sha256").update(JSON.stringify(normalizedFacts(product))).digest("hex");
}

const candidates = (catalog.products || [])
  .filter((product) => !product.draft && product.title && (product.variants || []).length)
  .filter((product) => !categoryArg || product.category === categoryArg)
  .filter((product) => {
    const safe = !conflictProductIds.has(String(product.id));
    if (!safe) console.warn(`SEO guard: ${product.id} пропущен из-за SEO_DATA_CONFLICT`);
    return safe;
  })
  .map((product) => ({ product, fingerprint: fingerprint(product) }))
  // Ручные SEO-правки из админки всегда имеют приоритет. Перезаписать их можно
  // только явным запуском --force, которого нет в nightly/hourly cron.
  .filter(({ product }) => product.seoSource !== "manual")
  .filter(({ product, fingerprint: value }) => {
    if (force) return true;
    const missing = !product.metaTitle || !product.metaDescription || !product.seoText;
    if (missing) return true;
    if (!refreshExisting) return false;
    const source = String(product.seoSource || "");
    return !source.startsWith("openai:") && (
      product.seoFingerprint !== value
      || source.startsWith("programmatic:")
      || source.startsWith("generated:")
    );
  })
  .slice(0, limit);

if (!candidates.length) {
  console.log("SEO AI: все опубликованные товары актуальны");
  process.exit(0);
}

const developerPrompt = `Ты — технический SEO-редактор российского B2B-каталога промышленного инструмента.
Используй исключительно переданные факты о товаре. Не выдумывай характеристики, совместимость, страну производства, сертификаты, гарантию, цены, остатки, преимущества или статус дилера.
Разрешённые общие коммерческие факты: склад в Москве и Санкт-Петербурге; при наличии отгрузка в день оплаты; доставка транспортной компанией или машиной продавца; документы с НДС.
Для каждого id верни:
- metaTitle: коммерческий интент, точный тип товара, бренд/модель и артикул; главный запрос ближе к началу; естественный русский язык, 45–80 знаков;
- metaDescription: точное назначение, 1–2 отличительных параметра и коммерческая информация; 120–200 знаков;
- seoText: 2–3 полезных абзаца общей длиной 450–1000 знаков. Объясни назначение, критерии выбора именно этого товара и подтверждённые условия поставки.
Используй primaryQuery и relatedQueries как семантический ориентир, но не вставляй список ключей. Не используй HTML, переспам, превосходные степени, фиктивные преимущества и неподтверждённые обещания. Текст разных товаров должен различаться по смыслу, а не только артикулом.`;

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "metaTitle", "metaDescription", "seoText"],
        properties: {
          id: { type: "string" },
          metaTitle: { type: "string" },
          metaDescription: { type: "string" },
          seoText: { type: "string" },
        },
      },
    },
  },
};

function outputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("");
}

function compact(value) {
  return String(value || "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
}

function validateResult(result, batch) {
  if (!result || !Array.isArray(result.items)) throw new Error("ответ не содержит items");
  const expected = new Map(batch.map((entry) => [String(entry.product.id), entry]));
  if (result.items.length !== expected.size) throw new Error(`ожидалось ${expected.size} элементов, получено ${result.items.length}`);
  const seen = new Set();
  return result.items.map((item) => {
    const id = String(item.id || "");
    const entry = expected.get(id);
    if (!entry || seen.has(id)) throw new Error(`неожиданный или повторный id ${id}`);
    seen.add(id);
    const metaTitle = compact(item.metaTitle);
    const metaDescription = compact(item.metaDescription);
    const seoText = compact(item.seoText);
    if (metaTitle.length < 30 || metaTitle.length > 90) throw new Error(`${id}: длина metaTitle ${metaTitle.length}`);
    if (metaDescription.length < 100 || metaDescription.length > 220) throw new Error(`${id}: длина metaDescription ${metaDescription.length}`);
    if (seoText.length < 320 || seoText.length > 1_200) throw new Error(`${id}: длина seoText ${seoText.length}`);
    const combined = `${metaTitle} ${metaDescription} ${seoText}`;
    if (/<[^>]+>/.test(combined)) throw new Error(`${id}: HTML запрещён`);
    if (/лучши[йея]|№\s*1|гарантирован|единственн|официальн(?:ый|ого) дилер/i.test(combined)) {
      throw new Error(`${id}: неподтверждённое рекламное утверждение`);
    }
    const facts = JSON.stringify(normalizedFacts(entry.product)).toLocaleLowerCase("ru");
    const unknownNumbers = Array.from(combined.matchAll(/\d+(?:[.,]\d+)?/g), (match) => match[0].replace(",", "."))
      .filter((value) => !facts.includes(value) && value !== "7");
    if (unknownNumbers.length) throw new Error(`${id}: неподтверждённые числа ${Array.from(new Set(unknownNumbers)).join(", ")}`);
    return { id, metaTitle, metaDescription, seoText, entry };
  });
}

async function requestBatch(batch) {
  const facts = batch.map(({ product }) => normalizedFacts(product));
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      reasoning: { effort: "low" },
      input: [
        { role: "developer", content: [{ type: "input_text", text: developerPrompt }] },
        { role: "user", content: [{ type: "input_text", text: JSON.stringify(facts) }] },
      ],
      text: { format: { type: "json_schema", name: "product_seo", strict: true, schema: responseSchema } },
      max_output_tokens: Math.max(2_500, batch.length * 900),
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 800);
    throw new Error(`OpenAI HTTP ${response.status}: ${detail}`);
  }
  const payload = await response.json();
  const text = outputText(payload);
  if (!text) throw new Error("API вернул пустой текст");
  return validateResult(JSON.parse(text), batch);
}

function ensureSeoColumns(database) {
  const columns = new Set(database.prepare("PRAGMA table_info(products)").all().map((row) => row.name));
  for (const [name, sqlType] of [
    ["meta_title", "TEXT"],
    ["meta_description", "TEXT"],
    ["seo_text", "TEXT"],
    ["seo_fingerprint", "TEXT"],
    ["seo_source", "TEXT"],
    ["seo_generated_at", "INTEGER"],
  ]) {
    if (!columns.has(name)) database.exec(`ALTER TABLE products ADD COLUMN ${name} ${sqlType}`);
  }
}

function persist(results) {
  const now = Date.now();
  for (const result of results) {
    Object.assign(result.entry.product, {
      metaTitle: result.metaTitle,
      metaDescription: result.metaDescription,
      seoText: result.seoText,
      seoFingerprint: result.entry.fingerprint,
      seoSource: `openai:${MODEL}`,
      seoGeneratedAt: now,
    });
  }
  const tempPath = `${JSON_PATH}.seo-${process.pid}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, JSON_PATH);

  if (fs.existsSync(DB_PATH) && Database) {
    const database = new Database(DB_PATH);
    ensureSeoColumns(database);
    const update = database.prepare(`
      UPDATE products SET meta_title = ?, meta_description = ?, seo_text = ?,
        seo_fingerprint = ?, seo_source = ?, seo_generated_at = ? WHERE id = ?
    `);
    database.transaction(() => {
      for (const result of results) {
        update.run(result.metaTitle, result.metaDescription, result.seoText,
          result.entry.fingerprint, `openai:${MODEL}`, now, result.id);
      }
    })();
    database.pragma("optimize");
    database.close();
  }
}

let generated = 0;
let failed = 0;
for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
  const batch = candidates.slice(offset, offset + BATCH_SIZE);
  try {
    let results;
    try {
      results = await requestBatch(batch);
    } catch (firstError) {
      console.warn(`SEO AI: повтор запроса после ошибки: ${firstError.message}`);
      results = await requestBatch(batch);
    }
    persist(results);
    generated += results.length;
    console.log(`SEO AI: сохранено ${generated}/${candidates.length}`);
  } catch (error) {
    failed += batch.length;
    console.error(`SEO AI: пакет не сохранён: ${error.message}`);
    if (!bestEffort) process.exitCode = 1;
  }
}

console.log(`SEO AI: модель=${MODEL}; сгенерировано=${generated}; ошибок=${failed}; ожидают=${Math.max(0, candidates.length - generated - failed)}`);
