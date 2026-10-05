import { formatFeedPrice, getFeedProductImage, getFeedVariantSpecs, type FeedParameter, type FeedProduct, type FeedVariant } from "./feedCatalog.ts";
import { publicProductPath } from "./publicUrls.ts";
import { getVariantShippingPromise } from "./shippingPromise.mjs";

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
  shippingPromise: ReturnType<typeof getVariantShippingPromise>;
  keySpecs: Array<{ label: string; value: string }>;
  choiceLabel: string;
  choiceContext: string;
  selectorLabel: "Размер" | "Параметры исполнения";
  image?: string;
  selectorImage?: string;
  href: string;
};

type PresentationKind = "diameter-length" | "disc" | "thread" | "pipe-range" | "compressor" | "pack" | "capacity" | "laser" | "priority";
type CategoryPresentationRule = {
  kind: PresentationKind;
  selectorLabel: VariantChoicePresentation["selectorLabel"];
  primary?: RegExp[];
  context: RegExp[];
};

// Buyer-first rules for every feed category. Only supplier-feed values are used;
// SKU remains a secondary reference in the selector and in the quote request.
export const CATEGORY_VARIANT_PRESENTATION_RULES: Readonly<Record<string, CategoryPresentationRule>> = Object.freeze({
  "almaznoe-burenie": { kind:"diameter-length", selectorLabel:"Размер", context:[/хвостовик/iu, /число сегмент/iu, /материал режущ/iu] },
  borfrezy: { kind:"diameter-length", selectorLabel:"Размер", context:[/диаметр хвостовик/iu, /тип насеч/iu, /покрытие/iu] },
  "disko-otreznye-stanki": { kind:"priority", selectorLabel:"Параметры исполнения", primary:[/диаметр.*диск/iu, /тип/iu], context:[/мощност/iu, /угол рез/iu, /питание/iu] },
  "karetki-svarochnye": { kind:"priority", selectorLabel:"Параметры исполнения", primary:[/положения сварки/iu, /движение каретки/iu], context:[/движение каретки/iu, /особенност/iu] },
  "karetki-termicheskoy-rezki": { kind:"priority", selectorLabel:"Параметры исполнения", primary:[/назначение/iu, /макс.*диаметр тру/iu, /тип резки/iu], context:[/тип резки/iu, /количество резак/iu, /толщина резки/iu] },
  kompressory: { kind:"compressor", selectorLabel:"Параметры исполнения", context:[/объем ресивер|^ресивер/iu, /мощность/iu, /параметры питания/iu] },
  "koronchatye-sverla": { kind:"diameter-length", selectorLabel:"Размер", context:[/хвостовик/iu, /материал режущ/iu, /покрытие/iu] },
  "kromkorezy-dlya-trub": { kind:"pipe-range", selectorLabel:"Размер", context:[/способ крепления/iu, /доступные приводы|^привод$/iu, /возможности/iu] },
  "kromkorezy-po-listu": { kind:"priority", selectorLabel:"Параметры исполнения", primary:[/макс.*ширина фаски/iu, /радиусная фаска/iu, /^тип$/iu], context:[/макс.*толщина заготовки/iu, /тип обработки/iu, /привод/iu] },
  "lentochnopilnye-stanki": { kind:"priority", selectorLabel:"Параметры исполнения", primary:[/макс.*диаметр.*90/iu, /макс.*ширина заготовки/iu, /тип исполнения/iu], context:[/угол поворота/iu, /длина ленточного полотна/iu, /напряжение/iu] },
  "magnitnaya-osnastka": { kind:"priority", selectorLabel:"Параметры исполнения", primary:[/усилие на отрыв/iu, /тип фиксатора/iu, /рабочий угол/iu], context:[/регулировка угла/iu, /подходит для труб/iu, /масса/iu] },
  metchiki: { kind:"thread", selectorLabel:"Размер", context:[/^стандарт$/iu, /тип отверстия/iu, /материал режущ/iu] },
  "pilnye-diski": { kind:"disc", selectorLabel:"Размер", context:[/число зубьев|кол-во и форма зубьев/iu, /тип зубьев/iu, /материал режущ/iu] },
  "rezbonareznye-manipulyatory": { kind:"priority", selectorLabel:"Параметры исполнения", primary:[/макс.*резьба/iu, /охват рабочей зоны|рабочий радиус/iu, /посадка/iu], context:[/частота вращения/iu, /автоподача сож/iu, /посадка/iu] },
  "shlifovalnoe-i-zatochnoe-oborudovanie": { kind:"priority", selectorLabel:"Параметры исполнения", primary:[/тип шлифования/iu, /тип затачиваемого инструмента/iu, /тип цанги/iu, /частота вращения/iu], context:[/мощность/iu, /масса/iu, /длина/iu] },
  "sozh-i-sots": { kind:"pack", selectorLabel:"Размер", context:[/^вид$/iu, /форма выпуска/iu, /состав/iu] },
  "stanki-lazernoy-rezki": { kind:"laser", selectorLabel:"Параметры исполнения", context:[/наличие защитной кабины/iu, /наличие сменного стола/iu, /макс.*скорость/iu] },
  "stanki-sverlilnye": { kind:"priority", selectorLabel:"Параметры исполнения", primary:[/макс.*диаметр корончатого сверла/iu, /^макс.*диаметр отверстия$/iu, /шпиндель/iu], context:[/шпиндель/iu, /реверс/iu, /напряжение/iu] },
  "stanochnaya-osnastka": { kind:"priority", selectorLabel:"Параметры исполнения", primary:[/^тип$/iu, /посадка/iu, /размер|диаметр/iu], context:[/масса/iu] },
  "svarochnye-roboty": { kind:"priority", selectorLabel:"Параметры исполнения", primary:[/макс.*охват/iu, /количество осей/iu, /доп.*возможности/iu], context:[/количество осей/iu, /грузоподъем/iu, /точность/iu] },
  "svarochnye-vrashchateli-i-pozitsionery": { kind:"capacity", selectorLabel:"Параметры исполнения", context:[/диаметр планшайбы/iu, /мин.*диаметр обечайки/iu, /макс.*диаметр обечайки/iu] },
  "sverla-i-zenkovki": { kind:"diameter-length", selectorLabel:"Размер", context:[/диаметр хвостовика/iu, /материал режущ/iu, /стандарт/iu] },
  truborezy: { kind:"pipe-range", selectorLabel:"Размер", context:[/макс.*толщина стенки/iu, /материал заготовки/iu, /управление/iu] },
  verstaki: { kind:"priority", selectorLabel:"Параметры исполнения", primary:[/ширина|длина|размер/iu], context:[/высота/iu, /нагруз/iu] },
  vibroopory: { kind:"capacity", selectorLabel:"Параметры исполнения", context:[/высота/iu, /ширина/iu, /масса/iu] },
  "zahvaty-dlya-gruzov": { kind:"capacity", selectorLabel:"Параметры исполнения", context:[/толщина стали|толщина материала/iu, /включение|отключение/iu, /масса/iu] },
});

