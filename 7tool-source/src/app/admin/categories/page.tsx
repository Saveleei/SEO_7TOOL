import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listAdminCategories } from "@/lib/categories-db";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function fallbackCover(slug: string): string | null {
  const row = db()
    .prepare<unknown[], { images: string }>(
      `SELECT images FROM products
        WHERE category = ? AND draft = 0 AND stock > 0 AND images != '[]'
        ORDER BY sort_order ASC LIMIT 1`,
    )
    .get(slug);
  const fallback = row ?? db()
    .prepare<unknown[], { images: string }>(
      `SELECT images FROM products
        WHERE category = ? AND images != '[]'
        ORDER BY sort_order ASC LIMIT 1`,
    )
    .get(slug);
  if (!fallback) return null;
  try {
    const arr = JSON.parse(fallback.images) as string[];
    return arr[0] ?? null;
  } catch { return null; }
}

export default async function CategoriesPage() {
  await requireAdmin();
  const cats = listAdminCategories();
  const fallbacks = new Map(cats.map((c) => [c.slug, c.cover_image ? null : fallbackCover(c.slug)]));
  return (
    <section className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-extrabold tracking-tight text-steel-900 lg:text-[28px]">Категории</h1>
          <p className="mt-1 text-[13px] text-steel-500">Всего: <b>{cats.length}</b></p>
        </div>
        <Link href="/admin/categories/new" className="inline-flex items-center gap-2 rounded-md bg-amber-400 px-4 py-2 text-[13.5px] font-bold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300">
          + Новая категория
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c) => (
          <Link
            key={c.slug}
            href={`/admin/categories/${c.slug}`}
            className="group flex flex-col overflow-hidden rounded-[14px] border border-steel-200 bg-white shadow-soft transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-elev"
          >
            <div className="relative aspect-[16/9] overflow-hidden bg-steel-50">
              {c.cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.cover_image} alt={c.title} className="h-full w-full object-cover" />
              ) : fallbacks.get(c.slug) ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fallbacks.get(c.slug) as string} alt={c.title} className="h-full w-full object-contain p-4" style={{ mixBlendMode: "multiply" }} />
                  <span className="absolute left-2 top-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">авто</span>
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[11px] uppercase tracking-[0.16em] text-steel-400">
                  без обложки
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-4">
              <div className="font-display text-[16px] font-extrabold text-steel-900 group-hover:text-amber-700">{c.title}</div>
              <div className="text-[11.5px] text-steel-500">/c/{c.slug}</div>
              {c.subtitle && <div className="line-clamp-2 text-[12px] text-steel-600">{c.subtitle}</div>}
              <div className="mt-auto flex items-center justify-between pt-2 text-[12px] text-steel-500">
                <span>{c.product_count.toLocaleString("ru-RU")} товаров</span>
                <span className="rounded bg-steel-100 px-1.5 py-0.5 text-[10.5px]">order {c.sort_order}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
