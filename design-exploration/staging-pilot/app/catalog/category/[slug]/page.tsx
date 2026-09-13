import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "../../../ui/Breadcrumbs";
import { BurrSelectionAssistant } from "../../../ui/BurrSelectionAssistant";
import { BurrShapeMark } from "../../../ui/BurrShapeMark";
import { CategorySelectionAssistant } from "../../../ui/CategorySelectionAssistant";
import { DrillSelectionAssistant } from "../../../ui/DrillSelectionAssistant";
import { FeedProductList } from "../../../ui/FeedProductList";
import { FeedProductTable } from "../../../ui/FeedProductTable";
import { ManagerContactCard } from "../../../ui/ManagerContactCard";
import { OpenFullFiltersLink, PromotedFilterLink } from "../../../ui/PromotedFilterControls";
import { PilotFooter } from "../../../ui/PilotFooter";
import { PilotHeader } from "../../../ui/PilotHeader";
import { SelectionConversionBlock } from "../../../ui/SelectionConversionBlock";
import { getCategoryExpertProfile, selectCategoryFacets } from "../../../data/categoryExpertProfiles.mjs";
import { getFeedCategory, getFeedCategoryPage, prefersDenseFeedTable, type FeedCategorySort, toFeedProductCardModel } from "../../../data/feedCatalog";
import { getProductionSubcategory } from "../../../data/productionCategoryGroups";

type SearchValue = string | string[] | undefined;
type SearchParams = Record<string, SearchValue>;
type RouteProps = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

const sortOptions: Array<{ value: FeedCategorySort; label: string }> = [
  { value:"relevance", label:"Сначала подходящие" },
  { value:"price-asc", label:"Сначала дешевле" },
  { value:"price-desc", label:"Сначала дороже" },
  { value:"name", label:"По названию" },
];

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = getProductionSubcategory(slug);
  const category = getFeedCategory(slug);
  const title = category?.h1 ?? entry?.subcategory.label;
  return {
    title: title ? `${title} — тестовый каталог 7TOOL` : "Категория — 7TOOL",
    description: category?.intro ?? (entry ? `${entry.subcategory.label}: инженерный подбор, ориентиры цены и подтверждение срока поставки.` : undefined),
    robots: { index: false, follow: false },
  };
}

