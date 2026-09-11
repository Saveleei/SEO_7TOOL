import feedSnapshotJson from "../../../../7tool-source/src/lib/products.json";

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
};

export type FeedVariantFilter = {
  keyword: string;
  values: string[];
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

const feedSnapshot = feedSnapshotJson as unknown as FeedSnapshot;

const categoriesBySlug = new Map(
  feedSnapshot.categories
    .filter((category) => category.published)
    .map((category) => [category.slug, category]),
);

const productsByCategory = new Map<string, FeedProduct[]>();
const productsBySlug = new Map<string, FeedProduct>();

const categorySpecPriorities: Record<string, string[]> = {
  "stanki-sverlilnye": ["макс. диаметр", "шпиндель", "рабочий ход", "реверс", "мощность", "масса"],
  "koronchatye-sverla": ["диаметр", "рабочая длина", "хвостовик", "материал", "тип сверла"],
  "kromkorezy-po-listu": ["ширина фаски", "угол фаски", "толщина", "привод", "масса"],
  "kromkorezy-dlya-trub": ["диаметр труб", "толщина стенки", "способ крепления", "возможности", "привод"],
  "rezbonareznye-manipulyatory": ["диапазон резьбы", "рабочий радиус", "привод", "частота вращения", "масса"],
  borfrezy: ["диаметр режущей", "длина режущей", "диаметр хвостовика", "форма", "тип насечки"],
  truborezy: ["диапазон труб", "толщина стенки", "привод", "масса"],
  "karetki-svarochnye": ["положения сварки", "скорость", "движение каретки", "грузоподъемность", "масса"],
  "pilnye-diski": ["диаметр диска", "ширина пропила", "посадочное отверстие", "число зубьев", "материал"],
  "karetki-termicheskoy-rezki": ["назначение", "тип резки", "количество резаков", "скорость", "толщина"],
  metchiki: ["резьба", "диаметр хвостовика", "общая длина", "рабочая длина", "материал"],
  "lentochnopilnye-stanki": ["макс. размер", "диаметр", "мощность", "скорость", "масса"],
  "shlifovalnoe-i-zatochnoe-oborudovanie": ["мощность", "диаметр", "частота вращения", "напряжение", "масса"],
  "magnitnaya-osnastka": ["грузоподъемность", "усилие", "размер", "масса"],
  "almaznoe-burenie": ["диаметр", "рабочая длина", "мощность", "хвостовик"],
  "svarochnye-vrashchateli-i-pozitsionery": ["грузоподъемность", "диаметр", "скорость", "угол наклона", "масса"],
  "zahvaty-dlya-gruzov": ["грузоподъемность", "толщина материала", "масса", "высота"],
  "sozh-i-sots": ["объем", "концентрация", "назначение", "тип"],
  "disko-otreznye-stanki": ["диаметр диска", "мощность", "макс. размер", "частота вращения", "масса"],
  kompressory: ["производительность", "объем ресивера", "мощность", "параметры питания", "тип смазки"],
  "sverla-i-zenkovki": ["диаметр режущей", "общая длина", "диаметр зенкования", "диаметр хвостовика", "материал"],
  "stanki-lazernoy-rezki": ["мощность", "рабочее поле", "толщина", "точность", "скорость"],
  "svarochnye-roboty": ["грузоподъемность", "радиус", "количество осей", "точность", "масса"],
  "stanochnaya-osnastka": ["тип", "размер", "посадка", "диаметр", "масса"],
};

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
  "stanochnaya-osnastka",
  "sverla-i-zenkovki",
]);

for (const product of feedSnapshot.products) {
  if (!categoriesBySlug.has(product.category)) continue;
  productsBySlug.set(product.slug, product);
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
    return productMatchesFacetFilters(product, facets, query.filters ?? {}, query.availability === "in-stock");
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
      matchesSelection: hasVariantSelection && (activeFilters.length === 0 || activeFilters.every((filter) =>
        getVariantParameterValues(variant, filter.keyword).some((value) => filter.values.includes(value)),
      )) && (!preferAvailable || isConfirmedAvailableVariant(variant)),
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
    .filter(({ product }) => Boolean(getFeedProductImage(product)))
    .sort((a, b) => b.score - a.score || a.sourceOrder - b.sourceOrder)
    .map(({ product }) => product);
}

