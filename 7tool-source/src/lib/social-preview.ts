import { CATEGORY_VISUALS, DEFAULT_CATEGORY_VISUAL } from "./category-visuals";
import { absoluteUrl } from "./site-config";

function cleanImagePath(value: string | null | undefined): string | undefined {
  const path = value?.trim();
  return path || undefined;
}

/**
 * Returns a subject-specific image for link previews. The category artwork is
 * the final thematic fallback, so crawlers never have to choose an arbitrary
 * image from the page (for example, the manager portrait).
 */
export function categorySocialPreviewPath(
  categorySlug: string,
  ...preferredImages: Array<string | null | undefined>
): string {
  return preferredImages.map(cleanImagePath).find(Boolean)
    || CATEGORY_VISUALS[categorySlug]
    || DEFAULT_CATEGORY_VISUAL;
}

export function socialPreviewImage(path: string, alt: string) {
  return { url: absoluteUrl(path), alt };
}
