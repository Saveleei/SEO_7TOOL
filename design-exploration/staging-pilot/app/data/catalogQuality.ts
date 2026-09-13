import { selectCategoryFacets } from "./categoryExpertProfiles.mjs";
import { getCategorySelectionRule } from "./categorySelection.mjs";
import { getFeedCategoryPage, getPublishedFeedCatalogSnapshot, type FeedCategory, type FeedParameter, type FeedProduct, type FeedVariant } from "./feedCatalog.ts";

export type CatalogQualityStatus = "critical" | "review" | "healthy";
export type CatalogQualitySeverity = "critical" | "warning" | "notice";
export type CatalogQualityIssueCode =
  | "missing_sku"
  | "invalid_range"
  | "malformed_numeric"
  | "numeric_outlier"
  | "missing_image"
  | "missing_price"
  | "missing_parameter"
  | "not_filterable"
  | "duplicate_sku"
  | "duplicate_signature";

export type CatalogQualityIssue = {
  id: string;
  code: CatalogQualityIssueCode;
  severity: CatalogQualitySeverity;
  categorySlug: string;
  categoryTitle: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  brand: string;
  variantId?: string;
  sku?: string;
  title: string;
  detail: string;
};

export type CatalogQualityCategory = {
  slug: string;
  title: string;
  status: CatalogQualityStatus;
  score: number;
  productCount: number;
  variantCount: number;
  affectedProductCount: number;
  issueCount: number;
  criticalCount: number;
  warningCount: number;
  noticeCount: number;
  metrics: {
    photoCoverage: number;
    priceCoverage: number;
    skuCoverage: number;
    selectionCoverage: number | null;
    criticalParameterCoverage: number | null;
  };
  selectionKeywords: string[];
  issues: CatalogQualityIssue[];
};

export type CatalogQualityReport = {
  generatedFrom: "bundled-supplier-feed";
  categoryCount: number;
  productCount: number;
  variantCount: number;
  issueCount: number;
  affectedProductCount: number;
  statuses: Record<CatalogQualityStatus, number>;
  categories: CatalogQualityCategory[];
  issues: CatalogQualityIssue[];
};

type NumericInstance = { categorySlug: string; product: FeedProduct; variant: FeedVariant; parameter: FeedParameter; numeric: number };

const feedSnapshot = getPublishedFeedCatalogSnapshot();
const publishedCategories = feedSnapshot.categories;
const publishedProducts = feedSnapshot.products;
const categoryBySlug = new Map(publishedCategories.map((category) => [category.slug, category]));
const issueLabels: Record<CatalogQualityIssueCode, string> = {
  missing_sku:"Нет артикула исполнения",
  invalid_range:"Нижняя граница выше верхней",
  malformed_numeric:"Размер записан как допуск или код",
  numeric_outlier:"Подозрительный числовой выброс",
  missing_image:"Нет фотографии товара",
  missing_price:"Цена требует заполнения",
  missing_parameter:"Нет ключевой характеристики",
  not_filterable:"Товар не участвует в подборе",
  duplicate_sku:"Артикул используется повторно",
  duplicate_signature:"Исполнения неразличимы по параметрам",
};

let cachedReport: CatalogQualityReport | undefined;

export function getCatalogQualityReport(): CatalogQualityReport {
  cachedReport ??= buildCatalogQualityReport();
  return cachedReport;
}

export function catalogQualityIssueLabel(code: CatalogQualityIssueCode): string {
  return issueLabels[code];
}

