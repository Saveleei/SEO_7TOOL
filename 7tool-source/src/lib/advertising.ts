import type { Product, Variant } from "./catalog";
import type { EcommerceProduct } from "./analytics";

const OFFER_NAMESPACE = "k2-";

/** Stable external id shared by YML, Ecommerce, cart and lead attribution. */
export function advertisingOfferId(variantId: string): string {
  const clean = variantId.trim().replace(/[^A-Za-z0-9_.:-]/g, "-").slice(0, 96);
  if (!clean) throw new Error("EMPTY_ADVERTISING_VARIANT_ID");
  return `${OFFER_NAMESPACE}${clean}`;
}

export function advertisingVariantUrl(product: Pick<Product, "slug">, variant: Pick<Variant, "id">): string {
  return `/p/${product.slug}?variant=${encodeURIComponent(variant.id)}`;
}

export function ecommerceProduct(
  product: Pick<Product, "title" | "brand" | "category">,
  variant: Pick<Variant, "id" | "sku" | "name" | "price">,
  list?: string,
  quantity?: number,
): EcommerceProduct {
  return {
    id: advertisingOfferId(variant.id),
    name: variant.name?.trim() || product.title,
    brand: product.brand,
    category: product.category,
    price: variant.price,
    quantity,
    variant: variant.sku || variant.id,
    list,
  };
}
