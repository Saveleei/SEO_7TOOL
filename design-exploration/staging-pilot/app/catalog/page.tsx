import Link from "next/link";
import { Breadcrumbs } from "../ui/Breadcrumbs";
import { PilotFooter } from "../ui/PilotFooter";
import { PilotHeader } from "../ui/PilotHeader";

const catalog = [
  ["01", "Сверление и резьбонарезание", "Станки, свёрла, метчики, манипуляторы", "2 192 варианта", "/catalog/sverlenie"],
  ["02", "Обработка кромки", "Кромкорезы для листа и труб", "128 вариантов", "#"],
  ["03", "Резка металла", "Пильные станки, диски, труборезы, лазер", "406 вариантов", "#"],
  ["04", "Сварка и автоматизация", "Каретки, вращатели, роботы", "72 решения", "#"],
  ["05", "Шлифование поверхности", "Станки и борфрезы", "1 056 вариантов", "#"],
  ["06", "Магнитное и грузоподъёмное", "Оснастка и захваты", "114 вариантов", "#"],
  ["07", "Компрессорное оборудование", "Подбор по расходу и давлению", "16 моделей", "#"],
  ["08", "Оснастка и расходные материалы", "Свёрла, диски, борфрезы, СОЖ", "3 262 варианта", "#"],
];

export default function CatalogPage() {
  return (
    <div className="site-shell"><PilotHeader />
      <main className="inner-page">
        <div className="container"><Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Каталог" }]} /></div>
        <section className="page-hero"><div className="container page-hero-grid"><div><p className="eyebrow">23 категории · 3 994 варианта</p><h1>Каталог по производственным задачам</h1><p>Выберите технологический процесс. Внутри мы разделим оборудование, оснастку и проектные решения.</p></div><aside><b>Нужен быстрый ответ?</b><p>Отправьте список моделей или техническое задание напрямую на почту.</p><a href="mailto:info@7tool.ru?subject=Запрос%20из%20тестового%20каталога">info@7tool.ru →</a></aside></div></section>
        <section className="section"><div className="container catalog-direction-list">
          {catalog.map(([id,title,copy,count,href]) => <Link href={href} className={`catalog-direction ${href === "#" ? "catalog-direction-disabled" : ""}`} key={id}><span>{id}</span><div><h2>{title}</h2><p>{copy}</p></div><small>{count}</small><b>{href === "#" ? "Скоро" : "Открыть →"}</b></Link>)}
        </div></section>
      </main><PilotFooter /></div>
  );
}
