import Link from "next/link";
import Image from "next/image";
import { HeroSearch } from "./ui/HeroSearch";
import { PilotFooter } from "./ui/PilotFooter";
import { PilotHeader } from "./ui/PilotHeader";
import { ProcurementWorkbench } from "./ui/ProcurementWorkbench";
import { AddRequestButton } from "./ui/RequestCart";
import { ProductionCategoryGrid } from "./ui/ProductionCategoryGrid";
import { getProductionCategoryGroups, pilotFeedCategorySlugs } from "./data/productionCategoryGroups";

export default function Home() {
  return (
    <div className="site-shell">
      <PilotHeader />
      <main>
        <section className="hero" id="top">
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Инженерный интернет-каталог 7TOOL</p>
              <h1>Подбор промышленного оборудования для обработки металла</h1>
              <p className="hero-lead">Опишите задачу или укажите известную модель. Проверим подходящее оборудование, совместимость оснастки, цену и реальный срок поставки.</p>
              <div className="hero-scope" aria-label="Ассортимент 7TOOL"><span>Оборудование</span><span>Оснастка</span><span>Расходники</span><span>Сервис</span></div>
              <HeroSearch />
              <div className="intent-grid" aria-label="Способы начать подбор">
                <a href="#quick-order"><span>01</span><b>Описать задачу</b><small>Подбор без знания артикула</small></a>
                <Link href="/catalog"><span>02</span><b>Открыть каталог</b><small>Сравнить доступные модели</small></Link>
                <a href="tel:+79626112419"><span>03</span><b>Проверить с инженером</b><small>+7 (962) 611-24-19</small></a>
              </div>
            </div>
            <div className="hero-procurement-card" aria-label="Быстрый запрос для отдела снабжения">
              <span className="eyebrow">Для инженера и снабжения</span><h2>Есть задача или спецификация?</h2><p>Необязательно знать наш артикул. Пришлите условия работы, модель для замены либо готовый файл — вернём подходящие варианты с ценой и подтверждённым сроком.</p>
              <a className="button button-orange" href="#quick-order">Описать задачу</a>
              <a className="hero-procurement-email" href="mailto:info@7tool.ru?subject=Спецификация%20на%20подбор"><span>Отправить обычным письмом</span><b>info@7tool.ru</b></a>
              <ul><li>Можно начать с обычного описания</li><li>Подберём аналог отсутствующей модели</li><li>Не обещаем наличие до подтверждения</li></ul>
            </div>
          </div>
        </section>

        <section className="proof-strip" aria-label="Условия поставки">
          <div className="container proof-grid">
            <div><strong>КП с НДС</strong><span>цена, наличие и срок в одном письме</span></div>
            <div><strong>Инженер</strong><span>проверит совместимость комплекта</span></div>
            <div><strong>Документы</strong><span>по конкретному артикулу</span></div>
            <div><strong>По РФ</strong><span>условия доставки фиксируются в КП</span></div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-heading">
              <div><p className="eyebrow">Короткий путь к нужному разделу</p><h2>Категории по производственной задаче</h2></div>
              <p>Сначала выберите производственную операцию. Под ней сразу показаны относящиеся к задаче типы оборудования, оснастки и расходных материалов.</p>
            </div>
            <ProductionCategoryGrid groups={getProductionCategoryGroups(pilotFeedCategorySlugs)} />
          </div>
        </section>

        <section className="section section-muted featured-products"><div className="container"><div className="section-heading"><div><p className="eyebrow">Сразу к товару</p><h2>Популярные позиции пилотного каталога</h2></div><p>Карточка сразу показывает решающие характеристики и добавляет позицию в единый запрос КП.</p></div><div className="featured-product-grid">
          <article><Image src="/products/lenz-steyr-35.jpg" alt="Магнитный сверлильный станок LENZ STEYR-35" width={360} height={280} /><div><small>LENZ · STEYR-35</small><h3>Магнитный сверлильный станок STEYR-35</h3><p>Ø35 мм · Weldon 19 · 10,5 кг</p><span>Наличие и срок уточняем</span><b>47 999 ₽</b><div><AddRequestButton item={{ id:"STEYR-35", title:"Магнитный сверлильный станок LENZ STEYR-35", article:"Артикул STEYR-35", price:"47 999 ₽" }}>В запрос</AddRequestButton><Link href="/product/magnitnyy-sverlilnyy-stanok-lenz-steyr-35">Подробнее</Link></div></div></article>
          <article><Image src="/products/annular-drills.png" alt="Корончатые свёрла Weldon 19" width={360} height={280} /><div><small>Оснастка · Weldon 19</small><h3>Корончатые свёрла для магнитных станков</h3><p>HSS · Ø18–35 мм · рабочая длина 30 мм</p><span>Подбор по станку и операции</span><b>от 2 980 ₽</b><div><AddRequestButton item={{ id:"annular-set", title:"Комплект корончатых свёрл Weldon 19", article:"Ø18/25/35 мм", price:"от 2 980 ₽" }}>В запрос</AddRequestButton><Link href="/catalog/sverlenie">Подобрать</Link></div></div></article>
        </div></div></section>

        <section className="section assurance-section"><div className="container"><div className="section-heading"><div><p className="eyebrow">Не обещания, а проверяемые этапы</p><h2>Что снижает риск закупки</h2></div><p>Инженер, документы и подтверждённые условия поставки находятся рядом с товаром — всё необходимое для решения собрано в одном месте.</p></div><div className="assurance-grid">
          <article><Image src="/site/why-engineer.webp" alt="Инженер проверяет параметры оборудования" width={420} height={240} /><div><span>01 · Инженер</span><h3>Проверка применимости</h3><p>Сопоставляем операцию, материал, режим работы и совместимую оснастку.</p></div></article>
          <article><Image src="/site/why-documents.webp" alt="Документы к поставке оборудования" width={420} height={240} /><div><span>02 · Документы</span><h3>Паспорт и сертификаты</h3><p>Собираем пакет документов по конкретному артикулу до оплаты.</p></div></article>
          <article><Image src="/site/why-stock.webp" alt="Проверка наличия промышленного оборудования" width={420} height={240} /><div><span>03 · Поставка</span><h3>Цена, наличие и срок</h3><p>Фиксируем подтверждённые условия в КП, а не показываем сомнительные остатки.</p></div></article>
        </div></div></section>

        <section className="section procurement-section">
          <div className="container procurement-grid">
            <div className="procurement-copy"><p className="eyebrow">Инженерный запрос</p><h2>Начните с задачи, а не с нашего каталога</h2><p>Опишите операцию, материал и условия работы, укажите известную модель либо передайте готовую спецификацию. Подтвердим, что действительно можем поставить.</p><ul><li>Подбор по производственной задаче</li><li>Замена отсутствующей модели</li><li>Разбор ТЗ и спецификации</li></ul><a href="mailto:info@7tool.ru?subject=Запрос%20на%20подбор">Можно сразу написать на <b>info@7tool.ru</b> →</a></div>
            <ProcurementWorkbench />
          </div>
        </section>

      </main>
      <PilotFooter />
    </div>
  );
}
