import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { FavoritesView } from "./FavoritesView";
import { noIndexRobots } from "@/lib/seo-metadata";

export const metadata = {
  title: "Избранное",
  description: "Сохранённые товары промышленного каталога 7TOOL.",
  robots: noIndexRobots,
};

export default function FavoritesPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="border-b border-steel-200 bg-gradient-to-b from-white via-amber-50/30 to-white">
          <div className="mx-auto max-w-[1280px] px-6 pb-8 pt-8 lg:pt-10">
            <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Избранное" }]} />
            <h1 className="mt-5 font-display text-[30px] font-extrabold tracking-tight text-steel-900 lg:text-[40px]">
              Избранное
            </h1>
            <p className="mt-2 max-w-[640px] text-[14.5px] text-steel-600">
              Сохраняем позиции в этом браузере, чтобы к ним можно было вернуться позже.
            </p>
          </div>
        </section>
        <FavoritesView />
      </main>
      <SiteFooter />
    </>
  );
}
