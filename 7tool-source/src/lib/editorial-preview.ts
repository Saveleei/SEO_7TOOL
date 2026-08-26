import "server-only";

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ArticleContent, PublishedArticle, PublishedArticleImage } from "./articles-db";

type DraftImage = {
  id: string;
  imageType: string;
  localPath: string;
  alt: string;
  caption?: string;
  author?: string;
  license?: string;
  sourcePage?: string;
};

type EditorialDraft = {
  generatedByAi: boolean;
  contentType: PublishedArticle["contentType"];
  slug: string;
  canonical: string;
  categorySlug: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  editorialIdentity: { author: string; expertReviewer: string };
  metadata: {
    title: string;
    h1: string;
    metaTitle: string;
    metaDescription: string;
    excerpt: string;
  };
  sourceRegistry: Array<{ sourceRef: string; name: string; url: string; claimScope: string }>;
  brief: { relevantSupplierImages: DraftImage[] };
  content: ArticleContent;
};

type EditorialApproval = {
  schemaVersion: "EDITORIAL_APPROVAL_V1";
  status: "APPROVED_FOR_PUBLICATION";
  indexStatus: "INDEX";
  slug: string;
  approvedBy: string;
  actorType: "HUMAN";
  approvedAt: string;
  publishedAt: string;
  draftSha256: string;
  mediaManifestSha256: string;
};

const draftsRoot = path.resolve(process.cwd(), "editorial-drafts");

const previewImageLayout: Record<string, {
  slotType: PublishedArticleImage["slotType"];
  sectionHeading: string | null;
  width: number;
  height: number;
}> = {
  "7tool-cutter-in-magnetic-drill": { slotType: "HERO", sectionHeading: null, width: 1080, height: 1080 },
  "7tool-annular-cutter-range": { slotType: "INLINE", sectionHeading: "Сначала зафиксируйте задачу", width: 1080, height: 810 },
  "commons-hss-tct-comparison": { slotType: "COMPARISON", sectionHeading: "HSS или TCT: как сравнивать материал режущей части", width: 640, height: 480 },
  "7tool-cutter-with-chips": { slotType: "INLINE", sectionHeading: "Направляющий штифт, СОЖ и режим работы", width: 1080, height: 1080 },
  "7tool-series-of-holes": { slotType: "INLINE", sectionHeading: "Ограничения применения", width: 1080, height: 1080 },
  "7tool-hole-and-core": { slotType: "INLINE", sectionHeading: "Типовые ошибки и проверки перед заказом", width: 1080, height: 1350 },
  "feed-magnetic-drill-lenz-steyr-35": { slotType: "INLINE", sectionHeading: "Как проверить хвостовик и совместимость со станком", width: 745, height: 1200 },
  "feed-magnetic-drill-bds-mabasic-200": { slotType: "INLINE", sectionHeading: "Как проверить хвостовик и совместимость со станком", width: 679, height: 898 },
  "feed-magnetic-drill-heden-dm-36k": { slotType: "INLINE", sectionHeading: "Как проверить хвостовик и совместимость со станком", width: 639, height: 1200 },
};

function draftImages(images: DraftImage[]): PublishedArticleImage[] {
  return images.flatMap((image) => {
    const layout = previewImageLayout[image.id];
    if (!layout) return [];
    const externalAttribution = image.imageType === "LICENSED_EXTERNAL"
      ? [image.author, image.license, image.sourcePage].filter(Boolean).join(" · ")
      : null;
    return [{
      id: image.id,
      slotType: layout.slotType,
      sectionHeading: layout.sectionHeading,
      alt: image.alt,
      caption: image.caption ?? null,
      attribution: externalAttribution,
      disclosure: null,
      aiGenerated: false,
      variants: [{
        url: image.localPath,
        width: layout.width,
        height: layout.height,
        mime: image.localPath.toLowerCase().endsWith(".png") ? "image/png" as const : "image/jpeg" as const,
      }],
    }];
  });
}

function sha256(filePath: string) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

