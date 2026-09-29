#!/usr/bin/env sh
set -eu

APP_DIR=${APP_DIR:-/var/www/7tool-production-feed-runtime-current/7tool-source}
PRODUCTION_SHARED_ROOT=${PRODUCTION_SHARED_ROOT:-/var/www/7tool-production-shared}
SHARED_ENV=${SHARED_ENV:-$PRODUCTION_SHARED_ROOT/.env.feed-production}
REQUESTED_MODE=${PRODUCTION_FEED_MODE:-dry-run}
REQUESTED_OFFLINE_INPUTS=${PRODUCTION_FEED_OFFLINE_INPUTS:-0}
REQUESTED_PM2_APP_NAME=${PM2_APP_NAME:-7tool-prod}

if [ -f "$SHARED_ENV" ]; then
  set -a
  . "$SHARED_ENV"
  set +a
elif [ "$REQUESTED_OFFLINE_INPUTS" != "1" ]; then
  echo "Production feed environment is missing: $SHARED_ENV" >&2
  exit 1
fi

PRODUCTION_FEED_MODE=$REQUESTED_MODE
PRODUCTION_FEED_OFFLINE_INPUTS=$REQUESTED_OFFLINE_INPUTS
PM2_APP_NAME=$REQUESTED_PM2_APP_NAME
PRODUCTION_FEED_WORK_DIR=${PRODUCTION_FEED_WORK_DIR:-$PRODUCTION_SHARED_ROOT/feed-work}
PRODUCTION_CATALOG_RELEASES_DIR=${PRODUCTION_CATALOG_RELEASES_DIR:-$PRODUCTION_SHARED_ROOT/catalog-releases}
PRODUCTION_CATALOG_CURRENT_LINK=${PRODUCTION_CATALOG_CURRENT_LINK:-$PRODUCTION_SHARED_ROOT/catalog-current}
PRODUCTION_FEED_STATUS_PATH=${PRODUCTION_FEED_STATUS_PATH:-$PRODUCTION_SHARED_ROOT/refresh-status.json}
PRODUCTION_FEED_LOCK_PATH=${PRODUCTION_FEED_LOCK_PATH:-$PRODUCTION_SHARED_ROOT/refresh.lock}
STALEX_REVIEWED_REPORT_PATH=${STALEX_REVIEWED_REPORT_PATH:-$PRODUCTION_SHARED_ROOT/stalex/reviewed-report.json}
BASE_WORK_DIR=${BASE_WORK_DIR:-$PRODUCTION_FEED_WORK_DIR/base}
BASE_CATALOG_PATH=${BASE_CATALOG_PATH:-$BASE_WORK_DIR/products.json}
BASE_METADATA_PATH=${BASE_METADATA_PATH:-$BASE_WORK_DIR/catalog-snapshot-meta.json}
BASE_DATABASE_PATH=${BASE_DATABASE_PATH:-$BASE_WORK_DIR/data.db}
STALEX_STATE_PATH=${STALEX_STATE_PATH:-$PRODUCTION_SHARED_ROOT/stalex/normalized-snapshot.json}
STALEX_STATUS_PATH=${STALEX_STATUS_PATH:-$PRODUCTION_SHARED_ROOT/stalex/refresh-status.json}
STALEX_LOCK_PATH=${STALEX_LOCK_PATH:-$PRODUCTION_SHARED_ROOT/stalex/refresh.lock}
BACKUP_DIR=${BACKUP_DIR:-$PRODUCTION_SHARED_ROOT/backups}
PRODUCTION_STOREFRONT_HEALTH_URL=${PRODUCTION_STOREFRONT_HEALTH_URL:-}

case "$PRODUCTION_FEED_MODE" in
  dry-run|publish) ;;
  *) echo "PRODUCTION_FEED_MODE must be dry-run or publish" >&2; exit 1 ;;
esac
if [ "$PRODUCTION_FEED_OFFLINE_INPUTS" != "0" ] && [ "$PRODUCTION_FEED_OFFLINE_INPUTS" != "1" ]; then
  echo "PRODUCTION_FEED_OFFLINE_INPUTS must be 0 or 1" >&2
  exit 1
fi
if [ "$PRODUCTION_FEED_MODE" = "publish" ] && [ "$PM2_APP_NAME" != "7tool-prod" ]; then
  echo "Refusing to reload an unexpected production PM2 process: $PM2_APP_NAME" >&2
  exit 1
fi

for required_command in node npm flock; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "Required command is unavailable: $required_command" >&2
    exit 1
  fi
