import type { Category, Product, Variant } from "@/lib/catalog";
import { isValidPrice, variantSlug } from "@/lib/catalog";
import { absoluteUrl, SITE_URL } from "@/lib/site-config";
import { buildProductGroupSeo, buildProductSeo } from "@/lib/product-seo";
import { buildBreadcrumbList, buildProductStructuredData } from "@/lib/structured-data";
import { StructuredData } from "./StructuredData";

export function ProductJsonLd({
  product,
  variant,
  category,
}: {
  product: Product;
  variant?: Variant;
  category?: Pick<Category, "slug" | "title">;
}) {
  if (!product.variants.length) return null;

  const groupUrl = absoluteUrl(`/p/${product.slug}`);
  const hasDistinctVariantUrls = product.variants.length > 1;
  const groupSeo = buildProductGroupSeo(product, category?.title);
  const entity = buildProductStructuredData({
    sellerId: `${SITE_URL}/#organization`,
    isGroup: product.isGroup && hasDistinctVariantUrls,
    selectedVariantId: variant?.id,
    group: {
      id: product.id,
      url: groupUrl,
      name: groupSeo.name,
      description: product.metaDescription || groupSeo.description,
      sku: product.sku || undefined,
      brand: knownBrand(product.brand),
      category: category?.title,
      images: Array.from(new Set([
        ...(product.images ?? []),
        ...product.variants.flatMap((item) => item.images ?? []),
      ])).map(absoluteUrl),
      variesBy: Array.from(new Set(product.paramAxes.map(axisProperty))),
    },
    variants: product.variants.map((item) => {
      const seo = buildProductSeo(product, item, category?.title);
      const url = hasDistinctVariantUrls
        ? absoluteUrl(`/p/${variantSlug(product, item)}`)
        : groupUrl;
      return {
        id: item.id,
        url,
        name: seo.name,
        description: seo.description,
        sku: item.sku,
        // The supplier feed has SKU and GTIN, but no separately verified MPN.
        // Never duplicate SKU into mpn merely to fill an optional property.
        gtin: item.barcode,
        images: (item.images?.length ? item.images : product.images ?? []).map(absoluteUrl),
        brand: knownBrand(product.brand),
        category: category?.title,
        additionalProperty: seo.params.map((param) => ({
          name: param.name,
          value: `${param.value}${param.unit ? ` ${param.unit}` : ""}`,
        })),
        offer: isValidPrice(item.price) ? {
          url,
          price: item.price,
          priceCurrency: "RUB",
          availability: variantAvailability(item),
          sku: item.sku,
          // Shipping, returns and itemCondition stay absent until their
          // exact terms are stored as owner-verified commerce data.
        } : undefined,
      };
    }),
  });

  const pageUrl = variant ? absoluteUrl(`/p/${variantSlug(product, variant)}`) : groupUrl;
  const currentSeo = variant ? buildProductSeo(product, variant, category?.title) : groupSeo;
  const breadcrumb = buildBreadcrumbList([
    { name: "Главная", url: absoluteUrl("/") },
    ...(category ? [{ name: category.title, url: absoluteUrl(`/c/${category.slug}`) }] : []),
    { name: currentSeo.name, url: pageUrl },
  ], `${pageUrl}#breadcrumb`);

  return (
    <>
      <StructuredData data={entity} />
      <StructuredData data={breadcrumb} />
    </>
  );
}

function knownBrand(value?: string): string | undefined {
  const brand = value?.trim();
  return brand && brand !== "—" ? brand : undefined;
}

function variantAvailability(variant: Variant): string {
  if (variant.available && (variant.quantity ?? 0) > 0) return "https://schema.org/InStock";
  if (variant.available) return "https://schema.org/PreOrder";
  return "https://schema.org/OutOfStock";
}

function axisProperty(axis: string): string {
  const value = axis.toLocaleLowerCase("ru");
  if (/цвет|окраск/.test(value)) return "https://schema.org/color";
  if (/материал/.test(value)) return "https://schema.org/material";
  if (/размер|диаметр|длина|ширина|высота|резьб/.test(value)) return "https://schema.org/size";
  return "https://schema.org/additionalProperty";
}
