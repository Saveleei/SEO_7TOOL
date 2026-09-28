# Test feed runtime guard

- Исполнитель: Codex
- Ветка: `codex/test-feed-runtime-guard`
- Базовый commit: `16c12d16cb6d4043cc6e83f94c3cf91f68f7334b`
- Цель: устранить зависимость ночного test-feed refresh от случайного состава активного storefront-релиза и сделать результат каждого запуска проверяемым.
- Область файлов: test-feed runner, отдельная runtime-проверка, атомарный status-файл, регрессионные тесты и документация.
- Ограничения: production, production cron, DNS, секреты и внешние заявки не затрагиваются; фид вручную не публикуется для приёмки.
- Критерий готовности: runner до изменения каталога проверяет `better-sqlite3` и Vinext, записывает `running/complete/failed` со стадией и SHA, test cron использует отдельный стабильный runtime, а ближайший штатный запуск подтверждается read-only проверкой.
- Проверки: узкие тесты, ESLint изменённых файлов, полный `npm test`; build только если затронут runtime приложения.
- Commit SHA: `83f20cb`, `c64d868`, `2c0e1c7`.

## Реализовано

- Ночной runner до резервной копии и изменения каталога проверяет наличие `node`, `npm`, `pm2`, обязательных скриптов, доступность `better-sqlite3` из test-feed runtime и фактический `vinext/dist/cli.js` из активного storefront.
- Результат каждого запуска атомарно записывается в `/var/www/7tool-test-shared/catalog-work/refresh-status.json`: `running`, `complete` или `failed`, текущая стадия, время начала/окончания и код выхода.
- Статус `complete` возможен только после повторного расчёта SHA-256 опубликованного `products.json` и сверки с `catalog-snapshot-meta.json`; в status сохраняются проверенные `catalogSha256` и `catalogCompletedAt`.
- Ошибка сохраняет точную стадию: `preflight`, `backup`, `refresh-feed`, `finalize`, `storefront-build`, `reload` или `complete`.
- Test-feed отделён от изменяемого storefront-релиза: создан стабильный runtime `/var/www/7tool-test-feed-runtime-20260928-c64d868`, а `/var/www/7tool-test-feed-runtime-current` указывает на него.
- В root crontab изменена только строка `7TOOL TEST`: `APP_DIR` и путь runner теперь берутся из стабильного runtime; build по-прежнему выполняется для текущего `7tool-test-current`.
- Резервная копия прежнего crontab: `/var/backups/7tool-root-crontab-before-test-feed-runtime-20260928-c64d868.txt`.
- Активный Stalex cron в `/etc/cron.d/7tool-stalex-refresh` также переведён с изменяемого storefront-релиза на `/var/www/7tool-test-feed-runtime-current/7tool-source`; расписание 03:35 МСК и lock-файл не менялись.
- Резервная копия прежнего Stalex cron: `/etc/cron.d/7tool-stalex-refresh.before-runtime-20260928-c64d868`.
- Второго активного задания Stalex нет: в root crontab совпадений не обнаружено, а файл с точкой в имени является только сохранённой резервной копией и cron его игнорирует.
- Фид вручную не запускался. Текущий snapshot и его время не изменялись во время активации.

## Проверки

- Узкие тесты runtime/status и feed operations: 7/7.
- Полный ESLint: 0 ошибок, 3 прежних предупреждения.
- Полный `npm test`: 179/182; три прежних несвязанных падения сохранены отдельно:
  - отсутствующий reviewed SEO-профиль магнитных станков;
  - две прежние checksum-ошибки editorial draft.
- Серверный `sh -n` нового runner: успешно.
- Серверный preflight: `better-sqlite3` и Vinext CLI разрешены из ожидаемых стабильных путей.
- Diff crontab подтвердил ровно одно изменение — пути test-feed runtime; production cron не изменялся.
- Diff Stalex cron подтвердил ровно одно изменение — путь runner и явный `APP_DIR` стабильного test-feed runtime.
- `cron.service` не поддерживает операцию `reload`; файл установлен корректно, сервис оставался `active`, перезапуск не выполнялся и для файлов `/etc/cron.d` не требуется.
- Cron service: `active`.
- После активации `7tool-storefront-test`: online, PID `68438`, 0 рестартов; `7tool-prod`: online, PID `63022`, без нового рестарта.
- `test.7tool.ru` отвечает защищённым `302` на `/test/access`; `7tool.ru` отвечает `200`.
- Свободно на диске: около 7,9 ГБ.

## Оставшийся контрольный гейт

- Ближайший штатный цикл: базовый фид 29 сентября 2026 года в 03:25 МСК, затем Stalex в 03:35 МСК.
- После него только чтением проверить `refresh-status.json`, новый `completedAt`, совпадение SHA, `Build complete`, успешный Stalex merge, PM2, production PID и наличие на тестовой витрине.
- Операционный гейт закрывать только после успешного штатного запуска; ручной запуск фида не считается приёмкой.
