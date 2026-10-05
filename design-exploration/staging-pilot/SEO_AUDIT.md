# Technical SEO Audit

Дата: 2026-10-05. Проверены repository, generated catalog, frozen live sitemap 7tool.ru и доступный preview. Production deployment не выполнялся.

## P0 — critical

| Находка | Статус |
|---|---|
| Preview закрыт `noindex,nofollow` и robots `Disallow: /` | правильно до launch; production host должен открываться только в cutover |
| Риск потери/смены 18 544 индексируемых legacy URL | исправлено: все URL классифицированы и покрыты каноническим route или точным redirect |
| 51 live product URL отсутствовал в новом feed | сохранены factual retained pages без ложных цены/наличия |
| 9 draft products попадали в public projection | исправлено |
| G1031: Ø25 в названии против 30/40/55 в facts | автоматический guard, visible warning, noindex, без Product schema и sitemap; source не исправлен |
| Quality artifact мог быть stale | исправлено versioned invalidation |

## P1 — high impact

- Канонические owners сохранены как `/c`, `/c/category/subcategory`, `/p` и `/brand`; существующим индексируемым URL не нужен redirect.
- Preview-style `/catalog/category` и `/product` дают one-hop 308, сохраняют query и не используются внутренними ссылками.
- 125 subcategory landings и 87 brand hubs рендерятся сервером, имеют metadata, breadcrumbs, crawlable pagination и CollectionPage/ItemList.
- Parameter states получают clean canonical и `noindex,follow`; invalid/out-of-range pagination возвращает настоящий 404.
- Sitemap содержит только canonical owners, product image metadata и исключает draft/P0/service/search/filter URLs.
- Product Offer строится только из той же подтверждённой цены/наличия, что видит пользователь. Fake review/rating/availability отсутствуют.
- Создана custom 404; `notFound()` сохраняет настоящий HTTP 404.
- Аналитика исправлена для `/c` и `/p`; добавлен field CWV event через официальный `useReportWebVitals`.
- Consent links добавлены во все публичные формы, но юридическая редакция документов ещё требует владельца.

## P2 — improvements / external backlog

- Вернуть/заменить 51 retained item в upstream feed и формально определить discontinued lifecycle.
- Исправить 803 P1-affected products и 2 906 P2-affected products по доказуемым источникам.
- Ввести trustworthy update timestamps до публикации `lastmod`; split sitemap пока не нужен при текущем объёме менее 50 000 URL.
- Подключить реальные Search Console/Webmaster/Metrica данные, rich result checks и field CWV dashboard после запуска.
- Реализовать first-touch attribution только после решения по consent/privacy; сейчас персональные данные в analytics events не передаются.
- Публиковать 50-темный content plan только после экспертной редакции, не массовой AI-генерацией.

## Technical findings

- Crawlability: основные категории, подкатегории, бренды, товары и pagination доступны через SSR links.
- Canonical: централизован, очищает query/hash и не указывает механически на главную.
- Robots/indexing: environment opt-in + exact production host; preview защищён headers и robots.
- Redirects: aliases одноступенчатые, без chains/loops и без массовых redirects на home.
- Structured data сверена с актуальными официальными требованиями Google/Yandex; category lists не маскируются под Product rich results.
- Performance: новой тяжёлой зависимости нет; Web Vitals используют уже установленный Next API.

## Audit limits

Без публикации нельзя проверить реальные production status codes, server headers после reverse proxy, Search Console/Webmaster coverage, Merchant Center, Яндекс товарные сниппеты и полевые показатели. Эти действия перечислены в setup-документах и являются launch gates, а не незавершённым кодом.
