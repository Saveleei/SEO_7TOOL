import { isSeoIndexingEnabled, SEO_SITE_ORIGIN } from "../data/seoIndexing.mjs";

const CLEAN_PARAMETERS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "yclid", "gclid", "_openstat"];

export function buildRobotsText(env: NodeJS.ProcessEnv = process.env): string {
  if (!isSeoIndexingEnabled(env)) return "User-agent: *\nDisallow: /\n";
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /test/",
    `Clean-param: ${CLEAN_PARAMETERS.join("&")} /`,
    "",
    `Host: ${SEO_SITE_ORIGIN}`,
    `Sitemap: ${SEO_SITE_ORIGIN}/sitemap.xml`,
    "",
  ].join("\n");
}

export function GET() {
  return new Response(buildRobotsText(), {
    headers:{
      "Content-Type":"text/plain; charset=utf-8",
      "Cache-Control":"public, max-age=0, must-revalidate",
    },
  });
}
