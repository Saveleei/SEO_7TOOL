import Link from "next/link";
import Image from "next/image";
import { HeroSearch } from "./ui/HeroSearch";
import { PilotFooter } from "./ui/PilotFooter";
import { PilotHeader } from "./ui/PilotHeader";

const directions = [
  { id: "01", title: "Сверление и резьба", copy: "Станки, корончатые свёрла, метчики", count: "2 078 вариантов", href: "/catalog/sverlenie" },
  { id: "02", title: "Обработка кромки", copy: "Кромкорезы по листу и трубам", count: "128 вариантов", href: "/catalog" },
  { id: "03", title: "Резка металла", copy: "Труборезы, пилы, диски, лазер", count: "406 вариантов", href: "/catalog" },
  { id: "04", title: "Сварка и автоматизация", copy: "Каретки, вращатели, роботы", count: "72 решения", href: "/catalog" },
];

export default function Home() {
  return (
    <div className="site-shell">
      <PilotHeader />
      <main>
        <section className="hero" id="top">
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Поиск → товар → заявка</p>
              <h1>Промышленное оборудование без долгого поиска</h1>
              <p className="hero-lead">Введите модель, артикул или задачу. Для сложного подбора сразу подключим инженера и подготовим КП с НДС.</p>
              <HeroSearch />
              <div className="hero-contacts" aria-label="Контакты отдела продаж">
                <a href="mailto:info@7tool.ru"><span>Запросы и спецификации</span><strong>info@7tool.ru</strong></a>
                <a href="tel:+79626112419"><span>Инженер по подбору</span><strong>+7 (962) 611-24-19</strong></a>
              </div>
              <div className="hero-actions">
                <Link className="button button-dark" href="/catalog/sverlenie">Подобрать по задаче</Link>
                <a className="button button-quiet" href="mailto:info@7tool.ru?subject=Запрос%20КП%20по%20спецификации">Отправить спецификацию</a>
              </div>
            </div>
            <div className="hero-visual" aria-label="Рекомендуемый магнитный сверлильный станок">
              <div className="hero-visual-label"><span>Популярная модель</span><strong>LENZ STEYR-35</strong><small>Ø35 мм · Weldon 19 · 1 100 Вт</small></div>
              <Image src="/products/lenz-steyr-35.jpg" alt="Магнитный сверлильный станок LENZ STEYR-35" width={720} height={720} priority />
              <Link className="visual-link" href="/product/lenz-steyr-35">Открыть товар <span>↗</span></Link>
            </div>
          </div>
        </section>

        <section className="proof-strip" aria-label="Условия поставки">
          <div className="container proof-grid">
            <div><strong>3 994</strong><span>варианта в актуальном фиде</span></div>
            <div><strong>С НДС</strong><span>счёт и закрывающие документы</span></div>
            <div><strong>1 день</strong><span>на первичный подбор</span></div>
            <div><strong>Россия</strong><span>доставка до предприятия</span></div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-heading">
              <div><p className="eyebrow">Каталог по производственной задаче</p><h2>Сначала операция, затем оборудование</h2></div>
              <p>Структура не заставляет клиента угадывать технические названия. Один товар может быть доступен из нескольких сценариев, но имеет один адрес.</p>
            </div>
            <div className="direction-grid">
              {directions.map((direction) => (
                <Link className="direction-card" href={direction.href} key={direction.id}>
                  <span className="direction-id">{direction.id}</span>
                  <div><h3>{direction.title}</h3><p>{direction.copy}</p></div>
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
