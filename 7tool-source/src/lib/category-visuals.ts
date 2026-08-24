export const CATEGORY_VISUALS: Record<string, string> = {
  borfrezy: "/category/borfrezy.webp",
  "stanki-sverlilnye": "/category/stanki-sverlilnye.webp",
  "koronchatye-sverla": "/category/koronchatye-sverla.webp",
  truborezy: "/category/truborezy.webp",
  "kromkorezy-dlya-trub": "/category/kromkorezy-dlya-trub.webp",
  "kromkorezy-po-listu": "/category/kromkorezy-po-listu.webp",
  "karetki-svarochnye": "/category/karetki-svarochnye.webp",
  "karetki-termicheskoy-rezki": "/category/karetki-termicheskoy-rezki.webp",
  "rezbonareznye-manipulyatory": "/category/rezbonareznye-manipulyatory.webp",
};

export const DEFAULT_CATEGORY_VISUAL = "/warehouse/01.webp";

export function categoryVisualFor(categorySlug?: string) {
  return (categorySlug && CATEGORY_VISUALS[categorySlug]) || DEFAULT_CATEGORY_VISUAL;
}
