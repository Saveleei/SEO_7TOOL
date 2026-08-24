# SEO Implementation Plan — 7TOOL.ru

Дата: 18 августа 2026 года. Подход: минимальные совместимые изменения с проверкой production fixtures.

## P0 — Critical

| Problem | Expected effect | Risk | Files | Verification |
|---|---|---|---|---|
| Цена/availability в JSON-LD могут отставать от live UI | единый server-side факт для HTML и schema | средний: меняется rendering товара | product page, products DB, ProductJsonLd | schema vs HTML vs SQLite fixture |
| Sitemap содержит raw brand URL; бренд с `/` даёт 404 | только 200 canonical brand URLs | низкий | brand URL helper, sitemap, BrandStrip, brand page | sitemap scan + HTTP 200 |
| Brand Karnasch отдаёт 36 MB HTML | резко меньший HTML, TTFB и DOM | низкий/средний | brand page, DB pagination | bytes, TTFB, page links |
| Нет автоматического data-conflict guard | конфликт не попадёт в новую SEO-генерацию без предупреждения | низкий | data-check script, SEO generators, cron wrappers | fixture conflicts + manifest |
| Sitemap/SEO guard не проверяет status/canonical/schema | предотвращение 404/noindex/invalid JSON-LD в sitemap | низкий | seo-check script, package scripts | `npm run seo:check` |

## P1 — High impact

| Problem | Expected effect | Risk | Files | Verification |
|---|---|---|---|---|
| Client-only pagination; `?page=2` повторяет page 1 | crawlable internal graph и реальные страницы 2+ | средний | category/subcategory filters and metadata | SSR links, unique products, canonical |
| QuickChips URL не применяет выбранный facet | рабочий быстрый выбор и выше конверсия | низкий | category page, CategoryFilters | browser click + result count |
| Auto landing pages конкурируют с категориями | контроль каннибализации и crawl budget | низкий | landing decision engine, page metadata, sitemap | noindex/canonical + sitemap exclusion |
| 4 новые категории без SEO profiles | предметные product metadata вместо generic текста | низкий | category-seo.json, generator filter | seo audit: missing profile = 0 |
| Brand pages — слабый title, нет category links/schema/OG | дополнительный коммерческий охват | низкий | brand page | metadata/H1/schema/links |
| Organization schema использует фото менеджера как image | корректная сущность компании, исключение нерелевантного image | низкий | SiteJsonLd | JSON-LD inspection |
| Attribution page-view работает только при первом mount | корректные SPA product/category events | низкий | AttributionCapture | browser navigation + event hook |
| Static/info `lastmod` меняется вместе с feed | более честный sitemap | низкий | sitemap helper | compare source/catalog mtimes |
| Нет полезной custom 404 | меньше soft-404 UX потерь | низкий | not-found.tsx | real 404 status, noindex, links |

## P2 — Improvements

- Нормализация/редиректы старых brand и category slug без цепочек.
- Дальнейшее уменьшение category RSC payload через server-side facets/API.
- Нормализованный Product Facts/compatibility layer только для подтверждённых полей.
- Brand + category pages после opportunity scoring и подтверждения спроса.
- Comparison architecture поверх нормализованных характеристик; не публиковать до проверки сопоставимости.
- Разделение sitemap на index после приближения к 50,000 URL или 50 MB.
- Поле editorial `updated_at` для точного URL-level lastmod.

## Release safety

1. Сделать backup только затрагиваемых source-файлов и SQLite backup.
2. Не менять `.env`, credentials, URL существующих товаров/категорий.
3. Запустить data check до SEO generation.
4. `npm run lint`, `npm test`, `npm run typecheck`, `npm run data:check`, `npm run seo:check`, `npm run build`.
5. Reload PM2 только после успешной build.
6. Проверить live fixtures и повторный feed refresh; hashes ручных category settings должны совпасть.
