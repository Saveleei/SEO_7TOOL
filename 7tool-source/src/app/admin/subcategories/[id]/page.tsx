import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { listAdminCategories } from "@/lib/categories-db";
import { getAdminSubcategory } from "@/lib/subcategories-db";
import { CoverPicker } from "../../categories/CoverPicker";
import { deleteSubcategoryAction, saveSubcategoryAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditSubcategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requireAdmin();
  const { id: rawId } = await params;
  const query = await searchParams;
  const isNew = rawId === "new";
  const id = isNew ? null : Number(rawId);
  if (!isNew && !Number.isInteger(id)) notFound();
  const item = id == null ? undefined : getAdminSubcategory(id);
  if (!isNew && !item) notFound();
  const categories = listAdminCategories();
  const save = saveSubcategoryAction.bind(null, id);
  const remove = id == null ? null : deleteSubcategoryAction.bind(null, id);

  return (
    <section className="mx-auto max-w-[920px] px-4 py-8 sm:px-6">
      <Link href="/admin/subcategories" className="text-[12px] text-steel-500 hover:text-amber-700">← Подкатегории</Link>
      <h1 className="mt-1 font-display text-[28px] font-extrabold text-steel-900">{item?.title ?? "Новая подкатегория"}</h1>
      {query.ok && <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-[13px] text-emerald-800">Сохранено. Для публикации snapshot должен войти в следующую сборку.</p>}
      {query.err && <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-[13px] text-red-800">{query.err}</p>}

      <form action={save} className="mt-6 grid gap-4 rounded-[14px] border border-steel-200 bg-white p-5 shadow-soft">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Название" name="title" value={item?.title} required />
          <Field label="Slug" name="slug" value={item?.slug} required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-[12px] font-bold text-steel-600">Родительская категория
            <select name="category_slug" defaultValue={item?.category_slug} required className="rounded-md border border-steel-200 px-3 py-2 text-[14px] font-normal">
              <option value="">Выберите</option>
              {categories.map((category) => <option key={category.slug} value={category.slug}>{category.title}</option>)}
            </select>
          </label>
          <Field label="Порядок" name="sort_order" value={String(item?.sort_order ?? 0)} />
        </div>
        <Field label="Краткое описание" name="short_description" value={item?.short_description} />
        <Area label="Вводный текст" name="intro" value={item?.intro} rows={3} />
        <Area label="Расширенный SEO-текст" name="seo_text" value={item?.seo_text} rows={6} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Meta title" name="meta_title" value={item?.meta_title} />
          <Field label="Alt изображения" name="image_alt" value={item?.image_alt} />
        </div>
        <Area label="Meta description" name="meta_description" value={item?.meta_description} rows={2} />
        <div>
          <div className="mb-1.5 text-[12px] font-bold text-steel-600">Изображение</div>
          <CoverPicker name="image" initial={item?.image ?? null} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Минимум товаров" name="min_products" value={String(item?.min_products ?? 2)} />
          <label className="grid gap-1.5 text-[12px] font-bold text-steel-600">Логика правил
            <select name="match_mode" defaultValue={item?.match_mode ?? "any"} className="rounded-md border border-steel-200 px-3 py-2 text-[14px] font-normal">
              <option value="any">Любое правило</option><option value="all">Все правила</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-[12px] font-bold text-steel-600">Форма
            <select name="form_position" defaultValue={item?.form_position ?? "after_products"} className="rounded-md border border-steel-200 px-3 py-2 text-[14px] font-normal">
              <option value="after_products">После товаров</option><option value="after_subcategories">После подкатегорий</option>
            </select>
          </label>
        </div>
        <Area label="Правила автопривязки (JSON)" name="rules_json" value={item?.rules_json ?? "[]"} rows={7} hint='Например: [{"field":"title","pattern":"магнит"}]' />
        <Area label="ID товаров для ручного добавления" name="manual_product_ids" value={parseIds(item?.manual_product_ids)} rows={3} hint="Через запятую или с новой строки. Один товар может входить в несколько подкатегорий." />
        <div className="flex flex-wrap gap-5">
          <Check name="published" label="Опубликована" checked={item?.published !== 0} />
          <Check name="form_enabled" label="Форма подбора активна" checked={item?.form_enabled !== 0} />
        </div>
        <div className="flex justify-end"><button className="rounded-md bg-amber-400 px-5 py-2.5 text-[14px] font-bold text-steel-900">Сохранить</button></div>
      </form>
      {remove && <form action={remove} className="mt-6 rounded-[12px] border border-red-200 bg-red-50 p-4">
        <button className="rounded-md border border-red-300 bg-white px-4 py-2 text-[13px] font-bold text-red-800">Удалить подкатегорию</button>
      </form>}
    </section>
  );
}

function parseIds(raw?: string | null): string {
  if (!raw) return "";
  try { return (JSON.parse(raw) as string[]).join("\n"); } catch { return raw; }
}
function Field({ label, name, value, required }: { label: string; name: string; value?: string | null; required?: boolean }) {
  return <label className="grid gap-1.5 text-[12px] font-bold text-steel-600">{label}<input name={name} defaultValue={value ?? ""} required={required} className="rounded-md border border-steel-200 px-3 py-2 text-[14px] font-normal" /></label>;
}
function Area({ label, name, value, rows, hint }: { label: string; name: string; value?: string | null; rows: number; hint?: string }) {
  return <label className="grid gap-1.5 text-[12px] font-bold text-steel-600">{label}<textarea name={name} defaultValue={value ?? ""} rows={rows} className="rounded-md border border-steel-200 px-3 py-2 text-[14px] font-normal" />{hint && <span className="text-[11px] font-normal text-steel-500">{hint}</span>}</label>;
}
function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return <label className="inline-flex items-center gap-2 text-[13px] font-bold text-steel-700"><input type="checkbox" name={name} value="1" defaultChecked={checked} />{label}</label>;
}
