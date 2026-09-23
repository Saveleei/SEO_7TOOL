import { getCategoryExpertProfile, selectCategoryFacets } from "./categoryExpertProfiles.mjs";
import { getCategoryFamily, getCategoryFamilyShortcuts } from "./categoryAssortmentTaxonomy.mjs";
import { getCategorySelectionRule } from "./categorySelection.mjs";
import { classifyMissingProductMedia } from "./catalogMediaRecovery.mjs";
import { feedParameterMatchesFacetKeyword, getFeedCategoryPage, getFeedCategoryProductType, getFeedCategorySegment, getFeedCategorySubsegment, getFeedProductImage, getPublishedFeedCatalogSnapshot, type FeedCategory, type FeedCategoryQuery, type FeedFacet, type FeedParameter, type FeedProduct, type FeedVariant } from "./feedCatalog.ts";
import { getFeedDecisionParameters } from "./feedDecisionParameters.mjs";

export type CatalogQualityStatus = "critical" | "review" | "healthy";
export type CatalogQualitySeverity = "critical" | "warning" | "notice";
export type CatalogQualityPriority = "p0" | "p1" | "p2";
export type CatalogQualityIssueCode =
  | "missing_identifier"
  | "duplicate_identifier"
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
  priority: CatalogQualityPriority;
  categorySlug: string;
  categoryTitle: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  brand: string;
  familyId?: string;
  familyLabel?: string;
  scopeHref?: string;
  scopeLabel?: string;
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
  priorities: Record<CatalogQualityPriority, { issueCount: number; affectedProductCount: number }>;
  categories: CatalogQualityCategory[];
  issues: CatalogQualityIssue[];
};

type NumericInstance = { categorySlug: string; selectionScope: string; product: FeedProduct; variant: FeedVariant; parameter: FeedParameter; numeric: number };
type ProductSelectionProfile = {
  mode: "guided" | "engineer";
  familyId?: string;
  familyLabel?: string;
  scopeHref?: string;
  scopeLabel?: string;
  facets: FeedFacet[];
  keywords: string[];
};

