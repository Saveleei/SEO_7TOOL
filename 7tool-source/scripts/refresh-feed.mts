// Полная синхронизация дилерского фида с витриной и SQLite.
// Обновляет цены, наличие и карточки, добавляет новые товары/варианты,
// публикует позиции со статусом «Опубликовано» и атомарно пишет JSON.
// Запуск: node scripts/refresh-feed.mts [путь-к-локальному-фиду]
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const JSON_PATH = process.env.CATALOG_JSON_PATH ?? path.join(ROOT, "src", "lib", "products.json");
const DB_PATH = process.env.SQLITE_PATH ?? path.join(ROOT, "data.db");
const FEED_URL = process.env.FEED_URL?.trim();
const LOCAL_FEED = process.argv[2] ?? process.env.FEED_FILE ?? path.join(ROOT, "..", "dealer-2.xml");
const STATE_PATH = process.env.FEED_STATE_PATH ?? `${DB_PATH}.feed-state.json`;
const LOCK_PATH = process.env.FEED_LOCK_PATH ?? `${DB_PATH}.feed.lock`;
const MIN_EXPECTED_OFFERS = Number(process.env.FEED_MIN_OFFERS ?? 5_000);

const CATEGORY_BY_FEED_ID: Record<string, string> = {
  "22": "sverla-i-zenkovki",
  "23": "sverla-i-zenkovki",
  "25": "sverla-i-zenkovki",
  "26": "sverla-i-zenkovki",
  "27": "sverla-i-zenkovki",
  "35": "sozh-i-sots",
  "47": "shlifovalnoe-i-zatochnoe-oborudovanie",
  "49": "stanki-lazernoy-rezki",
  "50": "shlifovalnoe-i-zatochnoe-oborudovanie",
  "54": "stanki-sverlilnye",
  "55": "stanki-sverlilnye",
  "56": "stanki-sverlilnye",
  "57": "stanki-sverlilnye",
  "58": "stanki-sverlilnye",
  "59": "stanki-sverlilnye",
  "69": "shlifovalnoe-i-zatochnoe-oborudovanie",
  "73": "magnitnaya-osnastka",
  "78": "magnitnaya-osnastka",
  "88": "almaznoe-burenie",
  "110": "sverla-i-zenkovki",
  "112": "stanki-sverlilnye",
  "117": "shlifovalnoe-i-zatochnoe-oborudovanie",
  "119": "shlifovalnoe-i-zatochnoe-oborudovanie",
  "121": "shlifovalnoe-i-zatochnoe-oborudovanie",
  "123": "shlifovalnoe-i-zatochnoe-oborudovanie",
  "148": "kromkorezy-po-listu",
  "150": "lentochnopilnye-stanki",
  "152": "stanki-sverlilnye",
  "157": "lentochnopilnye-stanki",
  "219": "sverla-i-zenkovki",
  "220": "sverla-i-zenkovki",
  "221": "stanochnaya-osnastka",
  "422": "stanki-sverlilnye",
  "443": "shlifovalnoe-i-zatochnoe-oborudovanie",
  "482": "stanki-lazernoy-rezki",
  "483": "stanki-lazernoy-rezki",
  "484": "stanki-lazernoy-rezki",
  "525": "shlifovalnoe-i-zatochnoe-oborudovanie",
  "526": "shlifovalnoe-i-zatochnoe-oborudovanie",
  "593": "disko-otreznye-stanki",
  "598": "stanki-sverlilnye",
  "608": "almaznoe-burenie",
  "673": "svarochnye-roboty",
  "114": "koronchatye-sverla",
  "124": "truborezy",
  "126": "truborezy",
  "128": "truborezy",
  "160": "rezbonareznye-manipulyatory",
  "268": "rezbonareznye-manipulyatory",
  "178": "borfrezy",
  "183": "svarochnye-vrashchateli-i-pozitsionery",
  "217": "zahvaty-dlya-gruzov",
  "218": "zahvaty-dlya-gruzov",
  "235": "karetki-svarochnye",
  "236": "karetki-termicheskoy-rezki",
  "250": "kompressory",
  "253": "koronchatye-sverla",
  "277": "metchiki",
  "278": "metchiki",
  "312": "disko-otreznye-stanki",
  "314": "disko-otreznye-stanki",
  "315": "pilnye-diski",
  "324": "svarochnye-vrashchateli-i-pozitsionery",
  "340": "kromkorezy-dlya-trub",
  "343": "kromkorezy-po-listu",
  "354": "svarochnye-roboty",
  "366": "shlifovalnoe-i-zatochnoe-oborudovanie",
  "408": "sverla-i-zenkovki",
  "386": "magnitnaya-osnastka",
  "495": "zahvaty-dlya-gruzov",
  "523": "almaznoe-burenie",
  "543": "vibroopory",
  "658": "verstaki",
};

