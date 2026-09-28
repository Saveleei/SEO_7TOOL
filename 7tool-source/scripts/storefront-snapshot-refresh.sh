#!/usr/bin/env sh
set -eu

APP_DIR=${APP_DIR:-/var/www/7tool-test-current/7tool-source}
SHARED_ENV=${SHARED_ENV:-/var/www/7tool-shared/.env.production}
CATALOG_WORK_DIR=${CATALOG_WORK_DIR:?CATALOG_WORK_DIR is required}
CATALOG_PUBLISH_DIR=${CATALOG_PUBLISH_DIR:?CATALOG_PUBLISH_DIR is required}
REQUESTED_PM2_APP_NAME=${PM2_APP_NAME:-7tool-storefront-test}
STOREFRONT_BUILD_DIR=${STOREFRONT_BUILD_DIR:-}

set -a
. "$SHARED_ENV"
set +a
PM2_APP_NAME=$REQUESTED_PM2_APP_NAME

if [ "$PM2_APP_NAME" != "7tool-storefront-test" ]; then
  echo "Refusing to reload a non-test PM2 process: $PM2_APP_NAME" >&2
  exit 1
fi

mkdir -p "$CATALOG_WORK_DIR" "$CATALOG_PUBLISH_DIR" "$CATALOG_WORK_DIR/backups"
cd "$APP_DIR"

if [ ! -s "$CATALOG_WORK_DIR/data.db" ]; then
  echo "Test catalog database is missing: $CATALOG_WORK_DIR/data.db" >&2
  exit 1
fi
if [ ! -s "$CATALOG_WORK_DIR/products.json" ]; then
  cp src/lib/products.json "$CATALOG_WORK_DIR/products.json"
fi
if [ ! -s "$CATALOG_WORK_DIR/catalog-snapshot-meta.json" ]; then
  cp src/lib/catalog-snapshot-meta.json "$CATALOG_WORK_DIR/catalog-snapshot-meta.json"
fi

export SQLITE_PATH="$CATALOG_WORK_DIR/data.db"
export CATALOG_JSON_PATH="$CATALOG_WORK_DIR/products.json"
export CATALOG_META_PATH="$CATALOG_WORK_DIR/catalog-snapshot-meta.json"
export FEED_STATE_PATH="$CATALOG_WORK_DIR/feed-state.json"
export FEED_LOCK_PATH="$CATALOG_WORK_DIR/feed.lock"
export BACKUP_DIR="$CATALOG_WORK_DIR/backups"

npm run db:backup
node scripts/refresh-feed.mts
CATALOG_PUBLISH_DIR="$CATALOG_PUBLISH_DIR" node scripts/finalize-catalog-snapshot.mjs

if [ -n "$STOREFRONT_BUILD_DIR" ]; then
  if [ ! -f "$STOREFRONT_BUILD_DIR/package.json" ]; then
    echo "Storefront build directory is invalid: $STOREFRONT_BUILD_DIR" >&2
    exit 1
  fi
  export CATALOG_FEED_PATH="$CATALOG_PUBLISH_DIR/products.json"
  export CATALOG_SNAPSHOT_META_PATH="$CATALOG_PUBLISH_DIR/catalog-snapshot-meta.json"
  cd "$STOREFRONT_BUILD_DIR"
  npm run build
fi

# Preserve the environment captured by the dedicated test ecosystem config.
# Feed credentials loaded above belong to the refresh worker, not the storefront.
pm2 reload "$PM2_APP_NAME"
