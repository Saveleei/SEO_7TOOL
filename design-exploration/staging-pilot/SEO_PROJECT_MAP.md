# SEO Project Map — 7TOOL storefront

Дата актуализации: 2026-10-05. Preview: `https://new.7tool.ru/`. Единственный канонический production origin в коде: `https://7tool.ru`.

## Architecture

- Next 16.2.6 / React 19.2.6, App Router, SSR; production build через Vinext/Vite.
- Storefront находится в `design-exploration/staging-pilot`; `7tool-source` хранит upstream-каталог и legacy/reference слой.
- Runtime-каталог читается из `7tool-source/src/lib/products.json` либо `CATALOG_FEED_PATH`. Draft и неопубликованные категории исключаются из public projection.
- `scripts/build-catalog-presentation.mjs` строит presentation/quality artifacts; кэш привязан к SHA фида и версии анализатора.
- `scripts/build-legacy-subcategories.mjs` детерминированно строит 125 полезных подкатегорий из реального ассортимента.
- Frozen snapshot опубликованного sitemap 7tool.ru содержит 18 544 URL и используется только как регрессионный fixture. Live-сервисы этим кодом не изменяются.

## Main routes

| Тип | Канонический маршрут | Правило |
|---|---|---|
| Главная | `/` | indexable только на разрешённом production host |
| Каталог / задачи | `/catalog`, `/catalog/task/[task]` | indexable owners |
| Категория | `/c/[slug]` | 200 self-canonical; параметры `noindex,follow` |
| Подкатегория | `/c/[slug]/[subslug]` | 200 self-canonical; crawlable pagination |
| Товар / вариант | `/p/[legacy-compatible-slug]` | 200 self-canonical; точные legacy variant slugs сохранены |
| Бренд | `/brand/[slug]` | 200 self-canonical для 87 полезных брендов |
| Информация | `/contacts`, `/dostavka-i-oplata`, `/garantiya-i-vozvrat`, `/politika-konfidencialnosti`, `/soglasie-na-obrabotku` | public pages |
| Preview aliases | `/product/[slug]`, `/catalog/category/[slug]` | one-hop 308 на `/p` и `/c`, query сохраняется |
| Legacy contacts | `/kontakty` | one-hop 308 на `/contacts` |
| Поиск/compare/test/API | `/search`, `/compare`, `/test/*`, `/api/*` | не входят в sitemap |

## Data sources / Single Source of Truth

| Сущность | Источник |
|---|---|
| product/model/SKU/brand/category/specs/variants | supplier snapshot `7tool-source/src/lib/products.json` |
| price/currency/availability/images | тот же snapshot; отсутствующие факты не выдумываются |
| legacy product URL | deterministic `publicUrls.ts`, повторяющий production slug algorithm |
| 51 опубликованный legacy product, отсутствующий в новом feed | frozen factual snapshot `generatedLegacyRetainedProducts.json`; без устаревших Offer/наличия |
| categories/subcategories | feed + `productionCategoryGroups.ts` + generated legacy subcategories |
| brands | нормализованный brand index текущего public feed |
| contacts/company | `contactConfig.ts`; юридические реквизиты требуют owner verification |
| canonical/indexing | `seo.ts`, `seoIndexing.mjs`, exact-host opt-in |

## SEO layer

- Metadata/canonical/robots: `app/data/seo.ts` и route `generateMetadata`.
- Host protection: `proxy.ts`, `seoIndexing.mjs`; preview остаётся закрытым.
- robots/sitemap: `app/robots.ts`, `app/sitemap.ts`; sitemap содержит canonical `/c`, `/p`, `/brand`, полезные страницы и product images.
- JSON-LD: Organization, WebSite, BreadcrumbList, Product, Offer при подтверждённых фактах, CollectionPage/ItemList для category/subcategory/brand.
- Crawl graph: SSR `Link`/`a href`, breadcrumbs, категории, бренды, pagination, recommendations.
- Observability: catalog/data guards, frozen URL coverage gate, conversion events и field Web Vitals в `dataLayer`.

## Architectural risks

1. `new.7tool.ru` намеренно закрыт; до cutover нельзя включать индексацию.
2. G1031 остаётся в P0 quarantine до исправления supplier source.
3. 51 retained legacy pages защищают текущий индекс, но их ассортимент нужно либо вернуть в feed, либо принять lifecycle decision.
4. JSON/SQLite upstream publication пока не атомарна; provenance/GTIN/legal parity требуют отдельной upstream работы.
5. Нет надёжного per-document update timestamp, поэтому sitemap не фабрикует `lastmod`.
6. Legal name/NAP/ИНН/КПП/ОГРН и финальные тексты privacy/consent должны быть подтверждены владельцем до публикации.
