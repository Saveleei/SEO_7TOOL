import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { listPublishedTools } from "@/lib/tool-platform-db";
import { indexableRobots, noIndexRobots, pageTitle } from "@/lib/seo-metadata";

export const revalidate = 300;

export function generateMetadata(): Metadata {
  const tools = listPublishedTools();
  return {
    title: pageTitle("Инженерные калькуляторы и инструменты"),
    description: "Калькуляторы, подбор оборудования и таблицы совместимости на основе проверенных технических данных.",
    alternates: { canonical: "/tools" },
    robots: tools.some((tool) => tool.indexStatus === "INDEX") ? indexableRobots : noIndexRobots,
  };
}

export default function ToolsPage() {
  const tools = listPublishedTools();
  return (
    <>
      <SiteHeader />
      <main>
        <header className="border-b border-steel-200 bg-steel-900 text-white">
          <div className="mx-auto max-w-[1280px] px-4 pb-12 pt-7 sm:px-6 sm:pb-16">
            <div className="text-steel-300"><Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Инженерные инструменты" }]} /></div>
            <div className="mt-9 max-w-[820px]">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">Проверено по фактам</div>
              <h1 className="mt-4 font-display text-[36px] font-black leading-tight tracking-tight sm:text-[52px]">Инженерные калькуляторы и инструменты</h1>
              <p className="mt-5 text-[16px] leading-7 text-steel-200">Расчёты, подбор оборудования и совместимость без неподтверждённых коэффициентов или характеристик.</p>
            </div>
          </div>
        </header>
        <section className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 sm:py-16">
          {tools.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {tools.map((tool) => (
                <article key={tool.id} className="flex min-h-[260px] flex-col rounded-[14px] border border-steel-200 bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:border-amber-300 hover:shadow-card">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-cobalt-700">{tool.type === "COMPATIBILITY_TABLE" ? "Таблица" : tool.type === "ANNULAR_CUTTER_RPM" ? "Калькулятор" : "Подбор"}</div>
                  <h2 className="mt-4 font-display text-[23px] font-extrabold leading-tight text-steel-900"><Link href={`/tools/${tool.slug}`} className="hover:text-amber-700">{tool.title}</Link></h2>
                  <p className="mt-4 text-[13px] leading-6 text-steel-600">{tool.description}</p>
                  <Link href={`/tools/${tool.slug}`} className="mt-auto pt-6 text-[13px] font-extrabold text-steel-900">Открыть инструмент →</Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[14px] border border-steel-200 bg-steel-50/70 px-6 py-12 text-center">
              <h2 className="font-display text-[25px] font-extrabold text-steel-900">Инструменты проходят проверку данных</h2>
              <p className="mx-auto mt-3 max-w-[650px] text-[14px] leading-7 text-steel-600">Публичная версия появится после подтверждения формул, характеристик и совместимости профильным специалистом.</p>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
