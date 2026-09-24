import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import generatedCatalogFacets from "./generatedCatalogFacets.json" with { type:"json" };
import { getCategoryFamily, getCategoryFamilyLabel } from "./categoryAssortmentTaxonomy.mjs";
import { getCategoryCardArchetype } from "./categoryCardArchetypes.mjs";
import { getCategoryExpertProfile, getCategoryFacetKeywords } from "./categoryExpertProfiles.mjs";
import { getCategorySelectionRule } from "./categorySelection.mjs";
import { selectComparableAlternatives, selectProductCompatibility } from "./productRecommendations.mjs";
import { getProductShippingPromise, getVariantShippingPromise } from "./shippingPromise.mjs";
import { applyVerifiedProductMedia } from "./verifiedProductMedia.mjs";
import { getRuntimeCatalogProductMediaUrl } from "./catalogProductMediaStore.ts";
import { applyRuntimeCatalogParameterOverrides, applyRuntimeCatalogParameterOverridesToProducts, getRuntimeCatalogParameterOverrideRevision } from "./catalogParameterOverrideStore.ts";
import { getFeedDecisionParameters } from "./feedDecisionParameters.mjs";

export type FeedParameter = {
  name: string;
  value: string;
  unit?: string;
  derivedFromTitle?: true;
  manualOverride?: true;
};

export type FeedVariant = {
  id: string;
  sku: string;
  name?: string;
  price?: number;
  quantity?: number;
  available: boolean;
  params: FeedParameter[];
  images?: string[];
};

export type FeedProduct = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  sku: string;
  category: string;
  images: string[];
  variants: FeedVariant[];
  stock: number;
  paramAxes: string[];
  priceFrom?: number;
  priceTo?: number;
  manualSortOrder?: number;
  description?: string;
};

export type FeedCompatibilityRecommendation = {
  product: FeedProduct;
  variant: FeedVariant;
  relationLabel: string;
  evidence: string[];
  caveat: string;
  diameter?: number;
  spindle?: string;
  workingLength?: string;
  maximumDiameter?: number;
};

export type FeedProductAlternative = {
  product: FeedProduct;
  variant: FeedVariant;
  reason: string;
  evidence: string[];
  differences: string[];
  score?: number;
  diameter?: number;
  spindle?: string;
  reverse?: string;
  mass?: string;
};

export type FeedCategory = {
  slug: string;
  title: string;
  count: number;
  h1?: string;
  intro?: string;
  published: boolean;
};

export type FeedProductSpec = {
  label: string;
  value: string;
};

export type FeedShippingPromise = ReturnType<typeof getVariantShippingPromise>;

export type FeedProductVariantModel = {
  id: string;
  sku: string;
  title: string;
  price: string;
  image?: string;
  href: string;
  specs: FeedProductSpec[];
  matchesSelection: boolean;
  available: boolean;
  shippingPromise: FeedShippingPromise;
};

export type FeedProductCardModel = {
  id: string;
  categorySlug: string;
  slug: string;
  title: string;
  brand: string;
  sku: string;
  image?: string;
  price: string;
  variantCount: number;
  selectedVariantCount: number;
  availableVariantCount: number;
  shippingPromise: FeedShippingPromise;
  specs: FeedProductSpec[];
  variants: FeedProductVariantModel[];
  matchReasons: string[];
  decisionPrompts: string[];
  taskLabel?: string;
  cardArchetype: {
    id: string;
    badge: string;
    variantForms: [string, string, string];
    singleAction: string;
    multipleAction: string;
    detailAction: string;
    tableIdentity: string;
    priceRequestNote: string;
  };
};

export type FeedVariantFilter = {
  keyword: string;
  label?: string;
  values: string[];
  minimum?: number;
  maximum?: number;
};

export type FeedFacetOption = {
  value: string;
  label: string;
  count: number;
};

export type FeedFacet = {
  key: string;
  label: string;
  help: string;
  keyword?: string;
  numeric?: boolean;
  options: FeedFacetOption[];
};

export type FeedCategorySort = "relevance" | "price-asc" | "price-desc" | "name";
export type FeedProductType = "equipment" | "accessories";
export type FeedCategorySegment = "sheet" | "tube" | "combined" | "special" | "robot" | "welding-cell" | "laser-processing" | "surface-finishing" | "drill-magnetic" | "drill-stationary" | "drill-rail" | "drill-special";
export type FeedCategorySubsegment = "magnetic-standard" | "magnetic-brushless" | "magnetic-tapping" | "magnetic-low-profile" | "magnetic-atex" | "magnetic-battery" | "stationary-column" | "stationary-bench" | "stationary-radial" | "stationary-tapping" | "stationary-production" | "rail-electric" | "rail-petrol" | "rail-universal" | "special-vacuum" | "special-pipe" | "special-cnc";

export type FeedCategoryQuery = {
  search?: string;
  sort?: FeedCategorySort;
  page?: number;
  pageSize?: number;
  filters?: Record<string, string[]>;
  numericMinimums?: Record<string, number>;
  numericMaximums?: Record<string, number>;
  availability?: "in-stock";
  productType?: FeedProductType;
  segment?: FeedCategorySegment;
  subsegment?: FeedCategorySubsegment;
  family?: string;
};

