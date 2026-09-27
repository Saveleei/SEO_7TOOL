import type { MetadataRoute } from "next";
import { isSeoIndexingEnabled, SEO_SITE_ORIGIN } from "./data/seoIndexing.mjs";

export default function robots(): MetadataRoute.Robots {
  if (!isSeoIndexingEnabled()) return { rules:{ userAgent:"*", disallow:"/" } };
  return {
    rules:{ userAgent:"*", allow:"/", disallow:["/api/", "/test/"] },
    sitemap:`${SEO_SITE_ORIGIN}/sitemap.xml`,
    host:SEO_SITE_ORIGIN,
  };
}
