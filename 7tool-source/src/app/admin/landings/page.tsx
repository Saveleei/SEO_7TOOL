import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { landingCategories } from "@/lib/landing-pages";

export const dynamic = "force-dynamic";

export default async function AdminLandingsPage() {
  await requireAdmin();
  return (
    <section className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:py-10">
      <h1 className="font-display text-[28px] font-extrabold text-steel-900">Рекламные лендинги</h1>
      <p className="mt-2 max-w-[760px] text-[13px] leading-relaxed text-steel-600">
        Здесь можно вручную менять тексты, фотографии, кейсы и вопросы. Настройки хранятся отдельно от товарного фида и сохраняются после его обновления.
      </p>
      <div className="mt-6 grid gap-4">
        {landingCategories.filter((category) => category.active).map((category) => (
          <article key={category.slug} className="rounded-xl border border-steel-200 bg-white p-5 shadow-soft">
            <h2 className="font-display text-[19px] font-extrabold text-steel-900">{category.label}</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {category.intents.map((intent) => (
                <div key={intent.slug} className="flex items-center justify-between gap-3 rounded-lg border border-steel-100 bg-steel-50 px-3 py-3">
                  <div><div className="text-[13px] font-bold text-steel-800">{intent.label}</div><div className="mt-0.5 text-[11px] text-steel-500">/lp/{category.slug}/{intent.slug}</div></div>
                  <div className="flex gap-2">
                    <Link href={`/admin/landings/${category.slug}/${intent.slug}`} className="rounded-md bg-amber-400 px-3 py-2 text-[12px] font-extrabold text-steel-900 hover:bg-amber-300">Настроить</Link>
                    <Link href={`/lp/${category.slug}/${intent.slug}`} target="_blank" className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[12px] font-bold text-steel-700 hover:border-amber-300">↗</Link>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