const ICON_BY_CATEGORY: Record<string, string> = {
  borfrezy: "cutter",
  "stanki-sverlilnye": "drill",
  "koronchatye-sverla": "drill",
  truborezy: "pipe",
  "kromkorezy-dlya-trub": "edge",
  "kromkorezy-po-listu": "edge",
  "karetki-svarochnye": "weldAuto",
  "karetki-termicheskoy-rezki": "thermal",
  "rezbonareznye-manipulyatory": "cutter",
  "pilnye-diski": "saw",
  kompressory: "pneumatic",
  metchiki: "cutter",
  "lentochnopilnye-stanki": "saw",
  "shlifovalnoe-i-zatochnoe-oborudovanie": "grinder",
  "magnitnaya-osnastka": "fixture",
  "almaznoe-burenie": "drill",
  "svarochnye-vrashchateli-i-pozitsionery": "weld",
  "zahvaty-dlya-gruzov": "lift",
  "sozh-i-sots": "fixture",
  "disko-otreznye-stanki": "saw",
  "sverla-i-zenkovki": "drill",
  "stanki-lazernoy-rezki": "thermal",
  "svarochnye-roboty": "weldAuto",
  "stanochnaya-osnastka": "fixture",
  vibroopory: "fixture",
  verstaki: "fixture",
};

type FeedCategoryDefinition = {
  slug: string;
  title: string;
  icon: string;
  subtitle: string;
  intro: string;
  ctaText: string;
  sortOrder: number;
};

// Новые направления из PIM добавляются один раз. При последующих синхронизациях
// ручные обложки, SEO и порядок категорий из админки не перезаписываются.
const FEED_CATEGORY_DEFINITIONS: FeedCategoryDefinition[] = [
  { slug: "pilnye-diski", title: "Пильные диски", icon: "saw", subtitle: "Промышленная дисковая оснастка", intro: "Пильные диски для промышленного оборудования с подбором по диаметру, посадке, материалу и типу станка.", ctaText: "Все пильные диски", sortOrder: 90 },
  { slug: "kompressory", title: "Компрессоры", icon: "pneumatic", subtitle: "Промышленное компрессорное оборудование", intro: "Компрессоры для производства, мастерских и питания пневматического инструмента.", ctaText: "Все компрессоры", sortOrder: 100 },
  { slug: "metchiki", title: "Метчики", icon: "cutter", subtitle: "Резьбонарезной инструмент", intro: "Машинные и ручные метчики, а также комбинированные метчики-сверла для обработки резьбы.", ctaText: "Все метчики", sortOrder: 110 },
  { slug: "lentochnopilnye-stanki", title: "Ленточнопильные станки", icon: "saw", subtitle: "Станки и оснастка для ленточной резки", intro: "Оборудование и принадлежности для точной производительной резки металлических заготовок.", ctaText: "Все ленточнопильные станки", sortOrder: 120 },
  { slug: "shlifovalnoe-i-zatochnoe-oborudovanie", title: "Шлифовальное и заточное оборудование", icon: "grinder", subtitle: "Станки и инструмент для шлифования и заточки", intro: "Промышленные шлифовальные и заточные станки, а также пневматические ленточные машины.", ctaText: "Смотреть оборудование", sortOrder: 130 },
  { slug: "magnitnaya-osnastka", title: "Магнитная оснастка", icon: "fixture", subtitle: "Плиты, угольники, фиксаторы и стружкосборники", intro: "Магнитная оснастка для фиксации, позиционирования и обслуживания металлических заготовок.", ctaText: "Вся магнитная оснастка", sortOrder: 140 },
  { slug: "almaznoe-burenie", title: "Алмазное бурение", icon: "drill", subtitle: "Установки и алмазные буровые коронки", intro: "Установки алмазного бурения и буровые коронки для бетона и строительных материалов.", ctaText: "Оборудование для бурения", sortOrder: 150 },
  { slug: "svarochnye-vrashchateli-i-pozitsionery", title: "Сварочные вращатели и позиционеры", icon: "weld", subtitle: "Позиционирование изделий при сварке", intro: "Оборудование для вращения и точного позиционирования изделий при механизированной сварке.", ctaText: "Смотреть оборудование", sortOrder: 170 },
  { slug: "zahvaty-dlya-gruzov", title: "Захваты для грузов", icon: "lift", subtitle: "Магнитные, вакуумные и листовые захваты", intro: "Промышленные захваты для безопасного перемещения листового металла и других грузов.", ctaText: "Все захваты", sortOrder: 180 },
  { slug: "sozh-i-sots", title: "СОЖ и СОТС", icon: "fixture", subtitle: "Средства для металлообработки", intro: "Смазочно-охлаждающие жидкости и технологические составы для обработки металлов.", ctaText: "Все СОЖ и СОТС", sortOrder: 190 },
  { slug: "disko-otreznye-stanki", title: "Дисковые отрезные станки", icon: "saw", subtitle: "Станки для точной резки металла", intro: "Промышленные дисковые станки для точной и производительной резки профиля и заготовок.", ctaText: "Все отрезные станки", sortOrder: 200 },
  { slug: "vibroopory", title: "Виброопоры", icon: "fixture", subtitle: "Виброизоляция промышленного оборудования", intro: "Виброизолирующие опоры для станков, компрессоров и другого производственного оборудования.", ctaText: "Все виброопоры", sortOrder: 210 },
  { slug: "verstaki", title: "Промышленные верстаки", icon: "fixture", subtitle: "Рабочие места для цехов и мастерских", intro: "Прочные производственные верстаки для организации рабочих мест в цехах и мастерских.", ctaText: "Все верстаки", sortOrder: 220 },
  { slug: "sverla-i-zenkovki", title: "Сверла и зенковки", icon: "drill", subtitle: "Спиральные, твердосплавные и специальные сверла", intro: "Промышленные сверла, зенковки, зенкеры и цековки для точной обработки отверстий в металле.", ctaText: "Все сверла и зенковки", sortOrder: 230 },
  { slug: "stanki-lazernoy-rezki", title: "Станки лазерной резки", icon: "thermal", subtitle: "Оборудование для резки листа и труб", intro: "Промышленные лазерные станки для раскроя листового металла, труб и комбинированной обработки.", ctaText: "Все лазерные станки", sortOrder: 240 },
  { slug: "svarochnye-roboty", title: "Сварочные роботы", icon: "weldAuto", subtitle: "Роботы и автоматизированные сварочные ячейки", intro: "Промышленные сварочные роботы и готовые роботизированные ячейки для автоматизации производства.", ctaText: "Все сварочные роботы", sortOrder: 250 },
  { slug: "stanochnaya-osnastka", title: "Станочная оснастка", icon: "fixture", subtitle: "Комплекты и устройства для металлообрабатывающих станков", intro: "Станочная оснастка, стартовые комплекты и вспомогательные устройства для производственного оборудования.", ctaText: "Вся станочная оснастка", sortOrder: 260 },
];

