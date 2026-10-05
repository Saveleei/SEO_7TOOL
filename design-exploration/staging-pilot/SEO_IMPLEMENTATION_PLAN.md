# SEO Implementation Plan

## P0

| Проблема | Эффект | Риск | Файлы | Проверка |
|---|---|---|---|---|
| Draft leakage | исключить непубликуемые товары | низкий | `feedCatalog.ts`, generated artifacts | runtime test + data check |
| title/spec conflict | не вводить клиента/бота в заблуждение | средний: меньше индексируемых URL до исправления source | `catalogQuality.ts`, product route, sitemap | conflict fixture, metadata/schema assertions |
| stale quality cache | detector всегда соответствует коду | низкий | quality analyzer + generator | artifact version test |
| preview index protection | не индексировать staging | launch coordination | robots/proxy/env | technical SEO test + live headers |

## P1 implemented

| Проблема | Эффект | Риск | Файлы | Проверка |
|---|---|---|---|---|
| noindex pages were nofollow | сохраняет crawl paths | низкий | `seo.ts` | metadata test |
| invalid page clamp | убирает soft duplicates | низкий | category route | source guard test |
| unavailable default variant | честные availability/Offer/UI | низкий | variant presentation + product route | deterministic unit test |
| universal 12-month warranty claim | убирает неподтверждённое обещание | низкий | footer | public info test |
| missing repeatable commands | regression control | низкий | package + scripts | run all commands |

## P1/P2 backlog

1. Исправить G1031 в supplier source и снять quarantine после data check.
2. Сделать JSON/SQLite catalog publication атомарной и сверять deterministic hashes.
3. Проверять GTIN checksum и legal entity parity across feeds.
4. Добавить approved brand hubs, затем curated brand×category pages только при distinct demand.
5. Ввести content model и editorial review до публикации 50 тем.
6. Добавить honest lastmod/image metadata и sitemap index при необходимости.
7. Подключить RUM/CWV, first-touch organic attribution и revenue-quality dashboard.
