#!/usr/bin/env sh
set -eu

APP_DIR=${APP_DIR:-/var/www/7tool-current}
SHARED_ENV=${SHARED_ENV:-/var/www/7tool-shared/.env.production}
PM2_APP_NAME=${PM2_APP_NAME:-7tool-prod}
CATALOG_PUBLISH_DIR=${CATALOG_PUBLISH_DIR:-/var/www/7tool-shared}

set -a
. "$SHARED_ENV"
set +a

STALEX_DATA_DIR=${STALEX_DATA_DIR:-$CATALOG_PUBLISH_DIR/stalex}

cd "$APP_DIR"
npm run db:backup
node scripts/refresh-feed.mts

# Stalex хранится отдельным проверенным снимком и пока не публикуется в
# действующий каталог. Сбой поставщика сохраняет последний корректный снимок
# и не останавливает обновление основного ассортимента.
if [ "${STALEX_DAILY_ENABLED:-1}" = "1" ]; then
  export STALEX_STATE_PATH=${STALEX_STATE_PATH:-$STALEX_DATA_DIR/last-good-snapshot.json}
  export STALEX_STATUS_PATH=${STALEX_STATUS_PATH:-$STALEX_DATA_DIR/refresh-status.json}
  export STALEX_LOCK_PATH=${STALEX_LOCK_PATH:-$STALEX_DATA_DIR/refresh.lock}
  if ! node scripts/refresh-stalex-feed.mjs; then
    echo "WARNING: Stalex feed refresh failed; last-good Stalex snapshot was preserved" >&2
  fi
fi

npm run data:check
npm run ads:feed
node scripts/generate-product-seo.mjs --if-configured --best-effort --limit "${SEO_AI_NIGHTLY_LIMIT:-100}"
node scripts/generate-programmatic-seo.mjs
CATALOG_PUBLISH_DIR="$CATALOG_PUBLISH_DIR" node scripts/finalize-catalog-snapshot.mjs
npm run build
pm2 reload "$PM2_APP_NAME" --update-env
pm2 save
