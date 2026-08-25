# 7TOOL

Production-витрина промышленного инструмента и оборудования на Next.js 15, React 19 и SQLite.

## Быстрый старт

Требуется Node.js 20+ и npm.

```bash
cp .env.example .env.local
npm ci
npm run db:import
npm run dev
```

Откройте `http://localhost:3000`. Админка находится по адресу `/admin`.

## Данные

- `src/lib/products.json` — build-time snapshot каталога и SEO-страниц.
- `data.db` или `SQLITE_PATH` — оперативная SQLite-база: каталог, варианты, лиды, пользователи и настройки.
- `UPLOAD_DIR` — постоянное хранилище загруженных изображений. На production оно должно находиться вне каталога релиза.
- `scripts/refresh-feed.mts` — полная безопасная синхронизация дилерского фида с JSON и SQLite: обновляет цены и наличие, публикует активные позиции, добавляет новые товары/варианты и отклоняет неполный фид.
- `scripts/migrate-seo.mjs` — отдельный dry-run-first runner versioned SEO migrations; применение требует явный проверенный backup.
- `scripts/import-json-to-sqlite.mjs` — идемпотентный первичный импорт и миграция.
- `scripts/backup-data.mjs` — консистентная копия SQLite с ротацией.

## Проверка

```bash
npm run lint
npm test
npm run build
```

Актуализировать каталог вручную можно командой `npm run feed:sync`. На production она запускается по расписанию: оперативные цены и наличие сразу читаются сайтом из SQLite, а новые карточки попадают в статические страницы после плановой пересборки.

Закрытый URL фида задаётся только через `FEED_URL` в runtime environment. Optional Supplier Feed Intelligence provenance включается через `FEED_PROVENANCE_ENABLED=1` только после применения проверенной migration; подробности — [docs/supplier-feed-intelligence.md](./docs/supplier-feed-intelligence.md).

Проверяются целостность девяти категорий, уникальность URL, отсутствие нулевых цен, коммерческая сортировка, защита форм и production-сборка.

## Avito Autoload

В проект добавлен отдельный безопасный конвейер подготовки Avito XML. По умолчанию он работает только в `dry-run`, не подключается к аккаунту Avito и не заменяет публичный фид.

```bash
npm run avito:fixture
```

Команда создаёт тестовый XML, JSON-отчёт и HTML-предпросмотр в `fixtures/avito/generated`. Для рабочего фида скопируйте `config/avito.example.json` в игнорируемый `config/avito.local.json` и подтвердите значения категорий по шаблону из кабинета Avito. На production конвейер повторно использует существующий закрытый `FEED_URL/FEED_FILE` K2Tool; `AVITO_FEED_*` нужен только для отдельного источника.

Подробный регламент, ограничения и критерии запуска: [docs/avito-autoload.md](./docs/avito-autoload.md).

## Production

Переменные перечислены в `.env.example`, PM2-конфигурация — в `ecosystem.config.cjs`. Полный безопасный регламент выкладки, резервного копирования, проверки cron и отката: [DEPLOYMENT_BEGET.md](./DEPLOYMENT_BEGET.md).

Перед публикацией владелец должен подтвердить юридическое наименование оператора, реквизиты, сроки хранения данных и финальные редакции страниц политики/согласия.
