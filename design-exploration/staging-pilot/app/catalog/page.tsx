import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "../ui/Breadcrumbs";
import { PilotFooter } from "../ui/PilotFooter";
import { PilotHeader } from "../ui/PilotHeader";
import { getHomepageContentSettings } from "../data/homepageContentStore";
import { homepageAssetUrl } from "../data/homepageContentModel";
import { getCanonicalCatalogGroups, pilotFeedCategorySlugs } from "../data/productionCategoryGroups";
import { trustCardImageUrl } from "../data/trustContentModel";
import { getTrustContentSettings } from "../data/trustContentStore";

export default async function CatalogPage() {
  const groups = getCanonicalCatalogGroups(pilotFeedCategorySlugs);
  const categoryCount = groups.reduce((total, group) => total + group.subcategories.length, 0);
  const [homepageContent, trustContent] = await Promise.all([getHomepageContentSettings(), getTrustContentSettings()]);
  const directionMedia = new Map(homepageContent.assortmentItems.map((item) => [item.id, item]));

  return (
    <div className="site-shell"><PilotHeader />
      <main className="inner-page catalog-overview-page">
        <div className="container"><Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Каталог" }]} /></div>
        <section className="page-hero catalog-overview-hero"><div className="container page-hero-grid"><div><p className="eyebrow">Каталог 7TOOL · {categoryCount} категорий</p><h1>Промышленное оборудование и оснастка</h1><p>Выберите тип оборудования в одном из шести разделов. Если важнее операция, материал или параметры детали — перейдите к подбору по задаче.</p><div className="catalog-overview-actions"><Link className="button button-dark" href="#catalog-directions">Выбрать раздел</Link><Link className="button button-quiet" href="/#production-categories">Подобрать по задаче</Link></div><Link className="catalog-spec-link" href="/?request=spec#quick-order">Есть ТЗ? Передать файл →</Link></div><aside><b>Есть техническое задание?</b><p>Приложите файл или опишите задачу. Инженер проверит применимость, конкретное исполнение и условия поставки.</p><div className="page-hero-request-actions"><Link href="/?request=spec#quick-order">Передать ТЗ файлом</Link><Link href="/?task=Нужен%20подбор%20промышленного%20оборудования#quick-order">Описать задачу</Link></div><small>Запрос привязывается к заявке и не требует знания артикула.</small></aside></div></section>
        <section className="section catalog-direction-section" id="catalog-directions"><div className="container catalog-direction-list">
          {groups.map((group) => {
            const media = directionMedia.get(group.slug);
            const mediaSrc = media?.imageAssetId ? homepageAssetUrl(media.imageAssetId) : group.representativeImage ?? group.image;
            return <article className="catalog-direction" id={`direction-${group.slug}`} key={group.id}>
            <header><span>{group.id}</span><div><p>{group.accent}</p><h2>{group.title}</h2></div><Link className="catalog-direction-media" data-fit={media?.imageFit ?? "contain"} data-position={media?.imagePosition ?? "center"} href={group.subcategories[0]?.href ?? "/catalog"} aria-label={`${group.title}: открыть первую категорию`}><Image src={mediaSrc} alt={media?.imageAlt || ""} width={220} height={140} unoptimized={Boolean(media?.imageAssetId || group.representativeImage)} /></Link><strong>{group.subcategories.length}<small>{categoryWord(group.subcategories.length)}</small></strong></header>
            <nav aria-label={`Категории раздела «${group.title}»`}>{group.subcategories.map((subcategory) => <Link href={subcategory.href} key={subcategory.slug}><span>{subcategory.label}</span><small>{formatSeriesCount(subcategory.count ?? 0)}</small><b aria-hidden="true">→</b></Link>)}</nav>
            <footer><span>В разделе: <b>{formatSeriesCount(group.productCount ?? 0)}</b></span><Link href={`/catalog/task/${group.slug}`}>Подбор в этом направлении →</Link></footer>
          </article>})}
        </div></section>
        <section className="section catalog-evidence-section" aria-labelledby="catalog-evidence-title"><div className="container">
          <div className="section-heading"><div><p className="eyebrow">{trustContent.sectionEyebrow}</p><h2 id="catalog-evidence-title">{trustContent.sectionTitle}</h2></div><p>{trustContent.sectionIntro}</p></div>
          <div className="catalog-evidence-grid">
            {trustContent.cards.map((card) => <article key={card.id}><Image src={trustCardImageUrl(card)} alt={card.imageAlt} width={520} height={300} unoptimized={Boolean(card.imageAssetId)} /><div><span>{card.kicker}</span><h3>{card.title}</h3><p>{card.text}</p></div></article>)}
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
