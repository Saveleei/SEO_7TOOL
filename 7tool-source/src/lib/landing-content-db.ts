import "server-only";
import { db } from "./db";

export type LandingImageBlock = {
  title: string;
  text: string;
  image: string;
  imageAlt: string;
};

export type LandingProcessStep = {
  title: string;
  text: string;
};

export type LandingCase = {
  title: string;
  task: string;
  result: string;
  image: string;
  imageAlt: string;
};

export type LandingFaq = { question: string; answer: string };

export type LandingContent = {
  seo: {
    metaTitle: string;
    metaDescription: string;
    keywords: string;
    heading: string;
    text: string;
  };
  hero: {
    h1: string;
    offer: string;
    description: string;
    responsePromise: string;
  };
  proof: {
    heading: string;
    intro: string;
    items: LandingImageBlock[];
  };
  process: {
    heading: string;
    intro: string;
    steps: LandingProcessStep[];
  };
  cases: {
    heading: string;
    intro: string;
    items: LandingCase[];
  };
  faq: LandingFaq[];
};

const emptyContent: LandingContent = {
  seo: { metaTitle: "", metaDescription: "", keywords: "", heading: "", text: "" },
  hero: { h1: "", offer: "", description: "", responsePromise: "" },
  proof: { heading: "", intro: "", items: [] },
  process: { heading: "", intro: "", steps: [] },
  cases: { heading: "", intro: "", items: [] },
  faq: [],
};

function text(value: unknown, max = 5000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function normalizeLandingContent(value: unknown): LandingContent {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const seo = source.seo && typeof source.seo === "object" ? source.seo as Record<string, unknown> : {};
  const hero = source.hero && typeof source.hero === "object" ? source.hero as Record<string, unknown> : {};
  const proof = source.proof && typeof source.proof === "object" ? source.proof as Record<string, unknown> : {};
  const process = source.process && typeof source.process === "object" ? source.process as Record<string, unknown> : {};
  const cases = source.cases && typeof source.cases === "object" ? source.cases as Record<string, unknown> : {};
  const imageItems = Array.isArray(proof.items) ? proof.items : [];
  const processItems = Array.isArray(process.steps) ? process.steps : [];
  const caseItems = Array.isArray(cases.items) ? cases.items : [];
  const faqItems = Array.isArray(source.faq) ? source.faq : [];
  return {
    seo: {
      metaTitle: text(seo.metaTitle, 180),
      metaDescription: text(seo.metaDescription, 500),
      keywords: text(seo.keywords, 800),
      heading: text(seo.heading, 180),
      text: text(seo.text, 5000),
    },
    hero: {
      h1: text(hero.h1, 180),
      offer: text(hero.offer, 300),
      description: text(hero.description, 1000),
      responsePromise: text(hero.responsePromise, 300),
    },
    proof: {
      heading: text(proof.heading, 180),
      intro: text(proof.intro, 800),
      items: imageItems.slice(0, 3).map((item) => {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
        return { title: text(row.title, 120), text: text(row.text, 800), image: text(row.image, 1000), imageAlt: text(row.imageAlt, 240) };
      }),
    },
    process: {
      heading: text(process.heading, 180),
      intro: text(process.intro, 800),
      steps: processItems.slice(0, 4).map((item) => {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
        return { title: text(row.title, 120), text: text(row.text, 800) };
      }),
    },
    cases: {
      heading: text(cases.heading, 180),
      intro: text(cases.intro, 800),
      items: caseItems.slice(0, 3).map((item) => {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
        return {
          title: text(row.title, 120), task: text(row.task, 800), result: text(row.result, 800),
          image: text(row.image, 1000), imageAlt: text(row.imageAlt, 240),
        };
      }),
    },
    faq: faqItems.slice(0, 8).map((item) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return { question: text(row.question, 240), answer: text(row.answer, 1500) };
    }),
  };
}

export function getLandingContent(categorySlug: string, intentSlug: string): LandingContent {
  const row = db().prepare("SELECT content_json FROM landing_content WHERE category_slug = ? AND intent_slug = ?")
    .get(categorySlug, intentSlug) as { content_json: string } | undefined;
  if (!row) return structuredClone(emptyContent);
  try { return normalizeLandingContent(JSON.parse(row.content_json)); }
  catch { return structuredClone(emptyContent); }
}

export function saveLandingContent(categorySlug: string, intentSlug: string, content: LandingContent): void {
  const normalized = normalizeLandingContent(content);
  db().prepare(`
    INSERT INTO landing_content (category_slug, intent_slug, content_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(category_slug, intent_slug) DO UPDATE SET
      content_json = excluded.content_json,
      updated_at = excluded.updated_at
  `).run(categorySlug, intentSlug, JSON.stringify(normalized), Date.now());
}
