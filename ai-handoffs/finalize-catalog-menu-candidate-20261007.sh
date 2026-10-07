#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

release="/var/www/7tool-release-20261007-catalog-menu-7e9f523"
shared="/var/www/7tool-production-shared"
app="$release/design-exploration/staging-pilot"
candidate_name="7tool-catalog-menu-candidate"
candidate_port="3265"
log="/var/www/catalog-menu-candidate-20261007.log"

exec 9>/var/lock/7tool-production-deploy.lock
flock -n 9 || { echo "Another production deployment is already running."; exit 1; }

exec > >(tee -a "$log") 2>&1

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

[[ -d "$app" ]] || { echo "Candidate application directory is missing."; exit 1; }
[[ -L "$app/node_modules" ]] || { echo "Candidate node_modules link is missing."; exit 1; }
grep -q 'header-catalog-section' "$app/app/ui/HeaderCatalogMenu.tsx"
! grep -q 'header-catalog-manager' "$app/app/ui/HeaderCatalogMenu.tsx"

cd "$app"
npm run lint

set -a
. "$shared/storefront.env"
set +a
export PORT="$candidate_port"

node scripts/validate-production-config.mjs
node scripts/build-catalog-presentation.mjs
node scripts/build-legacy-subcategories.mjs
node node_modules/vinext/dist/cli.js build

PM2_APP_NAME="$candidate_name" pm2 start "$app/ecosystem.production.config.cjs" --update-env
wait_for_health

SMOKE_BASE_URL="http://127.0.0.1:${candidate_port}" node scripts/smoke-release-candidate.mjs

homepage="$(mktemp)"
curl -fsS "http://127.0.0.1:${candidate_port}/" > "$homepage"
grep -q 'header-catalog-section' "$homepage"
! grep -q 'header-catalog-manager' "$homepage"
grep -q 'Сверла и зенковки' "$homepage"
rm -f "$homepage"

curl -fsS "http://127.0.0.1:${candidate_port}/catalog" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/c/koronchatye-sverla" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/c/stanki-sverlilnye" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/p/magnitnyy-sverlilnyy-stanok-lenz-steyr-35" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/robots.txt" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/sitemap.xml" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/feeds/yandex-dynamic.xml" >/dev/null

echo "CANDIDATE_RELEASE=$release"
echo "CANDIDATE_SOURCE=7e9f523"
echo "LOCAL_TESTS=411/411"
df -h /var/www | tail -1
echo "CANDIDATE_OK port=$candidate_port"
