import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { allSubcategoryDefinitions } from "@/lib/subcategories";
import { ensureDefaultSubcategories, listAdminSubcategories } from "@/lib/subcategories-db";

export const dynamic = "force-dynamic";

export default async function AdminSubcategoriesPage() {
  await requireAdmin();
  ensureDefaultSubcategories(allSubcategoryDefinitions());
  const items = listAdminSubcategories();
  return (
    <section className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-extrabold text-steel-900">Подкатегории</h1>
          <p className="mt-1 text-[13px] text-steel-500">Автопривязка по правилам плюс ручное добавление товаров. Изменения попадают в snapshot для следующей сборки.</p>
        </div>
        <Link href="/admin/subcategories/new" className="rounded-md bg-amber-400 px-4 py-2 text-[13px] font-bold text-steel-900">+ Новая</Link>
      </div>
      <div className="mt-6 overflow-x-auto rounded-[14px] border border-steel-200 bg-white shadow-soft">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead className="bg-steel-50 text-[11px] uppercase tracking-wide text-steel-500"><tr><th className="p-3">Категория</th><th className="p-3">Название</th><th className="p-3">Slug</th><th className="p-3">Статус</th><th className="p-3">Порядок</th></tr></thead>
          <tbody>
            {items.map((item) => <tr key={item.id} className="border-t border-steel-100">
              <td className="p-3 text-steel-500">{item.category_slug}</td>
              <td className="p-3 font-bold"><Link href={`/admin/subcategories/${item.id}`} className="hover:text-amber-700">{item.title}</Link></td>
              <td className="p-3 text-steel-500">/{item.slug}</td>
              <td className="p-3">{item.published ? "Опубликована" : "Скрыта"}</td>
              <td className="p-3">{item.sort_order}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
