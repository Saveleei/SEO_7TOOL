import { formatFeedPrice, getFeedProductImage, getFeedVariantSpecs, type FeedProduct, type FeedVariant } from "./feedCatalog.ts";

export type VariantChoicePresentation = {
  label: string;
  context: string;
  selectorLabel: "Размер" | "Параметры исполнения";
  sizeLed: boolean;
  diameter?: number;
  length?: number;
};

export type ProductVariantChoice = {
  id: string;
  sku: string;
  title: string;
  price: string;
  available: boolean;
  keySpecs: Array<{ label: string; value: string }>;
  choiceLabel: string;
  choiceContext: string;
  selectorLabel: "Размер" | "Параметры исполнения";
  image?: string;
  href: string;
};

export function getVariantChoicePresentation(product: FeedProduct, variant: FeedVariant): VariantChoicePresentation {
  const diameter = findParameter(variant, /(^|\s)диаметр.*(режущ|рабоч|сверл|отверст)|^диаметр$/iu);
  const length = findParameter(variant, /рабоч.*длин|длин.*режущ|глубин.*сверл/iu);

  if (diameter) {
    const diameterMeasure = parseMeasure(formatParameter(diameter));
    const lengthMeasure = length ? parseMeasure(formatParameter(length)) : undefined;
    const label = formatSizeLabel(diameterMeasure, lengthMeasure);
    const context = compactContext(variant, [diameter.name, length?.name]);
    return {
      label,
      context,
      selectorLabel:"Размер",
      sizeLed:true,
      diameter:diameterMeasure.number,
      length:lengthMeasure?.number,
    };
  }

  const specs = getFeedVariantSpecs(product, variant);
  if (specs.length > 0) {
    const first = specs[0];
    return {
      label:formatDecisionSpec(first.label, first.value),
      context:specs.slice(1, 3).map((spec) => spec.value).filter(Boolean).join(" · "),
      selectorLabel:"Параметры исполнения",
      sizeLed:false,
    };
  }

  const cleanedName = String(variant.name || "").replace(/[,;]?\s*арт(?:икул)?\.?\s*[:№]?[\s\S]*$/iu, "").trim();
  return {
    label:cleanedName || "Исполнение из каталога",
    context:"",
    selectorLabel:"Параметры исполнения",
    sizeLed:false,
  };
}

export function sortVariantsForChoice(product: FeedProduct, variants: FeedVariant[]): FeedVariant[] {
  const presentations = new Map(variants.map((variant) => [variant.id, getVariantChoicePresentation(product, variant)]));
  return [...variants].sort((first, second) => {
    const a = presentations.get(first.id)!;
    const b = presentations.get(second.id)!;
    if (a.sizeLed && b.sizeLed) {
      return numeric(a.diameter) - numeric(b.diameter)
        || numeric(a.length) - numeric(b.length)
        || a.context.localeCompare(b.context, "ru-RU")
        || first.sku.localeCompare(second.sku, "ru-RU", { numeric:true });
    }
    return a.label.localeCompare(b.label, "ru-RU", { numeric:true })
      || a.context.localeCompare(b.context, "ru-RU")
      || first.sku.localeCompare(second.sku, "ru-RU", { numeric:true });
  });
}

export function getProductVariantChoices(product: FeedProduct): ProductVariantChoice[] {
  const variants = sortVariantsForChoice(product, product.variants.filter((variant) => variant.name || variant.sku));
  return variants.map((variant) => {
    const choice = getVariantChoicePresentation(product, variant);
    return {
      id:variant.id,
      sku:variant.sku,
      title:variant.name || product.title,
      price:formatFeedPrice(variant.price) ?? "Цена по запросу",
      available:variant.available === true && typeof variant.quantity === "number" && variant.quantity > 0,
      keySpecs:getFeedVariantSpecs(product, variant).slice(0, 4),
      choiceLabel:choice.label,
      choiceContext:choice.context,
      selectorLabel:choice.selectorLabel,
      image:variant.images?.[0] ?? getFeedProductImage(product),
      href:`/product/${product.slug}?variant=${encodeURIComponent(variant.id)}#variants`,
    };
  });
}

function findParameter(variant: FeedVariant, pattern: RegExp) {
  return (variant.params ?? []).find((parameter) => pattern.test(normalize(parameter.name)));
}

function compactContext(variant: FeedVariant, excludedNames: Array<string | undefined>): string {
  const excluded = new Set(excludedNames.filter(Boolean).map((name) => normalize(String(name))));
  const priorities = [/хвостовик/iu, /материал.*режущ/iu, /покрытие/iu, /толщин/iu];
  const values: string[] = [];
  for (const pattern of priorities) {
    const parameter = (variant.params ?? []).find((candidate) => !excluded.has(normalize(candidate.name)) && pattern.test(normalize(candidate.name)));
    const value = parameter ? formatParameter(parameter) : "";
    if (value && !values.includes(value) && !/^нет$/iu.test(value)) values.push(value);
    if (values.length === 2) break;
  }
  return values.join(" · ");
}

function formatDecisionSpec(label: string, value: string): string {
  if (/макс.*диаметр/iu.test(label)) return `до Ø${compactMeasure(value)}`;
  if (/мин.*диаметр/iu.test(label)) return `от Ø${compactMeasure(value)}`;
  if (/диаметр/iu.test(label)) return `Ø${compactMeasure(value)}`;
  return `${shortLabel(label)} ${value}`.trim();
}

function shortLabel(label: string): string {
  return label.replace(/^макс(?:имальный)?\.?\s*/iu, "до ").replace(/^мин(?:имальный)?\.?\s*/iu, "от ").trim();
}

function formatSizeLabel(diameter: Measure, length?: Measure): string {
  if (!length?.number) return `Ø${compactMeasure(diameter.text)}`;
  if (diameter.unit && diameter.unit === length.unit) return `Ø${formatNumber(diameter.number)} × ${formatNumber(length.number)} ${diameter.unit}`;
  return `Ø${compactMeasure(diameter.text)} × ${compactMeasure(length.text)}`;
}

function parseMeasure(value: string): Measure {
  const match = value.trim().match(/(-?\d+(?:[.,]\d+)?)\s*([^\d\s]+)?/u);
  const number = Number.parseFloat(String(match?.[1] ?? "").replace(",", "."));
  return { text:value.trim(), number:Number.isFinite(number) ? number : 0, unit:String(match?.[2] ?? "").trim() };
}

function compactMeasure(value: string): string {
  return value.trim().replace(/\s+(мм|см|м|дюйм(?:а|ов)?|inch)$/iu, " $1");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits:3 }).format(value);
}

function formatParameter(parameter: { value: string; unit?: string }): string {
  return `${parameter.value}${parameter.unit ? ` ${parameter.unit}` : ""}`.trim();
}

function normalize(value: string): string {
  return String(value).toLocaleLowerCase("ru-RU").replace(/ё/gu, "е").replace(/[^a-zа-я0-9]+/giu, " ").trim();
}

function numeric(value?: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

type Measure = { text: string; number: number; unit: string };
