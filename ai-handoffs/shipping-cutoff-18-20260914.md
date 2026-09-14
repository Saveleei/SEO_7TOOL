# Shipping cutoff 18:00 — handoff

- Owner: Codex `/root`
- Branch: `codex/shipping-cutoff-18`
- Base: `b040a8f`
- Scope: единая серверная формулировка отгрузки для подтверждённого положительного остатка в тестовом storefront; cutoff 18:00 Europe/Moscow, рабочие дни и конфигурация; каталог, поиск, карточка, варианты, сравнение, рекомендации, sticky CTA и черновик КП.
- Out of scope: production, DNS, товарный фид, секреты, внешняя отправка заявок. Изменён только явно разрешённый изолированный процесс `test.7tool.ru`.

## Acceptance criteria

- До 18:00 по Москве в рабочий день только вариант с `available === true` и `quantity > 0` получает текст «В наличии · Отгрузка сегодня».
- С 18:00 и в нерабочий день подтверждённый остаток получает текст о следующем рабочем дне.
- Неизвестный, нулевой и неподтверждённый остаток не получает обещание отгрузки сегодня.
- Cutoff, timezone и рабочие дни имеют безопасные дефолты и могут быть настроены через env.
- Покупательские точки используют один расчёт; тесты покрывают границу времени и матрицу остатка.
- Проверены desktop/mobile без отправки форм.

## Result

Готово, проверено и развёрнуто только на защищённом `test.7tool.ru`. Production не изменялся и не перезапускался.

## Implemented

- Добавлен единый серверный расчёт статуса: `Europe/Moscow`, cutoff `18:00`, рабочие дни понедельник–пятница.
- Только `available === true` вместе с конечным `quantity > 0` получает обещание отгрузки.
- До 18:00 в рабочий день выводится «В наличии · Отгрузка сегодня»; с 18:00 и в нерабочий день — «В наличии · Отгрузка в следующий рабочий день».
- Неизвестный, отсутствующий, нулевой и неподтверждённый остаток получает «Наличие и срок уточняем» без обещания отгрузки сегодня.
- Одинаковая презентация передаётся в категорию (карточки и таблица), поиск, карточку товара, селектор вариантов, рекомендации, сравнение, мобильный sticky CTA и черновик КП.
- Сохранённый черновик КП при каждом открытии безопасно обновляет статус через локальный no-store endpoint; при ошибке обновления используется осторожный статус без обещания.
- Добавлена env-конфигурация `SHIPPING_TIME_ZONE`, `SHIPPING_CUTOFF_HOUR`, `SHIPPING_WORKING_DAYS` с безопасными дефолтами.
- Test PM2-конфигурация явно фиксирует `Europe/Moscow`, cutoff `18` и рабочие дни `1,2,3,4,5`.
- Увеличен статус в мобильном sticky CTA до читаемых 10 px; положительный статус выделен спокойным зелёным.

## Verification

- Focused tests: 13 passed.
- Full regression: 161 passed, 0 failed.
- Full ESLint: passed.
- Production build: passed; `/api/shipping-promises` присутствует в route manifest.
- Release smoke: 46 checks passed на изолированном локальном контуре `http://127.0.0.1:3192`; внешние формы и доставки не вызывались.
- Browser desktop: карточка LZHS, таблица борфрез и сравнение магнитных станков показывают единый статус без наложений.
- Browser mobile 390 × 844: buybox, sticky CTA и черновик КП читаемы; при открытии КП статус обновляется с сервера. Формы не отправлялись.
- Server release copy: 161/161 tests passed, full ESLint passed, production build passed.
- Candidate smoke на порту 3199 и post-switch smoke на порту 3000: 46/46 каждый; покупательские формы, создание КП и внешняя доставка не вызывались.
- Активный endpoint на порту 3000 и HTML карточки возвращают «В наличии · Отгрузка сегодня» до cutoff.
- PM2: `7tool-storefront-test` online с 0 рестартов из новой release-папки; временный кандидат удалён, список PM2 сохранён.
- Внешний gate `https://test.7tool.ru/` возвращает ожидаемый Basic Auth `401`; `https://7tool.ru/` остаётся `200`.
- Повторный визуальный HTTPS-проход из автоматизированного браузера остановился на `ERR_INVALID_AUTH_CREDENTIALS`; визуально проверен тот же собранный артефакт локально, а опубликованный процесс проверен через loopback HTML/API и полный smoke.
- После удаления временного архива на `/var/www` свободно 2.9 GB.

## Local preview

- `http://127.0.0.1:3191/product/magnitnyy-sverlilnyy-stanok-lenz-steyr-35?variant=A9409#variants`

## Test release

- URL: `https://test.7tool.ru/product/magnitnyy-sverlilnyy-stanok-lenz-steyr-35?variant=A9409#variants`
- Active release: `/var/www/7tool-release-20260914-shipping-cutoff-c47283a`
- Preserved rollback: `/var/www/7tool-release-20260914-product-hierarchy-5dc1d22`
- Production remains `/var/www/7tool-release-20260911-trust-performance-029d3f3/7tool-source`.

## Commit

- `1adab2c` — `feat: promise same-day shipping before cutoff`
- `c47283a` — `chore: configure test shipping cutoff`
