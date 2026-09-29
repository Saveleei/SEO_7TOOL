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
- Коммиты реализации: `349ff4c`, `7502bd4`, `ab96205`.
- Активный release `new`: `/var/www/7tool-release-20260929-new-leads-ab96205/design-exploration/staging-pilot`.
- Активный feed runtime: `/var/www/7tool-new-feed-runtime-20260929-7502bd4` через `/var/www/7tool-new-feed-runtime-current`.
- Shared root: `/var/www/7tool-new-shared`; секретные env имеют права `0600` и не попали в Git.

## Локальные проверки

- Intake/store/backend tests: `21/21`.
- Production feed pipeline tests: `6/6`.
- Полный staging-pilot test suite: успешно, включая четыре новых intake-теста.
- ESLint изменённых staging-pilot и feed runtime файлов: без ошибок.
- Vinext build: успешно, пять стадий завершены.
- Полный `7tool-source` suite сохранил только три прежних несвязанных падения: отсутствующий reviewed SEO-профиль магнитных станков и две прежние checksum-ошибки editorial draft.
- Дополнительный тест запуска worker через release symlink: успешно, всего intake-тестов `6/6`.

## Серверная проверка

- Первый publish-цикл `new-preview` завершён `2026-09-29T20:21:51.455Z` со статусом `complete`.
- SHA `products.json` и `catalog-snapshot-meta.json` совпадает: `0656e1c3457d070ca9e068251300796889bb9265c66f9be8bed3bb4ed7e5e736`.
- Активное поколение каталога: `/var/www/7tool-new-shared/catalog-releases/20260929202129-0656e1c3457d`.
- В объединённом каталоге опубликован 21 проверенный товар Stalex; у 12 вариантов есть подтверждённый положительный остаток.
- `/etc/cron.d/7tool-new-operations`:
  - основной feed + Stalex ежедневно в `00:45 UTC` (`03:45 Europe/Moscow`);
  - intake worker каждую минуту, с отдельным `flock` и логом.
- Cron фактически выполнил worker через `/var/www/7tool-new-current`; пустая очередь дала `processed=0`, тестовая — `delivered=1`, без ошибок.
- Браузерная проверка подтвердила новую честную плашку, категорию, карточку товара и открытие формы быстрого запроса; согласие отмечено по умолчанию. До согласованного E2E-теста форма не отправлялась.
- Согласованный E2E-тест:
  - заявка новой витрины: `7T-20260929-42A9C6`;
  - CRM request: `7T-20260929-215E8D`;
  - bridge: `delivered`, попытка `1`;
  - email: `sent`, попытка `1`;
  - MAX: `sent`, попытка `1`.
- После проверки `new.7tool.ru` и `7tool.ru` отвечали `HTTP 200`; `7tool-storefront-new` online с `0` рестартов. Production `7tool-prod` сохранил прежний PID/uptime и `3` исторических рестарта — во время этой активации не перезапускался.
- Свободное место после сборки: около `5.5 GiB`.

## Эксплуатационные замечания и откат

- Контур `new` работает с `QUOTE_TEST_MODE=1`, поэтому его нельзя запускать через `ecosystem.production.config.cjs`: production preflight закономерно отклонит тестовую конфигурацию. Текущий PM2-процесс запускается напрямую через `node_modules/vinext/dist/cli.js start` с interpreter `node` и env из `/var/www/7tool-new-shared/new.env`.
- Проверенный pre-lead release: `/var/www/7tool-release-20260929-new-preview-49ee8f8-feed8413cf1/design-exploration/staging-pilot`.
- Резервная копия env до включения доставки: `/var/www/7tool-new-shared/backups/new.env.before-leads.20260929T203119Z`.
- Для полного отката: вернуть оба пути только в контуре `new`, затем заново создать `7tool-storefront-new` прямым Vinext-запуском. `7tool-prod`, DNS и production catalog pointer не менять.

## Итог

Операционный гейт заявок и отдельного ежедневного feed-контура `new.7tool.ru` пройден. Внешняя доставка подтверждена реальными статусами CRM/email/MAX, production storefront не изменён.
