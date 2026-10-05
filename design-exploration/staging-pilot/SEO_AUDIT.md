# Technical SEO Audit

Дата: 2026-10-05. Проверены repository, server-rendered routes и live preview `new.7tool.ru`.

## P0 — critical

| Находка | Статус |
|---|---|
| Live preview закрыт двойным `X-Robots-Tag: noindex, nofollow, noarchive`, robots `Disallow: /`, sitemap пуст | ожидаемо для preview; критический launch blocker, если этот host собираются индексировать |
| 9 draft products попадали в публичную проекцию | исправлено |
| G1031: Ø25 в названии против 30/40/55 в facts | guard внедрён, источник ещё требует исправления |
| Generated quality cache не учитывал алгоритм | исправлено versioned invalidation |

## P1 — high impact

- Parameterized categories/products: canonical clean URL + `noindex, follow`; ранее был `nofollow` — исправлено.
- Out-of-range/invalid pagination clamp создавала soft duplicate — теперь настоящий 404.
- 223 product groups могли выбирать отсутствующий first variant — исправлено availability-aware default.
- Sitemap исключает P0 blocked products, drafts и служебные URL; пока нет честного lastmod, images и split index.
- Pagination и основные переходы — crawlable SSR links. Product/catalog content присутствует в HTML.
- Product JSON-LD и Offer основаны на тех же runtime facts; Offer только при valid price + confirmed availability.
- Brand pages отсутствуют; brand demand не имеет специализированного типа страницы.
- Category schema ограничена breadcrumbs; CollectionPage/ItemList можно внедрить после проверки rich-result utility.
- Analytics фиксирует базовые conversion events, но first-touch/organic attribution и ecommerce payload неполны.

## P2 — improvements

- Добавить trustworthy update timestamps до `lastmod`.
- Разделить sitemap при росте и добавить image sitemap data.
- Создать curated brand hubs и content routes только по approved intent map.
- Улучшить image coverage, alt QA и field CWV monitoring.
- Централизовать complete legal entity facts, убрать расхождение advertising feed.

## Technical findings

- Status/404: dynamic unknown routes use `notFound`; invalid pagination now does too.
- Canonical: centralized, strips query/hash, never points mechanically to homepage.
- Robots: environment opt-in + exact production host protection; preview must remain closed.
- Query control: filters/sort/search/variant never enter sitemap and are noindex.
- Redirects: known legacy routes use permanent redirects; no evidence of chains in inspected aliases.
- Security/performance: no dependency added, no credentials/config/live infrastructure changed; guards use precomputed report in normal runtime.

## Limits of this audit

No production deployment, Search Console/Webmaster access, real-user CrUX/Metrica data, full external link crawl or Merchant Center validation was authorized. Those checks remain external actions.
