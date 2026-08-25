# Full Technical SEO Audit — 7TOOL

Дата исходного baseline: 24 августа 2026 года. Аудит основан на исходном коде, локальном snapshot/SQLite, существующих project reports и выборочной проверке production HTML. Исторические baseline-наблюдения сохранены ниже; актуальный acceptance-статус приведён первым.

## PHASE 0–1 acceptance update — 26 августа 2026 года

- Git baseline и rollback chain существуют; `master` синхронизирован с `origin/master`, HEAD `b19e5da`.
- Последний release с consolidation дублей развёрнут в production атомарно; предыдущий release и backup БД сохранены.
- Полный project test suite: `140 passed`, `0 failed`.
- Репрезентативный внешний SEO check: 24 категории, 3 625 публичных товарных групп и 87 брендов в текущем локальном snapshot; `P0 = 0`, `P1 = 0`, findings отсутствуют.
- Live check подтвердил доступность и валидность `robots.txt`, основного sitemap, image sitemap, системных URL, категорий, брендов и выборки товаров, а также sitemap/canonical/status invariants.
- `/consent` отвечает `308` на `/soglasie-na-obrabotku`; single-variant duplicate отвечает `308` на канонический product URL.
- Яндекс Вебмастер подключён: основной sitemap принят, image sitemap добавлен, Метрика `109097461` привязана, обход через Метрику включён.
- Полный последовательный `--full-live` crawl всех ~21 тыс. sitemap URL в этой сессии не завершался из-за длительности. Field CWV/CrUX, server logs и полный sitemap crawl остаются измерительными задачами, а не подтверждёнными дефектами.

## Production validation update — 25 августа 2026 года

- Усиленный live-аудит проверяет `robots.txt`, основной и image sitemap, XML/content-type, origin, дубли, parameter URLs, выборочные коды ответа, редиректы и соответствие canonical.
- `/image-sitemap.xml` развернут в production и отвечает `200`; `robots.txt` объявляет `https://7tool.ru/sitemap.xml` и `https://7tool.ru/image-sitemap.xml`.
- Итог внешней проверки `https://7tool.ru`: `P0 = 0`, `P1 = 0`, findings отсутствуют.
- Публичный PM2-процесс `7tool-prod` перезапущен из актуального release symlink; nginx продолжает использовать штатный upstream и security headers.
- Полный project test suite: 139 passed, 0 failed. Production build: 148 routes/pages.

Ниже сохранены исходные baseline-наблюдения; пункты, закрытые последующими фазами, следует читать вместе с этим обновлением.

## Historical summary and current disposition

| Priority | Finding | Impact | Required action |
|---|---|---|---|
| P0 | Git baseline отсутствовал | Нет безопасной ветки/rollback/diff baseline | **Closed:** baseline и commit chain созданы, remote синхронизирован |
| P0 | Local SQLite и JSON расходились | Невоспроизводимые build/migration/audit results | **Governance open:** feed/SQLite/JSON pipeline реализован; authoritative production policy требует утверждения |
| P0 | Supplier image rights/status не были представлены | Copyright and availability risk | **Gate implemented, approval open:** Media rights model существует, договорные права ещё подтверждает владелец |
| P1 | 912 live products lacked description; 654 lacked image | Thin/weak product pages and image SEO gaps | **Workflow implemented:** evidence-only enrichment; запрещено изобретать факты |
| P1 | Supplier images hotlink K2Tool S3 | LCP, reliability, rights, cache/format control | **Open:** licensed local/CDN rollout только после подтверждения прав |
| P1 | No GSC/Webmaster/GA ingestion found | Нет performance/quick-win feedback loop | **Partial:** import layers реализованы, Webmaster/Метрика подключены; GSC access/import остаётся внешним шагом |
| P1 | Duplicate-title groups and overlapping page types | Duplicate/cannibalization risk | **Closed in current controls:** redirects, canonical/sitemap dedupe, intent registry and semantic gates |
| P1 | Production sitemap/status validation отсутствовала | Unknown 404/redirect/soft-404/orphan coverage | **Partial:** live representative audit clean; полный crawl/log reconciliation ещё нужен |
| P2 | Critical image and listing payload CWV risks | Potential LCP/INP/TTFB regression | **Measurement open:** собрать field CWV/RUM/CrUX и профилировать по шаблонам |

## INDEXATION

