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
              <p className="eyebrow">Промышленное оборудование · оснастка · расходные материалы</p>
              <h1>Найдите оборудование по модели или производственной задаче</h1>
              <p className="hero-lead">Каталог 7TOOL помогает дойти от операции и параметров до конкретного исполнения. Цена, совместимость и срок поставки подтверждаются до оплаты.</p>
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
            <aside className="hero-decision-card" aria-labelledby="hero-decision-title">
              <p className="eyebrow">Если точная модель неизвестна</p>
              <h2 id="hero-decision-title">Начните с задачи производства</h2>
              <p>Артикул не нужен. Выберите операцию ниже или передайте инженеру известные исходные данные.</p>
              <ol>
                <li><span>01</span><div><b>Что нужно сделать</b><small>сверлить, снять фаску, нарезать резьбу, резать или автоматизировать сварку</small></div></li>
                <li><span>02</span><div><b>С чем работаете</b><small>материал, тип заготовки и основные размеры</small></div></li>
                <li><span>03</span><div><b>Какие есть ограничения</b><small>место работы, питание, режим и требуемая производительность</small></div></li>
              </ol>
              <div className="hero-decision-actions">
                <a className="button button-dark" href="#production-categories">Выбрать производственную задачу</a>
                <a className="button button-quiet" href="#quick-order">Описать задачу инженеру</a>
              </div>
              <small className="hero-decision-note">В ответе: подходящие варианты, цена с НДС и срок после проверки.</small>
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
