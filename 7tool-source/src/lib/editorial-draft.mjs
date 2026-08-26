import { scanProhibitedAiContent, validateArticleContent } from "./content-platform.mjs";

const DRAFT_STATUS = "AWAITING_HUMAN_BRIEF_REVIEW";
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function requireString(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string`);
  return value.trim();
}

function requireStringArray(value, field, minimum = 0) {
  if (!Array.isArray(value) || value.length < minimum) throw new Error(`${field} must contain at least ${minimum} item(s)`);
  const items = value.map((item, index) => requireString(item, `${field}[${index}]`));
  if (new Set(items).size !== items.length) throw new Error(`${field} must not contain duplicates`);
  return items;
}

function contentSourceRefs(content) {
  const refs = new Set();
  const add = (values) => (values ?? []).forEach((value) => refs.add(value));
  content.shortAnswer.forEach((entry) => add(entry.sourceRefs));
  content.sections.forEach((section) => section.blocks.forEach((block) => add(block.sourceRefs)));
  content.faq.forEach((item) => refs.add(item.sourceRef));
  return refs;
}

export function validateEditorialDraft(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("draft must be an object");
  if (input.schemaVersion !== "EDITORIAL_DRAFT_V1") throw new Error("Unsupported editorial draft schemaVersion");
  if (input.status !== DRAFT_STATUS) throw new Error(`Draft status must be ${DRAFT_STATUS}`);
  if (input.generatedByAi !== true || input.humanReviewed !== false) {
    throw new Error("AI-assisted draft must remain generatedByAi=true and humanReviewed=false");
  }

  const editorialIdentity = input.editorialIdentity;
  if (!editorialIdentity || typeof editorialIdentity !== "object") {
    throw new Error("editorialIdentity must be an object");
  }
  const author = requireString(editorialIdentity.author, "editorialIdentity.author");
  const expertReviewer = requireString(editorialIdentity.expertReviewer, "editorialIdentity.expertReviewer");
  if (editorialIdentity.expertReviewStatus !== "PENDING_CONTENT_APPROVAL") {
    throw new Error("editorialIdentity.expertReviewStatus must remain PENDING_CONTENT_APPROVAL before expert approval");
  }

  const slug = requireString(input.slug, "slug");
  if (!SLUG_RE.test(slug)) throw new Error("slug must contain lowercase latin letters, digits and single hyphens");
  const canonical = requireString(input.canonical, "canonical");
  if (canonical !== `/articles/${slug}`) throw new Error("canonical must match /articles/{slug}");
  const categorySlug = requireString(input.categorySlug, "categorySlug");
  const primaryKeyword = requireString(input.primaryKeyword, "primaryKeyword");
  const secondaryKeywords = requireStringArray(input.secondaryKeywords, "secondaryKeywords", 1);
  const productSlugs = requireStringArray(input.requiredProductSlugs, "requiredProductSlugs", 1);
  productSlugs.forEach((productSlug) => {
    if (!productSlug.startsWith("/p/") || productSlug.includes("//")) throw new Error(`Invalid product path: ${productSlug}`);
  });

  const metadata = input.metadata;
  if (!metadata || typeof metadata !== "object") throw new Error("metadata must be an object");
  const title = requireString(metadata.title, "metadata.title");
  const h1 = requireString(metadata.h1, "metadata.h1");
  const metaTitle = requireString(metadata.metaTitle, "metadata.metaTitle");
  const metaDescription = requireString(metadata.metaDescription, "metadata.metaDescription");
  const excerpt = requireString(metadata.excerpt, "metadata.excerpt");
  if (metaTitle.length > 70) throw new Error("metadata.metaTitle must not exceed 70 characters");
  if (metaDescription.length < 120 || metaDescription.length > 180) {
    throw new Error("metadata.metaDescription must contain 120-180 characters");
  }

  const sources = input.sourceRegistry;
  if (!Array.isArray(sources) || sources.length === 0) throw new Error("sourceRegistry must contain sources");
  const sourceRefs = new Set();
  for (const [index, source] of sources.entries()) {
    if (!source || typeof source !== "object") throw new Error(`sourceRegistry[${index}] must be an object`);
    const sourceRef = requireString(source.sourceRef, `sourceRegistry[${index}].sourceRef`);
    if (sourceRefs.has(sourceRef)) throw new Error(`Duplicate sourceRef: ${sourceRef}`);
    sourceRefs.add(sourceRef);
    const url = requireString(source.url, `sourceRegistry[${index}].url`);
    if (!url.startsWith("https://")) throw new Error(`Source URL must use HTTPS: ${url}`);
    if (source.evidenceStatus !== "PENDING_HUMAN_REVIEW") {
      throw new Error(`Source ${sourceRef} must remain PENDING_HUMAN_REVIEW in an editorial draft`);
    }
  }

  const brief = input.brief;
  if (!brief || typeof brief !== "object") throw new Error("brief must be an object");
  requireString(brief.userIntent, "brief.userIntent");
  requireString(brief.problem, "brief.problem");
  requireString(brief.audience, "brief.audience");
  requireString(brief.shortAnswer, "brief.shortAnswer");
  requireString(brief.calculatorRequirement, "brief.calculatorRequirement");
  requireString(brief.cta, "brief.cta");
  requireStringArray(brief.keyQuestions, "brief.keyQuestions", 1);
  requireStringArray(brief.competitorGaps, "brief.competitorGaps", 1);
  requireStringArray(brief.internalLinks, "brief.internalLinks", 1);
  requireStringArray(brief.evidenceRequirements, "brief.evidenceRequirements", 1);
  if (!Array.isArray(brief.verifiedFacts) || brief.verifiedFacts.length === 0) {
    throw new Error("brief.verifiedFacts must contain sourced facts");
  }
  for (const [index, fact] of brief.verifiedFacts.entries()) {
    requireString(fact.text, `brief.verifiedFacts[${index}].text`);
    const sourceRef = requireString(fact.sourceRef, `brief.verifiedFacts[${index}].sourceRef`);
    if (!sourceRefs.has(sourceRef)) throw new Error(`Unknown brief sourceRef: ${sourceRef}`);
  }

  const content = validateArticleContent(input.content);
  for (const sourceRef of contentSourceRefs(content)) {
    if (!sourceRefs.has(sourceRef)) throw new Error(`Unknown content sourceRef: ${sourceRef}`);
  }
  const scan = scanProhibitedAiContent(content, { primaryKeyword });
  if (scan.hardFail) {
    const codes = scan.issues.filter((issue) => issue.severity === "HARD").map((issue) => issue.code).join(", ");
    throw new Error(`Editorial draft failed prohibited-content scan: ${codes}`);
  }

  const warnings = [...scan.issues.filter((issue) => issue.severity !== "HARD")];
  if (!input.reviewGate || input.reviewGate.canPublish !== false) {
    throw new Error("reviewGate.canPublish must be false before human review");
  }
  requireStringArray(input.reviewGate.requiredApprovals, "reviewGate.requiredApprovals", 1);

  const wordCount = JSON.stringify(content)
    .replace(/[^a-zа-яё0-9\s-]/giu, " ")
    .split(/\s+/u)
    .filter(Boolean).length;

  return {
    ok: true,
    status: input.status,
    slug,
    canonical,
    categorySlug,
    primaryKeyword,
    secondaryKeywordCount: secondaryKeywords.length,
    sourceCount: sourceRefs.size,
    productCount: productSlugs.length,
    sectionCount: content.sections.length,
    faqCount: content.faq.length,
    wordCount,
    editorialIdentity: { author, expertReviewer, expertReviewStatus: editorialIdentity.expertReviewStatus },
    metadata: { title, h1, metaTitle, metaDescription, excerpt },
    warnings,
  };
}
