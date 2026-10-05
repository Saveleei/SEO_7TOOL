# SEO URL Parameters

Все параметры исключены из sitemap. Canonical всегда указывает на чистый pathname. Параметризованные листинги/варианты получают `noindex, follow`, чтобы не раздувать индекс и не обрывать crawl graph.

| Parameter | Тип | Польза | Index | Canonical | Crawl |
|---|---|---|---|---|---|
| `page` | pagination | доступ к выдаче | noindex сейчас | clean category | follow; invalid/out-of-range = 404 |
| `q` | functional search | поиск в категории | noindex | clean category | follow |
| `sort` | sorting | порядок | noindex | clean category | follow |
| `view` | UI | table/cards | noindex | clean category | follow |
| `availability` | filter | confirmed stock | noindex | clean category | follow |
| `kind` | structural filter | equipment/accessories | noindex до отдельного intent approval | clean category | follow |
| `segment`, `drill_type`, `family` | structural filters | guided selection | noindex до curated landing | clean category | follow |
| `f_*` | facet | discrete specs | noindex | clean category | follow, не в sitemap |
| `min_*`, `max_*` | range | numeric specs | noindex | clean category | follow, не в sitemap |
| `variant` | product execution | exact selection | noindex | base product | follow |
| `utm_*`, `gclid`, `yclid`, `from` | tracking | attribution | noindex by parameter presence | clean pathname | ignore for SEO |

## Яндекс Вебмастер

После production cutover проверить «Параметры URL»: tracking/sort/view — не меняют документ; filters/ranges/variant — меняют представление, но не должны индексироваться. Не блокировать их robots.txt до подтверждения обработки `noindex`. Сначала наблюдать отчёт исключённых страниц и crawl stats; не создавать правила, конфликтующие с canonical.