export type FeedCategoryPage = {
  products: FeedProduct[];
  facets: FeedFacet[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

export type FeedCategoryRecoverySuggestion = {
  removeKeys: string[];
  label: string;
  resultCount: number;
};

export type FeedSnapshot = {
  categories: FeedCategory[];
  products: FeedProduct[];
};

type CachedFeedFacet = Omit<FeedFacet, "options"> & {
  allOptions: FeedFacetOption[];
  optionLimit: number;
};

// Keep the 68 MB supplier snapshot out of the Vinext server bundle. Embedding it as
// a JavaScript object made the runtime parse a 42 MB module before rendering a
// catalog route, which added several seconds to every request in the Node host.
// The JSON is parsed once when this server module is loaded and then shared by all
// catalog indexes below. CATALOG_FEED_PATH is an operator-only escape hatch for a
// future immutable feed location; the release layout remains the safe default.
const loadedFeedSnapshot = loadFeedSnapshot();
const feedSnapshotSha256 = loadedFeedSnapshot.sha256;
const feedSnapshot = applyVerifiedProductMedia(loadedFeedSnapshot.snapshot) as FeedSnapshot;

function loadFeedSnapshot(): { snapshot: FeedSnapshot; sha256: string } {
  const configuredPath = process.env.CATALOG_FEED_PATH?.trim();
  const defaultPath = path.resolve(process.cwd(), "../../7tool-source/src/lib/products.json");
  const sourceTreePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../7tool-source/src/lib/products.json");
  const snapshotPath = [configuredPath, defaultPath, sourceTreePath].filter(Boolean).find((candidate) => existsSync(candidate));
  if (!snapshotPath) throw new Error(`Catalog feed snapshot was not found. Expected ${defaultPath}.`);
  const source = readFileSync(snapshotPath, "utf8");
  return { snapshot:JSON.parse(source) as FeedSnapshot, sha256:createHash("sha256").update(source).digest("hex") };
}

const categoriesBySlug = new Map(
  feedSnapshot.categories
    .filter((category) => category.published)
    .map((category) => [category.slug, category]),
);

const productsByCategory = new Map<string, FeedProduct[]>();
const productsBySlug = new Map<string, FeedProduct>();
const productsById = new Map<string, FeedProduct>();
const variantsById = new Map<string, { product: FeedProduct; variant: FeedVariant }>();
const categoryFacetCache = new Map<string, CachedFeedFacet[]>();
let categoryFacetCacheRevision = -1;
const rankedCategoryCache = new Map<string, FeedProduct[]>();
let rankedCategoryCacheRevision = -1;
const compatibilityCache = new Map<string, FeedCompatibilityRecommendation[]>();
const alternativeCache = new Map<string, FeedProductAlternative[]>();

const primaryTitlePatterns: Partial<Record<string, RegExp>> = {
  "stanki-sverlilnye": /(станок|машин[аы]? сверлил)/i,
  "rezbonareznye-manipulyatory": /(манипулятор|резьбонарезн.*(?:машин|станок))/i,
  "lentochnopilnye-stanki": /(ленточнопил.*станок|станок.*ленточнопил)/i,
  "disko-otreznye-stanki": /(диско-отрезн.*станок|отрезн.*станок)/i,
  "stanki-lazernoy-rezki": /(лазерн.*станок|станок.*лазерн)/i,
  "svarochnye-roboty": /(сварочн.*робот|робот.*сварочн)/i,
};

const accessoryPattern = /(приспособлен|адаптер|креплен|позиционер|стойк|комплект установк|запасн|оснастк|измеритель)/i;
const lowValueParameterPattern = /^(бренд|производитель|страна|артикул|штрихкод|серия)$/i;
const denseTableCategorySlugs = new Set([
  "borfrezy",
  "koronchatye-sverla",
  "metchiki",
  "pilnye-diski",
  "sozh-i-sots",
  "sverla-i-zenkovki",
]);

for (const product of feedSnapshot.products) {
  if (!categoriesBySlug.has(product.category)) continue;
  productsById.set(product.id, product);
  productsBySlug.set(product.slug, product);
  for (const variant of product.variants) variantsById.set(variant.id, { product, variant });
  const categoryProducts = productsByCategory.get(product.category) ?? [];
  categoryProducts.push(product);
  productsByCategory.set(product.category, categoryProducts);
}

export function getFeedCategory(slug: string): FeedCategory | undefined {
  return categoriesBySlug.get(slug);
}

export function getPublishedFeedCategorySlugs(): string[] {
  return Array.from(categoriesBySlug.keys());
}

export function getPublishedFeedCatalogSnapshot(): FeedSnapshot {
  return {
    categories:Array.from(categoriesBySlug.values()),
    products:applyRuntimeCatalogParameterOverridesToProducts(Array.from(productsByCategory.values()).flat()),
  };
}

export function getPublishedFeedCatalogSourceSha256(): string {
  return feedSnapshotSha256;
}

export function getFeedCategoryProductType(slug: string, product: FeedProduct): FeedProductType | undefined {
  if (slug === "stanki-sverlilnye") {
    const parameterNames = product.variants.flatMap((variant) => variant.params ?? []).map((parameter) => parameter.name).join(" ");
    const equipmentTitle = /(станок|машин[аы]? сверлил|mabasic|pro-\d)/iu.test(product.title);
    const equipmentParameters = /(макс.*диаметр.*(?:отверст|сверл)|шпиндель|рабочий ход|ход пиноли|число скоростей)/iu.test(parameterNames);
    return equipmentTitle || equipmentParameters ? "equipment" : "accessories";
  }
  if (slug !== "lentochnopilnye-stanki") return undefined;
  const hasWorkingCapacity = product.variants.some((variant) => variant.params?.some((parameter) => /макс\.\s*(?:ширина|высота|диаметр)/iu.test(parameter.name)));
  const equipmentTitle = /^(?:станок ленточнопильный|ленточнопильный станок|ленточная пила|автоматизированная линия)/iu.test(product.title.trim());
  return hasWorkingCapacity || equipmentTitle ? "equipment" : "accessories";
}

export function getFeedCategorySegment(slug: string, product: FeedProduct): FeedCategorySegment | undefined {
  const title = normalizeText(product.title);
  if (slug === "stanki-sverlilnye") {
    if (getFeedCategoryProductType(slug, product) !== "equipment") return undefined;
    const parameterNames = normalizeText(product.variants.flatMap((variant) => variant.params ?? []).map((parameter) => parameter.name).join(" "));
    if (/рельс/u.test(title)) return "drill-rail";
    if (/(вакуум|для труб|труб.*сверл|координатно|портальн|чпу)/u.test(title)) return "drill-special";
    if (/(магнит|электромагнит)/u.test(title) || /макс.*диаметр корончатого сверла/u.test(parameterNames)) return "drill-magnetic";
    return "drill-stationary";
  }
  if (slug === "stanki-lazernoy-rezki") {
    if (/(труб.*(?:лист|пласт|плит)|(?:лист|пласт|плит).*труб|модул.*резки труб)/u.test(title)) return "combined";
    if (/(труб|труборез)/u.test(title)) return "tube";
    if (/(стекл|пробив|прецизион)/u.test(title)) return "special";
    return "sheet";
  }
  if (slug === "svarochnye-roboty") {
    if (/(шлиф|полир|окалин)/u.test(title)) return "surface-finishing";
    if (/лазер/u.test(title)) return "laser-processing";
    if (/(ячейк|сварочн.*комплекс|комплекс.*свароч)/u.test(title)) return "welding-cell";
    return "robot";
  }
  return undefined;
}

export function getFeedCategorySegmentLabel(slug: string, segment?: FeedCategorySegment): string | undefined {
  if (slug === "stanki-sverlilnye") {
    return segment === "drill-magnetic"
      ? "Магнитный станок"
      : segment === "drill-stationary"
        ? "Стационарный станок"
        : segment === "drill-rail"
          ? "Рельсосверлильный станок"
          : segment === "drill-special"
            ? "Специальный станок"
            : undefined;
  }
  if (slug === "svarochnye-roboty") {
    return segment === "robot"
      ? "Отдельный робот"
      : segment === "welding-cell"
        ? "Сварочная ячейка"
        : segment === "laser-processing"
          ? "Лазерный процесс"
          : segment === "surface-finishing"
            ? "Обработка поверхности"
            : undefined;
  }
  return segment === "sheet"
    ? "Для листового металла"
    : segment === "tube"
      ? "Для труб и профиля"
      : segment === "combined"
        ? "Лист + труба"
        : segment === "special"
          ? "Специальная задача"
          : undefined;
}

export function getFeedCategorySubsegment(slug: string, product: FeedProduct): FeedCategorySubsegment | undefined {
  if (slug !== "stanki-sverlilnye" || getFeedCategoryProductType(slug, product) !== "equipment") return undefined;
  const segment = getFeedCategorySegment(slug, product);
  const title = normalizeText(product.title);
  const parameters = product.variants.flatMap((variant) => variant.params ?? []);
  const parameterText = normalizeText(parameters.map((parameter) => `${parameter.name} ${parameter.value}`).join(" "));

  if (segment === "drill-magnetic") {
    if (/(пневмат|atex|постоянн.*магнит)/u.test(`${title} ${parameterText}`)) return "magnetic-atex";
    if (/(battery|аккумулятор)/u.test(`${title} ${parameterText}`)) return "magnetic-battery";
    if (/(низкопроф|low profile|компакт)/u.test(`${title} ${parameterText}`)) return "magnetic-low-profile";
    if (/бесщеточ|brushless/u.test(`${title} ${parameterText}`)) return "magnetic-brushless";
    if (/резьб/u.test(title) || parameters.some((parameter) => /реверс/iu.test(parameter.name) && /да/iu.test(parameter.value))) return "magnetic-tapping";
    return "magnetic-standard";
  }
  if (segment === "drill-stationary") {
    if (/радиально/u.test(title)) return "stationary-radial";
    if (/настоль/u.test(title)) return "stationary-bench";
    if (/резьбонарез/u.test(title)) return "stationary-tapping";
    if (/(многошпиндел|автомат)/u.test(title)) return "stationary-production";
    return "stationary-column";
  }
  if (segment === "drill-rail") {
    if (/бензин/u.test(title)) return "rail-petrol";
    if (/электр/u.test(title)) return "rail-electric";
    return "rail-universal";
  }
  if (segment === "drill-special") {
    if (/вакуум/u.test(title)) return "special-vacuum";
    if (/труб/u.test(title)) return "special-pipe";
    if (/(чпу|портальн|координатно)/u.test(title)) return "special-cnc";
  }
  return undefined;
}

export function getFeedCategorySubsegmentLabel(slug: string, subsegment?: FeedCategorySubsegment): string | undefined {
  if (slug !== "stanki-sverlilnye" || !subsegment) return undefined;
  return ({
    "magnetic-standard":"Универсальный магнитный станок",
    "magnetic-brushless":"Бесщёточный магнитный станок",
    "magnetic-tapping":"Магнитный станок с реверсом",
    "magnetic-low-profile":"Низкопрофильный магнитный станок",
    "magnetic-atex":"Специальный магнитный станок",
    "magnetic-battery":"Аккумуляторный магнитный станок",
    "stationary-column":"Вертикальный или колонный станок",
    "stationary-bench":"Настольный сверлильный станок",
    "stationary-radial":"Радиально-сверлильный станок",
    "stationary-tapping":"Сверлильно-резьбонарезной станок",
    "stationary-production":"Производственный сверлильный станок",
    "rail-electric":"Электрический рельсосверлильный станок",
    "rail-petrol":"Бензиновый рельсосверлильный станок",
    "rail-universal":"Рельсосверлильный станок",
    "special-vacuum":"Станок на вакуумном основании",
    "special-pipe":"Станок для сверления труб",
    "special-cnc":"Портальный станок или центр с ЧПУ",
  } satisfies Record<FeedCategorySubsegment, string>)[subsegment];
}

export function getFeedCategoryFamily(slug: string, product: FeedProduct): string | undefined {
  return getCategoryFamily(slug, product);
}

export function getFeedCategoryFamilyLabel(slug: string, family?: string): string | undefined {
  return family ? getCategoryFamilyLabel(slug, family) : undefined;
}

export function prefersDenseFeedTable(slug: string): boolean {
  return denseTableCategorySlugs.has(slug);
}

export function getFeedCategoryProducts(slug: string, limit = 6): FeedProduct[] {
  return getRankedCategoryProducts(slug)
    .filter((product) => Boolean(getFeedProductImage(product)))
    .slice(0, limit);
}

export function getFeedCategoryPage(slug: string, query: FeedCategoryQuery = {}): FeedCategoryPage {
  const pageSize = Math.min(48, Math.max(6, query.pageSize ?? 12));
  const familyScopedProducts = getScopedCategoryProducts(slug, query);
  const cacheScope = [query.productType, query.segment, query.subsegment, query.family].filter(Boolean).join(":") || undefined;
  let facets = getCategoryFacets(slug, familyScopedProducts, query.filters ?? {}, cacheScope);
  const selectedBrands = query.filters?.brand?.filter(Boolean) ?? [];
  if (selectedBrands.length > 0) {
    const brandScopedProducts = familyScopedProducts.filter((product) => selectedBrands.includes(product.brand));
    const technicalFacets = getCategoryFacets(slug, brandScopedProducts, query.filters ?? {}, `${cacheScope ?? slug}:brand:${selectedBrands.slice().sort().join("|")}`)
      .filter((facet) => facet.keyword);
    const brandFacet = facets.find((facet) => facet.key === "brand");
    facets = [...(brandFacet ? [brandFacet] : []), ...technicalFacets];
  }
  const normalizedSearch = query.search ? normalizeText(query.search) : "";
  const filteredProducts = familyScopedProducts.filter((product) => {
    if (normalizedSearch && !getProductSearchText(product).includes(normalizedSearch)) return false;
    return productMatchesFacetFilters(product, facets, query.filters ?? {}, query.numericMinimums ?? {}, query.numericMaximums ?? {}, query.availability === "in-stock");
  });
  const sortedProducts = [...filteredProducts];

  if (query.sort === "price-asc") {
    sortedProducts.sort((a, b) => compareOptionalPrices(a.priceFrom, b.priceFrom, "asc"));
  } else if (query.sort === "price-desc") {
    sortedProducts.sort((a, b) => compareOptionalPrices(a.priceFrom, b.priceFrom, "desc"));
  } else if (query.sort === "name") {
    sortedProducts.sort((a, b) => a.title.localeCompare(b.title, "ru-RU"));
  }

  const total = sortedProducts.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pageCount, Math.max(1, query.page ?? 1));
  const offset = (page - 1) * pageSize;

  return {
    products: sortedProducts.slice(offset, offset + pageSize),
    facets,
    total,
    page,
    pageCount,
    pageSize,
  };
}

export function getFeedCategoryFacetSnapshot(slug: string): CachedFeedFacet[] {
  return buildCategoryFacets(slug, getRankedCategoryProducts(slug)).map((facet) => ({ ...facet, allOptions:facet.allOptions.map((option) => ({ ...option })) }));
}

export function getFeedCategoryRankingSnapshot(slug: string): string[] {
  return getRankedCategoryProducts(slug).map((product) => product.id);
}

export function getFeedCategoryProductCountForQuery(slug: string, query: Pick<FeedCategoryQuery, "search" | "productType" | "segment" | "subsegment" | "family"> = {}): number {
  const products = getScopedCategoryProducts(slug, query);
  const normalizedSearch = query.search ? normalizeText(query.search) : "";
  return normalizedSearch ? products.filter((product) => getProductSearchText(product).includes(normalizedSearch)).length : products.length;
}

export function getFeedCategoryRecoverySuggestions(slug: string, query: FeedCategoryQuery = {}, limit = 3): FeedCategoryRecoverySuggestion[] {
  const facets = getCategoryFacets(slug, getRankedCategoryProducts(slug), query.filters ?? {});
  const facetsByKey = new Map(facets.map((facet) => [facet.key, facet]));
  const candidates: Array<{ removeKeys: string[]; label: string }> = [];
  const consumedMaximums = new Set<string>();

  if (query.search?.trim()) candidates.push({ removeKeys:["q"], label:`Убрать поиск «${query.search.trim()}»` });
  if (query.availability === "in-stock") candidates.push({ removeKeys:["availability"], label:"Показать также товары с уточнением наличия" });

  for (const [key, values] of Object.entries(query.filters ?? {})) {
    if (values.length === 0) continue;
    const facet = facetsByKey.get(key);
    candidates.push({ removeKeys:[`f_${key}`], label:`Не ограничивать «${facet?.label ?? "параметр"}»` });
  }

  for (const [key, value] of Object.entries(query.numericMinimums ?? {})) {
    if (!Number.isFinite(value)) continue;
    const facet = facetsByKey.get(key);
    const rule = getCategorySelectionRule(slug, facet?.keyword);
    const minimumFacet = rule.mode === "range" ? facets.find((candidate) => candidate.keyword === rule.minimumKeyword) : undefined;
    const removeKeys = [`min_${key}`];
    if (minimumFacet && Number.isFinite(query.numericMaximums?.[minimumFacet.key])) {
      removeKeys.push(`max_${minimumFacet.key}`);
      consumedMaximums.add(minimumFacet.key);
    }
    candidates.push({
      removeKeys,
      label:rule.mode === "range"
        ? `Не ограничивать «${rule.question ?? facet?.label ?? "рабочий диапазон"}»`
        : `Убрать требование «${facet?.label ?? "Параметр"}: не менее ${value}»`,
    });
  }

  for (const [key, value] of Object.entries(query.numericMaximums ?? {})) {
    if (!Number.isFinite(value) || consumedMaximums.has(key)) continue;
    const facet = facetsByKey.get(key);
    candidates.push({ removeKeys:[`max_${key}`], label:`Убрать требование «${facet?.label ?? "Параметр"}: не более ${value}»` });
  }

  return candidates.map((candidate) => {
    const relaxedQuery = removeCategoryQueryKeys(query, candidate.removeKeys);
    return { ...candidate, resultCount:getFeedCategoryPage(slug, { ...relaxedQuery, page:1, pageSize:6 }).total };
  }).filter((candidate) => candidate.resultCount > 0)
    .sort((first, second) => first.resultCount - second.resultCount || first.label.localeCompare(second.label, "ru-RU"))
    .slice(0, Math.max(0, limit));
}

export function getFeedCategoryProductCount(slug: string): number {
  return productsByCategory.get(slug)?.length ?? 0;
}

export function getFeedProductBySlug(slug: string): FeedProduct | undefined {
  const product = productsBySlug.get(slug);
  return product ? applyRuntimeCatalogParameterOverrides(product) : undefined;
}

export function getFeedProductVariantById(id: string): { product: FeedProduct; variant: FeedVariant } | undefined {
  const found = variantsById.get(id);
  if (!found) return undefined;
  const product = applyRuntimeCatalogParameterOverrides(found.product);
  const variant = product.variants.find((entry) => entry.id === id);
  return variant ? { product, variant } : undefined;
}

export function getFeedProductCompatibility(product: FeedProduct, variant: FeedVariant, limit = 3): FeedCompatibilityRecommendation[] {
  const key = `${product.id}:${variant.id}:${limit}`;
  const cached = compatibilityCache.get(key);
  if (cached) return cached;
  const candidates = product.category === "stanki-sverlilnye"
    ? productsByCategory.get("koronchatye-sverla") ?? []
    : product.category === "koronchatye-sverla"
      ? productsByCategory.get("stanki-sverlilnye") ?? []
      : [];
  const recommendations = selectProductCompatibility(candidates, product, variant, limit) as FeedCompatibilityRecommendation[];
  compatibilityCache.set(key, recommendations);
  return recommendations;
}

export function getFeedProductAlternatives(product: FeedProduct, variant: FeedVariant, limit = 3): FeedProductAlternative[] {
  const key = `${product.id}:${variant.id}:${limit}`;
  const cached = alternativeCache.get(key);
  if (cached) return cached;
  const recommendations = selectComparableAlternatives(productsByCategory.get(product.category) ?? [], product, variant, limit) as FeedProductAlternative[];
  alternativeCache.set(key, recommendations);
  return recommendations;
}

export function getFeedProductImage(product: FeedProduct): string | undefined {
  return product.images.find(Boolean)
    ?? product.variants.find((variant) => variant.images?.some(Boolean))?.images?.find(Boolean)
    ?? getRuntimeCatalogProductMediaUrl(product);
}

export function formatFeedPrice(value?: number): string | undefined {
  if (!value || value <= 0) return undefined;
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

export function getFeedProductPriceLabel(product: FeedProduct): string {
  const from = formatFeedPrice(product.priceFrom);
  const to = formatFeedPrice(product.priceTo);
  if (!from) return "Цена по запросу";
  if (to && to !== from) return `от ${from} до ${to}`;
  return from;
}

export function toFeedProductCardModel(product: FeedProduct, activeFilters: FeedVariantFilter[] = [], preferAvailable = false, cardArchetypeOverride?: "fixtures"): FeedProductCardModel {
  const productImage = getFeedProductImage(product);
  const hasVariantSelection = activeFilters.length > 0 || preferAvailable;
  const selectedVariants = product.variants
    .map((variant, sourceOrder) => ({
      variant,
      sourceOrder,
      matchesSelection: hasVariantSelection && (activeFilters.length === 0 || activeFilters.every((filter) => {
        const values = getVariantParameterValues(variant, filter.keyword, product);
        return Number.isFinite(filter.minimum)
          ? values.some((value) => parseNumericValue(value) >= (filter.minimum ?? Number.POSITIVE_INFINITY))
          : Number.isFinite(filter.maximum)
            ? values.some((value) => parseNumericValue(value) <= (filter.maximum ?? Number.NEGATIVE_INFINITY))
            : values.some((value) => filter.values.includes(value));
      })) && (!preferAvailable || isConfirmedAvailableVariant(variant)),
    }))
    .filter(({ matchesSelection }) => !hasVariantSelection || matchesSelection)
    .sort((first, second) => Number(second.matchesSelection) - Number(first.matchesSelection) || first.sourceOrder - second.sourceOrder);
  const variants = selectedVariants
    .slice(0, 12)
    .map(({ variant, matchesSelection }) => {
      const shippingPromise = getVariantShippingPromise(variant);
      return {
        id:variant.id,
        sku:variant.sku,
        title:variant.name ?? variant.sku,
        price:formatFeedPrice(variant.price) ?? "Цена по запросу",
        image:variant.images?.find(Boolean) ?? productImage,
        href:`/product/${product.slug}?variant=${encodeURIComponent(variant.id)}#variants`,
        specs:getFeedVariantSpecs(product, variant),
        matchesSelection,
        available:shippingPromise.available,
        shippingPromise,
      };
    });

  const expertProfile = getCategoryExpertProfile(product.category);
  const taskSegment = getFeedCategorySegment(product.category, product);
  const taskSubsegment = getFeedCategorySubsegment(product.category, product);
  const segmentCriteria = expertProfile.assortmentShortcuts?.find((shortcut: { segment?: FeedCategorySegment }) => shortcut.segment === taskSegment)?.criteria;
  const decisionCriteria = cardArchetypeOverride === "fixtures" && expertProfile.accessoryCriteria
    ? expertProfile.accessoryCriteria
    : segmentCriteria ?? expertProfile.criteria;

  return {
    id: product.id,
    categorySlug: product.category,
    slug: product.slug,
    title: product.title,
    brand: product.brand,
    sku: product.sku,
    image: productImage,
    price: getFeedProductPriceLabel(product),
    variantCount: product.variants.length,
    selectedVariantCount: selectedVariants.length,
    availableVariantCount: product.variants.filter(isConfirmedAvailableVariant).length,
    shippingPromise:getProductShippingPromise(product.variants),
    specs: getFeedProductSpecs(product),
    variants,
    matchReasons:activeFilters.flatMap((filter) => Number.isFinite(filter.minimum)
      ? [`${filter.label ?? filter.keyword}: не менее ${filter.minimum}`]
      : Number.isFinite(filter.maximum)
        ? [`${filter.label ?? filter.keyword}: не более ${filter.maximum}`]
        : filter.values.map((value) => `${filter.label ?? filter.keyword}: ${formatSelectedFilterValue(product.category, filter.keyword, value)}`)).slice(0, 4),
    decisionPrompts:decisionCriteria.map((item) => item.title).slice(0, 3),
    taskLabel:getFeedCategorySubsegmentLabel(product.category, taskSubsegment)
      ?? getFeedCategorySegmentLabel(product.category, taskSegment)
      ?? getCategoryFamilyLabel(product.category, getCategoryFamily(product.category, product)),
    cardArchetype:getCategoryCardArchetype(product.category, cardArchetypeOverride),
  };
}

export function getFeedTableColumns(products: FeedProductCardModel[], limit = 3): string[] {
  const stats = new Map<string, { count: number; positionTotal: number; firstSeen: number }>();
  let firstSeen = 0;

  for (const product of products) {
    product.specs.forEach((spec, position) => {
      const current = stats.get(spec.label);
      if (current) {
        current.count += 1;
        current.positionTotal += position;
        return;
      }
      stats.set(spec.label, { count:1, positionTotal:position, firstSeen:firstSeen++ });
    });
  }

  return Array.from(stats.entries())
    .sort(([, a], [, b]) => b.count - a.count
      || a.positionTotal / a.count - b.positionTotal / b.count
      || a.firstSeen - b.firstSeen)
    .slice(0, Math.max(0, limit))
    .map(([label]) => label);
}

function scoreFeedProduct(product: FeedProduct, categorySlug: string): number {
  const primaryPattern = primaryTitlePatterns[categorySlug];
  const titleScore = primaryPattern?.test(product.title) ? 45 : 0;
  const accessoryPenalty = primaryPattern && accessoryPattern.test(product.title) ? 35 : 0;
  const merchandisingScore = typeof product.manualSortOrder === "number" ? Math.max(0, 25 - product.manualSortOrder) : 0;
  const dataScore = (product.priceFrom ? 5 : 0) + Math.min(8, getFeedProductSpecs(product).length * 2) + (product.variants.length > 1 ? 2 : 0);
  return titleScore - accessoryPenalty + merchandisingScore + dataScore;
}

function getRankedCategoryProducts(slug: string): FeedProduct[] {
  const revision = getRuntimeCatalogParameterOverrideRevision();
  if (revision !== rankedCategoryCacheRevision) {
    rankedCategoryCache.clear();
    rankedCategoryCacheRevision = revision;
  }
  const cached = rankedCategoryCache.get(slug);
  if (cached) return cached;
  const generatedIds = revision === 0 && generatedCatalogFacets.sourceSha256 === feedSnapshotSha256
    ? (generatedCatalogFacets.rankings as unknown as Record<string, string[]> | undefined)?.[slug]
    : undefined;
  const generatedRanking = generatedIds?.flatMap((id) => productsById.get(id) ?? []) ?? [];
  if (generatedRanking.length === (productsByCategory.get(slug)?.length ?? 0) && generatedRanking.length > 0) {
    rankedCategoryCache.set(slug, generatedRanking);
    return generatedRanking;
  }
  const ranked = applyRuntimeCatalogParameterOverridesToProducts(productsByCategory.get(slug) ?? [])
    .map((product, sourceOrder) => ({ product, sourceOrder, score:scoreFeedProduct(product, slug) }))
    .sort((a, b) => b.score - a.score || a.sourceOrder - b.sourceOrder)
    .map(({ product }) => product);
  rankedCategoryCache.set(slug, ranked);
  return ranked;
}

function getScopedCategoryProducts(slug: string, query: Pick<FeedCategoryQuery, "productType" | "segment" | "subsegment" | "family">): FeedProduct[] {
  const allProducts = getRankedCategoryProducts(slug);
  const supportsProductTypes = allProducts.some((product) => getFeedCategoryProductType(slug, product) !== undefined);
  const productTypeScopedProducts = query.productType && supportsProductTypes
    ? allProducts.filter((product) => getFeedCategoryProductType(slug, product) === query.productType)
    : allProducts;
  const supportsSegments = productTypeScopedProducts.some((product) => getFeedCategorySegment(slug, product) !== undefined);
  const segmentScopedProducts = query.segment && supportsSegments
    ? productTypeScopedProducts.filter((product) => getFeedCategorySegment(slug, product) === query.segment)
    : productTypeScopedProducts;
  const supportsSubsegments = segmentScopedProducts.some((product) => getFeedCategorySubsegment(slug, product) !== undefined);
  const subsegmentScopedProducts = query.subsegment && supportsSubsegments
    ? segmentScopedProducts.filter((product) => getFeedCategorySubsegment(slug, product) === query.subsegment)
    : segmentScopedProducts;
  return query.family
    ? subsegmentScopedProducts.filter((product) => getCategoryFamily(slug, product) === query.family)
    : subsegmentScopedProducts;
}

function getCategoryFacets(slug: string, products: FeedProduct[], selectedFilters: Record<string, string[]>, cacheScope?: string): FeedFacet[] {
  const revision = getRuntimeCatalogParameterOverrideRevision();
  if (revision !== categoryFacetCacheRevision) {
    categoryFacetCache.clear();
    categoryFacetCacheRevision = revision;
  }
  const cacheKey = cacheScope ? `${slug}:${cacheScope}` : slug;
  let cachedFacets = categoryFacetCache.get(cacheKey);
  if (!cachedFacets) {
    const generatedFacets = !cacheScope
      && revision === 0
      && generatedCatalogFacets.sourceSha256 === feedSnapshotSha256
      ? (generatedCatalogFacets.categories as unknown as Record<string, CachedFeedFacet[]>)[slug]
      : undefined;
    cachedFacets = generatedFacets ?? buildCategoryFacets(slug, products);
    categoryFacetCache.set(cacheKey, cachedFacets);
  }
  return cachedFacets.map(({ allOptions, optionLimit, ...facet }) => ({
    ...facet,
    options:selectFacetOptions(allOptions, selectedFilters[facet.key], optionLimit, facet.numeric),
  }));
}

function buildCategoryFacets(slug: string, products: FeedProduct[]): CachedFeedFacet[] {
  const facets: CachedFeedFacet[] = [];
  const categoryFacetKeywords = getCategoryFacetKeywords(slug);
  const { brands, parameters } = analyzeCategoryFacets(slug, products, categoryFacetKeywords);
  if (brands.size > 1) {
    facets.push({
      key: "brand",
      label: "Производитель",
      help: "Оставьте несколько брендов, если готовы сравнить аналоги.",
      allOptions: toFacetOptions(brands),
      optionLimit:10,
    });
  }

  const usedParameterNames = new Set<string>();
  const technicalFacetLimit = Math.min(slug === "sverla-i-zenkovki" ? 10 : 5, categoryFacetKeywords.length);
  for (const { keyword, names, values } of parameters) {
    if (facets.filter((facet) => facet.keyword).length >= technicalFacetLimit) break;
    const matchingNames = Array.from(names.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru-RU"))
      .map(([name]) => name)
      .filter((name) => !usedParameterNames.has(normalizeText(name)));
    if (matchingNames.length === 0) continue;
    if (values.size < 2) continue;

    const key = `spec${facets.filter((facet) => facet.keyword).length + 1}`;
    const numeric = isNumericFacet(keyword, matchingNames[0], values);
    matchingNames.forEach((name) => usedParameterNames.add(normalizeText(name)));
    facets.push({
      key,
      label: keyword === "посадка хвостовика" ? "Хвостовик" : matchingNames[0],
      help: getFacetHelp(keyword),
      keyword,
      numeric,
      allOptions:toFacetOptions(values, keyword === "форма" ? "value" : numeric ? "numeric" : "count")
        .map((option) => ({ ...option, label:formatFacetOptionLabel(slug, keyword, option.value) })),
      optionLimit:keyword === "форма" ? 100 : numeric ? values.size : 10,
    });
  }

  return facets;
}

function analyzeCategoryFacets(slug: string, products: FeedProduct[], keywords: string[]) {
  const brands = new Map<string, number>();
  const parameters = keywords.map((keyword) => ({ keyword, normalizedKeyword:normalizeText(keyword), names:new Map<string, number>(), values:new Map<string, number>() }));
  const matchingAnalysisIndexes = new Map<string, number[]>();

  for (const product of products) {
    if (product.brand) brands.set(product.brand, (brands.get(product.brand) ?? 0) + 1);
    const productNames = parameters.map(() => new Set<string>());
    const productValues = parameters.map(() => new Set<string>());

    for (const variant of product.variants) {
      for (const parameter of getFeedDecisionParameters(product, variant)) {
        const normalizedName = normalizeParameterName(parameter.name);
        let matchingIndexes = matchingAnalysisIndexes.get(normalizedName);
        if (!matchingIndexes) {
          matchingIndexes = parameters.flatMap((analysis, index) => parameterMatchesFacetKeyword(normalizedName, analysis.normalizedKeyword) ? [index] : []);
          matchingAnalysisIndexes.set(normalizedName, matchingIndexes);
        }
        for (const index of matchingIndexes) {
          const analysis = parameters[index];
          productNames[index].add(parameter.name);
          const value = getFacetParameterValue(slug, analysis.normalizedKeyword, product, variant, parameter);
          if (value) productValues[index].add(value);
        }
      }
    }

    parameters.forEach((analysis, index) => {
      for (const name of productNames[index]) analysis.names.set(name, (analysis.names.get(name) ?? 0) + 1);
      for (const value of productValues[index]) analysis.values.set(value, (analysis.values.get(value) ?? 0) + 1);
    });
  }

  return { brands, parameters };
}

function isConfirmedAvailableVariant(variant: FeedVariant): boolean {
  return getVariantShippingPromise(variant).available;
}

function toFacetOptions(counts: Map<string, number>, sortMode: "count" | "value" | "numeric" = "count"): FeedFacetOption[] {
  const ranked = Array.from(counts.entries())
    .sort((a, b) => sortMode === "numeric"
      ? compareNumericFacetValues(a[0], b[0])
      : sortMode === "value"
        ? compareFacetValues(a[0], b[0])
        : b[1] - a[1] || a[0].localeCompare(b[0], "ru-RU"));
  return ranked.map(([value, count]) => ({ value, label:value, count }));
}

function selectFacetOptions(allOptions: FeedFacetOption[], selectedValues: string[] = [], limit = 10, preserveRange = false): FeedFacetOption[] {
  const visible = preserveRange && allOptions.length > limit
    ? [...allOptions.slice(0, Math.max(1, limit - 1)), allOptions.at(-1)!]
    : allOptions.slice(0, limit);
  for (const selected of selectedValues) {
    const entry = allOptions.find((option) => option.value === selected);
    if (entry && !visible.some((option) => option.value === selected)) visible.push(entry);
  }
  return preserveRange ? visible.sort((first, second) => compareNumericFacetValues(first.value, second.value)) : visible;
}

export function getPromotedFacetOptions(facet: FeedFacet, limit = 6, selectedValues: string[] = [], preferredValues: string[] = []): FeedFacetOption[] {
  if (limit <= 0) return [];
  if (limit === 1) return facet.options.slice(0, 1);
  if (!facet.numeric || facet.options.length <= limit) return facet.options.slice(0, limit);
  const preferred = preferredValues.flatMap((value) => facet.options.find((option) => option.value === value) ?? []);
  const sampleLimit = Math.max(1, limit - preferred.length);
  const sampled = sampleLimit === 1
    ? facet.options.slice(0, 1)
    : Array.from({ length:sampleLimit }, (_, index) => facet.options[Math.round(index * (facet.options.length - 1) / (sampleLimit - 1))]);
  sampled.push(...preferred);
  for (const selected of selectedValues) {
    const entry = facet.options.find((option) => option.value === selected);
    if (entry && !sampled.some((option) => option.value === selected)) sampled.push(entry);
  }
  return Array.from(new Map(sampled.map((option) => [option.value, option])).values())
    .sort((first, second) => compareNumericFacetValues(first.value, second.value));
}

export function getGuidedFacetOptions(facet: FeedFacet, limit = 6, selectedValues: string[] = []): FeedFacetOption[] {
  if (!facet.numeric) return getPromotedFacetOptions(facet, limit, selectedValues);
  const usableOptions = facet.options.filter((option) => isUsableGuidedNumericOption(facet, option.value));
  return getPromotedFacetOptions({ ...facet, options:usableOptions.length > 0 ? usableOptions : facet.options }, limit, selectedValues);
}

function compareFacetValues(first: string, second: string): number {
  const rank = (value: string) => /^[A-ZА-Я]$/i.test(value) ? 0 : /^[A-ZА-Я][+\-]?$/i.test(value) ? 1 : 2;
  return rank(first) - rank(second) || first.localeCompare(second, "ru-RU", { numeric:true });
}

function compareNumericFacetValues(first: string, second: string): number {
  const firstNumber = parseNumericValue(first);
  const secondNumber = parseNumericValue(second);
  if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber) && firstNumber !== secondNumber) return firstNumber - secondNumber;
  if (Number.isFinite(firstNumber) !== Number.isFinite(secondNumber)) return Number.isFinite(firstNumber) ? -1 : 1;
  return first.localeCompare(second, "ru-RU", { numeric:true });
}

function isNumericFacet(keyword: string, label: string, values: Map<string, number>): boolean {
  if (!/(диаметр|длина|ширина|толщина|мощность|производительность|объ[её]м|масса|грузопод|усилие|радиус|охват|частота|скорость|напряжение|угол|количество|число|резьба|ход|поле|размер)/i.test(`${keyword} ${label}`)) return false;
  const entries = Array.from(values.keys());
  return entries.length > 0 && entries.filter((value) => Number.isFinite(parseNumericValue(value))).length / entries.length >= .75;
}

function isUsableGuidedNumericOption(facet: FeedFacet, value: string): boolean {
  if (/резьб/i.test(`${facet.keyword ?? ""} ${facet.label}`)) return true;
  if (/угол/i.test(`${facet.keyword ?? ""} ${facet.label}`)) return true;
  if (/^[a-zа-я]+\d+$/iu.test(value.trim())) return false;
  if (/\/\s*[+\-−–]\s*\d/u.test(value) || /\d\s*\/\s*[+\-−–]/u.test(value)) return false;
  const numeric = parseNumericValue(value);
  if (!Number.isFinite(numeric)) return false;
  return !/(диаметр|длина|ширина|толщина|мощность|производительность|объ[её]м|масса|грузопод|усилие|радиус|охват|частота|скорость|напряжение|ход|поле|размер)/i.test(`${facet.keyword ?? ""} ${facet.label}`) || numeric > 0;
}

function productMatchesFacetFilters(product: FeedProduct, facets: FeedFacet[], filters: Record<string, string[]>, numericMinimums: Record<string, number>, numericMaximums: Record<string, number>, requireAvailable = false): boolean {
  const selectedBrands = filters.brand?.filter(Boolean) ?? [];
  if (selectedBrands.length > 0 && !selectedBrands.includes(product.brand)) return false;

  const technicalFacets = facets.filter((facet) => facet.keyword && (filters[facet.key]?.length ?? 0) > 0);
  const minimumFacets = facets.filter((facet) => facet.keyword && Number.isFinite(numericMinimums[facet.key]));
  const maximumFacets = facets.filter((facet) => facet.keyword && Number.isFinite(numericMaximums[facet.key]));
  if (technicalFacets.length === 0 && minimumFacets.length === 0 && maximumFacets.length === 0) return !requireAvailable || product.variants.some(isConfirmedAvailableVariant);

  return product.variants.some((variant) => (!requireAvailable || isConfirmedAvailableVariant(variant)) && technicalFacets.every((facet) => {
    const selected = filters[facet.key] ?? [];
    return getVariantParameterValues(variant, facet.keyword ?? "", product).some((value) => selected.includes(value));
  }) && minimumFacets.every((facet) => getVariantParameterValues(variant, facet.keyword ?? "", product).some((value) => parseNumericValue(value) >= numericMinimums[facet.key]))
    && maximumFacets.every((facet) => getVariantParameterValues(variant, facet.keyword ?? "", product).some((value) => parseNumericValue(value) <= numericMaximums[facet.key])));
}

function removeCategoryQueryKeys(query: FeedCategoryQuery, removeKeys: string[]): FeedCategoryQuery {
  const removed = new Set(removeKeys);
  const filters = Object.fromEntries(Object.entries(query.filters ?? {}).filter(([key]) => !removed.has(`f_${key}`)));
  const numericMinimums = Object.fromEntries(Object.entries(query.numericMinimums ?? {}).filter(([key]) => !removed.has(`min_${key}`)));
  const numericMaximums = Object.fromEntries(Object.entries(query.numericMaximums ?? {}).filter(([key]) => !removed.has(`max_${key}`)));
  return {
    ...query,
    search:removed.has("q") ? undefined : query.search,
    availability:removed.has("availability") ? undefined : query.availability,
    filters,
    numericMinimums,
    numericMaximums,
  };
}

function parseNumericValue(value: string): number {
  const match = value.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  const parsed = Number.parseFloat(match?.[0] ?? "");
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function getVariantParameterValues(variant: FeedVariant, keyword: string, product?: FeedProduct): string[] {
  const normalizedKeyword = normalizeText(keyword);
  return (product ? getFeedDecisionParameters(product, variant) : variant.params ?? [])
    .filter((parameter) => parameterMatchesFacetKeyword(normalizeParameterName(parameter.name), normalizedKeyword))
    .map((parameter) => getFacetParameterValue(product?.category, normalizedKeyword, product, variant, parameter));
}

export function feedParameterMatchesFacetKeyword(name: string, keyword: string): boolean {
  return parameterMatchesFacetKeyword(normalizeText(name), normalizeText(keyword));
}

function getFacetParameterValue(slug: string | undefined, normalizedKeyword: string, product: FeedProduct | undefined, variant: FeedVariant, parameter: FeedParameter): string {
  if (slug === "koronchatye-sverla" && normalizedKeyword === "серия" && product?.brand === "LENZ") {
    const canonicalSeries = [product.title, variant.name, variant.sku].join(" ").match(/\b(LZ[A-Z0-9-]{2,})\b/iu)?.[1];
    if (canonicalSeries) return canonicalSeries.toLocaleUpperCase("ru-RU");
  }
  return formatParameterValue(parameter);
}

function parameterMatchesFacetKeyword(normalizedName: string, normalizedKeyword: string): boolean {
  if (normalizedKeyword === "посадка хвостовика") return normalizedName === "хвостовик" || normalizedName === "тип хвостовика";
  if (!normalizedName.includes(normalizedKeyword)) return false;
  const disambiguators = ["допуск", "отклонени", "точност", "квалитет", "посадк"];
  return !disambiguators.some((term) => normalizedName.includes(term) && !normalizedKeyword.includes(term));
}

function formatParameterValue(parameter: FeedParameter): string {
  const localizedValue = /^-?\d+(?:\.\d+)?$/.test(parameter.value) ? parameter.value.replace(".", ",") : parameter.value;
  return `${localizedValue}${parameter.unit ? ` ${parameter.unit}` : ""}`.trim();
}

function formatProductParameterValue(product: FeedProduct, parameter: FeedParameter): string {
  const value = formatParameterValue(parameter);
  if (product.category !== "karetki-svarochnye" || normalizeText(parameter.name) !== "положения сварки") return value;
  return formatWeldingPositionLabel(value, true);
}

function formatFacetOptionLabel(slug: string, keyword: string, value: string): string {
  if (slug !== "karetki-svarochnye" || normalizeText(keyword) !== "положения сварки") return value;
  return formatWeldingPositionLabel(value);
}

function formatSelectedFilterValue(slug: string, keyword: string, value: string): string {
  if (slug !== "karetki-svarochnye" || normalizeText(keyword) !== "положения сварки") return value;
  return formatWeldingPositionLabel(value, true);
}

function formatWeldingPositionLabel(value: string, compact = false): string {
  const code = value.match(/\b(PA\/1[GF]|PB\/2F|PC\/2G|PF\/3[GF])\b/iu)?.[1]?.toLocaleUpperCase("ru-RU");
  if (!code) return value;
  const positionLabels: Record<string, string> = {
    "PA/1G":"Нижнее положение, стыковой шов",
    "PA/1F":"Нижнее положение, угловой шов",
    "PB/2F":"Горизонтальное положение, угловой шов",
    "PC/2G":"Горизонтальное положение, стыковой шов",
    "PF/3G":"Вертикальное снизу вверх, стыковой шов",
    "PF/3F":"Вертикальное снизу вверх, угловой шов",
  };
  const productForm = /труб/iu.test(value) ? "Труба — " : "";
  if (compact) return `${productForm}${positionLabels[code].replace(" положение,", ",")} · ${code}`;
  return `${productForm}${positionLabels[code]} · ${code}`;
}

function getProductSearchText(product: FeedProduct): string {
  return normalizeText([
    product.title,
    product.brand,
    product.sku,
    ...product.variants.flatMap((variant) => [variant.name, variant.sku]),
  ].filter(Boolean).join(" "));
}

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/\s+/g, " ");
}

