# Production runbook: аналитика, уведомления и рекламный фид

## Переменные окружения

Обязательные:

```dotenv
NEXT_PUBLIC_YANDEX_METRIKA_ID=109097461
NEXT_PUBLIC_SITE_URL=https://7tool.ru
SQLITE_PATH=/absolute/path/shared/data.db
CRON_SECRET=<random-secret>
```

Для уведомлений нужны существующие SMTP-переменные, `LEADS_TO`, `LEADS_FROM`, а также `MAX_BOT_TOKEN` и `MAX_USER_ID` либо `MAX_CHAT_ID`. Для автоматической выгрузки офлайн-конверсий нужен `YANDEX_METRIKA_OAUTH_TOKEN`. Для коллтрекинга — `CALL_TRACKING_WEBHOOK_SECRET` после выбора провайдера. Секреты хранятся только в общей production env.

## Очередь заявок

Заявка и строки outbox сохраняются одной транзакцией. HTTP-ответ содержит `requestId` независимо от доступности SMTP/MAX. Повторы выполняются с интервалами 1, 5, 15, 60 минут, затем 6 часов. В админке видны состояние, число попыток, время следующего повтора и последняя ошибка; ручная кнопка сохраняется.

Cron добавляется отдельной строкой без замены существующего расписания:

```cron
* * * * * /bin/sh /var/www/7tool-current/scripts/process-production-queues.sh /var/www/7tool-shared/.env.production https://7tool.ru notifications >/dev/null 2>&1
*/30 * * * * /bin/sh /var/www/7tool-current/scripts/process-production-queues.sh /var/www/7tool-shared/.env.production https://7tool.ru offline >/dev/null 2>&1
```

Реальные пути сначала сверить на сервере. Endpoint cron защищён `Authorization: Bearer $CRON_SECRET`.

## Офлайн-конверсии

- `qualified_call` — квалифицированный звонок коллтрекинга;
- `lead_qualified` — менеджер перевёл заявку в квалифицированную;
- `lead_won` — выигранная сделка, сумма передаётся в RUB.

Без OAuth endpoint работает в dry-run, а администратор может скачать CSV. Внутренний UUID не подставляется вместо ClientID. `test`, `spam`, `duplicate`, `lost` не выгружаются.

HTTP 200 после POST означает только принятие файла в асинхронную обработку. Строки получают состояние `accepted` и `provider_upload_id`; последующие cron-запуски проверяют официальный status endpoint. Только `PROCESSED` переводит строки в `processed`. `LINKAGE_FAILURE` и загрузка с нулём прошедших валидацию строк фиксируются как `rejected` и не отправляются бесконечно повторно. `source_quantity` и `line_quantity` сохраняются для контроля частично отклонённых файлов.

## Рекламный фид

После успешного `data:check` выполнить:

```bash
npm run ads:feed
npm run ads:check
AD_FEED_REMOTE_LIMIT=200 npm run ads:remote-check
```

Публикуемый файл: `public/feeds/yandex-dynamic.xml`. Отчёты: `.analysis/yandex-advertising-feed.json` и `.analysis/yandex-advertising-feed-remote.json`. Генератор отклоняет пустой результат и резкое удаление более 25% ранее опубликованных offers без явного аварийного разрешения. Remote-check проверяет равномерную выборку URL карточек и изображений; для полной проверки разово задать `AD_FEED_REMOTE_LIMIT=0`.

## Контроль после релиза

```bash
curl -fsSI https://7tool.ru/
curl -fsSI https://7tool.ru/c/stanki-sverlilnye
curl -fsSI https://7tool.ru/lp/stanki-sverlilnye/magnitnye
curl -fsSI https://7tool.ru/feeds/yandex-dynamic.xml
pm2 status
```

Дополнительно проверить HTML на `mc.yandex.ru` и ID `109097461`, тестовую заявку в БД/админке, фактическую доставку email и MAX, сохранение UTM/yclid/ClientID, три связки YML→URL→Ecommerce ID. После ближайшего импорта сравнить ручные SEO, фото категорий и `manual_sort_order` с резервным снимком.
