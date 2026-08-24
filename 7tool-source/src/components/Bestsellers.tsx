import { bestsellers } from "@/lib/data";
import { ProductCard } from "./ProductCard";
import { SectionEyebrow } from "./CategoryGrid";

export function Bestsellers() {
  return (
    <section className="relative overflow-hidden border-y border-steel-200 bg-gradient-to-br from-steel-50 via-white to-amber-50/30 py-16 lg:py-20">
      <div className="absolute -right-40 top-1/4 -z-10 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.16),_transparent_60%)]" />
      <div className="absolute -left-40 top-2/3 -z-10 h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.14),_transparent_60%)]" />
      <div className="absolute left-1/2 top-0 -z-10 h-[260px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.85),_transparent_60%)]" />
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <SectionEyebrow>Из каталога</SectionEyebrow>
            <h2 className="mt-3 font-display text-[32px] font-bold tracking-tight text-steel-900 lg:text-[40px]">
              Что есть в наличии
            </h2>
            <p className="mt-3 max-w-[620px] text-[15px] text-steel-600">
              Корончатые свёрла Karnasch и магнитные сверлильные станки. Цены — по запросу для юрлиц.
            </p>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {bestsellers.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