function buildCatalogQualityReport(): CatalogQualityReport {
  const issues: CatalogQualityIssue[] = [];
  const numericInstances = collectNumericInstances(publishedProducts);
  const selectionFacetsBySlug = new Map(publishedCategories.map((category) => {
    const page = getFeedCategoryPage(category.slug, { pageSize:48 });
    return [category.slug, selectCategoryFacets(category.slug, page.facets.filter((facet) => facet.keyword), 3)];
  }));
  const selectionKeywordsBySlug = new Map(Array.from(selectionFacetsBySlug, ([slug, facets]) => [slug, facets.map((facet) => facet.keyword).filter(Boolean)]));
  const duplicateSkus = duplicateGroups(publishedProducts.flatMap((product) => product.variants.map((variant) => ({
    key:normalizeKey(variant.sku), product, variant,
  }))));
  const duplicateSignatures = duplicateGroups(publishedProducts.flatMap((product) => product.variants.map((variant) => ({
    key:variantSignature(product, variant), product, variant,
  }))));

  for (const product of publishedProducts) {
    const category = categoryBySlug.get(product.category)!;
    const selectionFacets = selectionFacetsBySlug.get(product.category) ?? [];
    const selectionKeywords = selectionKeywordsBySlug.get(product.category) ?? [];

    if (!hasProductImage(product)) issues.push(issue(product, category, "missing_image", "warning", "Карточка и листинг не могут показать товар наглядно."));

    const missingKeywords = selectionKeywords.filter((keyword) => !product.variants.some((variant) => hasParameter(variant, keyword)));
    for (const keyword of missingKeywords) {
      issues.push(issue(product, category, "missing_parameter", "notice", `Нет параметра «${keyword}», используемого в подборе этой категории.`));
    }
    if (selectionKeywords.length > 0 && missingKeywords.length === selectionKeywords.length) {
      issues.push(issue(product, category, "not_filterable", "warning", "Ни один из основных вопросов подбора не может привести к этому товару."));
    }

    for (const variant of product.variants) {
      if (!normalizeKey(variant.sku)) issues.push(issue(product, category, "missing_sku", "critical", "Исполнение нельзя однозначно добавить в КП или сверить с поставщиком.", variant));
      if (!(typeof variant.price === "number" && variant.price > 0)) issues.push(issue(product, category, "missing_price", "warning", "На витрине будет показано «Цена по запросу».", variant));

      for (const parameter of variant.params ?? []) {
        const canEnterGuidedFacet = selectionFacets.some((facet) => facet.keyword && normalizeKey(parameter.name).includes(normalizeKey(facet.keyword)));
        if (canEnterGuidedFacet && isMalformedNumericParameter(parameter)) {
          issues.push(issue(product, category, "malformed_numeric", "warning", `«${parameter.name}» содержит значение «${formatParameter(parameter)}», которое нельзя безопасно использовать как размер.`));
        }
      }

      for (const facet of selectionFacets) {
        const rule = getCategorySelectionRule(product.category, facet.keyword);
        if (rule.mode !== "range" || !rule.minimumKeyword) continue;
        const maximum = firstNumericParameter(variant, facet.keyword);
        const minimum = firstNumericParameter(variant, rule.minimumKeyword);
        if (Number.isFinite(minimum) && Number.isFinite(maximum) && minimum > maximum) {
          issues.push(issue(product, category, "invalid_range", "critical", `${rule.minimumKeyword}: ${minimum}; ${facet.keyword}: ${maximum}.`, variant));
        }
      }

      const skuKey = normalizeKey(variant.sku);
      if (skuKey && duplicateSkus.has(skuKey)) {
        issues.push(issue(product, category, "duplicate_sku", "warning", `Артикул «${variant.sku}» встречается у ${duplicateSkus.get(skuKey)?.length} исполнений.`, variant));
      }
      const signature = variantSignature(product, variant);
      if (signature && duplicateSignatures.has(signature)) {
        issues.push(issue(product, category, "duplicate_signature", "notice", `Одинаковые название, бренд и параметры у ${duplicateSignatures.get(signature)?.length} исполнений.`, variant));
      }
    }
  }

  for (const entries of numericOutliers(numericInstances)) {
    for (const entry of entries) {
      const category = categoryBySlug.get(entry.categorySlug)!;
      issues.push(issue(entry.product, category, "numeric_outlier", "warning", `«${entry.parameter.name}»: ${formatParameter(entry.parameter)} заметно отличается от остальных значений этого же параметра.`, entry.variant));
    }
  }

  const deduplicatedIssues = Array.from(new Map(issues.map((entry) => [entry.id, entry])).values());
  const categories = publishedCategories.map((category) => buildCategoryQuality(category, publishedProducts.filter((product) => product.category === category.slug), deduplicatedIssues.filter((entry) => entry.categorySlug === category.slug), selectionKeywordsBySlug.get(category.slug) ?? []));
  const affectedProductIds = new Set(deduplicatedIssues.map((entry) => entry.productId));
  return {
    generatedFrom:"bundled-supplier-feed",
    categoryCount:categories.length,
    productCount:publishedProducts.length,
    variantCount:publishedProducts.reduce((sum, product) => sum + product.variants.length, 0),
    issueCount:deduplicatedIssues.length,
    affectedProductCount:affectedProductIds.size,
    statuses:{
      critical:categories.filter((category) => category.status === "critical").length,
      review:categories.filter((category) => category.status === "review").length,
      healthy:categories.filter((category) => category.status === "healthy").length,
    },
    categories:categories.sort((first, second) => statusRank(first.status) - statusRank(second.status) || first.score - second.score || first.title.localeCompare(second.title, "ru-RU")),
    issues:sortIssues(deduplicatedIssues),
  };
}

