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

1. Провести финальную визуальную приёмку approved Vinext на desktop/mobile.
2. Создать immutable production release, настроить защищённый env и backup для `QUOTE_DATA_DIR`.
3. Запустить кандидата на loopback-порту, выполнить read-only smoke и только затем отдельно согласовать переключение Nginx/PM2.
4. До подключения проверенных email/MAX/CRM adapters назначить сотрудника, который контролирует защищённый журнал заявок.

## Операционный гейт фида — закрыт 2026-09-29

- Штатный cron 03:25 Europe/Moscow завершился в 03:26:03 с `exitCode: 0`; ручной запуск не выполнялся.
- Основной snapshot: `completedAt=2026-09-29T00:25:14.061Z`, SHA-256 `6d494b66ce923ec927dab4e0981adf9e9271e753fa7c91c8f80995affff60b80`, metadata `status=complete`, checksum совпадает.
- Stalex pilot: 21 допущенная позиция, 13 с подтверждённым положительным остатком; итоговый SHA-256 `db0af739e373a3a95717e5068366b6a29d05c05a7f77ab0529a5e72028f9aae4`, checksum совпадает.
- Активный test использует Stalex pilot snapshot; в нём 4 357 товарных групп, 18 484 исполнения и 4 200 исполнений с `available=true` и `quantity>0`.
- Vinext build прошёл в штатном задании, `7tool-storefront-test` online, `unstable restarts=0`; `7tool-prod` online, `unstable restarts=0` и не затрагивался заданием.
- `https://test.7tool.ru/` корректно отвечает 302 на application login; `https://7tool.ru/` отвечает 200.

## Ограничения этого этапа

- Не изменялись VPS, Beget, Nginx, PM2, cron, DNS, production/test домены или секреты.
- Не выполнялись внешние отправки и не создавались заявки на реальных доменах.
- Служебные URL пока сохраняют исторический префикс `/test/`, но защищены авторизацией и noindex; переименование не является блокером запуска.
