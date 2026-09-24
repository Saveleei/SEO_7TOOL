# Test security and authenticated acceptance — 2026-09-24

- Исполнитель: Codex.
- Ветка: `codex/test-security-auth`.
- База: `3d71dc53bc8b1b0bcc79c698cc998108e416c78b` (`codex/launch-readiness`).
- Область: `design-exploration/staging-pilot`, test-контур `test.7tool.ru`.

## Цель

Закрыть два оставшихся P0/P1 перед бизнес-приёмкой: единые безопасные HTTP-заголовки для storefront/test workspace и полный авторизованный smoke на изолированном кандидате без чтения или изменения действующего пароля.

## Критерии готовности

1. HTML и API-ответы получают централизованные `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` и `Permissions-Policy`; download/media routes сохраняют более строгие собственные политики.
2. Политика покрыта регрессиями и реально видна в production build Vinext, а не только в конфигурационном файле.
3. Изолированный кандидат проходит все публичные, анонимные и авторизованные release routes с временными однократными учётными данными; customer/quote/delivery POST не выполняются.
4. Полный lint, test и build проходят.
5. `test.7tool.ru` переключается только после backup, server-side build, route smoke и rollback gate. Production, DNS, production Nginx и рабочие секреты не меняются.

## Статус

- Реализация завершена и опубликована только на `test.7tool.ru`.
- Ветка: `codex/test-security-auth`.
- Реализация: `93d108a security: harden storefront responses` и `9e6a7ca perf: precompute catalog quality report`.
- Активный test release: `/var/www/7tool-release-20260924-security-auth-9e6a7ca/design-exploration/staging-pilot`.
- Rollback release: `/var/www/7tool-release-20260924-launch-readiness-9cedfd0/design-exploration/staging-pilot`.
- Backup общих test-данных: `/var/backups/7tool-test-shared-20260924-security-auth-9e6a7ca.tar.gz`.

## Что изменено

- Добавлена единая серверная политика заголовков: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- Политика применяется через Next 16 `proxy.ts` к HTML и API; статические оптимизированные assets исключены, download routes сохраняют собственные более строгие заголовки.
- Для `/test/catalog-quality` добавлен проверяемый build-time snapshot отчёта, связанный с SHA исходного supplier feed. При опубликованной администраторской корректировке параметров или несовпадении feed SHA система автоматически возвращается к динамическому пересчёту.
- Большой JSON читается с диска и не встраивается в server bundle.

## Контрольные точки

1. Локально: `268/268` тестов, полный ESLint и Vinext production build — успешно.
2. На неизменяемом server candidate: `268/268` тестов, полный ESLint и production build — успешно.
3. Изолированный авторизованный smoke с однократными учётными данными: `58/58` маршрутов — успешно. Клиентские заявки, КП и доставка не отправлялись и не изменялись.
4. Диагностический прогон подтвердил четыре заголовка на каждом проверенном ответе. Авторизованный `/test/catalog-quality` сократился с `24 860 ms` до `95 ms`; самый медленный публичный маршрут в этом прогоне — `1 675 ms`.
5. Однократные credentials удалены сразу после smoke; candidate на порту 3199 остановлен.
6. Перед переключением создан backup. PM2 test переключён с PID `346606` на PID `352023`; новый процесс `online`, restart count `0`, cwd совпадает с release `9e6a7ca`.
7. Внешний `https://test.7tool.ru/test/access` отдаёт все четыре заголовка и Nginx HSTS. `https://7tool.ru/` отвечает `200`; production PID `347912` не перезапускался и не переключался этой работой.
8. Встроенный браузер: экран доступа проверен на `1440×900` и `390×844`; горизонтального переполнения нет, поля и CTA доступны. Формы не отправлялись.

## Неблокирующее наблюдение

- В консоли браузера остаётся известная ошибка beta-слоя Vinext при RSC-prefetch (`te is not a function`). Она не нарушает переходы в текущей конфигурации, где включён `FORCE_DOCUMENT_NAVIGATION=1`, но её стоит убрать отдельным обновлением платформенного слоя после фиксации поддерживаемой версии.

## Откат

1. Экспортировать текущее окружение test-процесса без вывода значений секретов.
2. Удалить только `7tool-storefront-test` из PM2.
3. Запустить `ecosystem.test.config.cjs` из rollback release `9cedfd0` с сохранённым окружением.
4. Проверить `/test/access`, cwd процесса и затем выполнить `pm2 save`.
