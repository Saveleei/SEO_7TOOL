# Technical SEO Audit — 7TOOL.ru

Дата baseline-аудита: 18 августа 2026 года. Проверены production HTML, source, sitemap, robots, SQLite/JSON pipeline и фоновые jobs.

## Executive baseline

- `robots.txt`: 200, важные ресурсы разрешены, `/admin` и `/api` закрыты, Sitemap/Host/Clean-param присутствуют.
- `sitemap.xml`: 200, 21,126 URL, 4.58 MB, дублей нет; лимиты одного sitemap не превышены.
- Контрольные homepage/category/subcategory/product/cart/favorites/404: корректные HTTP status, один H1, JSON-LD синтаксически валиден.
- Category/product Open Graph после исправления использует фото соответствующей категории/товара, а не manager portrait.
- 404 возвращает настоящий 404 и `noindex`, но пока использует стандартный Next UI.

## P0 — Critical

### P0-1. Sitemap содержит некорректные brand URLs и 404

- В sitemap обнаружены raw URLs с пробелами и символом `/` из названия бренда.
- `Смазпром / НПФ Акрил` формирует путь с дополнительным сегментом и отвечает 404.
- Риск: sitemap сообщает поисковикам неканонические/неработающие URL.
- Fix: единый стабильный brand slug helper, redirects для ранее работавших legacy slug, sitemap только из resolved slugs.

### P0-2. Брендовая страница перегружает HTML

- `/brand/karnasch`: 36,112,986 bytes HTML, 920 полных товарных групп со всеми вариантами.
- TTFB контрольного запроса: около 2.6 s до оптимизации.
- Риск: LCP/INP/DOM, память сервера, crawl efficiency.
- Fix: server-side pagination, 24 compact product cards, crawlable links, DB query only for current page.

### P0-3. Возможна разница live UI и Product JSON-LD

- Product HTML/JSON-LD строится из build-time JSON/ISR.
- После hourly feed sync видимая цена обновляется через `/api/live` из SQLite без обязательной build.
- Риск: пользователь видит одну цену/availability, crawler schema — старую.
- Fix: dynamic server product resolution из SQLite; HTML, metadata и JSON-LD получают один объект фактов. Client live остаётся страховкой для уже открытой страницы.

### P0-4. Нет data conflict gate перед SEO generation

- Подтверждены 3 high-confidence конфликта `variant.name Ø25 мм` против `Диаметр режущей части 30/40/55 мм` в группе G1031.
- До внедрения генераторы не читали conflict manifest.
- Fix: `data:check`, `SEO_DATA_CONFLICT` manifest и skip affected product IDs в AI/programmatic generators.

### P0-5. SEO guard не гарантирует sitemap/status/schema invariants

- Существующий `seo:audit` проверяет преимущественно длины/дубли текста.
- Fix: новый `seo:check` для URL, canonical, robots, H1, JSON-LD, sitemap и data consistency; live-mode для HTTP fixtures.

## P1 — High impact

### P1-1. Пагинация недоступна поисковому роботу

- `CategoryFilters` показывает 24 товара, но pager состоит из `<button>` без `href`.
- `?page=2` на production возвращает ту же первую страницу и canonical на base.
- Fix: crawlable `<a href="?page=N">`, SSR initial page, self-canonical valid pagination, 404 beyond last page.

### P1-2. Быстрые chips не применяют facet

- `QuickChips` создаёт GET URL, но `CategoryFilters` не читает query parameters.
- Fix: безопасный initial facet state; filtered URLs — `noindex, follow`, canonical base.

### P1-3. Landing cannibalization

- 29 `/lp/` URL были в sitemap и `index, follow`.
- 19 auto `podbor` URL повторяют intent соответствующей category page; 10 core scenario URLs часто повторяют существующие subcategory URLs.
- Fix: deterministic decision engine. До отдельного подтверждения intent landing остаётся conversion page, `noindex, follow`, canonical на category/subcategory и не входит в sitemap.

### P1-4. Новые категории не имеют product SEO profiles

- `category-seo.json`: 22 profiles; 4 новые категории отсутствуют.
- Существующий audit: 489 `missing_category_profile` (485 product groups + 4 categories).
- Следствие: generic формулировки вроде «для применения в разделе» и повтор слова «применения».
- Fix: 4 предметных профиля и контролируемое manual refresh только этих категорий.

### P1-5. Brand SEO недостаточно развит

- Title вида `Karnasch — 7TOOL`, отсутствуют OG image, CollectionPage/Breadcrumb schema, category clusters.
- Fix: коммерческий title/description из фактического ассортимента, category links/counts, JSON-LD, product image OG fallback.

### P1-6. Sitemap lastmod для статических URL привязан к feed

- Информационные страницы получают catalog mtime, даже если их документ не менялся.
- Fix: source/build mtime для static content; catalog mtime для catalog-derived URLs. URL-level product timestamps — P2 до появления editorial `updated_at`.

### P1-7. SPA analytics page views

- Root `AttributionCapture` effect выполняется один раз; client navigation может не отправить новый `view_product/view_category`.
- Fix: path-aware effect.

### P1-8. Public product graph включает товары скрытых категорий

- 12 non-draft products принадлежат двум `published=false` категориям.
- Fix: публичный resolver/sitemap/brand graph должны учитывать publication status категории; источник остаётся в БД.

## P2 — Improvements

- Custom 404 with useful category/search links.
- Category page baseline HTML 2.46 MB for 303 visible models: precompute facets and further compact listing payload.
- 654 feed groups without images (already excluded from storefront) need supplier enrichment.
- 245 variants without SKU; 6 duplicate SKU groups; 58 weak model-only titles.
- Product compatibility/comparison only after normalized explicit facts are available.
- Exact per-document `lastmod` needs durable editorial timestamps.
- Legal pages and public legal name require owner/legal approval.

## Indexation strategy

- Index: homepage, published/nonempty category/subcategory, public product/group/variant, useful brand pages, commercial info pages.
- Noindex follow: cart, favorites, filtered category URLs, conversion `/lp/` pages pending intent approval.
- Disallow crawl: admin and API only.
- Sitemap: only self-canonical indexable 200 URLs.

## Core Web Vitals observations

- Shared First Load JS from build: ~102 kB.
- Category RSC/HTML payload remains large because client filters receive all compact products.
- Brand page is the immediate P0 performance target.
- Product dynamic DB rendering is expected to reduce build work while keeping server-visible facts; live TTFB must be measured after deployment.

