# SEO Implementation Report — 7TOOL.ru

Дата завершения: 18 августа 2026 года. Production release: `/var/www/7tool-release-20260818-seo-master`, активирован через `/var/www/7tool-current`. Предыдущий release и отдельный backup БД/JSON/source сохранены.

## Executive summary

Проведён аудит реальной Next.js/SQLite/feed-архитектуры и безопасно внедрены P0/P1-исправления без смены framework, публичного домена и существующих URL товаров/категорий. Server HTML, metadata и Product JSON-LD теперь получают цену/наличие из одного актуального источника; каталог имеет crawlable пагинацию; brand URLs нормализованы; sitemap очищен от 404/noindex/конфликтных страниц; новые категории получили предметные SEO-профили, быстрый выбор и формы подбора. Ночные/часовые jobs сохраняют ручные SEO, изображения категорий, порядок и настройки.

Бизнес-эффект ожидается через улучшение качества индексируемого графа, доступности глубоких товаров, снижения технических дублей и более понятного подбора. Рост позиций/выручки нельзя честно обещать до накопления данных Яндекс Вебмастера, Search Console и конверсий.

## Critical problems found

Найдено 5 системных P0: 404/raw brand URLs в sitemap, 36.1 MB HTML крупного бренда, возможное расхождение live price и Product schema, отсутствие data-conflict gate, недостаточный SEO quality guard. Все 5 исправлены и проверены на production.

Отдельно найдены 3 P0-конфликта исходных товарных данных у группы G1031. Они не «исправлены догадкой»: товар изолирован от sitemap, индексации и Product schema, генераторы его пропускают. Исправление должно прийти из дилерского feed/от владельца данных.

## Data quality

- 26 категорий, из них 24 опубликованы.
- 4,286 non-draft товарных групп; 18,355 вариантов.
- 3 P0 numerical conflicts: имя варианта говорит `Ø25 мм`, параметр «Диаметр режущей части» — `30/40/55 мм` у A8177/A8178/A8179.
- 975 P1: 654 группы без изображения, 245 вариантов без SKU, 6 групп дублирующихся SKU, 58 слабых model-only названий, 12 товаров в скрытых категориях.
- 28 P2: слабый/отсутствующий бренд.
- `npm run data:check` создаёт JSON/Markdown-отчёт и conflict manifest. Структурные blocking P0 останавливают pipeline; известные предметные конфликты карантинируются и не блокируют обновление остального каталога.
- Data check включён в hourly/nightly jobs до SEO-генерации.

## Technical SEO

- Product route переведён на dynamic server resolution из текущей SQLite.
- Category/subcategory `?page=N` рендерит фактическую страницу N и содержит настоящие `<a href>` prev/next/page links; превышение последней страницы даёт 404.
- Functional filters работают по direct URL и SPA click; filter URLs получают `noindex, follow` и base canonical.
- Quick search в шапке снова работает на страницах каталога.
- Добавлена полезная true-404 страница с `noindex` и навигацией.
- SPA attribution page views реагируют на смену pathname.
- Категорийный listing payload сокращён до релевантных facets и компактных товаров.

## Indexation

Индексируются: главная, 24 опубликованные категории, непустые опубликованные подкатегории, публичные товары/варианты с изображением и без data conflict, безопасные brand pages, полезные коммерческие/юридические страницы.

Не публикуются в публичном SEO-графе: товары скрытых категорий, группы без изображений, G1031 до исправления данных и две draft-категории `vibroopory`/`verstaki`.

## Noindex / crawl control

- `/cart`, `/favorites`: `noindex, follow`.
- Filter/sort query URLs: `noindex, follow`, canonical на базовую категорию, отсутствуют в sitemap.
- 29 `/lp/` conversion pages: доступны для рекламы/форм, но `noindex, follow`, canonical на релевантную category/subcategory и исключены из sitemap до ручного подтверждения самостоятельного интента.
- `/admin` и `/api`: Disallow в robots.txt.
- Tracking parameters обрабатываются canonical и Yandex `Clean-param`, а не размножают индексируемые URL.

## Sitemap

Baseline: 21,126 URL. Production после исправлений: 21,064 URL, HTTP 200, конфликт G1031 отсутствует. Источник — текущая SQLite, а не потенциально устаревший build-time список. Brand paths строятся единым ASCII slug helper. LP/noimage/hidden-category/conflict URLs исключены. `lastmod` для статических документов основан на времени изменения source, для каталога — на catalog snapshot.