export default async function SubcategoryPage({ params, searchParams }: RouteProps) {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const entry = getProductionSubcategory(slug);
  if (!entry) return <div className="site-shell"><PilotHeader /><main className="inner-page"><section className="section"><div className="container empty-result"><b>Категория не найдена в текущем каталоге</b><p>Вернитесь в каталог или отправьте задачу инженеру.</p><Link href="/catalog">Открыть каталог →</Link></div></section></main><PilotFooter /></div>;

  const { group, subcategory } = entry;
  const profile = getCategoryExpertProfile(slug);
  const feedCategory = getFeedCategory(slug);
  const search = firstValue(rawSearchParams.q)?.trim() ?? "";
  const requestedSort = firstValue(rawSearchParams.sort);
  const sort = sortOptions.some((option) => option.value === requestedSort) ? requestedSort as FeedCategorySort : "relevance";
  const requestedPage = Number.parseInt(firstValue(rawSearchParams.page) ?? "1", 10);
  const requestedView = firstValue(rawSearchParams.view);
  const inStockOnly = firstValue(rawSearchParams.availability) === "in-stock";
  const filters = Object.fromEntries(Object.entries(rawSearchParams)
    .filter(([key]) => key.startsWith("f_"))
    .map(([key, value]) => [key.slice(2), valuesOf(value).filter(Boolean)]));
  const numericMinimums = Object.fromEntries(Object.entries(rawSearchParams)
    .filter(([key]) => key.startsWith("min_"))
    .map(([key, value]) => [key.slice(4), Number.parseFloat(firstValue(value) ?? "")])
    .filter((entry): entry is [string, number] => Number.isFinite(entry[1]) && entry[1] > 0));
  const result = getFeedCategoryPage(slug, { search, sort, page:Number.isFinite(requestedPage) ? requestedPage : 1, filters, numericMinimums, availability:inStockOnly ? "in-stock" : undefined });
  const activeVariantFilters = result.facets.flatMap((facet) => {
    if (!facet.keyword) return [];
    const facetFilters = [];
    if ((filters[facet.key]?.length ?? 0) > 0) facetFilters.push({ keyword:facet.keyword, values:filters[facet.key] });
    if (Number.isFinite(numericMinimums[facet.key])) facetFilters.push({ keyword:facet.keyword, values:[], minimum:numericMinimums[facet.key] });
    return facetFilters;
  });
  const productCards = result.products.map((product) => toFeedProductCardModel(product, activeVariantFilters, inStockOnly));
  const canUseTable = prefersDenseFeedTable(slug);
  const view = canUseTable && requestedView !== "cards" ? "table" : "cards";
  const activeFilterCount = Object.values(filters).reduce((sum, values) => sum + values.length, 0) + Object.keys(numericMinimums).length + (search ? 1 : 0) + (inStockOnly ? 1 : 0);
  const selectorHref = slug === "borfrezy" ? "#burr-selector" : slug === "stanki-sverlilnye" ? "#drill-selector" : "#category-selector";
  const start = result.total > 0 ? (result.page - 1) * result.pageSize + 1 : 0;
  const end = Math.min(result.page * result.pageSize, result.total);
  const technicalFacets = result.facets.filter((facet) => facet.keyword);
  const promotedFacets = selectCategoryFacets(slug, result.facets, slug === "borfrezy" || slug === "stanki-sverlilnye" ? 3 : 2);
  const assistantFacets = selectCategoryFacets(slug, technicalFacets, 3);
  const shapeFacet = technicalFacets.find((facet) => facet.keyword === "форма");
  const shankFacet = technicalFacets.find((facet) => facet.keyword === "диаметр хвостовика");
  const materialFacet = technicalFacets.find((facet) => facet.keyword === "материал");
  const drillDiameterFacet = technicalFacets.find((facet) => facet.keyword === "макс. диаметр");
  const drillReverseFacet = technicalFacets.find((facet) => facet.keyword === "реверс");
  const orderedFacets = slug === "borfrezy"
    ? [...result.facets].sort((first, second) => facetOrder(first.keyword, first.key) - facetOrder(second.keyword, second.key))
    : result.facets;
  const selectionCriteria = profile.criteria;

  return <div className="site-shell"><PilotHeader /><main className="inner-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Каталог", href:"/catalog" }, { label:group.title, href:group.href }, { label:subcategory.label }]} /></div>

    <section className="page-hero page-hero--category"><div className="container page-hero-grid"><div>
      <p className="eyebrow">{group.title}</p>
      <h1>{feedCategory?.h1 ?? subcategory.label}</h1>
      <p>{profile.heroIntro}</p>
      <div className="category-hero-facts"><span><b>{(feedCategory?.count ?? result.total).toLocaleString("ru-RU")}</b> {pluralizeProductGroups(feedCategory?.count ?? result.total)}</span><span>Цена — по данным поставщика</span><span>Наличие и срок — после проверки</span></div>
    </div><aside>
      <b>{profile.selectorTitle}</b>
      <p>{profile.selectorIntro}</p>
      <a href={selectorHref}>Ответить на несколько вопросов →</a>
    </aside></div></section>

    <section className="section feed-category-listing" id="products"><div className="container">
      <div className="section-heading feed-category-heading"><div><p className="eyebrow">Фактический ассортимент</p><h2>{profile.listingTitle}</h2></div><p>Главные параметры вынесены наверх. Полный набор фильтров остаётся слева.</p></div>

      {promotedFacets.length > 0 && <nav className={`feed-promoted-filters${slug === "borfrezy" ? " feed-promoted-filters--burr" : ""}${slug === "stanki-sverlilnye" ? " feed-promoted-filters--equipment" : ""}`} aria-label="Быстрые фильтры">
        <div className="feed-priority-choice"><span>Показывать сначала</span><div>
          <PromotedFilterLink className={sort === "relevance" ? "active" : undefined} current={sort === "relevance"} href={categoryUrl(slug, rawSearchParams, { setKey:"sort", setValue:"relevance" })}>Подходящие</PromotedFilterLink>
          <PromotedFilterLink className={inStockOnly ? "active" : undefined} current={inStockOnly} href={categoryUrl(slug, rawSearchParams, { toggleKey:"availability", toggleValue:"in-stock" })}>В наличии<small>данные поставщика</small></PromotedFilterLink>
        </div></div>
        {promotedFacets.map((facet) => <div key={facet.key}><span className="feed-promoted-label">{facet.label}</span><div>{facet.options.slice(0, 6).map((option) => {
          const selected = filters[facet.key]?.includes(option.value) ?? false;
          return <PromotedFilterLink className={selected ? "active" : undefined} current={selected} href={categoryUrl(slug, rawSearchParams, { toggleKey:`f_${facet.key}`, toggleValue:option.value })} key={option.value}>{facet.keyword === "форма" && <BurrShapeMark shape={option.value} />}{option.label}<small>{option.count}</small></PromotedFilterLink>;
        })}</div></div>)}
        <OpenFullFiltersLink toggleId={`feed-filters-${slug}`} />
      </nav>}

      {slug === "borfrezy" && shapeFacet && <BurrSelectionAssistant
        shapeFacetKey={shapeFacet.key}
        shapeOptions={shapeFacet.options}
        shankFacetKey={shankFacet?.key}
        shankOptions={shankFacet?.options}
        materialFacetKey={materialFacet?.key}
        materialOptions={materialFacet?.options}
        selectedShapes={filters[shapeFacet.key]}
      />}

      {slug === "stanki-sverlilnye" && drillDiameterFacet && <DrillSelectionAssistant
        diameterFacetKey={drillDiameterFacet.key}
        reverseFacetKey={drillReverseFacet?.key}
        reverseOptions={drillReverseFacet?.options}
        selectedDiameter={numericMinimums[drillDiameterFacet.key]}
        selectedReverse={drillReverseFacet ? filters[drillReverseFacet.key] : []}
        selectedWork={search === "магнитн" ? "installation" : "unknown"}
      />}

      {slug !== "borfrezy" && slug !== "stanki-sverlilnye" && <CategorySelectionAssistant
        categoryTitle={feedCategory?.h1 ?? subcategory.label}
        selectorTitle={profile.selectorTitle}
        selectorIntro={profile.selectorIntro}
        selectorResult={profile.selectorResult}
        facets={assistantFacets}
        selectedFilters={filters}
        criteria={selectionCriteria}
      />}

      <div className="feed-catalog-layout">
        <aside className="feed-filter-panel" id="feed-filter-panel">
          <input className="feed-filter-toggle" type="checkbox" id={`feed-filters-${slug}`} aria-label="Показать или скрыть фильтры" />
          <label className="feed-filter-summary" htmlFor={`feed-filters-${slug}`}><span><b>Фильтры</b><small>{activeFilterCount > 0 ? `Выбрано: ${activeFilterCount}` : "По характеристикам товаров"}</small></span><i aria-hidden="true">+</i></label>
          <form method="get" action={`/catalog/category/${slug}#products`}>
            {requestedView && <input type="hidden" name="view" value={requestedView} />}
            {Object.entries(numericMinimums).map(([key, value]) => <input type="hidden" name={`min_${key}`} value={value} key={`minimum-${key}`} />)}
            <div className="feed-filter-priority"><span>Быстрый выбор</span><label><input type="checkbox" name="availability" value="in-stock" defaultChecked={inStockOnly} /><b>В наличии</b><em>по данным поставщика</em></label><label><span>Порядок выдачи</span><select name="sort" defaultValue={sort}>{sortOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label><small>Остаток и срок отгрузки подтвердим перед оплатой.</small></div>
            <label className="feed-filter-search"><span>Поиск в категории</span><input type="search" name="q" defaultValue={search} placeholder="Название, бренд или модель" /></label>
            {orderedFacets.map((facet) => <fieldset className={facet.keyword === "форма" ? "feed-shape-filter" : undefined} key={facet.key}><legend>{facet.label}</legend><small>{facet.keyword === "форма" ? <>Стандартные формы A–N и комбинированные исполнения. <a href="#burr-selector">Не знаете форму? Подобрать по задаче</a></> : facet.help}</small><div>{facet.options.map((option) => <label key={option.value}><input type="checkbox" name={`f_${facet.key}`} value={option.value} defaultChecked={filters[facet.key]?.includes(option.value)} /><span className={facet.keyword === "форма" ? "feed-shape-option" : undefined}>{facet.keyword === "форма" && <BurrShapeMark shape={option.value} />}{option.label}</span><em>{option.count}</em></label>)}</div></fieldset>)}
            <div className="feed-filter-actions"><button className="button button-orange" type="submit">Показать товары</button><Link href={`/catalog/category/${slug}#products`}>Сбросить</Link></div>
          </form>
        </aside>

        <div className="feed-results">
          <div className="feed-results-toolbar"><p><b>{result.total.toLocaleString("ru-RU")}</b> {pluralizeProductGroups(result.total)}{result.total > 0 && <span> · показаны {start}–{end}</span>}</p><div className="feed-toolbar-controls">
            {canUseTable && <nav className="feed-view-switch" aria-label="Вид списка"><a className={view === "table" ? "active" : undefined} href={categoryUrl(slug, rawSearchParams, { setKey:"view", setValue:"table" })}>Таблица</a><a className={view === "cards" ? "active" : undefined} href={categoryUrl(slug, rawSearchParams, { setKey:"view", setValue:"cards" })}>Карточки</a></nav>}
            <form method="get" action={`/catalog/category/${slug}#products`}>
              {requestedView && <input type="hidden" name="view" value={requestedView} />}
              {search && <input type="hidden" name="q" value={search} />}
              {inStockOnly && <input type="hidden" name="availability" value="in-stock" />}
              {Object.entries(filters).flatMap(([key, values]) => values.map((value) => <input type="hidden" name={`f_${key}`} value={value} key={`${key}-${value}`} />))}
              {Object.entries(numericMinimums).map(([key, value]) => <input type="hidden" name={`min_${key}`} value={value} key={`sort-minimum-${key}`} />)}
              <label><span>Сортировка</span><select name="sort" defaultValue={sort}>{sortOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label><button type="submit">Применить</button>
            </form>
          </div></div>

          {activeFilterCount > 0 && <nav className="feed-applied-filters" aria-label="Применённые фильтры"><span>Вы выбрали:</span>
            {search && <PromotedFilterLink href={categoryUrl(slug, rawSearchParams, { removeKey:"q" })}>Поиск: {search}<b aria-hidden="true">×</b></PromotedFilterLink>}
            {inStockOnly && <PromotedFilterLink href={categoryUrl(slug, rawSearchParams, { removeKey:"availability" })}>В наличии<b aria-hidden="true">×</b></PromotedFilterLink>}
            {result.facets.flatMap((facet) => (filters[facet.key] ?? []).map((value) => <PromotedFilterLink href={categoryUrl(slug, rawSearchParams, { removeKey:`f_${facet.key}`, removeValue:value })} key={`${facet.key}-${value}`}>{facet.label}: {value}<b aria-hidden="true">×</b></PromotedFilterLink>))}
            {Object.entries(numericMinimums).map(([key, value]) => {
              const facet = result.facets.find((candidate) => candidate.key === key);
              return <PromotedFilterLink href={categoryUrl(slug, rawSearchParams, { removeKey:`min_${key}` })} key={`minimum-${key}`}>{facet?.label ?? "Параметр"}: от {value} мм<b aria-hidden="true">×</b></PromotedFilterLink>;
            })}
            <PromotedFilterLink className="feed-reset-all" href={`/catalog/category/${slug}#products`}>Очистить всё</PromotedFilterLink>
          </nav>}

          {result.products.length > 0 ? view === "table" ? <FeedProductTable products={productCards} columns={result.facets.filter((facet) => facet.keyword).map((facet) => facet.label).slice(0, 3)} /> : <FeedProductList products={productCards} directSingleVariant={slug === "stanki-sverlilnye"} /> : <div className="feed-state"><span>Нет точных совпадений</span><h2>Ослабьте один из параметров</h2><p>{profile.emptyCopy}</p><div><Link className="button" href={`/catalog/category/${slug}#products`}>Сбросить фильтры</Link><a className="button button-orange" href={selectorHref}>{slug === "borfrezy" ? "Подобрать форму по задаче" : "Изменить условия подбора"}</a></div></div>}

          {result.pageCount > 1 && <nav className="feed-pagination" aria-label="Страницы товаров">
            {result.page > 1 && <Link className="feed-pagination-direction" href={categoryUrl(slug, rawSearchParams, { page:result.page - 1 })}>← Назад</Link>}
            <div>{paginationItems(result.page, result.pageCount).map((item, index) => item === "…" ? <span key={`dots-${index}`}>…</span> : <Link className={item === result.page ? "active" : undefined} aria-current={item === result.page ? "page" : undefined} href={categoryUrl(slug, rawSearchParams, { page:item })} key={item}>{item}</Link>)}</div>
            {result.page < result.pageCount && <Link className="feed-pagination-direction" href={categoryUrl(slug, rawSearchParams, { page:result.page + 1 })}>Вперёд →</Link>}
          </nav>}

          {result.products.length > 0 && <div className="feed-listing-foot"><p>Не нашли точное сочетание? Это не означает, что поставка невозможна: каталог показывает только текущую витрину.</p><a href={selectorHref}>{slug === "borfrezy" ? "Подобрать без артикула →" : "Уточнить условия подбора →"}</a></div>}
        </div>
      </div>
    </div></section>

    <section className="section section-muted selection-guide-section"><div className="container subcategory-layout subcategory-layout--selection"><div className="selection-guide">
      <div className="section-heading"><div><p className="eyebrow">Критерии выбора</p><h2>{profile.criteriaTitle}</h2><p>{profile.criteriaIntro}</p></div></div>
      <ol className="selection-criteria-list">{selectionCriteria.map((parameter,index) => <li key={parameter.title}><span>{String(index+1).padStart(2,"0")}</span><div><b>{parameter.title}</b><p>{parameter.copy}</p></div></li>)}</ol>
      <p className="selection-guide-note"><b>Не обязательно знать артикул.</b> Достаточно описать задачу и известные параметры; инженер проверит совместимость, исполнение и комплектность.</p>
      <SelectionConversionBlock categoryTitle={feedCategory?.h1 ?? subcategory.label} />
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

function categoryUrl(slug: string, raw: SearchParams, change: { removeKey?: string; removeValue?: string; page?: number; setKey?: string; setValue?: string; toggleKey?: string; toggleValue?: string }): string {
  const params = new URLSearchParams();
  let toggledValueWasSelected = false;
  for (const [key, value] of Object.entries(raw)) {
    if (key === "page" || key === change.setKey) continue;
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
  return `/catalog/category/${slug}${query ? `?${query}` : ""}#products`;
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
