# Vinext production readiness

- Исполнитель: Codex
- Ветка: `codex/vinext-production-readiness`
- Базовый commit: `697a888`
- Implementation commit: `8fe9569`
- Область: `design-exploration/staging-pilot`
- Статус: реализация и локальная проверка завершены; деплой не выполнялся.

## Что закрыто

- Production-приём заявок отделён от `QUOTE_TEST_MODE`: новый `QUOTE_WORKSPACE_ENABLED=1` разрешает надёжное серверное сохранение без включения тестового контура.
- Все рабочие данные используют единый `QUOTE_DATA_DIR`; старый `QUOTE_TEST_DATA_DIR` сохранён только для совместимости стенда.
- После синхронного сохранения заявки создаётся одна privacy-safe запись `request-intake-outbox.jsonl` без контактов клиента. Email, MAX и CRM остаются в состоянии `held`, внешняя отправка не включена.
- Клиентские confirmation states больше не ведут во внутренний `/test/requests`; покупателю остаются номер заявки, понятные дальнейшие шаги и контакты 7TOOL.
- Локальный вход администратора допускается только для точного allowlist хостов и использует PBKDF2 + HttpOnly/SameSite session; production-хосты отделены от staging alias.
- Добавлен fail-closed production preflight: проверяются режим, SEO, админ-доступ, каталог и его SHA-256/свежесть, writable storage, отгрузка, рабочие дни, cutoff и порт.
- Добавлены защищённый production start wrapper, PM2-конфигурация с memory/restart guard и runbook переключения/наблюдения/rollback.
- Тестовый баннер и тестовые формулировки скрываются вне тестового контура.

## Проверки

- `eslint`: passed.
- Полный регресс: `311 passed, 0 failed`.
- Production build Vinext: passed; 24 категории сгенерированы.
- Изолированная business acceptance: passed, 19 checks; заявка → менеджер → КП → PDF (3 страницы, 1 фото) → held outbox; внешняя доставка отключена, временные данные удалены.
- `git diff --check`: passed (только информационные Windows LF/CRLF warnings).

## Остаточные launch-gates

1. Дождаться успешного штатного ночного запуска фида в 03:25 Europe/Moscow и сверить SHA-256/`completedAt`/PM2 без ручного запуска.
2. Провести финальную визуальную приёмку approved Vinext на desktop/mobile.
3. Создать immutable production release, настроить защищённый env и backup для `QUOTE_DATA_DIR`.
4. Запустить кандидата на loopback-порту, выполнить read-only smoke и только затем отдельно согласовать переключение Nginx/PM2.
5. До подключения проверенных email/MAX/CRM adapters назначить сотрудника, который контролирует защищённый журнал заявок.

## Ограничения этого этапа

- Не изменялись VPS, Beget, Nginx, PM2, cron, DNS, production/test домены или секреты.
- Не выполнялись внешние отправки и не создавались заявки на реальных доменах.
- Служебные URL пока сохраняют исторический префикс `/test/`, но защищены авторизацией и noindex; переименование не является блокером запуска.
