import { findSupplierContactLeaks, sanitizeStalexDescription } from "./stalex-feed-preview.mjs";

const PILOT_CATEGORIES = new Map([
  ["stanki-sverlilnye", { icon: "drill", order: 0, titlePattern: /(?:^|\s)станок(?:\s|$)/u }],
  ["lentochnopilnye-stanki", { icon: "saw", order: 1, titlePattern: /станок\s+ленточнопильный/u }],
  ["disko-otreznye-stanki", { icon: "saw", order: 2, titlePattern: /станок\s+.*отрезн/u }],
]);

const CONTROL_PROPERTY_CODES = new Set([
  "ACTIVE_DATE",
  "AVAILABILITY",
  "BRAND",
  "CML2_CODE",
  "CML2_PREVIEW_PICTURE",
  "CML2_SORT",
  "MAX_PRICE",
  "MIN_PRICE",
  "MORE_PHOTO",
  "PRICE",
  "PRICE_EUR",
  "PRICE_RUB",
  "PRICE_USD",
  "RELATE",
  "SECTIONS",
  "SECTION_SORT",
  "SORT_DISCOUNT",
]);

const CONTROL_PROPERTY_NAMES = new Set([
  "Активировать после импорта",
  "Блоки статьи",
  "Блоки статьи для слайдера",
  "Бренд",
  "Видео новое",
  "Вторая часть имени",
  "Заголовок к видео",
  "Картинка анонса",
  "Картинка к новому видео",
  "Картинка к видео",
  "Каноническая ссылка",
  "Код товара",
  "Максимальная цена(сорт.)",
  "Минимальная цена(сорт.)",
  "Наличие",
  "Новинка",
  "Номер по номенклатуре",
  "Описание к видео",
  "Распродажа",
  "Скидка(для сортировки)",
  "Символьный код",
  "Сопутствующие товары",
  "Сортировка",
  "Сортировка раздела",
  "Старая цена",
  "Стоимость",
  "Тип станка",
  "Товар не идет в выгрузку",
  "Фотогалерея",
  "Цена в Долларах",
  "Цена в Евро",
  "Цена в рублях",
  "Цена по запросу",
]);

const UNIT_SUFFIX = /^(.*?),\s*(мм\/об|об\/мин|м\/мин|кВт|Вт|мм|кг|В|°)$/iu;
const LOGISTICS_PROPERTIES = new Map([
  ["доставка (вес)", { name:"Транспортный вес", unit:"кг" }],
  ["доставка (высота)", { name:"Транспортная высота", unit:"мм" }],
  ["доставка (длина)", { name:"Транспортная длина", unit:"мм" }],
  ["доставка (ширина)", { name:"Транспортная ширина", unit:"мм" }],
  ["доставка (шрина)", { name:"Транспортная ширина", unit:"мм" }],
]);
const TRANSLIT = {
  а:"a", б:"b", в:"v", г:"g", д:"d", е:"e", ё:"e", ж:"zh", з:"z", и:"i", й:"y",
  к:"k", л:"l", м:"m", н:"n", о:"o", п:"p", р:"r", с:"s", т:"t", у:"u", ф:"f",
  х:"h", ц:"ts", ч:"ch", ш:"sh", щ:"sch", ъ:"", ы:"y", ь:"", э:"e", ю:"yu", я:"ya",
};

function cleanText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, "\"")
    .replace(/&#39;/giu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeIdentity(value) {
  return cleanText(value)
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/gu, "е")
    .replace(/[^a-zа-я0-9]+/giu, " ")
    .trim();
}

function slugify(value) {
  return cleanText(value).toLocaleLowerCase("ru-RU").split("")
    .map((character) => TRANSLIT[character] ?? character)
    .join("")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "") || "stalex-product";
}

function normalizeTitle(value) {
  return cleanText(value).replace(/\bSTALEX\b/gu, "Stalex");
}

function inferBrand(title) {
  if (/\bpilous\b/iu.test(title)) return "Pilous";
  return "Stalex";
}

