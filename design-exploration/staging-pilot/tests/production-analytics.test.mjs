import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveYandexMetrikaId } from "../app/data/analyticsConfig.mjs";

test("Metrica is enabled only for an indexable non-test production contour", () => {
  assert.equal(resolveYandexMetrikaId({ SEO_INDEXING_ENABLED:"1", QUOTE_TEST_MODE:"0", YANDEX_METRIKA_ID:"109097461" }), 109097461);
  assert.equal(resolveYandexMetrikaId({ SEO_INDEXING_ENABLED:"0", QUOTE_TEST_MODE:"0", YANDEX_METRIKA_ID:"109097461" }), null);
  assert.equal(resolveYandexMetrikaId({ SEO_INDEXING_ENABLED:"1", QUOTE_TEST_MODE:"1", YANDEX_METRIKA_ID:"109097461" }), null);
  assert.equal(resolveYandexMetrikaId({ SEO_INDEXING_ENABLED:"1", QUOTE_TEST_MODE:"0", YANDEX_METRIKA_ID:"not-a-counter" }), null);
});

test("the production counter reuses the existing ecommerce dataLayer and has a noscript fallback", async () => {
  const source = await readFile(new URL("../app/ui/YandexMetrika.tsx", import.meta.url), "utf8");
  assert.match(source, /https:\/\/mc\.yandex\.ru\/metrika\/tag\.js/u);
  assert.match(source, /ecommerce:"dataLayer"/u);
  assert.match(source, /https:\/\/mc\.yandex\.ru\/watch\/\$\{counterId\}/u);
});

test("canonical catalog routes emit page views and field Core Web Vitals", async () => {
  const [conversion, vitals, sanitizer, layout] = await Promise.all([
    readFile(new URL("../app/ui/ConversionAnalytics.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/WebVitalsAnalytics.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/conversionAnalytics.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(conversion, /\^\\\/c\\\/\(\[\^\/\]\+\)/u);
  assert.match(conversion, /\^\\\/p\\\/\(\[\^\/\]\+\)/u);
  assert.match(vitals, /useReportWebVitals/u);
  assert.match(vitals, /event:"web_vital"/u);
  assert.match(sanitizer, /"metric_value"/u);
  assert.match(layout, /<WebVitalsAnalytics \/>/u);
});
