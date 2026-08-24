import Link from "next/link";
import { notFound } from "next/navigation";
import { variantSlug } from "@/lib/catalog";
import { getPublicCategory } from "@/lib/categories-db";
import { getPublicRelatedProducts, resolvePublicProductSlug } from "@/lib/products-db";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ProductCard } from "@/components/ProductCard";
import { ProductJsonLd } from "@/components/ProductJsonLd";
import { WarehouseStrip } from "@/components/WarehouseProof";
import { ProductView } from "./ProductView";
import { contentForCategory } from "@/lib/category-content";
import { buildProductGroupSeo, buildProductSeo } from "@/lib/product-seo";
import { indexableRobots, noIndexRobots, pageTitle } from "@/lib/seo-metadata";
import { absoluteUrl } from "@/lib/site-config";
import { hasSeoDataConflict } from "@/lib/seo-conflicts";
import { categorySocialPreviewPath, socialPreviewImage } from "@/lib/social-preview";
import { getProductEnrichment } from "@/lib/product-enrichment-db";
import { ProductEnrichment } from "@/components/ProductEnrichment";
import { SemanticNextSteps } from "@/components/SemanticNextSteps";
import { getSemanticLinks } from "@/lib/semantic-linking-db";

export const dynamicParams = true;
// Цена, availability, HTML и JSON-LD должны быть собраны из одной актуальной
// записи SQLite. Клиентский /api/live остаётся страховкой для уже открытой вкладки.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = resolvePublicProductSlug(slug);
  if (!r) return {};
  const selected = r.variant
    ?? r.product.variants.find((item) => item.available && (item.quantity ?? 0) > 0)
    ?? r.product.variants.find((item) => item.available)
    ?? r.product.variants[0];
  if (!selected) return {};
  const category = getPublicCategory(r.product.category);
  const baseImg = categorySocialPreviewPath(
    r.product.category,
    selected.images?.[0],
    r.product.images?.[0],
    category?.coverImage,
  );
  const categoryTitle = category?.title;
  const variantSeo = buildProductSeo(r.product, selected, categoryTitle);
  const groupSeo = buildProductGroupSeo(r.product, categoryTitle);
  // Для общей карточки используем сохранённое предметное SEO. У URL конкретной
  // модификации остаются автоматически рассчитанные заголовки с её артикулом и
  // параметрами, чтобы несколько вариантов не получали одинаковые метаданные.
  const seo = r.variant ? variantSeo : groupSeo;
  const title = !r.variant && r.product.metaTitle ? r.product.metaTitle : seo.title;
  const description = !r.variant && r.product.metaDescription ? r.product.metaDescription : seo.description;
  const socialImage = socialPreviewImage(baseImg, seo.name);
  const canonical = r.variant ? `/p/${variantSlug(r.product, r.variant)}` : `/p/${r.product.slug}`;
  const dataConflict = hasSeoDataConflict(r.product.id);
  return {
    title: pageTitle(title),
    description,
    keywords: seo.keywords,
    alternates: { canonical },
    robots: dataConflict ? noIndexRobots : indexableRobots,
    openGraph: { type: "website", title, description, url: absoluteUrl(canonical), images: [socialImage] },
    twitter: { card: "summary_large_image", title, description, images: [socialImage.url] },
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ variant?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const r = resolvePublicProductSlug(slug);
  if (!r) notFound();
  const { product } = r;
  const selectedVariant = r.variant ?? product.variants.find((item) => item.id === query.variant);
  const dataConflict = hasSeoDataConflict(product.id);
  const cat = getPublicCategory(product.category);
  const categoryContent = contentForCategory(product.category, cat?.title ?? product.category);
  const related = getPublicRelatedProducts(product.category, product.id, 4);
  const enrichment = getProductEnrichment(product.id);
  const semanticLinks = getSemanticLinks("PRODUCT", product.id);
  const selectionEnabled = Boolean(cat && categoryContent.selectionFields.length > 0);

  return (
    <>
      {!dataConflict && <ProductJsonLd product={product} variant={r.variant} category={cat} />}
      <SiteHeader />
      <main>
        <section className="border-b border-steel-100 bg-gradient-to-b from-white via-cobalt-50/20 to-white">
          <div className="mx-auto max-w-[1280px] px-4 pb-10 pt-6 sm:px-6 sm:pb-12 sm:pt-8 lg:pt-10">
            {dataConflict && (
              <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] leading-6 text-amber-950">
                <strong>Характеристики уточняются.</strong> В данных поставщика найдено расхождение; менеджер сверит параметры конкретного артикула до оформления счёта.
              </div>
            )}
            <ProductView
              product={product}
              initialVariantId={selectedVariant?.id}
              categoryTitle={cat?.title}
              categorySlug={cat?.slug}
              selectionTitle={categoryContent.selectionTitle}
              selectionFields={categoryContent.selectionFields}
              hasVerifiedFaq={Boolean(enrichment?.faq.length)}
              hasVerifiedEnrichment={Boolean(enrichment)}
            />
          </div>
        </section>

        <WarehouseStrip count={4} />

        {enrichment && (
          <ProductEnrichment enrichment={enrichment} selectionEnabled={selectionEnabled} />
        )}
        <SemanticNextSteps links={semanticLinks} />

        {related.length > 0 && (
          <section className="bg-gradient-to-b from-cobalt-50/30 via-white to-white py-14">
            <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
              <div className="flex items-end justify-between gap-4">
                <h2 className="font-display text-[24px] font-extrabold text-steel-900 lg:text-[28px]">
                  Похожие позиции
                </h2>
                {cat && (
                  <Link href={`/c/${cat.slug}`} className="text-[14px] font-medium text-amber-700 hover:text-amber-800">
                    Все в категории →
                  </Link>
                )}
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {related.map((rp) => (
                  <ProductCard key={rp.id} p={rp} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
