import Link from "next/link";
import { products } from "@/lib/data";
import { brandSlug } from "@/lib/brand";

export function BrandStrip() {
  const brandList = Array.from(new Set(products.map((p) => p.brand)))
    .filter((b) => b && b !== "—")
    .slice(0, 8);

  if (brandList.length === 0) return null;

  return (
    <section id="brands" className="relative overflow-hidden border-y border-steel-200 bg-gradient-to-r from-amber-50 via-white to-cobalt-50 py-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),inset_0_-1px_0_rgba(15,22,27,0.04)]">
      <div className="absolute -left-24 top-0 -z-0 h-full w-[360px] bg-[radial-gradient(circle_at_left,_rgba(245,158,11,0.25),_transparent_70%)]" />
      <div className="absolute -right-24 top-0 -z-0 h-full w-[360px] bg-[radial-gradient(circle_at_right,_rgba(42,95,214,0.18),_transparent_70%)]" />
      <div className="relative mx-auto max-w-[1280px] px-6">
        <div className="flex items-center justify-between gap-6">
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-700">
            <span className="h-px w-6 bg-amber-500" />
            Бренды в каталоге
          </div>
          <div className="hidden text-[12px] font-medium text-steel-500 lg:block">
            официальные дилерские контракты
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {brandList.map((b, i) => (
            <Link
              key={b}
              href={`/brand/${brandSlug(b)}`}
              className="group relative flex items-center justify-center overflow-hidden rounded-lg border border-steel-200 bg-white py-7 shadow-card transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-amber"
            >
              <span className={`absolute inset-x-0 top-0 h-1 ${i % 2 === 0 ? "bg-amber-400" : "bg-amber-500"}`} />
              <span className="font-display text-[17px] font-extrabold tracking-[0.05em] text-steel-800 transition group-hover:text-amber-700">
                {b}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
