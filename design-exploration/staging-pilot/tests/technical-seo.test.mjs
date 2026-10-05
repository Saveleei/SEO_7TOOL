import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import robots from "../app/robots.ts";
import sitemap from "../app/sitemap.ts";
import { canonicalUrl, createPublicMetadata, hasSearchParameters, serializeJsonLd } from "../app/data/seo.ts";
import { isProductionSeoHost, isSeoIndexingEnabled, normalizeSeoHost, shouldSendNoIndexHeader } from "../app/data/seoIndexing.mjs";
import { proxy } from "../proxy.ts";

test("SEO indexing is opt-in and restricted to the exact production hosts", () => {
  assert.equal(isSeoIndexingEnabled({}), false);
  assert.equal(isSeoIndexingEnabled({ SEO_INDEXING_ENABLED:"true" }), false);
  assert.equal(isSeoIndexingEnabled({ SEO_INDEXING_ENABLED:"1" }), true);
  assert.equal(normalizeSeoHost("7TOOL.RU:443"), "7tool.ru");
  assert.equal(isProductionSeoHost("www.7tool.ru"), true);
  assert.equal(isProductionSeoHost("test.7tool.ru"), false);
  assert.equal(isProductionSeoHost("7tool.ru.example.com"), false);
  assert.equal(shouldSendNoIndexHeader("7tool.ru", { SEO_INDEXING_ENABLED:"1" }), false);
  assert.equal(shouldSendNoIndexHeader("test.7tool.ru", { SEO_INDEXING_ENABLED:"1" }), true);
  assert.equal(shouldSendNoIndexHeader("7tool.ru", {}), true);
});

test("the response header keeps staging closed even when indexing is enabled", () => {
  const previous = process.env.SEO_INDEXING_ENABLED;
  process.env.SEO_INDEXING_ENABLED = "1";
  try {
    assert.equal(proxy({ nextUrl:{ hostname:"7tool.ru" } }).headers.get("X-Robots-Tag"), null);
    assert.equal(proxy({ nextUrl:{ hostname:"test.7tool.ru" } }).headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
    assert.equal(proxy({ nextUrl:{ hostname:"7tool.ru.example.com" } }).headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
  } finally {
    restoreEnv("SEO_INDEXING_ENABLED", previous);
  }
});

test("public metadata uses a clean canonical and noindexes parameterized listings", () => {
  const previous = process.env.SEO_INDEXING_ENABLED;
  process.env.SEO_INDEXING_ENABLED = "1";
  try {
    const clean = createPublicMetadata({ title:"Каталог", description:"Описание", path:"/catalog?utm_source=test" });
    assert.equal(clean.alternates?.canonical, "https://7tool.ru/catalog");
    assert.equal(clean.robots?.index, true);
    const duplicate = createPublicMetadata({ title:"Фильтр", description:"Описание", path:"/c/borfrezy", indexable:false });
    assert.equal(duplicate.robots?.index, false);
    assert.equal(duplicate.robots?.follow, true);
    assert.equal(hasSearchParameters({ sort:"relevance", q:"" }), true);
    assert.equal(hasSearchParameters({ q:"" }), false);
    assert.equal(canonicalUrl("/p/example?variant=1#specs"), "https://7tool.ru/p/example");
  } finally {
    restoreEnv("SEO_INDEXING_ENABLED", previous);
  }
});

test("robots and sitemap stay empty by default and expose only canonical public URLs when enabled", () => {
  const previous = process.env.SEO_INDEXING_ENABLED;
  delete process.env.SEO_INDEXING_ENABLED;
  try {
    assert.deepEqual(robots(), { rules:{ userAgent:"*", disallow:"/" } });
    assert.deepEqual(sitemap(), []);
    process.env.SEO_INDEXING_ENABLED = "1";
    const enabledRobots = robots();
    assert.deepEqual(enabledRobots.rules, { userAgent:"*", allow:"/", disallow:["/api/", "/test/"] });
    assert.equal(enabledRobots.sitemap, "https://7tool.ru/sitemap.xml");
    const urls = sitemap().map((entry) => entry.url);
    assert.ok(urls.includes("https://7tool.ru/"));
    assert.ok(urls.includes("https://7tool.ru/catalog"));
    assert.ok(urls.includes("https://7tool.ru/catalog/task/drilling"));
    assert.ok(urls.includes("https://7tool.ru/c/stanki-sverlilnye"));
    assert.ok(urls.includes("https://7tool.ru/p/magnitnyy-sverlilnyy-stanok-lenz-steyr-35"));
    assert.equal(new Set(urls).size, urls.length);
    assert.equal(urls.some((url) => /[?#]/u.test(url)), false);
    assert.equal(urls.some((url) => /\/(?:test|search|compare|api)(?:\/|$)/u.test(new URL(url).pathname)), false);
    assert.equal(urls.some((url) => url.includes("/catalog/sverlenie")), false);
  } finally {
    restoreEnv("SEO_INDEXING_ENABLED", previous);
  }
});

test("structured data is escaped and product offers are gated by verified availability", async () => {
  assert.equal(serializeJsonLd({ value:"</script><script>alert(1)</script>" }).includes("</script>"), false);
  const [layout, breadcrumbs, product] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/Breadcrumbs.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/product/[slug]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /"@type":"Organization"/u);
  assert.match(layout, /"@type":"WebSite"/u);
  assert.match(breadcrumbs, /"@type":"BreadcrumbList"/u);
  assert.match(product, /"@type":"Product"/u);
  assert.match(product, /primaryShipping\.available/u);
  assert.match(product, /!dataConflict && <JsonLd/u);
  assert.match(product, /indexable:Boolean\(product \|\| retainedProduct\) && !dataConflict/u);
  assert.match(product, /product-data-conflict/u);
  assert.match(product, /"https:\/\/schema\.org\/InStock"/u);
});

test("canonical categories expose CollectionPage data and the storefront has a real custom 404", async () => {
  const [category, notFound] = await Promise.all([
    readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/not-found.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(category, /"@type":"CollectionPage"/u);
  assert.match(category, /"@type":"ItemList"/u);
  assert.match(category, /!hasSearchParameters\(rawSearchParams\)/u);
  assert.match(notFound, /Ошибка 404/u);
  assert.match(notFound, /robots:\{ index:false, follow:true \}/u);
});

test("sitemap excludes products blocked by catalog P0 findings", async () => {
  const source = await readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8");
  assert.match(source, /getCatalogBlockingProductIds/u);
  assert.match(source, /!blockedProductIds\.has\(product\.id\)/u);
});

test("invalid category pages terminate as real 404 responses", async () => {
  const source = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(source, /requestedPage > result\.pageCount\)\) notFound\(\)/u);
});

test("legacy duplicate routes use permanent redirects", async () => {
  const sources = await Promise.all([
    readFile(new URL("../app/catalog/sverlenie/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/catalog/sverlenie/magnitnye-stanki/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/product/lenz-steyr-35/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.ok(sources.every((source) => source.includes("permanentRedirect")));
});

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
