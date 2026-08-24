import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db, tables } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireAdmin();
  const t = tables();
  const productCount = t.productCount();
  const variantCount = t.variantCount();
  const categoryCount = t.categoryCount();

  const recent = db()
    .prepare<unknown[], { id: string; slug: string; title: string; updated_at: number }>(
      "SELECT id, slug, title, updated_at FROM products ORDER BY updated_at DESC LIMIT 8",
    )
    .all();

  const drafts = db()
    .prepare("SELECT COUNT(*) AS n FROM products WHERE draft = 1")
    .get() as { n: number };
  const noPrice = db()
    .prepare("SELECT COUNT(*) AS n FROM products WHERE price_from IS NULL")
    .get() as { n: number };
  const noImages = db()
    .prepare("SELECT COUNT(*) AS n FROM products WHERE images = '[]'")
    .get() as { n: number };

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:py-10">
      <h1 className="font-display text-[28px] font-extrabold tracking-tight text-steel-900 lg:text-[32px]">Дашборд</h1>
      <p className="mt-1 text-[14px] text-steel-600">Состояние каталога и быстрые ссылки.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Категории" value={categoryCount} />
        <Stat label="Продукты" value={productCount} />
        <Stat label="Варианты" value={variantCount} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Tile title="Черновики" v={drafts.n} link="/admin/products?draft=1" hint="скрыты с витрины" />
        <Tile title="Без цены" v={noPrice.n} link="/admin/products?nopr=1" hint="нужна цена / пометка" />
        <Tile title="Без фото" v={noImages.n} link="/admin/products?noim=1" hint="залить картинки" />
      </div>

      <h2 className="mt-10 font-display text-[18px] font-extrabold tracking-tight text-steel-900">Недавно обновлённые</h2>
      <ul className="mt-3 grid gap-2">
        {recent.map((r) => (
          <li key={r.id}>
            <Link
              href={`/admin/products/${r.id}`}
              className="flex items-center justify-between gap-4 rounded-md border border-steel-200 bg-white px-4 py-3 transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-soft"
            >
              <span className="min-w-0 truncate text-[14px] text-steel-900">{r.title}</span>
              <span className="shrink-0 text-[12px] text-steel-500">{new Date(r.updated_at).toLocaleString("ru-RU")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[14px] border border-steel-200 bg-white p-5 shadow-soft">
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-steel-500">{label}</div>
      <div className="mt-2 font-display text-[32px] font-extrabold tracking-tight text-steel-900">{value.toLocaleString("ru-RU")}</div>
    </div>
  );
}
function Tile({ title, v, link, hint }: { title: string; v: number; link: string; hint: string }) {
  return (
    <Link href={link} className="block rounded-[14px] border border-steel-200 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-elev">
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">{title}</div>
      <div className="mt-2 font-display text-[24px] font-extrabold text-steel-900">{v.toLocaleString("ru-RU")}</div>
      <div className="mt-1 text-[12px] text-steel-500">{hint}</div>
    </Link>
  );
}
