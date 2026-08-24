// Предметный детерминированный SEO для всего каталога. Использует только факты
// товарного фида и экспертные профили категорий. Ручные и AI-поля не стирает.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JSON_PATH = path.join(ROOT, "src", "lib", "products.json");
const DB_PATH = process.env.SQLITE_PATH ?? path.join(ROOT, "data.db");
const Database = fs.existsSync(DB_PATH) ? (await import("better-sqlite3")).default : null;
const PROFILE_PATH = path.join(ROOT, "src", "lib", "category-seo.json");
const CONFLICT_PATH = path.join(ROOT, ".analysis", "seo-data-conflicts.json");
const VERSION = "programmatic:v7";
const force = process.argv.includes("--force");
const refreshExisting = process.argv.includes("--refresh-existing");
const categoryArgIndex = process.argv.indexOf("--category");
const categoryArg = process.argv.find((value) => value.startsWith("--category="))?.split("=", 2)[1]
  || (categoryArgIndex >= 0 ? process.argv[categoryArgIndex + 1] : undefined);
const catalog = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
const profiles = JSON.parse(fs.readFileSync(PROFILE_PATH, "utf8"));
const categories = new Map((catalog.categories || []).map((item) => [item.slug, item.title]));
const conflictProductIds = new Set(
  fs.existsSync(CONFLICT_PATH)
    ? (JSON.parse(fs.readFileSync(CONFLICT_PATH, "utf8")).productIds || []).map(String)
    : [],
);

const LOW_VALUE_PARAMS = new Set(["бренд", "артикул", "штрихкод", "наименование", "модель"]);
const PARAM_PRIORITY = [
  "Диаметр режущей части", "Макс. диаметр отверстия", "Макс. диаметр труб, мм",
  "Мин. диаметр труб, мм", "Диаметр диска", "Посадочное отверстие", "Макс. резьба",
  "Рабочая длина", "Макс. ширина фаски", "Макс. толщина заготовки", "Материал",
  "Материал заготовки", "Материал режущей части", "Хвостовик", "Шпиндель", "Привод",
  "Тип двигателя", "Производительность, л/мин", "Мощность, кВт", "Грузоподъемность",
  "Положения сварки", "Тип резки", "Тип насечки", "Резьба", "Шаг резьбы",
];

function compact(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
}

function cleanParamName(name) {
  const original = compact(name);
  return original.replace(/^(?:k2[\s_.:/-]*)+/i, "").trim() || original;
}

function trimAtWord(value, max) {
  const clean = compact(value);
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const boundary = cut.lastIndexOf(" ");
  return (boundary > max * 0.58 ? cut.slice(0, boundary) : cut)
    .replace(/[\s,;:–—-]+$/g, "")
    .replace(/\s+(?:с|со|из|для|и|или|по|на|в|во|под|к|от|до|при)$/i, "")
    .trim();
}

function balancedTrim(value, max) {
  const trimmed = trimAtWord(value, max);
  const opening = (trimmed.match(/\(/g) || []).length;
  const closing = (trimmed.match(/\)/g) || []).length;
  return opening > closing ? trimmed.replace(/\s*\([^)]*$/, "").trim() : trimmed;
}

function sentence(value, max = 198) {
  return `${balancedTrim(value, max - 1).replace(/[.,;:]+$/g, "")}.`;
}

function packSentences(sentences, max = 200) {
  const normalized = sentences.map((item) => sentence(item, max)).filter(Boolean);
  let result = "";
  for (const item of normalized) {
    const candidate = result ? `${result} ${item}` : item;
    if (candidate.length <= max) result = candidate;
  }
  return result;
}

function normalizedFacts(product) {
  const variants = (product.variants || []).slice(0, 24).map((variant) => ({
    sku: variant.sku || "",
    name: variant.name || "",
    params: (variant.params || []).slice(0, 20).map((param) => ({
      name: cleanParamName(param.name), value: param.value, unit: param.unit || "",
    })),
  }));
  return {
    id: product.id, title: product.title, brand: product.brand || "", sku: product.sku || "",
    category: categories.get(product.category) || product.category,
    description: compact(product.description).slice(0, 3_000), variants,
  };
}

