import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listProductsForAdmin } from "@/lib/products-db";
import { db } from "@/lib/db";
import { saveProductSortOrderAction } from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function ProductsListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; brand?: string; draft?: string; nopr?: string; noim?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const draft = sp.draft === "1" ? true : undefined;
  const opts = {
    q: sp.q?.trim() || undefined,
    category: sp.cat || undefined,
    brand: sp.brand || undefined,
    draft,
    limit: PAGE_SIZE,
    offset,
  };

  // Если фильтры nopr/noim — добавим хак: фильтрация в отдельных запросах
  let rows: ReturnType<typeof listProductsForAdmin>["rows"];
  let total: number;
  if (sp.nopr === "1" || sp.noim === "1") {
    const where: string[] = ["1=1"];
    const args: unknown[] = [];
    if (sp.nopr === "1") where.push("price_from IS NULL");
    if (sp.noim === "1") where.push("images = '[]'");
    if (opts.q) {
      where.push("(title LIKE ? OR slug LIKE ? OR sku LIKE ?)");
      const like = `%${opts.q}%`;
      args.push(like, like, like);
    }
    if (opts.category) { where.push("category = ?"); args.push(opts.category); }
    if (opts.brand) { where.push("brand = ?"); args.push(opts.brand); }
    const wh = `WHERE ${where.join(" AND ")}`;
    total = (db().prepare(`SELECT COUNT(*) AS n FROM products ${wh}`).get(...args) as { n: number }).n;
    rows = db()
      .prepare<unknown[], typeof opts extends never ? never : Awaited<ReturnType<typeof listProductsForAdmin>>["rows"][number]>(
        `SELECT id, slug, title, brand, sku, category, stock, price_from, price_to, draft,
                manual_sort_order, updated_at,
                (SELECT COUNT(*) FROM variants v WHERE v.product_id = products.id) AS variant_count,
                (SELECT json_array_length(images)) AS image_count
           FROM products ${wh}
           ORDER BY updated_at DESC
           LIMIT ? OFFSET ?`,
      )
      .all(...args, PAGE_SIZE, offset);
  } else {
    const r = listProductsForAdmin(opts);
    rows = r.rows; total = r.total;
  }

  const cats = db()
    .prepare<unknown[], { slug: string; title: string }>("SELECT slug, title FROM categories ORDER BY title")
    .all();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-extrabold tracking-tight text-steel-900 lg:text-[28px]">Товары</h1>
          <p className="mt-1 text-[13px] text-steel-500">Найдено: <b>{total.toLocaleString("ru-RU")}</b></p>
        </div>
      </div>

      <form className="mt-5 grid gap-2 sm:grid-cols-[1fr_220px_180px_auto]">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Поиск по названию / slug / SKU / бренду"
          className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px] text-steel-900 focus:border-amber-400 focus:outline-none"
        />
        <select name="cat" defaultValue={sp.cat ?? ""} className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px]">
          <option value="">Все категории</option>
          {cats.map((c) => (
            <option key={c.slug} value={c.slug}>{c.title}</option>
          ))}
        </select>
        <select name="draft" defaultValue={sp.draft ?? ""} className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px]">
          <option value="">Все статусы</option>
          <option value="1">Черновики</option>
        </select>
        {sp.nopr === "1" && <input type="hidden" name="nopr" value="1" />}
        {sp.noim === "1" && <input type="hidden" name="noim" value="1" />}
        <button className="rounded-md bg-amber-400 px-4 py-2 text-[13.5px] font-bold text-steel-900 shadow-amber transition hover:bg-amber-300">
          Применить
        </button>
      </form>

      <p className="mt-3 text-[12px] text-steel-500">
        Ручной порядок: укажите 1, 2, 3… — меньший номер показывается выше. Пустое поле оставляет автоматическую сортировку.
      </p>

      <div className="mt-6 overflow-hidden rounded-[14px] border border-steel-200 bg-white shadow-soft">
        <table className="w-full text-[13.5px]">
          <thead className="bg-steel-50/60 text-[11px] uppercase tracking-[0.12em] text-steel-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Название</th>
              <th className="px-3 py-2 text-left font-semibold">Бренд</th>
              <th className="px-3 py-2 text-left font-semibold">Категория</th>
              <th className="px-3 py-2 text-right font-semibold">Цена</th>
              <th className="px-3 py-2 text-right font-semibold">Остаток</th>
              <th className="px-3 py-2 text-right font-semibold">Вар./Фото</th>
              <th className="px-3 py-2 text-center font-semibold">Порядок</th>
              <th className="px-3 py-2 text-left font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-steel-100 hover:bg-amber-50/30">
                <td className="px-3 py-2.5">
                  <Link href={`/admin/products/${r.id}`} className="font-medium text-steel-900 hover:text-amber-700">
                    {r.title}
                  </Link>
                  <div className="text-[11.5px] text-steel-500">/p/{r.slug} {r.draft ? <span className="ml-1 rounded bg-amber-100 px-1 text-amber-800">черновик</span> : null}</div>
                </td>
                <td className="px-3 py-2.5 text-steel-700">{r.brand ?? "—"}</td>
                <td className="px-3 py-2.5 text-steel-600">{r.category ?? "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {r.price_from
                    ? r.price_from === r.price_to
                      ? `${r.price_from.toLocaleString("ru-RU")} ₽`
                      : `${r.price_from.toLocaleString("ru-RU")}–${r.price_to?.toLocaleString("ru-RU") ?? ""} ₽`
                    : <span className="text-steel-400">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.stock}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-steel-600">{r.variant_count} / {r.image_count}</td>
                <td className="px-3 py-2.5">
                  <form action={saveProductSortOrderAction.bind(null, r.id, r.category)} className="flex items-center justify-center gap-1.5">
                    <input
                      name="manualSortOrder"
                      type="number"
                      defaultValue={r.manual_sort_order ?? ""}
                      placeholder="авто"
                      title="Меньше = выше; пусто = автоматически"
                      className="w-[64px] rounded border border-steel-200 px-2 py-1 text-center text-[12px] tabular-nums focus:border-amber-400 focus:outline-none"
                    />
                    <button type="submit" className="rounded border border-steel-200 bg-white px-2 py-1 text-[11px] font-bold text-steel-700 hover:border-amber-400 hover:bg-amber-50">
                      ✓
                    </button>
                  </form>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Link href={`/admin/products/${r.id}`} className="rounded-md bg-amber-400 px-3 py-1 text-[12px] font-bold text-steel-900 hover:bg-amber-300">
                    Открыть
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-steel-500">Ничего не найдено</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pager page={page} total={totalPages} sp={sp} />
      )}
    </section>
  );
}

function Pager({ page, total, sp }: { page: number; total: number; sp: Record<string, string | undefined> }) {
  const mk = (p: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v) u.set(k, v);
    u.set("page", String(p));
    return `?${u.toString()}`;
  };
  return (
    <div className="mt-5 flex items-center justify-center gap-2 text-[12.5px]">
      {page > 1 && <Link href={mk(page - 1)} className="rounded-md border border-steel-200 bg-white px-3 py-1.5 text-steel-700 hover:border-amber-300">← Назад</Link>}
      <span className="text-steel-500">{page} / {total}</span>
      {page < total && <Link href={mk(page + 1)} className="rounded-md border border-steel-200 bg-white px-3 py-1.5 text-steel-700 hover:border-amber-300">Вперёд →</Link>}
    </div>
  );
}
