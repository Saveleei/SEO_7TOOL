import type { Category, Product, Variant } from "@/lib/catalog";
import { getProductAvailability, isValidPrice, variantSlug } from "@/lib/catalog";
import { absoluteUrl, company, manager, SITE_URL } from "@/lib/site-config";
import { buildProductGroupSeo, buildProductSeo } from "@/lib/product-seo";

export function ProductJsonLd({
  product,
  variant,
  category,
}: {
  product: Product;
  variant?: Variant;
  category?: Pick<Category, "slug" | "title">;
}) {
  const selected = variant
    ?? product.variants.find((item) => item.available && (item.quantity ?? 0) > 0)
    ?? product.variants.find((item) => item.available)
    ?? product.variants[0];
  if (!selected) return null;

  const groupUrl = absoluteUrl(`/p/${product.slug}`);
  const pageUrl = variant ? absoluteUrl(`/p/${variantSlug(product, variant)}`) : groupUrl;
  const seller = {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "7TOOL",
    url: SITE_URL,
    telephone: manager.phone,
    email: company.email,
  };

  const entity = variant || (!product.isGroup && product.variants.length === 1)
    ? productEntity(product, selected, category?.title, seller, {
        context: true,
        isVariant: Boolean(variant || product.isGroup),
        groupUrl,
      })
    : productGroupEntity(product, category?.title, seller, groupUrl);

  const currentSeo = variant
    ? buildProductSeo(product, variant, category?.title)
    : buildProductGroupSeo(product, category?.title);
  const breadcrumbItems = [
    { name: "Главная", url: absoluteUrl("/") },
    ...(category ? [{ name: category.title, url: absoluteUrl(`/c/${category.slug}`) }] : []),
    { name: currentSeo.name, url: pageUrl },
  ];
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(entity) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(breadcrumb) }} />
    </>
  );
}

function productGroupEntity(
  product: Product,
  categoryTitle: string | undefined,
  seller: Record<string, unknown>,
  groupUrl: string,
) {
  const seo = buildProductGroupSeo(product, categoryTitle);
  const availability = getProductAvailability(product);
  const priced = product.variants.filter((item) => item.available && isValidPrice(item.price));
  const aggregateOffer = priced.length && availability.minPrice != null ? {
    "@type": "AggregateOffer",
    url: groupUrl,
    priceCurrency: "RUB",
    lowPrice: availability.minPrice,
    highPrice: availability.maxPrice ?? availability.minPrice,
    offerCount: priced.length,
    availability: availabilityUrl(availability.status === "in_stock" || availability.status === "partial", priced.length > 0),
    seller,
  } : undefined;
  const images = Array.from(new Set([
    ...(product.images ?? []),
    ...product.variants.flatMap((item) => item.images ?? []),
  ])).map(absoluteUrl).slice(0, 8);
  const variesBy = Array.from(new Set(product.paramAxes.map(axisProperty))).filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    "@id": `${groupUrl}#product-group`,
    url: groupUrl,
    name: seo.name,
    description: product.metaDescription || seo.description,
    productGroupID: product.id,
    sku: product.sku || undefined,
    brand: product.brand && product.brand !== "—" ? { "@type": "Brand", name: product.brand } : undefined,
    category: categoryTitle,
    image: images.length ? images : undefined,
    variesBy: variesBy.length ? variesBy : undefined,
    hasVariant: product.variants.map((item) => productEntity(product, item, categoryTitle, seller, {
      context: false,
      isVariant: false,
      groupUrl,
    })),
    offers: aggregateOffer,
  };
}

function productEntity(
  product: Product,
  variant: Variant,
  categoryTitle: string | undefined,
  seller: Record<string, unknown>,
  options: { context: boolean; isVariant: boolean; groupUrl: string },
) {
  const seo = buildProductSeo(product, variant, categoryTitle);
  const url = absoluteUrl(`/p/${variantSlug(product, variant)}`);
  const images = (variant.images?.length ? variant.images : product.images ?? []).map(absoluteUrl).slice(0, 6);
  const offer = isValidPrice(variant.price) ? {
    "@type": "Offer",
    url,
    priceCurrency: "RUB",
    price: variant.price,
    availability: variantAvailability(variant),
    itemCondition: "https://schema.org/NewCondition",
    sku: variant.sku,
    seller,
  } : undefined;

  return {
    ...(options.context ? { "@context": "https://schema.org" } : {}),
    "@type": "Product",
    "@id": `${url}#product`,
    url,
    name: seo.name,
    description: seo.description,
    sku: variant.sku,
    mpn: variant.sku,
    ...gtin(variant.barcode),
    image: images.length ? images : undefined,
    brand: product.brand && product.brand !== "—" ? { "@type": "Brand", name: product.brand } : undefined,
    category: categoryTitle,
    additionalProperty: seo.params.map((param) => ({
      "@type": "PropertyValue",
      name: param.name,
      value: `${param.value}${param.unit ? ` ${param.unit}` : ""}`,
    })),
    ...(options.isVariant ? {
      isVariantOf: {
        "@type": "ProductGroup",
        "@id": `${options.groupUrl}#product-group`,
        name: product.title,
        productGroupID: product.id,
      },
    } : {}),
    offers: offer,
  };
}

function variantAvailability(variant: Variant): string {
  if (variant.available && (variant.quantity ?? 0) > 0) return "https://schema.org/InStock";
  if (variant.available) return "https://schema.org/PreOrder";
  return "https://schema.org/OutOfStock";
}

function availabilityUrl(inStock: boolean, orderable: boolean): string {
  if (inStock) return "https://schema.org/InStock";
  if (orderable) return "https://schema.org/PreOrder";
  return "https://schema.org/OutOfStock";
}

function axisProperty(axis: string): string {
  const value = axis.toLocaleLowerCase("ru");
  if (/цвет|окраск/.test(value)) return "https://schema.org/color";
  if (/материал/.test(value)) return "https://schema.org/material";
  if (/размер|диаметр|длина|ширина|высота|резьб/.test(value)) return "https://schema.org/size";
  return "https://schema.org/additionalProperty";
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function gtin(barcode?: string): Record<string, string> {
  const digits = barcode?.replace(/\D/g, "") ?? "";
  if (digits.length === 8) return { gtin8: digits };
  if (digits.length === 12) return { gtin12: digits };
  if (digits.length === 13) return { gtin13: digits };
  if (digits.length === 14) return { gtin14: digits };
  return {};
}
