# Выкладка 7TOOL на Beget

Документ рассчитан на production без остановки почасового обновления каталога. Конкретные пути, имя PM2-процесса и текущий crontab сначала считываются с сервера — они не были включены в исходный архив.

## 1. Обязательный аудит до изменения сервера

Выполнить по SSH только read-only команды и сохранить вывод:

```bash
pwd
node --version
npm --version
pm2 list
pm2 describe <текущее-имя-процесса>
crontab -l
systemctl list-timers --all
```

Нужно определить:

- текущий каталог приложения и имя процесса PM2;
- абсолютный путь к рабочей SQLite;
- точную команду почасового обновления фида;
- воскресные задачи около 03:30 и 03:35;
- путь и владельца Nginx/Apache upstream;
- версию Node.js и доступное место.

Не заменять crontab целиком и не менять существующие строки по предположению. В частности, сохранить почасовое обновление, ночную сборку и обе воскресные задачи.

Проверить право исполнения служебных скриптов. Если cron вызывает их напрямую, применить `chmod 755 scripts/hourly-refresh.sh scripts/nightly-rebuild.sh`. Альтернатива — сохранить расписание, но вызывать команды через `/bin/sh /абсолютный/путь/script.sh`. До изменения сохранить `crontab -l` в резервный файл.

## 2. Постоянные данные

Рекомендуемая структура (подставить реальный домашний каталог пользователя Beget):

```text
<APP_ROOT>/
  current -> releases/<release-id>
  releases/
  shared/
    .env.production
    data.db
    uploads/
    backups/
```

В `.env.production` задать абсолютные пути:

```dotenv
NEXT_PUBLIC_SITE_URL=https://7tool.ru
SQLITE_PATH=<APP_ROOT>/shared/data.db
UPLOAD_DIR=<APP_ROOT>/shared/uploads
PRIVATE_UPLOAD_DIR=<APP_ROOT>/shared/private-specifications
CLAMAV_ENABLED=1
CLAMAV_COMMAND=clamdscan
BACKUP_DIR=<APP_ROOT>/shared/backups
NEXT_PUBLIC_YANDEX_METRIKA_ID=109097461
LEADS_TO=info@7tool.ru
LEADS_FROM=info@7tool.ru
MAX_BOT_TOKEN=<токен-бота-MAX>
MAX_USER_ID=<id-получателя>
CRON_SECRET=<случайная-строка-не-короче-32-символов>
YANDEX_METRIKA_OAUTH_TOKEN=<необязательно-для-автовыгрузки-офлайн-конверсий>
CALL_TRACKING_WEBHOOK_SECRET=<задать-после-выбора-провайдера>
```

Для группового чата вместо `MAX_USER_ID` задайте `MAX_CHAT_ID`. Также заполнить SMTP, URL фида и ID Яндекс Метрики. Секреты не коммитить.

После добавления токена откройте бота в MAX и нажмите «Начать». Затем получите ID и проверьте доставку:

```bash
cd <APP_ROOT>/current
set -a
. <APP_ROOT>/shared/.env.production
set +a
npm run max:setup
# Добавьте показанный MAX_USER_ID или MAX_CHAT_ID в .env.production, затем:
npm run max:test
```

Токены и `CRON_SECRET` нельзя передавать в переписке или добавлять в репозиторий.

После переключения релиза добавить отдельные строки cron, не заменяя существующий crontab:

```cron
* * * * * /bin/sh <APP_ROOT>/current/scripts/process-production-queues.sh <APP_ROOT>/shared/.env.production https://7tool.ru notifications >/dev/null 2>&1
*/30 * * * * /bin/sh <APP_ROOT>/current/scripts/process-production-queues.sh <APP_ROOT>/shared/.env.production https://7tool.ru offline >/dev/null 2>&1
```

Скрипт каждую минуту обрабатывает очередь email/MAX, а раз в 30 минут — офлайн-конверсии при наличии OAuth-токена. Обе очереди используют lease/идемпотентность и не запускают второй экземпляр поверх активной отправки.

## 3. Бэкап перед релизом

Из активного приложения:

```bash
cd <APP_ROOT>/current
set -a
. <APP_ROOT>/shared/.env.production
set +a
npm run db:backup
```

Отдельно сохранить загруженные изображения штатным серверным backup/rsync-инструментом. Проверить, что новая `.db` открывается:

```bash
sqlite3 <APP_ROOT>/shared/backups/<файл>.db "PRAGMA integrity_check;"
```

Ожидаемый ответ: `ok`.

## 4. Сборка нового релиза

1. Распаковать код в новый `<APP_ROOT>/releases/<release-id>`.
2. Скопировать актуальный `src/lib/products.json` из `current` в новый релиз, чтобы не потерять изменения фида и админки.
3. Подключить `.env.production`, `data.db` и `uploads` через переменные окружения, не копиями.
4. Выполнить:

```bash
cd <APP_ROOT>/releases/<release-id>
npm ci
npm run lint
npm test
npm run build
npm run ads:feed
npm run ads:check
AD_FEED_REMOTE_LIMIT=200 npm run ads:remote-check
```

На первом запуске, когда общей базы ещё нет, выполнить `npm run db:import`. На существующей production-базе повторный импорт перед каждым релизом не нужен: приложение само накатывает совместимые миграции, а импорт способен перезаписать оперативные данные snapshot-значениями.

## 5. Атомарное переключение

Сначала проверить новый релиз на свободном локальном порту:

```bash
PORT=3108 npm start
curl -I http://127.0.0.1:3108/
curl -I http://127.0.0.1:3108/c/koronchatye-sverla
curl -I http://127.0.0.1:3108/admin
```

После успешного smoke-теста атомарно переключить `current` на новый каталог и перезапустить **существующее** имя процесса:

```bash
ln -sfn <APP_ROOT>/releases/<release-id> <APP_ROOT>/current
cd <APP_ROOT>/current
pm2 reload <текущее-имя-процесса> --update-env
pm2 save
```

Если процесса ещё нет, использовать `pm2 start ecosystem.config.cjs`, затем `pm2 save`. Не создавать второй процесс поверх уже работающего.

## 6. Проверка после переключения

```bash
pm2 status
pm2 logs <текущее-имя-процесса> --lines 100 --nostream
curl -I https://7tool.ru/
curl -I https://7tool.ru/robots.txt
curl -I https://7tool.ru/sitemap.xml
curl -I https://7tool.ru/uploads/<контрольный-файл>
curl -I https://7tool.ru/feeds/yandex-dynamic.xml
crontab -l
```

Ручной smoke-чек:

- главная, меню и девять категорий;
- подкатегория и товар;
- цена/наличие без `0 ₽`;
- корзина и избранное;
- заявка из корзины, «Купить в 1 клик» и форма подбора;
- появление лида в `/admin/leads` и SMTP;
- загрузка изображения в админке после перезапуска;
- мобильное меню и формы на ширине 360 px.

После ближайшего почасового запуска проверить время изменения JSON/SQLite и логи команды фида. После воскресенья отдельно подтвердить обе задачи 03:30/03:35.

## 7. Откат

Переключить `current` на предыдущий каталог и перезагрузить то же имя PM2:

```bash
ln -sfn <APP_ROOT>/releases/<previous-release-id> <APP_ROOT>/current
cd <APP_ROOT>/current
pm2 reload <текущее-имя-процесса> --update-env
```

SQLite откатывать только при подтверждённой порче данных: сначала остановить приложение и cron фида, сохранить текущую базу отдельным файлом, восстановить проверенную копию в `SQLITE_PATH`, затем запустить контур обратно. Обычный откат кода не требует отката базы.
