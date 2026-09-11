import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "../../../ui/Breadcrumbs";
import { FeedProductList } from "../../../ui/FeedProductList";
import { FeedProductTable } from "../../../ui/FeedProductTable";
import { ManagerContactCard } from "../../../ui/ManagerContactCard";
import { PilotFooter } from "../../../ui/PilotFooter";
import { PilotHeader } from "../../../ui/PilotHeader";
import { getCategoryLandingContent } from "../../../data/categoryLandingContent";
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
  if (!entry) return <div className="site-shell"><PilotHeader /><main className="inner-page"><section className="section"><div className="container empty-result"><b>Категория не найдена в активном фиде</b><p>Вернитесь в каталог или отправьте задачу инженеру.</p><Link href="/catalog">Открыть каталог →</Link></div></section></main><PilotFooter /></div>;

  const { group, subcategory } = entry;
  const landing = getCategoryLandingContent(group.slug);
  const feedCategory = getFeedCategory(slug);
  const search = firstValue(rawSearchParams.q)?.trim() ?? "";
  const requestedSort = firstValue(rawSearchParams.sort);
  const sort = sortOptions.some((option) => option.value === requestedSort) ? requestedSort as FeedCategorySort : "relevance";
  const requestedPage = Number.parseInt(firstValue(rawSearchParams.page) ?? "1", 10);
  const requestedView = firstValue(rawSearchParams.view);
  const filters = Object.fromEntries(Object.entries(rawSearchParams)
    .filter(([key]) => key.startsWith("f_"))
    .map(([key, value]) => [key.slice(2), valuesOf(value).filter(Boolean)]));
  const result = getFeedCategoryPage(slug, { search, sort, page:Number.isFinite(requestedPage) ? requestedPage : 1, filters });
  const productCards = result.products.map(toFeedProductCardModel);
  const canUseTable = prefersDenseFeedTable(slug);
  const view = canUseTable && requestedView !== "cards" ? "table" : "cards";
  const activeFilterCount = Object.values(filters).reduce((sum, values) => sum + values.length, 0) + (search ? 1 : 0);
  const subject = encodeURIComponent(`Запрос: ${subcategory.label}`);
  const selectorHref = slug === "stanki-sverlilnye" ? "/catalog/sverlenie/magnitnye-stanki" : undefined;
  const start = result.total > 0 ? (result.page - 1) * result.pageSize + 1 : 0;
  const end = Math.min(result.page * result.pageSize, result.total);

  return <div className="site-shell"><PilotHeader /><main className="inner-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Каталог", href:"/catalog" }, { label:group.title, href:group.href }, { label:subcategory.label }]} /></div>

    <section className="page-hero"><div className="container page-hero-grid"><div>
      <p className="eyebrow">{group.title}</p>
      <h1>{feedCategory?.h1 ?? subcategory.label}</h1>
      <p>{feedCategory?.intro ?? landing.intro} Цена показана по тестовому снимку фида; наличие и срок подтверждаются для выбранного исполнения.</p>
    </div><aside>
      <b>{selectorHref ? "Нужен технический отбор?" : "Не знаете точную модель?"}</b>
      <p>{selectorHref ? "Сузьте выбор по диаметру, массе, шпинделю и рабочим функциям." : "Укажите основные параметры задачи. Можно начать без артикула и точной модели."}</p>
      {selectorHref ? <Link href={selectorHref}>Подобрать магнитный станок →</Link> : <a href={`mailto:info@7tool.ru?subject=${subject}`}>Отправить параметры →</a>}
    </aside></div></section>

    <section className="section feed-category-listing" id="products"><div className="container">
      <div className="section-heading"><div><p className="eyebrow">Фактический ассортимент</p><h2>Выберите подходящее исполнение</h2></div><p>Характеристики и цены взяты из локального снимка фида. Наличие и срок поставки подтверждаем в КП.</p></div>

      <div className="feed-catalog-layout">
        <aside className="feed-filter-panel">
          <input className="feed-filter-toggle" type="checkbox" id={`feed-filters-${slug}`} aria-label="Показать или скрыть фильтры" />
          <label className="feed-filter-summary" htmlFor={`feed-filters-${slug}`}><span><b>Фильтры</b><small>{activeFilterCount > 0 ? `Выбрано: ${activeFilterCount}` : "По характеристикам фида"}</small></span><i aria-hidden="true">+</i></label>
          <form method="get" action={`/catalog/category/${slug}#products`}>
            {requestedView && <input type="hidden" name="view" value={requestedView} />}
            <label className="feed-filter-search"><span>Поиск в категории</span><input type="search" name="q" defaultValue={search} placeholder="Название, бренд или модель" /></label>
            <label className="feed-filter-sort"><span>Порядок товаров</span><select name="sort" defaultValue={sort}>{sortOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
            {result.facets.map((facet) => <fieldset key={facet.key}><legend>{facet.label}</legend><small>{facet.help}</small><div>{facet.options.map((option) => <label key={option.value}><input type="checkbox" name={`f_${facet.key}`} value={option.value} defaultChecked={filters[facet.key]?.includes(option.value)} /><span>{option.label}</span><em>{option.count}</em></label>)}</div></fieldset>)}
            <div className="feed-filter-actions"><button className="button button-orange" type="submit">Показать товары</button><Link href={`/catalog/category/${slug}#products`}>Сбросить</Link></div>
          </form>
        </aside>

        <div className="feed-results">
          <div className="feed-results-toolbar"><p><b>{result.total.toLocaleString("ru-RU")}</b> {pluralizeProducts(result.total)}{result.total > 0 && <span> · показаны {start}–{end}</span>}</p><div className="feed-toolbar-controls">
            {canUseTable && <nav className="feed-view-switch" aria-label="Вид списка"><a className={view === "table" ? "active" : undefined} href={categoryUrl(slug, rawSearchParams, { setKey:"view", setValue:"table" })}>Таблица</a><a className={view === "cards" ? "active" : undefined} href={categoryUrl(slug, rawSearchParams, { setKey:"view", setValue:"cards" })}>Карточки</a></nav>}
            <form method="get" action={`/catalog/category/${slug}#products`}>
              {requestedView && <input type="hidden" name="view" value={requestedView} />}
              {search && <input type="hidden" name="q" value={search} />}
              {Object.entries(filters).flatMap(([key, values]) => values.map((value) => <input type="hidden" name={`f_${key}`} value={value} key={`${key}-${value}`} />))}
              <label><span>Сортировка</span><select name="sort" defaultValue={sort}>{sortOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label><button type="submit">Применить</button>
            </form>
          </div></div>

          {activeFilterCount > 0 && <nav className="feed-applied-filters" aria-label="Применённые фильтры"><span>Вы выбрали:</span>
            {search && <Link href={categoryUrl(slug, rawSearchParams, { removeKey:"q" })}>Поиск: {search}<b aria-hidden="true">×</b></Link>}
            {result.facets.flatMap((facet) => (filters[facet.key] ?? []).map((value) => <Link href={categoryUrl(slug, rawSearchParams, { removeKey:`f_${facet.key}`, removeValue:value })} key={`${facet.key}-${value}`}>{facet.label}: {value}<b aria-hidden="true">×</b></Link>))}
            <Link className="feed-reset-all" href={`/catalog/category/${slug}#products`}>Очистить всё</Link>
          </nav>}

          {result.products.length > 0 ? view === "table" ? <FeedProductTable products={productCards} columns={result.facets.filter((facet) => facet.keyword).map((facet) => facet.label).slice(0, 3)} /> : <FeedProductList products={productCards} /> : <div className="feed-state"><span>Нет точных совпадений</span><h2>Ослабьте один из параметров</h2><p>Снимите фильтр или отправьте задачу менеджеру — проверим аналоги, которых может не быть в текущем фиде.</p><div><Link className="button" href={`/catalog/category/${slug}#products`}>Сбросить фильтры</Link><a className="button button-orange" href={`mailto:info@7tool.ru?subject=${subject}`}>Запросить подбор</a></div></div>}

          {result.pageCount > 1 && <nav className="feed-pagination" aria-label="Страницы товаров">
            {result.page > 1 && <Link className="feed-pagination-direction" href={categoryUrl(slug, rawSearchParams, { page:result.page - 1 })}>← Назад</Link>}
            <div>{paginationItems(result.page, result.pageCount).map((item, index) => item === "…" ? <span key={`dots-${index}`}>…</span> : <Link className={item === result.page ? "active" : undefined} aria-current={item === result.page ? "page" : undefined} href={categoryUrl(slug, rawSearchParams, { page:item })} key={item}>{item}</Link>)}</div>
            {result.page < result.pageCount && <Link className="feed-pagination-direction" href={categoryUrl(slug, rawSearchParams, { page:result.page + 1 })}>Вперёд →</Link>}
          </nav>}

          {result.products.length > 0 && <div className="feed-listing-foot"><p>Не нашли точное сочетание? Это не означает, что поставка невозможна: фид показывает только текущую витрину.</p><a href={`mailto:info@7tool.ru?subject=${subject}`}>Описать задачу менеджеру →</a></div>}
        </div>
      </div>
    </div></section>

    <section className="section section-muted"><div className="container subcategory-layout"><div>
      <div className="section-heading"><div><p className="eyebrow">Критерии выбора</p><h2>Что сообщить для точного подбора</h2></div></div>
      <div className="category-parameter-grid category-parameter-grid--compact">{landing.parameters.map((parameter,index) => <article key={parameter.title}><span>0{index+1}</span><b>{parameter.title}</b><p>{parameter.copy}</p></article>)}</div>
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

function categoryUrl(slug: string, raw: SearchParams, change: { removeKey?: string; removeValue?: string; page?: number; setKey?: string; setValue?: string }): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (key === "page" || key === change.setKey) continue;
    if (key === change.removeKey) {
      for (const item of valuesOf(value)) if (change.removeValue && item !== change.removeValue) params.append(key, item);
      continue;
    }
    for (const item of valuesOf(value)) params.append(key, item);
  }
  if (change.setKey && change.setValue) params.set(change.setKey, change.setValue);
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

function pluralizeProducts(count: number): string {
  const modulo100 = count % 100;
  const modulo10 = count % 10;
  if (modulo100 >= 11 && modulo100 <= 14) return "товаров";
  if (modulo10 === 1) return "товар";
  if (modulo10 >= 2 && modulo10 <= 4) return "товара";
  return "товаров";
}
