# Test login page — 2026-09-21

- Исполнитель: Codex
- Ветка: `codex/test-login-page`
- База: `288ee59`
- Цель: заменить нестабильный HTTP Basic Auth на обычную защищённую страницу входа для `test.7tool.ru`, не затрагивая production.
- Область: `design-exploration/staging-pilot` — менеджерская сессия, форма входа, preview-gate API, тесты и конфигурационный пример.
- Критерии готовности: пароль проверяется только на сервере по безопасному хэшу; сессия HttpOnly; есть rate limit, logout и gate-check; тесты, lint и build проходят; внешний тестовый домен не открывается до отдельного безопасного переключения nginx.
- Ограничения: production, DNS, Beget, внешние отправки и секреты не меняются в ходе реализации.

## Результат

- Commit SHA: `e04a3f4` (content commit before this handoff-only amend)
- Реализована HTML-форма логина/пароля вместо браузерного Basic Auth.
- Пароль проверяется только на сервере по `PBKDF2-SHA256`-хэшу; plaintext не хранится в коде или конфигурации репозитория.
- Сохранены same-origin/CSRF-проверка, rate limit, подписанная HttpOnly/SameSite=Strict сессия на 8 часов и штатный logout.
- Добавлен внутренний `GET /api/manager-auth/check`, который принимает только локальную подписанную сессию и не доверяет platform-заголовкам.
- Добавлен deny-by-default nginx-шаблон для `test.7tool.ru`: публичны только форма входа, credential endpoint и статические чанки; остальные маршруты проверяются через `auth_request`.
- Возврат после входа сохраняет безопасный внутренний путь, query и hash; внешние URL и петля на `/test/access` отклоняются.
- Узкие тесты: 11/11.
- Полный `node --test tests/*.test.mjs`: 198/198.
- Полный ESLint: passed.
- `vinext build`: passed; маршрут `/api/manager-auth/check` присутствует в сборке.
- Browser QA: desktop и 390×844; неверный пароль показывает понятную ошибку без cookie; правильный пароль открывает сессию; logout работает; возврат в `/catalog/category/borfrezy?view=table#products` сохранён.
- Release-smoke принимает логин и пароль только через временные `SMOKE_MANAGER_*` переменные и выполняет реальный credential flow без внешних отправок.
- Внешние заявки и сообщения не отправлялись.
- Переключение `test.7tool.ru`: не выполнено; требуется отдельное применение release + nginx-конфигурации. Production/DNS/секреты не менялись.
