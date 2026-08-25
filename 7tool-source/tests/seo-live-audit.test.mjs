import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalMatches,
  extractDeclaredSitemaps,
  inspectImageSitemapXml,
  inspectSitemapXml,
  resolveSeoCheckBase,
} from "../scripts/lib/seo-check-core.mjs";

test("production SEO check accepts explicit and positional root URLs without silently skipping live checks", () => {
  assert.equal(resolveSeoCheckBase(["--url=https://7tool.ru"]), "https://7tool.ru");
  assert.equal(resolveSeoCheckBase(["--full-live", "https://7tool.ru/"]), "https://7tool.ru");
  assert.equal(resolveSeoCheckBase(["--url", "http://localhost:3000"]), "http://localhost:3000");
  assert.equal(resolveSeoCheckBase([], { SEO_CHECK_BASE_URL: "https://7tool.ru" }), "https://7tool.ru");
  assert.equal(resolveSeoCheckBase([]), "");
  assert.throws(() => resolveSeoCheckBase(["https://user:secret@7tool.ru"]), /credentials/);
  assert.throws(() => resolveSeoCheckBase(["https://7tool.ru/catalog"]), /site root/);
  assert.throws(() => resolveSeoCheckBase(["https://7tool.ru?preview=1"]), /query parameters/);
});

test("sitemap audit enforces one local canonical URL without parameters", () => {
  const valid = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://7tool.ru/</loc></url><url><loc>https://7tool.ru/c/stanki</loc></url></urlset>`;
  assert.deepEqual(inspectSitemapXml(valid, "https://7tool.ru").findings, []);

  const invalid = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/c/stanki</loc></url><url><loc>https://7tool.ru/c/stanki?sort=price</loc></url><url><loc>https://7tool.ru/c/stanki?sort=price</loc></url></urlset>`;
  const codes = inspectSitemapXml(invalid, "https://7tool.ru").findings.map((finding) => finding.code);
  assert.ok(codes.includes("SITEMAP_FOREIGN_ORIGIN"));
  assert.ok(codes.includes("SITEMAP_PARAMETER_URL"));
  assert.ok(codes.includes("SITEMAP_DUPLICATE"));
});

test("image sitemap audit permits only sitemap-owned pages and local rights-processed media", () => {
  const pages = ["https://7tool.ru/articles/vybor-stanka"];
  const valid = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"><url><loc>https://7tool.ru/articles/vybor-stanka</loc><image:image><image:loc>https://7tool.ru/media/article/1280-stanok.webp</image:loc></image:image></url></urlset>`;
  assert.deepEqual(inspectImageSitemapXml(valid, "https://7tool.ru", pages).findings, []);

  const invalid = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"><url><loc>https://7tool.ru/articles/drugaya</loc><image:image><image:loc>https://cdn.example.com/photo.jpg</image:loc></image:image></url></urlset>`;
  const codes = inspectImageSitemapXml(invalid, "https://7tool.ru", pages).findings.map((finding) => finding.code);
  assert.ok(codes.includes("IMAGE_SITEMAP_PAGE_NOT_IN_SITEMAP"));
  assert.ok(codes.includes("IMAGE_SITEMAP_ASSET_FOREIGN"));
  assert.ok(codes.includes("IMAGE_SITEMAP_ASSET_NOT_LOCAL_MEDIA"));

  const missingDefaultNamespace = `<urlset xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"></urlset>`;
  assert.ok(inspectImageSitemapXml(missingDefaultNamespace, "https://7tool.ru", pages).findings
    .some((finding) => finding.code === "IMAGE_SITEMAP_XML_INVALID"));
});

test("canonical comparison normalizes only harmless trailing slash differences", () => {
  assert.equal(canonicalMatches("https://7tool.ru", "/", "https://7tool.ru"), true);
  assert.equal(canonicalMatches("https://7tool.ru/c/stanki/", "/c/stanki", "https://7tool.ru"), true);
  assert.equal(canonicalMatches("https://7tool.ru/c/drugoe", "/c/stanki", "https://7tool.ru"), false);
  assert.equal(canonicalMatches("https://example.com/c/stanki", "/c/stanki", "https://7tool.ru"), false);
});

test("robots parser keeps both standard and image sitemap declarations", () => {
  const robots = "User-agent: *\nSitemap: https://7tool.ru/sitemap.xml\nSitemap: https://7tool.ru/image-sitemap.xml\n";
  assert.deepEqual(extractDeclaredSitemaps(robots), [
    "https://7tool.ru/sitemap.xml",
    "https://7tool.ru/image-sitemap.xml",
  ]);
});
