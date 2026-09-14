import Link from "next/link";
import Image from "next/image";
import { PilotFooter } from "./ui/PilotFooter";
import { PilotHeader } from "./ui/PilotHeader";
import { HomepageCategoryTiles } from "./ui/HomepageCategoryTiles";
import { HomepageTaskPaths } from "./ui/HomepageTaskPaths";
import { ProcurementWorkbench } from "./ui/ProcurementWorkbench";
import { TrustSection } from "./ui/TrustSection";
import { siteContact } from "./data/contactConfig";
import { getHomepageKeyCategories, getProductionCategoryGroups, pilotFeedCategorySlugs } from "./data/productionCategoryGroups";
import { getTrustContentSettings } from "./data/trustContentStore";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const rawSearchParams = await searchParams;
  const trustContent = await getTrustContentSettings();
  const initialTask = typeof rawSearchParams.task === "string" ? rawSearchParams.task : undefined;
  const categoryGroups = getProductionCategoryGroups(pilotFeedCategorySlugs);
  const homepageKeyCategories = getHomepageKeyCategories();
  const categoryCount = new Set(categoryGroups.flatMap((group) => group.subcategories.map((subcategory) => subcategory.slug))).size;
  return (
    <div className="site-shell">
      <PilotHeader />
      <main>
        <section className="hero" id="top">
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Сверление · резка · обработка кромки · сварка</p>
              <h1>Промышленное оборудование и оснастка для металлообработки</h1>
              <p className="hero-lead">Сверление, резка, обработка кромки, сварочная автоматизация и оснащение производства. Подберём исполнение и подтвердим цену, совместимость и срок поставки.</p>
              <div className="hero-primary-actions">
                <Link className="button button-dark" href="/catalog">Открыть каталог</Link>
                <a className="button button-quiet" href="#production-categories">Выбрать по задаче</a>
              </div>
              <nav className="hero-category-shortcuts" aria-label="Популярные категории">
                <span>Часто ищут:</span>
                <Link href="/catalog/category/stanki-sverlilnye">Магнитные станки</Link>
                <Link href="/catalog/category/kromkorezy-dlya-trub">Кромкорезы для труб</Link>
                <Link href="/catalog/category/borfrezy">Борфрезы</Link>
                <Link href="/catalog/category/kompressory">Компрессоры</Link>
              </nav>
              <div className="hero-direct-contacts" data-contact-placement="homepage_hero">
                <span>Нужно быстро уточнить возможность поставки?</span>
                <a href={siteContact.phoneHref}><small>Позвонить</small><b>{siteContact.phone}</b></a>
                <a href={`mailto:${siteContact.email}?subject=Запрос%20с%20сайта%207TOOL`}><small>Отправить запрос</small><b>{siteContact.email}</b></a>
              </div>
            </div>
            <aside className="hero-assortment-card" aria-labelledby="hero-assortment-title">
              <p className="eyebrow">Карта ассортимента</p>
              <h2 id="hero-assortment-title">Что поставляет 7TOOL</h2>
              <p>Выберите направление — внутри показаны категории, параметры и доступные исполнения.</p>
              <nav className="hero-assortment-map" aria-label="Основные направления каталога">
                {categoryGroups.map((group) => {
                  return <Link href={group.href} key={group.slug}>
                    <span className="hero-assortment-image"><Image src={group.representativeImage ?? group.image} alt={`Пример товара: ${group.title}`} width={180} height={110} unoptimized={Boolean(group.representativeImage)} /></span>
                    <b>{group.title}</b>
                    <small>{formatCategoryCount(group.subcategories.length)}</small>
                  </Link>;
                })}
              </nav>
              <div className="hero-assortment-foot">
                <span>{categoryGroups.length} направлений · {formatCategoryCount(categoryCount)}</span>
                <Link href="/catalog">Весь каталог →</Link>
              </div>
            </aside>
          </div>
        </section>

        <section className="proof-strip" aria-label="Условия поставки">
          <div className="container proof-grid">
            <div><strong>КП с НДС</strong><span>цена, наличие и срок в одном письме</span></div>
            <div><strong>Инженер</strong><span>проверит совместимость комплекта</span></div>
            <div><strong>Документы</strong><span>по конкретному артикулу</span></div>
            <div><strong>По РФ</strong><span>условия доставки фиксируются в КП</span></div>
          </div>
        </section>

        <section className="section homepage-key-categories-section" aria-labelledby="homepage-key-categories-title">
          <div className="container">
            <div className="homepage-key-categories-heading">
              <div>
                <p className="eyebrow">Быстрый вход в каталог</p>
                <h2 id="homepage-key-categories-title">Основные разделы каталога</h2>
                <p>Выберите тип оборудования или оснастки — внутри доступны характеристики, исполнения и подбор по параметрам.</p>
              </div>
              <Link className="button button-quiet" href="/catalog">Смотреть весь каталог</Link>
            </div>
            <HomepageCategoryTiles categories={homepageKeyCategories} />
            <div className="homepage-key-categories-foot">
              <span>Не знаете, какой раздел подходит вашей задаче?</span>
              <a href="#production-categories">Выбрать по производственной задаче →</a>
            </div>
          </div>
        </section>

        <section className="section production-task-section" id="production-categories">
          <div className="container">
            <div className="section-heading">
              <div><p className="eyebrow">Если не знаете раздел</p><h2>Начните с производственной задачи</h2></div>
              <p>Выберите ближайшую операцию. На следующем шаге увидите подходящие категории и сможете уточнить параметры без знания артикула.</p>
            </div>
            <HomepageTaskPaths groups={categoryGroups} />
            <div className="homepage-task-foot"><span>{categoryGroups.length} направлений · {formatCategoryCount(categoryCount)}</span><Link href="/catalog">Смотреть структуру всего каталога →</Link></div>
          </div>
        </section>

        <TrustSection content={trustContent} />

        <section className="section procurement-section">
          <div className="container procurement-grid">
            <div className="procurement-copy"><p className="eyebrow">Инженерный запрос</p><h2>Начните с задачи, а не с нашего каталога</h2><p>Опишите операцию, материал и условия работы, укажите известную модель либо передайте готовую спецификацию. Подтвердим, что действительно можем поставить.</p><ul><li>Подбор по производственной задаче</li><li>Замена отсутствующей модели</li><li>Разбор ТЗ и спецификации</li></ul><a href="mailto:info@7tool.ru?subject=Запрос%20на%20подбор">Можно сразу написать на <b>info@7tool.ru</b> →</a></div>
            <ProcurementWorkbench initialTask={initialTask} />
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
