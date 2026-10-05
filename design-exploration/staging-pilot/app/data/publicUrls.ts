type PublicVariantIdentity = {
  id: string;
  sku: string;
};

type PublicProductIdentity = {
  slug: string;
  variants: PublicVariantIdentity[];
};

const transliteration: Record<string, string> = {
  а:"a", б:"b", в:"v", г:"g", д:"d", е:"e", ё:"yo", ж:"zh", з:"z",
  и:"i", й:"y", к:"k", л:"l", м:"m", н:"n", о:"o", п:"p", р:"r",
  с:"s", т:"t", у:"u", ф:"f", х:"h", ц:"ts", ч:"ch", ш:"sh",
  щ:"sch", ъ:"", ы:"y", ь:"", э:"e", ю:"yu", я:"ya",
};

function transliterate(value: string): string {
  return value.split("").map((character) => transliteration[character] ?? character).join("");
}

function variantSlugSuffix(sku: string): string {
  const normalized = (sku || "")
    .toLocaleLowerCase("ru-RU")
    .replace(/[^a-zа-я0-9]+/giu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "");
  return transliterate(normalized) || "x";
}

/** Preserves the product-variant slug contract already published on 7tool.ru. */
export function publicVariantSlug(product: Pick<PublicProductIdentity, "slug">, variant: PublicVariantIdentity): string {
  const suffix = variantSlugSuffix(variant.sku) || variant.id.toLocaleLowerCase("ru-RU");
  if (!suffix) return product.slug;
  const slugParts = product.slug.split("-");
  const suffixParts = suffix.split("-");
  while (suffixParts.length && slugParts.length && slugParts.at(-1) === suffixParts[0]) suffixParts.shift();
  return suffixParts.length ? `${product.slug}--${suffixParts.join("-")}` : product.slug;
}

export function publicProductSlug(product: PublicProductIdentity, variant?: PublicVariantIdentity): string {
  return variant && product.variants.length > 1 ? publicVariantSlug(product, variant) : product.slug;
}

export function publicProductPath(product: PublicProductIdentity, variant?: PublicVariantIdentity): string {
  return `/p/${publicProductSlug(product, variant)}`;
}

export function publicCategoryPath(slug: string): string {
  return `/c/${slug}`;
}

/** Stable manufacturer slug contract already published on 7tool.ru. */
export function publicBrandSlug(brand: string): string {
  return transliterate(brand.normalize("NFKD").toLocaleLowerCase("ru-RU"))
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "") || "brand";
}

export function publicBrandPath(brand: string): string {
  return `/brand/${publicBrandSlug(brand)}`;
}