function readEditorialFiles(slug: string) {
  if (!/^[a-z0-9-]+$/u.test(slug)) return undefined;

  const draftPath = path.resolve(draftsRoot, slug, "draft.json");
  const manifestPath = path.resolve(draftsRoot, slug, "media-manifest.json");
  const approvalPath = path.resolve(draftsRoot, slug, "approval.json");
  if (!draftPath.startsWith(`${draftsRoot}${path.sep}`) || !fs.existsSync(draftPath)) return undefined;

  try {
    const draft = JSON.parse(fs.readFileSync(draftPath, "utf8")) as EditorialDraft;
    if (draft.slug !== slug) return undefined;
    const approval = fs.existsSync(approvalPath)
      ? JSON.parse(fs.readFileSync(approvalPath, "utf8")) as EditorialApproval
      : null;
    const approved = Boolean(
      approval
      && approval.schemaVersion === "EDITORIAL_APPROVAL_V1"
      && approval.status === "APPROVED_FOR_PUBLICATION"
      && approval.indexStatus === "INDEX"
      && approval.actorType === "HUMAN"
      && approval.slug === slug
      && approval.approvedBy === draft.editorialIdentity.expertReviewer
      && fs.existsSync(manifestPath)
      && approval.draftSha256 === sha256(draftPath)
      && approval.mediaManifestSha256 === sha256(manifestPath),
    );
    return { draft, approval, approved };
  } catch {
    return undefined;
  }
}

function projectEditorialArticle(slug: string, allowDraft: boolean): PublishedArticle | undefined {
  const files = readEditorialFiles(slug);
  if (!files || (!files.approved && !allowDraft)) return undefined;
  try {
    const { draft, approval, approved } = files;
    const publicationDate = approved && approval ? new Date(approval.publishedAt).getTime() : Date.now();
    if (!Number.isFinite(publicationDate)) return undefined;
    const wordCount = JSON.stringify(draft.content).replace(/[^a-zа-яё0-9]+/giu, " ").trim().split(/\s+/u).filter(Boolean).length;
    return {
      id: `${approved ? "editorial" : "editorial-preview"}:${slug}`,
      contentType: draft.contentType,
      slug: draft.slug,
      title: draft.metadata.title,
      h1: draft.metadata.h1,
      excerpt: draft.metadata.excerpt,
      categorySlug: draft.categorySlug,
      categoryTitle: "Корончатые свёрла",
      clusterId: "wordstat-russia-koronchatye-sverla",
      intent: "Выбор корончатого сверла",
      intentKey: "koronchatye-sverla:selection",
      intentClass: "SELECTION",
      author: draft.editorialIdentity.author,
      expertReviewer: draft.editorialIdentity.expertReviewer,
      publishedAt: publicationDate,
      updatedAt: publicationDate,
      readingMinutes: Math.max(1, Math.ceil(wordCount / 180)),
      metaTitle: draft.metadata.metaTitle,
      metaDescription: draft.metadata.metaDescription,
      canonical: draft.canonical,
      primaryKeyword: draft.primaryKeyword,
      secondaryKeywords: draft.secondaryKeywords,
      content: draft.content,
      qualityScore: approved ? 90 : 0,
      evidenceScore: approved ? 88 : 0,
      differentiationScore: approved ? 75 : 0,
      businessScore: approved ? 90 : 0,
      targetProducts: [],
      relatedArticles: [],
      images: draftImages(draft.brief.relevantSupplierImages),
      sources: draft.sourceRegistry.map((source) => ({
        sourceRef: source.sourceRef,
        name: source.name,
        url: source.url,
        claimText: source.claimScope,
      })),
      faq: draft.content.faq,
      leadFormType: "CUTTER_SELECTION",
      generatedByAi: draft.generatedByAi,
      humanReviewed: approved,
      expertProfile: null,
    };
  } catch {
    return undefined;
  }
}

export function getPublishedEditorialArticle(slug: string): PublishedArticle | undefined {
  return projectEditorialArticle(slug, false);
}

export function listPublishedEditorialArticles(): PublishedArticle[] {
  if (!fs.existsSync(draftsRoot)) return [];
  return fs.readdirSync(draftsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^[a-z0-9-]+$/u.test(entry.name))
    .map((entry) => getPublishedEditorialArticle(entry.name))
    .filter((article): article is PublishedArticle => Boolean(article));
}

export function getEditorialPreview(slug: string): PublishedArticle | undefined {
  if (process.env.NODE_ENV === "production" && process.env.EDITORIAL_PREVIEW_ENABLED !== "1") return undefined;
  return projectEditorialArticle(slug, true);
}
