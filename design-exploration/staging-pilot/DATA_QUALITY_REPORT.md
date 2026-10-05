# Data Quality Report

Снимок: 24 опубликованные категории, 4 274 публичных товара, 18 343 варианта. Автоматический отчёт: 7 957 замечаний по 2 995 товарам; P0 — 3/1, P1 — 983/803, P2 — 6 971/2 906 (issues/affected products).

## P0

| Product | SKU/variant | URL | Source A | Source B | Severity | Решение |
|---|---|---|---|---|---|---|
| G1031 | A8177 | `/product/sverlo-koronchatoe-tct-25-mm` | название Ø25 мм | диаметр режущей части 30 мм | P0 | исправить supplier source; до этого noindex, исключение из sitemap и Product JSON-LD |
| G1031 | A8178 | тот же | название Ø25 мм | 40 мм | P0 | то же |
| G1031 | A8179 | тот же | название Ø25 мм | 55 мм | P0 | то же |

`title_spec_conflict` теперь является blocking issue. Предупреждение видно на карточке; SEO-контент и товарная schema подавлены. Quality artifact version = 2, поэтому старый кэш не может скрыть новый detector.

## Исправленные утечки

- Девять draft-товаров (`A57318`, `A47838`, `A57669`, `A57853`, `A15303`, `A15451`, `A17144`, `A58862`, `A22216`) больше не входят в public snapshot, поиск и sitemap.
- Default variant теперь выбирается по безопасной очереди: confirmed stock + valid price → confirmed stock → orderable → остальные. Это устраняет ложное «наличие уточняем» у 223 групп при наличии доступного исполнения.

## P1 / P2 backlog

- P1: 983 issues / 803 products — главным образом missing images, non-filterable products, malformed/outlier numeric facts.
- P2: 6 971 issues / 2 906 products — missing price/SKU/decision parameters и duplicate signatures.
- 350 товаров входят в bounded enrichment queue как не участвующие в guided selection.
- Upstream risks: JSON/SQLite publish не атомарен; provenance по умолчанию отключён; supplier price округляется до integer; GTIN проверяется по длине без checksum; legal entity в storefront и advertising feed требует сверки.

## Automation

`npm run data:check` проверяет public draft leaks, полноту P0 quarantine и выводит агрегаты. Текущий ожидаемый статус — `PASS_WITH_QUARANTINE`: guard исправен, но source conflict G1031 ещё не исправлен.
