import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "../../../ui/Breadcrumbs";
import { JsonLd } from "../../../ui/JsonLd";
import { BurrSelectionAssistant } from "../../../ui/BurrSelectionAssistant";
import { BurrShapeMark } from "../../../ui/BurrShapeMark";
import { CategorySelectionAssistant } from "../../../ui/CategorySelectionAssistant";
import { DrillSelectionAssistant } from "../../../ui/DrillSelectionAssistant";
import { FeedProductList } from "../../../ui/FeedProductList";
import { FeedProductTable } from "../../../ui/FeedProductTable";
import { HomepageCategoryMedia } from "../../../ui/HomepageCategoryMedia";
import { ManagerContactCard } from "../../../ui/ManagerContactCard";
import { OpenFullFiltersLink, PromotedFilterLink } from "../../../ui/PromotedFilterControls";
import { PilotFooter } from "../../../ui/PilotFooter";
import { PilotHeader } from "../../../ui/PilotHeader";
import { SelectionConversionBlock } from "../../../ui/SelectionConversionBlock";
import { SocialShareButton } from "../../../ui/SocialShareButton";
import { TestRequestForm } from "../../../ui/TestRequestForm";
import { AutoApplyFilterPanel, AutoApplySortForm } from "../../../ui/AutoApplyFilters";
import { buildCategoryQueryContext, findCategorySelectionOption, getCategorySelectionRule } from "../../../data/categorySelection.mjs";
import { getCategoryExpertProfile, selectCategoryAssistantFacets, selectCategoryFacets } from "../../../data/categoryExpertProfiles.mjs";
import { getFeedCategory, getFeedCategoryPage, getFeedCategoryProductCountForQuery, getFeedCategoryProductType, getFeedCategoryRecoverySuggestions, getFeedProductImage, getFeedTableColumns, getGuidedFacetOptions, getPromotedFacetOptions, prefersDenseFeedTable, type FeedCategoryQuery, type FeedCategorySegment, type FeedCategorySort, type FeedCategorySubsegment, type FeedFacet, type FeedProductType, type FeedVariantFilter, toFeedProductCardModel } from "../../../data/feedCatalog";
import { getProductionSubcategory } from "../../../data/productionCategoryGroups";
import { getShippingRuntimeDiagnostic } from "../../../data/shippingRuntimeSettings.mjs";
import { canonicalUrl, createPublicMetadata, hasSearchParameters } from "../../../data/seo";
import { buildCategorySeoKeywords } from "../../../data/seoKeywords";
import { requestedSocialCardSharePath, socialCardMetadataImage, socialCardSharePath } from "../../../data/socialCards";
import { publicProductPath } from "../../../data/publicUrls";

type SearchValue = string | string[] | undefined;
type SearchParams = Record<string, SearchValue>;
type RouteProps = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };
type AssortmentShortcut = {
  label: string;
  copy: string;
  heroTitle?: string;
  heroIntro?: string;
  listingTitle?: string;
  selectorTitle?: string;
  selectorIntro?: string;
  selectionMode?: "guided" | "engineer";
  promotedFacetKeywords?: string[];
  scopeGuidance?: ScopeGuidance;
  criteriaTitle?: string;
  criteriaIntro?: string;
  criteria?: Array<{ title: string; copy: string }>;
  query?: string;
  productType?: FeedProductType;
  segment?: FeedCategorySegment;
  family?: string;
  secondary?: boolean;
  subsegments?: Array<{ id: FeedCategorySubsegment; label: string; copy: string; heroTitle?: string; heroIntro?: string; listingTitle?: string; selectionMode?: "guided" | "engineer"; promotedFacetKeywords?: string[]; scopeGuidance?: ScopeGuidance; criteriaTitle?: string; criteriaIntro?: string; criteria?: Array<{ title: string; copy: string }> }>;
};

type ScopeGuidance = { bestFor: string; checkFirst: string; compareBy: string };

const sortOptions: Array<{ value: FeedCategorySort; label: string }> = [
  { value:"relevance", label:"Сначала подходящие" },
  { value:"price-asc", label:"Сначала дешевле" },
  { value:"price-desc", label:"Сначала дороже" },
  { value:"name", label:"По названию" },
];

const drillAssortmentOrder = ["spiral", "taper-shank", "cylindrical-shank", "carbide", "replaceable", "range", "step", "countersink", "counterbore", "deep", "thermdrill", "sets", "unidentified", "special"];

export async function generateMetadata({ params, searchParams }: RouteProps): Promise<Metadata> {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const entry = getProductionSubcategory(slug);
  const category = getFeedCategory(slug);
  const title = category?.h1 ?? entry?.subcategory.label;
  const metadataTitle = title ? `${title} — купить с подбором и доставкой | 7TOOL` : "Категория оборудования — 7TOOL";
  const description = category?.intro ?? (entry ? `${entry.subcategory.label}: инженерный подбор, характеристики, ориентиры цены и подтверждение условий поставки.` : "Категория промышленного оборудования 7TOOL.");
  const pagePath = `/c/${slug}`;
  return createPublicMetadata({
    title:metadataTitle,
    description,
    path:pagePath,
    indexable:Boolean(entry && category) && !hasSearchParameters(rawSearchParams),
    image:entry && category ? socialCardMetadataImage("category", `${title} — изображение категории 7TOOL`, slug) : undefined,
    socialPath:requestedSocialCardSharePath(pagePath, firstValue(rawSearchParams.share), "category", slug),
    keywords:buildCategorySeoKeywords({ slug, title:category?.title ?? entry?.subcategory.label, h1:category?.h1 }),
  });
}

