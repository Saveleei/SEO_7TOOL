import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolveDocumentNavigation } from "../app/data/documentNavigation.mjs";

const currentUrl = "https://test.7tool.ru/catalog/category/borfrezy?view=cards";

test("staging document navigation keeps authenticated internal links reliable", () => {
  assert.equal(
    resolveDocumentNavigation({ href:"/product/test-product", currentUrl }),
    "https://test.7tool.ru/product/test-product",
  );
  assert.equal(
    resolveDocumentNavigation({ href:"?view=table#products", currentUrl }),
    "https://test.7tool.ru/catalog/category/borfrezy?view=table#products",
  );
});

test("document navigation leaves special, external and intentional browser actions alone", () => {
  for (const options of [
    { href:"#products", currentUrl },
    { href:"mailto:info@7tool.ru", currentUrl },
    { href:"tel:+79626112419", currentUrl },
    { href:"https://example.com/", currentUrl },
    { href:"/catalog", currentUrl, ctrlKey:true },
    { href:"/catalog", currentUrl, button:1 },
    { href:"/catalog", currentUrl, target:"_blank" },
    { href:"/catalog", currentUrl, download:true },
  ]) assert.equal(resolveDocumentNavigation(options), null);
});

test("fallback is explicitly enabled only by the isolated test process", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const clientNavigation = await readFile(new URL("../app/data/clientNavigation.ts", import.meta.url), "utf8");
  const processConfig = await readFile(new URL("../ecosystem.test.config.cjs", import.meta.url), "utf8");
  assert.match(layout, /process\.env\.FORCE_DOCUMENT_NAVIGATION === "1"/u);
  assert.match(layout, /<DocumentNavigationFallback \/>/u);
  assert.match(layout, /data-document-navigation=\{forceDocumentNavigation \? "true" : undefined\}/u);
  assert.match(clientNavigation, /window\.location\.assign\(href\)/u);
  assert.match(clientNavigation, /window\.location\.reload\(\)/u);
  assert.match(processConfig, /FORCE_DOCUMENT_NAVIGATION: "1"/u);
});