function fingerprint(product) {
  return crypto.createHash("sha256").update(JSON.stringify(normalizedFacts(product))).digest("hex");
}

function declension(count, one, few, many) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function representativeVariant(product) {
  return (product.variants || []).find((item) => item.available && (item.quantity || 0) > 0)
    || (product.variants || []).find((item) => item.available)
    || product.variants[0];
}

function factValue(param) {
  const value = compact(param.value);
  const unit = compact(param.unit);
  if (!value) return "";
  if (unit && !value.toLocaleLowerCase("ru").endsWith(unit.toLocaleLowerCase("ru"))) return `${value} ${unit}`;
  return value;
}

function usefulFacts(product, representative) {
  const axes = new Set((product.paramAxes || []).map(cleanParamName));
  const rank = new Map(PARAM_PRIORITY.map((name, index) => [name.toLocaleLowerCase("ru"), index]));
  const seen = new Set();
  return (representative?.params || [])
    .map((param) => ({ ...param, name: cleanParamName(param.name) }))
    .filter((param) => param.name && param.value && param.value !== "✓" && !LOW_VALUE_PARAMS.has(param.name.toLocaleLowerCase("ru")))
    .filter((param) => {
      const key = `${param.name}:${param.value}:${param.unit || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(!axes.has(a.name)) - Number(!axes.has(b.name))
      || (rank.get(a.name.toLocaleLowerCase("ru")) ?? 999) - (rank.get(b.name.toLocaleLowerCase("ru")) ?? 999))
    .slice(0, 6)
    .map((param) => ({ name: param.name, value: factValue(param) }));
}

function axisDetails(product) {
  return (product.paramAxes || []).slice(0, 5).map((rawAxis) => {
    const axis = cleanParamName(rawAxis);
    const values = Array.from(new Set((product.variants || []).flatMap((variant) =>
      (variant.params || []).filter((param) => cleanParamName(param.name) === axis).map(factValue),
    ))).filter(Boolean).slice(0, 6);
    return values.length ? { name: axis, values } : null;
  }).filter(Boolean);
}

function titleIdentity(product, profile, representative) {
  const name = compact(product.title);
  const brand = product.brand && product.brand !== "—" ? compact(product.brand) : "";
  const weakName = /^артикул\b/i.test(name) || name.length < 14;
  const base = weakName ? `${profile?.primaryQuery || categories.get(product.category) || "промышленный инструмент"}${brand ? ` ${brand}` : ""}` : name;
  const sku = compact(representative?.sku || product.sku || product.id);
  const skuIndex = sku ? base.toLocaleLowerCase("ru").lastIndexOf(sku.toLocaleLowerCase("ru")) : -1;
  const compactSku = sku.length <= 30;
  const baseWithoutSku = compactSku && skuIndex > Math.floor(base.length * 0.35)
    ? base.slice(0, skuIndex).replace(/[\s,(]*(?:арт\.?\s*)?$/i, "").trim()
    : base;
  const skuSuffix = compactSku && sku ? `, арт. ${sku}` : "";
  return {
    base,
    baseWithoutSku,
    sku,
    skuSuffix,
    full: skuIndex >= 0 || !sku ? base : `${base}, арт. ${sku}`,
  };
}

function generate(product) {
  const category = categories.get(product.category) || product.category;
  const profile = profiles[product.category] || {
    primaryQuery: category.toLocaleLowerCase("ru"),
    productPurpose: `применения в разделе «${category}»`,
  };
  const representative = representativeVariant(product);
  const identity = titleIdentity(product, profile, representative);
  const facts = usefulFacts(product, representative);
  const axes = axisDetails(product);
  const count = product.variants.length;
  const countText = `${count} ${declension(count, "модификация", "модификации", "модификаций")}`;
  const brand = product.brand && product.brand !== "—" ? compact(product.brand) : "";

  const buySuffix = " — купить";
  let titleSuffix = identity.skuSuffix;
  if (titleSuffix.length > 34) titleSuffix = "";
  let titleBase = identity.baseWithoutSku;
  if (titleBase.length + titleSuffix.length < 35 && !titleBase.toLocaleLowerCase("ru").includes(profile.primaryQuery.toLocaleLowerCase("ru"))) {
    titleBase = `${titleBase} — ${profile.primaryQuery}`;
  }
  const metaTitle = `${balancedTrim(titleBase, 80 - buySuffix.length - titleSuffix.length)}${titleSuffix}${buySuffix}`;

  const shortSuffix = identity.skuSuffix.length <= 34 ? identity.skuSuffix : "";
  const identityBudget = Math.max(44, 118 - profile.productPurpose.length);
  const shortIdentity = `${balancedTrim(identity.baseWithoutSku, Math.max(18, identityBudget - shortSuffix.length))}${shortSuffix}`;
  const hasStock = (product.variants || []).some((item) => item.available && (item.quantity || 0) > 0);
  const orderable = (product.variants || []).some((item) => item.available);
  const stockText = hasStock
    ? "Цена с НДС; в наличии, отгрузка в день оплаты"
    : orderable ? "Цена с НДС; под заказ, срок подтвердит менеджер" : "Цена с НДС; доступность уточняет менеджер";
  let metaDescription = packSentences([
    `Купить ${shortIdentity} для ${profile.productPurpose}`,
    stockText,
    "Доставка по России",
  ]);
  if (metaDescription.length < 120) {
    metaDescription = packSentences([metaDescription, "Инженерный подбор по параметрам задачи"]);
  }

  const sourceExcerpt = compact(product.description).slice(0, 360);
  const axisNames = axes.map((item) => item.name.toLocaleLowerCase("ru")).join(", ");
  const axisExamples = axes.slice(0, 3).map((item) => `${item.name}: ${item.values.join(", ")}`).join("; ");
  const factExamples = facts.slice(0, 4).map((item) => `${item.name}: ${item.value}`).join("; ");
  const firstParagraph = sourceExcerpt.length >= 90
    ? `${identity.full} — ${sourceExcerpt.replace(/[.!?]+$/g, "")}. Позиция относится к разделу «${category}» и применяется для ${profile.productPurpose}.`
    : `${identity.full} — ${brand ? `продукция ${brand} ` : ""}для ${profile.productPurpose}. Товар относится к разделу «${category}»; в карточке приведены артикулы и характеристики, полученные из актуального товарного фида.`;
  const secondParagraph = axes.length
    ? `В группе доступно ${countText}. При выборе модификации сравните ${axisNames}. Значения в каталоге: ${axisExamples}. ${factExamples ? `Для представленного артикула указаны параметры: ${factExamples}.` : ""}`
    : `Для подбора конкретного артикула сравните характеристики и совместимость с используемым оборудованием. ${factExamples ? `В товарном фиде указаны параметры: ${factExamples}.` : "Точные технические данные приведены в таблице характеристик."}`;
  const thirdParagraph = hasStock
    ? "Цена указана с НДС. Позиции в наличии можно отгрузить в день оплаты со склада в Москве или Санкт-Петербурге транспортной компанией либо нашей машиной. Комплект документов: счёт-фактура с НДС, паспорт изделия и сертификат ТР ТС; при необходимости предоставляется оригинал сертификата производителя, документы отправляются по почте или ЭДО."
    : "Цена указывается с НДС. Срок поставки и доступность конкретной модификации подтверждает менеджер; доставка выполняется по России транспортной компанией либо нашей машиной. Комплект документов: счёт-фактура с НДС, паспорт изделия и сертификат ТР ТС; при необходимости предоставляется оригинал сертификата производителя, документы отправляются по почте или ЭДО.";

  return { metaTitle, metaDescription, seoText: [firstParagraph, secondParagraph, thirdParagraph].join("\n\n") };
}

function ensureColumns(database) {
  const columns = new Set(database.prepare("PRAGMA table_info(products)").all().map((row) => row.name));
  for (const [name, type] of [["meta_title", "TEXT"], ["meta_description", "TEXT"], ["seo_text", "TEXT"], ["seo_fingerprint", "TEXT"], ["seo_source", "TEXT"], ["seo_generated_at", "INTEGER"]]) {
    if (!columns.has(name)) database.exec(`ALTER TABLE products ADD COLUMN ${name} ${type}`);
  }
}

function validate(products) {
  const titleOwners = new Map();
  const descriptionOwners = new Map();
  const errors = [];
  for (const product of products) {
    if (product.draft) continue;
    const title = compact(product.metaTitle);
    const description = compact(product.metaDescription);
    const seoText = compact(product.seoText);
    if (!title || title.length < 30 || title.length > 82) errors.push(`${product.id}: title=${title.length}`);
    if (!description || description.length < 100 || description.length > 205) errors.push(`${product.id}: description=${description.length}`);
    if (!seoText || seoText.length < 320 || seoText.length > 1_800) errors.push(`${product.id}: seoText=${seoText.length}`);
    if (/\bk2[_.:/-]/i.test(`${title} ${description} ${seoText}`)) errors.push(`${product.id}: технический префикс k2`);
    const titleKey = title.toLocaleLowerCase("ru");
    const descriptionKey = description.toLocaleLowerCase("ru");
    if (titleOwners.has(titleKey)) errors.push(`${product.id}: дубль title с ${titleOwners.get(titleKey)}`);
    else titleOwners.set(titleKey, product.id);
    if (descriptionOwners.has(descriptionKey)) errors.push(`${product.id}: дубль description с ${descriptionOwners.get(descriptionKey)}`);
    else descriptionOwners.set(descriptionKey, product.id);
  }
  if (errors.length) throw new Error(`SEO-валидация не пройдена (${errors.length}):\n${errors.slice(0, 30).join("\n")}`);
}

const updates = [];
for (const product of catalog.products || []) {
  if (product.draft || !product.title || !(product.variants || []).length) continue;
  if (categoryArg && product.category !== categoryArg) continue;
  if (conflictProductIds.has(String(product.id))) {
    console.warn(`SEO guard: ${product.id} пропущен из-за SEO_DATA_CONFLICT`);
    continue;
  }
  const source = String(product.seoSource || "");
  if (product.seoSource === "manual" || source.startsWith("openai:")) continue;
  const fp = fingerprint(product);
  const missing = !product.metaTitle || !product.metaDescription || !product.seoText;
  const generated = source.startsWith("programmatic:") || source.startsWith("generated:");
  // Ночные и часовые обновления заполняют SEO только для новых товаров.
  // Перегенерация существующих полей возможна лишь явным ручным флагом.
  const stale = refreshExisting && generated && (Boolean(categoryArg) || product.seoFingerprint !== fp || source !== VERSION);
  if (!force && !missing && !stale) continue;
  const seo = generate(product);
  const now = Date.now();
  Object.assign(product, seo, { seoFingerprint: fp, seoSource: VERSION, seoGeneratedAt: now });
  updates.push({ id: product.id, fp, now, ...seo });
}

if (!updates.length) {
  console.log("SEO товаров: все поля актуальны");
  process.exit(0);
}

validate(catalog.products || []);

const temp = `${JSON_PATH}.seo-${process.pid}.tmp`;
fs.writeFileSync(temp, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
fs.renameSync(temp, JSON_PATH);

if (fs.existsSync(DB_PATH) && Database) {
  const database = new Database(DB_PATH);
  ensureColumns(database);
  const update = database.prepare("UPDATE products SET meta_title=?, meta_description=?, seo_text=?, seo_fingerprint=?, seo_source=?, seo_generated_at=? WHERE id=?");
  database.transaction(() => {
    for (const item of updates) update.run(item.metaTitle, item.metaDescription, item.seoText, item.fp, VERSION, item.now, item.id);
  })();
  database.pragma("optimize");
  database.close();
}

console.log(`SEO товаров: сохранено ${updates.length}; источник=${VERSION}; ручные и AI-поля защищены`);
