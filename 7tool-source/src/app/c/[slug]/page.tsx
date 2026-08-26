import { notFound } from "next/navigation";
import { listPublicCategories, getPublicCategory } from "@/lib/categories-db";
import { getProductsByCategory } from "@/lib/products-db";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CategoryArt } from "@/components/CategoryArt";
import { QuickChips } from "@/components/QuickChips";
import { WarehouseStrip } from "@/components/WarehouseProof";
import { CategoryFilters } from "./CategoryFilters";
import { SubcategoryGrid } from "@/components/SubcategoryGrid";
import { CategorySelectionForm } from "@/components/CategorySelectionForm";
import { SemanticNextSteps } from "@/components/SemanticNextSteps";
import { StructuredData } from "@/components/StructuredData";
import { getSemanticLinks } from "@/lib/semantic-linking-db";
import { contentForCategory } from "@/lib/category-content";
import { getSubcategoriesForCategory } from "@/lib/subcategories";
import { absoluteUrl } from "@/lib/site-config";
import { listingFacetNames, productForListing } from "@/lib/catalog";
import { indexableRobots, noIndexRobots, pageTitle } from "@/lib/seo-metadata";
import { catalogFacetDecision, catalogFilterValues, catalogPageHref, catalogPageNumber, hasCatalogFilters, type CatalogQuery } from "@/lib/catalog-query";
import { categorySocialPreviewPath, socialPreviewImage } from "@/lib/social-preview";

// Keep known categories prerendered, but allow Next.js to regenerate a route
// if a large page is evicted from the runtime response cache. With `false`,
// Next may turn that recoverable cache miss into an internal NoFallback 404.
export const dynamicParams = true;

export function generateStaticParams() {
  return listPublicCategories().map((c) => ({ slug: c.slug }));
}

type RouteProps = { params: Promise<{ slug: string }>; searchParams: Promise<CatalogQuery> };

export async function generateMetadata({ params, searchParams }: RouteProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const cat = getPublicCategory(slug);
  if (!cat) return {};
  const page = catalogPageNumber(query);
  if (!page) return { title: "Страница не найдена", robots: noIndexRobots };
  const categoryProducts = getProductsByCategory(cat.slug);
  if (page > Math.max(1, Math.ceil(categoryProducts.length / 24))) {
    return { title: "Страница не найдена", robots: noIndexRobots };
  }
  const filtered = catalogFacetDecision(query).hasFacets;
  const content = contentForCategory(cat.slug, cat.title);
  const baseTitle = cat.metaTitle || content.metaTitle;
  const title = page > 1 && !filtered ? `${baseTitle} — страница ${page}` : baseTitle;
  const baseDescription = cat.metaDescription || content.metaDescription;
  const desc = page > 1 && !filtered ? `${baseDescription} Страница ${page}.` : baseDescription;
  const canonical = filtered ? `/c/${cat.slug}` : catalogPageHref(`/c/${cat.slug}`, page);
  // Социальные сети не должны выбирать первое изображение из DOM (там может
  // оказаться карточка менеджера). Если обложка категории не задана вручную,
  // используем реальную фотографию товара из этого раздела.
  const fallbackProductImage = categoryProducts.find((product) => product.images?.[0])?.images?.[0];
  const image = socialPreviewImage(
    categorySocialPreviewPath(cat.slug, cat.coverImage, fallbackProductImage),
    cat.imageAlt || content.h1,
  );
  return {
    title: pageTitle(title),
    description: desc,
    keywords: content.keywords,
    alternates: { canonical },
    robots: filtered ? noIndexRobots : indexableRobots,
    openGraph: { type: "website", title, description: desc, url: absoluteUrl(canonical), images: [image] },
    twitter: { card: "summary_large_image", title, description: desc, images: [image.url] },
  };
}

