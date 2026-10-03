import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PilotFooter } from "./ui/PilotFooter";
import { PilotHeader } from "./ui/PilotHeader";
import { HomepageCategoryTiles } from "./ui/HomepageCategoryTiles";
import { HomepageAnalytics } from "./ui/HomepageAnalytics";
import { HomepageTaskPaths } from "./ui/HomepageTaskPaths";
import { ProcurementWorkbench } from "./ui/ProcurementWorkbench";
import { TrustSection } from "./ui/TrustSection";
import { siteContact } from "./data/contactConfig";
import { getHomepageContentSettings } from "./data/homepageContentStore";
import { homepageAssetUrl } from "./data/homepageContentModel";
import { getHomepageKeyCategories, getProductionCategoryGroups, pilotFeedCategorySlugs } from "./data/productionCategoryGroups";
import { getTrustContentSettings } from "./data/trustContentStore";
import { orderTrustCardsForDisplay, trustCardImageUrl } from "./data/trustContentModel";
import { createPublicMetadata } from "./data/seo";

export const metadata: Metadata = createPublicMetadata({
  title:"Промышленное оборудование и оснастка для металлообработки — 7TOOL",
  description:"Сверлильные станки, корончатые свёрла, кромкорезы, труборезы, сварочная автоматизация и оснастка. Подбор по задаче, КП с НДС и доставка по России.",
  path:"/",
});

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const rawSearchParams = await searchParams;
  const [trustContent, homepageContent] = await Promise.all([getTrustContentSettings(), getHomepageContentSettings()]);
  const initialTask = typeof rawSearchParams.task === "string" ? rawSearchParams.task : undefined;
  const initialTool = rawSearchParams.request === "spec" ? "spec" as const : undefined;
  const categoryGroups = getProductionCategoryGroups(pilotFeedCategorySlugs);
  const keyCategoryBySlug = new Map(getHomepageKeyCategories().map((category) => [category.slug, category]));
  const homepageKeyCategories = homepageContent.categoryItems.flatMap((item) => {
    const category = keyCategoryBySlug.get(item.id);
    return category ? [{ ...category, label:item.title, image:item.imageAssetId ? homepageAssetUrl(item.imageAssetId) : category.image, imageAlt:item.imageAlt, imageFit:item.imageFit, imagePosition:item.imagePosition }] : [];
  });
  const categoryCount = new Set(categoryGroups.flatMap((group) => group.subcategories.map((subcategory) => subcategory.slug))).size;
  return (
    <div className="site-shell">
      <HomepageAnalytics />
      <PilotHeader />
      <main className="homepage-main">
        <section className="hero" id="top">
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">{homepageContent.hero.eyebrow}</p>
              <h1>{homepageContent.hero.title}</h1>
              <p className="hero-lead">{homepageContent.hero.intro}</p>
              <div className="hero-primary-actions">
                <Link className="button button-dark" href="/catalog" data-home-action="open_catalog">Открыть каталог</Link>
                <a className="button button-quiet" href="#production-categories" data-home-action="choose_task">Выбрать по задаче</a>
              </div>
              <Link className="hero-specification-link" href="/?request=spec#quick-order" data-home-action="upload_specification">Есть ТЗ или список позиций? Передать файл без письма →</Link>
              <div className="hero-mobile-catalog-preview" aria-label="Быстрый вход в каталог">
                <HomepageCategoryTiles categories={homepageKeyCategories.slice(0, 3)} compact />
                <Link href="/catalog">Все разделы каталога →</Link>
              </div>
              <nav className="hero-category-shortcuts" aria-label="Популярные категории">
                <span>Часто ищут:</span>
                <Link href="/catalog/category/stanki-sverlilnye">Магнитные станки</Link>
                <Link href="/catalog/category/kromkorezy-dlya-trub">Кромкорезы для труб</Link>
                <Link href="/catalog/category/borfrezy">Борфрезы</Link>
                <Link href="/catalog/category/koronchatye-sverla">Корончатые сверла</Link>
              </nav>
              <div className="hero-direct-contacts" data-contact-placement="homepage_hero">
                <span>Нужно быстро уточнить возможность поставки?</span>
                <a href={siteContact.phoneHref}><small>Позвонить</small><b>{siteContact.phone}</b></a>
                <a href={`mailto:${siteContact.email}?subject=Запрос%20с%20сайта%207TOOL`}><small>Отправить запрос</small><b>{siteContact.email}</b></a>
              </div>
              <a className="hero-evidence-link" href="#assurance-title">
                <span className="hero-evidence-link__photos" aria-hidden="true">{orderTrustCardsForDisplay(trustContent.cards).slice(0, 3).map((card) => <Image key={card.id} src={trustCardImageUrl(card)} alt="" width={52} height={52} unoptimized={Boolean(card.imageAssetId)} />)}</span>
                <span className="hero-evidence-link__copy"><b>Реальные склад, комплектация и отгрузка</b><small>6 фотографий: хранение, работа людей и подготовка груза →</small></span>
              </a>
            </div>
            <aside className="hero-catalog-card" aria-labelledby="hero-catalog-title">
              <div className="hero-catalog-card__heading">
                <div><p className="eyebrow">{homepageContent.categories.eyebrow}</p><h2 id="hero-catalog-title">{homepageContent.categories.title}</h2></div>
                <Link href="/catalog">Весь каталог →</Link>
              </div>
              <p>{homepageContent.categories.intro}</p>
              <HomepageCategoryTiles categories={homepageKeyCategories} compact />
              <div className="hero-catalog-card__foot">
                <span>На главной — 6 основных разделов</span>
                <span>Всего {formatCategoryCount(categoryCount)}</span>
              </div>
            </aside>
          </div>
        </section>

        <section className="proof-strip" aria-label="Условия поставки">
          <div className="container proof-grid">
            <div><Link href="/delivery"><strong>Доставка по России</strong><span>стоимость и срок подтверждаем до оплаты</span></Link></div>
            <div><Link href="/payment"><strong>Отсрочка платежа</strong><span>возможна для организаций после согласования</span></Link></div>
            <div><Link href="/ordering"><strong>Счёт с НДС</strong><span>цена и комплектность указаны в КП</span></Link></div>
            <div><Link href="/warranty"><strong>Гарантия</strong><span>условия и документы указываем до оплаты</span></Link></div>
          </div>
        </section>

        <section className="section production-task-section" id="production-categories">
          <div className="container">
            <div className="section-heading">
              <div><p className="eyebrow">{homepageContent.tasks.eyebrow}</p><h2>{homepageContent.tasks.title}</h2></div>
              <p>{homepageContent.tasks.intro}</p>
            </div>
            <HomepageTaskPaths groups={categoryGroups} />
            <div className="homepage-task-foot"><span>{categoryGroups.length} направлений · {formatCategoryCount(categoryCount)}</span><Link href="/catalog">Смотреть структуру всего каталога →</Link></div>
          </div>
        </section>

        <TrustSection content={trustContent} />

        <section className="section procurement-section">
          <div className="container procurement-grid">
            <div className="procurement-copy"><p className="eyebrow">Инженерный запрос</p><h2>Начните с задачи, а не с нашего каталога</h2><p>Опишите операцию, материал и условия работы, укажите известную модель либо передайте готовую спецификацию. Подтвердим, что действительно можем поставить.</p><ul><li>Подбор по производственной задаче</li><li>Замена отсутствующей модели</li><li>Разбор ТЗ и спецификации</li></ul><a href="mailto:info@7tool.ru?subject=Запрос%20на%20подбор">Можно сразу написать на <b>info@7tool.ru</b> →</a></div>
            <ProcurementWorkbench initialTask={initialTask} initialTool={initialTool} />
          </div>
        </section>

      </main>
      <PilotFooter />
    </div>
  );
}

function formatCategoryCount(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  const noun = mod100 >= 11 && mod100 <= 14 ? "категорий" : mod10 === 1 ? "категория" : mod10 >= 2 && mod10 <= 4 ? "категории" : "категорий";
  return `${count} ${noun}`;
}
