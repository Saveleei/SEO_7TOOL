# SEO Implementation Plan

## P0

| Проблема | Эффект | Риск | Файлы | Проверка |
|---|---|---|---|---|
| Draft leakage | исключить непубликуемые товары | низкий | `feedCatalog.ts`, generated artifacts | runtime test + data check |
| title/spec conflict | не вводить клиента/бота в заблуждение | средний: меньше индексируемых URL до исправления source | `catalogQuality.ts`, product route, sitemap | conflict fixture, metadata/schema assertions |
| stale quality cache | detector всегда соответствует коду | низкий | quality analyzer + generator | artifact version test |
| preview index protection | не индексировать staging | launch coordination | robots/proxy/env | technical SEO test + live headers |
| legacy URL preservation | не потерять накопленную индексацию 18 544 URL | высокий при неполной карте | public URL helpers, `/c`, `/p`, `/brand`, retained data | frozen coverage gate |

## P1 implemented

| Проблема | Эффект | Риск | Файлы | Проверка |
|---|---|---|---|---|
| noindex pages were nofollow | сохраняет crawl paths | низкий | `seo.ts` | metadata test |
| invalid page clamp | убирает soft duplicates | низкий | category route | source guard test |
| unavailable default variant | честные availability/Offer/UI | низкий | variant presentation + product route | deterministic unit test |
| universal 12-month warranty claim | убирает неподтверждённое обещание | низкий | footer | public info test |
| missing repeatable commands | regression control | низкий | package + scripts | run all commands |
| отсутствовали brand/subcategory owners | вернуть существующий спрос без thin generation | средний | brand and subcategory routes | route/schema/coverage tests |
| preview aliases вели на отдельные owners | единые сигналы и отсутствие дублей | низкий | `proxy.ts`, internal links | one-hop redirect test |
| не было image sitemap/CollectionPage/404 | discovery, semantics и правильный error UX | низкий | sitemap/routes/not-found | SEO tests + build |
| analytics не распознавала `/c` и `/p` | восстановить conversion attribution | низкий | analytics + web vitals | analytics tests |
| не было автоматической сверки рекламного YML с storefront | обнаруживать stale price/availability/URL до публикации | низкий | feed audit script + advertising tests | `npm run feed:audit -- <url-or-file>` |

## P1/P2 backlog

1. Исправить G1031 в supplier source и снять quarantine после data check.
2. Сделать JSON/SQLite catalog publication атомарной и сверять deterministic hashes.
3. Проверять GTIN checksum и legal entity parity across feeds.
4. Brand hubs внедрены; brand×category pages создавать только при distinct demand и достаточном ассортименте.
5. Провести editorial review перед публикацией любой из 50 запланированных тем.
6. Добавить honest lastmod после появления trustworthy update timestamp; sitemap index — только при росте.
7. Field CWV внедрён; first-touch attribution и revenue dashboard требуют consent/product decisions.
8. Вернуть в feed или формально снять с продажи 51 retained legacy item.
9. Подтвердить legal seller, пересобрать Yandex feed из активного catalog snapshot и переключать route только после нулевых critical mismatches.