function buildCategoryQuality(category: FeedCategory, products: FeedProduct[], issues: CatalogQualityIssue[], selectionKeywords: string[]): CatalogQualityCategory {
  const variants = products.flatMap((product) => product.variants);
  const photoCoverage = percent(products.filter(hasProductImage).length, products.length);
  const priceCoverage = percent(variants.filter((variant) => typeof variant.price === "number" && variant.price > 0).length, variants.length);
  const skuCoverage = percent(variants.filter((variant) => Boolean(normalizeKey(variant.sku))).length, variants.length);
  const selectionCoverage = selectionKeywords.length === 0 ? null : percent(products.filter((product) => selectionKeywords.some((keyword) => product.variants.some((variant) => hasParameter(variant, keyword)))).length, products.length);
  const criticalParameterCoverage = selectionKeywords.length === 0 ? null : percent(products.reduce((sum, product) => sum + selectionKeywords.filter((keyword) => product.variants.some((variant) => hasParameter(variant, keyword))).length, 0), products.length * selectionKeywords.length);
  const score = Math.round(photoCoverage * .2 + priceCoverage * .25 + skuCoverage * .15 + (selectionCoverage ?? 100) * .25 + (criticalParameterCoverage ?? 100) * .15);
  const criticalCount = issues.filter((entry) => entry.severity === "critical").length;
  const warningCount = issues.filter((entry) => entry.severity === "warning").length;
  const noticeCount = issues.filter((entry) => entry.severity === "notice").length;
  const criticalThreshold = Math.max(1, Math.ceil(variants.length * .05));
  const status: CatalogQualityStatus = score < 60 || criticalCount >= criticalThreshold ? "critical" : score < 85 || warningCount > 0 ? "review" : "healthy";
  return {
    slug:category.slug,
    title:category.h1 ?? category.title,
    status,
    score,
    productCount:products.length,
    variantCount:variants.length,
    affectedProductCount:new Set(issues.map((entry) => entry.productId)).size,
    issueCount:issues.length,
    criticalCount,
    warningCount,
    noticeCount,
    metrics:{ photoCoverage, priceCoverage, skuCoverage, selectionCoverage, criticalParameterCoverage },
    selectionKeywords,
    issues:sortIssues(issues),
  };
}

function collectNumericInstances(products: FeedProduct[]): NumericInstance[] {
  const instances: NumericInstance[] = [];
  for (const product of products) for (const variant of product.variants) for (const parameter of variant.params ?? []) {
    if (!isMeasuredParameter(parameter.name)) continue;
    const numeric = parseNumeric(parameter.value);
    if (Number.isFinite(numeric) && numeric > 0) instances.push({ categorySlug:product.category, product, variant, parameter, numeric });
  }
  return instances;
}

function numericOutliers(instances: NumericInstance[]): NumericInstance[][] {
  const groups = new Map<string, NumericInstance[]>();
  for (const instance of instances) {
    const key = `${instance.categorySlug}|${normalizeKey(instance.parameter.name)}|${normalizeKey(instance.parameter.unit ?? "")}`;
    const group = groups.get(key);
    if (group) group.push(instance);
    else groups.set(key, [instance]);
  }
  return Array.from(groups.values()).filter((group) => group.length >= 8).map((group) => {
    const values = group.map((entry) => entry.numeric).sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)];
    if (!(median > 0)) return [];
    return group.filter((entry) => entry.numeric >= median * 1000 || entry.numeric <= median / 1000);
  }).filter((group) => group.length > 0);
}

