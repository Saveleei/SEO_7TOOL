import { SITE_URL } from "@/lib/site-config";

export const dynamic = "force-static";

export function GET() {
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api",
    "Clean-param: utm_source&utm_medium&utm_campaign&utm_term&utm_content&yclid&gclid&_openstat /",
    `Host: ${new URL(SITE_URL).host}`,
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
