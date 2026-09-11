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

export type FeedProductCardModel = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  sku: string;
  image?: string;
  price: string;
  variantCount: number;
  specs: FeedProductSpec[];
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
  "stanki-sverlilnye": ["макс. диаметр", "диаметр корончат", "мощность", "рабочий ход", "шпиндель", "масса", "реверс"],
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

export function getFeedCategoryProducts(slug: string, limit = 6): FeedProduct[] {
  const products = productsByCategory.get(slug) ?? [];
  return products
    .map((product, sourceOrder) => ({ product, sourceOrder, score: scoreFeedProduct(product, slug) }))
    .filter(({ product }) => Boolean(getFeedProductImage(product)))
    .sort((a, b) => b.score - a.score || a.sourceOrder - b.sourceOrder)
    .slice(0, limit)
    .map(({ product }) => product);
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
  if (to && to !== from) return `${from}–${to}`;
  return from;
}

export function toFeedProductCardModel(product: FeedProduct): FeedProductCardModel {
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    brand: product.brand,
    sku: product.sku,
    image: getFeedProductImage(product),
    price: getFeedProductPriceLabel(product),
    variantCount: product.variants.length,
    specs: getFeedProductSpecs(product),
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

function summarizeParameterValues(parameters: FeedParameter[], name: string): string {
  const values = Array.from(new Set(parameters.filter((parameter) => parameter.name === name).map((parameter) => `${parameter.value}${parameter.unit ? ` ${parameter.unit}` : ""}`)));
  if (values.length <= 2) return values.join(" / ");
  return `${values.slice(0, 2).join(" / ")} +${values.length - 2}`;
}
