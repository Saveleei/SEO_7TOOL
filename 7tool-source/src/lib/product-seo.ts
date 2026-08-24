import type { Product, ProductParam, Variant } from "./catalog";
import { cleanParamName, getProductAvailability, variantTitle } from "./catalog";
import { contentForCategory } from "./category-content";

const LOW_VALUE_PARAMS = new Set(["Бренд", "Тип", "Артикул", "Штрихкод"]);

function compact(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
}

function trimAtWord(value: string, max: number): string {
  const clean = compact(value);
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const boundary = cut.lastIndexOf(" ");
  const result = (boundary > Math.floor(max * 0.6) ? cut.slice(0, boundary) : cut)
    .replace(/[\s,;:–—-]+$/g, "")
    .replace(/\s+(?:с|со|из|для|и|или|по|на|в|во|под|к|от|до|при)$/i, "")
    .trim();
  const opening = (result.match(/\(/g) || []).length;
  const closing = (result.match(/\)/g) || []).length;
  return opening > closing ? result.replace(/\s*\([^)]*$/, "").trim() : result;
}

function sentence(value: string, max: number): string {
  const result = trimAtWord(value, max).replace(/[.,;:]+$/g, "");
  return `${result}.`;
}

function usefulParams(product: Product, variant: Variant): ProductParam[] {
  const preferred = [
    ...product.paramAxes,
    "Макс. диаметр корончатого сверла",
    "Макс. диаметр отверстия",
    "Макс. резьба",
    "Рабочая длина",
    "Диаметр режущей части",
    "Материал режущей части",
    "Хвостовик",
    "Шпиндель",
    "Привод",
    "Тип электродвигателя",
    "Форма",
    "Серия",
  ];
  const rank = new Map(preferred.map((name, index) => [name, index]));
  const seen = new Set<string>();
  return variant.params
    .map((param) => ({ ...param, name: cleanParamName(param.name) }))
    .filter((param) => !LOW_VALUE_PARAMS.has(param.name) && param.value && param.value !== "✓")
    .filter((param) => {
      const key = `${param.name}:${param.value}:${param.unit ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (rank.get(a.name) ?? 999) - (rank.get(b.name) ?? 999))
    .slice(0, 5);
}

function paramValue(param: ProductParam): string {
  return `${param.value}${param.unit ? ` ${param.unit}` : ""}`;
}

export function buildProductSeo(product: Product, variant: Variant, categoryTitle?: string) {
  const category = contentForCategory(product.category, categoryTitle ?? product.category);
  const name = compact(variantTitle(product, variant));
  const sku = compact(variant.sku || product.sku);
  const params = usefulParams(product, variant);
  const availability = getProductAvailability({ variants: [variant], stock: variant.quantity ?? 0 });
  const commercial = variant.price ? "Актуальная цена с НДС" : "Цена по запросу";
  const availabilityText = availability.status === "in_stock"
    ? "в наличии"
    : availability.status === "order"
      ? "доступно под заказ"
      : availability.label.toLowerCase();
  const weakProductTitle = product.title.toLocaleLowerCase("ru").startsWith("артикул ");
  const seoBaseName = weakProductTitle
    ? `${categoryTitle ?? "Промышленный инструмент"}${product.brand && product.brand !== "—" ? ` ${product.brand}` : ""}`
    : compact(product.title);
  const titlePreview = trimAtWord(seoBaseName, 58);
  const titleNeedsSku = Boolean(sku) && !titlePreview.toLocaleLowerCase("ru").includes(sku.toLocaleLowerCase("ru"));
  const titleSuffix = titleNeedsSku ? `, арт. ${sku}` : "";
  const titleCore = `${trimAtWord(seoBaseName, Math.max(38, 68 - titleSuffix.length))}${titleSuffix}`;
  const title = `${titleCore} — купить`;
  const descriptionPreview = trimAtWord(seoBaseName, 64);
  const descriptionNeedsSku = Boolean(sku) && !descriptionPreview.toLocaleLowerCase("ru").includes(sku.toLocaleLowerCase("ru"));
  const descriptionSuffix = descriptionNeedsSku ? `, арт. ${sku}` : "";
  const shortIdentity = `${trimAtWord(seoBaseName, Math.max(42, 72 - descriptionSuffix.length))}${descriptionSuffix}`;
  const fulfillment = availability.status === "in_stock"
    ? "В наличии. Отгрузка в день оплаты со склада в Москве или Санкт-Петербурге, доставка по России."
    : availability.status === "order"
      ? "Доступно под заказ. Срок поставки и способ доставки подтверждает менеджер."
      : `${availabilityText}. Срок поставки подтверждает менеджер.`;
  const factLine = params.slice(0, 2).map((param) => `${param.name.toLocaleLowerCase("ru")}: ${paramValue(param)}`).join(", ");
  const description = sentence(
    `Купить ${shortIdentity} для ${category.productPurpose}. ${factLine ? `${factLine}. ` : ""}${commercial}. ${fulfillment}`,
    200,
  );
  const keywords = Array.from(new Set([
    category.primaryQuery,
    ...category.keywords,
    `${name} купить`,
    `${product.brand} ${sku}`,
    sku ? `артикул ${sku}` : "",
    product.brand && product.brand !== "—" ? `${category.primaryQuery} ${product.brand}` : "",
    ...params.slice(0, 3).map((param) => `${category.primaryQuery} ${paramValue(param)}`),
  ].filter(Boolean)));

  return { name, sku, title, description, keywords, params };
}

export function buildProductGroupSeo(product: Product, categoryTitle?: string) {
  const category = contentForCategory(product.category, categoryTitle ?? product.category);
  const name = compact(product.title);
  const representative = product.variants.find((item) => item.available && (item.quantity ?? 0) > 0)
    ?? product.variants.find((item) => item.available)
    ?? product.variants[0];
  const sku = compact(product.sku || representative?.sku || product.id);
  const skuAlreadyInName = Boolean(sku) && name.toLocaleLowerCase("ru").includes(sku.toLocaleLowerCase("ru"));
  const identity = `${name}${sku && !skuAlreadyInName ? `, арт. ${sku}` : ""}`;
  const axisSummary = product.paramAxes.slice(0, 4).map((axis) => {
    const values = Array.from(new Set(product.variants.flatMap((variant) =>
      variant.params
        .filter((param) => param.name === axis)
        .map((param) => paramValue(param)),
    ))).slice(0, 4);
    return values.length ? `${axis.toLocaleLowerCase("ru")}: ${values.join(", ")}` : "";
  }).filter(Boolean);
  const variantCount = product.variants.length;
  const variantText = variantCount > 1
    ? `${variantCount} ${variantCount % 10 === 1 && variantCount % 100 !== 11 ? "модификация" : "модификаций"}`
    : "одна модификация";
  const title = `${trimAtWord(identity, 68)} — купить`;
  const description = sentence([
    `Купить ${identity} для ${category.productPurpose}`,
    product.brand && product.brand !== "—" ? `бренд ${product.brand}` : "",
    variantText,
    axisSummary.slice(0, 2).join("; "),
    "актуальные цены с НДС и наличие",
    "склады в Москве и Санкт-Петербурге, доставка по России",
  ].filter(Boolean).join(". "), 195);
  const keywords = Array.from(new Set([
    category.primaryQuery,
    ...category.keywords,
    `${name} купить`,
    sku ? `${product.brand} ${sku}`.trim() : "",
    sku ? `артикул ${sku}` : "",
    product.brand && product.brand !== "—" ? `${category.primaryQuery} ${product.brand}` : "",
    ...axisSummary.slice(0, 3).map((summary) => `${category.primaryQuery} ${summary}`),
  ].filter(Boolean)));

  return { name, sku, title, description, keywords, axisSummary, representative };
}
