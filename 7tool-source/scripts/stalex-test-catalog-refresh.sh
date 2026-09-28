#!/usr/bin/env sh
set -eu

APP_DIR=${APP_DIR:-/var/www/7tool-test-current/7tool-source}
SHARED_ENV=${SHARED_ENV:-/var/www/7tool-shared/.env.production}
BASE_CATALOG_PATH=${BASE_CATALOG_PATH:-/var/www/7tool-test-shared/catalog/products.json}
BASE_METADATA_PATH=${BASE_METADATA_PATH:-/var/www/7tool-test-shared/catalog/catalog-snapshot-meta.json}
PILOT_PUBLISH_DIR=${PILOT_PUBLISH_DIR:-/var/www/7tool-test-shared/catalog-stalex-pilot}
PILOT_WORK_DIR=${PILOT_WORK_DIR:-/var/www/7tool-test-shared/catalog-stalex-pilot-work}
REQUESTED_PM2_APP_NAME=${PM2_APP_NAME:-7tool-storefront-test}
STALEX_STATE_PATH=${STALEX_STATE_PATH:-/var/www/7tool-shared/stalex/normalized-snapshot.json}
STALEX_STATUS_PATH=${STALEX_STATUS_PATH:-/var/www/7tool-shared/stalex/refresh-status.json}
STALEX_LOCK_PATH=${STALEX_LOCK_PATH:-/var/lock/7tool-stalex-snapshot.lock}

set -a
. "$SHARED_ENV"
set +a
PM2_APP_NAME=$REQUESTED_PM2_APP_NAME

if [ "$PM2_APP_NAME" != "7tool-storefront-test" ]; then
  echo "Refusing to reload a non-test PM2 process: $PM2_APP_NAME" >&2
  exit 1
fi

for required_file in "$BASE_CATALOG_PATH" "$BASE_METADATA_PATH"; do
  if [ ! -s "$required_file" ]; then
    echo "Required catalog file is missing: $required_file" >&2
    exit 1
  fi
done
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

node scripts/validate-stalex-test-catalog-candidate.mjs \
  --catalog="$candidate_dir/products.json" \
  --metadata="$candidate_dir/catalog-snapshot-meta.json" \
  --report="$candidate_dir/pilot-report.json" \
  --current-report="$PILOT_PUBLISH_DIR/pilot-report.json"

install -m 0644 "$candidate_dir/products.json" "$PILOT_PUBLISH_DIR/products.json.next"
install -m 0644 "$candidate_dir/catalog-snapshot-meta.json" "$PILOT_PUBLISH_DIR/catalog-snapshot-meta.json.next"
install -m 0644 "$candidate_dir/pilot-report.json" "$PILOT_PUBLISH_DIR/pilot-report.json.next"
mv "$PILOT_PUBLISH_DIR/products.json.next" "$PILOT_PUBLISH_DIR/products.json"
mv "$PILOT_PUBLISH_DIR/catalog-snapshot-meta.json.next" "$PILOT_PUBLISH_DIR/catalog-snapshot-meta.json"
mv "$PILOT_PUBLISH_DIR/pilot-report.json.next" "$PILOT_PUBLISH_DIR/pilot-report.json"

# Prices, quantities and freshness are read from the stable snapshot at process
# start. A changed product set fails above and requires a reviewed test build.
pm2 reload "$PM2_APP_NAME"
