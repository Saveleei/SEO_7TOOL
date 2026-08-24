import { db } from "./db";
import { getPublicProductEnrichment } from "./product-enrichment.mjs";

export type ProductEnrichmentItem = {
  id: string;
  label: string;
  body: string;
  relatedProduct: { id: string; title: string; href: string } | null;
};

export type ProductEnrichmentSection = {
  type:
    | "SUITABLE_TASK"
    | "NOT_SUITABLE_TASK"
    | "ADVANTAGE"
    | "BEFORE_BUYING"
    | "COMPATIBLE_ACCESSORY"
    | "ANALOG"
    | "DIFFERENCE";
  items: ProductEnrichmentItem[];
};

export type PublicProductEnrichment = {
  id: string;
  version: number;
  productId: string;
  sections: ProductEnrichmentSection[];
  faq: Array<{ id: string; question: string; answer: string }>;
  articles: Array<{ slug: string; title: string; excerpt: string; href: string }>;
  reviewedBy: string;
  publishedAt: number;
};

export function getProductEnrichment(productId: string): PublicProductEnrichment | undefined {
  return (getPublicProductEnrichment(db(), productId) as PublicProductEnrichment | null) ?? undefined;
}
