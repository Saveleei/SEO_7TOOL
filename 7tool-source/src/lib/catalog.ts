export type CategoryIcon =
  | "drill" | "cutter" | "edge" | "grinder" | "saw" | "pipe"
  | "weldAuto" | "thermal" | "weld" | "robot" | "lift"
  | "pneumatic" | "electric" | "fixture";

export type Category = {
  slug: string;
  title: string;
  icon: CategoryIcon;
  count: number;
  subtitle?: string;
  ctaText?: string;
  coverImage?: string;
  imageAlt?: string;
  h1?: string;
  intro?: string;
  seoText?: string;
  metaTitle?: string;
  metaDescription?: string;
  published?: boolean;
  sortOrder?: number;
};

export type ProductParam = { name: string; value: string; unit?: string };

/**
 * K2 adds an internal namespace to some feed parameter names. It is useful to
 * the source system, but must never leak into filters, selectors or product
 * specifications shown to a buyer.
 */
export function cleanParamName(name: string): string {
  const original = (name ?? "").trim();
  const cleaned = original.replace(/^(?:k2[\s_.:/-]*)+/i, "").trim();
  return cleaned || original;
}

export type Variant = {
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

export type Product = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  sku: string;
  category: string;
  /** Исходная категория дилерского фида для устойчивых предметных подборок. */
  feedCategoryId?: string;
  icon: CategoryIcon;
  description?: string;
  /** Сгенерированные и проверенные SEO-поля. Не зависят от цены и остатка. */
  metaTitle?: string;
  metaDescription?: string;
  seoText?: string;
  seoFingerprint?: string;
  seoSource?: string;
  seoGeneratedAt?: number;
  images: string[];
  accessories: string[];
  isGroup: boolean;
  variants: Variant[];
  stock: number;
  paramAxes: string[];
  priceFrom?: number;
  priceTo?: number;
  discountPct?: number;
  /** Ручная позиция внутри категории. Не принадлежит фиду и не перезаписывается им. */
  manualSortOrder?: number;
  draft?: boolean;
  listingVariantCount?: number;
  listingVariantSkus?: string[];
  listingParams?: ProductParam[];
  listingAvailabilityStatus?: AvailabilityStatus;
  listingAvailabilityLabel?: string;
  listingAvailabilityPriority?: number;
  listingHasValidPrice?: boolean;
};

export type AvailabilityStatus =
  | "in_stock"
  | "partial"
  | "order"
  | "unavailable"
  | "unknown";

export type ProductAvailability = {
  status: AvailabilityStatus;
  priority: number;
  label: string;
  availableVariants: Variant[];
  orderableVariants: Variant[];
  minPrice?: number;
  maxPrice?: number;
  hasValidPrice: boolean;
};

export function isValidPrice(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isVariantInStock(variant: Variant): boolean {
  return variant.available && (variant.quantity ?? 0) > 0;
}

export function isVariantOrderable(variant: Variant): boolean {
  return variant.available;
}

export function getProductAvailability(product: Pick<Product, "variants" | "stock">): ProductAvailability {
  const variants = product.variants ?? [];
  const inStock = variants.filter(isVariantInStock);
  const orderable = variants.filter(isVariantOrderable);
  const priceSource = inStock.length > 0 ? inStock : orderable;
  const prices = priceSource.map((v) => v.price).filter(isValidPrice);
  const hasKnownState = variants.length > 0;

  let status: AvailabilityStatus;
  let label: string;
  let priority: number;
  if (inStock.length > 0 && inStock.length === variants.length) {
    status = "in_stock";
    label = "В наличии";
    priority = 0;
  } else if (inStock.length > 0) {
    status = "partial";
    label = "Есть варианты в наличии";
    priority = 1;
  } else if (orderable.length > 0) {
    status = "order";
    label = "Под заказ";
    priority = 2;
  } else if (hasKnownState) {
    status = "unavailable";
    label = "Временно недоступен";
    priority = 3;
  } else {
    status = "unknown";
    label = "Уточнить доступность";
    priority = 4;
  }

  return {
    status,
    priority,
    label,
    availableVariants: inStock,
    orderableVariants: orderable,
    minPrice: prices.length ? Math.min(...prices) : undefined,
    maxPrice: prices.length ? Math.max(...prices) : undefined,
    hasValidPrice: prices.length > 0,
  };
}

export function compareCatalogProducts(a: Product, b: Product): number {
  const aManual = Number.isFinite(a.manualSortOrder) ? (a.manualSortOrder as number) : null;
  const bManual = Number.isFinite(b.manualSortOrder) ? (b.manualSortOrder as number) : null;
  if (aManual !== null || bManual !== null) {
    if (aManual === null) return 1;
    if (bManual === null) return -1;
    const manualDifference = aManual - bManual;
    if (manualDifference) return manualDifference;
  }
  const aa = getProductAvailability(a);
  const bb = getProductAvailability(b);
  const aPriority = a.listingAvailabilityPriority ?? aa.priority;
  const bPriority = b.listingAvailabilityPriority ?? bb.priority;
  const aHasPrice = a.listingHasValidPrice ?? aa.hasValidPrice;
  const bHasPrice = b.listingHasValidPrice ?? bb.hasValidPrice;
  return (
    aPriority - bPriority ||
    Number(bHasPrice) - Number(aHasPrice) ||
    (a.priceFrom ?? aa.minPrice ?? Number.POSITIVE_INFINITY) - (b.priceFrom ?? bb.minPrice ?? Number.POSITIVE_INFINITY) ||
    a.title.localeCompare(b.title, "ru") ||
    a.id.localeCompare(b.id)
  );
}

export function fmtPrice(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n) + " ₽";
}