export default async function SubcategoryPage({ params, searchParams }: RouteProps) {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const entry = getProductionSubcategory(slug);
  if (!entry) notFound();

  const { group, subcategory } = entry;
  const profile = getCategoryExpertProfile(slug);
  const feedCategory = getFeedCategory(slug);
  const search = firstValue(rawSearchParams.q)?.trim() ?? "";
  const profileShortcuts = (profile.assortmentShortcuts ?? []) as AssortmentShortcut[];
  const supportedProductTypes = new Set(profileShortcuts.flatMap((shortcut) => shortcut.productType ? [shortcut.productType] : []));
  if (profile.defaultProductType === "equipment" || profile.defaultProductType === "accessories") supportedProductTypes.add(profile.defaultProductType);
  const defaultProductType = supportedProductTypes.has(profile.defaultProductType) ? profile.defaultProductType as FeedProductType : undefined;
  const requestedProductType = firstValue(rawSearchParams.kind);
  const productType = requestedProductType === "all"
    ? undefined
    : supportedProductTypes.has(requestedProductType as FeedProductType)
      ? requestedProductType as FeedProductType
      : defaultProductType;
  const productTypeChanged = Boolean(productType && productType !== defaultProductType);
  const browsingAccessories = productType === "accessories";
  const supportedSegments = new Set(profileShortcuts.flatMap((shortcut) => shortcut.segment ? [shortcut.segment] : []));
  const requestedSegment = firstValue(rawSearchParams.segment);
  const segment = supportedSegments.has(requestedSegment as FeedCategorySegment) ? requestedSegment as FeedCategorySegment : undefined;
  const segmentShortcut = profileShortcuts.find((shortcut) => shortcut.segment === segment);
  const supportedSubsegments = new Set(segmentShortcut?.subsegments?.map((item) => item.id) ?? []);
  const requestedSubsegment = firstValue(rawSearchParams.drill_type);
  const subsegment = supportedSubsegments.has(requestedSubsegment as FeedCategorySubsegment) ? requestedSubsegment as FeedCategorySubsegment : undefined;
  const supportedFamilies = new Set(profileShortcuts.flatMap((shortcut) => shortcut.family ? [shortcut.family] : []));
  const requestedFamily = firstValue(rawSearchParams.family);
  const family = supportedFamilies.has(requestedFamily ?? "") ? requestedFamily : undefined;
  const requestedSort = firstValue(rawSearchParams.sort);
  const sort = sortOptions.some((option) => option.value === requestedSort) ? requestedSort as FeedCategorySort : "relevance";
  const requestedPage = Number.parseInt(firstValue(rawSearchParams.page) ?? "1", 10);
  const requestedView = firstValue(rawSearchParams.view);
  const shippingDiagnostic = getShippingRuntimeDiagnostic();
  const availabilityFilterEnabled = shippingDiagnostic.fresh && shippingDiagnostic.settings.todayShippingEnabled;
  const inStockOnly = availabilityFilterEnabled && firstValue(rawSearchParams.availability) === "in-stock";
  const filters = Object.fromEntries(Object.entries(rawSearchParams)
    .filter(([key]) => key.startsWith("f_"))
    .map(([key, value]) => [key.slice(2), valuesOf(value).filter(Boolean)]));
  const numericMinimums = Object.fromEntries(Object.entries(rawSearchParams)
    .filter(([key]) => key.startsWith("min_"))
    .map(([key, value]) => [key.slice(4), Number.parseFloat(firstValue(value) ?? "")])
    .filter((entry): entry is [string, number] => Number.isFinite(entry[1]) && entry[1] > 0));
  const numericMaximums = Object.fromEntries(Object.entries(rawSearchParams)
    .filter(([key]) => key.startsWith("max_"))
    .map(([key, value]) => [key.slice(4), Number.parseFloat(firstValue(value) ?? "")])
    .filter((entry): entry is [string, number] => Number.isFinite(entry[1]) && entry[1] > 0));
  const categoryQuery: FeedCategoryQuery = { search, sort, page:Number.isFinite(requestedPage) ? requestedPage : 1, filters, numericMinimums, numericMaximums, availability:inStockOnly ? "in-stock" : undefined, productType, segment, subsegment, family };
  const result = getFeedCategoryPage(slug, categoryQuery);
  if (rawSearchParams.page !== undefined && (!Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage > result.pageCount)) notFound();
  const recoverySuggestions = result.total === 0 ? getFeedCategoryRecoverySuggestions(slug, categoryQuery) : [];
  const activeVariantFilters = result.facets.flatMap((facet) => {
    if (!facet.keyword) return [];
    const facetFilters: FeedVariantFilter[] = [];
    if ((filters[facet.key]?.length ?? 0) > 0) facetFilters.push({ keyword:facet.keyword, label:facet.label, values:filters[facet.key] });
    if (Number.isFinite(numericMinimums[facet.key])) facetFilters.push({ keyword:facet.keyword, label:facet.label, values:[], minimum:numericMinimums[facet.key] });
    if (Number.isFinite(numericMaximums[facet.key])) facetFilters.push({ keyword:facet.keyword, label:facet.label, values:[], maximum:numericMaximums[facet.key] });
    return facetFilters;
  });
  const productCards = result.products.map((product) => toFeedProductCardModel(product, activeVariantFilters, inStockOnly, getFeedCategoryProductType(slug, product) === "accessories" ? "fixtures" : undefined));
  const tableColumns = getFeedTableColumns(productCards);
  const canUseTable = prefersDenseFeedTable(slug);
  const view = requestedView === "grid" || requestedView === "cards" ? "grid" : "list";
  const activeFilterCount = Object.values(filters).reduce((sum, values) => sum + values.length, 0) + Object.keys(numericMinimums).length + Object.keys(numericMaximums).length + (search ? 1 : 0) + (inStockOnly ? 1 : 0) + (productTypeChanged ? 1 : 0) + (segment ? 1 : 0) + (subsegment ? 1 : 0) + (family ? 1 : 0);
  const selectorHref = slug === "borfrezy" ? "#burr-selector" : slug === "stanki-sverlilnye" ? "#drill-selector" : "#category-selector";
  const activeSelectorHref = browsingAccessories ? "#category-selector" : selectorHref;
  const start = result.total > 0 ? (result.page - 1) * result.pageSize + 1 : 0;
  const end = Math.min(result.page * result.pageSize, result.total);
  const technicalFacets = result.facets.filter((facet) => facet.keyword);
  const activeShortcut = profileShortcuts.find((shortcut) => Boolean(shortcut.segment) && shortcut.segment === segment
    || Boolean(shortcut.family) && shortcut.family === family
    || Boolean(shortcut.productType) && shortcut.productType === productType && productTypeChanged
    || Boolean(shortcut.query) && shortcut.query === search && Boolean(search));
  const activeSubsegment = activeShortcut?.subsegments?.find((item) => item.id === subsegment);
  const selectionMode = activeSubsegment?.selectionMode ?? activeShortcut?.selectionMode ?? (profile.selectionMode === "engineer" ? "engineer" : "guided");
  const engineerFirstSelection = selectionMode === "engineer";
  const promotedFacetPriorities = activeSubsegment?.promotedFacetKeywords ?? activeShortcut?.promotedFacetKeywords;
  const promotedFacetLimit = slug === "koronchatye-sverla" ? 4 : slug === "sverla-i-zenkovki" || slug === "borfrezy" || slug === "stanki-sverlilnye" || slug === "lentochnopilnye-stanki" ? 3 : 2;
  const promotedFacets = selectCategoryFacets(slug, result.facets, promotedFacetLimit, promotedFacetPriorities);
  const assistantFacets = selectCategoryAssistantFacets(slug, technicalFacets).map((facet) => {
    const rule = getCategorySelectionRule(slug, facet.keyword);
    const selectedOption = rule.mode === "exact"
      ? facet.options.find((option) => filters[facet.key]?.includes(option.value))
      : findCategorySelectionOption(facet.options, numericMinimums[facet.key]);
    const options = getGuidedFacetOptions(facet, 6, selectedOption ? [selectedOption.value] : []);
    const minimumFacet = rule.mode === "range"
      ? technicalFacets.find((candidate) => candidate.keyword === rule.minimumKeyword)
      : undefined;
    return {
      ...facet,
      options,
      selectionMode:rule.mode,
      minimumFacetKey:minimumFacet?.key,
      initialValue:selectedOption?.value,
      question:rule.question,
      selectionHint:rule.hint,
      hasMoreOptions:facet.options.length > options.length,
    };
  });
  const categoryTitle = activeSubsegment?.heroTitle ?? activeShortcut?.heroTitle ?? feedCategory?.h1 ?? subcategory.label;
  const sharePath = socialCardSharePath(`/c/${slug}`, "category", slug);
  const categoryIntro = activeSubsegment?.heroIntro ?? activeShortcut?.heroIntro ?? profile.heroIntro;
  const activeQueryContext = buildCategoryQueryContext(categoryTitle, result.facets, categoryQuery);
  const shapeFacet = technicalFacets.find((facet) => facet.keyword === "форма");
  const shankFacet = technicalFacets.find((facet) => facet.keyword === "диаметр хвостовика");
  const materialFacet = technicalFacets.find((facet) => facet.keyword === "материал");
  const drillDiameterFacet = technicalFacets.find((facet) => facet.keyword === "макс. диаметр");
  const drillReverseFacet = technicalFacets.find((facet) => facet.keyword === "реверс");
  const orderedFacets = slug === "borfrezy"
    ? [...result.facets].sort((first, second) => facetOrder(first.keyword, first.key) - facetOrder(second.keyword, second.key))
    : result.facets;
  const selectionCriteria = activeSubsegment?.criteria ?? activeShortcut?.criteria ?? (browsingAccessories && profile.accessoryCriteria ? profile.accessoryCriteria : profile.criteria);
  const criteriaTitle = activeSubsegment?.criteriaTitle ?? activeShortcut?.criteriaTitle ?? (browsingAccessories ? profile.accessoryCriteriaTitle : profile.criteriaTitle);
  const criteriaIntro = activeSubsegment?.criteriaIntro ?? activeShortcut?.criteriaIntro ?? (browsingAccessories ? profile.accessoryCriteriaIntro : profile.criteriaIntro);
  const selectorTitle = activeShortcut?.selectorTitle ?? (browsingAccessories ? profile.accessorySelectorTitle : profile.selectorTitle);
  const selectorIntro = activeShortcut?.selectorIntro ?? (browsingAccessories ? profile.accessorySelectorIntro : profile.selectorIntro);
  const listingTitle = activeSubsegment?.listingTitle ?? activeShortcut?.listingTitle ?? (browsingAccessories ? profile.accessoryListingTitle : profile.listingTitle);
  const scopeGuidance = activeSubsegment?.scopeGuidance ?? activeShortcut?.scopeGuidance;
  const emptyCopy = browsingAccessories && profile.accessoryEmptyCopy ? profile.accessoryEmptyCopy : profile.emptyCopy;
  const assortmentShortcuts = profileShortcuts.map((shortcut) => {
    const scope = { search:shortcut.query, productType:shortcut.productType ?? defaultProductType, segment:shortcut.segment, family:shortcut.family };
    const sample = getFeedCategoryPage(slug, { ...scope, pageSize:6 }).products.find((product) => Boolean(getFeedProductImage(product)));
    return { ...shortcut, count:getFeedCategoryProductCountForQuery(slug, scope), image:sample ? getFeedProductImage(sample) : undefined };
  }).filter((shortcut: { count: number }) => shortcut.count > 0)
    .sort((first, second) => slug === "sverla-i-zenkovki"
      ? drillAssortmentOrder.indexOf(first.family ?? "") - drillAssortmentOrder.indexOf(second.family ?? "")
      : 0);
  const decisionShortcuts = assortmentShortcuts.filter((shortcut) => !shortcut.secondary);
  const secondaryShortcuts = assortmentShortcuts.filter((shortcut) => shortcut.secondary);
  const primaryAssortmentShortcuts = decisionShortcuts.slice(0, 6);
  const additionalAssortmentShortcuts = [...decisionShortcuts.slice(6), ...secondaryShortcuts];
  const assortmentShortcutIsActive = (shortcut: AssortmentShortcut) => Boolean(shortcut.query) && shortcut.query === search
    || Boolean(shortcut.family) && shortcut.family === family
    || Boolean(shortcut.productType) && shortcut.productType === productType && productTypeChanged
    || Boolean(shortcut.segment) && shortcut.segment === segment;
  const assortmentShortcutHref = (shortcut: AssortmentShortcut) => {
    const parameter = shortcut.query ? `q=${encodeURIComponent(shortcut.query)}`
      : shortcut.family ? `family=${encodeURIComponent(shortcut.family)}`
      : shortcut.productType ? `kind=${encodeURIComponent(shortcut.productType)}`
      : `segment=${encodeURIComponent(shortcut.segment ?? "")}`;
    return `/c/${slug}?${parameter}#products`;
  };
  const subsegmentShortcuts = (activeShortcut?.subsegments ?? []).map((item) => ({
    ...item,
    count:getFeedCategoryProductCountForQuery(slug, { productType, segment, subsegment:item.id }),
  })).filter((item) => item.count > 0);
  const assortmentAllHref = `/c/${slug}#products`;
  const assortmentOverviewActive = !search && productType === defaultProductType && !segment && !subsegment && !family;
  const categoryHeroCount = family
    ? getFeedCategoryProductCountForQuery(slug, { productType, family })
    : subsegment
    ? getFeedCategoryProductCountForQuery(slug, { productType, segment, subsegment })
    : segment
    ? getFeedCategoryProductCountForQuery(slug, { productType, segment })
    : productType
    ? getFeedCategoryProductCountForQuery(slug, { productType })
    : feedCategory?.count ?? result.total;
  const inlineSelectionAssistant = result.page !== 1 || result.products.length === 0 ? undefined
    : browsingAccessories ? <details className="category-feed-help" id="category-selector">
        <summary data-conversion-action="open_category_selector"><span><small>После первых товаров</small><b>{selectorTitle}</b><em>Проверим совместимость, комплектность и актуальный остаток.</em></span><i>Проверить с инженером →</i></summary>
        <div><TestRequestForm compact primaryContact="phone" context={activeQueryContext} buttonLabel="Проверить совместимость" /></div>
      </details>
    : slug === "borfrezy" && shapeFacet ? <BurrSelectionAssistant
        shapeFacetKey={shapeFacet.key}
        shapeOptions={shapeFacet.options}
        shankFacetKey={shankFacet?.key}
        shankOptions={shankFacet?.options}
        materialFacetKey={materialFacet?.key}
        materialOptions={materialFacet?.options}
        selectedShapes={filters[shapeFacet.key]}
      />
    : slug === "stanki-sverlilnye" && !engineerFirstSelection && drillDiameterFacet ? <DrillSelectionAssistant
        diameterFacetKey={drillDiameterFacet.key}
        diameterOptions={drillDiameterFacet.options}
        reverseFacetKey={drillReverseFacet?.key}
        reverseOptions={drillReverseFacet?.options}
        selectedDiameter={numericMinimums[drillDiameterFacet.key]}
        selectedReverse={drillReverseFacet ? filters[drillReverseFacet.key] : []}
        selectedWork={segment === "drill-magnetic" ? "installation" : segment === "drill-stationary" ? "workshop" : "unknown"}
        lockedSegment={segment}
        lockedSubsegment={subsegment}
        selectorTitle={selectorTitle}
        selectorIntro={selectorIntro}
      />
    : engineerFirstSelection ? <details className="category-feed-help" id={slug === "stanki-sverlilnye" ? "drill-selector" : "category-selector"}>
        <summary data-conversion-action="open_category_selector"><span><small>Инженерный подбор</small><b>{selectorTitle}</b><em>{selectorIntro}</em></span><i>Передать параметры →</i></summary>
        <div className="category-feed-help-body"><div><h3>Опишите задачу — модель и артикул знать не обязательно</h3><p>Укажите известные размеры, материал и условия работы. Инженер проверит исполнение по фактическому каталогу.</p></div><TestRequestForm compact primaryContact="phone" context={activeQueryContext} buttonLabel="Заказать подбор инженера" /></div>
      </details>
    : <CategorySelectionAssistant
        categoryTitle={categoryTitle}
        selectorTitle={selectorTitle}
        selectorIntro={selectorIntro}
        selectorResult={profile.selectorResult}
        facets={assistantFacets}
        selectedFilters={filters}
        criteria={selectionCriteria}
      />;
  const collectionStructuredData = !hasSearchParameters(rawSearchParams) ? {
    "@context":"https://schema.org",
    "@type":"CollectionPage",
    "@id":`${canonicalUrl(`/c/${slug}`)}#collection`,
    name:categoryTitle,
    description:categoryIntro,
    url:canonicalUrl(`/c/${slug}`),
    mainEntity:{
      "@type":"ItemList",
      numberOfItems:result.total,
      itemListElement:result.products.map((product, index) => ({
        "@type":"ListItem",
        position:index + 1,
        name:product.title,
        url:canonicalUrl(publicProductPath(product)),
      })),
    },
  } : null;

  return <div className="site-shell category-page-shell">{collectionStructuredData && <JsonLd data={collectionStructuredData} />}<PilotHeader /><main className="inner-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Каталог", href:"/catalog" }, { label:group.title, href:group.href }, { label:subcategory.label }]} /></div>

    <section className="page-hero page-hero--category page-hero--category-compact"><div className="container category-hero-compact">
      <div className="category-hero-copy"><p className="eyebrow">{group.title}</p><h1>{categoryTitle}</h1><p>{categoryIntro}</p></div>
      <div className="category-hero-utility">
        <div className="category-hero-facts"><span><b>{categoryHeroCount.toLocaleString("ru-RU")}</b> {pluralizeProductGroups(categoryHeroCount)}</span><span>Цена и наличие проверяются перед оплатой</span></div>
        <div className="category-hero-actions"><a href={activeSelectorHref} data-conversion-action="open_category_selector">{browsingAccessories ? "Проверить совместимость" : engineerFirstSelection ? "Передать задачу инженеру" : "Помочь с подбором"} →</a><SocialShareButton path={sharePath} title={categoryTitle} /></div>
      </div>
    </div></section>

    <nav className="category-sibling-navigation" aria-label={`Категории направления «${group.title}»`}>
      <div className="container category-sibling-navigation-desktop"><header><span>В составе задачи</span><b>{group.title}</b><Link href={group.href}>Обзор направления →</Link></header><div>{group.subcategories.map((item) => <Link className={item.slug === slug ? "active" : undefined} aria-current={item.slug === slug ? "page" : undefined} href={item.href} key={item.slug}><span>{item.label}</span><small>{(item.count ?? 0).toLocaleString("ru-RU")}</small></Link>)}</div></div>
      <details className="container category-sibling-navigation-mobile"><summary><span>Другие категории направления</span><b>{group.title}</b><i aria-hidden="true">+</i></summary><div><Link className="category-sibling-overview" href={group.href}>Обзор направления</Link>{group.subcategories.map((item) => <Link className={item.slug === slug ? "active" : undefined} aria-current={item.slug === slug ? "page" : undefined} href={item.href} key={item.slug}><span>{item.label}</span><small>{(item.count ?? 0).toLocaleString("ru-RU")}</small></Link>)}</div></details>
    </nav>

    {assortmentShortcuts.length > 0 && <nav className={`category-assortment-shortcuts${supportedSegments.size > 0 || supportedFamilies.size > 0 ? " category-assortment-shortcuts--segments" : ""}`} aria-label="Разделы текущей категории"><div className="container"><header><div><span>Шаг 1 · тип или задача</span><b>{profile.assortmentPrompt ?? (supportedSegments.size > 0 ? "Сначала выберите тип заготовки" : "Сначала выберите тип товара")}</b></div><Link className={assortmentOverviewActive ? "active" : undefined} aria-current={assortmentOverviewActive ? "page" : undefined} href={assortmentAllHref}>{defaultProductType ? "Все станки" : "Весь ассортимент"}</Link></header><div>{primaryAssortmentShortcuts.map((shortcut) => {
      const active = assortmentShortcutIsActive(shortcut);
      return <Link className={active ? "active" : undefined} aria-current={active ? "page" : undefined} href={assortmentShortcutHref(shortcut)} key={shortcut.query ?? shortcut.family ?? shortcut.productType ?? shortcut.segment}>{shortcut.image && <span className="category-assortment-shortcut-media"><HomepageCategoryMedia src={shortcut.image} alt="" sizes="(max-width: 760px) 62px, 74px" /></span>}<span><b>{shortcut.label}</b><small>{shortcut.copy}</small></span><em>{shortcut.count.toLocaleString("ru-RU")}</em></Link>;
    })}</div>{additionalAssortmentShortcuts.length > 0 && <details className="category-assortment-more" open={additionalAssortmentShortcuts.some(assortmentShortcutIsActive) || undefined}><summary>Ещё разделы каталога <span>{additionalAssortmentShortcuts.length}</span></summary><div>{additionalAssortmentShortcuts.map((shortcut) => {
      const active = assortmentShortcutIsActive(shortcut);
      return <Link className={active ? "active" : undefined} aria-current={active ? "page" : undefined} href={assortmentShortcutHref(shortcut)} key={shortcut.query ?? shortcut.family ?? shortcut.productType ?? shortcut.segment}>{shortcut.image && <span className="category-assortment-shortcut-media"><HomepageCategoryMedia src={shortcut.image} alt="" sizes="(max-width: 760px) 62px, 74px" /></span>}<span><b>{shortcut.label}</b><small>{shortcut.copy}</small></span><em>{shortcut.count.toLocaleString("ru-RU")}</em></Link>;
    })}</div></details>}</div></nav>}

    {subsegmentShortcuts.length > 0 && segment && <nav className="category-type-navigation" aria-label={`Виды раздела «${activeShortcut?.label ?? "Сверлильные станки"}»`}><div className="container"><header><span>Виды оборудования</span><b>Уточните исполнение — или смотрите весь раздел</b></header><div><Link className={!subsegment ? "active" : undefined} aria-current={!subsegment ? "page" : undefined} href={`/c/${slug}?segment=${encodeURIComponent(segment)}#products`}><b>Все виды</b><small>{getFeedCategoryProductCountForQuery(slug, { productType, segment }).toLocaleString("ru-RU")}</small></Link>{subsegmentShortcuts.map((item) => <Link className={item.id === subsegment ? "active" : undefined} aria-current={item.id === subsegment ? "page" : undefined} href={`/c/${slug}?segment=${encodeURIComponent(segment)}&drill_type=${encodeURIComponent(item.id)}#products`} key={item.id}><span><b>{item.label}</b><small>{item.copy}</small></span><em>{item.count.toLocaleString("ru-RU")}</em></Link>)}</div></div></nav>}

    <section className="section feed-category-listing" id="products"><div className="container">
      <div className="section-heading feed-category-heading"><div><p className="eyebrow">Товары и исполнения</p><h2>{listingTitle}</h2></div><p>Быстрые параметры — ниже. Полный фильтр открывается отдельно.</p></div>

      {promotedFacets.length > 0 && <nav className={`feed-promoted-filters${slug === "borfrezy" ? " feed-promoted-filters--burr" : ""}${slug === "stanki-sverlilnye" ? " feed-promoted-filters--equipment" : ""}${slug === "karetki-svarochnye" ? " feed-promoted-filters--welding" : ""}`} aria-label="Быстрые фильтры">
        <div className="feed-priority-choice"><span>Показывать сначала</span><div>
          <PromotedFilterLink className={sort === "relevance" ? "active" : undefined} current={sort === "relevance"} href={categoryUrl(slug, rawSearchParams, { setKey:"sort", setValue:"relevance" })}>Подходящие</PromotedFilterLink>
          {availabilityFilterEnabled
            ? <PromotedFilterLink className={inStockOnly ? "active" : undefined} current={inStockOnly} href={categoryUrl(slug, rawSearchParams, { toggleKey:"availability", toggleValue:"in-stock" })}>В наличии<small>свежие данные</small></PromotedFilterLink>
            : <span className="feed-promoted-unavailable">Наличие уточняем<small>через менеджера</small></span>}
        </div></div>
        {promotedFacets.map((facet) => {
          const promotedOptionLimit = slug === "koronchatye-sverla" && facet.keyword === "рабочая длина" ? 6 : facet.numeric ? 5 : 6;
          const preferredOptions = slug === "koronchatye-sverla" && facet.keyword === "рабочая длина"
            ? ["110 мм"]
            : slug === "stanki-sverlilnye" && facet.numeric && /макс.*диаметр/iu.test(facet.keyword ?? "")
              ? facet.options.filter((option) => numericOptionValue(option.value) === 35).map((option) => option.value)
              : [];
          const visibleOptions = getPromotedFacetOptions(facet, promotedOptionLimit, filters[facet.key], preferredOptions);
          const rangeStart = facet.numeric ? facet.options[0]?.label : undefined;
          const rangeEnd = facet.numeric ? facet.options[facet.options.length - 1]?.label : undefined;
          return <div className={slug === "karetki-svarochnye" && facet.keyword === "положения сварки" ? "feed-promoted-group--welding-position" : undefined} key={facet.key}><span className="feed-promoted-label">{facet.label}{rangeStart && rangeEnd && <small>диапазон {rangeStart}–{rangeEnd}</small>}</span><div className={facet.numeric ? "feed-promoted-values feed-promoted-values--numeric" : "feed-promoted-values"}>{visibleOptions.map((option) => {
            const selected = filters[facet.key]?.includes(option.value) ?? false;
            return <PromotedFilterLink className={selected ? "active" : undefined} current={selected} href={categoryUrl(slug, rawSearchParams, { toggleKey:`f_${facet.key}`, toggleValue:option.value })} key={option.value}>{facet.keyword === "форма" && <BurrShapeMark shape={option.value} />}{option.label}<small>{option.count}</small></PromotedFilterLink>;
          })}</div></div>;
        })}
        <OpenFullFiltersLink toggleId={`feed-filters-${slug}`} />
      </nav>}

      <div className="feed-catalog-layout">
        <AutoApplyFilterPanel
          action={`/c/${slug}`}
          activeFilterCount={activeFilterCount}
          resultCount={result.total}
          resetHref={`/c/${slug}#products`}
          slug={slug}
        >
            {requestedView && <input type="hidden" name="view" value={requestedView} />}
            {requestedProductType && <input type="hidden" name="kind" value={requestedProductType} />}
            {segment && <input type="hidden" name="segment" value={segment} />}
            {subsegment && <input type="hidden" name="drill_type" value={subsegment} />}
            {family && <input type="hidden" name="family" value={family} />}
            <div className="feed-filter-priority"><span>Быстрый выбор</span>{availabilityFilterEnabled ? <label><input type="checkbox" name="availability" value="in-stock" defaultChecked={inStockOnly} /><b>В наличии</b><em>свежие данные</em></label> : <label className="feed-filter-availability-disabled"><input type="checkbox" disabled /><b>Наличие уточняем</b><em>менеджер проверит актуальный остаток</em></label>}<label><span>Порядок выдачи</span><select name="sort" defaultValue={sort}>{sortOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label><small>Остаток и срок отгрузки подтвердим перед оплатой.</small></div>
            <label className="feed-filter-search"><span>Поиск в категории</span><input type="search" name="q" defaultValue={search} placeholder="Название, бренд или модель" /></label>
            {orderedFacets.map((facet) => <FeedFacetFilter
              facet={facet}
              selectedValues={filters[facet.key] ?? []}
              minimum={numericMinimums[facet.key]}
              maximum={numericMaximums[facet.key]}
              key={facet.key}
            />)}
        </AutoApplyFilterPanel>

        <div className="feed-results" id="feed-results-list">
          <div className="feed-results-toolbar"><p><b>{result.total.toLocaleString("ru-RU")}</b> {pluralizeProductGroups(result.total)}{result.total > 0 && <span> · показаны {start}–{end}</span>}</p><div className="feed-toolbar-controls">
            <nav className="feed-view-switch" aria-label="Вид товаров"><a className={view === "list" ? "active" : undefined} aria-current={view === "list" ? "page" : undefined} data-conversion-action="listing_view_list" href={categoryUrl(slug, rawSearchParams, { setKey:"view", setValue:"list" })}>Списком</a><a className={view === "grid" ? "active" : undefined} aria-current={view === "grid" ? "page" : undefined} data-conversion-action="listing_view_grid" href={categoryUrl(slug, rawSearchParams, { setKey:"view", setValue:"grid" })}>Плиткой</a></nav>
            <AutoApplySortForm action={`/c/${slug}`}>
              {requestedView && <input type="hidden" name="view" value={requestedView} />}
              {requestedProductType && <input type="hidden" name="kind" value={requestedProductType} />}
              {segment && <input type="hidden" name="segment" value={segment} />}
              {subsegment && <input type="hidden" name="drill_type" value={subsegment} />}
              {family && <input type="hidden" name="family" value={family} />}
              {search && <input type="hidden" name="q" value={search} />}
              {inStockOnly && <input type="hidden" name="availability" value="in-stock" />}
              {Object.entries(filters).flatMap(([key, values]) => values.map((value) => <input type="hidden" name={`f_${key}`} value={value} key={`${key}-${value}`} />))}
              {Object.entries(numericMinimums).map(([key, value]) => <input type="hidden" name={`min_${key}`} value={value} key={`sort-minimum-${key}`} />)}
              {Object.entries(numericMaximums).map(([key, value]) => <input type="hidden" name={`max_${key}`} value={value} key={`sort-maximum-${key}`} />)}
              <label><span>Сортировка</span><select name="sort" defaultValue={sort}>{sortOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
            </AutoApplySortForm>
          </div></div>

          {activeFilterCount > 0 && <nav className="feed-applied-filters" aria-label="Применённые фильтры"><span>Вы выбрали:</span>
            {productTypeChanged && <PromotedFilterLink href={`/c/${slug}#products`}>Раздел: оснастка и опции<b aria-hidden="true">×</b></PromotedFilterLink>}
            {segment && activeShortcut && <PromotedFilterLink href={categoryUrl(slug, rawSearchParams, { removeKeys:["segment", "drill_type"] })}>Тип: {activeShortcut.label}<b aria-hidden="true">×</b></PromotedFilterLink>}
            {subsegment && activeSubsegment && <PromotedFilterLink href={categoryUrl(slug, rawSearchParams, { removeKey:"drill_type" })}>Вид: {activeSubsegment.label}<b aria-hidden="true">×</b></PromotedFilterLink>}
            {family && activeShortcut && <PromotedFilterLink href={categoryUrl(slug, rawSearchParams, { removeKey:"family" })}>Вид: {activeShortcut.label}<b aria-hidden="true">×</b></PromotedFilterLink>}
            {search && <PromotedFilterLink href={categoryUrl(slug, rawSearchParams, { removeKey:"q" })}>Поиск: {search}<b aria-hidden="true">×</b></PromotedFilterLink>}
            {inStockOnly && <PromotedFilterLink href={categoryUrl(slug, rawSearchParams, { removeKey:"availability" })}>В наличии<b aria-hidden="true">×</b></PromotedFilterLink>}
            {result.facets.flatMap((facet) => (filters[facet.key] ?? []).map((value) => <PromotedFilterLink href={categoryUrl(slug, rawSearchParams, { removeKey:`f_${facet.key}`, removeValue:value })} key={`${facet.key}-${value}`}>{facet.label}: {value}<b aria-hidden="true">×</b></PromotedFilterLink>))}
            {Object.entries(numericMinimums).map(([key, value]) => {
              const facet = result.facets.find((candidate) => candidate.key === key);
              return <PromotedFilterLink href={categoryUrl(slug, rawSearchParams, { removeKey:`min_${key}` })} key={`minimum-${key}`}>{facet?.label ?? "Параметр"}: не менее {value}<b aria-hidden="true">×</b></PromotedFilterLink>;
            })}
            {Object.entries(numericMaximums).map(([key, value]) => {
              const facet = result.facets.find((candidate) => candidate.key === key);
              return <PromotedFilterLink href={categoryUrl(slug, rawSearchParams, { removeKey:`max_${key}` })} key={`maximum-${key}`}>{facet?.label ?? "Параметр"}: не более {value}<b aria-hidden="true">×</b></PromotedFilterLink>;
            })}
            <PromotedFilterLink className="feed-reset-all" href={`/c/${slug}#products`}>Очистить всё</PromotedFilterLink>
          </nav>}

          {result.products.length > 0 ? view === "list" && canUseTable ? <FeedProductTable products={productCards} columns={tableColumns} after={inlineSelectionAssistant} /> : <FeedProductList products={productCards} layout={view} after={inlineSelectionAssistant} /> : <div className="feed-state feed-state--guided"><span>Нет точных совпадений</span><h2>Не нужно начинать подбор заново</h2><p>{emptyCopy}</p>
            {recoverySuggestions.length > 0 && <nav className="feed-recovery-options" aria-label="Как расширить результаты"><b>Сохранить остальные условия и:</b>{recoverySuggestions.map((suggestion) => <Link href={categoryUrl(slug, rawSearchParams, { removeKeys:suggestion.removeKeys })} key={suggestion.removeKeys.join("|")}><span>{suggestion.label}</span><small>{suggestion.resultCount.toLocaleString("ru-RU")} {pluralizeProductGroups(suggestion.resultCount)}</small></Link>)}</nav>}
            <div className="feed-state-actions"><Link className="button" href={`/c/${slug}#products`}>Сбросить все условия</Link><a className="button button-orange" href={activeSelectorHref}>{slug === "borfrezy" ? "Изменить подбор формы" : "Изменить условия подбора"}</a></div>
            <details className="feed-zero-request"><summary>Не ослаблять требования — передать инженеру</summary><TestRequestForm compact primaryContact="phone" context={activeQueryContext} buttonLabel="Заказать проверку параметров" /></details>
          </div>}

          {result.pageCount > 1 && <nav className="feed-pagination" aria-label="Страницы товаров">
            {result.page > 1 && <Link className="feed-pagination-direction" href={categoryUrl(slug, rawSearchParams, { page:result.page - 1 })}>← Назад</Link>}
            <div>{paginationItems(result.page, result.pageCount).map((item, index) => item === "…" ? <span key={`dots-${index}`}>…</span> : <Link className={item === result.page ? "active" : undefined} aria-current={item === result.page ? "page" : undefined} href={categoryUrl(slug, rawSearchParams, { page:item })} key={item}>{item}</Link>)}</div>
            {result.page < result.pageCount && <Link className="feed-pagination-direction" href={categoryUrl(slug, rawSearchParams, { page:result.page + 1 })}>Вперёд →</Link>}
          </nav>}

          {result.products.length > 0 && <div className="feed-listing-foot"><p>Не нашли точное сочетание? Это не означает, что поставка невозможна: каталог показывает только текущую витрину.</p><a href={activeSelectorHref}>{slug === "borfrezy" ? "Подобрать без артикула →" : "Уточнить условия подбора →"}</a></div>}
        </div>
      </div>
    </div></section>

    {scopeGuidance && <section className="category-scope-after-results" aria-label={`Как выбирать: ${categoryTitle}`}><div className="container"><details><summary><span>Коротко о выборе</span><b>Какие параметры проверить перед заказом</b><i aria-hidden="true">+</i></summary><div><p><span>Задача</span><b>{scopeGuidance.bestFor}</b></p><p><span>Критичное условие</span><b>{scopeGuidance.checkFirst}</b></p><p><span>Главные параметры</span><b>{scopeGuidance.compareBy}</b></p></div></details></div></section>}

    <section className="section section-muted selection-guide-section" id="selection-guide"><div className="container subcategory-layout subcategory-layout--selection"><div className="selection-guide">
      <div className="section-heading"><div><p className="eyebrow">Критерии выбора</p><h2>{criteriaTitle}</h2><p>{criteriaIntro}</p></div></div>
      <ol className="selection-criteria-list">{selectionCriteria.map((parameter,index) => <li key={parameter.title}><span>{String(index+1).padStart(2,"0")}</span><div><b>{parameter.title}</b><p>{parameter.copy}</p></div></li>)}</ol>
      <p className="selection-guide-note"><b>Не обязательно знать артикул.</b> Достаточно описать задачу и известные параметры; инженер проверит совместимость, исполнение и комплектность.</p>
      <SelectionConversionBlock categoryTitle={categoryTitle} />
    </div><aside><ManagerContactCard compact /></aside></div></section>

    <section className="section"><div className="container"><div className="section-heading"><div><p className="eyebrow">В той же производственной задаче</p><h2>Смежные подкатегории</h2></div></div><nav className="related-category-links" aria-label="Смежные подкатегории">{group.subcategories.filter((item) => item.slug !== subcategory.slug).map((item) => <Link href={item.href} key={item.slug}>{item.label}<span>→</span></Link>)}</nav></div></section>
  </main><PilotFooter /></div>;
}

function firstValue(value: SearchValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function valuesOf(value: SearchValue): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function categoryUrl(slug: string, raw: SearchParams, change: { removeKey?: string; removeKeys?: string[]; removeValue?: string; page?: number; setKey?: string; setValue?: string; toggleKey?: string; toggleValue?: string }): string {
  const params = new URLSearchParams();
  let toggledValueWasSelected = false;
  for (const [key, value] of Object.entries(raw)) {
    if (key === "page" || key === change.setKey) continue;
    if (change.removeKeys?.includes(key)) continue;
    if (key === change.removeKey) {
      for (const item of valuesOf(value)) if (change.removeValue && item !== change.removeValue) params.append(key, item);
      continue;
    }
    for (const item of valuesOf(value)) {
      if (key === change.toggleKey && item === change.toggleValue) {
        toggledValueWasSelected = true;
        continue;
      }
      params.append(key, item);
    }
  }
  if (change.setKey && change.setValue) params.set(change.setKey, change.setValue);
  if (change.toggleKey && change.toggleValue && !toggledValueWasSelected) params.append(change.toggleKey, change.toggleValue);
  if (change.page && change.page > 1) params.set("page", String(change.page));
  const query = params.toString();
  return `/c/${slug}${query ? `?${query}` : ""}#products`;
}

function paginationItems(page: number, pageCount: number): Array<number | "…"> {
  if (pageCount <= 7) return Array.from({ length:pageCount }, (_, index) => index + 1);
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((value) => value >= 1 && value <= pageCount));
  const result: Array<number | "…"> = [];
  for (const value of Array.from(pages).sort((a, b) => a - b)) {
    const previous = result[result.length - 1];
    if (typeof previous === "number" && value - previous > 1) result.push("…");
    result.push(value);
  }
  return result;
}

function pluralizeProductGroups(count: number): string {
  const modulo100 = count % 100;
  const modulo10 = count % 10;
  if (modulo100 >= 11 && modulo100 <= 14) return "товарных серий";
  if (modulo10 === 1) return "товарная серия";
  if (modulo10 >= 2 && modulo10 <= 4) return "товарные серии";
  return "товарных серий";
}

function facetOrder(keyword?: string, key?: string): number {
  if (key === "brand") return 0;
  if (keyword === "форма") return 1;
  if (keyword === "материал") return 2;
  if (keyword === "диаметр режущей") return 3;
  if (keyword === "диаметр хвостовика") return 4;
  if (keyword === "длина режущей") return 5;
  return keyword ? 6 : 7;
}

const HIGH_CARDINALITY_NUMERIC_OPTIONS = 40;

function FeedFacetFilter({ facet, selectedValues, minimum, maximum }: { facet: FeedFacet; selectedValues: string[]; minimum?: number; maximum?: number }) {
  const isLargeNumeric = Boolean(facet.numeric && facet.options.length > HIGH_CARDINALITY_NUMERIC_OPTIONS);
  const selectedOptions = isLargeNumeric ? facet.options.filter((option) => selectedValues.includes(option.value)) : [];
  const bounds = facet.numeric ? numericFacetBounds(facet) : undefined;
  const className = [facet.keyword === "форма" ? "feed-shape-filter" : "", facet.numeric ? "feed-numeric-filter" : ""].filter(Boolean).join(" ") || undefined;

  return <fieldset className={className}>
    <legend>{facet.label}</legend>
    <small>{facet.keyword === "форма"
      ? <>Стандартные формы A–N и комбинированные исполнения. <a href="#burr-selector">Не знаете форму? Подобрать по задаче</a></>
      : facet.numeric && facet.options.length > 1
        ? <>Диапазон фида: <b>{facet.options[0].label}–{facet.options[facet.options.length - 1].label}</b>. {facet.help}</>
        : facet.help}</small>
    {isLargeNumeric ? <>
      <div className="feed-numeric-range">
        <label><span>От</span><input type="number" inputMode="decimal" step="any" name={`min_${facet.key}`} min={bounds?.minimum} max={bounds?.maximum} defaultValue={minimum} placeholder={bounds?.minimumLabel} aria-label={`${facet.label}: от`} /></label>
        <label><span>До</span><input type="number" inputMode="decimal" step="any" name={`max_${facet.key}`} min={bounds?.minimum} max={bounds?.maximum} defaultValue={maximum} placeholder={bounds?.maximumLabel} aria-label={`${facet.label}: до`} /></label>
      </div>
      {selectedOptions.length > 0 && <div className="feed-numeric-selected"><small>Точно выбрано:</small>{selectedOptions.map((option) => <label key={option.value}><input type="checkbox" name={`f_${facet.key}`} value={option.value} defaultChecked /><span>{option.label}</span><em>{option.count}</em></label>)}</div>}
    </> : <>
      {facet.numeric && Number.isFinite(minimum) && <input type="hidden" name={`min_${facet.key}`} value={minimum} />}
      {facet.numeric && Number.isFinite(maximum) && <input type="hidden" name={`max_${facet.key}`} value={maximum} />}
      <div>{facet.options.map((option) => <label key={option.value}><input type="checkbox" name={`f_${facet.key}`} value={option.value} defaultChecked={selectedValues.includes(option.value)} /><span className={facet.keyword === "форма" ? "feed-shape-option" : undefined}>{facet.keyword === "форма" && <BurrShapeMark shape={option.value} />}{option.label}</span><em>{option.count}</em></label>)}</div>
    </>}
  </fieldset>;
}

function numericFacetBounds(facet: FeedFacet): { minimum: number; maximum: number; minimumLabel: string; maximumLabel: string } | undefined {
  const values = facet.options.map((option) => ({ number:Number.parseFloat(option.value.trim().replace(",", ".")), label:option.label })).filter((item) => Number.isFinite(item.number));
  if (values.length === 0) return undefined;
  values.sort((first, second) => first.number - second.number);
  return { minimum:values[0].number, maximum:values[values.length - 1].number, minimumLabel:values[0].label, maximumLabel:values[values.length - 1].label };
}

function numericOptionValue(value: string): number {
  return Number.parseFloat(value.trim().replace(",", ".").match(/\d+(?:\.\d+)?/u)?.[0] ?? "");
}