done
if [ "$PRODUCTION_FEED_MODE" = "publish" ]; then
  for required_command in pm2 curl; do
    if ! command -v "$required_command" >/dev/null 2>&1; then
      echo "Required command is unavailable: $required_command" >&2
      exit 1
    fi
  done
  if [ -z "$PRODUCTION_STOREFRONT_HEALTH_URL" ]; then
    echo "PRODUCTION_STOREFRONT_HEALTH_URL is required in publish mode" >&2
    exit 1
  fi
  case "$PRODUCTION_STOREFRONT_HEALTH_URL" in
    http://127.0.0.1:*|http://localhost:*) ;;
    *) echo "PRODUCTION_STOREFRONT_HEALTH_URL must use loopback HTTP" >&2; exit 1 ;;
  esac
fi

cd "$APP_DIR"
node scripts/production-feed-runtime.mjs check \
  --app="$APP_DIR" \
  --shared-root="$PRODUCTION_SHARED_ROOT" \
  --work="$PRODUCTION_FEED_WORK_DIR" \
  --releases="$PRODUCTION_CATALOG_RELEASES_DIR" \
  --current="$PRODUCTION_CATALOG_CURRENT_LINK" \
  --reviewed-report="$STALEX_REVIEWED_REPORT_PATH" \
  --status="$PRODUCTION_FEED_STATUS_PATH" \
  --lock="$PRODUCTION_FEED_LOCK_PATH" \
  --base-catalog="$BASE_CATALOG_PATH" \
  --base-metadata="$BASE_METADATA_PATH" \
  --base-database="$BASE_DATABASE_PATH" \
  --stalex-state="$STALEX_STATE_PATH" \
  --stalex-status="$STALEX_STATUS_PATH" \
  --stalex-lock="$STALEX_LOCK_PATH" \
  --backup-dir="$BACKUP_DIR"

mkdir -p "$PRODUCTION_FEED_WORK_DIR" "$PRODUCTION_CATALOG_RELEASES_DIR" "$(dirname "$PRODUCTION_FEED_STATUS_PATH")"
exec 9>"$PRODUCTION_FEED_LOCK_PATH"
if ! flock -n 9; then
  echo "Production feed refresh is already running: $PRODUCTION_FEED_LOCK_PATH" >&2
  exit 1
fi

current_stage=preflight
catalog_sha=
catalog_completed_at=
generation_dir=
record_status() {
  status_value=$1
  exit_code_value=${2:-0}
  message_value=${3:-}
  PRODUCTION_FEED_STATUS_PATH="$PRODUCTION_FEED_STATUS_PATH" \
  PRODUCTION_FEED_STATUS="$status_value" \
  PRODUCTION_FEED_STAGE="$current_stage" \
  PRODUCTION_FEED_MODE="$PRODUCTION_FEED_MODE" \
  PRODUCTION_FEED_EXIT_CODE="$exit_code_value" \
  PRODUCTION_FEED_MESSAGE="$message_value" \
  PRODUCTION_FEED_CATALOG_SHA="$catalog_sha" \
  PRODUCTION_FEED_CATALOG_COMPLETED_AT="$catalog_completed_at" \
  PRODUCTION_FEED_GENERATION_DIR="$generation_dir" \
    node scripts/production-feed-runtime.mjs status
}

candidate_dir=$(mktemp -d "$PRODUCTION_FEED_WORK_DIR/candidate.XXXXXX")
cleanup_candidate() {
  rm -rf "$candidate_dir"
}
on_exit() {
  exit_code=$?
  if [ "$exit_code" -ne 0 ]; then
    record_status failed "$exit_code" "Production feed failed at stage: $current_stage" || true
  fi
  cleanup_candidate
  exit "$exit_code"
}
trap on_exit EXIT
trap 'exit 1' HUP INT TERM
record_status running

mkdir -p "$BASE_WORK_DIR" "$(dirname "$STALEX_STATE_PATH")" "$BACKUP_DIR"

if [ "$PRODUCTION_FEED_OFFLINE_INPUTS" = "1" ]; then
  current_stage=offline-inputs
  for required_file in "$BASE_CATALOG_PATH" "$BASE_METADATA_PATH" "$STALEX_STATE_PATH"; do
    if [ ! -s "$required_file" ]; then
      echo "Offline production feed input is missing: $required_file" >&2
      exit 1
    fi
  done
