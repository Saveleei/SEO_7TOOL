#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

release_sha="3cf5b98"
expected_archive_sha="8ed390bf5b5b570868149471d53594f84f5838ccdd7be68a6d3cac739c71c6f7"
archive="/var/www/${release_sha}.tar.gz"
release="/var/www/7tool-release-20261007-mobile-home-${release_sha}-r2"
shared="/var/www/7tool-production-shared"
active_link="/var/www/7tool-production-current"
candidate_port="3265"
log="/var/www/mobile-home-deploy-20261007.log"

exec 9>/var/lock/7tool-production-deploy.lock
flock -n 9 || { echo "Another production deployment is already running."; exit 1; }

exec > >(tee -a "$log") 2>&1

active="$(readlink -f "$active_link")"
expected_active="/var/www/7tool-release-20261007-category-conversion-e740edc"
active_app="$active/design-exploration/staging-pilot"
new_app="$release/design-exploration/staging-pilot"
backup="$shared/backups/20261007-before-mobile-home-${release_sha}-r2"
candidate_pid=""
switched="0"

cleanup_candidate() {
  if [[ -n "$candidate_pid" ]] && kill -0 "$candidate_pid" 2>/dev/null; then
    kill "$candidate_pid" 2>/dev/null || true
    wait "$candidate_pid" 2>/dev/null || true
  fi
}

rollback() {
  local exit_code=$?
  trap - ERR INT TERM
  cleanup_candidate
  if [[ "$switched" == "1" ]]; then
    echo "Deployment failed after cutover; restoring $active"
    ln -s "$active" "${active_link}.rollback"
    mv -Tf "${active_link}.rollback" "$active_link"
    cd "$active_app"
    set -a
    . "$shared/storefront.env"
    set +a
    PM2_APP_NAME=7tool-prod pm2 startOrReload "$active_app/ecosystem.production.config.cjs" --update-env
    pm2 save
  fi
  echo "DEPLOYMENT_FAILED exit=$exit_code"
  exit "$exit_code"
}

trap rollback ERR INT TERM
trap cleanup_candidate EXIT

echo "DEPLOY_UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "ACTIVE=$active"
echo "TARGET=$release"

[[ "$active" == "$expected_active" ]] || { echo "Unexpected active release: $active"; exit 1; }
[[ ! -e "$release" ]] || { echo "Target release already exists: $release"; exit 1; }
[[ -f "$archive" ]] || { echo "Archive is missing: $archive"; exit 1; }

actual_archive_sha="$(sha256sum "$archive" | awk '{print $1}')"
[[ "$actual_archive_sha" == "$expected_archive_sha" ]] || {
  echo "Archive checksum mismatch: $actual_archive_sha"
  exit 1
}

mkdir -p "$backup"
printf '%s\n' "$active" > "$backup/active-release.txt"
pm2 prettylist > "$backup/pm2-prettylist.json"
crontab -l > "$backup/root.crontab"
cp -p "$shared/storefront.env" "$backup/storefront.env"
tar -czf "$backup/quote-data.tar.gz" -C "$shared" quote-data
sha256sum "$backup/quote-data.tar.gz" > "$backup/quote-data.tar.gz.sha256"
echo "BACKUP=$backup"

mkdir -p "$release"
tar -xzf "$archive" -C "$release" --strip-components=1
printf '%s\n' "$release_sha" > "$release/.release-sha"

cp -p "$active/7tool-source/src/lib/products.json" "$release/7tool-source/src/lib/products.json"
cp -p "$active/7tool-source/src/lib/catalog-snapshot-meta.json" "$release/7tool-source/src/lib/catalog-snapshot-meta.json"

old_lock_sha="$(sha256sum "$active_app/pnpm-lock.yaml" | awk '{print $1}')"
new_lock_sha="$(sha256sum "$new_app/pnpm-lock.yaml" | awk '{print $1}')"
[[ "$old_lock_sha" == "$new_lock_sha" ]] || { echo "Dependency lock changed."; exit 1; }
ln -s "$active_app/node_modules" "$new_app/node_modules"

set -a
. "$shared/storefront.env"
set +a

cd "$new_app"
node scripts/validate-production-config.mjs
node --test tests/home-mobile-navigation.test.mjs tests/homepage-launch-pass.test.mjs tests/baymard-responsive-ux.test.mjs
npm run build

PORT="$candidate_port" nohup sh scripts/start-production.sh > "$release/candidate.log" 2>&1 &
candidate_pid=$!
for attempt in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${candidate_port}/" >/dev/null; then
    break
  fi
  kill -0 "$candidate_pid"
  sleep 1
done

curl -fsS "http://127.0.0.1:${candidate_port}/" | grep -q 'hero-mobile-trust-points'
curl -fsS "http://127.0.0.1:${candidate_port}/catalog" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/c/koronchatye-sverla" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/c/stanki-sverlilnye" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/p/magnitnyy-sverlilnyy-stanok-lenz-steyr-35" >/dev/null
admin_status="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${candidate_port}/admin/catalog")"
[[ "$admin_status" == "307" || "$admin_status" == "302" || "$admin_status" == "303" || "$admin_status" == "308" ]]
echo "CANDIDATE_OK port=$candidate_port"

cleanup_candidate
candidate_pid=""

ln -s "$release" "${active_link}.next"
mv -Tf "${active_link}.next" "$active_link"
switched="1"

cd "$new_app"
PM2_APP_NAME=7tool-prod pm2 startOrReload "$new_app/ecosystem.production.config.cjs" --update-env

for attempt in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:3260/ >/dev/null; then
    break
  fi
  sleep 1
done

[[ "$(readlink -f "$active_link")" == "$release" ]]
[[ "$(pm2 pid 7tool-prod)" =~ ^[0-9]+$ ]]
actual_cwd="$(pm2 jlist | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{const p=JSON.parse(s).find(x=>x.name==="7tool-prod");process.stdout.write(p?.pm2_env?.pm_cwd||"")})')"
[[ "$actual_cwd" == "$new_app" ]]
curl -fsS http://127.0.0.1:3260/ | grep -q 'hero-mobile-trust-points'
curl -fsS https://7tool.ru/ | grep -q 'hero-mobile-trust-points'
curl -fsS https://7tool.ru/catalog >/dev/null
curl -fsS https://7tool.ru/c/koronchatye-sverla >/dev/null
curl -fsS https://7tool.ru/c/stanki-sverlilnye >/dev/null
curl -fsS https://7tool.ru/p/magnitnyy-sverlilnyy-stanok-lenz-steyr-35 >/dev/null
curl -fsS https://7tool.ru/robots.txt >/dev/null
curl -fsS https://7tool.ru/sitemap.xml >/dev/null
curl -fsS https://7tool.ru/feeds/yandex-dynamic.xml >/dev/null
public_admin_status="$(curl -sS -o /dev/null -w '%{http_code}' https://7tool.ru/admin/catalog)"
[[ "$public_admin_status" == "307" || "$public_admin_status" == "302" || "$public_admin_status" == "303" || "$public_admin_status" == "308" ]]
crontab -l | cmp -s - "$backup/root.crontab"

pm2 save
switched="0"
trap - ERR INT TERM

echo "ACTIVE=$(readlink -f "$active_link")"
echo "PM2_PID=$(pm2 pid 7tool-prod)"
echo "PM2_CWD=$actual_cwd"
echo "ADMIN_STATUS=$public_admin_status"
df -h /var/www | tail -1
echo "DEPLOYMENT_OK"
