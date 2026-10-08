#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

source_sha="d51aba53d890374426c0f43e94c0242d7307863a"
source_short="d51aba5"
release="/var/www/7tool-release-20261008-quote-actions-${source_short}"
app="$release/design-exploration/staging-pilot"
active_link="/var/www/7tool-new-current"
shared="/var/www/7tool-new-shared"
archive="/root/7tool-quote-actions-${source_short}.tar.gz"
candidate_name="7tool-quote-actions-candidate"
candidate_port="3273"
log="/var/www/quote-actions-candidate-20261008.log"

exec 9>/var/lock/7tool-new-deploy.lock
flock -n 9 || { echo "Another preview deployment is already running."; exit 1; }

exec > >(tee -a "$log") 2>&1

cleanup() {
  pm2 delete "$candidate_name" >/dev/null 2>&1 || true
  rm -f "$archive"
}

trap cleanup EXIT INT TERM
trap 'echo "QUOTE_ACTIONS_PREPARE_FAILED line=$LINENO"' ERR

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

if [[ -e "$release" ]]; then
  [[ -f "$release/.release-sha" ]] || { echo "Existing target has no release marker: $release"; exit 1; }
  [[ "$(cat "$release/.release-sha")" == "$source_sha" ]] || { echo "Existing target source mismatch: $release"; exit 1; }
  [[ -d "$app" ]] || { echo "Existing target application is incomplete: $app"; exit 1; }
  echo "REUSING_VERIFIED_TARGET=$release"
else
  curl -fsSL "https://github.com/Saveleei/SEO_7TOOL/archive/${source_sha}.tar.gz" -o "$archive"
  mkdir -p "$release"
  tar -xzf "$archive" -C "$release" --strip-components=1
  printf '%s\n' "$source_sha" > "$release/.release-sha"
  rm -f "$archive"
fi

old_lock_sha="$(sha256sum "$active_app/pnpm-lock.yaml" | awk '{print $1}')"
new_lock_sha="$(sha256sum "$app/pnpm-lock.yaml" | awk '{print $1}')"
[[ "$old_lock_sha" == "$new_lock_sha" ]] || { echo "Dependency lock changed."; exit 1; }
if [[ ! -e "$app/node_modules" ]]; then
  ln -s "$active_app/node_modules" "$app/node_modules"
fi
[[ -d "$app/node_modules" ]] || { echo "Candidate node_modules is unavailable."; exit 1; }

grep -q 'server validation requires only phone among contact fields' "$app/tests/quote-request-backend.test.mjs"
grep -q 'feed-quote-primary' "$app/app/ui/FeedProductPurchase.tsx"
grep -q 'обязательный только телефон' "$app/app/ui/QuickOrderDialog.tsx"
grep -q 'request-add-confirmation' "$app/app/ui/RequestCart.tsx"
grep -q 'CatalogViewSwitch' "$app/app/ui/CatalogViewSwitch.tsx"

set -a
. "$shared/new.env"
set +a
export PORT="$candidate_port"
export SEO_INDEXING_ENABLED="0"
export QUOTE_TEST_MODE="1"
export NEXT_PUBLIC_SITE_URL="https://new.7tool.ru"

cd "$app"
node scripts/build-catalog-presentation.mjs
node scripts/build-legacy-subcategories.mjs
node --test \
  tests/category-contact-flow.test.mjs \
  tests/category-conversion-layout.test.mjs \
  tests/grainger-catalog-refinement.test.mjs \
  tests/product-page-archetypes.test.mjs \
  tests/quick-order-conversion.test.mjs \
  tests/quote-intake-delivery.test.mjs \
  tests/quote-request-backend.test.mjs \
  tests/request-quote.test.mjs \
  tests/variant-presentation.test.mjs
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
curl -fsS "http://127.0.0.1:${candidate_port}/c/koronchatye-sverla?view=grid" -o "$category"
curl -fsS "http://127.0.0.1:${candidate_port}/p/sverla-koronchatye-lzhs" -o "$product"

grep -qi '^x-robots-tag: noindex, nofollow, noarchive' "$headers"
grep -q '<meta name="robots" content="noindex, nofollow, nocache"' "$homepage"
grep -q '^Disallow: /' "$robots"
! grep -q '<url>' "$sitemap"
! grep -q 'mc.yandex.ru/metrika' "$homepage"
grep -q 'Выбрать типоразмер' "$category"
grep -q 'Получить КП' "$product"
grep -q 'Быстрый запрос' "$product"
rm -f "$homepage" "$headers" "$robots" "$sitemap" "$category" "$product"

for route in /catalog /company /contacts /c/stanki-sverlilnye /compare; do
  curl -fsS "http://127.0.0.1:${candidate_port}${route}" >/dev/null
done

admin_status="$(curl --retry 4 --retry-delay 1 --retry-connrefused --max-time 60 -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${candidate_port}/admin/catalog")"
[[ "$admin_status" =~ ^30[2378]$ ]]

echo "CANDIDATE_RELEASE=$release"
echo "CANDIDATE_SOURCE=$source_sha"
echo "INDEXING=disabled"
echo "ADMIN_STATUS=$admin_status"
df -h /var/www | tail -1
echo "QUOTE_ACTIONS_CANDIDATE_OK port=$candidate_port"