function duplicateGroups(entries: Array<{ key: string; product: FeedProduct; variant: FeedVariant }>): Map<string, Array<{ product: FeedProduct; variant: FeedVariant }>> {
  const grouped = new Map<string, Array<{ product: FeedProduct; variant: FeedVariant }>>();
  for (const entry of entries) {
    if (!entry.key) continue;
    const group = grouped.get(entry.key);
    if (group) group.push({ product:entry.product, variant:entry.variant });
    else grouped.set(entry.key, [{ product:entry.product, variant:entry.variant }]);
  }
  return new Map(Array.from(grouped.entries()).filter(([, values]) => new Set(values.map((value) => value.variant.id)).size > 1));
}

function variantSignature(product: FeedProduct, variant: FeedVariant): string {
  const parameters = (variant.params ?? []).map((parameter) => `${normalizeKey(parameter.name)}=${normalizeKey(formatParameter(parameter))}`).sort();
  if (parameters.length === 0) return "";
  return `${product.category}|${normalizeKey(product.brand)}|${normalizeKey(product.title)}|${parameters.join("|")}`;
}

function issue(product: FeedProduct, category: FeedCategory, code: CatalogQualityIssueCode, severity: CatalogQualitySeverity, detail: string, variant?: FeedVariant): CatalogQualityIssue {
  return {
    id:`${category.slug}:${product.id}:${variant?.id ?? "product"}:${code}`,
    code,
    severity,
    categorySlug:category.slug,
    categoryTitle:category.h1 ?? category.title,
    productId:product.id,
    productSlug:product.slug,
    productTitle:product.title,
    brand:product.brand,
    variantId:variant?.id,
    sku:variant?.sku || product.sku || undefined,
    title:issueLabels[code],
    detail,
  };
}

function hasProductImage(product: FeedProduct): boolean {
  return (product.images ?? []).some(Boolean) || product.variants.some((variant) => (variant.images ?? []).some(Boolean));
}

function hasParameter(variant: FeedVariant, keyword: string): boolean {
  const normalizedKeyword = normalizeKey(keyword);
  return (variant.params ?? []).some((parameter) => normalizeKey(parameter.name).includes(normalizedKeyword) && Boolean(String(parameter.value ?? "").trim()));
}

function firstNumericParameter(variant: FeedVariant, keyword: string): number {
  const parameter = (variant.params ?? []).find((entry) => normalizeKey(entry.name).includes(normalizeKey(keyword)));
  return parseNumeric(parameter?.value);
}

function isMalformedNumericParameter(parameter: FeedParameter): boolean {
  if (!isMeasuredParameter(parameter.name)) return false;
  if (/резьб|угол/iu.test(parameter.name)) return false;
  const value = String(parameter.value ?? "").trim();
  if (/^(?:h|js|it)\d+$/iu.test(value)) return true;
  if (/\/\s*[+\-−–]\s*\d/u.test(value) || /\d\s*\/\s*[+\-−–]/u.test(value)) return true;
  const numeric = parseNumeric(value);
  return /^-?\d+(?:[.,]\d+)?$/u.test(value) && Number.isFinite(numeric) && numeric <= 0;
}

function isMeasuredParameter(name: string): boolean {
  return /(диаметр|длина|ширина|толщина|мощность|производительность|объ[её]м|масса|грузопод|усилие|радиус|охват|частота|скорость|напряжение|ход|поле|размер)/iu.test(name);
}

function parseNumeric(value: unknown): number {
  const match = String(value ?? "").replace(",", ".").match(/-?\d+(?:\.\d+)?/u);
  const parsed = Number.parseFloat(match?.[0] ?? "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatParameter(parameter: FeedParameter): string {
  return `${parameter.value}${parameter.unit ? ` ${parameter.unit}` : ""}`.trim();
}

function normalizeKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/gu, " ");
}

function percent(value: number, total: number): number {
  return total > 0 ? Math.round(value / total * 100) : 100;
}

function statusRank(status: CatalogQualityStatus): number {
  return ({ critical:0, review:1, healthy:2 })[status];
}

function sortIssues(issues: CatalogQualityIssue[]): CatalogQualityIssue[] {
  const rank: Record<CatalogQualitySeverity, number> = { critical:0, warning:1, notice:2 };
  return [...issues].sort((first, second) => rank[first.severity] - rank[second.severity] || first.categoryTitle.localeCompare(second.categoryTitle, "ru-RU") || first.productTitle.localeCompare(second.productTitle, "ru-RU"));
}
