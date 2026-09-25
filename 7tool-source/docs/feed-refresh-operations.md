# Обновление каталога и остатков

## Рабочий контракт

- Полный цикл запускается ежедневно в `03:15 Europe/Moscow` через `scripts/nightly-rebuild.sh`.
- В остальные часы допустим облегчённый запуск `scripts/hourly-refresh.sh`, чтобы остатки не устаревали дольше окна `SHIPPING_FEED_MAX_AGE_MINUTES`.
- Оба запуска защищаются внешним `flock` и внутренним lock-файлом импортера.
- Сетевой сбой, неполный фид, неизвестная категория или ошибка проверки завершают job ненулевым кодом. Последняя опубликованная пара файлов остаётся без изменений.
- Старая локальная XML-копия не используется как свежая автоматически. `FEED_ALLOW_LOCAL_FALLBACK=1` — только ручной аварийный режим с пониманием риска.
- `products.json` публикуется раньше `catalog-snapshot-meta.json`. Метаданные содержат SHA-256 точного каталога; несовпадение скрывает наличие на витрине.
- Для витрины, читающей JSON при старте, задаются `CATALOG_FEED_PATH`, `CATALOG_SNAPSHOT_META_PATH` и `CATALOG_RELOAD_PM2_APP_NAME`, чтобы успешный refresh завершался бесшовным PM2 reload.

## Рекомендуемое расписание

Перед изменением сохранить `crontab -l` и проверить абсолютные пути. Не заменять crontab целиком.

```cron
15 0-2,4-23 * * * flock -n /var/lock/7tool-feed.lock /bin/sh /var/www/7tool-current/scripts/hourly-refresh.sh >> /var/log/7tool-refresh.log 2>&1
15 3 * * * flock -n /var/lock/7tool-feed.lock /bin/sh /var/www/7tool-current/scripts/nightly-rebuild.sh >> /var/log/7tool-rebuild.log 2>&1
```

Shell-скрипты должны попадать на Linux с LF. Это закреплено корневым `.gitattributes`; перед релизом тест `feed-operations.test.mjs` дополнительно запрещает CRLF.

## Контрольная точка после ночного запуска

1. Последняя запись `/var/log/7tool-rebuild.log` завершилась JSON-результатом финализатора, успешной сборкой и PM2 reload.
2. `/var/www/7tool-shared/catalog-snapshot-meta.json` имеет `status: "complete"`, свежий `completedAt` и `catalogSha256`.
3. SHA-256 `/var/www/7tool-shared/products.json` совпадает с `catalogSha256`.
4. PM2-процесс online без цикла рестартов.
5. Витрина показывает «Отгрузка сегодня» только для `available=true`, `quantity>0`, рабочего дня и времени до cutoff.

При любой ошибке не подменять `completedAt` вручную: это создаст ложное обещание наличия. Сначала устранить причину job и выполнить контролируемый повторный запуск.
