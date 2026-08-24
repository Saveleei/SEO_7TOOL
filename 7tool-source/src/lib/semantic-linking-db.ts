import { db } from "./db";
import { getPublicSemanticLinks } from "./semantic-linking.mjs";

export type SemanticLinkSourceType = "ARTICLE" | "PRODUCT" | "CATEGORY" | "CALCULATOR" | "COMPARISON";

export type PublicSemanticLink = {
  id: string;
  relationType:
    | "ARTICLE_TO_CATEGORY"
    | "ARTICLE_TO_PRODUCT"
    | "ARTICLE_TO_ARTICLE"
    | "PRODUCT_TO_ARTICLE"
    | "PRODUCT_TO_COMPATIBILITY"
    | "CATEGORY_TO_GUIDE"
    | "CALCULATOR_TO_PRODUCT"
    | "COMPARISON_TO_PRODUCT";
  targetType: "ARTICLE" | "PRODUCT" | "CATEGORY" | "GUIDE" | "COMPATIBILITY";
  targetId: string;
  href: string;
  anchorText: string;
  nextQuestion: string;
  journeyStageFrom: string;
  journeyStageTo: string;
};

export type PublicSemanticLinkSet = {
  id: string;
  version: number;
  sourceType: SemanticLinkSourceType;
  sourceId: string;
  reviewedBy: string;
  publishedAt: number;
  items: PublicSemanticLink[];
};

export function getSemanticLinks(sourceType: SemanticLinkSourceType, sourceId: string): PublicSemanticLinkSet | undefined {
  return (getPublicSemanticLinks(db(), sourceType, sourceId) as PublicSemanticLinkSet | null) ?? undefined;
}
