import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Breadcrumbs } from "../../ui/Breadcrumbs";
import { PilotFooter } from "../../ui/PilotFooter";
import { PilotHeader } from "../../ui/PilotHeader";
import { TestRequestForm } from "../../ui/TestRequestForm";

export const metadata: Metadata = {
  title: "LENZ STEYR-35 — тестовая карточка 7TOOL",
  description: "Магнитный сверлильный станок LENZ STEYR-35: характеристики, цена, совместимая оснастка и запрос КП.",
  openGraph: { title: "LENZ STEYR-35 — 7TOOL", description: "Магнитный сверлильный станок, Ø35 мм, Weldon 19." },
};

const specs = [
  ["Макс. диаметр корончатого сверла", "35 мм"],
  ["Макс. диаметр спирального сверла", "13 мм"],
  ["Шпиндель", "Weldon 19"],
  ["Рабочий ход", "118 мм"],
  ["Масса", "10,5 кг"],
  ["Длина основания", "168 мм"],
  ["Количество скоростей", "1"],
  ["Реверс", "Нет"],
];

export default function ProductPage() {
  return <div className="site-shell"><PilotHeader /><main className="inner-page product-page">
    <div className="container"><Breadcrumbs items={[{label:"Главная",href:"/"},{label:"Каталог",href:"/catalog"},{label:"Сверление",href:"/catalog/sverlenie"},{label:"Магнитные станки",href:"/catalog/sverlenie/magnitnye-stanki"},{label:"LENZ STEYR-35"}]} /></div>
    <section className="product-main"><div className="container product-layout">
      <div className="product-gallery"><div className="product-badge">−20%</div><Image src="/products/lenz-steyr-35.jpg" alt="Магнитный сверлильный станок LENZ STEYR-35" width={760} height={760} priority /><div className="gallery-note"><span>Основной ракурс</span><b>Фото конкретной модели</b></div></div>
      <div className="product-summary">
        <p className="product-code">LENZ · Артикул STEYR-35</p><h1>Магнитный сверлильный станок LENZ STEYR-35</h1>
        <div className="product-status"><span>Остаток уточняется</span><b>Подтвердим наличие и срок в КП</b><small>Не показываем неподтверждённое количество как складской остаток</small></div>
        <div className="key-specs"><div><span>Корончатое сверло</span><b>до 35 мм</b></div><div><span>Шпиндель</span><b>Weldon 19</b></div><div><span>Масса</span><b>10,5 кг</b></div></div>
        <div className="price-block"><div><del>59 998 ₽</del><b>47 999 ₽</b><span>Цена с НДС</span></div><small>Экономия 11 999 ₽</small></div>
        <div className="product-cta"><a className="button button-orange" href="#request">Получить КП</a><a className="button button-quiet" href="mailto:info@7tool.ru?subject=LENZ%20STEYR-35">Запросить по email</a></div>
        <ul className="delivery-facts"><li>КП, счёт и договор без регистрации</li><li>Совместимую оснастку проверит инженер</li><li>Доставка до предприятия по России</li></ul>
        <div className="purchase-assurance"><b>Перед оплатой зафиксируем в КП</b><span>комплектацию · наличие · срок отгрузки · стоимость доставки</span></div>
      </div>
    </div></section>

    <section className="product-details section"><div className="container details-grid"><div><p className="eyebrow">Характеристики для решения</p><h2>Основные параметры</h2><div className="use-cases"><span>Монтаж металлоконструкций</span><span>Работа в ограниченном пространстве</span><span>Отверстия до Ø35 мм</span></div><dl className="spec-table">{specs.map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></div><aside><p className="eyebrow">Инженерная проверка</p><h2>Подойдёт ли станок под задачу?</h2><p>Сообщите диаметр, глубину отверстия, материал и режим работы. Мы проверим станок и оснастку как единый комплект.</p><ol><li>Сверим рабочий диапазон</li><li>Подберём хвостовик и свёрла</li><li>Вернём комплект одним КП</li></ol><a className="button button-dark" href="#request">Проверить применимость</a></aside></div></section>

    <section className="section section-muted"><div className="container"><div className="section-heading"><div><p className="eyebrow">Совместимая оснастка</p><h2>Сразу добавьте корончатые свёрла</h2></div><p>Клиенту не нужно возвращаться в общий каталог и повторно проверять хвостовик.</p></div><div className="accessory-grid">{[18,25,35].map(diameter=><article key={diameter}><Image src="/products/annular-drills.png" alt="Корончатое сверло" width={100} height={100} /><small>Weldon 19 · HSS</small><h3>Корончатое сверло Ø{diameter} мм</h3><p>Рабочая длина 30 мм</p><b>{diameter===18?"2 980":diameter===25?"3 640":"4 290"} ₽</b><button type="button">Добавить в комплект</button></article>)}</div></div></section>

    <section className="request-section" id="request"><div className="container request-grid"><div><p className="eyebrow">Ответ в удобном для закупки формате</p><h2>Получить КП на станок и оснастку</h2><p>В рабочей версии запрос можно будет отправить через форму или обычным письмом на <a href="mailto:info@7tool.ru">info@7tool.ru</a>.</p><div className="request-deliverables"><span>Цена с НДС</span><span>Наличие и срок</span><span>Совместимая оснастка</span></div><Link href="/catalog/sverlenie/magnitnye-stanki">← Вернуться к сравнению</Link></div><TestRequestForm context="Прошу подготовить КП на LENZ STEYR-35 и совместимые корончатые свёрла Ø18/25/35 мм." /></div></section>
  </main><PilotFooter /></div>;
}
