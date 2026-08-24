import { products } from "@/lib/data";
import { SectionEyebrow } from "./CategoryGrid";

const PHOTOS = [
  { src: "/warehouse/01.webp", title: "Склад оборудования", sub: "фактические складские стеллажи" },
  { src: "/warehouse/03.webp", title: "Зона хранения оснастки", sub: "товары распределены по артикулам" },
  { src: "/warehouse/04.webp", title: "Паллетное хранение", sub: "оборудование в заводской упаковке" },
  { src: "/warehouse/06.webp", title: "Комплектация заказов", sub: "подготовка к выдаче и отправке" },
  { src: "/warehouse/02.webp", title: "Складской проход", sub: "реальная фотография склада" },
  { src: "/warehouse/05.webp", title: "Крупногабаритное оборудование", sub: "хранение на паллетах" },
  { src: "/warehouse/08.webp", title: "Инструмент и расходные материалы", sub: "подбор по параметрам задачи" },
  { src: "/warehouse/07.webp", title: "Подготовка поставки", sub: "условия согласуются до отгрузки" },
];

export function WarehouseProof() {
  const skuTotal = products.reduce((a, p) => a + p.variants.length, 0);
  const stockTotal = products.filter((p) => p.stock > 0).length;
  const inStockSku = products.reduce((a, p) => a + (p.stock > 0 ? p.variants.length : 0), 0);

  return (
    <section className="relative overflow-hidden border-y border-steel-200 bg-white py-16 lg:py-20">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <SectionEyebrow>Склад в Москве</SectionEyebrow>
            <h2 className="mt-3 font-display text-[28px] font-extrabold tracking-tight text-steel-900 lg:text-[36px]">
              Реальный склад, реальные остатки
            </h2>
            <p className="mt-2 max-w-[560px] text-[14.5px] text-steel-600">
              Фотографии предоставлены владельцем и показывают реальные складские зоны. Статусы вариантов обновляются из товарного фида.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Stat v={skuTotal.toLocaleString("ru-RU")} l="артикулов в каталоге" />
            <Stat v={inStockSku.toLocaleString("ru-RU")} l="в наличии прямо сейчас" tone="emerald" />
            <Stat v={stockTotal.toLocaleString("ru-RU")} l="моделей со склада" tone="amber" />
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {PHOTOS.map((p) => (
            <PhotoTile key={p.src} {...p} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function WarehouseStrip({ count = 4, eyebrow = "Склад в Москве" }: { count?: 3 | 4; eyebrow?: string }) {
  const items = PHOTOS.slice(0, count);
  return (
    <section className="border-y border-steel-200 bg-white py-10 lg:py-12">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <SectionEyebrow>{eyebrow}</SectionEyebrow>
            <h2 className="mt-2 font-display text-[22px] font-extrabold tracking-tight text-steel-900 lg:text-[26px]">
              Реальный склад, реальные остатки
            </h2>
            <p className="mt-1.5 max-w-[560px] text-[13.5px] text-steel-600">
              Фотографии реальных складских зон. Статусы вариантов обновляются из товарного фида.
            </p>
          </div>
        </div>
        <div className={`mt-6 grid grid-cols-2 gap-3 ${count === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
          {items.map((p) => (
            <PhotoTile key={p.src} {...p} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({ v, l, tone = "neutral" }: { v: string; l: string; tone?: "neutral" | "emerald" | "amber" }) {
  const cls =
    tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-700"
    : "border-steel-200 bg-steel-50/60 text-steel-700";
  return (
    <span className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 ${cls}`}>
      <span className="font-display text-[15px] font-extrabold leading-none tracking-tight text-steel-900">{v}</span>
      <span className="text-[11px] uppercase tracking-wider">{l}</span>
    </span>
  );
}

function PhotoTile({ src, title, sub }: { src: string; title: string; sub?: string }) {
  return (
    <figure className="group relative overflow-hidden rounded-[14px] border border-steel-200 bg-white shadow-card transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-elev">
      <div className="relative aspect-[4/3] overflow-hidden bg-steel-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          loading="lazy"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-steel-900/90 via-steel-900/40 to-transparent p-3">
          <figcaption className="font-display text-[13px] font-bold leading-tight text-white">{title}</figcaption>
          {sub && <div className="mt-0.5 text-[11px] font-semibold text-amber-300">{sub}</div>}
        </div>
      </div>
    </figure>
  );
}
