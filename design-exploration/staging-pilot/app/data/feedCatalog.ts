import feedSnapshotJson from "../../../../7tool-source/src/lib/products.json" with { type:"json" };
import { getCategoryCardArchetype } from "./categoryCardArchetypes.mjs";
import { getCategoryExpertProfile, getCategoryFacetKeywords } from "./categoryExpertProfiles.mjs";
import { selectCompatibleAccessories, selectProductAlternatives } from "./productRecommendations.mjs";

export type FeedParameter = {
  name: string;
  value: string;
  unit?: string;
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

export type FeedAccessoryRecommendation = {
  product: FeedProduct;
  variant: FeedVariant;
  diameter: number;
  spindle: string;
  workingLength: string;
};

export type FeedProductAlternative = {
  product: FeedProduct;
  variant: FeedVariant;
  diameter: number;
  spindle: string;
  reverse: string;
  mass: string;
  reason: string;
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

export type FeedProductVariantModel = {
  id: string;
  sku: string;
  title: string;
  price: string;
  specs: FeedProductSpec[];
  matchesSelection: boolean;
  available: boolean;
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
  specs: FeedProductSpec[];
  variants: FeedProductVariantModel[];
  matchReasons: string[];
  decisionPrompts: string[];
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
  options: FeedFacetOption[];
};

export type FeedCategorySort = "relevance" | "price-asc" | "price-desc" | "name";

export type FeedCategoryQuery = {
  search?: string;
  sort?: FeedCategorySort;
  page?: number;
  pageSize?: number;
  filters?: Record<string, string[]>;
  numericMinimums?: Record<string, number>;
  availability?: "in-stock";
};

export type FeedCategoryPage = {
  products: FeedProduct[];
  facets: FeedFacet[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

type FeedSnapshot = {
  categories: FeedCategory[];
  products: FeedProduct[];
};

type CachedFeedFacet = Omit<FeedFacet, "options"> & {
  allOptions: FeedFacetOption[];
  optionLimit: number;
};

const feedSnapshot = feedSnapshotJson as unknown as FeedSnapshot;

const categoriesBySlug = new Map(
  feedSnapshot.categories
    .filter((category) => category.published)
    .map((category) => [category.slug, category]),
);

const productsByCategory = new Map<string, FeedProduct[]>();
const productsBySlug = new Map<string, FeedProduct>();
const variantsById = new Map<string, { product: FeedProduct; variant: FeedVariant }>();
const categoryFacetCache = new Map<string, CachedFeedFacet[]>();

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

export function prefersDenseFeedTable(slug: string): boolean {
  return denseTableCategorySlugs.has(slug);
}

export function getFeedCategoryProducts(slug: string, limit = 6): FeedProduct[] {
  const products = productsByCategory.get(slug) ?? [];
  return products
    .map((product, sourceOrder) => ({ product, sourceOrder, score: scoreFeedProduct(product, slug) }))
    .filter(({ product }) => Boolean(getFeedProductImage(product)))
    .sort((a, b) => b.score - a.score || a.sourceOrder - b.sourceOrder)
    .slice(0, limit)
    .map(({ product }) => product);
}

export function getFeedCategoryPage(slug: string, query: FeedCategoryQuery = {}): FeedCategoryPage {
  const pageSize = Math.min(48, Math.max(6, query.pageSize ?? 12));
  const allProducts = getRankedCategoryProducts(slug);
  const facets = getCategoryFacets(slug, allProducts, query.filters ?? {});
  const normalizedSearch = query.search?.trim().toLocaleLowerCase("ru-RU") ?? "";
  const filteredProducts = allProducts.filter((product) => {
    if (normalizedSearch && !getProductSearchText(product).includes(normalizedSearch)) return false;
    return productMatchesFacetFilters(product, facets, query.filters ?? {}, query.numericMinimums ?? {}, query.availability === "in-stock");
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

export function getFeedCategoryProductCount(slug: string): number {
  return productsByCategory.get(slug)?.length ?? 0;
}

export function getFeedProductBySlug(slug: string): FeedProduct | undefined {
  return productsBySlug.get(slug);
}

export function getFeedProductVariantById(id: string): { product: FeedProduct; variant: FeedVariant } | undefined {
  return variantsById.get(id);
}

export function getFeedAccessoryRecommendations(product: FeedProduct, limit = 3): FeedAccessoryRecommendation[] {
  return selectCompatibleAccessories(Array.from(productsBySlug.values()), product, limit) as FeedAccessoryRecommendation[];
}

export function getFeedProductAlternatives(product: FeedProduct, limit = 3): FeedProductAlternative[] {
  return selectProductAlternatives(Array.from(productsBySlug.values()), product, limit) as FeedProductAlternative[];
}

export function getFeedProductImage(product: FeedProduct): string | undefined {
  return product.images.find(Boolean) ?? product.variants.find((variant) => variant.images?.some(Boolean))?.images?.find(Boolean);
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

export function toFeedProductCardModel(product: FeedProduct, activeFilters: FeedVariantFilter[] = [], preferAvailable = false): FeedProductCardModel {
  const hasVariantSelection = activeFilters.length > 0 || preferAvailable;
  const selectedVariants = product.variants
    .map((variant, sourceOrder) => ({
      variant,
      sourceOrder,
      matchesSelection: hasVariantSelection && (activeFilters.length === 0 || activeFilters.every((filter) => {
        const values = getVariantParameterValues(variant, filter.keyword);
        return Number.isFinite(filter.minimum)
          ? values.some((value) => parseNumericValue(value) >= (filter.minimum ?? Number.POSITIVE_INFINITY))
          : values.some((value) => filter.values.includes(value));
      })) && (!preferAvailable || isConfirmedAvailableVariant(variant)),
    }))
    .filter(({ matchesSelection }) => !hasVariantSelection || matchesSelection)
    .sort((first, second) => Number(second.matchesSelection) - Number(first.matchesSelection) || first.sourceOrder - second.sourceOrder);
  const variants = selectedVariants
    .slice(0, 12)
    .map(({ variant, matchesSelection }) => ({
      id: variant.id,
      sku: variant.sku,
      title: variant.name ?? variant.sku,
      price: formatFeedPrice(variant.price) ?? "Цена по запросу",
      specs: getFeedVariantSpecs(product, variant),
      matchesSelection,
      available: isConfirmedAvailableVariant(variant),
    }));

  return {
    id: product.id,
    categorySlug: product.category,
    slug: product.slug,
    title: product.title,
    brand: product.brand,
    sku: product.sku,
    image: getFeedProductImage(product),
    price: getFeedProductPriceLabel(product),
    variantCount: product.variants.length,
    selectedVariantCount: selectedVariants.length,
    availableVariantCount: product.variants.filter(isConfirmedAvailableVariant).length,
    specs: getFeedProductSpecs(product),
    variants,
    matchReasons:activeFilters.flatMap((filter) => Number.isFinite(filter.minimum)
      ? [`${filter.label ?? filter.keyword}: от ${filter.minimum}`]
      : filter.values.map((value) => `${filter.label ?? filter.keyword}: ${value}`)).slice(0, 4),
    decisionPrompts:getCategoryExpertProfile(product.category).criteria.map((item) => item.title).slice(0, 3),
    cardArchetype:getCategoryCardArchetype(product.category),
  };
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
  return (productsByCategory.get(slug) ?? [])
    .map((product, sourceOrder) => ({ product, sourceOrder, score: scoreFeedProduct(product, slug) }))
    .sort((a, b) => b.score - a.score || a.sourceOrder - b.sourceOrder)
    .map(({ product }) => product);
}

function getCategoryFacets(slug: string, products: FeedProduct[], selectedFilters: Record<string, string[]>): FeedFacet[] {
  let cachedFacets = categoryFacetCache.get(slug);
  if (!cachedFacets) {
    cachedFacets = buildCategoryFacets(slug, products);
    categoryFacetCache.set(slug, cachedFacets);
  }
  return cachedFacets.map(({ allOptions, optionLimit, ...facet }) => ({
    ...facet,
    options:selectFacetOptions(allOptions, selectedFilters[facet.key], optionLimit),
  }));
}

function buildCategoryFacets(slug: string, products: FeedProduct[]): CachedFeedFacet[] {
  const facets: CachedFeedFacet[] = [];
  const categoryFacetKeywords = getCategoryFacetKeywords(slug);
  const { brands, parameters } = analyzeCategoryFacets(products, categoryFacetKeywords);
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
  const technicalFacetLimit = Math.min(5, categoryFacetKeywords.length);
  for (const { keyword, names, values } of parameters) {
    if (facets.filter((facet) => facet.keyword).length >= technicalFacetLimit) break;
    const matchingNames = Array.from(names.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru-RU")).map(([name]) => name);
    if (matchingNames.length === 0 || matchingNames.some((name) => usedParameterNames.has(normalizeText(name)))) continue;
    if (values.size < 2) continue;

    const key = `spec${facets.filter((facet) => facet.keyword).length + 1}`;
    matchingNames.forEach((name) => usedParameterNames.add(normalizeText(name)));
    facets.push({
      key,
      label: matchingNames[0],
      help: getFacetHelp(keyword),
      keyword,
      allOptions: toFacetOptions(values, keyword === "форма"),
      optionLimit:keyword === "форма" ? 100 : 10,
    });
  }

  return facets;
}

function analyzeCategoryFacets(products: FeedProduct[], keywords: string[]) {
  const brands = new Map<string, number>();
  const parameters = keywords.map((keyword) => ({ keyword, normalizedKeyword:normalizeText(keyword), names:new Map<string, number>(), values:new Map<string, number>() }));

  for (const product of products) {
    if (product.brand) brands.set(product.brand, (brands.get(product.brand) ?? 0) + 1);
    const productNames = parameters.map(() => new Set<string>());
    const productValues = parameters.map(() => new Set<string>());

    for (const variant of product.variants) {
      for (const parameter of variant.params ?? []) {
        const normalizedName = normalizeText(parameter.name);
        parameters.forEach((analysis, index) => {
          if (!normalizedName.includes(analysis.normalizedKeyword)) return;
          productNames[index].add(parameter.name);
          const value = formatParameterValue(parameter);
          if (value) productValues[index].add(value);
        });
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
  return variant.available && typeof variant.quantity === "number" && variant.quantity > 0;
}

function toFacetOptions(counts: Map<string, number>, sortByValue = false): FeedFacetOption[] {
  const ranked = Array.from(counts.entries())
    .sort((a, b) => sortByValue ? compareFacetValues(a[0], b[0]) : b[1] - a[1] || a[0].localeCompare(b[0], "ru-RU"));
  return ranked.map(([value, count]) => ({ value, label:value, count }));
}

function selectFacetOptions(allOptions: FeedFacetOption[], selectedValues: string[] = [], limit = 10): FeedFacetOption[] {
  const visible = allOptions.slice(0, limit);
  for (const selected of selectedValues) {
    const entry = allOptions.find((option) => option.value === selected);
    if (entry && !visible.some((option) => option.value === selected)) visible.push(entry);
  }
  return visible;
}

function compareFacetValues(first: string, second: string): number {
  const rank = (value: string) => /^[A-ZА-Я]$/i.test(value) ? 0 : /^[A-ZА-Я][+\-]?$/i.test(value) ? 1 : 2;
  return rank(first) - rank(second) || first.localeCompare(second, "ru-RU", { numeric:true });
}

function productMatchesFacetFilters(product: FeedProduct, facets: FeedFacet[], filters: Record<string, string[]>, numericMinimums: Record<string, number>, requireAvailable = false): boolean {
  const selectedBrands = filters.brand?.filter(Boolean) ?? [];
  if (selectedBrands.length > 0 && !selectedBrands.includes(product.brand)) return false;

  const technicalFacets = facets.filter((facet) => facet.keyword && (filters[facet.key]?.length ?? 0) > 0);
  const minimumFacets = facets.filter((facet) => facet.keyword && Number.isFinite(numericMinimums[facet.key]));
  if (technicalFacets.length === 0 && minimumFacets.length === 0) return !requireAvailable || product.variants.some(isConfirmedAvailableVariant);

  return product.variants.some((variant) => (!requireAvailable || isConfirmedAvailableVariant(variant)) && technicalFacets.every((facet) => {
    const selected = filters[facet.key] ?? [];
    return getVariantParameterValues(variant, facet.keyword ?? "").some((value) => selected.includes(value));
  }) && minimumFacets.every((facet) => getVariantParameterValues(variant, facet.keyword ?? "").some((value) => parseNumericValue(value) >= numericMinimums[facet.key])));
}

function parseNumericValue(value: string): number {
  const match = value.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  const parsed = Number.parseFloat(match?.[0] ?? "");
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function getVariantParameterValues(variant: FeedVariant, keyword: string): string[] {
  return (variant.params ?? [])
    .filter((parameter) => normalizeText(parameter.name).includes(normalizeText(keyword)))
    .map(formatParameterValue);
}

function formatParameterValue(parameter: FeedParameter): string {
  const localizedValue = /^-?\d+(?:\.\d+)?$/.test(parameter.value) ? parameter.value.replace(".", ",") : parameter.value;
  return `${localizedValue}${parameter.unit ? ` ${parameter.unit}` : ""}`.trim();
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
  return value.trim().toLocaleLowerCase("ru-RU").replace(/\s+/g, " ");
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
  const parameters = product.variants.flatMap((variant) => variant.params ?? []);
  const names = Array.from(new Set(parameters.map((parameter) => parameter.name).filter((name) => name && !lowValueParameterPattern.test(name))));
  const priorities = [...getCategoryFacetKeywords(product.category), ...product.paramAxes];
  const orderedNames: string[] = [];

  for (const priority of priorities) {
    const match = names.find((name) => name.toLocaleLowerCase("ru-RU").includes(priority.toLocaleLowerCase("ru-RU")) && !orderedNames.includes(name));
    if (match) orderedNames.push(match);
  }
  for (const name of names) {
    if (!orderedNames.includes(name)) orderedNames.push(name);
  }

  return orderedNames.slice(0, 4).map((name) => ({ label:name, value:summarizeParameterValues(parameters, name) }));
}

export function getFeedVariantSpecs(product: FeedProduct, variant: FeedVariant): FeedProductSpec[] {
  const parameters = variant.params ?? [];
  const priorities = [...getCategoryFacetKeywords(product.category), ...product.paramAxes];
  const selected: FeedProductSpec[] = [];

  for (const priority of priorities) {
    const parameter = parameters.find((candidate) => normalizeText(candidate.name).includes(normalizeText(priority)));
    if (!parameter || selected.some((spec) => spec.label === parameter.name)) continue;
    selected.push({ label:parameter.name, value:formatParameterValue(parameter) });
    if (selected.length === 6) break;
  }

  return selected;
}

export function getFeedVariantTechnicalSpecs(product: FeedProduct, variant: FeedVariant): FeedProductSpec[] {
  const keySpecs = getFeedVariantSpecs(product, variant);
  const selected = new Map(keySpecs.map((spec) => [normalizeText(spec.label), spec]));

  for (const parameter of variant.params ?? []) {
    if (!parameter.name || !parameter.value || lowValueParameterPattern.test(parameter.name)) continue;
    const key = normalizeText(parameter.name);
    if (!key || selected.has(key)) continue;
    selected.set(key, { label:parameter.name, value:formatParameterValue(parameter) });
  }

  return Array.from(selected.values()).slice(0, 16);
}

function summarizeParameterValues(parameters: FeedParameter[], name: string): string {
  const values = Array.from(new Set(parameters.filter((parameter) => parameter.name === name).map(formatParameterValue)));
  if (values.length <= 2) return values.join(" / ");
  return `${values.slice(0, 2).join(" / ")} +${values.length - 2}`;
}
