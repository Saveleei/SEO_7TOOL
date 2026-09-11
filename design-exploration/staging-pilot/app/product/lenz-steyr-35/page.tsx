import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Breadcrumbs } from "../../ui/Breadcrumbs";
import { PilotFooter } from "../../ui/PilotFooter";
import { PilotHeader } from "../../ui/PilotHeader";
import { TestRequestForm } from "../../ui/TestRequestForm";
import { ProductActions } from "../../ui/ProductActions";
import { ManagerContactCard } from "../../ui/ManagerContactCard";

export const metadata: Metadata = {
  title: "LENZ STEYR-35 — тестовая карточка 7TOOL",
  description: "Магнитный сверлильный станок LENZ STEYR-35: характеристики, цена, совместимая оснастка и запрос КП.",
  openGraph: { title: "LENZ STEYR-35 — 7TOOL", description: "Магнитный сверлильный станок, Ø35 мм, Weldon 19." },
};

const specs = [
  ["Мощность", "1 100 Вт"],
  ["Макс. диаметр корончатого сверла", "35 мм"],
  ["Макс. диаметр спирального сверла", "13 мм"],
  ["Макс. глубина отверстия", "55 мм"],
  ["Шпиндель", "Weldon 19"],
  ["Рабочий ход", "118 мм"],
  ["Частота вращения", "450 об/мин"],
  ["Сила притяжения магнита", "10 000 Н"],
  ["Размер основания", "167×84×44 мм"],
  ["Мин. толщина рабочей поверхности", "5 мм"],
  ["Масса", "10,5 кг"],
  ["Количество скоростей", "1"],
  ["Реверс", "Нет"],
];

const availability = { inStock: true, shipsToday: true };

