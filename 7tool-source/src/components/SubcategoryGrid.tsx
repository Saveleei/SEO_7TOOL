import Link from "next/link";
import type { ResolvedSubcategory } from "@/lib/subcategories";

export function SubcategoryGrid({
  categorySlug,
  categoryTitle,
  totalCount,
  items,
  activeSlug,
}: {
  categorySlug: string;
  categoryTitle: string;
  totalCount: number;
  items: ResolvedSubcategory[];
  activeSlug?: string;
}) {
  const choices = [
    {
      slug: "",
      title: "Все товары категории",
      shortDescription: `Полный каталог «${categoryTitle}» без ограничения по задаче.`,
      count: totalCount,
    },
    ...items,
  ];
  return (
    <section aria-labelledby="subcategory-title" className="border-b border-steel-200 bg-white">
      <div className="mx-auto max-w-[1280px] px-4 py-7 sm:px-6 sm:py-9">
        <h2 id="subcategory-title" className="font-display text-[22px] font-extrabold tracking-tight text-steel-900 sm:text-[28px]">
          Быстрый выбор по задаче
        </h2>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-steel-600">
          Подкатегории сформированы по реальным характеристикам и названиям товаров. Пустые подборки не публикуются.
        </p>
        <nav aria-label="Подкатегории" className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {choices.map((item) => {
            const active = item.slug ? item.slug === activeSlug : !activeSlug;
            return (
              <Link
                key={item.slug || "all"}
                href={item.slug ? `/c/${categorySlug}/${item.slug}` : `/c/${categorySlug}`}
                aria-current={active ? "page" : undefined}
                className={`group relative flex min-h-[112px] items-center justify-between gap-4 overflow-hidden rounded-[12px] border px-4 py-4 transition sm:px-5 ${
                  active
                    ? "border-amber-500 bg-amber-50 shadow-amber"
                    : "border-steel-200 bg-white shadow-card hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-elev"
                }`}
              >
                <span className="min-w-0">
                  <span className="font-display text-[15px] font-bold leading-snug text-steel-900 sm:text-[16px]">{item.title}</span>
                  <span className="mt-1.5 line-clamp-2 block text-[12px] leading-relaxed text-steel-500">{item.shortDescription}</span>
                  <span className="mt-2 inline-flex rounded-full bg-steel-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-steel-600">
                    {item.count.toLocaleString("ru-RU")} товаров
                  </span>
                </span>
                <span aria-hidden className="shrink-0 text-[22px] font-semibold text-amber-600 transition group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </section>
  );
}
