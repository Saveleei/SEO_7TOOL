import { Breadcrumbs } from "../../../ui/Breadcrumbs";
import { PilotFooter } from "../../../ui/PilotFooter";
import { PilotHeader } from "../../../ui/PilotHeader";
import { ProductListing } from "../../../ui/ProductListing";
import { DrillSelector } from "../../../ui/DrillSelector";
import { ManagerContactCard } from "../../../ui/ManagerContactCard";

export default function MagneticDrillsPage() {
  return <div className="site-shell"><PilotHeader /><main className="inner-page">
    <div className="container"><Breadcrumbs items={[{label:"Главная",href:"/"},{label:"Каталог",href:"/catalog"},{label:"Сверление",href:"/catalog/sverlenie"},{label:"Магнитные станки"}]} /></div>
    <section className="category-intro"><div className="container category-intro-grid"><div><p className="eyebrow">Оборудование · технический отбор</p><h1>Магнитные сверлильные станки</h1><p>Сравнивайте рабочий диапазон, массу, шпиндель и функции. Товары и фильтры начинаются сразу после краткого описания.</p><nav className="category-shortcuts" aria-label="Популярные подборки"><a href="#products">До Ø35 мм</a><a href="#selector">С реверсом</a><a href="#selector">Для монтажа</a><a href="#products">Weldon 19</a></nav><div className="category-result-meta" aria-label="Сводка по категории"><span><b>3</b> модели в пилоте</span><span><b>2</b> с демонстрационным остатком</span><a href="#selector">Подобрать по задаче →</a></div></div><aside className="category-rfq-note"><span>Есть готовая спецификация?</span><b>Отправьте список обычным письмом</b><a href="mailto:info@7tool.ru?subject=Спецификация%20на%20магнитные%20станки">info@7tool.ru →</a></aside><nav className="category-mobile-contact" aria-label="Связаться с менеджером"><a href="tel:+79626112419"><b>Позвонить</b><span>Евгений</span></a><a href="mailto:info@7tool.ru?subject=Вопрос%20по%20магнитным%20станкам"><b>Email</b><span>Запрос КП</span></a><a href="https://t.me/saveleei" target="_blank" rel="noopener noreferrer"><b>Telegram</b><span>Написать</span></a><a href="https://max.ru/u/f9LHodD0cOJKwt-kjzgvpW6TLCZbS3ML8WWdL8lPJjF2ceK2seLyXaNOl8w" target="_blank" rel="noopener noreferrer"><b>MAX</b><span>Написать</span></a></nav></div></section>
    <section className="listing-section listing-section--priority" id="products"><div className="container"><ProductListing /><div className="after-listing-contact"><ManagerContactCard compact /></div></div></section>
    <section className="selector-section selector-section--after-products" id="selector"><div className="container"><DrillSelector /></div></section>
    <section className="expert-bar"><div className="container"><div><b>Не уверены в диаметре или типе шпинделя?</b><span>Инженер проверит режим работы и совместимость оснастки.</span></div><a href="mailto:info@7tool.ru?subject=Нужна%20помощь%20с%20магнитным%20станком">Задать вопрос →</a></div></section>
  </main><PilotFooter /></div>;
}
