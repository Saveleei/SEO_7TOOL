import Link from "next/link";
import Image from "next/image";
import { Breadcrumbs } from "../../ui/Breadcrumbs";
import { PilotFooter } from "../../ui/PilotFooter";
import { PilotHeader } from "../../ui/PilotHeader";

const groups = [
  { title:"Магнитные сверлильные станки", copy:"Мобильное сверление отверстий в металле", count:"47 моделей", image:"/products/lenz-steyr-35.jpg", href:"/catalog/sverlenie/magnitnye-stanki", type:"Оборудование" },
  { title:"Корончатые свёрла", copy:"HSS и TCT, рабочая длина до 110 мм", count:"1 385 вариантов", image:"/products/annular-drills.png", href:"#", type:"Оснастка" },
  { title:"Свёрла и зенковки", copy:"Ступенчатые, спиральные, цековки", count:"477 вариантов", image:"/products/annular-drills.png", href:"#", type:"Оснастка" },
  { title:"Метчики", copy:"Машинные и ручные, сквозные и глухие", count:"130 вариантов", image:"/products/annular-drills.png", href:"#", type:"Оснастка" },
  { title:"Резьбонарезные манипуляторы", copy:"Электрические и пневматические", count:"36 решений", image:"/products/heden-dm-36k.png", href:"#", type:"Оборудование" },
  { title:"Алмазное бурение", copy:"Установки и алмазные коронки", count:"78 вариантов", image:"/products/annular-drills.png", href:"#", type:"Смешанная" },
];

export default function DrillingPage() {
  return <div className="site-shell"><PilotHeader /><main className="inner-page">
    <div className="container"><Breadcrumbs items={[{label:"Главная",href:"/"},{label:"Каталог",href:"/catalog"},{label:"Сверление и резьба"}]} /></div>
    <section className="page-hero drilling-hero"><div className="container page-hero-grid"><div><p className="eyebrow">Направление 01</p><h1>Сверление и резьбонарезание</h1><p>Сначала выберите оборудование или оснастку. Для совместимости станка и инструмента доступен инженерный подбор.</p><div className="inline-actions"><Link className="button button-orange" href="/catalog/sverlenie/magnitnye-stanki">Подобрать станок</Link><a className="button button-outline-light" href="mailto:info@7tool.ru">Спросить инженера</a></div></div><aside className="task-chooser"><span>Быстрый сценарий</span><b>Нужно отверстие Ø35 мм</b><p>Покажем станки и совместимые корончатые свёрла.</p><Link href="/catalog/sverlenie/magnitnye-stanki">Показать комплект →</Link></aside></div></section>
    <section className="section"><div className="container"><div className="section-heading"><div><p className="eyebrow">Оборудование и оснастка</p><h2>Выберите, что требуется</h2></div><p>Карточки отражают реальные размеры разделов по текущему фиду.</p></div><div className="group-grid">{groups.map(group=><Link href={group.href} className={`group-card ${group.href==="#"?"group-card-disabled":""}`} key={group.title}><div className="group-media"><span>{group.type}</span><Image src={group.image} alt="" width={420} height={300} /></div><div className="group-copy"><h2>{group.title}</h2><p>{group.copy}</p><small>{group.count}</small><b>{group.href==="#"?"Следующий этап":"Открыть →"}</b></div></Link>)}</div></div></section>
    <section className="compatibility"><div className="container compatibility-grid"><div><p className="eyebrow">Совместимость до оплаты</p><h2>Подберём станок и оснастку одним комплектом</h2></div><ol><li><span>1</span>Диаметр и глубина</li><li><span>2</span>Материал детали</li><li><span>3</span>Режим работы</li></ol><a className="button button-orange" href="mailto:info@7tool.ru?subject=Подбор%20комплекта%20для%20сверления">Отправить параметры</a></div></section>
  </main><PilotFooter /></div>;
}
