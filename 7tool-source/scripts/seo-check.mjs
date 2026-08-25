import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalMatches,
  extractDeclaredSitemaps,
  inspectImageSitemapXml,
  inspectSitemapXml,
  resolveSeoCheckBase,
} from "./lib/seo-check-core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const analysisDir = path.join(root, ".analysis");
const reportPath = path.join(analysisDir, "seo-quality-report.json");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "src", "lib", "products.json"), "utf8"));
const profiles = JSON.parse(fs.readFileSync(path.join(root, "src", "lib", "category-seo.json"), "utf8"));
const base = resolveSeoCheckBase(process.argv.slice(2), process.env);
const fullLive = process.argv.includes("--full-live");
const findings = [];

fs.mkdirSync(analysisDir, { recursive: true });

function add(severity, code, detail, url) {
  findings.push({ severity, code, detail, url: url || null });
}

function hasImage(product) {
  return (product.images || []).some(Boolean) || (product.variants || []).some((variant) => (variant.images || []).some(Boolean));
}

function slugifyBrand(brand) {
  const map = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
  return brand.normalize("NFKD").toLocaleLowerCase("ru").split("").map((character) => map[character] ?? character).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "brand";
}

const publicCategories = (catalog.categories || []).filter((category) => category.published !== false);
const publicCategorySlugs = new Set(publicCategories.map((category) => category.slug));
const products = (catalog.products || []).filter((product) => !product.draft && hasImage(product) && publicCategorySlugs.has(product.category));

for (const category of publicCategories) {
  if (!profiles[category.slug]) add("P0", "MISSING_CATEGORY_PROFILE", category.slug);
  if (!category.metaTitle && !profiles[category.slug]?.metaTitle) add("P0", "MISSING_CATEGORY_TITLE", category.slug);
  if (!category.metaDescription && !profiles[category.slug]?.metaDescription) add("P0", "MISSING_CATEGORY_DESCRIPTION", category.slug);
}

const owners = { title: new Map(), description: new Map(), slug: new Map() };
function unique(field, value, product) {
  const key = String(value || "").trim().toLocaleLowerCase("ru");
  if (!key) return;
  if (owners[field].has(key)) add("P0", `DUPLICATE_PRODUCT_${field.toUpperCase()}`, `${product.id} conflicts with ${owners[field].get(key)}`);
  else owners[field].set(key, product.id);
}
for (const product of products) {
  if (!product.metaTitle) add("P0", "MISSING_PRODUCT_TITLE", product.id, `/p/${product.slug}`);
  if (!product.metaDescription) add("P0", "MISSING_PRODUCT_DESCRIPTION", product.id, `/p/${product.slug}`);
  if (!product.seoText) add("P1", "MISSING_PRODUCT_SEO_TEXT", product.id, `/p/${product.slug}`);
  if (product.metaTitle && product.metaTitle.length > 82) add("P1", "LONG_PRODUCT_TITLE", `${product.id}: ${product.metaTitle.length}`);
  if (product.metaDescription && (product.metaDescription.length < 100 || product.metaDescription.length > 205)) add("P1", "PRODUCT_DESCRIPTION_LENGTH", `${product.id}: ${product.metaDescription.length}`);
  unique("title", product.metaTitle, product);
  unique("description", product.metaDescription, product);
  unique("slug", product.slug, product);
}

const brands = Array.from(new Set(products.map((product) => product.brand).filter((brand) => brand && brand !== "—")));
const slugOwners = new Map();
for (const brand of brands) {
  const slug = slugifyBrand(brand);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) add("P0", "INVALID_BRAND_SLUG", `${brand}: ${slug}`);
  if (slugOwners.has(slug) && slugOwners.get(slug) !== brand) add("P0", "BRAND_SLUG_COLLISION", `${brand} / ${slugOwners.get(slug)} -> ${slug}`);
  else slugOwners.set(slug, brand);
}

