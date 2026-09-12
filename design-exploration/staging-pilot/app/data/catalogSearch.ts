import feedSnapshotJson from "../../../../7tool-source/src/lib/products.json";
import { formatFeedPrice, getFeedProductImage, toFeedProductCardModel, type FeedProduct, type FeedVariant } from "./feedCatalog";
import { getProductionCategoryGroups, pilotFeedCategorySlugs } from "./productionCategoryGroups";
import { normalizeCatalogQuery, rankCatalogItems } from "./catalogSearchEngine.mjs";
import type { CatalogSearchHit, CatalogSearchResponse } from "./catalogSearchTypes";

type FeedSnapshot = { categories: Array<{ slug: string; title: string; count: number; published: boolean }>; products: FeedProduct[] };
type SearchIndexItem<T> = { title: string; searchText: string; normalizedTitle: string; normalizedSearchText: string; identifiers?: string[]; normalizedIdentifiers?: string[]; available?: boolean; data: T };

const feedSnapshot = feedSnapshotJson as unknown as FeedSnapshot;
const publishedCategories = new Map(feedSnapshot.categories.filter((category) => category.published).map((category) => [category.slug, category]));
const categoryProducts = new Map<string, number>();
for (const product of feedSnapshot.products) categoryProducts.set(product.category, (categoryProducts.get(product.category) ?? 0) + 1);

const productIndex: Array<SearchIndexItem<FeedProduct>> = feedSnapshot.products
  .filter((product) => publishedCategories.has(product.category))
  .map((product) => makeSearchIndexItem({
    title:product.title,
    identifiers:[product.sku, ...product.variants.map((variant) => variant.sku)].filter(Boolean),
    available:product.stock > 0,
    searchText:[product.title, product.brand, product.sku, publishedCategories.get(product.category)?.title, ...product.variants.flatMap((variant) => [variant.name, variant.sku, ...variant.params.flatMap((parameter) => [parameter.name, parameter.value])])].filter(Boolean).join(" "),
    data:product,
  }));

const taskAliases: Record<string, string> = {
  drilling:"сверлить отверстие нарезать резьбу монтаж магнитный станок сверло метчик",
  edge:"снять фаску обработать кромку лист труба зачистить борфреза",
  cutting:"резать металл трубу профиль лист пила труборез",
  welding:"сварить шов автоматизировать сварку каретка робот позиционер вращатель",
  tooling:"подобрать оснастку расходник сверло метчик диск совместимость",
  workplace:"оснастить производство участок перемещать груз компрессор верстак",
};

const groups = getProductionCategoryGroups(pilotFeedCategorySlugs);
const taskIndex = groups.map((group) => makeSearchIndexItem({
  title:group.title,
  searchText:[group.title, group.accent, taskAliases[group.slug], ...group.subcategories.map((subcategory) => subcategory.label)].join(" "),
  data:group,
}));
const categoryIndex = groups.flatMap((group) => group.subcategories.map((subcategory) => {
  const category = publishedCategories.get(subcategory.slug);
  return makeSearchIndexItem({
    title:subcategory.label,
    searchText:[subcategory.label, category?.title, group.title, group.accent, taskAliases[group.slug]].filter(Boolean).join(" "),
    data:{ ...subcategory, group, count:categoryProducts.get(subcategory.slug) ?? category?.count ?? 0 },
  });
}));

export function searchCatalog(query: string, limits: { products?: number; categories?: number; tasks?: number } = {}): CatalogSearchResponse {
  const cleanQuery = query.trim().slice(0, 120);
  const normalized = normalizeCatalogQuery(cleanQuery);
  const productMatches = rankCatalogItems(productIndex, cleanQuery, limits.products ?? 6) as Array<SearchIndexItem<FeedProduct>>;
  const categoryMatches = rankCatalogItems(categoryIndex, cleanQuery, limits.categories ?? 3) as typeof categoryIndex;
  const taskMatches = rankCatalogItems(taskIndex, cleanQuery, limits.tasks ?? 2) as typeof taskIndex;

  return {
    query:cleanQuery,
    interpretation:interpretQuery(normalized),
    products:productMatches.map(({ data }) => toProductHit(data, normalized)),
    categories:categoryMatches.map(({ data }) => ({
      id:`category:${data.slug}`,
      kind:"category",
      eyebrow:data.group.title,
      title:data.label,
      meta:`${data.count} ${pluralizeProducts(data.count)} в категории`,
      href:data.href,
      image:data.group.image,
    })),
    tasks:taskMatches.map(({ data }) => ({
      id:`task:${data.slug}`,
      kind:"task",
      eyebrow:"По производственной задаче",
      title:data.title,
      meta:`${data.accent} · ${data.subcategories.length} ${pluralizeSections(data.subcategories.length)}`,
      href:data.href,
      image:data.image,
    })),
  };
}

