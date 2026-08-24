# Настройка Google Search Console для 7TOOL.ru

Дата: 18 августа 2026 года. Действия в аккаунте владельца не выполнялись: для них требуется авторизованная сессия. Техническая часть сайта подготовлена.

## Подключение

1. В [Google Search Console](https://search.google.com/search-console/) добавить Domain property `7tool.ru` и подтвердить DNS TXT. Если доступ к DNS сейчас невозможен, временно добавить URL-prefix property `https://7tool.ru/` и подтвердить HTML-файлом или meta tag.
2. Не удалять verification token после успешной проверки.
3. В разделе Sitemaps отправить `https://7tool.ru/sitemap.xml`.
4. Через URL Inspection проверить главную, четыре новые категории, одну paginated category, бренд и несколько товаров.

Официальные инструкции: [подтверждение права собственности](https://support.google.com/webmasters/answer/9008080), [создание и отправка sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [canonical и дубли](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

## Контрольные URL

- `https://7tool.ru/`
- `https://7tool.ru/c/sverla-i-zenkovki`
- `https://7tool.ru/c/stanki-lazernoy-rezki`
- `https://7tool.ru/c/svarochnye-roboty`
- `https://7tool.ru/c/stanochnaya-osnastka`
- `https://7tool.ru/c/sverla-i-zenkovki?page=2`
- безопасный brand URL из sitemap и 3–5 товарных URL.

Для фильтрованного URL ожидаемый результат: crawlable response, `noindex, follow`, canonical на базовую категорию и отсутствие в sitemap. Для несуществующего URL — настоящий 404.

## Structured data

1. Проверить товары в [Rich Results Test](https://search.google.com/test/rich-results).
2. В Search Console открыть Enhancements/Merchant listings/Product snippets после накопления данных.
3. Price, availability, URL и изображение должны совпадать с серверным HTML и текущей SQLite — это уже объединено в один runtime source.
4. Варианты товара оформлять через `ProductGroup`, `variesBy`, `hasVariant` и стабильные идентификаторы только там, где факты подтверждены.
5. Ошибочный товар G1031 пока имеет noindex и без Product schema; вернуть его можно после исправления feed-фактов и повторного `data:check`.

Официальные спецификации: [Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product), [варианты товара](https://developers.google.com/search/docs/appearance/structured-data/product-variants), [BreadcrumbList](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb).

## Через 3–28 дней

- Pages: проверить 404, soft 404, `Duplicate without user-selected canonical`, `Crawled — currently not indexed`.
- Sitemaps: submitted/discovered URLs и ошибки чтения.
- Performance: запросы, страницы, CTR и устройства; сравнивать периоды, а не единичный день.
- Core Web Vitals: особенно категории с крупным payload; брендовые страницы уже переведены на компактную пагинацию.
- Rich results: валидность Product/Breadcrumb и соответствие цены/наличия.
- Manual actions и Security issues: должны быть пустыми.

## Что не делать

- Не использовать robots.txt как замену `noindex` для страниц, которые поисковик должен увидеть и исключить.
- Не включать фильтры, cart, favorites и unreviewed LP в sitemap.
- Не создавать сотни brand+category страниц без спроса и уникального ассортимента.
- Не добавлять отзывы, рейтинги, совместимость и характеристики, которых нет в подтверждённых источниках.
- Не менять slug существующей страницы без 301 redirect, обновления внутренних ссылок, canonical и sitemap.

## Ежемесячная операционная проверка

1. Экспортировать Performance по page/query и выделить: растущие кластеры, страницы с показами без кликов, пересекающиеся URL одного интента.
2. Сопоставить данные с Яндекс Вебмастером и бизнес-метриками заявки/звонка, не оптимизировать только позицию.
3. Пересмотреть content backlog по спросу и качеству ассортимента.
4. Прогнать `npm run data:check` и `npm run seo:check -- --url=https://7tool.ru` после заметного обновления фида или шаблонов.