const sourceChecks = [
  ["src/app/p/[slug]/page.tsx", /dynamic = "force-dynamic"/, "PRODUCT_NOT_DYNAMIC"],
  ["src/app/p/[slug]/page.tsx", /resolvePublicProductSlug/, "PRODUCT_NOT_FROM_CURRENT_DB"],
  ["src/app/sitemap.ts", /listPublicProductSlugs/, "SITEMAP_NOT_FROM_PUBLIC_DB"],
  ["src/app/sitemap.ts", /brandSlug\(brand\)/, "SITEMAP_UNSAFE_BRAND_SLUG"],
  ["src/app/robots.txt/route.ts", /image-sitemap\.xml/, "ROBOTS_WITHOUT_IMAGE_SITEMAP"],
  ["src/app/image-sitemap.xml/route.ts", /buildImageSitemap/, "IMAGE_SITEMAP_ROUTE_MISSING"],
  ["src/app/lp/[category]/[[...intent]]/page.tsx", /landingSeoDecision/, "LANDING_DECISION_UNUSED"],
  ["src/app/c/[slug]/CategoryFilters.tsx", /href=\{href\(/, "PAGINATION_WITHOUT_LINKS"],
  ["scripts/hourly-refresh.sh", /npm run data:check/, "HOURLY_WITHOUT_DATA_GUARD"],
  ["scripts/nightly-rebuild.sh", /npm run data:check/, "NIGHTLY_WITHOUT_DATA_GUARD"],
];
for (const [file, pattern, code] of sourceChecks) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  if (!pattern.test(text)) add("P0", code, file);
}
const sitemapSource = fs.readFileSync(path.join(root, "src", "app", "sitemap.ts"), "utf8");
if (/landingUrls/.test(sitemapSource)) add("P0", "UNREVIEWED_LANDINGS_IN_SITEMAP", "landingUrls is present");

if (base) await liveChecks();

const summary = {
  generatedAt: new Date().toISOString(),
  checkedBaseUrl: base || null,
  categories: publicCategories.length,
  products: products.length,
  brands: brands.length,
  p0: findings.filter((finding) => finding.severity === "P0").length,
  p1: findings.filter((finding) => finding.severity === "P1").length,
  total: findings.length,
};
fs.writeFileSync(reportPath, `${JSON.stringify({ summary, findings }, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
if (summary.p0 > 0) process.exitCode = 1;

async function liveChecks() {
  const robots = await request("/robots.txt");
  const declaredSitemaps = extractDeclaredSitemaps(robots.body);
  const sitemapUrl = `${base}/sitemap.xml`;
  const imageSitemapUrl = `${base}/image-sitemap.xml`;
  if (robots.status !== 200 || !declaredSitemaps.includes(sitemapUrl)) add("P0", "ROBOTS_INVALID", `status=${robots.status}`, "/robots.txt");
  if (robots.status === 200 && !declaredSitemaps.includes(imageSitemapUrl)) add("P1", "ROBOTS_IMAGE_SITEMAP_MISSING", imageSitemapUrl, "/robots.txt");
  const sitemap = await request("/sitemap.xml", 45_000);
  if (sitemap.status !== 200) {
    add("P0", "SITEMAP_HTTP", `status=${sitemap.status}`, "/sitemap.xml");
    return;
  }
  if (!/^(application|text)\/xml\b/i.test(sitemap.contentType)) add("P0", "SITEMAP_CONTENT_TYPE", sitemap.contentType || "missing", "/sitemap.xml");
  const sitemapAudit = inspectSitemapXml(sitemap.body, base);
  for (const finding of sitemapAudit.findings) add("P0", finding.code, finding.detail, "/sitemap.xml");
  const urls = sitemapAudit.urls;
  for (const url of urls) {
    if (/\/lp\//.test(url)) add("P0", "SITEMAP_UNREVIEWED_LANDING", url);
  }

  const imageSitemap = await request("/image-sitemap.xml", 45_000);
  if (imageSitemap.status !== 200) add("P1", "IMAGE_SITEMAP_HTTP", `status=${imageSitemap.status}`, "/image-sitemap.xml");
  else {
    if (!/^(application|text)\/xml\b/i.test(imageSitemap.contentType)) add("P1", "IMAGE_SITEMAP_CONTENT_TYPE", imageSitemap.contentType || "missing", "/image-sitemap.xml");
    const imageAudit = inspectImageSitemapXml(imageSitemap.body, base, urls);
    for (const finding of imageAudit.findings) add("P1", finding.code, finding.detail, "/image-sitemap.xml");
  }

  const fixtures = ["/", "/cart", "/favorites", "/definitely-not-a-real-7tool-url"];
  const paths = urls.map((url) => new URL(url).pathname);
  fixtures.push(...paths.filter((value) => value.startsWith("/c/")).slice(0, 3));
  fixtures.push(...paths.filter((value) => value.startsWith("/brand/")).slice(0, 3));
  fixtures.push(...paths.filter((value) => value.startsWith("/p/")).slice(0, 4));
  for (const route of Array.from(new Set(fixtures))) await inspectHtml(route, urls.includes(new URL(route, base).href));

  const sitemapCandidates = fullLive ? paths : [
    ...paths.filter((value) => value.startsWith("/brand/")),
    ...paths.filter((value) => value.startsWith("/c/")),
    ...paths.filter((value) => value.startsWith("/p/")).slice(0, Number(process.env.SEO_CHECK_HTTP_LIMIT || 30)),
  ];
  for (const route of Array.from(new Set(sitemapCandidates))) {
    const response = await request(route, 25_000);
    if (response.status !== 200) add("P0", "SITEMAP_URL_NOT_200", `status=${response.status}`, route);
    else if (!canonicalMatches(response.url, route, base)) add("P0", "SITEMAP_URL_REDIRECT", response.url, route);
  }
}

async function inspectHtml(route, inSitemap) {
  const response = await request(route, 30_000);
  const expected404 = route.includes("definitely-not-a-real");
  if (expected404) {
    if (response.status !== 404 || !robotsValue(response.body).includes("noindex")) add("P0", "HARD_404_INVALID", `status=${response.status}`, route);
    return;
  }
  if (response.status !== 200) {
    add("P0", "FIXTURE_NOT_200", `status=${response.status}`, route);
    return;
  }
  const title = tagText(response.body, "title");
  const description = metaValue(response.body, "description");
  const canonical = linkValue(response.body, "canonical");
  const h1 = (response.body.match(/<h1\b/gi) || []).length;
  if (!title) add("P0", "MISSING_TITLE", "", route);
  if (!description) add("P0", "MISSING_DESCRIPTION", "", route);
  if (route !== "/cart" && route !== "/favorites" && h1 !== 1) add("P1", "H1_COUNT", String(h1), route);
  if (route !== "/cart" && route !== "/favorites" && !canonical) add("P0", "MISSING_CANONICAL", "", route);
  if (inSitemap && canonical && !canonicalMatches(canonical, route, base)) add("P0", "CANONICAL_MISMATCH", canonical, route);
  const robots = robotsValue(response.body);
  if (inSitemap && robots.includes("noindex")) add("P0", "SITEMAP_URL_NOINDEX", robots, route);
  if ((route === "/cart" || route === "/favorites") && !robots.includes("noindex")) add("P0", "PRIVATE_PAGE_INDEXABLE", robots, route);
  for (const [index, raw] of Array.from(response.body.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi), (match) => match[1]).entries()) {
    try { JSON.parse(raw.replaceAll("&quot;", '"').replaceAll("&amp;", "&")); } catch (error) { add("P0", "INVALID_JSON_LD", `script ${index}: ${error.message}`, route); }
  }
}

async function request(route, timeout = 20_000) {
  try {
    const response = await fetch(new URL(route, base), { redirect: "follow", signal: AbortSignal.timeout(timeout), headers: { "user-agent": "7tool-seo-check/1.0" } });
    return { status: response.status, body: await response.text(), url: response.url, contentType: response.headers.get("content-type") || "" };
  } catch (error) {
    add("P0", "HTTP_ERROR", error.message, route);
    return { status: 0, body: "", url: route, contentType: "" };
  }
}
function tagText(html, tag) {
  return html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1]?.replace(/<[^>]+>/g, "").trim() || "";
}
function metaValue(html, name) {
  return html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)`, "i"))?.[1] || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, "i"))?.[1] || "";
}
function linkValue(html, rel) {
  return html.match(new RegExp(`<link[^>]+rel=["']${rel}["'][^>]+href=["']([^"']*)`, "i"))?.[1] || html.match(new RegExp(`<link[^>]+href=["']([^"']*)["'][^>]+rel=["']${rel}["']`, "i"))?.[1] || "";
}
function robotsValue(html) {
  return metaValue(html, "robots").toLocaleLowerCase("ru");
}
