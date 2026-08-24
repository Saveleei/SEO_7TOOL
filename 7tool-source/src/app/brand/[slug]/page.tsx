import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ProductCard } from "@/components/ProductCard";
import { brandSlug, legacyBrandSlug } from "@/lib/brand";
import { getPublicBrandProducts, getPublicBrandStats, listPublicBrands } from "@/lib/products-db";
import { indexableRobots, pageTitle } from "@/lib/seo-metadata";
import { absoluteUrl } from "@/lib/site-config";
import { productForListing } from "@/lib/catalog";

const PAGE_SIZE = 24;
type RouteProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export const dynamicParams = true;
export const dynamic = "force-dynamic";

function resolveBrand(routeSlug: string): { brand: string; canonicalSlug: string; legacy: boolean } | undefined {
  const decoded = safeDecode(routeSlug).toLocaleLowerCase("ru");
  for (const brand of listPublicBrands()) {
    const canonicalSlug = brandSlug(brand);
    if (canonicalSlug === decoded) return { brand, canonicalSlug, legacy: false };
    if (legacyBrandSlug(brand) === decoded) return { brand, canonicalSlug, legacy: true };
  }
  return undefined;
}

function pageNumber(raw?: string): number | undefined {
  if (!raw) return 1;
  if (!/^\d+$/.test(raw)) return undefined;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 ? value : undefined;
}

export async function generateMetadata({ params, searchParams }: RouteProps): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const selected = resolveBrand(slug);
  const page = pageNumber(query.page);
  if (!selected || !page) return { title: "Страница не найдена", robots: { index: false, follow: false } };
  const stats = getPublicBrandStats(selected.brand);
  if (!stats) return {};
  const totalPages = Math.max(1, Math.ceil(stats.productCount / PAGE_SIZE));
  if (page > totalPages) return { title: "Страница не найдена", robots: { index: false, follow: false } };
  const route = `/brand/${selected.canonicalSlug}${page > 1 ? `?page=${page}` : ""}`;
  const suffix = page > 1 ? ` — страница ${page}` : "";
  const title = `${selected.brand}: каталог промышленного оборудования${suffix}`;
  const description = `${selected.brand} в каталоге 7TOOL: ${stats.productCount} товарных групп и ${stats.variantCount} артикулов. Цены с НДС, наличие, характеристики и доставка по России${page > 1 ? `. Страница ${page} из ${totalPages}.` : "."}`;
  const preview = getPublicBrandProducts(selected.brand, 1, (page - 1) * PAGE_SIZE).items[0];
  const socialImage = preview?.images?.[0] ? absoluteUrl(preview.images[0]) : absoluteUrl("/og.png");
  return {
    title: pageTitle(title),
    description,
    alternates: { canonical: route },
    robots: indexableRobots,
    openGraph: { type: "website", title, description, url: absoluteUrl(route), images: [{ url: socialImage, alt: `Продукция ${selected.brand}` }] },
    twitter: { card: "summary_large_image", title, description, images: [socialImage] },
  };
}