function toProductHit(product: FeedProduct, normalizedQuery: string): CatalogSearchHit {
  const exactVariant = product.variants.find((variant) => normalizeCatalogQuery(variant.sku) === normalizedQuery);
  const chosenVariant = exactVariant ?? (product.variants.length === 1 ? product.variants[0] : undefined);
  const card = toFeedProductCardModel(product);
  const href = `/product/${product.slug}${exactVariant ? `?variant=${encodeURIComponent(exactVariant.id)}` : ""}`;
  const title = exactVariant?.name || product.title;
  return {
    id:`product:${product.id}:${exactVariant?.id ?? "group"}`,
    kind:"product",
    eyebrow:exactVariant ? `Точное исполнение · ${product.brand}` : `${product.brand} · ${product.variants.length} ${pluralizeVariants(product.variants.length)}`,
    title,
    meta:exactVariant ? `Артикул ${exactVariant.sku}` : product.sku ? `Серия ${product.sku}` : publishedCategories.get(product.category)?.title ?? "Товар каталога",
    href,
    image:getFeedProductImage(product),
    price:exactVariant ? formatFeedPrice(exactVariant.price) ?? "Цена по запросу" : card.price,
    availability:getAvailability(product, exactVariant),
    specs:(exactVariant ? exactVariant.params.filter((parameter) => !/^(бренд|производитель|страна|артикул|штрихкод|серия)$/i.test(parameter.name)).slice(0, 3).map((parameter) => `${parameter.name}: ${parameter.value}${parameter.unit ? ` ${parameter.unit}` : ""}`) : card.specs.slice(0, 3).map((spec) => `${spec.label}: ${spec.value}`)),
    requestItem:chosenVariant ? toRequestItem(product, chosenVariant, href) : undefined,
  };
}

function toRequestItem(product: FeedProduct, variant: FeedVariant, href: string) {
  return {
    id:`variant:${variant.id}`,
    title:variant.name || product.title,
    article:`Артикул ${variant.sku}`,
    price:formatFeedPrice(variant.price),
    image:getFeedProductImage(product),
    href,
  };
}

function getAvailability(product: FeedProduct, variant?: FeedVariant): string {
  if (variant) return variant.available && (variant.quantity ?? 0) > 0 ? "В наличии по данным поставщика" : "Наличие уточняем";
  return product.stock > 0 ? "Есть исполнения в наличии" : "Наличие уточняем";
}

function interpretQuery(normalized: string): string {
  if (/\d/.test(normalized) && /[a-zа-я]/i.test(normalized)) return "модель или артикул";
  if (/сверл|резьб|фаск|кромк|резк|свар|шлиф|груз|оснаст/.test(normalized)) return "производственная задача";
  return "товар, категория или задача";
}

function pluralizeProducts(count: number): string {
  const modulo100 = count % 100;
  const modulo10 = count % 10;
  if (modulo100 >= 11 && modulo100 <= 14) return "товаров";
  if (modulo10 === 1) return "товар";
  if (modulo10 >= 2 && modulo10 <= 4) return "товара";
  return "товаров";
}

function pluralizeVariants(count: number): string {
  const modulo100 = count % 100;
  const modulo10 = count % 10;
  if (modulo100 >= 11 && modulo100 <= 14) return "исполнений";
  if (modulo10 === 1) return "исполнение";
  if (modulo10 >= 2 && modulo10 <= 4) return "исполнения";
  return "исполнений";
}

function pluralizeSections(count: number): string {
  const modulo100 = count % 100;
  const modulo10 = count % 10;
  if (modulo100 >= 11 && modulo100 <= 14) return "разделов";
  if (modulo10 === 1) return "раздел";
  if (modulo10 >= 2 && modulo10 <= 4) return "раздела";
  return "разделов";
}

function makeSearchIndexItem<T>({ title, searchText, identifiers, available, data }: { title: string; searchText: string; identifiers?: string[]; available?: boolean; data: T }): SearchIndexItem<T> {
  return {
    title,
    searchText,
    normalizedTitle:normalizeCatalogQuery(title),
    normalizedSearchText:normalizeCatalogQuery(searchText),
    identifiers,
    normalizedIdentifiers:identifiers?.map((identifier) => normalizeCatalogQuery(identifier)),
    available,
    data,
  };
}
