# Yandex SEO Setup

Выполнять только после production cutover; `new.7tool.ru` сейчас намеренно закрыт.

1. Добавить и подтвердить основной host `https://7tool.ru`; проверить главное зеркало, HTTPS и региональность России/фактического региона обслуживания.
2. Отправить `https://7tool.ru/sitemap.xml`; убедиться, что preview sitemap не используется.
3. Проверить robots, response `X-Robots-Tag`, canonical и status на fixture set: home, catalog, `/c` category, `/c/category/subcategory`, `/brand`, `/p` group, `/p` variant, retained product, paginated/noindex, P0 quarantined product, custom 404.
4. В «Индексирование → Проверка URL» проверить SSR H1, links, Product/Breadcrumb schema и отсутствие зависимости от JS.
5. Настроить параметры URL по `SEO_URL_PARAMETERS.md`; tracking/sort/view игнорировать, filters/variant оставить crawlable noindex. Не блокировать до чтения meta robots.
6. Отслеживать исключённые URL, soft 404, duplicates, crawl statistics, Турбо/товарные представления только если они соответствуют бизнес-процессу.
7. Проверить YML по SKU/name/URL/price/availability/image/category/brand против website. Не публиковать feed с другим legal entity или иной ценой.
8. В Метрике настроить цели: phone/email/messenger click, add_to_quote, request quote, form success, order success; сохранить landing/source/medium/campaign/first landing/conversion page с соблюдением consent.
9. Для Алисы/AI: поддерживать factual descriptions, clear specs, comparisons and stable entity links; никаких специальных «AI hacks».
10. В первые дни отдельно проверить: сохранённые `/c`, `/p`, `/brand` отвечают 200; `/catalog/category` и `/product` отвечают одним 308 без цепочки; `/kontakty` ведёт одним 308 на `/contacts`.
11. Еженедельно: data/SEO checks; ежемесячно: organic revenue, nonbrand coverage, CTR, quarantines, CWV and crawl waste.
