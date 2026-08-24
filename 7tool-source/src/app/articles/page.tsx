import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { listPublishedArticles } from "@/lib/articles-db";
import { indexableRobots, noIndexRobots, pageTitle } from "@/lib/seo-metadata";

export const revalidate = 300;

export function generateMetadata(): Metadata {
  const hasPublishedArticles = listPublishedArticles(1).length > 0;
  return {
    title: pageTitle("База знаний 7TOOL"),
    description: "Технические материалы 7TOOL о выборе, применении и проверке промышленного инструмента и оборудования для металлообработки.",
    alternates: { canonical: "/articles" },
    robots: hasPublishedArticles ? indexableRobots : noIndexRobots,
    openGraph: {
      type: "website",
      url: "/articles",
      title: "База знаний 7TOOL",
      description: "Проверенные технические материалы о выборе и применении промышленного инструмента.",
    },
  };
}

export default function ArticlesPage() {
  const articles = listPublishedArticles();
  const categories = new Set(articles.map((article) => article.categoryTitle)).size;
  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-steel-200 bg-steel-900 text-white">
          <div aria-hidden className="absolute inset-0 bg-blueprint-dark opacity-45" />
          <div aria-hidden className="absolute -right-24 -top-36 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,_rgba(245,158,11,0.32),_transparent_67%)]" />
          <div className="relative mx-auto max-w-[1280px] px-4 pb-14 pt-7 sm:px-6 sm:pb-20 sm:pt-10">
            <div className="text-steel-300"><Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "База знаний" }]} /></div>
            <div className="mt-7 grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="max-w-[820px]">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-amber-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">
                  Инженерная практика · 7TOOL
                </div>
                <h1 className="mt-5 font-display text-[36px] font-black leading-[1.05] tracking-tight sm:text-[54px] lg:text-[66px]">
                  База знаний 7TOOL
                </h1>
                <p className="mt-5 max-w-[720px] text-[15px] leading-7 text-steel-200 sm:text-[17px]">
                  Практические материалы о подборе и применении промышленного инструмента. Публикуем только то, что прошло проверку фактов, SEO и профильного специалиста.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                <Metric value={String(articles.length)} label="опубликовано" />
                <Metric value={String(categories)} label="направлений" />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 sm:py-16">
            {articles.length ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {articles.map((article) => (
                  <article key={article.id} className="group flex min-h-[310px] flex-col rounded-[14px] border border-steel-200 bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:border-amber-300 hover:shadow-card">
                    <div className="flex items-center justify-between gap-4 text-[11px] font-bold uppercase tracking-[0.13em] text-steel-500">
                      <span className="text-cobalt-600">{article.categoryTitle}</span>
                      <span>{article.readingMinutes} мин</span>
                    </div>
                    <h2 className="mt-5 font-display text-[23px] font-extrabold leading-tight tracking-tight text-steel-900">
                      <Link href={`/articles/${article.slug}`} className="transition group-hover:text-amber-700">{article.title}</Link>
                    </h2>
                    <p className="mt-4 line-clamp-4 text-[14px] leading-6 text-steel-600">{article.excerpt}</p>
                    <div className="mt-auto flex items-center justify-between border-t border-steel-100 pt-5 text-[12px] text-steel-500">
                      <span>{new Date(article.updatedAt).toLocaleDateString("ru-RU", { year: "numeric", month: "long", day: "numeric" })}</span>
                      <Link href={`/articles/${article.slug}`} className="font-bold text-steel-900 transition group-hover:text-amber-700">Читать →</Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mx-auto max-w-[760px] rounded-[14px] border border-steel-200 bg-steel-50/70 px-6 py-12 text-center sm:px-12">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-[22px] text-amber-800" aria-hidden>⌁</div>
                <h2 className="mt-5 font-display text-[26px] font-extrabold tracking-tight text-steel-900">Первые материалы проходят проверку</h2>
                <p className="mx-auto mt-3 max-w-[560px] text-[14px] leading-7 text-steel-600">
                  Мы не публикуем черновики и неподтверждённые технические данные. Пока база пополняется, характеристики и наличие можно посмотреть в каталоге.
                </p>
                <Link href="/" className="mt-7 inline-flex min-h-11 items-center justify-center rounded-lg bg-amber-400 px-5 text-[14px] font-extrabold text-steel-900 shadow-amber transition hover:bg-amber-300">
                  Перейти в каталог
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[12px] border border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
      <div className="font-display text-[28px] font-black text-white">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-steel-300">{label}</div>
    </div>
  );
}