export default function ProductPage() {
  return <div className="site-shell"><PilotHeader /><main className="inner-page product-page">
    <div className="container"><Breadcrumbs items={[{label:"Главная",href:"/"},{label:"Каталог",href:"/catalog"},{label:"Сверление",href:"/catalog/sverlenie"},{label:"Магнитные станки",href:"/catalog/sverlenie/magnitnye-stanki"},{label:"LENZ STEYR-35"}]} /></div>
    <section className="product-main"><div className="container product-layout">
      <div className="product-gallery"><div className="product-badge">−20%</div><Image src="/products/lenz-steyr-35.jpg" alt="Магнитный сверлильный станок LENZ STEYR-35" width={760} height={760} priority /><div className="gallery-note"><span>Основной ракурс</span><b>Фото конкретной модели</b></div></div>
      <div className="product-summary">
        <p className="product-code">LENZ · Артикул STEYR-35 · Код товара 378</p><h1>Магнитный сверлильный станок LENZ STEYR-35</h1>
        <div className="variant-selector"><span>Выберите рабочий класс</span><div><b>Ø35 мм</b><Link href="/compare">Ø35 бесщёточный</Link><Link href="/compare">Ø60 мм</Link><Link href="/compare">Ø60 + реверс</Link></div></div>
        <div className={`product-status ${availability.inStock ? "is-in-stock" : "is-on-order"}`}><span>{availability.inStock ? "В наличии" : "Под заказ"}</span><b>{availability.inStock && availability.shipsToday ? "Отгрузка сегодня" : availability.inStock ? "Готов к отгрузке" : "Срок поставки укажем в КП"}</b><small>{availability.inStock ? "Зарезервируем после подтверждения заказа менеджером" : "Менеджер проверит ближайшую поставку и доступный аналог"}</small></div>
        <div className="key-specs"><div><span>Корончатое сверло</span><b>до 35 мм</b></div><div><span>Шпиндель</span><b>Weldon 19</b></div><div><span>Мощность</span><b>1 100 Вт</b></div><div><span>Масса</span><b>10,5 кг</b></div></div>
        <div className="price-block"><div><del>59 998 ₽</del><b>47 999 ₽</b><span>Цена с НДС</span></div><small>Экономия 11 999 ₽</small></div>
        <div className="delivery-box"><div><span>Поставка в Москву</span><b>{availability.inStock && availability.shipsToday ? "Отгрузка сегодня" : "Срок подтвердит менеджер"}</b></div><button type="button">Изменить город</button><small>Передадим транспортной компании или подготовим к самовывозу · стоимость доставки войдёт в КП</small></div>
        <ProductActions />
        <ManagerContactCard />
      </div>
    </div></section>

    <nav className="product-jumpnav" aria-label="Разделы карточки"><div className="container"><a href="#description">Описание</a><a href="#specs">Характеристики</a><a href="#equipment">Комплектация</a><a href="#documents">Документы</a><a href="#analogs">Аналоги</a></div></nav>

    <section className="application-section" id="description"><div className="container application-grid"><Image src="/site/magnetic-drills-workshop-hero.webp" alt="Магнитные сверлильные станки в производственной среде" width={620} height={420} /><div><p className="eyebrow">Не просто описание, а сценарий применения</p><h2>Для отверстий до Ø35 мм на монтаже и в цехе</h2><p>STEYR-35 рассчитан на корончатое и спиральное сверление металла. Небольшая масса удобна при перемещении по металлоконструкции, а Weldon 19 позволяет собрать распространённый комплект оснастки.</p><ul><li>Монтаж металлоконструкций</li><li>Работа в ограниченном пространстве</li><li>Сверление вертикально и горизонтально</li><li>Сервисные и ремонтные работы</li></ul><a href="#request">Проверить под мою задачу →</a></div></div></section>

    <section className="product-details section" id="specs"><div className="container details-grid"><div><p className="eyebrow">Технические характеристики</p><h2>Все параметры в сканируемой таблице</h2><div className="use-cases"><span>Монтаж металлоконструкций</span><span>Работа в ограниченном пространстве</span><span>Отверстия до Ø35 мм</span></div><dl className="spec-table">{specs.map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></div><aside><p className="eyebrow">Инженерная проверка</p><h2>Подойдёт ли станок под задачу?</h2><p>Сообщите диаметр, глубину отверстия, материал и режим работы. Мы проверим станок и оснастку как единый комплект.</p><ol><li>Сверим рабочий диапазон</li><li>Подберём хвостовик и свёрла</li><li>Вернём комплект одним КП</li></ol><a className="button button-dark" href="#request">Проверить применимость</a></aside></div></section>

    <section className="section equipment-section" id="equipment"><div className="container equipment-grid"><div><p className="eyebrow">Что входит в поставку</p><h2>Стандартная комплектация</h2></div><ul><li>Магнитный сверлильный станок STEYR-35</li><li>Система охлаждения</li><li>Страховочный ремень</li><li>Три ручки подачи привода</li><li>Комплект шестигранных ключей</li><li>Руководство по эксплуатации</li><li>Пластиковый кейс</li></ul><aside><b>Нужен готовый комплект?</b><p>Добавим корончатые свёрла, направляющие штифты, СОЖ и средства безопасности.</p><a href="#request">Собрать комплект →</a></aside></div></section>

    <section className="section section-muted" id="documents"><div className="container"><div className="section-heading"><div><p className="eyebrow">Документы — часть продукта</p><h2>Всё, что нужно инженеру и закупщику</h2></div><p>В production документы должны скачиваться сразу и индексироваться поиском. В пилоте их можно запросить по конкретному артикулу.</p></div><div className="document-grid">{[["PDF","Паспорт изделия"],["PDF","Руководство по эксплуатации"],["PDF","Сертификат / декларация"],["PDF","Гарантийные условия"]].map(([type,title])=><a href={`mailto:info@7tool.ru?subject=${encodeURIComponent(title+" LENZ STEYR-35")}`} key={title}><span>{type}</span><div><b>{title}</b><small>LENZ STEYR-35 · запросить файл</small></div><strong>↓</strong></a>)}</div></div></section>

    <section className="section"><div className="container"><div className="section-heading"><div><p className="eyebrow">Совместимая оснастка</p><h2>Сразу добавьте корончатые свёрла</h2></div><p>Совместимая оснастка вынесена отдельно от аналогов оборудования, чтобы быстро собрать рабочий комплект и не ошибиться с хвостовиком.</p></div><div className="accessory-grid">{[18,25,35].map(diameter=><article key={diameter}><Image src="/products/annular-drills.png" alt="Корончатое сверло" width={100} height={100} /><small>Weldon 19 · HSS</small><h3>Корончатое сверло Ø{diameter} мм</h3><p>Рабочая длина 30 мм</p><b>{diameter===18?"2 980":diameter===25?"3 640":"4 290"} ₽</b><button type="button">Добавить в комплект</button></article>)}</div></div></section>

    <section className="section analog-section" id="analogs"><div className="container"><div className="section-heading"><div><p className="eyebrow">Альтернативы, а не случайные рекомендации</p><h2>Сравните близкие модели</h2></div><Link href="/compare">Полная таблица сравнения →</Link></div><div className="analog-grid"><article><Image src="/products/heden-dm-36k.png" alt="HEDEN DM-36K" width={190} height={160} /><div><span>Дешевле</span><h3>HEDEN DM-36K</h3><p>Ø36 мм · 1 600 Вт · Weldon 19</p><b>44 690 ₽</b></div></article><article><Image src="/products/lenz-steyr-35.jpg" alt="LENZ STEYR-35 MAX" width={190} height={160} /><div><span>С реверсом</span><h3>LENZ STEYR-35 MAX</h3><p>Ø35 мм · 6 скоростей · бесщёточный</p><b>77 910 ₽</b></div></article><aside><b>Не нашли нужную модель?</b><p>Пришлите любой артикул или ссылку конкурента — сопоставим характеристики.</p><a href="mailto:info@7tool.ru?subject=Подобрать%20аналог">Подобрать аналог →</a></aside></div></div></section>

    <section className="request-section" id="request"><div className="container request-grid"><div><p className="eyebrow">Ответ в удобном для закупки формате</p><h2>Получить КП на станок и оснастку</h2><p>В рабочей версии запрос можно будет отправить через форму или обычным письмом на <a href="mailto:info@7tool.ru">info@7tool.ru</a>.</p><div className="request-deliverables"><span>Цена с НДС</span><span>Наличие и срок</span><span>Совместимая оснастка</span></div><Link href="/catalog/sverlenie/magnitnye-stanki">← Вернуться к сравнению</Link></div><TestRequestForm context="Прошу подготовить КП на LENZ STEYR-35 и совместимые корончатые свёрла Ø18/25/35 мм." /></div></section>
  </main><PilotFooter /></div>;
}