const OBSOLETE_CATEGORY_SLUGS = new Set(["osnastka-dlya-kromkorezov"]);

type ProductParam = { name: string; value: string; unit?: string };
type Variant = {
  id: string;
  sku: string;
  name?: string;
  barcode?: string;
  price?: number;
  oldPrice?: number;
  quantity?: number;
  available: boolean;
  params: ProductParam[];
  images?: string[];
};
type Product = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  sku: string;
  category: string;
  feedCategoryId?: string;
  icon: string;
  description?: string;
  images: string[];
  accessories: string[];
  isGroup: boolean;
  variants: Variant[];
  stock: number;
  paramAxes: string[];
  priceFrom?: number;
  priceTo?: number;
  discountPct?: number;
  draft?: boolean;
  [key: string]: unknown;
};
type Catalog = { categories: Array<Record<string, unknown>>; products: Product[]; subcategories?: unknown[] };
type FeedOffer = {
  id: string;
  group: boolean;
  groupId?: string;
  status?: string;
  name: string;
  categoryId?: string;
  sku: string;
  vendor?: string;
  description?: string;
  barcode?: string;
  price?: number;
  oldPrice?: number;
  quantity?: number;
  available: boolean;
  params: ProductParam[];
  pictures: string[];
  accessories: string[];
};

function ensureFeedCategories(catalog: Catalog) {
  catalog.categories = catalog.categories.filter((category) => !OBSOLETE_CATEGORY_SLUGS.has(String(category.slug ?? "")));
  const existing = new Set(catalog.categories.map((category) => String(category.slug ?? "")));
  for (const definition of FEED_CATEGORY_DEFINITIONS) {
    if (existing.has(definition.slug)) continue;
    catalog.categories.push({
      slug: definition.slug,
      title: definition.title,
      icon: definition.icon,
      count: 0,
      subtitle: definition.subtitle,
      ctaText: definition.ctaText,
      h1: definition.title,
      intro: definition.intro,
      seoText: `${definition.intro}\n\nПоможем сопоставить характеристики оборудования и оснастки с вашей производственной задачей.`,
      metaTitle: `${definition.title} купить — промышленное оборудование | 7TOOL`,
      metaDescription: `${definition.intro} Инженерный подбор, актуальные цены, наличие и доставка по России.`,
      published: true,
      sortOrder: definition.sortOrder,
    });
    existing.add(definition.slug);
  }
  // Порядок существующих категорий принадлежит админке. Фид может назначить
  // sortOrder только новой категории, но никогда не переставляет уже созданные.
  let nextSortOrder = catalog.categories.reduce((max, category) => (
    typeof category.sortOrder === "number" ? Math.max(max, category.sortOrder) : max
  ), -1) + 1;
  for (const category of catalog.categories) {
    if (typeof category.sortOrder !== "number") category.sortOrder = nextSortOrder++;
  }
  const unknownSlugs = Array.from(new Set(Object.values(CATEGORY_BY_FEED_ID))).filter((slug) => !existing.has(slug));
  if (unknownSlugs.length) throw new Error(`Для категорий фида отсутствуют разделы каталога: ${unknownSlugs.join(", ")}`);
}

