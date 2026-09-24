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

- Реализация не начата.
