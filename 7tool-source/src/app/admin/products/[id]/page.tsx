import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getProductById } from "@/lib/products-db";
import { db } from "@/lib/db";
import { saveProductInfo, saveVariant } from "./actions";
import { ImagesEditor } from "./ImagesEditor";

export const dynamic = "force-dynamic";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const p = getProductById(id);
  if (!p) notFound();

  const cats = db()
    .prepare<unknown[], { slug: string; title: string }>("SELECT slug, title FROM categories ORDER BY title")
    .all();

  const meta = db()
    .prepare<unknown[], { meta_title: string | null; meta_description: string | null; seo_text: string | null; seo_source: string | null }>(
      "SELECT meta_title, meta_description, seo_text, seo_source FROM products WHERE id = ?",
    )
    .get(id);

  const saveAction = saveProductInfo.bind(null, p.id);

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/products" className="text-[12px] text-steel-500 hover:text-amber-700">← Назад к списку</Link>
          <h1 className="mt-1 font-display text-[24px] font-extrabold tracking-tight text-steel-900 lg:text-[28px]">
            {p.title}
          </h1>
          <div className="mt-1 text-[12px] text-steel-500">id: {p.id} · /p/{p.slug}</div>
        </div>
        <Link href={`/p/${p.slug}`} target="_blank" className="rounded-md border border-steel-200 bg-white px-3 py-1.5 text-[12.5px] font-bold text-steel-700 hover:border-amber-400 hover:text-amber-800">
          Открыть на сайте ↗
        </Link>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Левая колонка — основная */}
        <form action={saveAction} className="space-y-6">
          <Card title="Основное">
            <Field label="Название" name="title" defaultValue={p.title} required />
            <Field label="Slug (URL)" name="slug" defaultValue={p.slug} required hint="используется в /p/{slug}" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Бренд" name="brand" defaultValue={p.brand === "—" ? "" : p.brand} />
              <Field label="Артикул (SKU)" name="sku" defaultValue={p.sku} />
            </div>
            <label className="grid gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-steel-500">
              Категория
              <select name="category" defaultValue={p.category} className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px] font-normal normal-case tracking-normal text-steel-900 focus:border-amber-400 focus:outline-none">
                {cats.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.title}</option>
                ))}
              </select>
            </label>
            <Field
              label="Позиция в категории"
              name="manualSortOrder"
              defaultValue={p.manualSortOrder == null ? "" : String(p.manualSortOrder)}
              hint="меньше = выше; пусто = автоматическая сортировка"
            />
            <label className="grid gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-steel-500">
              Описание
              <textarea
                name="description"
                rows={8}
                defaultValue={p.description ?? ""}
                className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px] font-normal normal-case tracking-normal leading-relaxed text-steel-900 focus:border-amber-400 focus:outline-none"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-[13px] text-steel-700">
              <input type="checkbox" name="draft" value="1" defaultChecked={!!p.draft} className="h-4 w-4" />
              Черновик (скрыть с витрины)
            </label>
          </Card>

          <Card title="SEO">
            <Field
              label="Meta title"
              name="metaTitle"
              defaultValue={meta?.meta_title ?? ""}
              hint="до 65 символов · если пусто, используется название"
            />
            <label className="grid gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-steel-500">
              Meta description
              <textarea
                name="metaDescription"
                rows={3}
                defaultValue={meta?.meta_description ?? ""}
                className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px] font-normal normal-case tracking-normal leading-relaxed text-steel-900 focus:border-amber-400 focus:outline-none"
              />
              <span className="text-[11px] text-steel-500">до 160 символов · если пусто, берётся первый абзац описания</span>
            </label>
            <label className="grid gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-steel-500">
              SEO-текст
              <textarea name="seoText" rows={8} defaultValue={meta?.seo_text ?? ""} className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px] font-normal normal-case tracking-normal leading-relaxed text-steel-900 focus:border-amber-400 focus:outline-none" />
              <span className="text-[11px] text-steel-500">Источник: {meta?.seo_source || "не задан"}. После ручного изменения автоматизация поле не перезаписывает.</span>
            </label>
          </Card>

          <div className="flex justify-end gap-3">
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-400 px-5 py-2.5 text-[14px] font-bold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300"
            >
              Сохранить
            </button>
          </div>
        </form>

        {/* Правая колонка — фото и метрики */}
        <aside className="space-y-6">
          <Card title="Фотографии">
            <ImagesEditor productId={p.id} initial={p.images} />
          </Card>
          <Card title="Метрики">
            <Metric l="Вариантов" v={p.variants.length} />
            <Metric l="Остаток (sum qty)" v={p.stock} />
            <Metric l="Цена" v={p.priceFrom ? `${p.priceFrom.toLocaleString("ru-RU")}${p.priceTo && p.priceTo !== p.priceFrom ? "–" + p.priceTo.toLocaleString("ru-RU") : ""} ₽` : "—"} />
            {p.discountPct ? <Metric l="Скидка %" v={`${p.discountPct}%`} /> : null}
          </Card>
        </aside>
      </div>

      <div className="mt-10 space-y-4">
        <h2 className="font-display text-[20px] font-extrabold tracking-tight text-steel-900">Варианты ({p.variants.length})</h2>
        <div className="overflow-hidden rounded-[14px] border border-steel-200 bg-white shadow-soft">
          <table className="w-full text-[13px]">
            <thead className="bg-steel-50/60 text-[11px] uppercase tracking-[0.12em] text-steel-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">SKU</th>
                <th className="px-3 py-2 text-left font-semibold">Имя</th>
                <th className="px-3 py-2 text-right font-semibold">Цена</th>
                <th className="px-3 py-2 text-right font-semibold">Старая</th>
                <th className="px-3 py-2 text-right font-semibold">Остаток</th>
                <th className="px-3 py-2 text-center font-semibold">В прод.</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {p.variants.map((v) => (
                <tr key={v.id} className="border-t border-steel-100">
                  <td className="px-3 py-2 align-top">
                    <form action={saveVariant.bind(null, v.id)} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[110px_1fr_90px_90px_70px_60px_auto]">
                      <input type="hidden" name="productId" value={p.id} />
                      <input name="sku" defaultValue={v.sku} className="rounded border border-steel-200 px-2 py-1 text-[12px]" />
                      <input name="name" defaultValue={v.name ?? ""} placeholder="вариант — имя (опционально)" className="rounded border border-steel-200 px-2 py-1 text-[12px]" />
                      <input name="price" defaultValue={v.price ?? ""} placeholder="цена" inputMode="numeric" className="rounded border border-steel-200 px-2 py-1 text-right text-[12px]" />
                      <input name="oldPrice" defaultValue={v.oldPrice ?? ""} placeholder="старая" inputMode="numeric" className="rounded border border-steel-200 px-2 py-1 text-right text-[12px]" />
                      <input name="quantity" defaultValue={v.quantity ?? ""} placeholder="0" inputMode="numeric" className="rounded border border-steel-200 px-2 py-1 text-right text-[12px]" />
                      <label className="inline-flex items-center justify-center gap-1 text-[11px] text-steel-600">
                        <input type="checkbox" name="available" value="1" defaultChecked={v.available} />
                      </label>
                      <button type="submit" className="rounded-md bg-amber-400 px-2.5 py-1 text-[11.5px] font-bold text-steel-900 hover:bg-amber-300">Сохр.</button>
                    </form>
                  </td>
                </tr>
              ))}
              {p.variants.length === 0 && <tr><td className="px-3 py-6 text-center text-steel-500">Вариантов нет</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-steel-200 bg-white p-5 shadow-soft">
      <h3 className="text-[12px] font-bold uppercase tracking-[0.16em] text-amber-700">{title}</h3>
      <div className="mt-3 grid gap-3">{children}</div>
    </div>
  );
}
function Field({ label, name, defaultValue, required, hint }: { label: string; name: string; defaultValue?: string; required?: boolean; hint?: string }) {
  return (
    <label className="grid gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-steel-500">
      <span>{label}{required && <span className="text-amber-600"> *</span>}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px] font-normal normal-case tracking-normal text-steel-900 focus:border-amber-400 focus:outline-none"
      />
      {hint && <span className="text-[11px] font-normal normal-case tracking-normal text-steel-500">{hint}</span>}
    </label>
  );
}
function Metric({ l, v }: { l: string; v: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-steel-100 pb-2 last:border-0 last:pb-0">
      <div className="text-[11.5px] uppercase tracking-[0.14em] text-steel-500">{l}</div>
      <div className="font-display text-[14px] font-bold tabular-nums text-steel-900">{v}</div>
    </div>
  );
}
