#!/usr/bin/env sh
set -eu

APP_DIR=${APP_DIR:-/var/www/7tool-current}
SHARED_ENV=${SHARED_ENV:-/var/www/7tool-shared/.env.production}
PM2_APP_NAME=${PM2_APP_NAME:-7tool-prod}

set -a
. "$SHARED_ENV"
set +a

cd "$APP_DIR"
node scripts/refresh-feed.mts
npm run data:check
npm run ads:feed
cp src/lib/products.json /var/www/7tool-shared/products.json

# Цены и остатки сайт читает из SQLite через /api/live, поэтому они видны сразу.
# Пересборка нужна только когда появились новые публичные URL: добавлен
# товар/вариант либо ранее скрытый товар опубликован из фида.
STATE_PATH=${FEED_STATE_PATH:-${SQLITE_PATH}.feed-state.json}
if [ -f "$STATE_PATH" ] && grep -Eq '"structureChanged"[[:space:]]*:[[:space:]]*true' "$STATE_PATH"; then
  node scripts/generate-product-seo.mjs --if-configured --best-effort --limit "${SEO_AI_HOURLY_LIMIT:-24}"
  node scripts/generate-programmatic-seo.mjs
  cp src/lib/products.json /var/www/7tool-shared/products.json
  # Только новые публичные URL требуют новой статической сборки. Цены и
  # остатки уже обновлены транзакционно в SQLite и видны через /api/live.
  npm run build
  pm2 reload "$PM2_APP_NAME" --update-env
  pm2 save
fi
