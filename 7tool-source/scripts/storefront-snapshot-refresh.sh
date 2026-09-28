#!/usr/bin/env sh
set -eu

APP_DIR=${APP_DIR:-/var/www/7tool-test-current/7tool-source}
SHARED_ENV=${SHARED_ENV:-/var/www/7tool-shared/.env.production}
CATALOG_WORK_DIR=${CATALOG_WORK_DIR:?CATALOG_WORK_DIR is required}
CATALOG_PUBLISH_DIR=${CATALOG_PUBLISH_DIR:?CATALOG_PUBLISH_DIR is required}
REQUESTED_PM2_APP_NAME=${PM2_APP_NAME:-7tool-storefront-test}
STOREFRONT_BUILD_DIR=${STOREFRONT_BUILD_DIR:-}
FEED_REFRESH_STATUS_PATH=${FEED_REFRESH_STATUS_PATH:-$CATALOG_WORK_DIR/refresh-status.json}

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

for required_command in node npm pm2; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "Required command is unavailable: $required_command" >&2
    exit 1
  fi
done
if [ ! -f scripts/test-feed-runtime-guard.mjs ]; then
  echo "Runtime guard is missing: $APP_DIR/scripts/test-feed-runtime-guard.mjs" >&2
  exit 1
fi

current_stage=preflight
record_status() {
  status_value=$1
  exit_code_value=${2:-0}
  message_value=${3:-}
  FEED_REFRESH_STATUS_PATH="$FEED_REFRESH_STATUS_PATH" \
  FEED_REFRESH_STATUS="$status_value" \
  FEED_REFRESH_STAGE="$current_stage" \
  FEED_REFRESH_EXIT_CODE="$exit_code_value" \
  FEED_REFRESH_MESSAGE="$message_value" \
  FEED_REFRESH_CATALOG_PATH="$CATALOG_PUBLISH_DIR/products.json" \
  FEED_REFRESH_METADATA_PATH="$CATALOG_PUBLISH_DIR/catalog-snapshot-meta.json" \
    node scripts/test-feed-runtime-guard.mjs status
}
on_exit() {
  exit_code=$?
  if [ "$exit_code" -ne 0 ]; then
    record_status failed "$exit_code" "Test-feed refresh failed at stage: $current_stage" || true
  fi
  exit "$exit_code"
}
trap on_exit EXIT
trap 'exit 1' HUP INT TERM
record_status running
node scripts/test-feed-runtime-guard.mjs check --app="$APP_DIR" --build="$STOREFRONT_BUILD_DIR"

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

current_stage=backup
npm run db:backup
current_stage=refresh-feed
node scripts/refresh-feed.mts
current_stage=finalize
CATALOG_PUBLISH_DIR="$CATALOG_PUBLISH_DIR" node scripts/finalize-catalog-snapshot.mjs

if [ -n "$STOREFRONT_BUILD_DIR" ]; then
  if [ ! -f "$STOREFRONT_BUILD_DIR/package.json" ]; then
    echo "Storefront build directory is invalid: $STOREFRONT_BUILD_DIR" >&2
    exit 1
  fi
  export CATALOG_FEED_PATH="$CATALOG_PUBLISH_DIR/products.json"
  export CATALOG_SNAPSHOT_META_PATH="$CATALOG_PUBLISH_DIR/catalog-snapshot-meta.json"
  cd "$STOREFRONT_BUILD_DIR"
  current_stage=storefront-build
  npm run build
fi

# Preserve the environment captured by the dedicated test ecosystem config.
# Feed credentials loaded above belong to the refresh worker, not the storefront.
current_stage=reload
pm2 reload "$PM2_APP_NAME"
cd "$APP_DIR"
current_stage=complete
record_status complete
trap - EXIT HUP INT TERM
