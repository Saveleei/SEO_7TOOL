import {
  getFeedProductVariantById,
  getFeedVariantSpecs,
  getFeedVariantTechnicalSpecs,
  type FeedProductSpec,
} from "./feedCatalog.ts";
import { publicProductPath } from "./publicUrls.ts";

export type QuoteProductPresentation = {
  exactVariant: true;
  variantId: string;
  category: string;
  productHref: string;
  imageUrl?: string;
  imageAlt: string;
  keySpecs: FeedProductSpec[];
  technicalSpecs: FeedProductSpec[];
};

export function getQuoteProductPresentation(itemId: string): QuoteProductPresentation | null {
  const variantId = itemId.startsWith("variant:") ? itemId.slice("variant:".length) : "";
  if (!variantId) return null;
  const match = getFeedProductVariantById(variantId);
  if (!match) return null;
  const { product, variant } = match;
  const imageUrl = variant.images?.find(Boolean) ?? product.images.find(Boolean);

  return {
    exactVariant:true,
    variantId:variant.id,
    category:product.category,
    productHref:publicProductPath(product, variant),
    imageUrl,
    imageAlt:variant.name || product.title,
    keySpecs:getFeedVariantSpecs(product, variant),
    technicalSpecs:getFeedVariantTechnicalSpecs(product, variant),
  };
}
