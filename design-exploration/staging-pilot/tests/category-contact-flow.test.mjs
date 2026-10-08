import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("burr quick filters prioritize manufacturer and omit the duplicated shape row", async () => {
  const source = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  const profiles = await readFile(new URL("../app/data/categoryExpertProfiles.mjs", import.meta.url), "utf8");
  assert.match(source, /selectCategoryFacets\(slug, result\.facets/u);
  assert.match(profiles, /"borfrezy"[\s\S]*promotedFacetKeywords:\["brand", "материал", "диаметр режущей"\]/u);
  assert.doesNotMatch(profiles.slice(profiles.indexOf('"borfrezy"'), profiles.indexOf('"truborezy"')), /promotedFacetKeywords:[^\n]*"форма"/u);
});

test("guided selection asks for a phone after the preliminary result", async () => {
  const source = await readFile(new URL("../app/ui/BurrSelectionAssistant.tsx", import.meta.url), "utf8");
  assert.match(source, /<ContactRequestDialog/u);
  assert.match(source, /buttonLabel="Консультация с инженером"/u);
  assert.match(source, /<button className="button burr-result-secondary"/u);
  assert.ok(source.indexOf("Консультация с инженером") < source.indexOf("Показать подходящие товары"));
});

test("send parameters opens a local callback form instead of composing an email", async () => {
  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  const assistant = await readFile(new URL("../app/ui/CategorySelectionAssistant.tsx", import.meta.url), "utf8");
  const dialog = await readFile(new URL("../app/ui/ContactRequestDialog.tsx", import.meta.url), "utf8");
  const shortForm = await readFile(new URL("../app/ui/TestRequestForm.tsx", import.meta.url), "utf8");
  assert.match(page, /<CategorySelectionAssistant/u);
  assert.match(assistant, /primaryContact="phone"/u);
  assert.match(assistant, /Передать задачу инженеру/u);
  assert.match(dialog, /Телефон для связи/u);
  assert.match(dialog, /defaultChecked required/u);
  assert.doesNotMatch(dialog, /name="comment"[^>]*required/u);
  assert.doesNotMatch(shortForm, /name="comment"[^>]*required/u);
  assert.match(dialog, /event\.preventDefault\(\)/u);
  assert.doesNotMatch(dialog, /mailto:/u);
  for (const source of [dialog, shortForm]) {
    assert.match(source, /fetch\("\/api\/quote-requests"/u);
    assert.match(source, /formData\.set\("request_type", "selection"\)/u);
    assert.match(source, /formData\.set\("idempotency_key"/u);
    assert.match(source, /result\.requestNumber/u);
    assert.match(source, /name="consent"[^>]*defaultChecked required/u);
    assert.doesNotMatch(source, /ничего не отправляет/u);
    assert.doesNotMatch(source, /fetch\("https?:/u);
  }
});

test("catalog recovery CTAs keep task context and provide a native specification upload path", async () => {
  const catalog = await readFile(new URL("../app/catalog/page.tsx", import.meta.url), "utf8");
  const task = await readFile(new URL("../app/catalog/task/[task]/page.tsx", import.meta.url), "utf8");
  for (const source of [catalog, task]) {
    assert.match(source, /#quick-order/u);
    assert.match(source, /Описать задачу/u);
    assert.match(source, /request=spec/u);
    assert.match(source, /Передать ТЗ файлом/u);
  }
});

test("selection criteria align the manager with the first parameter row", async () => {
  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /subcategory-layout--selection/u);
  assert.match(styles, /grid-template-areas:"heading \." "criteria manager" "note manager"/u);
  assert.match(styles, /\.selection-criteria-list li \{[^}]*min-height:108px/us);
  assert.match(styles, /\.subcategory-layout--selection \.manager-contact-head \{[^}]*min-height:108px/us);
});

test("positive feed availability uses a dedicated readable green status", async () => {
  const card = await readFile(new URL("../app/ui/FeedProductCard.tsx", import.meta.url), "utf8");
  const table = await readFile(new URL("../app/ui/FeedProductTable.tsx", import.meta.url), "utf8");
  const availability = await readFile(new URL("../app/ui/FeedAvailability.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(card, /<FeedAvailability/u);
  assert.match(table, /<FeedAvailability/u);
  assert.match(availability, /feed-availability--positive/u);
  assert.match(availability, /shippingPromise\.detail/u);
  assert.match(styles, /\.feed-availability--positive \{[^}]*color:#087044!important[^}]*font-weight:650!important/us);
  assert.match(styles, /\.feed-availability-block>small \{[^}]*font-size:9px/us);
});

test("the shape-help link opens and focuses the guided selector", async () => {
  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  const selector = await readFile(new URL("../app/ui/BurrSelectionAssistant.tsx", import.meta.url), "utf8");
  assert.match(page, /href="#burr-selector">Не знаете форму\? Подобрать по задаче/u);
  assert.match(selector, /detailsRef\.current\.open = true/u);
  assert.match(selector, /a\[href="#burr-selector"\]/u);
  assert.match(selector, /firstTaskRef\.current\?\.focus/u);
});

test("burr promoted filters wrap instead of hiding options", async () => {
  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  const controls = await readFile(new URL("../app/ui/PromotedFilterControls.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const promotedFilters = page.slice(page.indexOf("feed-promoted-filters"), page.indexOf('<div className="feed-catalog-layout">'));
  assert.match(promotedFilters, /return <PromotedFilterLink className=\{selected/u);
  assert.doesNotMatch(promotedFilters, /return <Link className=\{selected/u);
  assert.match(controls, /window\.location\.assign\(href\)/u);
  assert.match(controls, /toggle\.checked = true/u);
  assert.match(styles, /\.feed-promoted-filters--burr>div>div \{[^}]*flex-wrap:wrap[^}]*overflow:visible/us);
  assert.match(styles, /\.feed-promoted-filters--burr>div:nth-child\(4\) \{[^}]*grid-column:1\/3/us);
});

test("category quick filters lead directly into results and keep help progressively disclosed", async () => {
  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  const list = await readFile(new URL("../app/ui/FeedProductList.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.doesNotMatch(page, /category-live-summary/u);
  assert.match(page, /className="feed-results" id="feed-results-list"/u);
  assert.match(page, /after=\{inlineSelectionAssistant\}/u);
  assert.match(list, /insertionIndex = Math\.min\(layout === "grid" \? 3 : 2, products\.length - 1\)/u);
  assert.match(styles, /\.category-feed-assistant \{[^}]*grid-column:1\/-1/us);
  assert.match(styles, /\.feed-promoted-filters>div:not\(\.feed-priority-choice\)>div \{[^}]*flex-wrap:nowrap[^}]*overflow-x:auto/us);
});

test("variant articles link to the exact execution and availability copy cannot collapse inline", async () => {
  const card = await readFile(new URL("../app/ui/FeedProductCard.tsx", import.meta.url), "utf8");
  const table = await readFile(new URL("../app/ui/FeedProductTable.tsx", import.meta.url), "utf8");
  const picker = await readFile(new URL("../app/ui/VariantPickerDialog.tsx", import.meta.url), "utf8");
  const availability = await readFile(new URL("../app/ui/FeedAvailability.tsx", import.meta.url), "utf8");
  const product = await readFile(new URL("../app/product/[slug]/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(card, /image:variant\.image, href:variant\.href/u);
  assert.match(table, /image:variant\.image, href:variant\.href/u);
  assert.match(picker, /href=\{selected\.href\}/u);
  assert.match(picker, /href:selected\.href/u);
  assert.match(product, /feed-variant-card--selected/u);
  assert.match(availability, /return <div className="feed-availability-block">/u);
  assert.match(styles, /\.feed-availability-block>small \{[^}]*display:block!important[^}]*margin:0!important/us);
});

test("applied filters and clear-all use reliable navigation", async () => {
  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  const appliedFilters = page.slice(page.indexOf('className="feed-applied-filters"'), page.indexOf("{result.products.length"));
  assert.match(appliedFilters, /<PromotedFilterLink className="feed-reset-all"/u);
  assert.match(appliedFilters, /filters\[facet\.key\].*<PromotedFilterLink/us);
  assert.doesNotMatch(appliedFilters, /<Link/u);
});

test("selection criteria end with one compact conversion block", async () => {
  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  const block = await readFile(new URL("../app/ui/SelectionConversionBlock.tsx", import.meta.url), "utf8");
  const dialog = await readFile(new URL("../app/ui/ContactRequestDialog.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /<SelectionConversionBlock categoryTitle=/u);
  assert.match(block, /Отправить параметры на проверку/u);
  assert.match(block, /telegramUrl/u);
  assert.match(block, /maxUrl/u);
  assert.match(dialog, /buttonLabel = "Отправить параметры →"/u);
  assert.match(styles, /grid-template-areas:"heading \." "criteria manager" "note manager" "conversion manager"/u);
});

test("product cards use readable actions and make media and titles the product navigation", async () => {
  const card = await readFile(new URL("../app/ui/FeedProductCard.tsx", import.meta.url), "utf8");
  const list = await readFile(new URL("../app/ui/FeedProductList.tsx", import.meta.url), "utf8");
  const table = await readFile(new URL("../app/ui/FeedProductTable.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(card, /<a className="feed-product-media" href=/u);
  assert.match(card, /<h3><a href=/u);
  assert.doesNotMatch(card, /feed-all-characteristics/u);
  assert.match(list, /<FeedProductCard product=\{product\}/u);
  assert.match(card, /href=\{`\/p\/\$\{product\.slug\}`\}/u);
  assert.doesNotMatch(table, /feed-all-characteristics/u);
  assert.doesNotMatch(card, /from "next\/link"/u);
  assert.doesNotMatch(list, /from "next\/link"/u);
  assert.match(styles, /\.feed-product-identity h3>a \{[^}]*display:block/us);
  assert.match(styles, /\.feed-product-actions button,\.feed-product-actions>a \{[^}]*font-size:11px/us);
  assert.match(styles, /\.contact-dialog-panel input,\.contact-dialog-panel textarea \{[^}]*font-size:14px/us);
});

test("listing actions use a restrained two-level CTA palette", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /--cta:#c94a12/u);
  assert.match(styles, /--action-dark:#252925/u);
  assert.match(styles, /\.feed-product-actions button,\.feed-table-actions \.feed-variant-toggle[^}]*background:var\(--action-dark\)/us);
  assert.match(styles, /\.button-orange,\.request-cart-trigger[^}]*background:var\(--cta\)/us);
});

test("drilling machines expose the three decision-driving quick facets", async () => {
  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  const profiles = await readFile(new URL("../app/data/categoryExpertProfiles.mjs", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /selectCategoryFacets\(slug, result\.facets/u);
  assert.match(profiles, /"stanki-sverlilnye"[\s\S]*promotedFacetKeywords:\["brand", "макс\. диаметр", "шпиндель"\]/u);
  assert.match(page, /feed-promoted-filters--equipment/u);
  assert.match(styles, /\.feed-promoted-filters--equipment>div>div \{[^}]*flex-wrap:wrap[^}]*overflow:visible/us);
  const catalog = await readFile(new URL("../app/data/feedCatalog.ts", import.meta.url), "utf8");
  assert.match(catalog, /getCategoryFacetKeywords\(slug\)/u);
});

test("drilling selector is integrated and maps to persistent numeric filters", async () => {
  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  const catalog = await readFile(new URL("../app/data/feedCatalog.ts", import.meta.url), "utf8");
  const selector = await readFile(new URL("../app/ui/DrillSelectionAssistant.tsx", import.meta.url), "utf8");
  assert.match(page, /selectorHref = slug === "borfrezy" \? "#burr-selector" : slug === "stanki-sverlilnye" \? "#drill-selector" : "#category-selector"/u);
  assert.match(page, /<DrillSelectionAssistant/u);
  assert.match(page, /name=\{`min_\$\{key\}`\}/u);
  assert.match(page, /facet\?\.label \?\? "Параметр"[^\n]*не менее \{value\}/u);
  assert.match(catalog, /numericMinimums\?: Record<string, number>/u);
  assert.match(catalog, /parseNumericValue\(value\) >= numericMinimums\[facet\.key\]/u);
  assert.match(selector, /a\[href="#drill-selector"\]/u);
});

test("engineer-first selection offers a direct specification upload path", async () => {
  const [selector, home, workbench] = await Promise.all([
    readFile(new URL("../app/ui/CategorySelectionAssistant.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/ProcurementWorkbench.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(selector, /request=spec/u);
  assert.match(selector, /Передать ТЗ файлом/u);
  assert.match(home, /initialTool/u);
  assert.match(workbench, /initialTool \?\? "task"/u);
});

test("an exact category result can be added without an extra reveal", async () => {
  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  const list = await readFile(new URL("../app/ui/FeedProductList.tsx", import.meta.url), "utf8");
  const card = await readFile(new URL("../app/ui/FeedProductCard.tsx", import.meta.url), "utf8");
  assert.match(page, /<FeedProductList products=\{productCards\} layout=\{desktopView\} mobileLayout=\{mobileView\} after=\{inlineSelectionAssistant\} \/>/u);
  assert.doesNotMatch(list, /directSingleVariant/u);
  assert.match(card, /product\.selectedVariantCount === 1 \? product\.variants\[0\]/u);
  assert.match(card, /<AddRequestButton className="feed-quote-primary" openAfterAdd[^>]*directVariant\.id[\s\S]*>Получить КП<\/AddRequestButton>/u);
  assert.doesNotMatch(card, /feed-quote-secondary|>В запрос<\/AddRequestButton>/u);
  assert.doesNotMatch(card, /QuickOrderDialog|feed-quote-quick/u);
});

test("guided selectors make engineer consultation primary and product results secondary", async () => {
  const sources = await Promise.all([
    readFile(new URL("../app/ui/CategorySelectionAssistant.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/BurrSelectionAssistant.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/DrillSelectionAssistant.tsx", import.meta.url), "utf8"),
  ]);
  for (const source of sources) {
    assert.match(source, /buttonLabel="Консультация с инженером"/u);
    assert.match(source, /className="button burr-result-secondary"/u);
    assert.ok(source.indexOf("Консультация с инженером") < source.indexOf("burr-result-secondary"));
  }
});
