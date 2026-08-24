import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getAdminCategory } from "@/lib/categories-db";
import { CoverPicker } from "../CoverPicker";
import { saveCategoryAction, deleteCategoryAction } from "../actions";

export const dynamic = "force-dynamic";
const ICONS = ["drill","cutter","edge","grinder","saw","pipe","weldAuto","thermal","weld","robot","lift","pneumatic","electric","fixture"];

export default async function EditCategory({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requireAdmin();
  const { slug } = await params;
  const sp = await searchParams;
  const c = getAdminCategory(slug);
  if (!c) notFound();

  const save = saveCategoryAction.bind(null, c.slug);
  const del = deleteCategoryAction.bind(null, c.slug);

  return (
    <section className="mx-auto max-w-[920px] px-4 py-8 sm:px-6 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/categories" className="text-[12px] text-steel-500 hover:text-amber-700">← Все категории</Link>
          <h1 className="mt-1 font-display text-[24px] font-extrabold tracking-tight text-steel-900 lg:text-[28px]">{c.title}</h1>
          <div className="mt-1 text-[12px] text-steel-500">/c/{c.slug} · товаров: {c.product_count}</div>
        </div>
        <Link href={`/c/${c.slug}`} target="_blank" className="rounded-md border border-steel-200 bg-white px-3 py-1.5 text-[12.5px] font-bold text-steel-700 hover:border-amber-400 hover:text-amber-800">
          Открыть на сайте ↗
        </Link>
      </div>

      {sp.ok === "1" && <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">Сохранено.</div>}
      {sp.err && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{sp.err}</div>}

      <form action={save} className="mt-6 grid gap-5 rounded-[14px] border border-steel-200 bg-white p-5 shadow-soft">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Название" name="title" defaultValue={c.title} required />
          <Field label="Slug" name="slug" defaultValue={c.slug} hint="смена slug → автоматически переедут все товары" />
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <label className="grid gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-steel-500">
            Иконка
            <select name="icon" defaultValue={c.icon ?? "fixture"} className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px] font-normal normal-case tracking-normal text-steel-900 focus:border-amber-400 focus:outline-none">
              {ICONS.map((i) => <option key={i}>{i}</option>)}
            </select>
          </label>
          <Field label="Порядок" name="sort_order" defaultValue={String(c.sort_order)} hint="меньше = выше" />
        </div>

        <Field label="Подзаголовок" name="subtitle" defaultValue={c.subtitle ?? ""} hint="на главной под названием карточки" />
        <Field label="Текст кнопки" name="cta_text" defaultValue={c.cta_text ?? ""} hint='короткое — "Подобрать станок"' />
        <Field label="H1 страницы" name="h1" defaultValue={c.h1 ?? ""} />
        <label className="grid gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-steel-500">
          Вводный текст
          <textarea name="intro" rows={3} defaultValue={c.intro ?? ""} className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px] font-normal normal-case tracking-normal leading-relaxed text-steel-900 focus:border-amber-400 focus:outline-none" />
        </label>

        <div>
          <div className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-steel-500">Обложка</div>
          <CoverPicker name="cover_image" initial={c.cover_image} categorySlug={c.slug} />
        </div>
        <Field label="Alt изображения" name="image_alt" defaultValue={c.image_alt ?? ""} />
        <label className="inline-flex items-center gap-2 text-[13px] font-bold text-steel-700">
          <input type="checkbox" name="published" value="1" defaultChecked={c.published === 1} className="h-4 w-4 rounded border-steel-300 text-amber-500" />
          Категория опубликована
        </label>

        <h2 className="mt-3 text-[12px] font-bold uppercase tracking-[0.16em] text-amber-700">SEO</h2>
        <Field label="Meta title" name="meta_title" defaultValue={c.meta_title ?? ""} hint="до 65 символов" />
        <label className="grid gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-steel-500">
          Meta description
          <textarea
            name="meta_description"
            rows={3}
            defaultValue={c.meta_description ?? ""}
            className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px] font-normal normal-case tracking-normal leading-relaxed text-steel-900 focus:border-amber-400 focus:outline-none"
          />
        </label>
        <label className="grid gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-steel-500">
          SEO-текст категории
          <textarea name="seo_text" rows={7} defaultValue={c.seo_text ?? ""} className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px] font-normal normal-case tracking-normal leading-relaxed text-steel-900 focus:border-amber-400 focus:outline-none" />
        </label>

        <div className="flex items-center justify-end gap-3">
          <button type="submit" className="rounded-md bg-amber-400 px-5 py-2.5 text-[14px] font-bold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300">
            Сохранить
          </button>
        </div>
      </form>

      <div className="mt-8 rounded-[14px] border border-red-200 bg-red-50 p-5">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-red-700">Опасная зона</h2>
        <p className="mt-1 text-[12.5px] text-red-800">
          Удалить категорию можно только если в ней нет товаров. Сейчас: <b>{c.product_count}</b>.
        </p>
        <form action={del} className="mt-3">
          <button
            type="submit"
            disabled={c.product_count > 0}
            className="rounded-md border border-red-300 bg-white px-4 py-1.5 text-[12.5px] font-bold text-red-800 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Удалить категорию
          </button>
        </form>
      </div>
    </section>
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
