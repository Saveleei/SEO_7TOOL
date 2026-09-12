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
        <section className="page-hero"><div className="container page-hero-grid"><div><p className="eyebrow">Профильные направления 7TOOL</p><h1>Оборудование под задачи производства</h1><p>Открывайте готовый раздел или сразу описывайте операцию. Мы не заставляем искать позицию в длинном каталоге, если быстрее подобрать её по параметрам.</p></div><aside><b>Не нашли готовый раздел?</b><p>Укажите задачу, известную модель или приложите техническое задание. Вернём варианты после проверки поставки.</p><a href="mailto:info@7tool.ru?subject=Запрос%20на%20подбор%20оборудования">info@7tool.ru →</a></aside></div></section>
        <section className="section"><div className="container catalog-direction-list">
          {groups.map((group) => <Link href={group.href} className="catalog-direction" key={group.id}><span>{group.id}</span><div><h2>{group.title}</h2><p>{group.subcategories.map((subcategory) => subcategory.label).join(" · ")}</p></div><small>{group.subcategories.length} разделов с товарами</small><b>Открыть →</b></Link>)}
        </div></section>
      </main><PilotFooter /></div>
  );
}
