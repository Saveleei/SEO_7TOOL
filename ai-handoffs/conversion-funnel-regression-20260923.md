# Conversion funnel regression — handoff

- Agent: Codex
- Branch: `codex/conversion-funnel-regression`
- Base: `bf9e642`
- Goal: audit and repair the shortest B2B conversion path from storefront discovery through quote composition, contact details, confirmation, and manager visibility.
- Ownership: regression tests and minimal fixes for storefront navigation, quote/request state, confirmation, and authenticated request workspace.
- Safety: no production deployment, credentials, DNS, Nginx, supplier feed, external email, MAX/CRM delivery, or real customer lead submission.
- Completion criteria: desktop/mobile flows are coherent; item links and context survive the funnel; safe local or isolated test data verifies persistence and manager visibility; focused tests, lint, full tests, and build pass when source changes warrant them.

## Status

Complete locally. No deployment was performed.

## Findings

- The full local funnel passed from homepage discovery through task/category navigation, exact variant selection, quote composition, safe local submission, confirmation number, authenticated manager journal, request detail, and the exact product deep link.
- Local synthetic request `7T-20260923-1DC518` proved durable manager visibility with external email, MAX, and CRM delivery disabled. The isolated `.qa-data` directory was removed after verification.
- A critical mobile collision was found on feed-backed product pages: the global fixed mobile action bar remained visible because its CSS exclusion only recognized the legacy `.product-page` class. It covered the product buybar, so tapping the visible `КП` control could increment the item instead of opening the quote.
- Feed product pages now hide the global mobile action bar. The product buybar adds the exact execution once, changes its label to `Открыть КП`, and opens the existing quote on the next tap without changing quantity.
- The mobile quote item reserves enough space for the remove action, preventing `Удалить` from visually colliding with a wrapped product title.
- Existing category and recommendation add buttons retain their repeat-add behavior; the open-on-added behavior is opt-in only for the fixed product buybar.

## Verification

- Focused conversion suite: 47/47 passing.
- Full test suite: 238/238 passing.
- ESLint: passing with `eslint . --ignore-pattern dist --ignore-pattern .next`.
- Production build: passing with `vinext build`.
- Browser, desktop 1280×720: no horizontal overflow; desktop product CTA remains usable; mobile-only bars remain hidden.
- Browser, mobile 390×844: no horizontal overflow; global action bar is hidden; button center resolves to the product buybar; first tap adds one item; second tap opens the quote with quantity still `1`; drawer and form have no horizontal overflow; close control restores scrolling.
- Visual mobile QA confirmed clear separation between the product title and `Удалить` in the quote composition.
- No production/test-domain deployment, feed mutation, credential change, or external lead delivery.

## Commits

- Implementation and verified handoff snapshot: `6023078` (`fix: stabilize mobile quote conversion path`).

## Test deployment — 2026-09-23

- Пользователь продолжил заранее описанный этап release-candidate и публикации только на `test.7tool.ru`. Production, DNS, Nginx, credentials, supplier feed и внешние каналы не изменялись.
- Опубликован branch head `7603c36` (реализация `6023078`). Активный release: `/var/www/7tool-release-20260923-conversion-funnel-7603c36`.
- Предыдущий release `/var/www/7tool-release-20260923-catalog-media-d821533` сохранён для rollback; новый head является его прямым потомком, поэтому каталог-медиа и подтверждённые изображения не потеряны.
- Архив перед распаковкой проверен по SHA-256: `436960acb5e304b0b5cf859606fd2967a4d13bfe0e7231c6e9a7add1fbbe4932`. Lockfile совпал с активным release; неизменяемое дерево `node_modules` переиспользовано hard-link копией.
- Перед переключением создан backup тестовых данных: `/var/www/7tool-test-shared/backups/quote-requests-before-7603c36-20260923.tar.gz`.
- На сервере в отдельной release-папке прошли 238/238 тестов, полный ESLint и production build.
- Изолированный кандидат на `127.0.0.1:3199` последовательно прошёл 50 read-only проверок: главная, поиск, товар, задачи, все опубликованные категории и анонимные редиректы защищённых рабочих пространств. Формы и внешние каналы не вызывались.
- Rollback-safe переключение прошло успешно: `7tool-storefront-test` online, `0` рестартов, cwd/script path указывают на новый release, PM2 process list сохранён, error-log не вырос (`2931 -> 2931` bytes).
- Внешний HTTPS: anonymous home возвращает `302` на `/test/access`, страница входа — `200`; production `https://7tool.ru/` остался `200`.
- Встроенный браузер подтвердил штатную страницу входа и возврат на карточку товара. Сохраняется ранее известное ограничение test-only Nginx gateway: `returnTo` сохраняет pathname, но отбрасывает query выбранного варианта. Исправление требует отдельного явного разрешения на изменение Nginx; production этим шлюзом не затронут.
- После релиза на `/var/www` свободно около `7.0 GB`. Тестовые лиды, email, Telegram, MAX и CRM не отправлялись.
