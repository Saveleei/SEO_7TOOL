import generatedLegacySubcategories from "./generatedLegacySubcategories.json" with { type:"json" };

export type LegacySubcategoryLanding = {
  categorySlug: string;
  categoryTitle: string;
  slug: string;
  title: string;
  h1?: string;
  shortDescription: string;
  intro: string;
  seoTitle?: string;
  seoText: string;
  metaTitle: string;
  metaDescription: string;
  image?: string;
  imageAlt?: string;
  faq: Array<{ question: string; answer: string }>;
  relatedLinks: Array<{ href: string; label: string }>;
  productIds: string[];
  count: number;
};

const entries = generatedLegacySubcategories.entries as LegacySubcategoryLanding[];
const entriesByPath = new Map(entries.map((entry) => [`${entry.categorySlug}/${entry.slug}`, entry]));

export function getLegacySubcategory(categorySlug: string, slug: string): LegacySubcategoryLanding | undefined {
  return entriesByPath.get(`${categorySlug}/${slug}`);
}

export function getLegacySubcategories(): LegacySubcategoryLanding[] {
  return entries;
}

export function getLegacySubcategoriesForCategory(categorySlug: string): LegacySubcategoryLanding[] {
  return entries.filter((entry) => entry.categorySlug === categorySlug);
}
