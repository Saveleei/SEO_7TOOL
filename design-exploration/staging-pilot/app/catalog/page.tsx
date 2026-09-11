import Link from "next/link";
import { Breadcrumbs } from "../ui/Breadcrumbs";
import { PilotFooter } from "../ui/PilotFooter";
import { PilotHeader } from "../ui/PilotHeader";

const catalog = [
  { id: "01", title: "Сверление и резьбонарезание", copy: "Магнитные станки, корончатые свёрла и подбор совместимого комплекта", mode: "Открытый раздел", href: "/catalog/sverlenie", action: "Открыть раздел →" },
  { id: "02", title: "Обработка кромки", copy: "Подберём кромкорез по типу заготовки, фаске, материалу и режиму работы", mode: "Подбор по задаче", href: "/#quick-order", action: "Описать задачу →" },
  { id: "03", title: "Резка металла", copy: "Проверим решение под материал, профиль, размеры заготовки и требуемый рез", mode: "Подбор по задаче", href: "/#quick-order", action: "Описать задачу →" },
  { id: "04", title: "Сварка и автоматизация", copy: "Подберём оборудование под процесс, геометрию изделия и производительность", mode: "Инженерный запрос", href: "/#quick-order", action: "Передать параметры →" },
  { id: "05", title: "Оснастка и расходные материалы", copy: "Проверим совместимость оснастки со станком, материалом и операцией", mode: "Подбор по оборудованию", href: "/#quick-order", action: "Подобрать оснастку →" },
];

export default function CatalogPage() {
  return (
    <div className="site-shell"><PilotHeader />
      <main className="inner-page">
        <div className="container"><Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Каталог" }]} /></div>
        <section className="page-hero"><div className="container page-hero-grid"><div><p className="eyebrow">Профильные направления 7TOOL</p><h1>Оборудование под задачи производства</h1><p>Открывайте готовый раздел или сразу описывайте операцию. Мы не заставляем искать позицию в длинном каталоге, если быстрее подобрать её по параметрам.</p></div><aside><b>Не нашли готовый раздел?</b><p>Укажите задачу, известную модель или приложите техническое задание. Вернём варианты после проверки поставки.</p><a href="mailto:info@7tool.ru?subject=Запрос%20на%20подбор%20оборудования">info@7tool.ru →</a></aside></div></section>
        <section className="section"><div className="container catalog-direction-list">
          {catalog.map((item) => <Link href={item.href} className="catalog-direction" key={item.id}><span>{item.id}</span><div><h2>{item.title}</h2><p>{item.copy}</p></div><small>{item.mode}</small><b>{item.action}</b></Link>)}
        </div></section>
      </main><PilotFooter /></div>
  );
}
