# SEO Implementation Report

## Executive summary

Repository-side SEO foundation и backward compatibility завершены без публикации. Каноническая архитектура сохраняет существующие `/c`, `/p` и `/brand` URL; все 18 544 URL из live sitemap 7tool.ru имеют проверяемое назначение. Preview aliases перенаправляются одним 308. Добавлены brand/subcategory pages, retained lifecycle для 51 отсутствующего в feed товара, image sitemap data, CollectionPage schema, custom 404, юридические страницы/consent links, field CWV и URL coverage gate.

## Critical problems found

- Риск потери индексируемых URL при публикации preview-маршрутов — устранён в коде и автоматизированной проверке.
- 51 опубликованная product page отсутствовала в новом feed — сохранена без выдуманной цены/наличия.
- Девять draft items попадали в public catalog — исключены.
- G1031 содержит title/spec conflicts — guard работает, upstream correction ещё требуется.
- Preview по-прежнему закрыт — это правильный prelaunch state, не ошибка.

## Data quality

Public snapshot: 24 categories / 4 274 products / 18 343 variants. Quality report: P0 3 issues/1 product, P1 983/803, P2 6 971/2 906 (issues/affected products). `data:check` должен возвращать `PASS_WITH_QUARANTINE`, пока G1031 не исправлен. Новые SEO-страницы не строятся поверх blocking conflict.

## Technical SEO / indexation

- Canonical production owners: `/c`, `/c/[category]/[subcategory]`, `/p`, `/brand`.
- Query/filter/sort/UI states: clean canonical + `noindex,follow`; invalid pagination = 404.
- Preview host защищён environment + exact-host guards.
- Custom 404 даёт понятный recovery path; route `notFound()` остаётся настоящим HTTP 404.
- Внутренние ссылки ведут сразу на canonical routes, без redirect hop.

## Legacy URL preservation

Frozen inventory: 18 544 URL — 6 static, 23 category, 121 subcategory, 87 brand, 18 307 product. Coverage gate подтверждает нулевые gaps/collisions. Пять G1031 URL намеренно не включаются в sitemap, пока источник конфликтует, но route остаётся безопасно доступен как noindex.

## Sitemap

- Только 200/self-canonical/indexable owners.
- Category, subcategory, brand, current + retained product and legal pages.
- Product images добавлены в sitemap entries.
- Draft, P0, search, compare, test, API, redirects и параметры исключены.
- Фиктивный `lastmod` не создаётся; split index не требуется при объёме менее 50 000 URL.

## Canonical / redirects

- Canonical централизован в `seo.ts`, очищает query/hash.
- `/product/[slug]` → `/p/[slug]` и `/catalog/category/[slug]` → `/c/[slug]`: one-hop 308, query сохраняется.
- `/kontakty` → `/contacts`; `/consent` → `/soglasie-na-obrabotku`.
- Уже индексируемые `/p`, `/c`, `/brand` остаются 200 и не перенаправляются.

## Metadata

Центральный generator формирует title, description, canonical, robots, Open Graph и Twitter. Category, subcategory, product, retained product и brand templates используют фактические данные. Параметризованные страницы не могут случайно стать indexable.

## Product SEO

- 4 274 feed products и точные variant slugs.
- Product/Offer schema использует те же visible facts; Offer только при valid price + confirmed availability.
- Breadcrumbs связывают товар с category и brand.
- 51 retained page сохраняет модель/SKU/brand/category/image, но не показывает stale price/availability; предлагает подтвердить поставку или замену.
- Blocking conflict скрывает Product JSON-LD, включает noindex и visible warning.

## Categories / subcategories

- 24 main categories и 125 data-backed subcategories.
- SSR H1/intro, real product set, crawlable pagination, filters, FAQ where meaningful, internal links.
- CollectionPage + ItemList только на canonical state; filter/query states остаются noindex.

## Brands

87 current brand hubs с SSR product list, category links, pagination, informative metadata and CollectionPage/ItemList. Alias normalization не создаёт дубликаты. Brand×category combinations не публикуются автоматически.

## Programmatic SEO / cannibalization

Mass filter landings не создавались. 121 live subcategory были восстановлены только при реальном ассортименте и distinct curated definition. Content/semantic/cannibalization документы задают owner types; новый intent требует review.

## Internal linking / compatibility / comparisons

Product → category/brand/alternative; category → subcategory/product; brand → category/product; task → category. Compatibility и comparison используют только нормализованные факты, без выдуманных связей или оценочного «лучше».

## Structured data

Organization, WebSite, BreadcrumbList, Product, conditional Offer, CollectionPage and ItemList. Fake ratings/reviews/shipping/return policy отсутствуют. JSON-LD безопасно сериализуется. Финальный Organization legalName/NAP остаётся owner verification gate.

## Yandex / Google / AI Search

Repository controls готовы. Внешние действия описаны в `YANDEX_SEO_SETUP.md` и `GOOGLE_SEO_SETUP.md`. AI/AEO основаны на SSR facts, связях entities и явных ограничениях, без специальных hacks.

## Images / performance

Product images включены в sitemap, UI использует responsive Next image components там, где это применимо. Добавлен field `web_vital` event через `useReportWebVitals`; событие содержит только allowlisted metric data и не влияет на buying flow. Осталось baseline warning для noscript pixel Яндекс Метрики.

## Analytics

Исправлено распознавание canonical `/c` и `/p`. Сохраняются view_category, view_product, contact, search, compare, add/remove quote, submit/success/error flows. Персональные поля sanitization не пропускает. First-touch persistent attribution не включена без утверждённого consent режима.

## Tests / gates

- Frozen legacy coverage: 18 544/18 544 classified; gaps = 0.
- Public URL contract: exact variants, sitemap owners, one-hop redirects, internal-link aliases.
- Technical SEO: host/indexing, canonical/noindex, sitemap, structured data, 404, conflict quarantine.
- Analytics: canonical page views, Metrica guard, field CWV.
- Full unit/integration suite: 377/377 passed. SEO suite: 32/32 passed plus 18 544-URL coverage with zero gaps. `data:check`: `PASS_WITH_QUARANTINE`. Vinext production build passed. ESLint: 0 errors, 1 existing `no-img-element` warning for the Metrica noscript pixel.
- Raw `tsc --noEmit` не является поддерживаемой командой проекта и падает на существующей Vinext/API typing baseline; поддерживаемый Vinext build проходит.

## Remaining risks

1. G1031 supplier source conflict.
2. 51 retained product lifecycle decisions.
3. 803 P1 and 2 906 P2 affected products.
4. Legal entity/NAP/privacy text confirmation.
5. Non-atomic upstream JSON/SQLite publication, provenance and GTIN checksum.
6. Нет production field data до запуска.

## External actions required

- Утвердить legal seller/NAP/ИНН/КПП/ОГРН и тексты privacy/consent.
- Исправить G1031 в supplier source; rerun generator + checks.
- Выбрать production cutover, включить indexing только для точного `7tool.ru`, проверить headers/robots/sitemap до DNS/proxy switch.
- После публикации выполнить fixture crawl, Webmaster/Search Console/Metrica/Merchant Center setup и rich-result validation.
- Наблюдать index coverage, redirects, CWV, P0 quarantine и organic conversions; rollback при отклонении guard metrics.
