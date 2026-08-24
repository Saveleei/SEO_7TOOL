import { db } from "./db";
import { validateArticleContent } from "./content-platform.mjs";

export type ArticleTextEntry = { text: string; sourceRefs: string[] };
export type ArticleBlock =
  | { type: "paragraph"; text: string; sourceRefs: string[] }
  | { type: "note"; text: string; sourceRefs: string[] }
  | { type: "list"; items: string[]; sourceRefs: string[] }
  | { type: "table"; caption: string; columns: string[]; rows: string[][]; sourceRefs: string[] };
export type ArticleContent = {
  shortAnswer: ArticleTextEntry[];
  sections: Array<{ heading: string; blocks: ArticleBlock[] }>;
  faq: Array<{ question: string; answer: string; sourceRef: string }>;
  internalLinks: Array<{ targetPath: string; anchorText: string; role: "CONTEXT" | "PRODUCT" | "RELATED" | "CTA" }>;
};

export type PublishedArticleSummary = {
  id: string;
  slug: string;
  title: string;
  h1: string;
  excerpt: string;
  categorySlug: string;
  categoryTitle: string;
  intent: string;
  author: string;
  expertReviewer: string;
  publishedAt: number;
  updatedAt: number;
  readingMinutes: number;
};

export type PublishedArticle = PublishedArticleSummary & {
  metaTitle: string;
  metaDescription: string;
  canonical: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  content: ArticleContent;
  qualityScore: number;
  evidenceScore: number;
  differentiationScore: number;
  businessScore: number;
  targetProducts: Array<{ id: string; slug: string; title: string; brand: string | null }>;
  relatedArticles: Array<{ slug: string; title: string; excerpt: string }>;
  images: [];
  sources: Array<{ sourceRef: string; claimText: string }>;
  faq: ArticleContent["faq"];
  leadFormType: string | null;
  generatedByAi: boolean;
  humanReviewed: true;
};

type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  h1: string;
  meta_title: string;
  meta_description: string;
  excerpt: string;
  category_slug: string;
  category_title: string;
  intent_label: string;
  author: string;
  expert_reviewer: string;
  canonical: string;
  primary_keyword: string;
  quality_score: number;
  evidence_score: number;
  differentiation_score: number;
  business_score: number;
  lead_form_type: string | null;
  generated_by_ai: number;
  human_reviewed: 1;
  content_body: string;
  published_at: number;
  updated_at: number;
};

function hasContentPlatformSchema() {
  const rows = db().prepare(`
    SELECT name FROM sqlite_schema
    WHERE type = 'table' AND name IN ('content_assets', 'content_revisions', 'article_briefs')
  `).all() as Array<{ name: string }>;
  return rows.length === 3;
}

function parseArticleContent(value: string): ArticleContent | null {
  try {
    return validateArticleContent(JSON.parse(value)) as ArticleContent;
  } catch {
    return null;
  }
}

function readingMinutes(contentBody: string) {
  try {
    const words = JSON.stringify(JSON.parse(contentBody)).replace(/[^a-zа-яё0-9]+/giu, " ").trim().split(/\s+/u).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 180));
  } catch {
    return 1;
  }
}

function summaryFromRow(row: ArticleRow): PublishedArticleSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    h1: row.h1,
    excerpt: row.excerpt,
    categorySlug: row.category_slug,
    categoryTitle: row.category_title,
    intent: row.intent_label,
    author: row.author,
    expertReviewer: row.expert_reviewer,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    readingMinutes: readingMinutes(row.content_body),
  };
}

const publicArticleSelect = `
  SELECT a.id, a.slug, a.title, a.h1, a.meta_title, a.meta_description, a.excerpt,
    a.category_slug, c.title AS category_title, i.label AS intent_label, a.author,
    a.expert_reviewer, a.canonical, a.primary_keyword, a.quality_score, a.evidence_score,
    a.differentiation_score, a.business_score, a.lead_form_type, a.generated_by_ai,
    a.human_reviewed, r.content_body, a.published_at, a.updated_at
  FROM content_assets a
  JOIN content_revisions r ON r.id = a.current_revision_id
  JOIN categories c ON c.slug = a.category_slug
  JOIN search_intents i ON i.id = a.intent_id
  WHERE a.status = 'PUBLISHED' AND a.index_status = 'INDEX' AND a.human_reviewed = 1
`;

export function listPublishedArticles(limit = 100): PublishedArticleSummary[] {
  if (!hasContentPlatformSchema()) return [];
  const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
  const rows = db().prepare<unknown[], ArticleRow>(`${publicArticleSelect} ORDER BY a.published_at DESC, a.title LIMIT ?`).all(safeLimit);
  return rows.map(summaryFromRow);
}

export function listPublishedArticleSlugs(): string[] {
  if (!hasContentPlatformSchema()) return [];
  return (db().prepare(`
    SELECT slug FROM content_assets
    WHERE status = 'PUBLISHED' AND index_status = 'INDEX' AND human_reviewed = 1
    ORDER BY slug
  `).all() as Array<{ slug: string }>).map((row) => row.slug);
}

export function getPublishedArticle(slug: string): PublishedArticle | undefined {
  if (!hasContentPlatformSchema()) return undefined;
  const row = db().prepare<unknown[], ArticleRow>(`${publicArticleSelect} AND a.slug = ? LIMIT 1`).get(slug);
  if (!row) return undefined;
  const content = parseArticleContent(row.content_body);
  if (!content) return undefined;
  const secondaryKeywords = (db().prepare(`
    SELECT k.query FROM content_secondary_keywords ck
    JOIN seo_keywords k ON k.id = ck.keyword_id
    WHERE ck.content_asset_id = ? ORDER BY COALESCE(k.exact_frequency, k.frequency, 0) DESC, k.query
  `).all(row.id) as Array<{ query: string }>).map((item) => item.query);
  const targetProducts = db().prepare(`
    SELECT p.id, p.slug, p.title, p.brand FROM content_products cp
    JOIN products p ON p.id = cp.product_id
    WHERE cp.content_asset_id = ? AND cp.relation_type = 'TARGET' AND p.draft = 0
    ORDER BY cp.sort_order, p.title
  `).all(row.id) as PublishedArticle["targetProducts"];
  const relatedArticles = db().prepare(`
    SELECT related.slug, related.title, related.excerpt FROM content_related cr
    JOIN content_assets related ON related.id = cr.related_content_asset_id
    WHERE cr.content_asset_id = ? AND related.status = 'PUBLISHED'
      AND related.index_status = 'INDEX' AND related.human_reviewed = 1
    ORDER BY cr.sort_order, related.title
  `).all(row.id) as PublishedArticle["relatedArticles"];
  const sources = db().prepare(`
    SELECT source_ref AS sourceRef, claim_text AS claimText FROM content_sources
    WHERE content_asset_id = ? AND evidence_status = 'VERIFIED'
    ORDER BY source_ref, claim_text
  `).all(row.id) as PublishedArticle["sources"];
  return {
    ...summaryFromRow(row),
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    canonical: row.canonical,
    primaryKeyword: row.primary_keyword,
    secondaryKeywords,
    content,
    qualityScore: row.quality_score,
    evidenceScore: row.evidence_score,
    differentiationScore: row.differentiation_score,
    businessScore: row.business_score,
    targetProducts,
    relatedArticles,
    images: [],
    sources,
    faq: content.faq,
    leadFormType: row.lead_form_type,
    generatedByAi: row.generated_by_ai === 1,
    humanReviewed: true,
  };
}
