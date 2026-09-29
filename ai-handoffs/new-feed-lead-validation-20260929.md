# New feed and lead delivery — 2026-09-29

- Исполнитель: Codex.
- Ветка: `codex/new-feed-lead-validation-20260929`.
- Базовый commit: `09512dafd99b1ca010ba6f0fc188c095a90e78b4`.
- Область: изолированный ночной feed-контур `new.7tool.ru`, intake-outbox заявок новой витрины, регрессионные тесты и серверный runbook.

## Цель

1. Обновлять базовый и Stalex-каталоги `new.7tool.ru` ежедневно без изменения `7tool.ru` и `test.7tool.ru`.
2. Сначала надёжно сохранять заявку новой витрины, затем идемпотентно передавать её в существующий production lead-registry, где уже работают email и MAX.
3. Проверить один помеченный сквозной тест только после отдельного подтверждения непосредственно перед внешней отправкой.

## Границы

- Не менять production release, production feed pointer, DNS и production cron.
- Не копировать секреты в Git и не выводить их в логи.
- Не отправлять внешнюю тестовую заявку до action-time подтверждения пользователя.
- Все runtime/status/log/lock/catalog/request пути `new` отделены от production и test.

## Критерии готовности

- Feed runner принимает `new-preview` только с точными путями `/var/www/7tool-new-shared` и процессом `7tool-storefront-new`.
- Новый intake worker повторяемо передаёт заявку в production lead API по стабильному `submissionId`, не пишет PII в очередь доставки и не создаёт дублей.
- Ошибки доставки сохраняются с retry-временем, успешные записи больше не отправляются.
- Узкие тесты, lint изменённых файлов, полный `npm test` и build проходят либо baseline зафиксирован отдельно.
- На VPS подтверждены отдельный cron, свежий catalog SHA, PM2 health и один согласованный сквозной test request.

## Статус

- Реализован privacy-safe intake bridge: новая витрина сначала синхронно сохраняет заявку, затем отдельный worker с точным endpoint allowlist и стабильным `submissionId` передаёт её в существующий production lead-registry.
- В production lead-registry фактически настроены SMTP, MAX и минутный notification worker; агрегированная read-only проверка показала последние email/MAX записи со статусом `sent`.
- Добавлен строгий feed target `new-preview`: разрешены только `/var/www/7tool-new-shared`, dedicated runtime и PM2 `7tool-storefront-new`; default production-поведение не изменено.

## Локальные проверки

- Intake/store/backend tests: `21/21`.
- Production feed pipeline tests: `6/6`.
- Полный staging-pilot test suite: успешно, включая четыре новых intake-теста.
- ESLint изменённых staging-pilot и feed runtime файлов: без ошибок.
- Vinext build: успешно, пять стадий завершены.
- Полный `7tool-source` suite сохранил только три прежних несвязанных падения: отсутствующий reviewed SEO-профиль магнитных станков и две прежние checksum-ошибки editorial draft.

## Ещё требуется

- Commit SHA.
- Изолированная установка new feed runtime/cron и intake worker на VPS.
- Ручной запуск new feed, сверка SHA/health/PM2.
- Один согласованный сквозной test request и подтверждение статусов CRM/email/MAX.