const feedSnapshot = getPublishedFeedCatalogSnapshot();
const publishedCategories = feedSnapshot.categories;
const publishedProducts = feedSnapshot.products;
const categoryBySlug = new Map(publishedCategories.map((category) => [category.slug, category]));
const issueLabels: Record<CatalogQualityIssueCode, string> = {
  missing_identifier:"Нет устойчивого кода исполнения",
  duplicate_identifier:"Код исполнения используется повторно",
  missing_sku:"Нет публичного артикула исполнения",
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
const issuePriorities: Record<CatalogQualityIssueCode, CatalogQualityPriority> = {
  missing_identifier:"p0",
  duplicate_identifier:"p0",
  missing_sku:"p2",
  invalid_range:"p0",
  duplicate_sku:"p0",
  malformed_numeric:"p1",
  numeric_outlier:"p1",
  missing_image:"p1",
  not_filterable:"p1",
  missing_price:"p2",
  missing_parameter:"p2",
  duplicate_signature:"p2",
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
  const selectionProfilesByProduct = buildProductSelectionProfiles();
  const numericInstances = collectNumericInstances(publishedProducts, selectionProfilesByProduct);
  const duplicateIdentifiers = duplicateIdentityGroups(publishedProducts.flatMap((product) => product.variants.map((variant) => ({
    key:normalizeKey(variant.id), product, variant,
  }))));
  const duplicateSkus = duplicateGroups(publishedProducts.flatMap((product) => product.variants.map((variant) => ({
    key:scopedSkuKey(product, variant), product, variant,
  }))));
  const duplicateSignatures = duplicateGroups(publishedProducts.flatMap((product) => product.variants.map((variant) => ({
    key:variantSignature(product, variant), product, variant,
  }))));

  for (const product of publishedProducts) {
    const category = categoryBySlug.get(product.category)!;
    const selectionProfile = selectionProfilesByProduct.get(product.id) ?? emptySelectionProfile;
    const selectionFacets = selectionProfile.facets;
    const selectionKeywords = selectionProfile.keywords;

    if (!hasProductImage(product)) {
      const recovery = classifyMissingProductMedia(product);
      issues.push(issue(product, category, "missing_image", "warning", `${recovery.label}. ${recovery.instruction}`));
    }

    if (selectionProfile.mode === "guided") {
      const context = { familyId:selectionProfile.familyId, familyLabel:selectionProfile.familyLabel, scopeHref:selectionProfile.scopeHref, scopeLabel:selectionProfile.scopeLabel };
      const missingKeywords = selectionKeywords.filter((keyword) => !product.variants.some((variant) => hasParameter(product, variant, keyword)));
      if (selectionKeywords.length === 0) {
        issues.push(issue(product, category, "not_filterable", "warning", `${selectionContext(selectionProfile)}не найдено ни одной надёжной характеристики для самостоятельного подбора.`, undefined, context));
      } else {
        if (missingKeywords.length > 0) {
          issues.push(issue(product, category, "missing_parameter", "notice", `${selectionContext(selectionProfile)}нет ${formatKeywordList(missingKeywords)} из решающих параметров этой подкатегории.`, undefined, context));
        }
        if (missingKeywords.length === selectionKeywords.length) {
          issues.push(issue(product, category, "not_filterable", "warning", `${selectionContext(selectionProfile)}ни один из решающих параметров не может привести к этому товару.`, undefined, context));
        }
      }
    }

    for (const variant of product.variants) {
      const identifierKey = normalizeKey(variant.id);
      const publicSku = variantPublicSku(product, variant);
      if (!identifierKey) {
        issues.push(issue(product, category, "missing_identifier", "critical", "Исполнение нельзя надёжно сохранить в КП или связать с исходной записью фида.", variant));
      } else if (duplicateIdentifiers.has(identifierKey)) {
        issues.push(issue(product, category, "duplicate_identifier", "critical", `Код фида «${variant.id}» встречается у ${duplicateIdentifiers.get(identifierKey)?.length} исполнений.`, variant));
      }
      if (!normalizeKey(publicSku)) {
        const identityDetail = identifierKey
          ? `Код фида «${variant.id}» сохраняет однозначность позиции в КП; публичный артикул нужно подтвердить в источнике поставщика.`
          : "Публичный артикул нужно подтвердить в источнике поставщика.";
        issues.push(issue(product, category, "missing_sku", "notice", identityDetail, variant));
      }
      if (!(typeof variant.price === "number" && variant.price > 0)) issues.push(issue(product, category, "missing_price", "warning", "На витрине будет показано «Цена по запросу».", variant));

      for (const parameter of getFeedDecisionParameters(product, variant)) {
        const canEnterGuidedFacet = selectionFacets.some((facet) => facet.keyword && parameterMatchesKeyword(parameter.name, facet.keyword));
        if (canEnterGuidedFacet && isMalformedNumericParameter(parameter)) {
          issues.push(issue(product, category, "malformed_numeric", "warning", `«${parameter.name}» содержит значение «${formatParameter(parameter)}», которое нельзя безопасно использовать как размер.`));
        }
      }

      for (const facet of selectionFacets) {
        const rule = getCategorySelectionRule(product.category, facet.keyword);
        if (rule.mode !== "range" || !rule.minimumKeyword) continue;
        const maximum = firstNumericParameter(product, variant, facet.keyword);
        const minimum = firstNumericParameter(product, variant, rule.minimumKeyword);
        if (Number.isFinite(minimum) && Number.isFinite(maximum) && minimum > maximum) {
          issues.push(issue(product, category, "invalid_range", "critical", `${rule.minimumKeyword}: ${minimum}; ${facet.keyword}: ${maximum}.`, variant));
        }
      }

      const skuKey = scopedSkuKey(product, variant);
      if (skuKey && duplicateSkus.has(skuKey)) {
        const brandScope = product.brand ? ` бренда «${product.brand}»` : " без указанного бренда";
        issues.push(issue(product, category, "duplicate_sku", "warning", `Артикул «${publicSku}» встречается у ${duplicateSkus.get(skuKey)?.length} исполнений${brandScope}.`, variant));
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
  const categories = publishedCategories.map((category) => buildCategoryQuality(category, publishedProducts.filter((product) => product.category === category.slug), deduplicatedIssues.filter((entry) => entry.categorySlug === category.slug), selectionProfilesByProduct));
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
    priorities:{
      p0:prioritySummary(deduplicatedIssues, "p0"),
      p1:prioritySummary(deduplicatedIssues, "p1"),
      p2:prioritySummary(deduplicatedIssues, "p2"),
    },
    categories:categories.sort((first, second) => statusRank(first.status) - statusRank(second.status) || first.score - second.score || first.title.localeCompare(second.title, "ru-RU")),
    issues:sortIssues(deduplicatedIssues),
  };
}

function buildCategoryQuality(category: FeedCategory, products: FeedProduct[], issues: CatalogQualityIssue[], selectionProfilesByProduct: Map<string, ProductSelectionProfile>): CatalogQualityCategory {
  const variants = products.flatMap((product) => product.variants);
  const guidedProfiles = products.map((product) => ({ product, profile:selectionProfilesByProduct.get(product.id) ?? emptySelectionProfile })).filter(({ profile }) => profile.mode === "guided");
  const selectionKeywords = Array.from(new Set(guidedProfiles.flatMap(({ profile }) => profile.keywords)));
  const photoCoverage = percent(products.filter(hasProductImage).length, products.length);
  const priceCoverage = percent(variants.filter((variant) => typeof variant.price === "number" && variant.price > 0).length, variants.length);
  const skuCoverage = percent(products.flatMap((product) => product.variants.map((variant) => ({ product, variant }))).filter(({ product, variant }) => Boolean(normalizeKey(variantPublicSku(product, variant)))).length, variants.length);
  const selectionCoverage = guidedProfiles.length === 0 ? null : percent(guidedProfiles.filter(({ product, profile }) => profile.keywords.some((keyword) => product.variants.some((variant) => hasParameter(product, variant, keyword)))).length, guidedProfiles.length);
  const expectedParameterCount = guidedProfiles.reduce((sum, { profile }) => sum + profile.keywords.length, 0);
  const presentParameterCount = guidedProfiles.reduce((sum, { product, profile }) => sum + profile.keywords.filter((keyword) => product.variants.some((variant) => hasParameter(product, variant, keyword))).length, 0);
  const criticalParameterCoverage = guidedProfiles.length === 0 ? null : expectedParameterCount === 0 ? 0 : percent(presentParameterCount, expectedParameterCount);
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

function collectNumericInstances(products: FeedProduct[], selectionProfilesByProduct: Map<string, ProductSelectionProfile>): NumericInstance[] {
  const instances: NumericInstance[] = [];
  for (const product of products) for (const variant of product.variants) for (const parameter of getFeedDecisionParameters(product, variant)) {
    if (!isSelectionNumericParameter(parameter.name)) continue;
    const numeric = parseNumeric(parameter.value);
    const profile = selectionProfilesByProduct.get(product.id) ?? emptySelectionProfile;
    const selectionScope = profile.familyId ?? profile.scopeHref ?? product.category;
    if (Number.isFinite(numeric) && numeric > 0) instances.push({ categorySlug:product.category, selectionScope, product, variant, parameter, numeric });
  }
  return instances;
}

function numericOutliers(instances: NumericInstance[]): NumericInstance[][] {
  const groups = new Map<string, NumericInstance[]>();
  for (const instance of instances) {
    const key = `${instance.categorySlug}|${instance.selectionScope}|${normalizeKey(instance.parameter.name)}|${normalizeKey(instance.parameter.unit ?? "")}`;
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

function duplicateIdentityGroups(entries: Array<{ key: string; product: FeedProduct; variant: FeedVariant }>): Map<string, Array<{ product: FeedProduct; variant: FeedVariant }>> {
  const grouped = new Map<string, Array<{ product: FeedProduct; variant: FeedVariant }>>();
  for (const entry of entries) {
    if (!entry.key) continue;
    const group = grouped.get(entry.key);
    if (group) group.push({ product:entry.product, variant:entry.variant });
    else grouped.set(entry.key, [{ product:entry.product, variant:entry.variant }]);
  }
  return new Map(Array.from(grouped.entries()).filter(([, values]) => values.length > 1));
}

function scopedSkuKey(product: FeedProduct, variant: FeedVariant): string {
  const sku = normalizeKey(variantPublicSku(product, variant));
  return sku ? `${normalizeKey(product.brand)}::${sku}` : "";
}

function variantPublicSku(product: FeedProduct, variant: FeedVariant): string {
  if (normalizeKey(variant.sku)) return String(variant.sku);
  return product.variants.length === 1 ? String(product.sku ?? "") : "";
}

function variantSignature(product: FeedProduct, variant: FeedVariant): string {
  const parameters = (variant.params ?? []).map((parameter) => `${normalizeKey(parameter.name)}=${normalizeKey(formatParameter(parameter))}`).sort();
  if (parameters.length === 0) return "";
  return `${product.category}|${normalizeKey(product.brand)}|${normalizeKey(product.title)}|${parameters.join("|")}`;
}

function issue(product: FeedProduct, category: FeedCategory, code: CatalogQualityIssueCode, severity: CatalogQualitySeverity, detail: string, variant?: FeedVariant, context?: Pick<ProductSelectionProfile, "familyId" | "familyLabel" | "scopeHref" | "scopeLabel">): CatalogQualityIssue {
  return {
    id:`${category.slug}:${product.id}:${variant?.id ?? "product"}:${code}`,
    code,
    severity,
    priority:issuePriorities[code],
    categorySlug:category.slug,
    categoryTitle:category.h1 ?? category.title,
    productId:product.id,
    productSlug:product.slug,
    productTitle:product.title,
    brand:product.brand,
    familyId:context?.familyId,
    familyLabel:context?.familyLabel,
    scopeHref:context?.scopeHref,
    scopeLabel:context?.scopeLabel,
    variantId:variant?.id,
    sku:variant ? variantPublicSku(product, variant) || undefined : product.sku || undefined,
    title:issueLabels[code],
    detail,
  };
}

function prioritySummary(issues: CatalogQualityIssue[], priority: CatalogQualityPriority): { issueCount: number; affectedProductCount: number } {
  const matching = issues.filter((entry) => entry.priority === priority);
  return { issueCount:matching.length, affectedProductCount:new Set(matching.map((entry) => entry.productId)).size };
}

const emptySelectionProfile: ProductSelectionProfile = { mode:"engineer", facets:[], keywords:[] };

function buildProductSelectionProfiles(): Map<string, ProductSelectionProfile> {
  const profiles = new Map<string, ProductSelectionProfile>();
  for (const category of publishedCategories) {
    const categoryProducts = publishedProducts.filter((product) => product.category === category.slug);
    const categorySelectionMode = getCategoryExpertProfile(category.slug).selectionMode ?? "guided";
    const structuralGroups = new Map<string, { target: StructuralSelectionTarget; products: FeedProduct[] }>();
    for (const product of categoryProducts) {
      const familyId = getCategoryFamily(category.slug, product);
      const familyShortcut = getCategoryFamilyShortcuts(category.slug)?.assortmentShortcuts.find((shortcut) => shortcut.family === familyId);
      if ((familyShortcut?.selectionMode ?? categorySelectionMode) === "engineer") continue;
      const target = structuralSelectionTarget(category.slug, product);
      if (!target) continue;
      const group = structuralGroups.get(target.scopeHref);
      if (group) group.products.push(product);
      else structuralGroups.set(target.scopeHref, { target, products:[product] });
    }
    for (const { target, products } of structuralGroups.values()) {
      const mode = target.selectionMode === "engineer" ? "engineer" : "guided";
      const page = getFeedCategoryPage(category.slug, { ...target.query, pageSize:48 });
      const facets = mode === "engineer"
        ? []
        : selectCategoryFacets(category.slug, page.facets.filter((facet) => facet.keyword), decisionFacetLimit(category.slug), target.promotedFacetKeywords);
      const profile: ProductSelectionProfile = { mode, scopeHref:target.scopeHref, scopeLabel:target.scopeLabel, facets, keywords:facets.map((facet) => facet.keyword).filter(Boolean) };
      for (const product of products) profiles.set(product.id, profile);
    }

    const shortcuts = getCategoryFamilyShortcuts(category.slug)?.assortmentShortcuts ?? [];
    for (const shortcut of shortcuts) {
      const familyProducts = categoryProducts.filter((product) => !profiles.has(product.id) && getCategoryFamily(category.slug, product) === shortcut.family);
      if (familyProducts.length === 0) continue;
      const mode = (shortcut.selectionMode ?? categorySelectionMode) === "engineer" ? "engineer" : "guided";
      const page = getFeedCategoryPage(category.slug, { family:shortcut.family, pageSize:48 });
      const facets = mode === "engineer"
        ? []
        : selectCategoryFacets(category.slug, page.facets.filter((facet) => facet.keyword), decisionFacetLimit(category.slug), shortcut.promotedFacetKeywords);
      const profile: ProductSelectionProfile = {
        mode,
        familyId:shortcut.family,
        familyLabel:shortcut.label,
        scopeHref:`/catalog/category/${category.slug}?family=${encodeURIComponent(shortcut.family)}`,
        scopeLabel:shortcut.label,
        facets,
        keywords:facets.map((facet) => facet.keyword).filter(Boolean),
      };
      for (const product of familyProducts) profiles.set(product.id, profile);
    }

    const unclassifiedProducts = categoryProducts.filter((product) => !profiles.has(product.id));
    if (unclassifiedProducts.length > 0) {
      const page = getFeedCategoryPage(category.slug, { pageSize:48 });
      const mode = categorySelectionMode === "engineer" ? "engineer" : "guided";
      const facets = mode === "engineer" ? [] : selectCategoryFacets(category.slug, page.facets.filter((facet) => facet.keyword), decisionFacetLimit(category.slug));
      const profile: ProductSelectionProfile = { mode, facets, keywords:facets.map((facet) => facet.keyword).filter(Boolean) };
      for (const product of unclassifiedProducts) profiles.set(product.id, profile);
    }
  }
  return profiles;
}

type StructuralSelectionTarget = {
  query: Pick<FeedCategoryQuery, "productType" | "segment" | "subsegment">;
  selectionMode?: "guided" | "engineer";
  promotedFacetKeywords?: string[];
  scopeHref: string;
  scopeLabel: string;
};

function structuralSelectionTarget(slug: string, product: FeedProduct): StructuralSelectionTarget | undefined {
  const profile = getCategoryExpertProfile(slug);
  const productType = getFeedCategoryProductType(slug, product);
  const segment = getFeedCategorySegment(slug, product);
  const subsegment = getFeedCategorySubsegment(slug, product);
  const segmentShortcut = profile.assortmentShortcuts?.find((shortcut) => shortcut.segment === segment);
  const subsegmentShortcut = segmentShortcut?.subsegments?.find((shortcut) => shortcut.id === subsegment);
  if (segmentShortcut && subsegmentShortcut && segment && subsegment) {
    return {
      query:{ productType, segment, subsegment },
      selectionMode:subsegmentShortcut.selectionMode ?? segmentShortcut.selectionMode ?? profile.selectionMode,
      promotedFacetKeywords:subsegmentShortcut.promotedFacetKeywords ?? segmentShortcut.promotedFacetKeywords,
      scopeHref:`/catalog/category/${slug}?segment=${encodeURIComponent(segment)}&drill_type=${encodeURIComponent(subsegment)}`,
      scopeLabel:`${segmentShortcut.label} · ${subsegmentShortcut.label}`,
    };
  }
  if (segmentShortcut && segment) {
    return {
      query:{ productType, segment },
      selectionMode:segmentShortcut.selectionMode ?? profile.selectionMode,
      promotedFacetKeywords:segmentShortcut.promotedFacetKeywords,
      scopeHref:`/catalog/category/${slug}?segment=${encodeURIComponent(segment)}`,
      scopeLabel:segmentShortcut.label,
    };
  }
  const productTypeShortcut = profile.assortmentShortcuts?.find((shortcut) => shortcut.productType === productType);
  if (productTypeShortcut && productType) {
    return {
      query:{ productType },
      selectionMode:productTypeShortcut.selectionMode ?? profile.selectionMode,
      promotedFacetKeywords:productTypeShortcut.promotedFacetKeywords,
      scopeHref:`/catalog/category/${slug}?kind=${encodeURIComponent(productType)}`,
      scopeLabel:productTypeShortcut.label,
    };
  }
  return undefined;
}

function decisionFacetLimit(slug: string): number {
  if (slug === "koronchatye-sverla") return 4;
  return ["sverla-i-zenkovki", "borfrezy", "stanki-sverlilnye", "lentochnopilnye-stanki"].includes(slug) ? 3 : 2;
}

function selectionContext(profile: ProductSelectionProfile): string {
  return profile.scopeLabel ? `В подкатегории «${profile.scopeLabel}» ` : profile.familyLabel ? `В подкатегории «${profile.familyLabel}» ` : "";
}

function formatKeywordList(keywords: string[]): string {
  return keywords.map((keyword) => `«${keyword}»`).join(", ");
}

function hasProductImage(product: FeedProduct): boolean {
  return Boolean(getFeedProductImage(product));
}

function hasParameter(product: FeedProduct, variant: FeedVariant, keyword: string): boolean {
  return getFeedDecisionParameters(product, variant).some((parameter) => parameterMatchesKeyword(parameter.name, keyword) && Boolean(String(parameter.value ?? "").trim()));
}

function firstNumericParameter(product: FeedProduct, variant: FeedVariant, keyword: string): number {
  const parameter = getFeedDecisionParameters(product, variant).find((entry) => parameterMatchesKeyword(entry.name, keyword));
  return parseNumeric(parameter?.value);
}

function isMalformedNumericParameter(parameter: FeedParameter): boolean {
  if (!isSelectionNumericParameter(parameter.name)) return false;
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

function isSelectionNumericParameter(name: string): boolean {
  return isMeasuredParameter(name) && !/(допуск|отклонени|точност|квалитет|посадк)/iu.test(name);
}

function parameterMatchesKeyword(name: string, keyword: string): boolean {
  const normalizedName = normalizeKey(name);
  const normalizedKeyword = normalizeKey(keyword);
  if (!normalizedKeyword || !feedParameterMatchesFacetKeyword(name, keyword)) return false;
  const disambiguators = ["допуск", "отклонени", "точност", "квалитет", "посадк"];
  return !disambiguators.some((term) => normalizedName.includes(term) && !normalizedKeyword.includes(term));
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