function absoluteStalexImage(value) {
  const source = cleanText(value);
  if (!source) return null;
  if (/^https:\/\/stalex\.ru\//iu.test(source)) return encodeURI(source);
  if (/^https?:\/\//iu.test(source)) return null;
  return encodeURI(`https://stalex.ru/upload/${source.replace(/^\/+|^upload\//u, "")}`);
}

function trimText(value, maxLength) {
  const source = cleanText(value);
  if (source.length <= maxLength) return source;
  return `${source.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function normalizeOwnerWarrantyText(value) {
  return cleanText(value).replace(
    /гарантия(?:\s+производителя)?\s*(?:[-—:]\s*)?\d+\s*(?:месяц(?:а|ев)?|мес\.?|год(?:а|ов)?)/giu,
    "Гарантия — 12 месяцев",
  );
}

function descriptionParameter(parameter) {
  return `${parameter.name} — ${parameter.value}${parameter.unit ? ` ${parameter.unit}` : ""}`;
}

function buildDescription(title, sourceDescription, parameters) {
  const source = normalizeOwnerWarrantyText(sanitizeStalexDescription(sourceDescription));
  if (source.length <= 620) {
    const warranty = /гаранти/iu.test(source) ? "" : " Гарантия — 12 месяцев.";
    return trimText(`${source}${warranty}`.trim(), 3200);
  }
  const keyParameters = parameters
    .filter((parameter) => !/^(бренд|гарантия|транспортн)/iu.test(parameter.name))
    .slice(0, 6)
    .map(descriptionParameter);
  const facts = keyParameters.length > 0 ? ` Подтверждённые характеристики по фиду: ${keyParameters.join("; ")}.` : "";
  return trimText(`${title}.${facts} Полный перечень параметров приведён ниже. Комплектацию и дату отгрузки подтвердит менеджер 7TOOL. Гарантия — 12 месяцев.`, 1200);
}

function normalizeProperty(property) {
  const code = cleanText(property?.code).toUpperCase();
  const name = cleanText(property?.name);
  const value = cleanText(property?.value);
  if (!name || !value || CONTROL_PROPERTY_CODES.has(code) || CONTROL_PROPERTY_NAMES.has(name) || /^a:\d+:\{/u.test(value)) return null;
  const logistics = LOGISTICS_PROPERTIES.get(name.toLocaleLowerCase("ru-RU"));
  if (logistics) return { name:logistics.name, value, unit:logistics.unit };
  const unitMatch = name.match(UNIT_SUFFIX);
  return {
    name: unitMatch ? unitMatch[1].trim() : name,
    value,
    ...(unitMatch ? { unit: unitMatch[2] } : {}),
  };
}

function buildParameters(record, brand) {
  const parameters = [
    { name: "Бренд", value: brand },
    { name: "Гарантия", value: "12 месяцев" },
  ];
  const seen = new Set(parameters.map((parameter) => `${normalizeIdentity(parameter.name)}|${normalizeIdentity(parameter.value)}`));
  const source = [
    ...(record.sourceData?.catalogProperties ?? []),
    ...(record.sourceData?.modificationProperties ?? []),
  ];
  for (const property of source) {
    const parameter = normalizeProperty(property);
    if (!parameter) continue;
    const key = `${normalizeIdentity(parameter.name)}|${normalizeIdentity(parameter.value)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parameters.push(parameter);
    if (parameters.length >= 42) break;
  }
  return parameters;
}

function existingIdentity(catalog) {
  const skus = new Set();
  const titles = new Set();
  const ids = new Set();
  const slugs = new Set();
  for (const product of catalog.products ?? []) {
    if (product?.id) ids.add(String(product.id));
    if (product?.slug) slugs.add(String(product.slug));
    const title = normalizeIdentity(product?.title);
    if (title) titles.add(title);
    for (const variant of product?.variants ?? []) {
      const sku = normalizeIdentity(variant?.sku);
      if (sku) skus.add(sku);
    }
  }
  return { ids, skus, slugs, titles };
}

function candidateReason(record, identity) {
  if (!record?.dataPilotReady || !record?.active) return "not-pilot-ready";
  const category = record.category?.chosen;
  const rule = PILOT_CATEGORIES.get(category?.targetSlug);
  if (category?.decision !== "existing-category" || !rule) return "category-not-approved";
  const title = normalizeTitle(record.name);
  if (!rule.titlePattern.test(normalizeIdentity(title))) return "not-equipment";
  if (!cleanText(record.sku) || !(Number(record.priceRub) > 0)) return "missing-commercial-data";
  if (!(record.sourceData?.images ?? []).some(absoluteStalexImage)) return "missing-image";
  if (record.warranty !== "12 месяцев") return "warranty-not-confirmed";
  if (identity.skus.has(normalizeIdentity(record.sku))) return "duplicate-sku";
  if (identity.titles.has(normalizeIdentity(title))) return "duplicate-title";
  return null;
}

function uniqueSlug(title, sku, used) {
  const base = slugify(title);
  let candidate = base;
  if (used.has(candidate)) candidate = slugify(`${title} ${sku}`);
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function buildProduct(record, identity, publicationScope) {
  const title = normalizeTitle(record.name);
  const brand = inferBrand(title);
  const category = record.category.chosen.targetSlug;
  const rule = PILOT_CATEGORIES.get(category);
  const images = Array.from(new Set((record.sourceData?.images ?? []).map(absoluteStalexImage).filter(Boolean)));
  const price = Math.round(Number(record.priceRub));
  const oldPrice = Number(record.oldPriceRub) > price ? Math.round(Number(record.oldPriceRub)) : undefined;
  const quantity = Math.max(0, Math.floor(Number(record.availability?.quantity) || 0));
  const available = quantity > 0;
  const productId = `STALEX-${record.id}`;
  const variantId = `STALEX-V-${record.id}`;
  const slug = uniqueSlug(title, record.sku, identity.slugs);
  identity.ids.add(productId);
  identity.skus.add(normalizeIdentity(record.sku));
  identity.titles.add(normalizeIdentity(title));
  const params = buildParameters(record, brand);
  const description = buildDescription(title, record.sourceData?.description ?? record.descriptionPreview ?? "", params);
  return {
    id: productId,
    slug,
    title,
    brand,
    sku: cleanText(record.sku),
    category,
    icon: rule.icon,
    images,
    accessories: [],
    isGroup: false,
    variants: [{
      id: variantId,
      sku: cleanText(record.sku),
      name: title,
      price,
      ...(oldPrice ? { oldPrice } : {}),
      quantity,
      available,
      params,
      images,
    }],
    stock: quantity,
    paramAxes: [],
    priceFrom: price,
    priceTo: price,
    ...(oldPrice ? { discountPct: Math.max(1, Math.round((1 - price / oldPrice) * 100)) } : {}),
    description,
    metaTitle: trimText(`${title} — купить с НДС в 7TOOL`, 78),
    metaDescription: trimText(`${title}. Цена с НДС, характеристики и доставка по России. Наличие и срок поставки подтвердит менеджер 7TOOL.`, 170),
    seoText: description,
    seoSource: "stalex-owner-approved-feed",
    seoGeneratedAt: record.refreshedAt,
    manualSortOrder: 999,
    feedCategoryId: `stalex:${record.category.chosen.id}`,
    sourceSupplier: "stalex",
    sourceRecordId: record.id,
    publicationScope,
  };
}

function incrementCategoryCounts(categories, products) {
  const added = new Map();
  for (const product of products) added.set(product.category, (added.get(product.category) ?? 0) + 1);
  return categories.map((category) => ({
    ...category,
    count: Number(category.count ?? 0) + (added.get(category.slug) ?? 0),
  }));
}

export function buildStalexCatalog({ baseCatalog, stalexSnapshot, limit = 24, publicationScope = "test-only" }) {
  if (!["test-only", "production"].includes(publicationScope)) {
    throw new Error(`Неподдерживаемая область публикации Stalex: ${publicationScope}`);
  }
  if (!baseCatalog || !Array.isArray(baseCatalog.products) || !Array.isArray(baseCatalog.categories)) {
    throw new Error("Базовый каталог имеет неподдерживаемую структуру.");
  }
  if (stalexSnapshot?.status !== "validated" || stalexSnapshot?.publicationEnabled !== false) {
    throw new Error("Stalex snapshot не прошёл безопасную валидацию.");
  }
  if (stalexSnapshot.summary?.storefrontPublishable !== 0) {
    throw new Error("Stalex snapshot неожиданно разрешает публикацию.");
  }
  const identity = existingIdentity(baseCatalog);
  const skipped = {};
  const candidates = [];
  for (const record of stalexSnapshot.records ?? []) {
    const reason = candidateReason(record, identity);
    if (reason) {
      skipped[reason] = (skipped[reason] ?? 0) + 1;
      continue;
    }
    candidates.push(record);
  }
  candidates.sort((first, second) => {
    const firstRule = PILOT_CATEGORIES.get(first.category.chosen.targetSlug);
    const secondRule = PILOT_CATEGORIES.get(second.category.chosen.targetSlug);
    return firstRule.order - secondRule.order
      || Number(second.availability?.quantity > 0) - Number(first.availability?.quantity > 0)
      || normalizeTitle(first.name).localeCompare(normalizeTitle(second.name), "ru-RU");
  });
  const selected = candidates
    .slice(0, Math.max(0, Number(limit) || 0))
    .map((record) => buildProduct(record, identity, publicationScope));
  for (const product of selected) {
    const descriptionLeaks = findSupplierContactLeaks(product.description ?? "");
    if (descriptionLeaks.length > 0) throw new Error(`В описании ${product.id} остались контакты поставщика.`);
    if (!product.images.every((image) => image.startsWith("https://stalex.ru/upload/"))) {
      throw new Error(`Для ${product.id} найдено изображение вне официального Stalex URL.`);
    }
    if (product.variants.some((variant) => variant.available !== (variant.quantity > 0))) {
      throw new Error(`Для ${product.id} нарушено правило подтверждённого остатка.`);
    }
  }
  const selectedByCategory = Object.fromEntries(
    Array.from(PILOT_CATEGORIES.keys()).map((slug) => [slug, selected.filter((product) => product.category === slug).length]),
  );
  return {
    catalog: {
      ...baseCatalog,
      categories: incrementCategoryCounts(baseCatalog.categories, selected),
      subcategories: Array.isArray(baseCatalog.subcategories) ? baseCatalog.subcategories : [],
      products: [...baseCatalog.products, ...selected],
    },
    report: {
      mode: publicationScope,
      baseProducts: baseCatalog.products.length,
      sourceRecords: stalexSnapshot.records?.length ?? 0,
      eligibleAfterGuards: candidates.length,
      selected: selected.length,
      selectedByCategory,
      confirmedPositiveStock: selected.filter((product) => product.stock > 0).length,
      skipped,
      productIds: selected.map((product) => product.id),
    },
  };
}

export function buildStalexTestCatalog(options) {
  return buildStalexCatalog({ ...options, publicationScope:"test-only" });
}
