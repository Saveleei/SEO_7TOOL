import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { noIndexRobots } from "@/lib/seo-metadata";

export const metadata: Metadata = {
  title: "Страница не найдена",
  description: "Запрошенная страница не найдена. Перейдите в каталог 7TOOL или воспользуйтесь поиском.",
  robots: noIndexRobots,
};

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="bg-steel-50">
        <section className="mx-auto flex min-h-[60vh] max-w-[760px] flex-col items-center justify-center px-6 py-20 text-center">
          <div className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-amber-700">Ошибка 404</div>
          <h1 className="mt-3 font-display text-[36px] font-black tracking-tight text-steel-900 sm:text-[52px]">Страница не найдена</h1>
          <p className="mt-4 max-w-[600px] text-[15px] leading-7 text-steel-600">Адрес мог измениться или в ссылке есть ошибка. Откройте каталог либо найдите товар по названию, бренду или артикулу через поиск в шапке.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/#categories" className="inline-flex min-h-12 items-center rounded-lg bg-amber-400 px-6 text-sm font-extrabold text-steel-900 shadow-amber hover:bg-amber-300">Перейти в каталог</Link>
            <Link href="/" className="inline-flex min-h-12 items-center rounded-lg border border-steel-300 bg-white px-6 text-sm font-extrabold text-steel-800 hover:border-amber-400">На главную</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