export function priceLabel(product: Product): string {
  const availability = getProductAvailability(product);
  if (!availability.hasValidPrice || availability.minPrice == null) return "Цена по запросу";
  if (availability.maxPrice != null && availability.maxPrice > availability.minPrice) {
    return `от ${fmtPrice(availability.minPrice)}`;
  }
  return fmtPrice(availability.minPrice);
}

// Компактный payload клиентской выдачи. Полные варианты остаются на карточке
// товара; листинг получает один вариант для корзины и дедуплицированные данные
// для поиска/фасетов. Это не сериализует сотни повторяющихся params в HTML/RSC.
export function listingFacetNames(products: Product[]): string[] {
  const valueSets = new Map<string, Set<string>>();
  const counts = new Map<string, number>();
  for (const product of products) {
    const seen = new Set<string>();
    for (const param of product.variants.flatMap((variant) => variant.params)) {
      const name = cleanParamName(param.name);
      if (/^(?:бренд|материал)$/i.test(name)) continue;
      const key = `${name}\u0000${param.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      valueSets.set(name, new Set([...(valueSets.get(name) ?? []), param.value]));
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  const priority = ["Серия", "Хвостовик", "Покрытие", "Материал режущей части", "Рабочая длина", "Шпиндель", "Реверс", "Поворотное основание", "Число скоростей"];
  return Array.from(valueSets.keys())
    .filter((name) => (valueSets.get(name)?.size ?? 0) >= 2 && (valueSets.get(name)?.size ?? 0) <= 30 && (counts.get(name) ?? 0) >= 3)
    .sort((left, right) => {
      const leftRank = priority.indexOf(left);
      const rightRank = priority.indexOf(right);
      return (leftRank < 0 ? 999 : leftRank) - (rightRank < 0 ? 999 : rightRank)
        || (counts.get(right) ?? 0) - (counts.get(left) ?? 0)
        || left.localeCompare(right, "ru");
    })
    .slice(0, 6);
}

export function productForListing(product: Product, facetNames?: string[], includeVariantSkus = true): Product {
  const availability = getProductAvailability(product);
  const representative =
    availability.availableVariants.find((variant) => isValidPrice(variant.price)) ??
    availability.availableVariants[0] ??
    availability.orderableVariants.find((variant) => isValidPrice(variant.price)) ??
    availability.orderableVariants[0] ??
    product.variants[0];
  const listingParams = Array.from(
    new Map(
      product.variants.flatMap((variant) => variant.params)
        .filter((param) => !facetNames || facetNames.includes(cleanParamName(param.name)))
        .map((param) => [
        `${param.name}\u0000${param.value}\u0000${param.unit ?? ""}`,
        param,
      ]),
    ).values(),
  );
  return {
    ...product,
    description: undefined,
    metaTitle: undefined,
    metaDescription: undefined,
    seoText: undefined,
    seoFingerprint: undefined,
    seoSource: undefined,
    seoGeneratedAt: undefined,
    images: product.images.slice(0, 1),
    accessories: [],
    listingVariantCount: product.variants.length,
    listingVariantSkus: includeVariantSkus ? Array.from(new Set(product.variants.map((variant) => variant.sku))) : undefined,
    listingParams,
    listingAvailabilityStatus: availability.status,
    listingAvailabilityLabel: availability.label,
    listingAvailabilityPriority: availability.priority,
    listingHasValidPrice: availability.hasValidPrice,
    variants: representative ? [{
      id: representative.id,
      sku: representative.sku,
      price: representative.price,
      oldPrice: representative.oldPrice,
      quantity: representative.quantity,
      available: representative.available,
      params: [],
    }] : [],
  };
}

function variantSlugSuffix(sku: string): string {
  const s = (sku || "").toLowerCase().replace(/[^a-zа-я0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const transliteration: Record<string, string> = {
    "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"zh","з":"z",
    "и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r",
    "с":"s","т":"t","у":"u","ф":"f","х":"h","ц":"ts","ч":"ch","ш":"sh",
    "щ":"sch","ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya",
  };
  return s.split("").map((c) => transliteration[c] ?? c).join("") || "x";
}

export function variantSlug(p: Pick<Product, "slug">, v: Pick<Variant, "id" | "sku">): string {
  const suffix = variantSlugSuffix(v.sku) || v.id.toLowerCase();
  if (!suffix) return p.slug;
  const slugParts = p.slug.split("-");
  const suffixParts = suffix.split("-");
  while (suffixParts.length && slugParts.length && slugParts.at(-1) === suffixParts[0]) {
    suffixParts.shift();
  }
  return suffixParts.length ? `${p.slug}--${suffixParts.join("-")}` : p.slug;
}

export function variantTitle(p: Product, v: Variant): string {
  const axisValues = p.paramAxes
    .map((axis) => v.params.find((param) => param.name === axis))
    .filter((param): param is ProductParam => Boolean(param))
    .map((param) => `${param.value}${param.unit ? ` ${param.unit}` : ""}`)
    .join(" · ");
  const name = (v.name || "").trim();
  if (name && name !== p.title) return name;
  if (axisValues) return `${p.title} · ${axisValues}`;
  return `${p.title} · арт. ${v.sku}`;
}
