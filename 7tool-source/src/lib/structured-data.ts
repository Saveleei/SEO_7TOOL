import {
  buildArticleStructuredData as buildArticle,
  buildBreadcrumbList as buildBreadcrumbs,
  buildOrganizationStructuredData as buildOrganization,
  buildProductStructuredData as buildProduct,
  buildVideoObjectStructuredData as buildVideo,
  buildWebsiteStructuredData as buildWebsite,
  safeJsonLd as serializeJsonLd,
} from "./structured-data.mjs";

export type StructuredDataNode = Record<string, unknown>;
export type BreadcrumbItem = { name: string; url: string };

export type ProductStructuredDataInput = {
  sellerId?: string;
  isGroup?: boolean;
  selectedVariantId?: string;
  group: {
    id: string; url: string; name: string; description?: string; sku?: string;
    brand?: string; category?: string; images?: string[]; variesBy?: string[];
  };
  variants: Array<{
    id: string; url: string; name: string; description?: string; sku?: string; mpn?: string;
    gtin?: string; images?: string[]; brand?: string; category?: string;
    additionalProperty?: Array<{ name: string; value: string }>;
    offer?: {
      url?: string; price?: number; priceCurrency?: string; availability?: string;
      itemCondition?: string; sku?: string;
      shippingDetails?: {
        verified: boolean; addressCountry: string; shippingRate: number; priceCurrency: string;
        handlingMinimumDays?: number; handlingMaximumDays?: number;
        transitMinimumDays?: number; transitMaximumDays?: number;
      };
      returnPolicy?: {
        verified: boolean; applicableCountry: string; returnPolicyCategory: string;
        merchantReturnDays?: number; returnMethod?: string; returnFees?: string;
      };
    };
  }>;
};

export type ArticleStructuredDataInput = {
  url: string; headline: string; description?: string; images?: string[];
  datePublished?: string | number | Date; dateModified?: string | number | Date;
  author?: string; reviewer?: string; publisherId?: string; websiteId?: string;
  inLanguage?: string; articleSection?: string; keywords?: string[];
};

export function safeJsonLd(value: unknown): string {
  return serializeJsonLd(value) as string;
}

export function buildBreadcrumbList(items: BreadcrumbItem[], id?: string): StructuredDataNode | null {
  return buildBreadcrumbs(items, id) as StructuredDataNode | null;
}

export function buildProductStructuredData(input: ProductStructuredDataInput): StructuredDataNode | null {
  return buildProduct(input) as StructuredDataNode | null;
}

export function buildArticleStructuredData(input: ArticleStructuredDataInput): StructuredDataNode | null {
  return buildArticle(input) as StructuredDataNode | null;
}

export function buildOrganizationStructuredData(input: Record<string, unknown>): StructuredDataNode | null {
  return buildOrganization(input) as StructuredDataNode | null;
}

export function buildWebsiteStructuredData(input: Record<string, unknown>): StructuredDataNode | null {
  return buildWebsite(input) as StructuredDataNode | null;
}

export function buildVideoObjectStructuredData(input: Record<string, unknown>): StructuredDataNode | null {
  return buildVideo(input) as StructuredDataNode | null;
}