export default async function CategoryPage({ params, searchParams }: RouteProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const cat = getPublicCategory(slug);
  if (!cat) notFound();

  const items = getProductsByCategory(slug);
  const page = catalogPageNumber(query);
  const maxPage = Math.max(1, Math.ceil(items.length / 24));
  if (!page || page > maxPage) notFound();
  const semanticLinks = page === 1 && !hasCatalogFilters(query) ? getSemanticLinks("CATEGORY", cat.slug) : undefined;
  const pageItems = items.slice((page - 1) * 24, page * 24);
  const initialFilters = catalogFilterValues(query);
  const facetNames = listingFacetNames(items);
  const listingItems = items.map((product) => productForListing(product, facetNames));
  const content = contentForCategory(slug, cat.title);
  const seoParagraphs = cat.seoText
    ? cat.seoText.split(/\n\s*\n/u).map((paragraph) => paragraph.trim()).filter(Boolean)
    : content.seoText;
  const subcategories = getSubcategoriesForCategory(slug);
  const brands = Array.from(new Set(items.map((p) => p.brand))).filter((b) => b && b !== "—");

  const stocked = items.filter((p) => p.stock > 0).length;
  const onSale = items.filter((p) => p.discountPct).length;
  const totalSku = items.reduce((a, p) => a + p.variants.length, 0);

  const SITE = absoluteUrl("");
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: cat.title, item: `${SITE}/c/${cat.slug}` },
    ],
  };
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: cat.h1 || content.h1,
    description: cat.metaDescription || content.metaDescription,
    url: absoluteUrl(hasCatalogFilters(query) ? `/c/${cat.slug}` : catalogPageHref(`/c/${cat.slug}`, page)),
    inLanguage: "ru-RU",
    isPartOf: { "@id": `${SITE}/#website` },
    about: { "@type": "Thing", name: cat.title },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: pageItems.slice(0, 20).map((p, i) => ({
        "@type": "ListItem",
        position: (page - 1) * 24 + i + 1,
        url: absoluteUrl(`/p/${p.slug}`),
        name: p.title,
      })),
    },
  };
  const faqLd = content.faq.length ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  } : null;

  return (
    <>
      <StructuredData data={breadcrumbLd} />
      <StructuredData data={collectionLd} />
      <StructuredData data={faqLd} />
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-steel-200 bg-steel-900 text-white">
          <div className="absolute inset-0 -z-10 bg-blueprint-dark opacity-40" />
          <div className="pointer-events-none absolute -right-16 -top-10 -z-10 hidden w-[640px] opacity-[0.10] mix-blend-screen sm:block">
            <div className="aspect-square">
              <CategoryArt icon={cat.icon} className="h-full w-full" />
            </div>
          </div>
          <div className="absolute -right-32 -top-32 -z-10 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.55),_transparent_60%)]" />
          <div className="absolute -bottom-40 -left-32 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.18),_transparent_60%)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
          <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[180px] bg-blueprint-dark bg-blueprint-anim opacity-60" style={{ maskImage: "linear-gradient(to bottom, black, transparent)", WebkitMaskImage: "linear-gradient(to bottom, black, transparent)" }} />

          <div className="relative z-10 mx-auto max-w-[1280px] px-4 pb-5 pt-4 sm:px-6 sm:pb-12 sm:pt-7 lg:pb-20 lg:pt-12">
            <div className="text-steel-300">
              <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Каталог", href: "/" }, { label: cat.title }]} />
            </div>
            <div className="mt-3 max-w-[920px] sm:mt-5">
              <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-amber-300 sm:text-[11px] sm:tracking-[0.22em]">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_0_3px_rgba(245,158,11,0.25)]" />
                Каталог 7TOOL
              </div>
              <h1 className="font-display text-[24px] font-black leading-[1.1] tracking-tight text-white sm:mt-4 sm:text-[40px] sm:leading-[1] lg:text-[64px]">
                <span className="bg-gradient-to-br from-white via-white to-amber-200 bg-clip-text text-transparent drop-shadow-[0_2px_6px_rgba(245,158,11,0.18)]">
                  {cat.h1 || content.h1}
                </span>
              </h1>
              <div className="mt-7 hidden flex-wrap items-center gap-2.5 text-[13px] sm:flex">
                <Stat value={totalSku.toLocaleString("ru-RU")} label="артикулов" />
                <Stat value={items.length.toLocaleString("ru-RU")} label="моделей" />
                <Stat value={String(stocked)} label="в наличии" tone="emerald" />
                {onSale > 0 && <Stat value={String(onSale)} label="со скидкой" tone="amber" />}
                {brands.length > 0 && <Stat value={String(brands.length)} label={brands.length === 1 ? "бренд" : "бренда"} />}
              </div>
              <p className="mt-4 max-w-[760px] text-[13.5px] leading-relaxed text-steel-200 sm:text-[15px]">
                {cat.intro || content.intro}
              </p>

              <div className="hidden sm:block">
                <QuickChips items={items} slug={cat.slug} />
              </div>
            </div>
          </div>
        </section>

        <SubcategoryGrid categorySlug={slug} categoryTitle={cat.title} totalCount={items.length} items={subcategories} />
        <CategoryFilters items={listingItems} brands={brands} initialPage={page} initialFilters={initialFilters} basePath={`/c/${slug}`} />
        <CategorySelectionForm
          category={slug}
          categoryTitle={cat.title}
          fields={content.selectionFields}
          heading={content.selectionTitle}
        />
        <SemanticNextSteps links={semanticLinks} />
        <section className="border-t border-steel-200 bg-white">
          <div className="mx-auto max-w-[980px] px-4 py-10 sm:px-6 sm:py-14">
            <h2 className="font-display text-[24px] font-extrabold tracking-tight text-steel-900">{content.seoTitle}</h2>
            <div className="mt-4 space-y-3 text-[14px] leading-7 text-steel-700">
              {seoParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
            <div className="mt-6 grid gap-3 rounded-[12px] border border-steel-200 bg-steel-50/60 p-4 text-[13px] text-steel-700 sm:grid-cols-3">
              <span><strong className="text-steel-900">Оплата:</strong> счёт с НДС</span>
              <span><strong className="text-steel-900">Поставка:</strong> по России</span>
              <span><strong className="text-steel-900">Подбор:</strong> по параметрам задачи</span>
            </div>
            {content.faq.length > 0 && (
              <div className="mt-10 border-t border-steel-200 pt-8">
                <h2 className="font-display text-[22px] font-extrabold tracking-tight text-steel-900">
                  Вопросы о выборе оборудования
                </h2>
                <div className="mt-4 divide-y divide-steel-200 rounded-[12px] border border-steel-200 bg-white px-4 sm:px-6">
                  {content.faq.map((item) => (
                    <details key={item.question} className="group py-4">
                      <summary className="cursor-pointer list-none pr-8 text-[14px] font-bold text-steel-900 marker:content-none">
                        {item.question}
                      </summary>
                      <p className="mt-3 max-w-[820px] text-[14px] leading-7 text-steel-700">{item.answer}</p>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
        <WarehouseStrip count={4} eyebrow={`Склад · ${cat.title}`} />
      </main>
      <SiteFooter />
    </>
  );
}

function Stat({ value, label, tone = "neutral" }: { value: string; label: string; tone?: "neutral" | "emerald" | "amber" }) {
  const cls =
    tone === "emerald" ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
    : tone === "amber" ? "border-amber-400/50 bg-amber-400/15 text-amber-300"
    : "border-white/10 bg-white/5 text-steel-200";
  return (
    <span className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 ${cls}`}>
      <span className="font-display text-[15px] font-extrabold tracking-tight text-white">{value}</span>
      <span className="text-[11.5px] uppercase tracking-wider">{label}</span>
    </span>
  );
}
