#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

release="/var/www/7tool-release-20261007-catalog-menu-7e9f523"
expected_active="/var/www/7tool-release-20261007-mobile-home-3cf5b98-r2"
active_link="/var/www/7tool-production-current"
shared="/var/www/7tool-production-shared"
new_app="$release/design-exploration/staging-pilot"
backup="$shared/backups/20261007-before-catalog-menu-7e9f523"
candidate_log="/var/www/catalog-menu-candidate-20261007.log"
log="/var/www/catalog-menu-activation-20261007.log"
production_port="3260"
switched="0"

exec 9>/var/lock/7tool-production-deploy.lock
flock -n 9 || { echo "Another production deployment is already running."; exit 1; }

exec > >(tee -a "$log") 2>&1

active="$(readlink -f "$active_link")"
active_app="$active/design-exploration/staging-pilot"

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

rollback() {
  local exit_code=$?
  trap - ERR INT TERM
  if [[ "$switched" == "1" ]]; then
    echo "Activation failed; restoring $active"
    ln -s "$active" "${active_link}.rollback"
    mv -Tf "${active_link}.rollback" "$active_link"
    pm2 delete 7tool-prod >/dev/null 2>&1 || true
    cd "$active_app"
    set -a
    . "$shared/storefront.env"
    set +a
    export PORT="$production_port"
    PM2_APP_NAME=7tool-prod pm2 start "$active_app/ecosystem.production.config.cjs" --update-env
    wait_for_health "$production_port"
    pm2 save
  fi
  echo "ACTIVATION_FAILED exit=$exit_code"
  exit "$exit_code"
}

trap rollback ERR INT TERM

echo "ACTIVATE_UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "ACTIVE=$active"
echo "TARGET=$release"

[[ "$active" == "$expected_active" ]] || { echo "Unexpected active release: $active"; exit 1; }
[[ -d "$new_app/dist" ]] || { echo "Verified build is missing: $new_app/dist"; exit 1; }
grep -q 'CANDIDATE_OK port=3265' "$candidate_log"
[[ ! -e "$backup" ]] || { echo "Backup path already exists: $backup"; exit 1; }
[[ ! -e "${active_link}.next" && ! -L "${active_link}.next" ]] || { echo "Stale activation link exists."; exit 1; }

mkdir -p "$backup"
printf '%s\n' "$active" > "$backup/active-release.txt"
pm2 prettylist > "$backup/pm2-prettylist.json"
crontab -l > "$backup/root.crontab"
cp -p "$shared/storefront.env" "$backup/storefront.env"
tar -czf "$backup/quote-data.tar.gz" -C "$shared" quote-data
sha256sum "$backup/quote-data.tar.gz" > "$backup/quote-data.tar.gz.sha256"
echo "BACKUP=$backup"

set -a
. "$shared/storefront.env"
set +a
export PORT="$production_port"

cd "$new_app"
node scripts/validate-production-config.mjs

ln -s "$release" "${active_link}.next"
mv -Tf "${active_link}.next" "$active_link"
switched="1"

pm2 delete 7tool-prod
PM2_APP_NAME=7tool-prod pm2 start "$new_app/ecosystem.production.config.cjs" --update-env
wait_for_health "$production_port"

[[ "$(readlink -f "$active_link")" == "$release" ]]
[[ "$(pm2 pid 7tool-prod)" =~ ^[0-9]+$ ]]
actual_cwd="$(pm2 jlist | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{const p=JSON.parse(s).find(x=>x.name==="7tool-prod");process.stdout.write(p?.pm2_env?.pm_cwd||"")})')"
[[ "$actual_cwd" == "$new_app" ]]

local_home="$(mktemp)"
public_home="$(mktemp)"
curl -fsS "http://127.0.0.1:${production_port}/" > "$local_home"
curl -fsS "https://7tool.ru/?release=7e9f523" > "$public_home"
grep -q 'header-catalog-section' "$local_home"
grep -q 'header-catalog-section' "$public_home"
! grep -q 'header-catalog-manager' "$local_home"
! grep -q 'header-catalog-manager' "$public_home"
grep -q 'Свёрла и зенковки' "$local_home"
grep -q 'Свёрла и зенковки' "$public_home"
rm -f "$local_home" "$public_home"

curl -fsS https://7tool.ru/catalog >/dev/null
curl -fsS https://7tool.ru/c/koronchatye-sverla >/dev/null
curl -fsS https://7tool.ru/c/stanki-sverlilnye >/dev/null
curl -fsS https://7tool.ru/p/magnitnyy-sverlilnyy-stanok-lenz-steyr-35 >/dev/null
curl -fsS https://7tool.ru/robots.txt >/dev/null
curl -fsS https://7tool.ru/sitemap.xml >/dev/null
curl -fsS https://7tool.ru/feeds/yandex-dynamic.xml >/dev/null

public_admin_status="$(curl -sS -o /dev/null -w '%{http_code}' https://7tool.ru/admin/catalog)"
[[ "$public_admin_status" =~ ^30[2378]$ ]]
crontab -l | cmp -s - "$backup/root.crontab"

pm2 save
switched="0"
trap - ERR INT TERM

echo "ACTIVE=$(readlink -f "$active_link")"
echo "PM2_PID=$(pm2 pid 7tool-prod)"
echo "PM2_CWD=$actual_cwd"
echo "ADMIN_STATUS=$public_admin_status"
df -h /var/www | tail -1
echo "ACTIVATION_OK"
