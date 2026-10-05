import generatedLegacyRetainedProducts from "./generatedLegacyRetainedProducts.json" with { type:"json" };

export type LegacyRetainedProduct = {
  slug: string;
  title: string;
  description: string;
  brand: string;
  category: string;
  categorySlug: string;
  sku: string;
  image: string;
  groupPath?: string;
};

const categorySlugs: Record<string, string> = {
  "Алмазное бурение":"almaznoe-burenie",
  "Кромкорезы для труб":"kromkorezy-dlya-trub",
  "Магнитная оснастка":"magnitnaya-osnastka",
  "Пильные диски":"pilnye-diski",
  "Сварочные вращатели и позиционеры":"svarochnye-vrashchateli-i-pozitsionery",
  "Станки сверлильные":"stanki-sverlilnye",
};

const entries = generatedLegacyRetainedProducts.entries.map((entry) => ({
  ...entry,
  categorySlug:categorySlugs[entry.category] ?? "",
})) as LegacyRetainedProduct[];
const entriesBySlug = new Map(entries.map((entry) => [entry.slug, entry]));

export function getLegacyRetainedProduct(slug: string): LegacyRetainedProduct | undefined {
  return entriesBySlug.get(slug);
}

export function getLegacyRetainedProducts(): LegacyRetainedProduct[] {
  return entries;
}
