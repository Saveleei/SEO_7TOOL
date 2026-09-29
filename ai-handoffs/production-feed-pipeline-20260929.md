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

- Реализация: commit `0820ad2c4c56e46eca55d54fce755a06bb347533` (`feat: add production-owned feed pipeline`).
- Активные production/test контуры, cron, DNS и секреты не изменялись.

## Что реализовано

- Отдельный production-owned runner с режимом `dry-run` по умолчанию и явным `publish`.
- Проверка всех рабочих путей: выход за production shared root и любой `7tool-test-*` блокируются до создания каталогов, lock и status.
- Базовый K2Tool snapshot и Stalex snapshot объединяются только после сверки SHA базового каталога и точного рассмотренного списка Stalex `productIds`.
- `products.json`, metadata и Stalex report публикуются в неизменяемое поколение; один атомарный symlink `catalog-current` переключает пару catalog/metadata вместе.
- Ошибка validation, PM2 reload или loopback health оставляет либо восстанавливает предыдущее поколение.
- Production reload ограничен фактическим процессом `7tool-prod`; health URL допускает только loopback HTTP.
- CLI корректно работает через стабильный symlink на immutable runtime.

## Локальные проверки точного коммита

- Узкие production feed / Stalex / operations тесты: зелёные; новый production pipeline — `6/6`.
- Полный `node --test tests/*.test.mjs`: `185/188` пройдено.
- Три падения являются существующим контентным baseline и не связаны с pipeline:
  - отсутствует рассмотренный SEO-профиль магнитных станков;
  - два редакционных approval checksum не соответствуют текущим черновикам.
- ESLint: `0` ошибок, три существующих предупреждения (`<img>`, Yandex Metrika strategy, unused semantic index).
- Next production build: успешно, 149 статических страниц; временный `.next` после проверки удалён.

## Изолированная проверка VPS

- Runtime: `/var/www/7tool-production-feed-runtime-20260929-0820ad2`.
- Dry-run root: `/var/www/7tool-production-feed-dry-run-0820ad2`.
- Входы были скопированы в dry-run root; постоянной зависимости от test-каталога не создавалось.
- Runner status: `validated`, `completedAt=2026-09-29T00:25:14.061Z`.
- Итоговый SHA-256: `8413cf1ca18a4af0423ff731914e43bac434b71d872a02bdaed348f91387a057`.
- Итог: 4 357 товаров, 18 484 исполнения, 21 рассмотренный товар Stalex; у 13 Stalex-позиций подтверждён положительный остаток.
- Linux atomic publish создал поколение `catalog-releases/20260929002514-8413cf1ca18a`; SHA файла совпал с metadata и manifest.
- Повторная публикация с повреждённым Stalex report была заблокирована, `catalog-current` остался на проверенном поколении.
- После проверки: production `7tool-prod` PID `100870`, restarts `3`, cwd прежний; test PID `94885`, restarts `0`; HTTP production `200`, test access `302`.
- Контрольные SHA активных test/base/Stalex файлов не изменились. `/var/www/7tool-production-shared` и `/var/www/7tool-production-feed-runtime-current` не создавались.
- Свободно на VPS после очистки временных копий: около 6.9 GiB; сохранённые доказательные каталоги занимают около 197 MiB.

## Оставшийся launch gate

Перед реальным ежедневным включением нужны отдельное явное разрешение и один управляемый cutover: создать production shared root и закрытый env, скопировать production database/reviewed baseline, направить storefront на `catalog-current`, выполнить backup + smoke и только после этого добавить ночной cron. Текущая реализация готова к этому этапу, но сама его не выполняла.