Размер ещё не требует sitemap index: используется один sitemap ниже лимитов. Разделение нужно при приближении к 50,000 URL/50 MB.

## Canonical

- Base category и неотфильтрованная valid page N имеют self-canonical.
- Filtered URL canonicalize к базовой категории и noindex.
- Landing decision engine выбирает ближайшую category/subcategory canonical.
- Product/group/variant/brand используют собственные стабильные URL.
- Legacy raw brand URL переводится на безопасный slug без создания путей из `/` и пробелов.

## Metadata

Metadata строится централизованными helpers из реальных category/product/brand фактов. Для 4 новых категорий добавлены предметные H1, intro, title, description, keywords, purpose, SEO-блоки и FAQ. Paginated category title имеет суффикс страницы. Open Graph/Twitter для категории и товара используют соответствующее изображение, а Organization — `/og.png`, не фотографию менеджера.

## Product SEO

- H1, metadata, цена, наличие и JSON-LD получают один resolved product из SQLite.
- Группа и вариант имеют отдельную семантику URL/schema.
- Brand/category breadcrumbs и ссылки сохранены; связанный ассортимент ограничен компактным набором.
- В карточках 4 новых направлений показывается форма подбора соответствующей категории.
- При data conflict Product schema не выводится, страница noindex и честно сообщает, что характеристики уточняются.
- Out-of-stock страница остаётся с реальным статусом и аналогами, если объект остаётся публичным. Автоматический 301 снятого товара на главную не внедрялся.

## Categories

Все 24 опубликованные категории остаются доступны. Четыре новых направления (`sverla-i-zenkovki`, `stanki-lazernoy-rezki`, `svarochnye-roboty`, `stanochnaya-osnastka`) получили отдельные profiles, быстрый выбор по задаче и понятные category-specific формы. Фильтр, direct query URL и SSR pagination работают совместно.

После оптимизации контрольная категория `/c/sverla-i-zenkovki` уменьшилась примерно с 2.46 MB до 0.88 MB HTML. Существующий UX и URL сохранены.

## Brands

Brand slug теперь ASCII-safe и един для ссылок, sitemap и resolver. Страница бренда содержит коммерческий title/description, H1, фактические category links/counts, OG, CollectionPage/Breadcrumb JSON-LD и server pagination по 24 товара. `/brand/karnasch` уменьшился примерно с 36.1 MB до 0.32 MB HTML.

Brand+category страницы массово не создавались. Они допустимы только после подтверждения спроса, уникальности интента и достаточного стабильного ассортимента.

## Programmatic SEO

Добавлен deterministic landing decision engine с действиями `CREATE`, `KEEP`, `MERGE`, `NOINDEX`, `CANONICALIZE`, `REJECT`. Без ручной allowlist решение безопасное: новые страницы не становятся индексируемыми автоматически. SEO generators принимают category scope и читают conflict manifest; `--refresh-existing` требует явного запуска.

## Cannibalization

19 generic `/podbor` LP имеют высокий overlap с категориями; ещё 10 scenario LP пересекаются с опубликованными подкатегориями. Они сохранены для CRO, но исключены из поиска. Критерии перехода к `CREATE`: независимый спрос, минимум 6 стабильных товаров (целевой уровень 12+), уникальный intent/content, отсутствие конкурирующего canonical и ручное review.

## Internal linking

Главная связывает категории; category — subcategories/tasks, brands и товары; product — category, brand, до 4 related products и форму; brand — фактические категории и paginated products. Pagination links доступны в server HTML. Будущие знания должны связывать одну основную категорию, до трёх подкластеров и только фактически релевантные товары.

## Product compatibility

Полноценный compatibility graph не создавался: feed не даёт достаточно нормализованных подтверждённых связей. Текущие facets/forms используют только существующие параметры. Следующий безопасный шаг — отдельный Product Facts слой с нормализацией единиц, aliases и источником подтверждения; до этого нельзя генерировать заявления о совместимости.

## Product comparisons

Автоматические comparison pages не опубликованы по той же причине. Подготовлены семантическая архитектура и контентные comparison topics; публикация допускается только для сопоставимых товаров с одинаково нормализованными facts и ручной технической проверкой.

