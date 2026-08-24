#!/usr/bin/env sh
set -eu

ENV_FILE="${1:-}"
SITE_URL="${2:-https://7tool.ru}"
MODE="${3:-notifications}"

if [ -z "$ENV_FILE" ] || [ ! -f "$ENV_FILE" ]; then
  echo "Usage: $0 /absolute/path/.env.production [https://7tool.ru]" >&2
  exit 2
fi

set -a
. "$ENV_FILE"
set +a

if [ -z "${CRON_SECRET:-}" ]; then
  echo "CRON_SECRET is not configured" >&2
  exit 3
fi

if [ "$MODE" = "notifications" ] || [ "$MODE" = "all" ]; then
  curl --fail --silent --show-error --max-time 45 \
    --request POST \
    --header "Authorization: Bearer $CRON_SECRET" \
    "$SITE_URL/api/cron/notifications"
fi

if { [ "$MODE" = "offline" ] || [ "$MODE" = "all" ]; } && [ -n "${YANDEX_METRIKA_OAUTH_TOKEN:-}" ]; then
  curl --fail --silent --show-error --max-time 90 \
    --request POST \
    --header "Authorization: Bearer $CRON_SECRET" \
    "$SITE_URL/api/cron/offline-conversions"
fi
