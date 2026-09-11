import { Breadcrumbs } from "../../../ui/Breadcrumbs";
import { PilotFooter } from "../../../ui/PilotFooter";
import { PilotHeader } from "../../../ui/PilotHeader";
import { ProductListing } from "../../../ui/ProductListing";
import { DrillSelector } from "../../../ui/DrillSelector";

export default function MagneticDrillsPage() {
  return <div className="site-shell"><PilotHeader /><main className="inner-page">
    <div className="container"><Breadcrumbs items={[{label:"Главная",href:"/"},{label:"Каталог",href:"/catalog"},{label:"Сверление",href:"/catalog/sverlenie"},{label:"Магнитные станки"}]} /></div>
    <section className="category-intro"><div className="container category-intro-grid"><div><p className="eyebrow">Оборудование · подбор по 4 ключевым параметрам</p><h1>Магнитные сверлильные станки</h1><p>Сначала выберите максимальный диаметр и режим работы. Затем сравните массу, шпиндель и функции — именно эти параметры обычно меняют выбор модели.</p><nav className="category-shortcuts" aria-label="Популярные подборки"><a href="#products">До Ø35 мм</a><a href="#selector">С реверсом</a><a href="#selector">Для монтажа</a><a href="#products">Weldon 19</a></nav></div><div className="category-fast"><span>Персональный подбор</span><b>Евгений Савельев</b><p>Поможет проверить задачу, подобрать оснастку и подготовить КП.</p><a href="mailto:info@7tool.ru?subject=Подбор%20магнитного%20станка">info@7tool.ru →</a></div></div></section>
    <section className="selector-section" id="selector"><div className="container"><DrillSelector /></div></section>
    <section className="listing-section" id="products"><div className="container"><ProductListing /></div></section>
    <section className="expert-bar"><div className="container"><div><b>Не уверены в диаметре или типе шпинделя?</b><span>Инженер проверит режим работы и совместимость оснастки.</span></div><a href="mailto:info@7tool.ru?subject=Нужна%20помощь%20с%20магнитным%20станком">Задать вопрос →</a></div></section>
  </main><PilotFooter /></div>;
}