const normalizedParameterNameCache = new Map<string, string>();

function normalizeParameterName(value: string): string {
  const cached = normalizedParameterNameCache.get(value);
  if (cached !== undefined) return cached;
  const normalized = normalizeText(value);
  normalizedParameterNameCache.set(value, normalized);
  return normalized;
}

function compareOptionalPrices(first: number | undefined, second: number | undefined, direction: "asc" | "desc"): number {
  const firstValue = first && first > 0 ? first : undefined;
  const secondValue = second && second > 0 ? second : undefined;
  if (firstValue === undefined && secondValue === undefined) return 0;
  if (firstValue === undefined) return 1;
  if (secondValue === undefined) return -1;
  return direction === "asc" ? firstValue - secondValue : secondValue - firstValue;
}

function getFacetHelp(keyword: string): string {
  if (/диаметр|размер|толщина|длина|поле/i.test(keyword)) return "Выбирайте по размеру заготовки или требуемого результата.";
  if (/мощность|производительность|скорость|частота/i.test(keyword)) return "Сравните рабочую производительность, а не только цену.";
  if (/грузоподъемность|усилие|масса/i.test(keyword)) return "Проверьте значение с запасом под реальную нагрузку.";
  if (/резьба|хвостовик|посад/i.test(keyword)) return "Параметр влияет на совместимость с вашей оснасткой.";
  return "Фильтр построен по характеристикам доступных исполнений.";
}