async function loadFeed(): Promise<string> {
  if (process.argv[2] && fs.existsSync(LOCAL_FEED)) {
    console.log("feed: локальный файл", LOCAL_FEED);
    return fs.readFileSync(LOCAL_FEED, "utf8");
  }
  if (!FEED_URL) {
    if (fs.existsSync(LOCAL_FEED)) {
      console.log("feed: локальный файл", LOCAL_FEED);
      return fs.readFileSync(LOCAL_FEED, "utf8");
    }
    throw new Error("FEED_URL is required when no FEED_FILE/local feed is available");
  }
  try {
    const res = await fetch(FEED_URL, { signal: AbortSignal.timeout(90_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log("feed: загружен с", FEED_URL);
    return await res.text();
  } catch (error) {
    if (!fs.existsSync(LOCAL_FEED)) throw error;
    console.warn("feed: сеть недоступна, используем последний локальный файл", LOCAL_FEED);
    return fs.readFileSync(LOCAL_FEED, "utf8");
  }
}

function decodeXml(value = ""): string {
  let out = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  for (let i = 0; i < 2; i++) {
    out = out
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }
  return out.trim();
}

function attrs(value: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of value.matchAll(/([\w:-]+)="([^"]*)"/g)) result[match[1]] = decodeXml(match[2]);
  return result;
}

function tag(body: string, name: string): string | undefined {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i").exec(body);
  return match ? decodeXml(match[1]) : undefined;
}

function integer(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

function cleanParamName(name: string): string {
  const original = (name ?? "").trim();
  const cleaned = original.replace(/^(?:k2[\s_.:/-]*)+/i, "").trim();
  return cleaned || original;
}

function parseFeed(xml: string): FeedOffer[] {
  const offers: FeedOffer[] = [];
  for (const match of xml.matchAll(/<offer\s+([^>]*?)>([\s\S]*?)<\/offer>/g)) {
    const attr = attrs(match[1]);
    const body = match[2];
    if (!attr.id) continue;
    const params: ProductParam[] = [];
    for (const paramMatch of body.matchAll(/<param\s+([^>]*?)>([\s\S]*?)<\/param>/g)) {
      const paramAttr = attrs(paramMatch[1]);
      const value = decodeXml(paramMatch[2]);
      if (!paramAttr.name || !value) continue;
      params.push({ name: cleanParamName(paramAttr.name), value, ...(paramAttr.unit ? { unit: paramAttr.unit } : {}) });
    }
    const pictures: string[] = [];
    for (const pictureMatch of body.matchAll(/<picture(?:\s[^>]*)?>([\s\S]*?)<\/picture>/g)) {
      // Не переписываем домен: фид отдаёт рабочий CDN с валидным TLS.
      // Подменявшийся ранее pim.k2.tools имеет просроченный сертификат, из-за
      // чего браузер корректно блокировал все изображения.
      const src = decodeXml(pictureMatch[1]);
      if (src.startsWith("http") && !pictures.includes(src)) pictures.push(src);
      if (pictures.length >= 6) break;
    }
    const accessories = Array.from(body.matchAll(/<accessory(?:\s[^>]*)?>([\s\S]*?)<\/accessory>/g))
      .map((item) => decodeXml(item[1]))
      .filter(Boolean);
    offers.push({
      id: attr.id,
      group: attr.group === "true",
      groupId: tag(body, "groupId"),
      status: tag(body, "status"),
      name: tag(body, "name") ?? "",
      categoryId: tag(body, "categoryId"),
      sku: tag(body, "vendorCode") ?? "",
      vendor: tag(body, "vendor"),
      description: tag(body, "description"),
      barcode: tag(body, "barcode"),
      price: integer(tag(body, "price")),
      oldPrice: integer(tag(body, "oldprice")),
      quantity: integer(tag(body, "quantity")),
      available: attr.available !== "false",
      params,
      pictures,
      accessories,
    });
  }
  return offers;
}

function published(offer: FeedOffer): boolean {
  const status = (offer.status ?? "").trim().toLowerCase();
  return !status || status === "опубликовано" || status === "published" || status === "active";
}

function cleanDescription(value?: string): string | undefined {
  if (!value) return undefined;
  const clean = decodeXml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<img[^>]*>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6]|section|article)\s*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!clean) return undefined;
  return clean.length <= 2_500 ? clean : `${clean.slice(0, 2_480).trimEnd()}…`;
}

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slugify(value: string): string {
  const transliterated = value.toLowerCase().split("").map((char) => TRANSLIT[char] ?? char).join("");
  const slug = transliterated.replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (slug.length <= 90) return slug || "product";
  return (slug.slice(0, 90).replace(/-[^-]*$/, "") || slug.slice(0, 90)).replace(/-$/, "");
}

