import { absoluteUrl } from "@/lib/site-config";
import { getPublishedArticle, listPublishedArticleSlugs } from "@/lib/articles-db";
import { buildImageSitemap } from "@/lib/image-seo.mjs";

export const runtime = "nodejs";
export const revalidate = 3_600;

export function GET() {
  const articles = listPublishedArticleSlugs().slice(0, 500).map((slug) => getPublishedArticle(slug));
  const entries = articles.filter((article): article is NonNullable<typeof article> => Boolean(article)).map((article) => ({
    loc: absoluteUrl(`/articles/${article.slug}`),
    images: article.images.map((image) => {
      const preferred = image.variants.filter((variant) => variant.mime === "image/webp").sort((left, right) => right.width - left.width)[0]
        ?? image.variants.slice().sort((left, right) => right.width - left.width)[0];
      return preferred ? absoluteUrl(preferred.url) : null;
    }).filter((url) => url !== null),
  }));
  return new Response(buildImageSitemap(entries), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
