#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

release="/var/www/7tool-release-20261007-new-refinement-7e9f523"
app="$release/design-exploration/staging-pilot"
shared="/var/www/7tool-new-shared"
candidate_name="7tool-new-refinement-candidate"
candidate_port="3267"
log="/var/www/new-refinement-candidate-20261007.log"

exec 9>/var/lock/7tool-new-deploy.lock
flock -n 9 || { echo "Another preview deployment is already running."; exit 1; }

exec > >(tee -a "$log") 2>&1

cleanup() {
  pm2 delete "$candidate_name" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM
trap 'echo "PREVIEW_PREPARE_FAILED line=$LINENO"' ERR

wait_for_health() {
  for attempt in $(seq 1 180); do
    if curl -fsS "http://127.0.0.1:${candidate_port}/" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

production_release="$(readlink -f /var/www/7tool-production-current)"
production_app="$production_release/design-exploration/staging-pilot"

echo "PREPARE_UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "PRODUCTION_ACTIVE=$production_release"
echo "PREVIEW_ACTIVE=$(readlink -f /var/www/7tool-new-current)"
echo "TARGET=$release"

[[ -d "$production_app/node_modules" ]] || { echo "Production node_modules is missing."; exit 1; }
[[ -f "$shared/new.env" ]] || { echo "Preview environment is missing."; exit 1; }

if [[ ! -e "$release" ]]; then
  mkdir -p "$release"
  rsync -a --exclude node_modules --exclude dist "$production_release/" "$release/"
  ln -s "$production_app/node_modules" "$app/node_modules"
else
  [[ ! -L "$app/node_modules" ]] || [[ "$(readlink -f "$app/node_modules")" == "$production_app/node_modules" ]]
  echo "REUSING_CANDIDATE=$release"
fi

grep -q 'header-catalog-section' "$app/app/ui/HeaderCatalogMenu.tsx"
! grep -q 'header-catalog-manager' "$app/app/ui/HeaderCatalogMenu.tsx"

cd "$app"
set -a
. "$shared/new.env"
set +a
export PORT="$candidate_port"
export SEO_INDEXING_ENABLED="0"
export QUOTE_TEST_MODE="1"
export NEXT_PUBLIC_SITE_URL="https://new.7tool.ru"

node scripts/build-catalog-presentation.mjs
node scripts/build-legacy-subcategories.mjs
node node_modules/vinext/dist/cli.js build

pm2 delete "$candidate_name" >/dev/null 2>&1 || true
pm2 start node_modules/vinext/dist/cli.js --name "$candidate_name" --interpreter node -- start --hostname 127.0.0.1
wait_for_health

homepage="$(mktemp)"
headers="$(mktemp)"
robots="$(mktemp)"
sitemap="$(mktemp)"
curl -fsS -D "$headers" "http://127.0.0.1:${candidate_port}/" -o "$homepage"
curl -fsS "http://127.0.0.1:${candidate_port}/robots.txt" -o "$robots"
curl -fsS "http://127.0.0.1:${candidate_port}/sitemap.xml" -o "$sitemap"

grep -qi '^x-robots-tag: noindex, nofollow, noarchive' "$headers"
grep -q '<meta name="robots" content="noindex, nofollow, nocache"' "$homepage"
grep -q '^Disallow: /' "$robots"
! grep -q '<url>' "$sitemap"
! grep -q 'mc.yandex.ru/metrika' "$homepage"
grep -q 'header-catalog-section' "$homepage"
! grep -q 'header-catalog-manager' "$homepage"
grep -q 'Свёрла и зенковки' "$homepage"
rm -f "$homepage" "$headers" "$robots" "$sitemap"

for route in \
  /catalog \
  /company \
  /contacts \
  /c/koronchatye-sverla \
  /c/stanki-sverlilnye \
  /p/magnitnyy-sverlilnyy-stanok-lenz-steyr-35 \
  /compare; do
  curl -fsS "http://127.0.0.1:${candidate_port}${route}" >/dev/null
done

admin_status="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${candidate_port}/admin/catalog")"
[[ "$admin_status" =~ ^30[2378]$ ]]

echo "CANDIDATE_RELEASE=$release"
echo "CANDIDATE_SOURCE=7e9f523"
echo "INDEXING=disabled"
echo "ADMIN_STATUS=$admin_status"
df -h /var/www | tail -1
echo "PREVIEW_CANDIDATE_OK port=$candidate_port"