function uniqueSlug(title: string, sku: string, used: Set<string>): string {
  const base = slugify(title);
  let candidate = base;
  if (used.has(candidate) && sku) candidate = slugify(`${title} ${sku}`);
  let index = 2;
  while (used.has(candidate)) candidate = `${base}-${index++}`;
  used.add(candidate);
  return candidate;
}

function detectBrand(offer: FeedOffer, children: FeedOffer[]): string {
  const vendor = offer.vendor || children.find((item) => item.vendor)?.vendor;
  if (vendor) return vendor;
  const known = ["Karnasch", "HEDEN", "HGTECH", "HUAWEI", "FEIN", "PROMOTECH", "TRUMPF", "NEOTOOL", "LENZ", "EUROBOOR", "BDS", "AGP", "Ravic"];
  return known.find((brand) => new RegExp(`\\b${brand}\\b`, "i").test(offer.name)) ?? "—";
}

function variantFrom(offer: FeedOffer): Variant {
  return {
    id: offer.id,
    sku: offer.sku,
    ...(offer.name ? { name: offer.name } : {}),
    ...(offer.barcode ? { barcode: offer.barcode } : {}),
    ...(offer.price != null ? { price: offer.price } : {}),
    ...(offer.oldPrice != null ? { oldPrice: offer.oldPrice } : {}),
    quantity: offer.quantity ?? 0,
    available: offer.available,
    params: offer.params,
    ...(offer.pictures.length ? { images: offer.pictures } : {}),
  };
}

function syncVariant(target: Variant, source: FeedOffer) {
  target.sku = source.sku || target.sku;
  if (source.name) target.name = source.name;
  if (source.barcode) target.barcode = source.barcode;
  if (source.price != null) target.price = source.price;
  else delete target.price;
  if (source.oldPrice != null) target.oldPrice = source.oldPrice;
  else delete target.oldPrice;
  target.quantity = source.quantity ?? 0;
  target.available = source.available;
  if (source.params.length) target.params = source.params;
  if (source.pictures.length) target.images = source.pictures;
  else delete target.images;
}

function deriveParamAxes(variants: Variant[]): string[] {
  const values = new Map<string, Set<string>>();
  const repeatedWithinVariant = new Set<string>();
  for (const variant of variants) {
    const local = new Map<string, number>();
    for (const param of variant.params) {
      if (!values.has(param.name)) values.set(param.name, new Set());
      values.get(param.name)!.add(param.value);
      local.set(param.name, (local.get(param.name) ?? 0) + 1);
    }
    for (const [name, count] of local) if (count > 1) repeatedWithinVariant.add(name);
  }
  const firstOrder = variants[0]?.params.map((param) => param.name) ?? [];
  return Array.from(values)
    .filter(([name, items]) => items.size > 1 && !repeatedWithinVariant.has(name))
    .map(([name]) => name)
    .sort((a, b) => (firstOrder.indexOf(a) < 0 ? 999 : firstOrder.indexOf(a)) - (firstOrder.indexOf(b) < 0 ? 999 : firstOrder.indexOf(b)));
}

function recompute(product: Product) {
  const inStockPrices = product.variants
    .filter((variant) => variant.available && (variant.quantity ?? 0) > 0 && (variant.price ?? 0) > 0)
    .map((variant) => variant.price as number);
  const orderablePrices = product.variants
    .filter((variant) => variant.available && (variant.price ?? 0) > 0)
    .map((variant) => variant.price as number);
  const prices = inStockPrices.length ? inStockPrices : orderablePrices;
  product.stock = product.variants.reduce(
    (sum, variant) => sum + (variant.available ? Math.max(0, variant.quantity ?? 0) : 0),
    0,
  );
  if (prices.length) {
    product.priceFrom = Math.min(...prices);
    product.priceTo = Math.max(...prices);
  } else {
    delete product.priceFrom;
    delete product.priceTo;
  }
  let discount = 0;
  for (const variant of product.variants) {
    if (variant.oldPrice != null && variant.price != null && variant.oldPrice > variant.price) {
      discount = Math.max(discount, Math.round(((variant.oldPrice - variant.price) / variant.oldPrice) * 100));
    }
  }
  if (discount > 0) product.discountPct = discount;
  else delete product.discountPct;
}

