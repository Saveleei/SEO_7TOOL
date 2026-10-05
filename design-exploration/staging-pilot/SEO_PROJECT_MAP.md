# SEO Project Map — 7TOOL storefront

Дата аудита: 2026-10-05. Целевой preview: `https://new.7tool.ru/`. Канонический production-origin в коде: `https://7tool.ru`.

## Architecture

- Next 16.2.6 / React 19.2.6, App Router, серверный рендеринг; сборка через Vinext/Vite.
- Приложение: `design-exploration/staging-pilot`; `7tool-source` — upstream-каталог и legacy/reference слой.
- Runtime-каталог читается из `7tool-source/src/lib/products.json` либо `CATALOG_FEED_PATH`. Публичная проекция отбрасывает draft и категории без публикации.
- Предрасчёт facets, ranking, presentation и quality выполняет `scripts/build-catalog-presentation.mjs`; quality-кэш привязан к SHA фида и версии анализатора.
- Данные заявок и настроек имеют собственные store-модули. Production-конфигурация, reverse proxy и process manager документированы в deployment-файлах; изменения инфраструктуры в этой работе не выполнялись.

## Main routes

| Тип | Реальный маршрут | Индексация |
|---|---|---|
| Главная | `/` | production only |
| Каталог | `/catalog` | да |
| Задачи | `/catalog/task/[task]` | да, только определённые маршруты |
| Категория | `/catalog/category/[slug]` | чистый URL — да; параметры — noindex, follow |
| Товар | `/product/[slug]` | да, кроме P0 data conflict; `variant` — noindex |
| Поиск | `/search` | нет, отсутствует в sitemap |
| Сравнение/КП/служебные | `/compare`, `/request`, `/test/*`, `/api/*` | нет |
| Информация | `/delivery`, `/payment`, `/warranty`, `/contacts`, `/about`, `/requisites` | да |
| Устаревшие aliases | старые catalog/product paths | permanent redirect |

Brand routes и editorial/article routes пока отсутствуют. Их нельзя добавлять массово до подтверждения intent и контентного стандарта.

## Data sources and single source of truth

| Сущность | Источник |
|---|---|
| product/model/SKU/brand/category/specs/variants | supplier snapshot `7tool-source/src/lib/products.json` |
| price/currency/availability/images | тот же snapshot; витрина не выдумывает отсутствующие значения |
| category grouping/presentation | `productionCategoryGroups.ts`, expert profiles и generated artifacts |
| shipping promise | variant stock + freshness/config guard |
| contacts/company | `company.ts` и manager contact model |
| SEO origin/indexing | `seoIndexing.mjs`, environment opt-in, exact host allowlist |

## SEO layer

- Metadata/canonical/robots: `app/data/seo.ts` и route `generateMetadata`.
- Host protection: `proxy.ts`, `seoIndexing.mjs`.
- robots/sitemap: `app/robots.ts`, `app/sitemap.ts`.
- JSON-LD: root layout, Breadcrumbs, product route; Offer публикуется только при подтверждённых цене и наличии.
- Crawl graph: SSR `<a href>` / Next `Link` в header, catalog, pagination, breadcrumbs and recommendations.

## Risks

1. Preview намеренно закрыт `X-Robots-Tag` и `Disallow: /`; открывать его нельзя. Перед launch нужен отдельный host cutover checklist.
2. Один товар `G1031` остаётся в P0 quarantine из-за трёх конфликтных вариантов.
3. Нет brand hubs и editorial layer; это ограничивает brand/informational demand.
4. Sitemap — один динамический файл без trustworthy `lastmod`/image extensions; при росте нужен index.
5. Два приложения используют один catalog snapshot, но legacy SQLite/JSON publication не атомарна.
6. Не все реквизиты заполнены, а юридическое имя в advertising feed требует сверки.
