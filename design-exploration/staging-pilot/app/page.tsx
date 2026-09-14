import Link from "next/link";
import Image from "next/image";
import { HeroSearch } from "./ui/HeroSearch";
import { PilotFooter } from "./ui/PilotFooter";
import { PilotHeader } from "./ui/PilotHeader";
import { ProcurementWorkbench } from "./ui/ProcurementWorkbench";
import { ProductionCategoryGrid } from "./ui/ProductionCategoryGrid";
import { siteContact } from "./data/contactConfig";
import { getProductionCategoryGroups, pilotFeedCategorySlugs } from "./data/productionCategoryGroups";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const rawSearchParams = await searchParams;
  const initialTask = typeof rawSearchParams.task === "string" ? rawSearchParams.task : undefined;
  const categoryGroups = getProductionCategoryGroups(pilotFeedCategorySlugs);
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
              <p className="hero-lead">Магнитные и ленточнопильные станки, кромкорезы, корончатые свёрла, борфрезы, компрессоры, сварочная автоматизация и производственная оснастка. Подберём исполнение и подтвердим цену, совместимость и срок до оплаты.</p>
              <div className="hero-search-heading"><b>Знаете, что искать?</b><span>Введите товар, модель или опишите операцию</span></div>
              <HeroSearch />
              <nav className="hero-category-shortcuts" aria-label="Популярные категории">
                <span>Быстрый переход:</span>
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
                  const feedImage = group.subcategories[0]?.image;
                  return <Link href={group.href} key={group.slug}>
                    <span className="hero-assortment-image"><Image src={feedImage ?? group.image} alt={`Пример товара: ${group.title}`} width={180} height={110} unoptimized={Boolean(feedImage)} /></span>
                    <b>{group.title}</b>
                    <small>{formatCategoryCount(group.subcategories.length)}</small>
                  </Link>;
                })}
              </nav>
              <div className="hero-assortment-actions">
                <a className="button button-dark" href="#production-categories">Открыть все направления</a>
                <a className="button button-quiet" href="#quick-order">Не знаете модель? Подобрать по задаче</a>
              </div>
              <small className="hero-assortment-note">Артикул не обязателен: инженер уточнит задачу и предложит подходящие варианты.</small>
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

        <section className="section" id="production-categories">
          <div className="container">
            <div className="section-heading">
              <div><p className="eyebrow">Каталог без знания артикула</p><h2>Выберите производственную задачу</h2></div>
              <p>Каждое направление сразу раскрывает реальные категории с товарами. Можно перейти в нужный тип оборудования, не открывая промежуточные меню.</p>
            </div>
            <div className="home-catalog-overview"><div><b>{categoryGroups.length}</b><span>производственных задач</span></div><div><b>{categoryCount}</b><span>категории с товарами</span></div><p>Не уверены в разделе? Выберите ближайшую операцию — внутри можно уточнить параметры или передать задачу инженеру.</p><Link href="/catalog">Посмотреть весь каталог →</Link></div>
            <ProductionCategoryGrid groups={categoryGroups} />
          </div>
        </section>

        <section className="section assurance-section"><div className="container"><div className="section-heading"><div><p className="eyebrow">Не обещания, а проверяемые этапы</p><h2>Что снижает риск закупки</h2></div><p>Инженер, документы и подтверждённые условия поставки находятся рядом с товаром — всё необходимое для решения собрано в одном месте.</p></div><div className="assurance-grid">
          <article><Image src="/site/why-engineer.webp" alt="Инженер проверяет параметры оборудования" width={420} height={240} /><div><span>01 · Инженер</span><h3>Проверка применимости</h3><p>Сопоставляем операцию, материал, режим работы и совместимую оснастку.</p></div></article>
          <article><Image src="/site/why-documents.webp" alt="Документы к поставке оборудования" width={420} height={240} /><div><span>02 · Документы</span><h3>Паспорт и сертификаты</h3><p>Собираем пакет документов по конкретному артикулу до оплаты.</p></div></article>
          <article><Image src="/site/why-stock.webp" alt="Проверка наличия промышленного оборудования" width={420} height={240} /><div><span>03 · Поставка</span><h3>Цена, наличие и срок</h3><p>Фиксируем подтверждённые условия в КП, а не показываем сомнительные остатки.</p></div></article>
        </div></div></section>

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