function acquireLock(): number {
  try {
    return fs.openSync(LOCK_PATH, "wx");
  } catch (error) {
    const stat = fs.statSync(LOCK_PATH, { throwIfNoEntry: false });
    if (stat && Date.now() - stat.mtimeMs > 2 * 60 * 60 * 1_000) {
      fs.rmSync(LOCK_PATH);
      return fs.openSync(LOCK_PATH, "wx");
    }
    throw new Error(`Синхронизация уже выполняется: ${LOCK_PATH}`, { cause: error });
  }
}

function upsertDatabase(catalog: Catalog) {
  const d = new Database(DB_PATH);
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");
  const productsTable = d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").get();
  if (!productsTable) {
    d.close();
    throw new Error(`В ${DB_PATH} отсутствует схема каталога; сначала выполните npm run db:import`);
  }
  const insertCategory = d.prepare(`
    INSERT INTO categories (
      slug, title, icon, sort_order, subtitle, cta_text, cover_image,
      meta_title, meta_description, image_alt, h1, intro, seo_text, published
    ) VALUES (
      @slug, @title, @icon, @sort_order, @subtitle, @cta_text, @cover_image,
      @meta_title, @meta_description, @image_alt, @h1, @intro, @seo_text, @published
    )
    -- Название, SEO, обложка, публикация и порядок существующей категории
    -- принадлежат админке и не могут перезаписываться синхронизацией фида.
    ON CONFLICT(slug) DO NOTHING
  `);
  const deleteCategory = d.prepare("DELETE FROM categories WHERE slug = ?");
  const upsertProduct = d.prepare(`
    INSERT INTO products (
      id, slug, title, brand, sku, category, icon, description, images, accessories,
      is_group, stock, param_axes, price_from, price_to, discount_pct, draft, sort_order, updated_at
      , feed_category_id
    ) VALUES (
      @id, @slug, @title, @brand, @sku, @category, @icon, @description, @images, @accessories,
      @is_group, @stock, @param_axes, @price_from, @price_to, @discount_pct, @draft, @sort_order, @updated_at
      , @feed_category_id
    )
    ON CONFLICT(id) DO UPDATE SET
      slug=excluded.slug, title=excluded.title, brand=excluded.brand, sku=excluded.sku,
      category=excluded.category, icon=excluded.icon, description=excluded.description,
      images=excluded.images, accessories=excluded.accessories, is_group=excluded.is_group,
      stock=excluded.stock, param_axes=excluded.param_axes, price_from=excluded.price_from,
      price_to=excluded.price_to, discount_pct=excluded.discount_pct, draft=excluded.draft,
      sort_order=excluded.sort_order, updated_at=excluded.updated_at
      , feed_category_id=excluded.feed_category_id
  `);
  const upsertVariant = d.prepare(`
    INSERT INTO variants (
      id, product_id, sku, name, barcode, price, old_price, quantity, available, params, images, sort_order
    ) VALUES (
      @id, @product_id, @sku, @name, @barcode, @price, @old_price, @quantity, @available, @params, @images, @sort_order
    )
    ON CONFLICT(id) DO UPDATE SET
      product_id=excluded.product_id, sku=excluded.sku, name=excluded.name,
      barcode=excluded.barcode, price=excluded.price, old_price=excluded.old_price,
      quantity=excluded.quantity, available=excluded.available, params=excluded.params,
      images=excluded.images, sort_order=excluded.sort_order
  `);
  const now = Date.now();
  const tx = d.transaction(() => {
    for (const slug of OBSOLETE_CATEGORY_SLUGS) deleteCategory.run(slug);
    catalog.categories.forEach((category, categoryIndex) => insertCategory.run({
      slug: String(category.slug ?? ""),
      title: String(category.title ?? category.slug ?? ""),
      icon: category.icon == null ? null : String(category.icon),
      sort_order: typeof category.sortOrder === "number" ? category.sortOrder : categoryIndex,
      subtitle: category.subtitle == null ? null : String(category.subtitle),
      cta_text: category.ctaText == null ? null : String(category.ctaText),
      cover_image: category.coverImage == null ? null : String(category.coverImage),
      meta_title: category.metaTitle == null ? null : String(category.metaTitle),
      meta_description: category.metaDescription == null ? null : String(category.metaDescription),
      image_alt: category.imageAlt == null ? null : String(category.imageAlt),
      h1: category.h1 == null ? null : String(category.h1),
      intro: category.intro == null ? null : String(category.intro),
      seo_text: category.seoText == null ? null : String(category.seoText),
      published: category.published === false ? 0 : 1,
    }));
    catalog.products.forEach((product, productIndex) => {
      upsertProduct.run({
        id: product.id,
        slug: product.slug,
        title: product.title,
        brand: product.brand ?? null,
        sku: product.sku ?? null,
        category: product.category,
        icon: product.icon,
        description: product.description ?? null,
        images: JSON.stringify(product.images ?? []),
        accessories: JSON.stringify(product.accessories ?? []),
        is_group: product.isGroup ? 1 : 0,
        stock: product.stock ?? 0,
        param_axes: JSON.stringify(product.paramAxes ?? []),
        price_from: product.priceFrom ?? null,
        price_to: product.priceTo ?? null,
        discount_pct: product.discountPct ?? null,
        draft: product.draft ? 1 : 0,
        sort_order: productIndex,
        updated_at: now,
        feed_category_id: product.feedCategoryId ?? null,
      });
      product.variants.forEach((variant, variantIndex) => upsertVariant.run({
        id: variant.id,
        product_id: product.id,
        sku: variant.sku ?? null,
        name: variant.name ?? null,
        barcode: variant.barcode ?? null,
        price: variant.price ?? null,
        old_price: variant.oldPrice ?? null,
        quantity: variant.quantity ?? 0,
        available: variant.available ? 1 : 0,
        params: JSON.stringify(variant.params ?? []),
        images: variant.images?.length ? JSON.stringify(variant.images) : null,
        sort_order: variantIndex,
      }));
    });
  });
  tx();
  d.pragma("optimize");
  d.close();
}

