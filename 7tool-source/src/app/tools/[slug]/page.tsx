import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { InteractiveToolWorkbench } from "@/components/InteractiveToolWorkbench";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getPublishedTool, listPublishedTools } from "@/lib/tool-platform-db";
import { indexableRobots, noIndexRobots, pageTitle } from "@/lib/seo-metadata";
import { absoluteUrl } from "@/lib/site-config";

export const dynamicParams = true;
export const revalidate = 300;

type RouteProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return listPublishedTools().map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getPublishedTool(slug);
  if (!tool) return { title: "Инструмент не найден", robots: noIndexRobots };
  return {
    title: pageTitle(tool.metaTitle),
    description: tool.metaDescription,
    alternates: { canonical: `/tools/${tool.slug}` },
    robots: tool.indexStatus === "INDEX" ? indexableRobots : noIndexRobots,
    openGraph: {
      type: "website",
      url: absoluteUrl(`/tools/${tool.slug}`),
      title: tool.metaTitle,
      description: tool.metaDescription,
      images: [],
    },
    twitter: {
      card: "summary",
      title: tool.metaTitle,
      description: tool.metaDescription,
      images: [],
    },
  };
}

export default async function ToolPage({ params }: RouteProps) {
  const { slug } = await params;
  const tool = getPublishedTool(slug);
  if (!tool) notFound();
  return (
    <>
      <SiteHeader />
      <main>
        <header className="border-b border-steel-200 bg-white">
          <div className="mx-auto max-w-[1180px] px-4 pb-10 pt-7 sm:px-6 sm:pb-14">
            <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Инженерные инструменты", href: "/tools" }, { label: tool.title }]} />
            <div className="mt-8 max-w-[900px]">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">Verified data · версия {tool.version}</div>
              <h1 className="mt-3 font-display text-[34px] font-black leading-tight tracking-tight text-steel-900 sm:text-[48px]">{tool.h1}</h1>
              <p className="mt-5 max-w-[800px] text-[15px] leading-7 text-steel-600">{tool.description}</p>
            </div>
          </div>
        </header>
        <section className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 sm:py-14">
          <InteractiveToolWorkbench tool={tool} />
          <div className="mt-10 flex flex-col justify-between gap-4 rounded-[14px] border border-amber-300 bg-steel-900 p-6 text-white sm:flex-row sm:items-center">
            <div><h2 className="font-display text-[21px] font-extrabold">Нужна проверка инженера?</h2><p className="mt-1 text-[13px] leading-6 text-steel-300">Передайте исходные параметры — специалист сверит результат с конкретной моделью и оснасткой.</p></div>
            <Link href="/kontakty" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-amber-400 px-5 text-[13px] font-extrabold text-steel-900 hover:bg-amber-300">Связаться с 7TOOL</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
