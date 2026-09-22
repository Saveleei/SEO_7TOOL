import Link from "next/link";
import { Breadcrumbs } from "../ui/Breadcrumbs";
import { PilotFooter } from "../ui/PilotFooter";
import { PilotHeader } from "../ui/PilotHeader";
import { getProductionCategoryGroups, pilotFeedCategorySlugs } from "../data/productionCategoryGroups";

export default function CatalogPage() {
  const groups = getProductionCategoryGroups(pilotFeedCategorySlugs);

  return (
    <div className="site-shell"><PilotHeader />
      <main className="inner-page">
        <div className="container"><Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Каталог" }]} /></div>
        <section className="page-hero"><div className="container page-hero-grid"><div><p className="eyebrow">Профильные направления 7TOOL</p><h1>Оборудование под задачи производства</h1><p>Открывайте готовый раздел или сразу описывайте операцию. Мы не заставляем искать позицию в длинном каталоге, если быстрее подобрать её по параметрам.</p></div><aside><b>Не нашли готовый раздел?</b><p>Укажите задачу, известную модель или приложите техническое задание. Вернём варианты после проверки поставки.</p><div className="page-hero-request-actions"><Link href="/?task=Нужен%20подбор%20промышленного%20оборудования#quick-order">Описать задачу →</Link><Link href="/?request=spec#quick-order">Передать ТЗ файлом</Link></div><small>Или отправьте запрос на <a href="mailto:info@7tool.ru">info@7tool.ru</a></small></aside></div></section>
        <section className="section"><div className="container catalog-direction-list">
          {groups.map((group) => <article className="catalog-direction" key={group.id}>
            <header><span>{group.id}</span><div><p>{group.accent}</p><h2><Link href={group.href}>{group.title}</Link></h2></div><strong>{group.subcategories.length}<small>категорий</small></strong></header>
            <nav aria-label={`Категории направления «${group.title}»`}>{group.subcategories.map((subcategory) => <Link href={subcategory.href} key={subcategory.slug}><span>{subcategory.label}</span><small>{(subcategory.count ?? 0).toLocaleString("ru-RU")} товарных групп</small><b aria-hidden="true">→</b></Link>)}</nav>
            <footer><span>Всего в направлении: <b>{(group.productCount ?? 0).toLocaleString("ru-RU")}</b> товарных групп</span><Link href={group.href}>Открыть направление →</Link></footer>
          </article>)}
        </div></section>
      </main><PilotFooter /></div>
  );
}
