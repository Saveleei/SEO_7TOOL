#!/usr/bin/env sh
set -eu

APP_DIR=${APP_DIR:-/var/www/7tool-test-current/7tool-source}
STOREFRONT_BUILD_DIR=${STOREFRONT_BUILD_DIR:-/var/www/7tool-test-current/design-exploration/staging-pilot}
SHARED_ENV=${SHARED_ENV:-/var/www/7tool-shared/.env.production}
BASE_CATALOG_PATH=${BASE_CATALOG_PATH:-/var/www/7tool-test-shared/catalog/products.json}
BASE_METADATA_PATH=${BASE_METADATA_PATH:-/var/www/7tool-test-shared/catalog/catalog-snapshot-meta.json}
PILOT_PUBLISH_DIR=${PILOT_PUBLISH_DIR:-/var/www/7tool-test-shared/catalog-stalex-pilot}
PILOT_WORK_DIR=${PILOT_WORK_DIR:-/var/www/7tool-test-shared/catalog-stalex-pilot-work}
PM2_APP_NAME=${PM2_APP_NAME:-7tool-storefront-test}
STALEX_STATE_PATH=${STALEX_STATE_PATH:-/var/www/7tool-shared/stalex/normalized-snapshot.json}
STALEX_STATUS_PATH=${STALEX_STATUS_PATH:-/var/www/7tool-shared/stalex/refresh-status.json}
STALEX_LOCK_PATH=${STALEX_LOCK_PATH:-/var/lock/7tool-stalex-snapshot.lock}

set -a
. "$SHARED_ENV"
set +a

for required_file in "$BASE_CATALOG_PATH" "$BASE_METADATA_PATH"; do
  if [ ! -s "$required_file" ]; then
    echo "Required catalog file is missing: $required_file" >&2
    exit 1
  fi
done
if [ ! -f "$STOREFRONT_BUILD_DIR/package.json" ]; then
  echo "Storefront build directory is invalid: $STOREFRONT_BUILD_DIR" >&2
  exit 1
fi

mkdir -p "$PILOT_PUBLISH_DIR" "$PILOT_WORK_DIR" "$(dirname "$STALEX_STATE_PATH")"
candidate_dir=$(mktemp -d "$PILOT_WORK_DIR/candidate.XXXXXX")
cleanup() {
  rm -rf "$candidate_dir"
}
trap cleanup EXIT HUP INT TERM

cd "$APP_DIR"
export STALEX_STATE_PATH STALEX_STATUS_PATH STALEX_LOCK_PATH
if ! node scripts/refresh-stalex-feed.mjs; then
  echo "WARNING: Stalex refresh failed; attempting the preserved last-good snapshot" >&2
fi
if [ ! -s "$STALEX_STATE_PATH" ]; then
  echo "Validated Stalex snapshot is unavailable: $STALEX_STATE_PATH" >&2
  exit 1
fi

node scripts/build-stalex-test-catalog.mjs \
  --base="$BASE_CATALOG_PATH" \
  --base-meta="$BASE_METADATA_PATH" \
  --stalex="$STALEX_STATE_PATH" \
  --output="$candidate_dir/products.json" \
  --meta-output="$candidate_dir/catalog-snapshot-meta.json" \
  --report="$candidate_dir/pilot-report.json"

export CATALOG_FEED_PATH="$candidate_dir/products.json"
export CATALOG_SNAPSHOT_META_PATH="$candidate_dir/catalog-snapshot-meta.json"
cd "$STOREFRONT_BUILD_DIR"
npm run build

install -m 0644 "$candidate_dir/products.json" "$PILOT_PUBLISH_DIR/products.json.next"
install -m 0644 "$candidate_dir/catalog-snapshot-meta.json" "$PILOT_PUBLISH_DIR/catalog-snapshot-meta.json.next"
install -m 0644 "$candidate_dir/pilot-report.json" "$PILOT_PUBLISH_DIR/pilot-report.json.next"
mv "$PILOT_PUBLISH_DIR/products.json.next" "$PILOT_PUBLISH_DIR/products.json"
mv "$PILOT_PUBLISH_DIR/catalog-snapshot-meta.json.next" "$PILOT_PUBLISH_DIR/catalog-snapshot-meta.json"
mv "$PILOT_PUBLISH_DIR/pilot-report.json.next" "$PILOT_PUBLISH_DIR/pilot-report.json"

# The test process is configured once with the stable PILOT_PUBLISH_DIR paths.
# A normal reload preserves those environment values and never touches production.
pm2 reload "$PM2_APP_NAME"
