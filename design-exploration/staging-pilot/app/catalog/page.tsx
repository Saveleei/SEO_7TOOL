import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "../ui/Breadcrumbs";
import { PilotFooter } from "../ui/PilotFooter";
import { PilotHeader } from "../ui/PilotHeader";
import { getHomepageContentSettings } from "../data/homepageContentStore";
import { homepageAssetUrl } from "../data/homepageContentModel";
import { getProductionCategoryGroups, pilotFeedCategorySlugs } from "../data/productionCategoryGroups";
import { trustCardImageUrl } from "../data/trustContentModel";
import { getTrustContentSettings } from "../data/trustContentStore";

export default async function CatalogPage() {
  const groups = getProductionCategoryGroups(pilotFeedCategorySlugs);
  const [homepageContent, trustContent] = await Promise.all([getHomepageContentSettings(), getTrustContentSettings()]);
  const directionMedia = new Map(homepageContent.assortmentItems.map((item) => [item.id, item]));

  return (
    <div className="site-shell"><PilotHeader />
      <main className="inner-page">
        <div className="container"><Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Каталог" }]} /></div>
        <section className="page-hero"><div className="container page-hero-grid"><div><p className="eyebrow">Профильные направления 7TOOL</p><h1>Оборудование под задачи производства</h1><p>Открывайте готовый раздел или сразу описывайте операцию. Мы не заставляем искать позицию в длинном каталоге, если быстрее подобрать её по параметрам.</p></div><aside><b>Не нашли готовый раздел?</b><p>Укажите задачу, известную модель или приложите техническое задание. Вернём варианты после проверки поставки.</p><div className="page-hero-request-actions"><Link href="/?task=Нужен%20подбор%20промышленного%20оборудования#quick-order">Описать задачу →</Link><Link href="/?request=spec#quick-order">Передать ТЗ файлом</Link></div><small>Или отправьте запрос на <a href="mailto:info@7tool.ru">info@7tool.ru</a></small></aside></div></section>
        <section className="section"><div className="container catalog-direction-list">
          {groups.map((group) => {
            const media = directionMedia.get(group.slug);
            const mediaSrc = media?.imageAssetId ? homepageAssetUrl(media.imageAssetId) : group.representativeImage ?? group.image;
            return <article className="catalog-direction" key={group.id}>
            <header><span>{group.id}</span><div><p>{group.accent}</p><h2><Link href={group.href}>{group.title}</Link></h2></div><Link className="catalog-direction-media" data-fit={media?.imageFit ?? "contain"} data-position={media?.imagePosition ?? "center"} href={group.href} aria-label={`${group.title}: открыть направление`}><Image src={mediaSrc} alt={media?.imageAlt || ""} width={220} height={140} unoptimized={Boolean(media?.imageAssetId || group.representativeImage)} /><small>Товар из раздела</small></Link><strong>{group.subcategories.length}<small>категорий</small></strong></header>
            <nav aria-label={`Категории направления «${group.title}»`}>{group.subcategories.map((subcategory) => <Link href={subcategory.href} key={subcategory.slug}><span>{subcategory.label}</span><small>{(subcategory.count ?? 0).toLocaleString("ru-RU")} товарных групп</small><b aria-hidden="true">→</b></Link>)}</nav>
            <footer><span>Всего в направлении: <b>{(group.productCount ?? 0).toLocaleString("ru-RU")}</b> товарных групп</span><Link href={group.href}>Открыть направление →</Link></footer>
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