- Source robots: `Allow: /`, disallow `/admin` and `/api`, Clean-param for UTM/yclid/gclid/openstat, Host and Sitemap.
- Metadata defaults index/follow; cart, favorites, not-found and invalid filters/pages are noindex.
- Faceted category URLs are `noindex, follow` and canonicalize to base category.
- `/lp/` stays reachable but noindex/canonical until reviewed; excluded from sitemap.
- Sitemap emits static pages, published categories/subcategories, brands and public product slugs. Based on current snapshot it must include at least 4 449 URLs before subcategories (6 static + 24 categories + 145 brands + 4 274 products), subject to public quality filters.
- Missing evidence: production sitemap URL count, all URL response codes, X-Robots-Tag, redirect chains, orphan pages, soft 404, crawl depth and server-log bot behavior.

Recommendation: run a sitemap-led and discovery crawl in both Googlebot smartphone and Yandex user-agent profiles; reconcile sitemap ↔ internal links ↔ 200 canonical indexable pages ↔ search-console coverage.

## ROBOTS AND HEADERS

Application security headers exist (HSTS, nosniff, SAMEORIGIN, referrer and permissions policies). No application-level X-Robots-Tag found. Verify reverse proxy does not override robots/cache/canonical behavior. Consider explicit cache rules for immutable Next assets, supplier/local images, sitemap and robots after production header audit.

## CANONICALS, PARAMETERS AND PAGINATION

- Homepage canonical renders as `https://7tool.ru` while browser URL is trailing-slash form; consistent normalization should be verified across redirects.
- Category/page and brand pagination have self-canonical page URLs.
- Facets canonicalize to the unfiltered URL.
- Product canonical is variant-aware in route metadata, while cards frequently link with `?variant=`. Client code rewrites history to variant slug; regression tests must verify query URL, variant slug, metadata, JSON-LD and redirects agree.
- `/catalog` redirects to `/#categories`, canonical homepage.

Risk: canonicalizing filtered pages is correct only while filters are not approved SEO landings. Never turn arbitrary query combinations indexable.

## HTTP CODES AND REDIRECTS

Source uses `notFound()` for unknown category/product/page and permanent redirects for legacy brand slugs/product variants. A production status matrix was not exhaustively crawled. Required fixtures: valid/invalid product, retired variant, unpublished category, legacy brand, excessive pagination, encoded paths, uppercase/trailing slash and parameter combinations.

## META, H1 AND CONTENT

Checked live samples have one H1, distinct title/description and canonical. Dynamic metadata exists for category/subcategory/product/brand/landing. Existing tests assert unique product URLs and subject SEO.

Risks:

- 912 live products have no source description; generated meta does not replace factual body value.
- 16 normalized duplicate-title groups need entity/intent review.
- Category/landing FAQ and SEO blocks are template-driven; uniqueness by string is not proof of original value.
- Root `keywords` meta is harmless but not a ranking control and should not drive strategy.
- No Article author/expert/evidence model exists.

## SITE STRUCTURE AND INTERNAL LINKS

Breadcrumbs, header catalog, category grids, subcategories, brands, related products and product/category CTAs provide a strong graph. Exact orphan count and crawl depth remain unknown. Future linking must map next user question and avoid linking noindex landing variants as SEO targets.

## FACETED NAVIGATION

Client filters cover brand, specification facets, sorting and pagination. Current noindex/canonical behavior is safe. Risks: combinatorial crawl through internal state/URLs, links with many variant parameters, and inconsistent filtered pagination. Add a formal facet registry: NON_INDEXABLE_FACET by default; INDEXABLE_SEO_LANDING only with stable inventory, demand, distinct intent, unique content and manual approval.

## SITEMAP

Implementation has correct separation of content types and lastmod sources; `/lp/` is excluded. Remaining risks: a single sitemap will eventually approach size/URL limits as content scales; product `lastModified` is shared catalog-file mtime rather than per-entity change. The earlier image-sitemap gap is closed: the route is live and the automated external audit now validates its response, namespaces, page membership and local rights-processed media URLs.

Before PHASE 9, split sitemap index by products/categories/brands/content/media and use trustworthy entity-level lastmod.

## STRUCTURED DATA

Live samples expose Organization/WebSite globally; category has BreadcrumbList/CollectionPage/FAQPage; product has Product/BreadcrumbList/FAQPage. Strength: schema matches visible templates and verified commerce fields. Risks: build/live offer mismatch, generic FAQ, missing shipping/returns when data unavailable, and lack of automated validation across samples. Never add unsupported ratings/reviews or invented availability.