export function getVariantChoicePresentation(product: FeedProduct, variant: FeedVariant): VariantChoicePresentation {
  const rule = CATEGORY_VARIANT_PRESENTATION_RULES[product.category];
  const categoryChoice = rule ? buildCategoryChoice(rule, variant) : undefined;
  if (categoryChoice) return categoryChoice;

  const diameter = findParameter(variant, /(^|\s)диаметр.*(режущ|рабоч|сверл|отверст)|^диаметр$/iu);
  const length = findParameter(variant, /рабоч.*длин|длин.*режущ|глубин.*сверл/iu);
  if (diameter) return diameterLengthChoice(variant, diameter, length, rule);

  const specs = getFeedVariantSpecs(product, variant);
  if (specs.length > 0) {
    const first = specs[0];
    return finalizeChoice({
      label:formatDecisionSpec(first.label, first.value),
      context:specs.slice(1, 3).map((spec) => spec.value).filter(Boolean).join(" · "),
      selectorLabel:rule?.selectorLabel ?? "Параметры исполнения",
      sizeLed:false,
    });
  }

  const cleanedName = compactVariantName(variant.name, variant.sku);
  return finalizeChoice({
    label:cleanedName || "Исполнение по каталогу",
    context:"",
    selectorLabel:rule?.selectorLabel ?? "Параметры исполнения",
    sizeLed:false,
  });
}

