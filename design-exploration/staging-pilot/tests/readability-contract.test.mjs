import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesUrl = new URL("../app/globals.css", import.meta.url);

test("the final readability contract defines one shared cross-page type scale", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  const marker = "/* Cross-page readability contract.";
  const contractStart = styles.lastIndexOf(marker);

  assert.ok(contractStart >= 0, "readability contract is missing");
  assert.equal(styles.indexOf(marker), contractStart, "readability contract must have a single source of truth");

  const contract = styles.slice(contractStart);
  assert.match(contract, /--type-caption:12px/u);
  assert.match(contract, /--type-secondary:13px/u);
  assert.match(contract, /--type-control:14px/u);
  assert.match(contract, /--type-body:15px/u);
  assert.match(contract, /--type-reading:16px/u);
  assert.match(contract, /--control-min-height:44px/u);
  assert.doesNotMatch(contract, /font-size:(?:[6-9]|10|11)px/u);
});

test("critical catalog, product, contact, search and public-page text uses the shared scale", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  const contract = styles.slice(styles.lastIndexOf("/* Cross-page readability contract."));

  assert.match(contract, /\.feed-product-table th,\.feed-product-table td \{ font-size:var\(--type-secondary\)/u);
  assert.match(contract, /\.feed-table-product>div>a \{ font-size:var\(--type-control\)/u);
  assert.match(contract, /\.feed-mobile-series-head b,\.feed-mobile-series-head>div>a \{ font-size:var\(--type-body\)/u);
  assert.match(contract, /\.feed-filter-search input,[\s\S]*font-size:var\(--type-control\)/u);
  assert.match(contract, /\.feed-product-actions button,\.feed-product-actions>a \{ min-height:var\(--control-min-height\); font-size:var\(--type-control\)/u);
  assert.match(contract, /\.feed-product-actions \{ grid-template-columns:1fr; \}/u);
  assert.match(contract, /\.feed-product-conversion-page \.request-unified-demo>b \{ color:#fff; \}/u);
  assert.match(contract, /@media \(min-width:1380px\)[\s\S]*\.feed-category-listing>\.container \{ width:min\(1600px,calc\(100% - 64px\)\)/u);
  assert.match(contract, /\.feed-product-kind,\.feed-product-task-label \{ font-size:var\(--type-caption\)/u);
  assert.match(contract, /\.feed-selected-variant>span,\.feed-selected-variant>small,[\s\S]*font-size:var\(--type-caption\)/u);
  assert.match(contract, /\.manager-contact-direct b \{ font-size:var\(--type-control\)/u);
  assert.match(contract, /\.search-product-main>p \{ font-size:var\(--type-control\)/u);
  assert.match(contract, /\.public-info-card-grid p,[\s\S]*font-size:var\(--type-control\)/u);
  assert.match(contract, /\.public-direction-showcase span,\.public-direction-showcase small,[\s\S]*font-size:var\(--type-caption\)/u);
  assert.match(contract, /\.contact-dialog-panel input,\.contact-dialog-panel textarea \{ font-size:var\(--type-reading\)/u);
  assert.match(contract, /\.comparison-table thead th:first-child,\.comparison-table tbody th \{ font-size:var\(--type-secondary\)/u);
  assert.match(contract, /\.comparison-table td small \{ font:700 var\(--type-caption\)/u);
});

test("mobile dense controls retain readable targets and discoverable horizontal rails", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  const contract = styles.slice(styles.lastIndexOf("/* Cross-page readability contract."));

  assert.match(contract, /@media \(max-width:760px\)[\s\S]*\.feed-filter-panel fieldset label \{ min-height:40px/u);
  assert.match(contract, /\.feed-mobile-series-commercial i \{ justify-content:center/u);
  assert.match(contract, /scroll-padding-inline:14px 38px/u);
  assert.match(contract, /\.product-jumpnav \.container \{ gap:24px; padding-right:38px/u);
  assert.match(styles, /\.compare-scroll \{ overflow:auto;[\s\S]*scroll-padding-inline:14px 44px/u);
  assert.match(styles, /\.compare-scroll-hint \{ display:block;[\s\S]*font-size:13px/u);
  assert.match(contract, /\.catalog-hero h1 \{[\s\S]*overflow-wrap:break-word;[\s\S]*hyphens:auto;/u);
  assert.match(contract, /@media \(max-width:340px\) \{[\s\S]*\.section-heading h2,\.assurance-section \.section-heading h2 \{ font-size:27px; \}/u);
});

test("desktop quote count stays readable without enlarging the header action", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /\.header-row>\.request-cart-trigger b \{[^}]*box-sizing:border-box;[^}]*min-width:22px;[^}]*height:22px;[^}]*padding:0 5px;[^}]*font-size:12px;[^}]*font-variant-numeric:tabular-nums;/u);
  assert.match(styles, /\.request-cart-trigger \{ min-height:44px;/u);
});

test("email remains directly available in the desktop header and mobile catalog menu", async () => {
  const [header, menu, styles] = await Promise.all([
    readFile(new URL("../app/ui/PilotHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/HeaderCatalogMenu.tsx", import.meta.url), "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.match(header, /className="header-email"[^>]*mailto:\$\{siteContact\.email\}/u);
  assert.match(menu, /header-catalog-service-links[\s\S]*mailto:\$\{siteContact\.email\}[\s\S]*Email: \{siteContact\.email\}/u);
  assert.match(styles, /\.header-email \{ min-height:44px;[^}]*display:flex;/u);
  assert.match(styles, /@media \(min-width:1280px\) \{\s*\.header-row \{ grid-template-columns:132px auto minmax\(220px,1fr\) auto auto auto auto auto;/u);
});