async function main() {
  const lock = acquireLock();
  try {
    const offers = parseFeed(await loadFeed());
    const ids = new Set(offers.map((offer) => offer.id));
    if (offers.length < MIN_EXPECTED_OFFERS || ids.size !== offers.length) {
      throw new Error(`Фид не прошёл sanity-check: offers=${offers.length}, unique=${ids.size}`);
    }
    const publishedOffers = offers.filter(published);
    const unmappedCategoryIds = Array.from(new Set(
      publishedOffers
        .map((offer) => offer.categoryId)
        .filter((categoryId): categoryId is string => Boolean(categoryId && !CATEGORY_BY_FEED_ID[categoryId])),
    ));
    if (unmappedCategoryIds.length) {
      throw new Error(`В фиде появились несопоставленные категории: ${unmappedCategoryIds.join(", ")}`);
    }
    const offerById = new Map(publishedOffers.map((offer) => [offer.id, offer]));
    const childrenByGroup = new Map<string, FeedOffer[]>();
    for (const offer of publishedOffers) {
      if (!offer.groupId) continue;
      const children = childrenByGroup.get(offer.groupId) ?? [];
      children.push(offer);
      childrenByGroup.set(offer.groupId, children);
    }

    const catalog = JSON.parse(fs.readFileSync(JSON_PATH, "utf8")) as Catalog;
    ensureFeedCategories(catalog);
    const productById = new Map(catalog.products.map((product) => [product.id, product]));
    const usedSlugs = new Set(catalog.products.map((product) => product.slug));
    let addedProducts = 0;
    let addedVariants = 0;
    let publishedProducts = 0;
    let updatedVariants = 0;
    const supportedProductOffers = publishedOffers.filter((offer) => offer.group || !offer.groupId);

    for (const offer of supportedProductOffers) {
      const children = offer.group ? (childrenByGroup.get(offer.id) ?? []) : [];
      const categoryId = offer.categoryId ?? children.find((child) => child.categoryId)?.categoryId;
      const category = categoryId ? CATEGORY_BY_FEED_ID[categoryId] : undefined;
      if (!category) continue;
      const feedVariants = offer.group && children.length ? children : [offer];
      let product = productById.get(offer.id);
      if (!product) {
        const variants = feedVariants.map(variantFrom);
        const pictures = offer.pictures.length
          ? offer.pictures
          : (children.find((child) => child.pictures.length)?.pictures ?? []);
        product = {
          id: offer.id,
          slug: uniqueSlug(offer.name, offer.sku, usedSlugs),
          title: offer.name,
          brand: detectBrand(offer, children),
          sku: offer.sku,
          category,
          feedCategoryId: categoryId,
          icon: ICON_BY_CATEGORY[category] ?? "fixture",
          description: cleanDescription(offer.description),
          images: pictures,
          accessories: offer.accessories,
          isGroup: offer.group,
          variants,
          stock: 0,
          paramAxes: deriveParamAxes(variants),
        };
        catalog.products.push(product);
        productById.set(product.id, product);
        addedProducts++;
        addedVariants += variants.length;
      } else {
        if (product.draft) publishedProducts++;
        delete product.draft;
        // Категория также принадлежит фиду. Это позволяет безопасно переносить
        // направления без смены URL самих товарных карточек.
        product.category = category;
        product.feedCategoryId = categoryId;
        product.icon = ICON_BY_CATEGORY[category] ?? "fixture";
        // Фотографии принадлежат фиду так же, как цены и остатки. Ранее здесь
        // сохранялись старые локальные /img-ссылки, даже если файлов уже не
        // было в релизе, из-за чего витрина показывала чертёж-заглушку.
        const feedPictures = offer.pictures.length
          ? offer.pictures
          : (children.find((child) => child.pictures.length)?.pictures ?? []);
        product.images = feedPictures;
        if (!product.description) product.description = cleanDescription(offer.description);
        if (!product.brand || product.brand === "—") product.brand = detectBrand(offer, children);
        const variantById = new Map(product.variants.map((variant) => [variant.id, variant]));
        for (const feedVariant of feedVariants) {
          const variant = variantById.get(feedVariant.id);
          if (variant) {
            syncVariant(variant, feedVariant);
            updatedVariants++;
          } else {
            product.variants.push(variantFrom(feedVariant));
            addedVariants++;
          }
        }
        product.paramAxes = deriveParamAxes(product.variants);
      }
      recompute(product);
    }

    // Позиции, исчезнувшие из текущего фида, остаются в каталоге и SEO-индексе,
    // но не могут ошибочно отображаться как доступные к заказу.
    let retiredVariants = 0;
    for (const product of catalog.products) {
      // Локальные /img-файлы были частью старой сборки и в текущем релизе
      // отсутствуют. Они не являются данными фида и не должны маскировать его
      // актуальное состояние пустой/доступной фотографии.
      product.images = (product.images ?? []).filter((src) => !src.startsWith("/img/"));
      for (const variant of product.variants) {
        variant.params = (variant.params ?? []).map((param) => ({
          ...param,
          name: cleanParamName(param.name),
        }));
        if (variant.images) {
          variant.images = variant.images.filter((src) => !src.startsWith("/img/"));
          if (!variant.images.length) delete variant.images;
        }
      }
      for (const variant of product.variants) {
        const source = offerById.get(variant.id);
        if (source && !source.group) continue;
        variant.quantity = 0;
        variant.available = false;
        retiredVariants++;
      }
      product.paramAxes = deriveParamAxes(product.variants);
      recompute(product);
    }

    const represented = new Set<string>();
    for (const product of catalog.products) {
      if (product.draft) continue;
      represented.add(product.id);
      for (const variant of product.variants) represented.add(variant.id);
    }
    const unsupported = publishedOffers.filter((offer) => !offer.groupId && offer.categoryId && !CATEGORY_BY_FEED_ID[offer.categoryId]);
    const missing = publishedOffers.filter((offer) => !represented.has(offer.id));
    if (missing.length) {
      throw new Error(`После синхронизации не опубликованы ${missing.length} offer: ${missing.slice(0, 25).map((offer) => offer.id).join(", ")}`);
    }

    const liveCounts = new Map<string, number>();
    for (const product of catalog.products) {
      if (!product.draft) liveCounts.set(product.category, (liveCounts.get(product.category) ?? 0) + 1);
    }
    for (const category of catalog.categories) {
      const slug = String(category.slug ?? "");
      category.count = liveCounts.get(slug) ?? 0;
    }

    upsertDatabase(catalog);
    const tmpPath = `${JSON_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(catalog), "utf8");
    fs.renameSync(tmpPath, JSON_PATH);

    const state = {
      ok: true,
      completedAt: new Date().toISOString(),
      feedOffers: offers.length,
      publishedFeedOffers: publishedOffers.length,
      representedFeedOffers: publishedOffers.length - missing.length,
      catalogProducts: catalog.products.length,
      liveProducts: catalog.products.filter((product) => !product.draft).length,
      variants: catalog.products.reduce((sum, product) => sum + product.variants.length, 0),
      addedProducts,
      addedVariants,
      newlyPublishedProducts: publishedProducts,
      updatedVariants,
      retiredVariants,
      unsupportedCategories: unsupported.length,
      structureChanged: addedProducts > 0 || addedVariants > 0 || publishedProducts > 0,
    };
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
    console.log(JSON.stringify(state, null, 2));
  } finally {
    fs.closeSync(lock);
    fs.rmSync(LOCK_PATH, { force: true });
  }
}

main().catch((error) => {
  console.error("ОШИБКА СИНХРОНИЗАЦИИ ФИДА:", error);
  process.exit(1);
});
