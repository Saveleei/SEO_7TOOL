#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

release="/var/www/7tool-release-20261007-new-refinement-7e9f523"
app="$release/design-exploration/staging-pilot"
expected_active="/var/www/7tool-release-20261004-tablet-mobile-daeb930/design-exploration/staging-pilot"
active_link="/var/www/7tool-new-current"
shared="/var/www/7tool-new-shared"
candidate_log="/var/www/new-refinement-candidate-20261007.log"
activation_log="/var/www/new-refinement-activation-20261007.log"
preview_port="3243"
switched="0"

exec 9>/var/lock/7tool-new-deploy.lock
flock -n 9 || { echo "Another preview deployment is already running."; exit 1; }

exec > >(tee -a "$activation_log") 2>&1

active="$(readlink -f "$active_link")"
production_pid_before="$(pm2 pid 7tool-prod)"

wait_for_health() {
  local port="$1"
  for attempt in $(seq 1 180); do
    if curl -fsS "http://127.0.0.1:${port}/" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

start_preview() {
  local target_app="$1"
  cd "$target_app"
  set -a
  . "$shared/new.env"
  set +a
  export PORT="$preview_port"
  export SEO_INDEXING_ENABLED="0"
  export QUOTE_TEST_MODE="1"
  export NEXT_PUBLIC_SITE_URL="https://new.7tool.ru"
  pm2 delete 7tool-storefront-new >/dev/null 2>&1 || true
  pm2 start node_modules/vinext/dist/cli.js --name 7tool-storefront-new --interpreter node -- start --hostname 127.0.0.1
  wait_for_health "$preview_port"
}

rollback() {
  local exit_code=$?
  trap - ERR INT TERM
  if [[ "$switched" == "1" ]]; then
    echo "Activation failed; restoring $active"
    ln -s "$active" "${active_link}.rollback"
    mv -Tf "${active_link}.rollback" "$active_link"
    start_preview "$active"
    pm2 save
  fi
  echo "PREVIEW_ACTIVATION_FAILED exit=$exit_code"
  exit "$exit_code"
}

trap rollback ERR INT TERM

echo "ACTIVATE_UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "PREVIEW_ACTIVE=$active"
echo "PREVIEW_TARGET=$app"
echo "PRODUCTION_ACTIVE=$(readlink -f /var/www/7tool-production-current)"
echo "PRODUCTION_PID_BEFORE=$production_pid_before"

[[ "$active" == "$expected_active" ]] || { echo "Unexpected preview release: $active"; exit 1; }
[[ -d "$app/dist" ]] || { echo "Verified preview build is missing."; exit 1; }
grep -q 'PREVIEW_CANDIDATE_OK port=3267' "$candidate_log"
[[ ! -e "${active_link}.next" && ! -L "${active_link}.next" ]] || { echo "Stale activation link exists."; exit 1; }

backup="$shared/backups/20261007-before-new-refinement-7e9f523"
[[ ! -e "$backup" ]] || { echo "Preview backup path already exists."; exit 1; }
mkdir -p "$backup"
printf '%s\n' "$active" > "$backup/active-release.txt"
pm2 prettylist > "$backup/pm2-prettylist.json"
crontab -l > "$backup/root.crontab"
cp -p "$shared/new.env" "$backup/new.env"

ln -s "$app" "${active_link}.next"
mv -Tf "${active_link}.next" "$active_link"
switched="1"
start_preview "$app"

[[ "$(readlink -f "$active_link")" == "$app" ]]
[[ "$(pm2 pid 7tool-storefront-new)" =~ ^[0-9]+$ ]]

public_home="$(mktemp)"
public_headers="$(mktemp)"
public_robots="$(mktemp)"
public_sitemap="$(mktemp)"
curl -fsS -D "$public_headers" "https://new.7tool.ru/?release=7e9f523" -o "$public_home"
curl -fsS "https://new.7tool.ru/robots.txt" -o "$public_robots"
curl -fsS "https://new.7tool.ru/sitemap.xml" -o "$public_sitemap"

grep -qi '^x-robots-tag: noindex, nofollow, noarchive' "$public_headers"
grep -q '<meta name="robots" content="noindex, nofollow, nocache"' "$public_home"
grep -q '^Disallow: /' "$public_robots"
! grep -q '<url>' "$public_sitemap"
! grep -q 'mc.yandex.ru/metrika' "$public_home"
grep -q 'header-catalog-section' "$public_home"
! grep -q 'header-catalog-manager' "$public_home"
rm -f "$public_home" "$public_headers" "$public_robots" "$public_sitemap"

for route in \
  /catalog \
  /company \
  /contacts \
  /c/koronchatye-sverla \
  /c/stanki-sverlilnye \
  /p/magnitnyy-sverlilnyy-stanok-lenz-steyr-35 \
  /compare; do
  curl -fsS "https://new.7tool.ru${route}" >/dev/null
done

production_pid_after="$(pm2 pid 7tool-prod)"
[[ "$production_pid_before" =~ ^[0-9]+$ ]]
[[ "$production_pid_after" == "$production_pid_before" ]]
curl -fsS https://7tool.ru/ >/dev/null
crontab -l | cmp -s - "$backup/root.crontab"

pm2 save
switched="0"
trap - ERR INT TERM

echo "PREVIEW_ACTIVE=$(readlink -f "$active_link")"
echo "PREVIEW_PID=$(pm2 pid 7tool-storefront-new)"
echo "PRODUCTION_PID=$production_pid_after"
echo "INDEXING=disabled"
df -h /var/www | tail -1
echo "PREVIEW_ACTIVATION_OK"