else
  current_stage=base-preflight
  if [ ! -s "$BASE_DATABASE_PATH" ]; then
    echo "Production feed database is missing: $BASE_DATABASE_PATH" >&2
    exit 1
  fi
  if [ ! -s "$BASE_CATALOG_PATH" ]; then
    cp src/lib/products.json "$BASE_CATALOG_PATH"
  fi
  if [ ! -s "$BASE_METADATA_PATH" ]; then
    cp src/lib/catalog-snapshot-meta.json "$BASE_METADATA_PATH"
  fi

  export SQLITE_PATH="$BASE_DATABASE_PATH"
  export CATALOG_JSON_PATH="$BASE_CATALOG_PATH"
  export CATALOG_META_PATH="$BASE_METADATA_PATH"
  export FEED_STATE_PATH=${FEED_STATE_PATH:-$BASE_WORK_DIR/feed-state.json}
  export FEED_LOCK_PATH=${FEED_LOCK_PATH:-$BASE_WORK_DIR/feed.lock}
  export BACKUP_DIR
  export STALEX_STATE_PATH STALEX_STATUS_PATH STALEX_LOCK_PATH

  current_stage=backup
  npm run db:backup
  current_stage=base-refresh
  node scripts/refresh-feed.mts
  current_stage=stalex-refresh
  if ! node scripts/refresh-stalex-feed.mjs; then
    echo "WARNING: Stalex refresh failed; validating the production-owned last-good snapshot" >&2
  fi
  if [ ! -s "$STALEX_STATE_PATH" ]; then
    echo "Production-owned Stalex snapshot is unavailable: $STALEX_STATE_PATH" >&2
    exit 1
  fi
fi

current_stage=build-candidate
node scripts/build-stalex-production-catalog.mjs \
  --base="$BASE_CATALOG_PATH" \
  --base-meta="$BASE_METADATA_PATH" \
  --stalex="$STALEX_STATE_PATH" \
  --output="$candidate_dir/products.json" \
  --meta-output="$candidate_dir/catalog-snapshot-meta.json" \
  --report="$candidate_dir/stalex-report.json"

current_stage=validate-candidate
node scripts/validate-stalex-production-catalog-candidate.mjs \
  --catalog="$candidate_dir/products.json" \
  --metadata="$candidate_dir/catalog-snapshot-meta.json" \
  --report="$candidate_dir/stalex-report.json" \
  --reviewed-report="$STALEX_REVIEWED_REPORT_PATH"

verification=$(node scripts/production-feed-runtime.mjs verify \
  --catalog="$candidate_dir/products.json" \
  --metadata="$candidate_dir/catalog-snapshot-meta.json" \
  --report="$candidate_dir/stalex-report.json" \
  --reviewed-report="$STALEX_REVIEWED_REPORT_PATH" \
  --max-age-minutes="${SHIPPING_FEED_MAX_AGE_MINUTES:-1560}")
catalog_sha=$(printf '%s' "$verification" | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(s).catalogSha256))')
catalog_completed_at=$(printf '%s' "$verification" | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(s).completedAt))')

if [ "$PRODUCTION_FEED_MODE" = "dry-run" ]; then
  current_stage=validated
  record_status validated
  trap - EXIT HUP INT TERM
  cleanup_candidate
  exit 0
fi

current_stage=publish
publication=$(node scripts/production-feed-runtime.mjs publish \
  --shared-root="$PRODUCTION_SHARED_ROOT" \
  --releases="$PRODUCTION_CATALOG_RELEASES_DIR" \
  --current="$PRODUCTION_CATALOG_CURRENT_LINK" \
  --catalog="$candidate_dir/products.json" \
  --metadata="$candidate_dir/catalog-snapshot-meta.json" \
  --report="$candidate_dir/stalex-report.json" \
  --reviewed-report="$STALEX_REVIEWED_REPORT_PATH" \
  --max-age-minutes="${SHIPPING_FEED_MAX_AGE_MINUTES:-1560}")
generation_dir=$(printf '%s' "$publication" | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(s).generationDir))')
previous_target=$(printf '%s' "$publication" | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(s).previousTarget||""))')

current_stage=reload
if ! pm2 reload "$PM2_APP_NAME"; then
  if [ -n "$previous_target" ]; then
    node scripts/production-feed-runtime.mjs rollback \
      --shared-root="$PRODUCTION_SHARED_ROOT" \
      --releases="$PRODUCTION_CATALOG_RELEASES_DIR" \
      --current="$PRODUCTION_CATALOG_CURRENT_LINK" \
      --target="$previous_target" || true
  fi
  echo "Production storefront reload failed; catalog pointer was rolled back when possible" >&2
  exit 1
fi

health_ok=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if curl -fsS -o /dev/null "$PRODUCTION_STOREFRONT_HEALTH_URL"; then
    health_ok=1
    break
  fi
  sleep 5
done
if [ "$health_ok" != "1" ]; then
  if [ -n "$previous_target" ]; then
    node scripts/production-feed-runtime.mjs rollback \
      --shared-root="$PRODUCTION_SHARED_ROOT" \
      --releases="$PRODUCTION_CATALOG_RELEASES_DIR" \
      --current="$PRODUCTION_CATALOG_CURRENT_LINK" \
      --target="$previous_target" || true
    pm2 reload "$PM2_APP_NAME" || true
  fi
  echo "Production storefront health check failed; catalog pointer was rolled back when possible" >&2
  exit 1
fi

current_stage=complete
record_status complete
trap - EXIT HUP INT TERM
cleanup_candidate
