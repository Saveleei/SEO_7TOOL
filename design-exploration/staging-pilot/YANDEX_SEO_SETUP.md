# Yandex SEO Setup

Production cutover выполнен 2026-10-05. Ниже — порядок безопасного восстановления индексации и рекламы после публикации.

## Что должно быть в релизе

- Старые индексируемые владельцы URL `/c`, `/p` и `/brand` остаются страницами `200`, а не перенаправляются на главную.
- Временные адреса нового интерфейса `/catalog/category/*` и `/product/*` получают один постоянный `308` на соответствующий старый canonical URL; исходная query string, включая `yclid`, UTM и `variant`, сохраняется.
- Sitemap снова содержит полный legacy inventory и изображения товаров. Redirect-адреса, параметры, поиск, сравнение, API и тестовые страницы в sitemap не включаются.
- `robots.txt` разрешает production-индексацию, указывает основной host/sitemap и объявляет `Clean-param` для рекламных параметров без блокирования самих посадочных страниц.
- Первый и последний значимый рекламный переход сохраняются в браузере и передаются с заявкой: UTM, `yclid`, landing page, referrer без query, внутренние client/session IDs и ClientID Метрики.
- `https://7tool.ru/feeds/yandex-dynamic.xml` временно проксируется с legacy-сервиса на `127.0.0.1:3108`. До отключения legacy-процесса генератор feed нужно перенести в основной storefront.

## Сразу после выкладки

1. Проверить `200`: `/`, representative `/c`, `/c/*/*`, `/brand/*`, `/p/*`, `/robots.txt`, `/sitemap.xml`, `/feeds/yandex-dynamic.xml`.
2. Проверить одним запросом без цепочки: `/product/*?yclid=TEST&utm_source=yandex` и `/catalog/category/*?utm_campaign=TEST` должны вернуть постоянный redirect на `/p`/`/c` с теми же параметрами; финальная страница — `200` и self-canonical без tracking query.
3. Сравнить feed с сайтом по ID, name, URL, price, availability, image, category и brand. Feed нельзя подключать, если legal entity или цена расходятся с фактическими данными сайта.
4. В Яндекс Вебмастере повторно отправить `https://7tool.ru/sitemap.xml`, затем проверить выборку старых URL через «Проверку страниц» и мониторинг исключённых страниц/soft 404.
5. В Яндекс Директе заменить все финальные ссылки на canonical `/p` и `/c`. Старые ссылки продолжат работать через один redirect, но canonical landing уменьшает риск потери параметров и лишний hop.
6. Сделать тестовый клик из отдельной тестовой кампании и тестовую заявку. В заявке должны быть `utm_source=yandex`, campaign/content/term, `yclid`, первая посадочная и ClientID Метрики.
7. Не менять одновременно URL, ставки и семантику рабочих кампаний: сначала обновить ссылки и проверить конверсии, затем оптимизировать кампании.

## Настройки сервисов

1. Подтвердить основной host `https://7tool.ru`; проверить главное зеркало, HTTPS и региональность России/фактического региона обслуживания.
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

## Стоп-факторы

- Не отключать legacy-процесс на порту `3108`, пока новый storefront не генерирует рекламный feed самостоятельно и публичный URL feed не проверен.
- Не запускать повторную отправку sitemap, пока representative old URLs не дают `200` и redirect query preservation не подтверждён на production.
- Legal seller/NAP/ИНН/КПП/ОГРН и финальные privacy/consent тексты требуют подтверждения владельца; техническая миграция не должна подменять эти сведения догадками.