## Structured data

- Root: `Organization`, `WebSite`; company image исправлен на `/og.png`.
- Category/brand/landing: `CollectionPage` и `BreadcrumbList` по типу страницы.
- Product group: `ProductGroup`, `productGroupID`, `variesBy`, `hasVariant`, `AggregateOffer` при валидных ценах.
- Variant/product: `Product`, `Offer`, SKU/MPN, GTIN при валидной длине, brand/category, `additionalProperty`, `isVariantOf`.
- Price/currency/availability/URL берутся из того же server object, что HTML. `seo:check` проверяет JSON syntax и fixture invariants.

## Yandex

Robots, Host, Sitemap и Clean-param подготовлены; важные URL не закрываются Disallow там, где робот должен увидеть noindex/canonical. Есть отдельный owner checklist в `YANDEX_SEO_SETUP.md`. Региональность, права, отправка sitemap, переобход и цели Метрики требуют ручного доступа к аккаунтам.

## Google

Canonical, sitemap, Product/ProductGroup/Breadcrumb data и live price consistency подготовлены. Есть owner checklist в `GOOGLE_SEO_SETUP.md`. Domain property, URL Inspection, Merchant Center/feed diagnostics и мониторинг rich results требуют внешнего аккаунта.

## AI Search

Сделан фундамент без «AI SEO hacks»: реальные product facts доступны в server HTML и schema; категории структурированы через intro/FAQ/task selection; конфликтные данные не попадают в генерацию; semantic/content maps ориентированы на ясные определения, ограничения, задачи и сравнения. Генерация неподтверждённых характеристик запрещена process guard.

## Performance

- Brand HTML: ~36.11 MB → ~0.32 MB благодаря server pagination и compact product projection.
- Контрольная category HTML: ~2.46 MB → ~0.88 MB благодаря ограничению facets/serialized listing data.
- Shared build JS остался около 102 kB baseline; крупный category payload остаётся P2 для дальнейшего server/API filtering.
- Product rendering стал dynamic для согласованности фактов; его TTFB нужно отслеживать по production telemetry, а не оценивать только Lighthouse.

## Analytics

Существующие события сохранены: product/category views, search, phone/email/quote clicks, forms, equipment selection, add to cart, checkout/order, LP steps. First-touch landing/source/medium/campaign/yclid и conversion page сохраняются в заявках. `AttributionCapture` исправлен для SPA navigation. В Яндекс Метрике нужно вручную связать цели и убедиться, что production counter ID задан; Google Analytics/Ads не добавлялись без согласия и account ID.

## Tests

Успешно выполнены:

- `npm run lint` — pass.
- `npm test` — 19/19 pass.
- `npm run typecheck` — pass.
- `npm run data:check` — pass; 3 известных subject conflicts quarantined, blocking P0 = 0.
- `npm run seo:check` — static pass, P0=0, P1=0.
- `npm run build` — production build pass.
- `npm run seo:check -- --url=https://7tool.ru` — live pass; 24 categories, 3,625 public product groups, 87 brands, P0=0, P1=0.
- Browser fixtures — quick facet direct/click state, result count, page 2 content/canonical, noindex filter verified.
- Production: PM2 `7tool-prod` online, robots 200, missing fixture 404, sitemap 21,064 URLs, G1031 absent.
- Hash guard: старые category SEO/settings и order/cover/publication до/после catalog refresh совпали.

## Remaining risks

1. Исправить 3 конфликтующие характеристики G1031 в исходном feed, затем вернуть страницу только после чистого `data:check`.
2. Получить изображения для 654 групп: до этого они сознательно не входят в публичный SEO-граф.
3. Заполнить 245 отсутствующих и разобрать 6 дублирующихся SKU у поставщика.
4. Улучшить 58 слабых названий только из подтверждённых model/brand/type facts.
5. Подтвердить legal name, реквизиты, коммерческие обещания, сроки и формулировки юридических страниц у владельца/юриста.
6. Дальше уменьшать RSC/HTML категории через server-side facet API, сохраняя crawlable pagination.
7. Ввести editorial `updated_at` для точного URL-level sitemap lastmod.
8. Реализовать lifecycle discontinued/410/точный replacement redirect после появления явного статуса в data source.

## External actions required

