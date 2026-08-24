import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { categoryBySlug } from "@/lib/data";
import { getSubcategory, getSubcategoriesForCategory, publishedSubcategories } from "@/lib/subcategories";
import { absoluteUrl } from "@/lib/site-config";
import { contentForCategory } from "@/lib/category-content";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SubcategoryGrid } from "@/components/SubcategoryGrid";
import { CategorySelectionForm } from "@/components/CategorySelectionForm";
import { StructuredData } from "@/components/StructuredData";
import { CategoryFilters } from "../CategoryFilters";
import { listingFacetNames, productForListing } from "@/lib/catalog";
import { indexableRobots, noIndexRobots, pageTitle } from "@/lib/seo-metadata";
import { catalogFacetDecision, catalogFilterValues, catalogPageHref, catalogPageNumber, hasCatalogFilters, type CatalogQuery } from "@/lib/catalog-query";
import { categorySocialPreviewPath, socialPreviewImage } from "@/lib/social-preview";

// Subcategory pages use the same safe fallback behaviour as their parent
// category so a runtime cache eviction cannot become a false 404.
export const dynamicParams = true;

export function generateStaticParams() {
  return publishedSubcategories().map((item) => ({ slug: item.categorySlug, subslug: item.slug }));
}

type RouteProps = {
  params: Promise<{ slug: string; subslug: string }>;
  searchParams: Promise<CatalogQuery>;
};

export async function generateMetadata({
  params,
  searchParams,
}: RouteProps): Promise<Metadata> {
  const [{ slug, subslug }, query] = await Promise.all([params, searchParams]);
  const subcategory = getSubcategory(slug, subslug);
  if (!subcategory) return {};
  const page = catalogPageNumber(query);
  const maxPage = Math.max(1, Math.ceil(subcategory.items.length / 24));
  if (!page || page > maxPage) return { title: "Страница не найдена", robots: noIndexRobots };
  const filtered = catalogFacetDecision(query).hasFacets;
  const parentCategory = categoryBySlug(slug);
  const fallbackProductImage = subcategory.items
    .find((product) => product.images?.[0])?.images?.[0];
  const image = socialPreviewImage(
    categorySocialPreviewPath(slug, subcategory.image, fallbackProductImage, parentCategory?.coverImage),
    subcategory.imageAlt || subcategory.h1 || subcategory.title,
  );
  return {
    title: pageTitle(page > 1 && !filtered ? `${subcategory.metaTitle} — страница ${page}` : subcategory.metaTitle),
    description: page > 1 && !filtered ? `${subcategory.metaDescription} Страница ${page}.` : subcategory.metaDescription,
    keywords: [
      subcategory.title.toLocaleLowerCase("ru"),
      `${subcategory.title.toLocaleLowerCase("ru")} купить`,
    ],
    alternates: { canonical: filtered ? `/c/${slug}/${subslug}` : catalogPageHref(`/c/${slug}/${subslug}`, page) },
    robots: filtered ? noIndexRobots : indexableRobots,
    openGraph: {
      type: "website",
      title: subcategory.metaTitle,
      description: subcategory.metaDescription,
      url: absoluteUrl(filtered ? `/c/${slug}/${subslug}` : catalogPageHref(`/c/${slug}/${subslug}`, page)),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: subcategory.metaTitle,
      description: subcategory.metaDescription,
      images: [image.url],
    },
  };
}

export default async function SubcategoryPage({
  params,
  searchParams,
}: RouteProps) {
  const [{ slug, subslug }, query] = await Promise.all([params, searchParams]);
  const category = categoryBySlug(slug);
  const subcategory = getSubcategory(slug, subslug);
  if (!category || !subcategory) notFound();
  const page = catalogPageNumber(query);
  const maxPage = Math.max(1, Math.ceil(subcategory.items.length / 24));
  if (!page || page > maxPage) notFound();
  const pageItems = subcategory.items.slice((page - 1) * 24, page * 24);
  const initialFilters = catalogFilterValues(query);

  const siblings = getSubcategoriesForCategory(slug);
  const brands = Array.from(new Set(subcategory.items.map((product) => product.brand))).filter(Boolean);
  const content = contentForCategory(slug, category.title);
  const facetNames = listingFacetNames(subcategory.items);
  const listingItems = subcategory.items.map((product) => productForListing(product, facetNames));
  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: subcategory.h1 || subcategory.title,
    description: subcategory.metaDescription,
    url: absoluteUrl(hasCatalogFilters(query) ? `/c/${slug}/${subslug}` : catalogPageHref(`/c/${slug}/${subslug}`, page)),
    inLanguage: "ru-RU",
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: category.title, item: absoluteUrl(`/c/${slug}`) },
        { "@type": "ListItem", position: 3, name: subcategory.title, item: absoluteUrl(`/c/${slug}/${subslug}`) },
      ],
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: subcategory.count,
      itemListElement: pageItems.slice(0, 20).map((product, index) => ({
        "@type": "ListItem",
        position: (page - 1) * 24 + index + 1,
        name: product.title,
        url: absoluteUrl(`/p/${product.slug}`),
      })),
    },
  };

  return (
    <>
      <StructuredData data={ld} />
      <SiteHeader />
      <main>
        <header className="border-b border-steel-200 bg-steel-900 text-white">
          <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 sm:py-12">
            <div className="text-steel-300">
              <Breadcrumbs items={[
                { label: "Главная", href: "/" },
                { label: category.title, href: `/c/${slug}` },
                { label: subcategory.title },
              ]} />
            </div>
            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300">{category.title}</p>
            <h1 className="mt-2 max-w-[900px] font-display text-[30px] font-black leading-tight tracking-tight sm:text-[46px]">{subcategory.h1 || subcategory.title}</h1>
            <p className="mt-4 max-w-[760px] text-[14px] leading-7 text-steel-200">{subcategory.intro}</p>
            <p className="mt-3 text-[13px] text-steel-300">{subcategory.count.toLocaleString("ru-RU")} товаров в подборке</p>
          </div>
        </header>
        <SubcategoryGrid
          categorySlug={slug}
          categoryTitle={category.title}
          totalCount={category.count}
          items={siblings}
          activeSlug={subslug}
        />
        <CategoryFilters items={listingItems} brands={brands} initialPage={page} initialFilters={initialFilters} basePath={`/c/${slug}/${subslug}`} />
        <CategorySelectionForm
          category={slug}
          categoryTitle={category.title}
          fields={content.selectionFields}
          heading={content.selectionTitle}
          subcategory={subcategory.title}
        />
        <section className="border-t border-steel-200 bg-white">
          <div className="mx-auto max-w-[980px] px-4 py-10 sm:px-6 sm:py-14">
            <h2 className="font-display text-[24px] font-extrabold text-steel-900">О подборке</h2>
            <p className="mt-4 text-[14px] leading-7 text-steel-700">{subcategory.seoText}</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
