import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "../ui/Breadcrumbs";
import { PilotFooter } from "../ui/PilotFooter";
import { PilotHeader } from "../ui/PilotHeader";
import { getCanonicalCatalogGroups, pilotFeedCategorySlugs } from "../data/productionCategoryGroups";
import { orderTrustCardsForDisplay, trustCardDisplayKicker, trustCardImageUrl } from "../data/trustContentModel";
import { getTrustContentSettings } from "../data/trustContentStore";
import { createPublicMetadata } from "../data/seo";

export const metadata: Metadata = createPublicMetadata({
  title:"Каталог промышленного оборудования и оснастки — 7TOOL",
  description:"Каталог оборудования для сверления, резки металла, обработки кромки, сварочной автоматизации и оснащения производства. Подбор по параметрам и задаче.",
  path:"/catalog",
  keywords:["каталог промышленного оборудования", "оборудование для металлообработки", "металлообрабатывающие станки", "промышленная оснастка", "оборудование для производства", "промышленный инструмент"],
});

export default async function CatalogPage() {
  const groups = getCanonicalCatalogGroups(pilotFeedCategorySlugs);
  const categoryCount = groups.reduce((total, group) => total + group.subcategories.length, 0);
  const trustContent = await getTrustContentSettings();

  return (
    <div className="site-shell"><PilotHeader />
      <main className="inner-page catalog-overview-page">
        <div className="container"><Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Каталог" }]} /></div>
        <section className="page-hero catalog-overview-hero"><div className="container page-hero-grid"><div><p className="eyebrow">Каталог 7TOOL · {categoryCount} категорий</p><h1>Промышленное оборудование и оснастка</h1><p>Выберите тип оборудования в одном из шести разделов. Если важнее операция, материал или параметры детали — перейдите к подбору по задаче.</p><div className="catalog-overview-actions"><Link className="button button-dark" href="#catalog-directions">Выбрать раздел</Link><Link className="button button-quiet" href="/#production-categories">Подобрать по задаче</Link></div><Link className="catalog-spec-link" href="/?request=spec#quick-order">Есть ТЗ? Передать файл →</Link></div><aside><b>Есть техническое задание?</b><p>Приложите файл или опишите задачу. Инженер проверит применимость, конкретное исполнение и условия поставки.</p><div className="page-hero-request-actions"><Link href="/?request=spec#quick-order">Передать ТЗ файлом</Link><Link href="/?task=Нужен%20подбор%20промышленного%20оборудования#quick-order">Описать задачу</Link></div><small>Запрос привязывается к заявке и не требует знания артикула.</small></aside></div></section>
        <section className="section catalog-direction-section" id="catalog-directions"><div className="container catalog-direction-list">
          {groups.map((group) => {
            const taskHref = `/catalog/task/${group.slug}`;
            const directionClassName = group.subcategories.length <= 3 ? "catalog-direction catalog-direction--compact" : "catalog-direction";
            return <article className={directionClassName} id={`direction-${group.slug}`} key={group.id}>
            <header><Link className="catalog-direction-overview" href={taskHref} aria-label={`Открыть направление «${group.title}»`}><span>{group.id}</span><div><p>{group.accent}</p><h2>{group.title}</h2></div></Link><strong>{group.subcategories.length}<small>{categoryWord(group.subcategories.length)}</small></strong></header>
            <nav aria-label={`Категории раздела «${group.title}»`}>{group.subcategories.map((subcategory) => <Link className="catalog-subcategory-link" href={subcategory.href} key={subcategory.slug}>{subcategory.image && <span className="catalog-subcategory-media"><Image src={subcategory.image} alt="" width={104} height={78} unoptimized /></span>}<span className="catalog-subcategory-copy"><span>{subcategory.label}</span><small>{formatSeriesCount(subcategory.count ?? 0)}</small></span><b aria-hidden="true">→</b></Link>)}</nav>
            <footer><span>В разделе: <b>{formatSeriesCount(group.productCount ?? 0)}</b></span><Link href={taskHref} aria-label={`Подобрать по задаче в направлении «${group.title}»`}>Подобрать по задаче →</Link></footer>
          </article>})}
        </div></section>
        <section className="section catalog-evidence-section" aria-labelledby="catalog-evidence-title"><div className="container">
          <div className="section-heading"><div><p className="eyebrow">{trustContent.sectionEyebrow}</p><h2 id="catalog-evidence-title">{trustContent.sectionTitle}</h2></div><p>{trustContent.sectionIntro}</p></div>
          <div className="catalog-evidence-grid">
            {orderTrustCardsForDisplay(trustContent.cards).map((card, index) => <article key={card.id}><Image src={trustCardImageUrl(card)} alt={card.imageAlt} width={520} height={300} unoptimized={Boolean(card.imageAssetId)} /><div><span>{trustCardDisplayKicker(card, index)}</span><h3>{card.title}</h3><p>{card.text}</p></div></article>)}
          </div>
        </div></section>
      </main><PilotFooter /></div>
  );
}

function formatSeriesCount(count: number): string {
  const modulo100 = count % 100;
  const modulo10 = count % 10;
  const noun = modulo100 >= 11 && modulo100 <= 14 ? "товарных серий" : modulo10 === 1 ? "товарная серия" : modulo10 >= 2 && modulo10 <= 4 ? "товарные серии" : "товарных серий";
  return `${count.toLocaleString("ru-RU")} ${noun}`;
}

function categoryWord(count: number): string {
  const modulo100 = count % 100;
  const modulo10 = count % 10;
  return modulo100 >= 11 && modulo100 <= 14 ? "категорий" : modulo10 === 1 ? "категория" : modulo10 >= 2 && modulo10 <= 4 ? "категории" : "категорий";
}
