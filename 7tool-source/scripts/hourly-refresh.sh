#!/usr/bin/env sh
set -eu

APP_DIR=${APP_DIR:-/var/www/7tool-current}
SHARED_ENV=${SHARED_ENV:-/var/www/7tool-shared/.env.production}
PM2_APP_NAME=${PM2_APP_NAME:-7tool-prod}
CATALOG_PUBLISH_DIR=${CATALOG_PUBLISH_DIR:-/var/www/7tool-shared}
CATALOG_RELOAD_PM2_APP_NAME=${CATALOG_RELOAD_PM2_APP_NAME:-}

set -a
. "$SHARED_ENV"
set +a

cd "$APP_DIR"
node scripts/refresh-feed.mts
npm run data:check
npm run ads:feed

# Цены и остатки сайт читает из SQLite через /api/live, поэтому они видны сразу.
# Пересборка нужна только когда появились новые публичные URL: добавлен
# товар/вариант либо ранее скрытый товар опубликован из фида.
STATE_PATH=${FEED_STATE_PATH:-${SQLITE_PATH}.feed-state.json}
if [ -f "$STATE_PATH" ] && grep -Eq '"structureChanged"[[:space:]]*:[[:space:]]*true' "$STATE_PATH"; then
  node scripts/generate-product-seo.mjs --if-configured --best-effort --limit "${SEO_AI_HOURLY_LIMIT:-24}"
  node scripts/generate-programmatic-seo.mjs
fi

# SEO-генераторы могут переформатировать products.json. Финализатор заново
# связывает точный файл с SHA-256 и только затем атомарно публикует пару
# products.json + catalog-snapshot-meta.json в постоянное хранилище.
CATALOG_PUBLISH_DIR="$CATALOG_PUBLISH_DIR" node scripts/finalize-catalog-snapshot.mjs

if [ -f "$STATE_PATH" ] && grep -Eq '"structureChanged"[[:space:]]*:[[:space:]]*true' "$STATE_PATH"; then
  # Только новые публичные URL требуют новой статической сборки. Цены и
  # остатки уже обновлены транзакционно в SQLite и видны через /api/live.
  npm run build
  pm2 reload "$PM2_APP_NAME" --update-env
  pm2 save
fi

# Витрина, которая загружает JSON-снимок при старте, должна перечитать его
# после каждого успешного обновления. Для legacy-приложения переменная пуста.
if [ -n "$CATALOG_RELOAD_PM2_APP_NAME" ]; then
  pm2 reload "$CATALOG_RELOAD_PM2_APP_NAME" --update-env
fi
