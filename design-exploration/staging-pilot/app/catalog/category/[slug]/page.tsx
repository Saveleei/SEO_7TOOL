import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "../../../ui/Breadcrumbs";
import { FeedProductList } from "../../../ui/FeedProductList";
import { ManagerContactCard } from "../../../ui/ManagerContactCard";
import { PilotFooter } from "../../../ui/PilotFooter";
import { PilotHeader } from "../../../ui/PilotHeader";
import { getCategoryLandingContent } from "../../../data/categoryLandingContent";
import { getFeedCategory, getFeedCategoryProductCount, getFeedCategoryProducts, toFeedProductCardModel } from "../../../data/feedCatalog";
import { getProductionSubcategory } from "../../../data/productionCategoryGroups";

type RouteProps = { params: Promise<{ slug: string }> };

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

export default async function SubcategoryPage({ params }: RouteProps) {
  const { slug } = await params;
  const entry = getProductionSubcategory(slug);
  if (!entry) return <div className="site-shell"><PilotHeader /><main className="inner-page"><section className="section"><div className="container empty-result"><b>Категория не найдена в активном фиде</b><p>Вернитесь в каталог или отправьте задачу инженеру.</p><Link href="/catalog">Открыть каталог →</Link></div></section></main><PilotFooter /></div>;

  const { group, subcategory } = entry;
  const landing = getCategoryLandingContent(group.slug);
  const feedCategory = getFeedCategory(slug);
  const products = getFeedCategoryProducts(slug, 6);
  const productCards = products.map(toFeedProductCardModel);
  const productCount = getFeedCategoryProductCount(slug);
  const subject = encodeURIComponent(`Запрос: ${subcategory.label}`);
  const selectorHref = slug === "stanki-sverlilnye" ? "/catalog/sverlenie/magnitnye-stanki" : undefined;

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

    <section className="section feed-category-listing"><div className="container">
      <div className="section-heading"><div><p className="eyebrow">Фактический ассортимент</p><h2>Товары из снимка фида</h2></div><p>{productCount > 0 ? `${productCount.toLocaleString("ru-RU")} товарных групп в категории. Сначала показываем шесть позиций с изображениями; актуальные условия подтверждаем в КП.` : "В снимке фида нет товарных карточек этой категории."}</p></div>
      {products.length > 0 ? <FeedProductList products={productCards} /> : <div className="feed-state"><span>Нет товарных данных</span><h2>Не будем заполнять раздел демонстрационными позициями</h2><p>Отправьте параметры задачи — менеджер проверит возможность поставки без обещаний по неподтверждённому ассортименту.</p><a className="button button-orange" href={`mailto:info@7tool.ru?subject=${subject}`}>Запросить подбор</a></div>}
      {products.length > 0 && <div className="feed-listing-foot"><p>Это витрина тестового снимка, а не обещание склада. В запрос КП попадут выбранные позиции и количество.</p><a href={`mailto:info@7tool.ru?subject=${subject}`}>Не нашли нужное — описать задачу →</a></div>}
    </div></section>

    <section className="section section-muted"><div className="container subcategory-layout"><div>
      <div className="section-heading"><div><p className="eyebrow">Критерии выбора</p><h2>Что сообщить для точного подбора</h2></div></div>
      <div className="category-parameter-grid category-parameter-grid--compact">{landing.parameters.map((parameter,index) => <article key={parameter.title}><span>0{index+1}</span><b>{parameter.title}</b><p>{parameter.copy}</p></article>)}</div>
    </div><aside><ManagerContactCard compact /></aside></div></section>

    <section className="section"><div className="container"><div className="section-heading"><div><p className="eyebrow">В той же производственной задаче</p><h2>Смежные подкатегории</h2></div></div><nav className="related-category-links" aria-label="Смежные подкатегории">{group.subcategories.filter((item) => item.slug !== subcategory.slug).map((item) => <Link href={item.href} key={item.slug}>{item.label}<span>→</span></Link>)}</nav></div></section>
  </main><PilotFooter /></div>;
}
