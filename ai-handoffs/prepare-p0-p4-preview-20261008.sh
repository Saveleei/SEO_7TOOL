#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

source_sha="bfc30d4"
release="/var/www/7tool-release-20261008-p0-p4-${source_sha}"
app="$release/design-exploration/staging-pilot"
active_link="/var/www/7tool-new-current"
shared="/var/www/7tool-new-shared"
archive="/root/7tool-p0-p4-${source_sha}.tar.gz"
candidate_name="7tool-p0-p4-candidate"
candidate_port="3269"
log="/var/www/p0-p4-candidate-20261008.log"

exec 9>/var/lock/7tool-new-deploy.lock
flock -n 9 || { echo "Another preview deployment is already running."; exit 1; }

exec > >(tee -a "$log") 2>&1

cleanup() {
  pm2 delete "$candidate_name" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM
trap 'echo "P0_P4_PREPARE_FAILED line=$LINENO"' ERR

wait_for_health() {
  for attempt in $(seq 1 180); do
    if curl -fsS "http://127.0.0.1:${candidate_port}/" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

active="$(readlink -f "$active_link")"
active_app="$active"

echo "PREPARE_UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "PREVIEW_ACTIVE=$active"
echo "PRODUCTION_ACTIVE=$(readlink -f /var/www/7tool-production-current)"
echo "TARGET=$release"

[[ -d "$active_app/node_modules" ]] || { echo "Preview node_modules is missing."; exit 1; }
[[ -f "$shared/new.env" ]] || { echo "Preview environment is missing."; exit 1; }
[[ ! -e "$release" ]] || { echo "Target release already exists: $release"; exit 1; }

curl -fsSL "https://github.com/Saveleei/SEO_7TOOL/archive/${source_sha}.tar.gz" -o "$archive"
mkdir -p "$release"
tar -xzf "$archive" -C "$release" --strip-components=1
printf '%s\n' "$source_sha" > "$release/.release-sha"

old_lock_sha="$(sha256sum "$active_app/pnpm-lock.yaml" | awk '{print $1}')"
new_lock_sha="$(sha256sum "$app/pnpm-lock.yaml" | awk '{print $1}')"
[[ "$old_lock_sha" == "$new_lock_sha" ]] || { echo "Dependency lock changed."; exit 1; }
ln -s "$active_app/node_modules" "$app/node_modules"

grep -q 'quickPromotedFacets' "$app/app/catalog/category/[slug]/page.tsx"
grep -q 'feed-conversion-heading' "$app/app/product/[slug]/page.tsx"
grep -q 'data-variant-count' "$app/app/ui/FeedProductCard.tsx"

cd "$app"
node --test tests/homepage-launch-pass.test.mjs tests/catalog-menu-manager-conversion.test.mjs tests/readability-contract.test.mjs tests/visual-content-pass.test.mjs

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
category="$(mktemp)"
product="$(mktemp)"
curl -fsS -D "$headers" "http://127.0.0.1:${candidate_port}/" -o "$homepage"
curl -fsS "http://127.0.0.1:${candidate_port}/robots.txt" -o "$robots"
curl -fsS "http://127.0.0.1:${candidate_port}/sitemap.xml" -o "$sitemap"
curl -fsS "http://127.0.0.1:${candidate_port}/c/koronchatye-sverla" -o "$category"
curl -fsS "http://127.0.0.1:${candidate_port}/p/sverla-koronchatye-lzhs" -o "$product"

grep -qi '^x-robots-tag: noindex, nofollow, noarchive' "$headers"
grep -q '<meta name="robots" content="noindex, nofollow, nocache"' "$homepage"
grep -q '^Disallow: /' "$robots"
! grep -q '<url>' "$sitemap"
! grep -q 'mc.yandex.ru/metrika' "$homepage"
grep -q 'Запросить КП по ТЗ или списку позиций' "$homepage"
grep -q 'feed-mobile-filter-actions' "$category"
grep -q 'feed-conversion-heading' "$product"
rm -f "$homepage" "$headers" "$robots" "$sitemap" "$category" "$product"

for route in /catalog /company /contacts /c/stanki-sverlilnye /compare; do
  curl -fsS "http://127.0.0.1:${candidate_port}${route}" >/dev/null
done

admin_status="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${candidate_port}/admin/catalog")"
[[ "$admin_status" =~ ^30[2378]$ ]]

echo "CANDIDATE_RELEASE=$release"
echo "CANDIDATE_SOURCE=$source_sha"
echo "INDEXING=disabled"
echo "ADMIN_STATUS=$admin_status"
df -h /var/www | tail -1
echo "P0_P4_CANDIDATE_OK port=$candidate_port"
