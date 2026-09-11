import Link from "next/link";
import Image from "next/image";
import { HeroSearch } from "./ui/HeroSearch";
import { PilotFooter } from "./ui/PilotFooter";
import { PilotHeader } from "./ui/PilotHeader";
import { TestRequestForm } from "./ui/TestRequestForm";

const directions = [
  { id: "01", title: "Сверление и резьба", copy: "Магнитные станки · корончатые свёрла · метчики", count: "2 078 вариантов", href: "/catalog/sverlenie", accent: "Ø12–200 мм" },
  { id: "02", title: "Обработка кромки", copy: "Кромкорезы для листа · трубы · фаскосниматели", count: "128 вариантов", href: "/catalog", accent: "Фаска до 60 мм" },
  { id: "03", title: "Резка металла", copy: "Труборезы · ленточные пилы · диски · лазер", count: "406 вариантов", href: "/catalog", accent: "Сталь и цветмет" },
  { id: "04", title: "Сварка и автоматизация", copy: "Каретки · вращатели · роботы · позиционеры", count: "72 решения", href: "/catalog", accent: "Ручные и ЧПУ" },
];

export default function Home() {
  return (
    <div className="site-shell">
      <PilotHeader />
      <main>
        <section className="hero" id="top">
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Поставка для производства по всей России</p>
              <h1>Оборудование и оснастка для металлообработки</h1>
              <p className="hero-lead">Найдём товар по модели или подберём комплект под задачу. Пришлём КП с НДС, наличием и сроком поставки на email.</p>
              <HeroSearch />
              <div className="intent-grid" aria-label="Способы начать подбор">
                <Link href="/catalog/sverlenie"><span>01</span><b>Подобрать по задаче</b><small>От операции к параметрам</small></Link>
                <a href="mailto:info@7tool.ru?subject=Запрос%20КП%20по%20спецификации"><span>02</span><b>Отправить спецификацию</b><small>info@7tool.ru</small></a>
                <a href="tel:+79626112419"><span>03</span><b>Обсудить с инженером</b><small>+7 (962) 611-24-19</small></a>
              </div>
            </div>
            <div className="hero-visual" aria-label="Рекомендуемый магнитный сверлильный станок">
              <div className="hero-visual-label"><span>Для монтажных работ</span><strong>LENZ STEYR-35</strong><small>Ø35 мм · Weldon 19 · 10,5 кг</small></div>
              <Image src="/products/lenz-steyr-35.jpg" alt="Магнитный сверлильный станок LENZ STEYR-35" width={720} height={720} priority />
              <div className="hero-product-facts"><span>Цена с НДС</span><b>47 999 ₽</b><small>Наличие подтвердит менеджер</small></div>
              <Link className="visual-link" href="/product/lenz-steyr-35">Характеристики и КП <span>→</span></Link>
            </div>
          </div>
        </section>

        <section className="proof-strip" aria-label="Условия поставки">
          <div className="container proof-grid">
            <div><strong>3 994</strong><span>товарных вариантов в каталоге</span></div>
            <div><strong>КП с НДС</strong><span>цена, наличие и срок в одном письме</span></div>
            <div><strong>Инженер</strong><span>проверит совместимость комплекта</span></div>
            <div><strong>По РФ</strong><span>доставка до предприятия</span></div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-heading">
              <div><p className="eyebrow">Короткий путь к нужному разделу</p><h2>Категории по производственной операции</h2></div>
              <p>На первом уровне — задача клиента. На втором — тип оборудования. Внутри — фильтры по параметрам, влияющим на выбор.</p>
            </div>
            <div className="direction-grid">
              {directions.map((direction) => (
                <Link className="direction-card" href={direction.href} key={direction.id}>
                  <span className="direction-id">{direction.id}</span>
                  <div><span className="direction-accent">{direction.accent}</span><h3>{direction.title}</h3><p>{direction.copy}</p></div>
                  <small>{direction.count}</small><b aria-hidden="true">→</b>
                </Link>
              ))}
            </div>
            <Link className="consumables-card" href="/catalog">
              <span>Сквозной вход</span>
              <div><h3>Оснастка и расходные материалы</h3><p>Корончатые свёрла, борфрезы, пильные диски, метчики и СОЖ — быстрый выбор по размеру и совместимости.</p></div>
              <strong>Найти оснастку →</strong>
            </Link>
          </div>
        </section>

        <section className="section procurement-section">
          <div className="container procurement-grid">
            <div className="procurement-copy"><p className="eyebrow">Если список уже готов</p><h2>Вставьте спецификацию — разберём позиции и соберём КП</h2><p>Подходит для закупщиков, снабжения и инженеров. Можно прислать модели, параметры или свободное описание. В рабочей версии добавим XLSX, PDF и DOCX.</p><ul><li>Сопоставим аналоги и исполнения</li><li>Проверим совместимую оснастку</li><li>Вернём цену с НДС и срок поставки</li></ul><a href="mailto:info@7tool.ru?subject=Спецификация%20на%20подбор">Или отправьте файл на <b>info@7tool.ru</b> →</a></div>
            <TestRequestForm compact context="Например: магнитный станок до Ø35 мм, 220 В — 2 шт.; корончатые свёрла Ø18/25/35 мм." buttonLabel="Проверить сценарий заявки" />
          </div>
        </section>

        <section className="section section-muted">
          <div className="container route-demo">
            <div><p className="eyebrow">Пилотный маршрут</p><h2>От задачи до подходящего станка за четыре шага</h2></div>
            <ol>
              <li><span>01</span><b>Сверление</b><small>выбрать операцию</small></li>
              <li><span>02</span><b>Магнитные станки</b><small>уточнить тип</small></li>
              <li><span>03</span><b>Ø до 35 мм</b><small>применить фильтр</small></li>
              <li><span>04</span><b>Получить КП</b><small>email или короткая форма</small></li>
            </ol>
            <Link className="button button-orange" href="/catalog/sverlenie/magnitnye-stanki">Пройти маршрут</Link>
          </div>
        </section>
      </main>
      <PilotFooter />
    </div>
  );
}