1. Яндекс Вебмастер: подтвердить `https://7tool.ru`, отправить sitemap, запросить переобход приоритетных URL, проверить региональность/диагностику.
2. Яндекс Метрика: проверить production counter, назначить цели для quote/form/phone/cart/order и ecommerce; убедиться в корректном consent/privacy процессе.
3. Google Search Console: подтвердить Domain property, отправить sitemap, проверить fixtures через URL Inspection и Rich Results.
4. Merchant Center/товарные площадки: подключать только текущий feed из единого source, проверить URL/SKU/price/availability/image; не создавать второй независимый каталог.
5. Поставщик данных: исправить G1031, изображения и SKU; вернуть исправленный feed.
6. Контент: выбрать первые P1-темы по фактическому спросу и перед публикацией провести техническую экспертную проверку.

## Change inventory

| Files | Why / effect | Risk control |
|---|---|---|
| `scripts/data-check.mjs`, `src/lib/seo-conflicts.ts` | data quality report, conflict manifest и quarantine | read-only audit; source facts не переписываются |
| `scripts/seo-check.mjs`, `package.json` | static/live SEO regression gate и команды npm | HTTP fixtures ограничены; build не зависит от сети |
| `scripts/hourly-refresh.sh`, `scripts/nightly-rebuild.sh`, `scripts/refresh-feed.mts` | data gate и сохранение ручных category/product полей | backup, transaction, category hash verification |
| `scripts/generate-product-seo.mjs`, `scripts/generate-programmatic-seo.mjs`, `scripts/sync-category-seo.mjs` | scoped generation, conflict skip, fill-missing default | rewrite только с явными flags/category scope |
| `scripts/category-settings-hash.mjs`, `scripts/verify-category-settings.mjs`, `scripts/restore-category-settings.mjs` | контроль и восстановление SEO/photo/order/publication | hash до/после; restore из backup manifest |
| `src/lib/products-db.ts`, `src/app/p/[slug]/page.tsx`, `src/components/ProductJsonLd.tsx` | единый runtime product source для HTML/meta/schema | dynamic fixture tests; конфликтный товар без schema |
| `src/lib/brand.ts`, `src/app/brand/[slug]/page.tsx`, `src/components/BrandStrip.tsx` | безопасные brand URLs, SEO и pagination | legacy resolution; collision check; 24 items/page |
| `src/lib/catalog-query.ts`, category/subcategory pages, `CategoryFilters.tsx` | SSR pagination, working facets/direct URLs, canonical/noindex | bounded page, allowlisted query fields, browser fixtures |
| `src/lib/landing-pages.ts`, `src/app/lp/[category]/[[...intent]]/page.tsx` | decision engine против каннибализации | safe default noindex; пустая reviewed allowlist |
| `src/app/sitemap.ts` | current public DB graph, safe brands, исключение LP/conflicts | live status/canonical/noindex sample check |
| `src/lib/category-seo.json`, `src/lib/category-content.ts` | SEO/CRO-профили 4 новых категорий | scoped update; existing category hashes unchanged |
| `src/app/api/search/route.ts`, `src/components/CatalogMenu.tsx` | рабочий быстрый поиск | API limits и existing UI preserved |
| `src/app/p/[slug]/ProductView.tsx`, `src/lib/subcategories.ts` | форма подбора по соответствующей категории | только для известных category configs |
| `src/components/SiteJsonLd.tsx`, metadata call sites | релевантные OG/schema images и актуальный homepage wording | без изменения contact credentials |
| `src/components/AttributionCapture.tsx` | SPA view events и сохранение attribution | существующие event names/consent flow сохранены |
| `src/app/not-found.tsx` | настоящий полезный 404/noindex | отдельный live 404 fixture |
| `next.config.ts` | isolated candidate build directory | default production `.next` не меняется без env flag |

Полный catalog snapshot `src/lib/products.json` обновлён из того же feed/SQLite pipeline; он не редактировался вручную.

## Rollback

- Предыдущий release: `/var/www/7tool-release-20260811T205254Z`.
- Backup перед master SEO: `/var/www/7tool-backups/seo-master-before-20260818TSEO` (SQLite, products JSON, source tar, SHA256SUMS).
- Откат должен выполняться атомарной сменой symlink на предыдущий release и reload PM2; shared DB восстанавливать только при отдельно подтверждённой необходимости.
