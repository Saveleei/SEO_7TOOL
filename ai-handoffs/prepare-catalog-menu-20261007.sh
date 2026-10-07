#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

release="/var/www/7tool-release-20261007-catalog-menu-7e9f523"
active_link="/var/www/7tool-production-current"
shared="/var/www/7tool-production-shared"
source_checkout="/root/7tool-catalog-menu-src-7e9f523"
candidate_name="7tool-catalog-menu-candidate"
candidate_port="3265"
log="/var/www/catalog-menu-candidate-20261007.log"

exec 9>/var/lock/7tool-production-deploy.lock
flock -n 9 || { echo "Another production deployment is already running."; exit 1; }

exec > >(tee -a "$log") 2>&1

active="$(readlink -f "$active_link")"
active_app="$active/design-exploration/staging-pilot"
new_app="$release/design-exploration/staging-pilot"

cleanup() {
  pm2 delete "$candidate_name" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

wait_for_health() {
  for attempt in $(seq 1 180); do
    if curl -fsS "http://127.0.0.1:${candidate_port}/" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

echo "PREPARE_UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "ACTIVE=$active"
echo "TARGET=$release"

[[ -d "$active_app" ]] || { echo "Active application directory is missing."; exit 1; }
[[ -f "$source_checkout/design-exploration/staging-pilot/app/ui/HeaderCatalogMenu.tsx" ]] || {
  echo "Deployment source checkout is missing."
  exit 1
}
[[ ! -e "$release" ]] || { echo "Target release already exists: $release"; exit 1; }

mkdir -p "$release"
rsync -a --exclude node_modules --exclude dist "$active/" "$release/"
ln -s "$active_app/node_modules" "$new_app/node_modules"

files=(
  "design-exploration/staging-pilot/app/globals.css"
  "design-exploration/staging-pilot/app/ui/HeaderCatalogMenu.tsx"
  "design-exploration/staging-pilot/app/ui/PilotHeader.tsx"
  "design-exploration/staging-pilot/tests/catalog-media-readability.test.mjs"
  "design-exploration/staging-pilot/tests/catalog-menu-manager-conversion.test.mjs"
  "design-exploration/staging-pilot/tests/category-conversion-layout.test.mjs"
  "design-exploration/staging-pilot/tests/storefront-acceptance.test.mjs"
)

for file in "${files[@]}"; do
  install -D -m 0644 "$source_checkout/$file" "$release/$file"
done

grep -q 'header-catalog-section' "$new_app/app/ui/HeaderCatalogMenu.tsx"
! grep -q 'header-catalog-manager' "$new_app/app/ui/HeaderCatalogMenu.tsx"

set -a
. "$shared/storefront.env"
set +a
export PORT="$candidate_port"

cd "$new_app"
node scripts/validate-production-config.mjs
npm test
npm run lint
node scripts/build-catalog-presentation.mjs
node scripts/build-legacy-subcategories.mjs
node node_modules/vinext/dist/cli.js build

PM2_APP_NAME="$candidate_name" pm2 start "$new_app/ecosystem.production.config.cjs" --update-env
wait_for_health

SMOKE_BASE_URL="http://127.0.0.1:${candidate_port}" node scripts/smoke-release-candidate.mjs

curl -fsS "http://127.0.0.1:${candidate_port}/" | grep -q 'header-catalog-section'
! curl -fsS "http://127.0.0.1:${candidate_port}/" | grep -q 'header-catalog-manager'
curl -fsS "http://127.0.0.1:${candidate_port}/" | grep -q 'Сверла и зенковки'
curl -fsS "http://127.0.0.1:${candidate_port}/catalog" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/c/koronchatye-sverla" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/c/stanki-sverlilnye" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/p/magnitnyy-sverlilnyy-stanok-lenz-steyr-35" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/robots.txt" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/sitemap.xml" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/feeds/yandex-dynamic.xml" >/dev/null

echo "CANDIDATE_RELEASE=$release"
echo "CANDIDATE_SOURCE=7e9f523"
df -h /var/www | tail -1
echo "CANDIDATE_OK port=$candidate_port"