export function sortVariantsForChoice(product: FeedProduct, variants: FeedVariant[]): FeedVariant[] {
  const presentations = new Map(variants.map((variant) => [variant.id, getVariantChoicePresentation(product, variant)]));
  return [...variants].sort((first, second) => {
    const a = presentations.get(first.id)!;
    const b = presentations.get(second.id)!;
    if (a.sizeLed && b.sizeLed) {
      return numeric(a.diameter) - numeric(b.diameter)
        || numeric(a.length) - numeric(b.length)
        || a.context.localeCompare(b.context, "ru-RU", { numeric:true })
        || first.sku.localeCompare(second.sku, "ru-RU", { numeric:true });
    }
    return a.label.localeCompare(b.label, "ru-RU", { numeric:true })
      || a.context.localeCompare(b.context, "ru-RU", { numeric:true })
      || first.sku.localeCompare(second.sku, "ru-RU", { numeric:true });
  });
}

export function selectDefaultVariant(product: FeedProduct, variants: FeedVariant[]): FeedVariant | undefined {
  const sorted = sortVariantsForChoice(product, variants);
  return sorted.find((variant) => hasConfirmedStock(variant) && hasValidPrice(variant))
    ?? sorted.find(hasConfirmedStock)
    ?? sorted.find((variant) => variant.available === true)
    ?? sorted[0];
}

export function getProductVariantChoices(product: FeedProduct): ProductVariantChoice[] {
  const variants = sortVariantsForChoice(product, product.variants.filter((variant) => variant.name || variant.sku));
  const exactVariantImageCounts = countVariantImages(variants);
  const productImage = firstImage(product.images);
  const choices = variants.map((variant) => {
    const choice = getVariantChoicePresentation(product, variant);
    const shippingPromise = getVariantShippingPromise(variant);
    const exactImage = variant.images?.[0] || firstImage(variant.images);
    const selectorImage = getSelectorImage(exactImage, productImage, exactVariantImageCounts);
    return {
      id:variant.id,
      sku:variant.sku,
      title:variant.name || product.title,
      price:formatFeedPrice(variant.price) ?? "Цена по запросу",
      available:shippingPromise.available,
      shippingPromise,
      keySpecs:getFeedVariantSpecs(product, variant).slice(0, 4),
      choiceLabel:choice.label,
      choiceContext:choice.context,
      selectorLabel:choice.selectorLabel,
      image:exactImage ?? getFeedProductImage(product),
      selectorImage,
      href:`${publicProductPath(product, variant)}#variants`,
    };
  });
  const duplicateCounts = new Map<string, number>();
  for (const choice of choices) {
    const signature = normalize(`${choice.choiceLabel}|${choice.choiceContext}`);
    duplicateCounts.set(signature, (duplicateCounts.get(signature) ?? 0) + 1);
  }
  return choices.map((choice) => {
    const signature = normalize(`${choice.choiceLabel}|${choice.choiceContext}`);
    if ((duplicateCounts.get(signature) ?? 0) < 2 || !choice.sku) return choice;
    return { ...choice, choiceContext:appendSecondaryReference(choice.choiceContext, choice.sku) };
  });
}

function firstImage(images: string[] | undefined): string | undefined {
  return images?.find((image) => Boolean(String(image).trim()));
}

function normalizeImageUrl(value: string): string {
  return value.trim().replace(/\?.*$/u, "").replace(/\/$/u, "").toLocaleLowerCase("en-US");
}