## IMAGES

Live samples had alt text and explicit rendered dimensions; no missing alt in sampled homepage/category/product. All catalog images found in snapshot resolve to K2Tool S3 and are currently hotlinked. Critical risks: licensing, upstream downtime/URL changes, layout/format/caching control, duplicate assets and inability to create image sitemap/provenance. Homepage first product/hero image observed lazy-loaded; verify whether it is actual LCP.

Required future controls: rights gate, origin hash, local immutable object storage/CDN, responsive derivatives, contextual alt, width/height, no lazy-load for confirmed LCP, and RESEARCH_ONLY enforcement.

## PERFORMANCE / CORE WEB VITALS

Positive architecture: Next SSR/SSG, compression, source maps off, explicit image sizing, one build worker to limit memory. Risks: external images, large catalog snapshot, thousands of prerenders, cache-miss regeneration, client filters/product cards, global analytics/manager widgets and repeated live-price hydration.

No numerical LCP/CLS/INP/TTFB conclusion is possible without field data. Required baseline: CrUX/PageSpeed for representative templates, Yandex Metrika performance/RUM if available, server TTFB/cache logs, JS/CSS bundle report and mobile throttled lab runs. Targets: p75 LCP ≤2.5s, INP ≤200ms, CLS ≤0.1.

## ANALYTICS

Yandex Metrika is implemented with ecommerce, goals, SPA pageviews, attribution and offline conversion queue. `webvisor:false`. No GA4/GTM scripts detected in live sample or source. No GSC/Yandex Webmaster query ingestion exists. Verify counter ownership, consent/legal basis, goal definitions, bot filtering, revenue reconciliation and PII allowlist before expanding events.

## FORMS AND CONVERSION

Forms include category selection, landing two-step lead, contact, one-click purchase/cart and price-match paths. API persists lead first, attributes it and queues notifications. Security/quality controls exist in tests. Missing for SEO intelligence: article/opportunity/cluster/CTA IDs, qualification, quote/order/revenue/margin lifecycle and CRM reconciliation.

## DUPLICATION AND CANNIBALIZATION

Current high-risk families:

- category vs subcategory vs `/lp/` selection pages;
- product group vs variant query/slug URLs;
- brand pagination vs category filtered by brand;
- repeated generated FAQ/SEO text across catalog;
- identical product titles representing separate feed entities.

The existing landing decision engine is a good hard gate. Extend it to every new content type and block publication on HIGH risk.

## PRODUCT PAGE QUALITY

Commercial UX is strong: price/stock, SKU/EAN, media, variants/specs, lead CTAs, manager, FAQ and related products. Knowledge quality is incomplete: no fact provenance, compatibility graph, verified limitations, applications or expert reviewer. Enrichment must be evidence-based; missing source data becomes `FACT_REQUIRED`.

## CATEGORY PAGE QUALITY

Categories combine selection, products, subcategories, explanatory content and FAQ. This is better than thin listing pages. Remaining risks are templated sameness, very large category inventories, generic statements, client-side interaction cost and no SERP/demand-based differentiation proof.

## TEST COVERAGE

Baseline audit run: 28 tests passed, 0 failed. Current project run: 140 passed, 0 failed. Coverage now includes the production canonical/status sampling, sitemap ↔ routes, image sitemap/rights projection, schema guards, Wordstat importer, knowledge graph, semantic clustering, duplicate similarity, article permissions and CWV budgets implemented in later phases.

## Recommended next actions after PHASE 0–1 acceptance

1. Формально принять PHASE 0–1 по этому отчёту; повторно реализовывать PHASE 2 не требуется — PHASE 2–21 уже находятся в commit chain.
2. Утвердить production authority для SQLite/JSON/feed и провести отдельную backup/restore rehearsal перед SEO migrations.
3. Подтвердить supplier image license и условия hotlink/local-cache/derivatives.
4. Предоставить read-only GSC и согласовать query retention; продолжить наблюдение Webmaster/Метрики.
5. Запустить отдельный полный crawler + field CWV baseline и дополнить отчёт измеренными p75.
6. После human approval активировать только ограниченный pilot; массовая публикация и pruning остаются запрещены без отдельного решения.

# STOP / HUMAN REVIEW REQUIRED
