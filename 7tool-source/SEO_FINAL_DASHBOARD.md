# 7TOOL.ru — SEO dashboard

Дата: 18 августа 2026 года.

| Показатель | Результат |
|---|---|
| Status | SUCCESS с карантином 3 конфликтующих variants |
| System P0 | 5 найдено / 5 исправлено |
| P1 technical | 8 найдено / 8 безопасных исправлений внедрено |
| Data conflicts | 3 P0 выявлено / 3 изолировано / 0 исправлено догадкой |
| Catalog | 19,019 feed offers; 4,286 non-draft groups; 18,355 variants |
| Public SEO graph | 24 categories; 3,625 product groups; 87 brands |
| Sitemap | 21,126 → 21,064 URL; live check P0/P1 = 0 |
| Performance | Karnasch HTML 36.1 → 0.32 MB; control category 2.46 → 0.88 MB |
| Tests | lint, 19 tests, typecheck, build, data:check, static/live seo:check — pass |
| Production | release `7tool-release-20260818-seo-master`; PM2 online |

## New SEO capabilities

- Data conflict manifest и автоматический quarantine.
- Live SEO guard с status/canonical/robots/H1/JSON-LD/sitemap fixtures.
- Crawlable SSR pagination и безопасная query-parameter strategy.
- Stable brand slugs и paginated brand pages.
- Landing opportunity/cannibalization decision engine.
- Scoped category/product SEO generation, защищённая от ночной перезаписи.
- 4 новых category profiles, task selection и category-specific forms.

## Attention

- Источник данных должен исправить G1031: Ø25 в имени против 30/40/55 в параметре.
- 654 товарные группы без фото остаются вне публичного SEO-графа.
- Внешние кабинеты Яндекс/Google и цели аналитики требуют действий владельца.
- 60 тем — backlog; их нельзя публиковать автоматически без спроса, facts и expert review.