export default async function BrandPage({ params, searchParams }: RouteProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const selected = resolveBrand(slug);
  if (!selected) notFound();
  if (selected.legacy || slug !== selected.canonicalSlug) {
    permanentRedirect(`/brand/${selected.canonicalSlug}${query.page ? `?page=${encodeURIComponent(query.page)}` : ""}`);
  }

  const page = pageNumber(query.page);
  if (!page) notFound();
  const stats = getPublicBrandStats(selected.brand);
  if (!stats) notFound();
  const totalPages = Math.max(1, Math.ceil(stats.productCount / PAGE_SIZE));
  if (page > totalPages) notFound();
  const { items } = getPublicBrandProducts(selected.brand, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const listingItems = items.map((product) => productForListing(product, [], false));
  const canonical = `/brand/${selected.canonicalSlug}${page > 1 ? `?page=${page}` : ""}`;
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${selected.brand}: каталог продукции${page > 1 ? ` — страница ${page}` : ""}`,
    url: absoluteUrl(canonical),
    inLanguage: "ru-RU",
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: selected.brand, item: absoluteUrl(`/brand/${selected.canonicalSlug}`) },
      ],
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: stats.productCount,
      itemListElement: listingItems.map((product, index) => ({
        "@type": "ListItem",
        position: (page - 1) * PAGE_SIZE + index + 1,
        name: product.title,
        url: absoluteUrl(`/p/${product.slug}`),
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd).replace(/</g, "\\u003c") }} />
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-steel-200 bg-steel-900 text-white">
          <div className="absolute inset-0 -z-10 bg-blueprint-dark opacity-50" />
          <div className="absolute -right-32 -top-32 -z-10 h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.5),_transparent_60%)]" />
          <div className="absolute inset-x-0 top-0 -z-0 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
          <div className="mx-auto max-w-[1280px] px-6 pb-12 pt-8 lg:pb-16 lg:pt-12">
            <div className="text-steel-300"><Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Бренды" }, { label: selected.brand }]} /></div>
            <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-300"><span className="h-px w-6 bg-amber-400" />Бренд</div>
                <h1 className="mt-3 font-display text-[40px] font-extrabold leading-[1.05] tracking-tight text-white lg:text-[64px]">{selected.brand}</h1>
                <p className="mt-3 max-w-[700px] text-[14.5px] text-steel-300">Продукция {selected.brand}: подтверждённые характеристики из товарного фида, актуальные цены с НДС и наличие по артикулам.</p>
                {stats.categories.length > 0 && <nav aria-label="Категории бренда" className="mt-5 flex flex-wrap gap-2">{stats.categories.map((category) => <Link key={category.slug} href={`/c/${category.slug}`} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white hover:border-amber-400 hover:text-amber-300">{category.title} · {category.count}</Link>)}</nav>}
              </div>
              <div className="grid grid-cols-3 gap-2 lg:gap-3">
                <Stat v={stats.productCount} l="моделей" />
                <Stat v={stats.variantCount} l="артикулов" />
                <Stat v={stats.stockedCount} l="в наличии" tone="emerald" />
                {stats.saleCount > 0 && <div className="col-span-3"><Stat v={stats.saleCount} l="акций" tone="amber" /></div>}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-10">
          <div className="mx-auto max-w-[1280px] px-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-steel-100 pb-4">
              <div className="text-[13px] text-steel-500">Показано <span className="font-semibold text-steel-900">{items.length}</span> из {stats.productCount}{page > 1 ? ` · страница ${page}` : ""}</div>
              <Link href="/#brands" className="text-[13px] font-medium text-amber-700 hover:text-amber-800">← Все бренды</Link>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">{listingItems.map((product) => <ProductCard key={product.id} p={product} />)}</div>
            {totalPages > 1 && <BrandPager slug={selected.canonicalSlug} page={page} totalPages={totalPages} />}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function BrandPager({ slug, page, totalPages }: { slug: string; page: number; totalPages: number }) {
  const first = Math.max(1, Math.min(Math.max(1, totalPages - 4), page - 2));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => first + index);
  const href = (value: number) => `/brand/${slug}${value > 1 ? `?page=${value}` : ""}`;
  const cls = "inline-flex h-11 min-w-11 items-center justify-center rounded-md border px-3 text-[13px] font-semibold";
  return <nav aria-label="Страницы каталога бренда" className="mt-8 flex flex-wrap items-center gap-2">{page > 1 && <Link rel="prev" href={href(page - 1)} className={`${cls} border-steel-200 text-steel-700 hover:border-amber-300`}>← Назад</Link>}{pages.map((value) => <Link key={value} href={href(value)} aria-current={value === page ? "page" : undefined} className={`${cls} ${value === page ? "border-amber-500 bg-amber-400 text-steel-900" : "border-steel-200 text-steel-700 hover:border-amber-300"}`}>{value}</Link>)}{page < totalPages && <Link rel="next" href={href(page + 1)} className={`${cls} border-steel-200 text-steel-700 hover:border-amber-300`}>Вперёд →</Link>}</nav>;
}

function Stat({ v, l, tone = "neutral" }: { v: number; l: string; tone?: "neutral" | "emerald" | "amber" }) {
  const cls = tone === "emerald" ? "border-emerald-400/40 bg-emerald-500/10" : tone === "amber" ? "border-amber-400/50 bg-amber-400/15" : "border-white/10 bg-white/5";
  return <div className={`rounded-md border px-3 py-2 text-center ${cls}`}><div className="font-display text-[20px] font-extrabold leading-none tracking-tight text-white">{v}</div><div className="mt-1 text-[10.5px] uppercase tracking-wider text-steel-300">{l}</div></div>;
}

function safeDecode(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}
