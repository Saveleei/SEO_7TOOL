# Production candidate rehearsal — 2026-09-29

- Исполнитель: Codex.
- Ветка: `codex/production-candidate-20260929`.
- Базовый commit: `6857ba1`.
- Область: `design-exploration/staging-pilot`, release-пакет и read-only/loopback-проверки VPS.
- Цель: подготовить неизменяемый production-кандидат и получить доказательный GO/NO-GO без переключения основного сайта.

## Границы

- Не переключать Nginx или `7tool-prod`.
- Не менять production/test DNS, cron, секреты, feed, shared production data и PM2-конфигурацию активных процессов.
- Не отправлять формы, заявки, email, Telegram, MAX или CRM-сообщения.
- Кандидат разрешён только на отдельном loopback-порту и должен быть остановлен после проверки.
- Любое будущее production-переключение требует отдельного явного подтверждения пользователя.

## Контрольные точки

1. Production preflight и runbook подтверждают fail-closed конфигурацию.
2. Полные тесты, ESLint и production build проходят из immutable source.
3. Release archive имеет проверенный SHA-256 и не содержит секретов, runtime-данных или зависимостей.
4. На VPS кандидат запускается на отдельном loopback-порту и проходит только read-only smoke.
5. Текущий `7tool-prod` сохраняет PID, restart count, cwd и доступность; active test и feed также не меняются.
6. Зафиксированы rollback release, backup/data plan и остаточные организационные блокеры.

## Статус

- Кандидат приложения прошёл изолированную репетицию и остановлен.
- Production не переключался и не изменялся.

## Реализованное исправление P0

- Commit: `5a05181` (`fix: monitor production storefront memory`).
- PM2 больше не наблюдает промежуточный Node-процесс: production-entrypoint выполняет preflight и заменяет shell-процесс на Vinext через `exec`.
- `ecosystem.production.config.cjs` использует `/bin/sh`, `scripts/start-production.sh` и `max_memory_restart: "1024M"`.
- Ручной `start:production` использует тот же entrypoint; старый дублирующий `start-production.mjs` удалён.
- Исполняемый файл сохранён в Git с mode `100755`; shell-синтаксис проверен на целевом Linux-сервере.

## Локальные проверки

- Узкая регрессия production/release: `8/8`.
- Полный `node --test tests/*.test.mjs`: `313/313`.
- Полный ESLint: успешно, без замечаний.
- Production Vinext build: успешно, все маршруты собраны.
- После сборки три сгенерированных JSON-файла возвращены к версии commit; в кандидат не попал служебный шум.

## Immutable candidate

- Ветка: `codex/production-candidate-20260929`.
- Commit: `5a05181`.
- Локальный архив: `C:\Users\user\Documents\ChatGPT\7TOOL\.codex-tmp\production-candidate-5a05181.tar.gz`.
- Размер: `40 572 112` байт.
- SHA-256: `0f0205317d13d7745e2f64e476f9b3feb6c7badfe198a099ff746ba870d09783`.
- Серверный release: `/var/www/7tool-release-20260929-production-candidate-5a05181`.
- Изолированные runtime-данные: `/var/www/7tool-production-candidate-shared-5a05181`.
- Для репетиции использована замороженная копия тестового Stalex snapshot; активные test/prod feed-файлы не менялись.

## Серверная репетиция

- Production preflight: `16/16`.
- Серверная узкая регрессия: `8/8`.
- Серверный Vinext build: успешно.
- Контур: отдельный PM2 daemon home и loopback-порт `3199`; активный PM2 не менялся.
- Smoke: три последовательных прохода по `58/58` проверок.
- Покрыты главная, каталог, 6 задач, все 24 категории, товары, поиск, сравнение, анонимные редиректы и 7 защищённых рабочих страниц администратора.
- Проверен товар Stalex с положительным остатком: `ruchnoy-truborez-stalex-mrpc-14`.
- PM2 PID `99505` совпал с PID процесса, слушавшего порт; command line: `node node_modules/vinext/dist/cli.js start`.
- Перезапуски кандидата: `0`.
- Пик RSS после трёх полных прогревов: `834876 KB` (около `815 MiB`); после стабилизации: `706836 KB` (около `690 MiB`).
- Лимит PM2: `1073741824` байта; ложных перезапусков не было.
- После проверки кандидат удалён из временного PM2 и порт закрыт.
- Клиентские заявки и outbox не создавались; внешние каналы доставки не вызывались.

## Неизменность активных контуров

- Production: PID `77150`, restarts `2`, cwd `/var/www/7tool-release-20260911-trust-performance-029d3f3/7tool-source`.
- Test: PID `94885`, restarts `0`, cwd `/var/www/7tool-release-20260929-category-hero-ab4c584/design-exploration/staging-pilot`.
- Test symlink, cron, активные feed-файлы и error logs сохранились без изменений.
- После репетиции `https://7tool.ru/` и `https://test.7tool.ru/test/access` отвечали `200`.
- На VPS после репетиции доступно примерно `7.1 GB`; использование диска `82%`.

## Решение по гейту

- **GO для кода и immutable release-пакета.** Обнаруженный дефект контроля памяти устранён и воспроизведён на целевой Linux/PM2-среде.
- **NO-GO для переключения production-трафика до завершения операционных пунктов:**
  1. создать production-owned ежедневный объединённый feed/snapshot с атомарной metadata-парой, не ссылающийся на test-каталог;
  2. установить постоянный production auth secret через управляемое окружение, не переносить временный пароль репетиции;
  3. создать отдельный production quote workspace, резервное копирование и проверенный rollback данных;
  4. назначить владельца журнала held-outbox/заявок и контроль первой реальной заявки без автоматической внешней отправки;
  5. получить отдельное явное подтверждение пользователя на переключение Nginx/PM2 и выполнить контрольный runbook с rollback.

Текущий проверенный rollback-release остаётся `/var/www/7tool-release-20260911-trust-performance-029d3f3/7tool-source`.
