import Link from "next/link";
import { categories, products, featuredDeal } from "@/lib/data";
import { ProductImage } from "./ProductImage";
import { Spotlight } from "./Spotlight";
import { DealPrice } from "./DealPrice";

const heroBullets = [
  "Дилер Karnasch — корончатые свёрла HSS-XE / Durablue",
  "Постоплата для юрлиц по реквизитам",
  "Инженерный подбор под производственную задачу",
];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-steel-200 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/40">
      <div className="absolute -right-40 -top-40 -z-10 h-[680px] w-[680px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.32),_rgba(245,158,11,0)_60%)]" />
      <div className="absolute -bottom-40 -left-40 -z-10 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.18),_rgba(245,158,11,0)_60%)]" />

      <div className="mx-auto grid max-w-[1280px] items-center gap-6 px-4 py-7 sm:gap-8 sm:px-6 sm:py-12 lg:grid-cols-[1fr_minmax(0,520px)] lg:gap-12 lg:py-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-100/70 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-amber-800 shadow-amber sm:px-3.5 sm:py-1.5 sm:text-[12px] sm:tracking-[0.16em]">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Дилер Karnasch · {categories.length} категорий · {products.length.toLocaleString("ru-RU")} позиций
          </span>

          <h1 className="mt-4 font-display text-[26px] font-black leading-[1.05] tracking-tight text-steel-900 sm:mt-5 sm:text-[36px] lg:text-[54px]">
            Промышленный инструмент для{" "}
            <span className="relative inline-block">
              <span className="relative z-10">металлообработки</span>
              <span className="absolute bottom-1 left-0 right-0 -z-0 h-3 bg-amber-300/70" />
            </span>
          </h1>

          <p className="mt-3 max-w-[520px] text-[14.5px] leading-relaxed text-steel-600 sm:mt-5 sm:text-[16px]">
            Корончатые свёрла, магнитные станки, кромкорезы, труборезы и каретки —
            со склада и под заказ для заводов, монтажников и инженерных подразделений.
          </p>

          <ul className="mt-4 hidden space-y-2.5 sm:block sm:mt-6">
            {heroBullets.map((b) => (
              <li key={b} className="flex items-start gap-3 text-[14.5px] text-steel-800">
                <span className="mt-[5px] grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-400 shadow-amber" aria-hidden>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0f161b" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                </span>
                {b}
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap items-center gap-2.5 sm:mt-8 sm:gap-3">
            <a
              href="#categories"
              className="inline-flex items-center gap-2 rounded-md bg-amber-400 px-4 py-2.5 text-[13.5px] font-bold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300 hover:shadow-elev sm:px-5 sm:py-3 sm:text-[14.5px]"
            >
              Открыть каталог
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
            </a>
            <a
              href="/kontakty"
              className="inline-flex items-center gap-2 rounded-md border border-steel-200 bg-white px-4 py-2.5 text-[13.5px] font-semibold text-steel-700 shadow-soft transition hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800 sm:px-5 sm:py-3 sm:text-[14.5px]"
            >
              Запросить КП
            </a>
            <a
              href="#categories"
              className="inline-flex items-center gap-2 px-2 py-2 text-[13px] font-semibold text-amber-800 underline decoration-amber-300 decoration-2 underline-offset-4 hover:text-amber-950"
            >
              Подобрать оборудование
            </a>
          </div>
        </div>

        {featuredDeal ? <DealBanner /> : null}
      </div>
    </section>
  );
}

function DealBanner() {
  const p = featuredDeal!;
  return (
    <Spotlight color="rgba(245,158,11,0.45)" size={520} className="relative overflow-hidden rounded-[20px] border border-steel-200 bg-white shadow-elev">
      {/* верхняя плашка — товар-герой месяца */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-r from-amber-400 via-amber-500 to-amber-300 px-5 py-2.5 text-steel-900">
        <span className="inline-flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.16em]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6 7 1-5 4 1 7-6-3-6 3 1-7-5-4 7-1z"/></svg>
          Хит продаж
        </span>
        <span className="rounded-md bg-steel-900 px-2.5 py-1 text-[12px] font-extrabold tracking-wider text-amber-300">
          STEYR-35
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_240px]">
        {/* инфо */}
        <div className="relative z-1 flex flex-col gap-3 p-5 pt-14 sm:p-8 sm:pt-16">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">{p.brand}</div>
          <Link href={`/p/${p.slug}`} className="block">
            <h2 className="font-display text-[20px] font-extrabold leading-tight text-steel-900 transition hover:text-amber-700 sm:text-[22px]">
              {p.title}
            </h2>
          </Link>

          <DealPrice p={p} />

          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href={`/p/${p.slug}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-400 px-4 py-2.5 text-[13.5px] font-bold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300"
            >
              К товару
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
            </Link>
            <Link
              href={`/c/${p.category}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-steel-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-steel-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800"
            >
              Похожие позиции
            </Link>
          </div>
        </div>

        {/* фото товара — скрыто на мобиле, чтобы баннер не разрастался */}
        <Link href={`/p/${p.slug}`} className="relative hidden overflow-hidden bg-gradient-to-br from-amber-50 via-white to-amber-100/40 sm:block sm:border-l sm:border-steel-200">
          <ProductImage p={p} priority className="aspect-square sm:aspect-auto sm:h-full" sizes="(min-width: 640px) 240px, 100vw" />
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,_rgba(245,158,11,0.18),_transparent_60%)]" />
        </Link>
      </div>
    </Spotlight>
  );
}