function countVariantImages(variants: FeedVariant[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const variant of variants) {
    const image = firstImage(variant.images);
    if (!image) continue;
    const key = normalizeImageUrl(image);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function getSelectorImage(exactImage: string | undefined, productImage: string | undefined, counts: Map<string, number>): string | undefined {
  if (!exactImage) return undefined;
  const imageKey = normalizeImageUrl(exactImage);
  const productImageKey = productImage ? normalizeImageUrl(productImage) : "";
  if (counts.size <= 1) return productImageKey && imageKey !== productImageKey ? exactImage : undefined;
  if ((counts.get(imageKey) ?? 0) > 1 && (!productImageKey || imageKey === productImageKey)) return undefined;
  return imageKey === productImageKey ? undefined : exactImage;
}

function buildCategoryChoice(rule: CategoryPresentationRule, variant: FeedVariant): VariantChoicePresentation | undefined {
  if (rule.kind === "diameter-length") {
    const diameter = findParameter(variant, /диаметр.*(режущ|рабоч|сверл|отверст)|^диаметр$/iu);
    if (!diameter) return undefined;
    const length = findParameter(variant, /рабоч.*длин|длин.*режущ|глубин.*сверл/iu);
    return diameterLengthChoice(variant, diameter, length, rule);
  }

  if (rule.kind === "thread") {
    const thread = findParameter(variant, /^резьба$/iu);
    if (!thread) return undefined;
    const threadNumber = extractNumber(formatParameter(thread));
    return finalizeChoice({
      label:formatParameter(thread),
      context:contextFromPatterns(variant, rule.context, [thread.name]),
      selectorLabel:rule.selectorLabel,
      sizeLed:true,
      diameter:threadNumber || undefined,
    });
  }

  if (rule.kind === "pipe-range") {
    const directRange = findParameter(variant, /^диапазон тру/iu);
    const minimum = findParameter(variant, /^мин.*диаметр тру/iu);
    const maximum = findParameter(variant, /^макс.*диаметр тру/iu);
    const label = directRange ? formatDirectRange(directRange) : formatMinMaxRange(minimum, maximum);
    if (!label) return undefined;
    const minMeasure = minimum ? parseMeasure(formatParameter(minimum)) : undefined;
    const maxMeasure = maximum ? parseMeasure(formatParameter(maximum)) : directRange ? parseRange(formatParameter(directRange)).maximum : undefined;
    return finalizeChoice({
      label,
      context:contextFromPatterns(variant, rule.context, [directRange?.name, minimum?.name, maximum?.name]),
      selectorLabel:rule.selectorLabel,
      sizeLed:true,
      diameter:maxMeasure?.number,
      length:minMeasure?.number,
    });
  }

  if (rule.kind === "disc") {
    const diameter = findParameter(variant, /^диаметр (?:пильного )?диск/iu);
    if (!diameter) return undefined;
    const thickness = findParameter(variant, /^толщина$|ширина пропила.*толщина/iu);
    const bore = findParameter(variant, /посадочн.*отверст/iu);
    const diameterMeasure = measureFromParameter(diameter, "мм");
    const thicknessMeasure = thickness ? measureFromParameter(thickness, "мм") : undefined;
    const boreMeasure = bore ? measureFromParameter(bore, "мм") : undefined;
    const dimensions = [diameterMeasure, thicknessMeasure, boreMeasure].filter(Boolean) as Measure[];
    return finalizeChoice({
      label:`Ø${dimensions.map((measure) => formatNumber(measure.number)).join(" × ")} ${dimensions.at(-1)?.unit || "мм"}`,
      context:contextFromPatterns(variant, rule.context, [diameter.name, thickness?.name, bore?.name]),
      selectorLabel:rule.selectorLabel,
      sizeLed:true,
      diameter:diameterMeasure.number,
      length:thicknessMeasure?.number,
    });
  }

  if (rule.kind === "compressor") {
    const output = findParameter(variant, /производительность/iu);
    if (!output) return undefined;
    const pressure = findParameter(variant, /(?:макс.*)?давление/iu);
    return finalizeChoice({
      label:[formatContextParameter(output), pressure ? formatContextParameter(pressure) : ""].filter(Boolean).join(" · "),
      context:contextFromPatterns(variant, rule.context, [output.name, pressure?.name]),
      selectorLabel:rule.selectorLabel,
      sizeLed:false,
    });
  }

  if (rule.kind === "pack") {
    const pack = findParameter(variant, /^объем$|масса нетто/iu);
    if (!pack) return undefined;
    return finalizeChoice({
      label:formatContextParameter(pack),
      context:contextFromPatterns(variant, rule.context, [pack.name]),
      selectorLabel:rule.selectorLabel,
      sizeLed:true,
      diameter:parseMeasure(formatParameter(pack)).number || undefined,
    });
  }

  if (rule.kind === "capacity") {
    const capacity = findParameter(variant, /грузопод[ъь]емность|усилие на отрыв|нагрузк/iu);
    if (!capacity) return undefined;
    return finalizeChoice({
      label:formatContextParameter(capacity),
      context:contextFromPatterns(variant, rule.context, [capacity.name]),
      selectorLabel:rule.selectorLabel,
      sizeLed:false,
    });
  }

  if (rule.kind === "laser") {
    const power = findParameter(variant, /^мощность/iu);
    if (!power) return undefined;
    const length = findParameter(variant, /длина рабочего стола/iu);
    const width = findParameter(variant, /ширина рабочего стола/iu);
    const field = length && width ? ` · поле ${formatNumber(measureFromParameter(length, "мм").number)} × ${formatNumber(measureFromParameter(width, "мм").number)} мм` : "";
    return finalizeChoice({
      label:`${formatPower(power)}${field}`,
      context:contextFromPatterns(variant, rule.context, [power.name, length?.name, width?.name]),
      selectorLabel:rule.selectorLabel,
      sizeLed:false,
    });
  }

  const primary = findParameterFromPatterns(variant, rule.primary ?? []);
  if (!primary) return undefined;
  if (/макс.*диаметр корончатого сверла/iu.test(normalize(primary.name))) {
    const spiral = findParameter(variant, /^макс.*диаметр отверстия$/iu);
    const equipmentContext = contextFromPatterns(variant, rule.context, [primary.name, spiral?.name]);
    return finalizeChoice({
      label:`Корончатое сверление до Ø${formatMeasure(measureFromParameter(primary, "мм"))}`,
      context:[spiral ? `Спиральное сверление до Ø${formatMeasure(measureFromParameter(spiral, "мм"))}` : "", equipmentContext].filter(Boolean).join(" · "),
      selectorLabel:rule.selectorLabel,
      sizeLed:false,
    });
  }
  return finalizeChoice({
    label:formatDecisionParameter(primary),
    context:contextFromPatterns(variant, rule.context, [primary.name]),
    selectorLabel:rule.selectorLabel,
    sizeLed:false,
  });
}

function diameterLengthChoice(variant: FeedVariant, diameter: FeedParameter, length: FeedParameter | undefined, rule?: CategoryPresentationRule): VariantChoicePresentation {
  const diameterMeasure = measureFromParameter(diameter, "мм");
  const lengthMeasure = length ? measureFromParameter(length, "мм") : undefined;
  return finalizeChoice({
    label:formatSizeLabel(diameterMeasure, lengthMeasure),
    context:contextFromPatterns(variant, rule?.context ?? [/хвостовик/iu, /материал.*режущ/iu, /покрытие/iu, /толщин/iu], [diameter.name, length?.name]),
    selectorLabel:rule?.selectorLabel ?? "Размер",
    sizeLed:true,
    diameter:diameterMeasure.number,
    length:lengthMeasure?.number,
  });
}

function findParameter(variant: FeedVariant, pattern: RegExp): FeedParameter | undefined {
  return (variant.params ?? []).find((parameter) => pattern.test(normalize(parameter.name)));
}

function findParameterFromPatterns(variant: FeedVariant, patterns: RegExp[]): FeedParameter | undefined {
  for (const pattern of patterns) {
    const parameter = findParameter(variant, pattern);
    if (parameter) return parameter;
  }
  return undefined;
}

function contextFromPatterns(variant: FeedVariant, patterns: RegExp[], excludedNames: Array<string | undefined>): string {
  const excluded = new Set(excludedNames.filter(Boolean).map((name) => normalize(String(name))));
  const values: string[] = [];
  for (const pattern of patterns) {
    const parameter = (variant.params ?? []).find((candidate) => !excluded.has(normalize(candidate.name)) && pattern.test(normalize(candidate.name)));
    const value = parameter ? formatContextParameter(parameter) : "";
    if (value && !values.includes(value) && !/^нет$/iu.test(value)) values.push(value);
    if (values.length === 2) break;
  }
  return values.join(" · ");
}

function formatDecisionParameter(parameter: FeedParameter): string {
  const name = normalize(parameter.name);
  const value = formatContextParameter(parameter);
  if (/макс.*диаметр/iu.test(name)) return `до Ø${formatMeasure(measureFromParameter(parameter, "мм"))}`;
  if (/мин.*диаметр/iu.test(name)) return `от Ø${formatMeasure(measureFromParameter(parameter, "мм"))}`;
  if (/^диаметр|диаметр.*диск/iu.test(name)) return `Ø${formatMeasure(measureFromParameter(parameter, "мм"))}`;
  if (/макс.*ширина фаски/iu.test(name)) return `Фаска до ${value}`;
  if (/макс.*толщина/iu.test(name)) return `Толщина до ${value}`;
  if (/макс.*охват/iu.test(name)) return `Охват до ${value}`;
  return `${shortLabel(parameter.name)} ${value}`.trim();
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
  if (!length?.number) return `Ø${formatMeasure(diameter)}`;
  if (diameter.unit && diameter.unit === length.unit) return `Ø${formatNumber(diameter.number)} × ${formatNumber(length.number)} ${diameter.unit}`;
  return `Ø${formatMeasure(diameter)} × ${formatMeasure(length)}`;
}

function formatDirectRange(parameter: FeedParameter): string {
  const range = parseRange(formatParameter(parameter));
  if (!range.minimum?.number || !range.maximum?.number) return `Ø${formatParameter(parameter)}`;
  return `Ø${formatNumber(range.minimum.number)}–${formatNumber(range.maximum.number)} ${range.maximum.unit || range.minimum.unit || "мм"}`;
}

function formatMinMaxRange(minimum?: FeedParameter, maximum?: FeedParameter): string {
  if (!minimum && !maximum) return "";
  const minMeasure = minimum ? measureFromParameter(minimum, "мм") : undefined;
  const maxMeasure = maximum ? measureFromParameter(maximum, "мм") : undefined;
  if (minMeasure?.number && maxMeasure?.number) return `Ø${formatNumber(minMeasure.number)}–${formatNumber(maxMeasure.number)} ${maxMeasure.unit || minMeasure.unit || "мм"}`;
  if (maxMeasure?.number) return `до Ø${formatMeasure(maxMeasure)}`;
  if (minMeasure?.number) return `от Ø${formatMeasure(minMeasure)}`;
  return "";
}

function parseRange(value: string): { minimum?: Measure; maximum?: Measure } {
  const numbers = [...value.matchAll(/\d+(?:[.,]\d+)?/gu)].map((match) => Number.parseFloat(match[0].replace(",", "."))).filter(Number.isFinite);
  const unit = value.match(/(мм|см|м|дюйм(?:а|ов)?|inch)/iu)?.[1] ?? "";
  if (numbers.length < 2) return { maximum:numbers[0] ? { text:value, number:numbers[0], unit } : undefined };
  return { minimum:{ text:value, number:numbers[0], unit }, maximum:{ text:value, number:numbers[1], unit } };
}

function measureFromParameter(parameter: FeedParameter, fallbackUnit = ""): Measure {
  const measure = parseMeasure(formatParameter(parameter));
  return { ...measure, unit:measure.unit || inferUnit(parameter.name) || fallbackUnit };
}

function parseMeasure(value: string): Measure {
  const match = value.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*([^\d\s]+)?$/u);
  const number = Number.parseFloat(String(match?.[1] ?? "").replace(",", "."));
  return { text:value.trim(), number:Number.isFinite(number) ? number : 0, unit:String(match?.[2] ?? "").trim() };
}

function extractNumber(value: string): number {
  const match = value.match(/-?\d+(?:[.,]\d+)?/u);
  const number = Number.parseFloat(String(match?.[0] ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : 0;
}

function inferUnit(name: string): string {
  return name.match(/(?:,|\()\s*(л\/мин|м³\/мин|квт|вт|бар|мм|кг|л|т|в|об\/мин)\)?$/iu)?.[1] ?? "";
}

function formatPower(parameter: FeedParameter): string {
  const measure = measureFromParameter(parameter);
  if (/мощность.*(?:^|,\s*)вт$/iu.test(parameter.name) && measure.number >= 1000) return `${formatNumber(measure.number / 1000)} кВт`;
  return formatMeasure(measure);
}

function formatContextParameter(parameter: FeedParameter): string {
  const name = normalize(parameter.name);
  const value = /^мощность/iu.test(name) ? formatPower(parameter) : formatMeasure(measureFromParameter(parameter));
  if (/объем ресивер|^ресивер/iu.test(name)) return `ресивер ${value}`;
  if (/макс.*толщина стен/iu.test(name)) return `стенка до ${value}`;
  return value;
}

function formatMeasure(measure: Measure): string {
  if (!measure.number) return measure.text;
  return `${formatNumber(measure.number)}${measure.unit ? ` ${measure.unit}` : ""}`;
}

function compactMeasure(value: string): string {
  return value.trim().replace(/\s+(мм|см|м|дюйм(?:а|ов)?|inch)$/iu, " $1");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits:3 }).format(value);
}

function formatParameter(parameter: Pick<FeedParameter, "value" | "unit">): string {
  return `${parameter.value}${parameter.unit ? ` ${parameter.unit}` : ""}`.trim();
}

function compactVariantName(value: string | undefined, sku: string): string {
  const cleaned = String(value || "").replace(/[,;]?\s*арт(?:икул)?\.?\s*[:№]?[\s\S]*$/iu, "").trim();
  if (!cleaned || normalize(cleaned) === normalize(sku)) return "";
  return cleaned;
}

function finalizeChoice(choice: VariantChoicePresentation): VariantChoicePresentation {
  return {
    ...choice,
    label:truncate(choice.label.replace(/\s+/gu, " ").trim(), 72) || "Исполнение по каталогу",
    context:truncate(choice.context.replace(/\s+/gu, " ").trim(), 72),
  };
}

function appendSecondaryReference(context: string, sku: string): string {
  const reference = `арт. ${sku}`;
  if (!context) return truncate(reference, 72);
  const availableContextLength = 72 - reference.length - 3;
  if (availableContextLength < 8) return truncate(reference, 72);
  return `${truncate(context, availableContextLength)} · ${reference}`;
}

function truncate(value: string, maximum: number): string {
  if (value.length <= maximum) return value;
  const shortened = value.slice(0, maximum - 1).replace(/\s+\S*$/u, "").trimEnd();
  return `${shortened || value.slice(0, maximum - 1)}…`;
}

function normalize(value: string): string {
  return String(value).toLocaleLowerCase("ru-RU").replace(/ё/gu, "е").replace(/[^a-zа-я0-9]+/giu, " ").trim();
}

function numeric(value?: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function hasConfirmedStock(variant: FeedVariant): boolean {
  return variant.available === true && typeof variant.quantity === "number" && Number.isFinite(variant.quantity) && variant.quantity > 0;
}

function hasValidPrice(variant: FeedVariant): boolean {
  return typeof variant.price === "number" && Number.isFinite(variant.price) && variant.price > 0;
}

type Measure = { text: string; number: number; unit: string };