function getCategoryFacets(slug: string, products: FeedProduct[], selectedFilters: Record<string, string[]>): FeedFacet[] {
  const facets: FeedFacet[] = [];
  const brands = countProductValues(products, (product) => product.brand ? [product.brand] : []);
  if (brands.size > 1) {
    facets.push({
      key: "brand",
      label: "Производитель",
      help: "Оставьте несколько брендов, если готовы сравнить аналоги.",
      options: toFacetOptions(brands, selectedFilters.brand),
    });
  }

  const usedParameterNames = new Set<string>();
  const technicalFacetLimit = slug === "borfrezy" ? 4 : 3;
  for (const keyword of categorySpecPriorities[slug] ?? []) {
    if (facets.filter((facet) => facet.keyword).length >= technicalFacetLimit) break;
    const matchingNames = getMatchingParameterNames(products, keyword);
    if (matchingNames.length === 0 || matchingNames.some((name) => usedParameterNames.has(normalizeText(name)))) continue;

    const values = countProductValues(products, (product) => getProductParameterValues(product, keyword));
    if (values.size < 2) continue;

    const key = `spec${facets.filter((facet) => facet.keyword).length + 1}`;
    matchingNames.forEach((name) => usedParameterNames.add(normalizeText(name)));
    facets.push({
      key,
      label: matchingNames[0],
      help: getFacetHelp(keyword),
      keyword,
      options: toFacetOptions(values, selectedFilters[key], keyword === "форма" ? 100 : 10, keyword === "форма"),
    });
  }

  return facets;
}

function isConfirmedAvailableVariant(variant: FeedVariant): boolean {
  return variant.available && typeof variant.quantity === "number" && variant.quantity > 0;
}

function getMatchingParameterNames(products: FeedProduct[], keyword: string): string[] {
  const counts = new Map<string, number>();
  for (const product of products) {
    const names = new Set(product.variants.flatMap((variant) => variant.params ?? [])
      .map((parameter) => parameter.name)
      .filter((name) => normalizeText(name).includes(normalizeText(keyword))));
    for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru-RU")).map(([name]) => name);
}

function countProductValues(products: FeedProduct[], getValues: (product: FeedProduct) => string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const product of products) {
    for (const value of new Set(getValues(product).filter(Boolean))) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function toFacetOptions(counts: Map<string, number>, selectedValues: string[] = [], limit = 10, sortByValue = false): FeedFacetOption[] {
  const ranked = Array.from(counts.entries())
    .sort((a, b) => sortByValue ? compareFacetValues(a[0], b[0]) : b[1] - a[1] || a[0].localeCompare(b[0], "ru-RU"));
  const visible = ranked.slice(0, limit);
  for (const selected of selectedValues) {
    const entry = ranked.find(([value]) => value === selected);
    if (entry && !visible.some(([value]) => value === selected)) visible.push(entry);
  }
  return visible.map(([value, count]) => ({ value, label:value, count }));
}

function compareFacetValues(first: string, second: string): number {
  const rank = (value: string) => /^[A-ZА-Я]$/i.test(value) ? 0 : /^[A-ZА-Я][+\-]?$/i.test(value) ? 1 : 2;
  return rank(first) - rank(second) || first.localeCompare(second, "ru-RU", { numeric:true });
}

function productMatchesFacetFilters(product: FeedProduct, facets: FeedFacet[], filters: Record<string, string[]>, requireAvailable = false): boolean {
  const selectedBrands = filters.brand?.filter(Boolean) ?? [];
  if (selectedBrands.length > 0 && !selectedBrands.includes(product.brand)) return false;

  const technicalFacets = facets.filter((facet) => facet.keyword && (filters[facet.key]?.length ?? 0) > 0);
  if (technicalFacets.length === 0) return !requireAvailable || product.variants.some(isConfirmedAvailableVariant);

  return product.variants.some((variant) => (!requireAvailable || isConfirmedAvailableVariant(variant)) && technicalFacets.every((facet) => {
    const selected = filters[facet.key] ?? [];
    return getVariantParameterValues(variant, facet.keyword ?? "").some((value) => selected.includes(value));
  }));
}

function getProductParameterValues(product: FeedProduct, keyword: string): string[] {
  return product.variants.flatMap((variant) => getVariantParameterValues(variant, keyword));
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
  return "Фильтр построен по характеристикам исполнений из фида.";
}

function getFeedProductSpecs(product: FeedProduct): FeedProductSpec[] {
  const parameters = product.variants.flatMap((variant) => variant.params ?? []);
  const names = Array.from(new Set(parameters.map((parameter) => parameter.name).filter((name) => name && !lowValueParameterPattern.test(name))));
  const priorities = [...(categorySpecPriorities[product.category] ?? []), ...product.paramAxes];
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

function getFeedVariantSpecs(product: FeedProduct, variant: FeedVariant): FeedProductSpec[] {
  const parameters = variant.params ?? [];
  const priorities = [...(categorySpecPriorities[product.category] ?? []), ...product.paramAxes];
  const selected: FeedProductSpec[] = [];

  for (const priority of priorities) {
    const parameter = parameters.find((candidate) => normalizeText(candidate.name).includes(normalizeText(priority)));
    if (!parameter || selected.some((spec) => spec.label === parameter.name)) continue;
    selected.push({ label:parameter.name, value:formatParameterValue(parameter) });
    if (selected.length === 6) break;
  }

  return selected;
}

function summarizeParameterValues(parameters: FeedParameter[], name: string): string {
  const values = Array.from(new Set(parameters.filter((parameter) => parameter.name === name).map(formatParameterValue)));
  if (values.length <= 2) return values.join(" / ");
  return `${values.slice(0, 2).join(" / ")} +${values.length - 2}`;
}
