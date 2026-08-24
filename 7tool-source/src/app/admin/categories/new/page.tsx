import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createCategoryAction } from "../actions";
import { CoverPicker } from "../CoverPicker";

export const dynamic = "force-dynamic";

const ICONS = ["drill","cutter","edge","grinder","saw","pipe","weldAuto","thermal","weld","robot","lift","pneumatic","electric","fixture"];

export default async function NewCategoryPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  return (
    <section className="mx-auto max-w-[760px] px-4 py-8 sm:px-6 lg:py-10">
      <Link href="/admin/categories" className="text-[12px] text-steel-500 hover:text-amber-700">← Назад к категориям</Link>
      <h1 className="mt-1 font-display text-[24px] font-extrabold tracking-tight text-steel-900 lg:text-[28px]">Новая категория</h1>

      {sp.err && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{sp.err}</div>}

      <form action={createCategoryAction} className="mt-6 grid gap-3 rounded-[14px] border border-steel-200 bg-white p-5 shadow-soft">
        <Field label="Название" name="title" required />
        <Field label="Slug" name="slug" hint="оставьте пустым — сгенерируется из названия" />
        <label className="grid gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-steel-500">
          Иконка
          <select name="icon" defaultValue="fixture" className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px] font-normal normal-case tracking-normal text-steel-900 focus:border-amber-400 focus:outline-none">
            {ICONS.map((i) => <option key={i}>{i}</option>)}
          </select>
        </label>
        <Field label="Подзаголовок" name="subtitle" hint="отображается на главной под заголовком карточки" />
        <Field label="Текст кнопки" name="cta_text" hint='короткое — например, "Подобрать станок"' />
        <div>
          <div className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-steel-500">Обложка</div>
          <CoverPicker name="cover_image" initial={null} />
        </div>
        <button type="submit" className="mt-2 w-fit rounded-md bg-amber-400 px-5 py-2.5 text-[14px] font-bold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300">
          Создать
        </button>
      </form>
    </section>
  );
}

function Field({ label, name, hint, required, defaultValue }: { label: string; name: string; hint?: string; required?: boolean; defaultValue?: string }) {
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
