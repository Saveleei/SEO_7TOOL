import { Breadcrumbs } from "../../../ui/Breadcrumbs";
import { PilotFooter } from "../../../ui/PilotFooter";
import { PilotHeader } from "../../../ui/PilotHeader";
import { ProductListing } from "../../../ui/ProductListing";

export default function MagneticDrillsPage() {
  return <div className="site-shell"><PilotHeader /><main className="inner-page">
    <div className="container"><Breadcrumbs items={[{label:"Главная",href:"/"},{label:"Каталог",href:"/catalog"},{label:"Сверление",href:"/catalog/sverlenie"},{label:"Магнитные станки"}]} /></div>
    <section className="category-intro"><div className="container category-intro-grid"><div><p className="eyebrow">Оборудование · 47 моделей</p><h1>Магнитные сверлильные станки</h1><p>Подбор по диаметру корончатого сверла, шпинделю, массе и функциям. В списке показаны товарные семейства; исполнения выбираются внутри карточки.</p></div><div className="category-fast"><b>Знаете параметры?</b><p>Отправьте их инженеру — ответим с совместимыми моделями и сроками.</p><a href="mailto:info@7tool.ru?subject=Подбор%20магнитного%20станка">info@7tool.ru →</a></div></div></section>
    <section className="listing-section"><div className="container"><ProductListing /></div></section>
    <section className="expert-bar"><div className="container"><div><b>Не уверены в диаметре или типе шпинделя?</b><span>Инженер проверит режим работы и совместимость оснастки.</span></div><a href="mailto:info@7tool.ru?subject=Нужна%20помощь%20с%20магнитным%20станком">Задать вопрос →</a></div></section>
  </main><PilotFooter /></div>;
}
