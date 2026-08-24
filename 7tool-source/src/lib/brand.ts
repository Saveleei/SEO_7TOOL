const transliteration: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** Stable, URL-safe slug for manufacturer pages. */
export function brandSlug(brand: string): string {
  return brand
    .normalize("NFKD")
    .toLocaleLowerCase("ru")
    .split("")
    .map((character) => transliteration[character] ?? character)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "brand";
}

/** The old implementation used the raw lower-cased brand as a route value. */
export function legacyBrandSlug(brand: string): string {
  return brand.toLocaleLowerCase("ru");
}

export function brandSlugCollisions(brands: string[]): Array<{ slug: string; brands: string[] }> {
  const grouped = new Map<string, string[]>();
  for (const brand of brands) {
    const slug = brandSlug(brand);
    grouped.set(slug, [...(grouped.get(slug) ?? []), brand]);
  }
  return Array.from(grouped, ([slug, values]) => ({ slug, brands: Array.from(new Set(values)) }))
    .filter((entry) => entry.brands.length > 1);
}