function getFeedProductSpecs(product: FeedProduct): FeedProductSpec[] {
  const parameters = product.variants.flatMap((variant) => getFeedDecisionParameters(product, variant));
  const names = Array.from(new Set(parameters.map((parameter) => parameter.name).filter((name) => name && !lowValueParameterPattern.test(name))));
  const priorities = getProductSpecPriorities(product);
  const orderedNames: string[] = [];

  for (const priority of priorities) {
    const match = names.find((name) => parameterMatchesFacetKeyword(normalizeText(name), normalizeText(priority)) && !orderedNames.includes(name));
    if (match) orderedNames.push(match);
  }
  for (const name of names) {
    if (!orderedNames.includes(name)) orderedNames.push(name);
  }

  return orderedNames.slice(0, 4).map((name) => ({ label:getFeedParameterLabel(product, name), value:summarizeParameterValues(product, parameters, name) }));
}

export function getFeedVariantSpecs(product: FeedProduct, variant: FeedVariant): FeedProductSpec[] {
  const parameters = getFeedDecisionParameters(product, variant);
  const priorities = getProductSpecPriorities(product);
  const selected: FeedProductSpec[] = [];
  const selectedNames = new Set<string>();

  for (const priority of priorities) {
    const parameter = parameters.find((candidate) => parameterMatchesFacetKeyword(normalizeText(candidate.name), normalizeText(priority)));
    const parameterKey = parameter ? normalizeText(parameter.name) : "";
    if (!parameter || selectedNames.has(parameterKey)) continue;
    selectedNames.add(parameterKey);
    selected.push({ label:getFeedParameterLabel(product, parameter.name), value:formatProductParameterValue(product, parameter) });
    if (selected.length === 6) break;
  }

  return selected;
}

