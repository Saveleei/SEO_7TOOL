# SEO Implementation Report

## Executive summary

SEO foundation и backward compatibility опубликованы на production 2026-10-05 релизом `7a24266`. Каноническая архитектура сохраняет существующие `/c`, `/p` и `/brand` URL; все 18 544 URL из sitemap до cutover имеют проверяемое назначение. Preview aliases перенаправляются одним 308 с сохранением query. Добавлены brand/subcategory pages, retained lifecycle для 51 отсутствующего в feed товара, image sitemap data, CollectionPage schema, custom 404, юридические страницы/consent links, field CWV, рекламная атрибуция и URL coverage gate.

## Post-launch audit — 2026-10-05

- Production `https://7tool.ru/` доступен, HTTP и `www` переводятся на HTTPS non-www; точный production host не имеет `noindex`.
- Опубликованный sitemap содержит 19 330 canonical URL и 18 341 image entry против 18 544 URL в зафиксированном sitemap до cutover.
- Representative `/p`, `/c` и `/brand` возвращают `200`; `/product` и `/catalog/category` дают один постоянный `308` с сохранением `yclid`, UTM и `variant`.
- Из frozen legacy inventory вне sitemap остаются только `/kontakty` с одним `308`, две юридические страницы до подтверждения владельца и пять URL конфликтного G1031. Все они имеют безопасное назначение и не дают массовых 404.
- Публичный `/feeds/yandex-dynamic.xml` возвращает `200`, но независимая сверка выявила устаревшие коммерческие данные; этот риск описан отдельно ниже.

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
- Category, subcategory, brand, current + retained product and verified public information pages. Privacy/consent URLs remain accessible but noindex and outside sitemap until owner verification.
- Product images добавлены в sitemap entries.
- Draft, P0, search, compare, test, API, redirects и параметры исключены.
- Фиктивный `lastmod` не создаётся; split index не требуется при объёме менее 50 000 URL.

## Yandex advertising feed

- Добавлена команда `npm run feed:audit`, которая сверяет YML с тем же catalog snapshot, что использует storefront: offer/variant identity, canonical URL, price, availability, currency, category, image, name, brand and SKU.
- Live feed на момент проверки содержит дату генерации `2026-09-11 07:15` и 3 993 offers. На bundled snapshot релиза найдено: 5 неизвестных offers, 50 price mismatches, 114 availability mismatches, 10 category mismatches, 82 image mismatches и 6 name mismatches.
- 3 988 распознанных offers ведут на рабочие URL с `?variant=`, но не на self-canonical variant URLs. Сайт сохраняет эти переходы, однако следующая генерация должна сразу выдавать canonical `/p/...` URL.
- Из 4 070 пригодных к рекламе variants bundled snapshot только 3 872 представлены корректно распознанными активными offers; 198 отсутствуют. Эти числа требуется повторить на текущем production snapshot перед переключением генератора.
- Текущий feed пока остаётся legacy bridge: заменять его автоматически нельзя до подтверждения legal seller и проверки preview-фида на активном production catalog.

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

Исправлено распознавание canonical `/c` и `/p`. Сохраняются view_category, view_product, contact, search, compare, add/remove quote, submit/success/error flows. Персональные поля sanitization не пропускает. First-touch и last-non-direct attribution сохраняются локально и передаются только вместе с добровольно отправленной заявкой. Сохраняются UTM, `yclid`, landing page, очищенный referrer, internal/session IDs и ClientID Метрики; произвольные query и внешние landing URLs отбрасываются серверной валидацией.

## Tests / gates

- Frozen legacy coverage: 18 544/18 544 classified; gaps = 0.
- Public URL contract: exact variants, sitemap owners, one-hop redirects, internal-link aliases.
- Technical SEO: host/indexing, canonical/noindex, sitemap, structured data, 404, conflict quarantine.
- Analytics: canonical page views, Metrica guard, field CWV.
- Full unit/integration suite after adding the feed parity guard: 383/383. SEO coverage: 18 544/18 544 classified with zero routing gaps; live production sitemap contains 19 330 canonical/indexable URLs and 18 341 image entries. `data:check`: `PASS_WITH_QUARANTINE`. Vinext production build passed for the deployed release. Changed feed-audit files pass ESLint with 0 errors/warnings; the full release lint retained only the existing `no-img-element` warning for the Metrica noscript pixel.
- Raw `tsc --noEmit` не является поддерживаемой командой проекта и падает на существующей Vinext/API typing baseline; поддерживаемый Vinext build проходит.

## Remaining risks

1. G1031 supplier source conflict.
2. 51 retained product lifecycle decisions.
3. 803 P1 and 2 906 P2 affected products.
4. Legal entity/NAP/privacy text confirmation.
5. Legacy advertising feed устарел относительно storefront и всё ещё зависит от процесса на `127.0.0.1:3108`.
6. Non-atomic upstream JSON/SQLite publication, provenance and GTIN checksum.
7. Production field data только начинает накапливаться после запуска.

## External actions required

- Утвердить legal seller/NAP/ИНН/КПП/ОГРН и тексты privacy/consent.
- Исправить G1031 в supplier source; rerun generator + checks.
- Повторно отправить sitemap и выполнить fixture crawl в Webmaster/Search Console, затем настроить Metrica/Merchant Center и проверить rich results.
- Подтвердить legal seller для YML, сформировать preview-фид из активного production catalog, добиться `PASS` по `feed:audit` и только после этого заменить legacy bridge.
- Наблюдать index coverage, redirects, CWV, P0 quarantine и organic conversions; rollback при отклонении guard metrics.
