# Production feed pipeline — 2026-09-29

- Исполнитель: Codex.
- Ветка: `codex/production-feed-pipeline-20260929`.
- Базовый commit: `a80d34a`.
- Область файлов: feed/runtime-скрипты, их тесты, production runbook и только изолированные dry-run артефакты.

## Цель

Подготовить отдельный production-owned ежедневный pipeline базового и Stalex-фидов: стабильный runtime, атомарная публикация `products.json` вместе с `catalog-snapshot-meta.json`, проверяемый status/log, блокировка параллельных запусков, backup/rollback и fail-closed поведение.

## Границы

- Не переключать production storefront, Nginx или DNS.
- Не менять действующие production/test cron, секреты или активные shared feed-файлы на этапе реализации и dry-run.
- Не отправлять заявки, email, Telegram, MAX или CRM-сообщения.
- Не использовать test-каталог как постоянный production source of truth.

## Критерий готовности

1. Pipeline принимает явные production-пути и не содержит скрытых ссылок на test-контур.
2. Публикация пары snapshot/metadata атомарна и возможна только после проверки схемы, SHA, свежести и Stalex merge.
3. Ошибка оставляет предыдущий production snapshot рабочим и записывает точную стадию отказа.
4. Изолированный серверный dry-run проходит без изменения active cron/feed/storefront.
5. Узкие тесты, полный ESLint, `npm test` и production build проходят; результаты и commit SHA добавлены в этот файл.

## Статус

- В работе. Активные production/test контуры не изменялись.