function getProductSpecPriorities(product: FeedProduct): string[] {
  const categoryPriorities = getCategoryFacetKeywords(product.category);
  if (!isMagneticDrillProduct(product)) return [...categoryPriorities, ...product.paramAxes];
  return [
    "макс. диаметр корончатого сверла",
    "макс. диаметр отверстия",
    "шпиндель",
    "рабочий ход",
    "реверс",
    "масса",
    ...categoryPriorities.filter((priority) => !normalizeText(priority).includes("макс. диаметр")),
    ...product.paramAxes,
  ];
}

export function getFeedParameterLabel(product: FeedProduct, label: string): string {
  if (!isMagneticDrillProduct(product)) return label;
  const normalized = normalizeText(label);
  if (normalized.includes("макс. диаметр корончатого сверла")) return "Макс. Ø корончатого сверления";
  if (normalized === "макс. диаметр отверстия") return "Макс. Ø спирального сверления";
  return label;
}

function isMagneticDrillProduct(product: FeedProduct): boolean {
  return product.category === "stanki-sverlilnye" && /магнит|электромагнит/iu.test(product.title);
}

export function getFeedVariantTechnicalSpecs(product: FeedProduct, variant: FeedVariant): FeedProductSpec[] {
  const keySpecs = getFeedVariantSpecs(product, variant);
  const selected = new Map(keySpecs.map((spec) => [normalizeText(spec.label), spec]));

  for (const parameter of getFeedDecisionParameters(product, variant)) {
    if (!parameter.name || !parameter.value || lowValueParameterPattern.test(parameter.name)) continue;
    const displayLabel = getFeedParameterLabel(product, parameter.name);
    const key = normalizeText(displayLabel);
    if (!key || selected.has(key)) continue;
    selected.set(key, { label:displayLabel, value:formatProductParameterValue(product, parameter) });
  }

  return Array.from(selected.values()).slice(0, 16);
}

const summaryNumberFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits:4 });

function summarizeParameterValues(product: FeedProduct, parameters: FeedParameter[], name: string): string {
  const matchingParameters = parameters.filter((parameter) => parameter.name === name);
  const values = Array.from(new Set(matchingParameters.map((parameter) => formatProductParameterValue(product, parameter))));
  if (values.length <= 2) return values.join(" / ");

  const scalarValues = matchingParameters.map((parameter) => ({
    number: Number.parseFloat(parameter.value.trim().replace(",", ".")),
    rawValue:parameter.value.trim(),
    unit:parameter.unit?.trim() ?? "",
  }));
  const units = new Set(scalarValues.map((value) => normalizeText(value.unit)));
  const isComparableNumericSet = units.size === 1
    && scalarValues.every((value) => /^-?\d+(?:[.,]\d+)?$/u.test(value.rawValue) && Number.isFinite(value.number));

  if (isComparableNumericSet) {
    const numbers = Array.from(new Set(scalarValues.map((value) => value.number))).sort((a, b) => a - b);
    if (numbers.length > 2) {
      const unit = scalarValues[0]?.unit;
      return `${formatSummaryNumber(numbers[0])}–${formatSummaryNumber(numbers.at(-1)!)}${unit ? ` ${unit}` : ""} · ${pluralizeSummaryValues(numbers.length)}`;
    }
  }

  return `${values.slice(0, 2).join(" / ")} +${values.length - 2}`;
}

function formatSummaryNumber(value: number): string {
  return summaryNumberFormatter.format(value);
}

function pluralizeSummaryValues(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  const form = mod100 >= 11 && mod100 <= 14 ? "вариантов" : mod10 === 1 ? "вариант" : mod10 >= 2 && mod10 <= 4 ? "варианта" : "вариантов";
  return `${count} ${form}`;
}
