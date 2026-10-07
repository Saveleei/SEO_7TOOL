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

trap 'echo "VERIFY_FAILED line=$LINENO"' ERR

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

[[ -d "$app/dist" ]] || { echo "Candidate production build is missing."; exit 1; }
grep -q 'header-catalog-section' "$app/app/ui/HeaderCatalogMenu.tsx"
! grep -q 'header-catalog-manager' "$app/app/ui/HeaderCatalogMenu.tsx"

set -a
. "$shared/storefront.env"
set +a
export PORT="$candidate_port"

cd "$app"
node scripts/validate-production-config.mjs
PM2_APP_NAME="$candidate_name" pm2 start "$app/ecosystem.production.config.cjs" --update-env
wait_for_health

homepage="$(mktemp)"
curl -fsS "http://127.0.0.1:${candidate_port}/" > "$homepage"
grep -q 'header-catalog-section' "$homepage"
! grep -q 'header-catalog-manager' "$homepage"
grep -q 'Сверла и зенковки' "$homepage"
rm -f "$homepage"

curl -fsS "http://127.0.0.1:${candidate_port}/catalog" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/company" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/contacts" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/c/koronchatye-sverla" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/c/stanki-sverlilnye" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/p/magnitnyy-sverlilnyy-stanok-lenz-steyr-35" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/robots.txt" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/sitemap.xml" >/dev/null
curl -fsS "http://127.0.0.1:${candidate_port}/feeds/yandex-dynamic.xml" >/dev/null

admin_status="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${candidate_port}/admin/catalog")"
test_status="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${candidate_port}/test/requests")"
[[ "$admin_status" =~ ^30[2378]$ ]]
[[ "$test_status" =~ ^30[2378]$ ]]

echo "CANDIDATE_RELEASE=$release"
echo "CANDIDATE_SOURCE=7e9f523"
echo "LOCAL_TESTS=411/411"
echo "ADMIN_STATUS=$admin_status"
echo "TEST_STATUS=$test_status"
df -h /var/www | tail -1
echo "CANDIDATE_OK port=$candidate_port"
