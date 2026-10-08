#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

source_sha="e80faf18efd144c434f8ff470d6979e15579c497"
source_short="e80faf1"
release="/var/www/7tool-release-20261009-home-ux-${source_short}"
app="$release/design-exploration/staging-pilot"
active_link="/var/www/7tool-new-current"
shared="/var/www/7tool-new-shared"
delta_archive="/root/home-ux-delta-${source_short}.tar"
candidate_name="7tool-home-ux-candidate"
candidate_port="3275"
preview_port="3243"
cron_entry="/etc/cron.d/codex-home-ux-preview-20261009"
log="/var/www/home-ux-preview-deploy-20261009.log"
status_file="/var/www/home-ux-preview-deploy-20261009.status"
switched="0"
active=""

# The cron file is only a one-time launcher. Remove it before any long work.
rm -f "$cron_entry"

exec 9>/var/lock/7tool-new-deploy.lock
flock -n 9 || { printf '%s\n' "BUSY" > "$status_file"; exit 1; }

exec > >(tee -a "$log") 2>&1

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

cleanup() {
  pm2 delete "$candidate_name" >/dev/null 2>&1 || true
  rm -f "$delta_archive"
}

rollback() {
  local exit_code=$?
  trap - ERR INT TERM
  cleanup
  if [[ "$switched" == "1" && -n "$active" && -d "$active" ]]; then
    echo "Activation failed; restoring $active"
    ln -s "$active" "${active_link}.rollback"
    mv -Tf "${active_link}.rollback" "$active_link"
    start_preview "$active" || true
    pm2 save || true
  fi
  printf 'FAILED exit=%s utc=%s\n' "$exit_code" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$status_file"
  echo "HOME_UX_PREVIEW_FAILED exit=$exit_code"
  exit "$exit_code"
}

trap rollback ERR INT TERM

active="$(readlink -f "$active_link")"
production_active="$(readlink -f /var/www/7tool-production-current)"
production_pid_before="$(pm2 pid 7tool-prod)"

echo "START_UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "PREVIEW_ACTIVE=$active"
echo "PRODUCTION_ACTIVE=$production_active"
echo "PRODUCTION_PID_BEFORE=$production_pid_before"
echo "TARGET=$release"
df -h /var/www | tail -1

[[ -d "$active/node_modules" ]] || { echo "Preview node_modules is missing."; exit 1; }
[[ -f "$shared/new.env" ]] || { echo "Preview environment is missing."; exit 1; }
[[ "$production_pid_before" =~ ^[0-9]+$ ]] || { echo "Production process is not healthy."; exit 1; }
[[ "$active" == "/var/www/7tool-release-20261008-home-visual-cta-99c0240/design-exploration/staging-pilot" ]] || { echo "Unexpected preview base: $active"; exit 1; }
[[ -f "$delta_archive" ]] || { echo "Delta archive is missing: $delta_archive"; exit 1; }

if [[ -e "$release" ]]; then
  [[ "$(readlink -f "$active_link")" != "$app" ]] || { echo "Refusing to replace the active preview."; exit 1; }
  [[ "$(readlink -f /var/www/7tool-production-current)" != "$app" ]] || { echo "Refusing to replace production."; exit 1; }
  rm -rf -- "$release"
fi

base_release="$(realpath "$active/../..")"
cp -al "$base_release" "$release"
rm -rf -- "$app/dist" "$app/.next" "$app/.wrangler"
for generated in \
  app/data/generatedCatalogFacets.json \
  app/data/generatedCatalogPresentation.json \
  app/data/generatedCatalogQuality.json \
  app/data/generatedLegacySubcategories.json; do
  cp --remove-destination "$active/$generated" "$app/$generated"
done
while IFS= read -r delta_path; do
  [[ "$delta_path" != /* && "$delta_path" != ".." && "$delta_path" != *"../"* ]] || { echo "Unsafe delta path: $delta_path"; exit 1; }
  [[ "$delta_path" == */ ]] || rm -f -- "$release/$delta_path"
done < <(tar -tf "$delta_archive")
tar -xf "$delta_archive" -C "$release"
rm -f "$release/.release-sha"
printf '%s\n' "$source_sha" > "$release/.release-sha"

[[ -d "$app" ]] || { echo "Candidate application is incomplete."; exit 1; }
old_lock_sha="$(sha256sum "$active/pnpm-lock.yaml" | awk '{print $1}')"
new_lock_sha="$(sha256sum "$app/pnpm-lock.yaml" | awk '{print $1}')"
[[ "$old_lock_sha" == "$new_lock_sha" ]] || { echo "Dependency lock changed."; exit 1; }
if [[ ! -e "$app/node_modules" ]]; then
  ln -s "$active/node_modules" "$app/node_modules"
fi
[[ -d "$app/node_modules" ]] || { echo "Candidate node_modules is unavailable."; exit 1; }

grep -q 'hero-catalog-card' "$app/app/globals.css"
grep -q 'Получить КП' "$app/app/ui/FeedProductPurchase.tsx"
! grep -q '>В запрос<' "$app/app/ui/FeedProductPurchase.tsx"
grep -q 'padding-bottom:calc(148px' "$app/app/globals.css"

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
  tests/homepage-launch-pass.test.mjs \
  tests/home-mobile-navigation.test.mjs \
  tests/category-conversion-layout.test.mjs \
  tests/baymard-responsive-ux.test.mjs \
  tests/quick-order-conversion.test.mjs \
  tests/product-page-archetypes.test.mjs \
  tests/dynamic-comparison.test.mjs \
  tests/card-request-selection.test.mjs \
  tests/storefront-acceptance.test.mjs
node node_modules/vinext/dist/cli.js build

pm2 delete "$candidate_name" >/dev/null 2>&1 || true
pm2 start node_modules/vinext/dist/cli.js --name "$candidate_name" --interpreter node -- start --hostname 127.0.0.1
wait_for_health "$candidate_port"

candidate_home="$(mktemp)"
candidate_headers="$(mktemp)"
candidate_robots="$(mktemp)"
candidate_sitemap="$(mktemp)"
candidate_category="$(mktemp)"
candidate_product="$(mktemp)"
curl -fsS -D "$candidate_headers" "http://127.0.0.1:${candidate_port}/" -o "$candidate_home"
curl -fsS "http://127.0.0.1:${candidate_port}/robots.txt" -o "$candidate_robots"
curl -fsS "http://127.0.0.1:${candidate_port}/sitemap.xml" -o "$candidate_sitemap"
curl -fsS "http://127.0.0.1:${candidate_port}/c/stanki-sverlilnye?view=grid" -o "$candidate_category"
curl -fsS "http://127.0.0.1:${candidate_port}/p/sverla-koronchatye-lzhs" -o "$candidate_product"
grep -qi '^x-robots-tag: noindex, nofollow, noarchive' "$candidate_headers"
grep -q '<meta name="robots" content="noindex, nofollow, nocache"' "$candidate_home"
grep -q '^Disallow: /' "$candidate_robots"
! grep -q '<url>' "$candidate_sitemap"
! grep -q 'mc.yandex.ru/metrika' "$candidate_home"
grep -q 'Начните с производственной задачи' "$candidate_home"
grep -q 'Выбрать исполнение' "$candidate_category"
grep -q 'Получить КП' "$candidate_product"
rm -f "$candidate_home" "$candidate_headers" "$candidate_robots" "$candidate_sitemap" "$candidate_category" "$candidate_product"

for route in /catalog /company /contacts /c/koronchatye-sverla /compare; do
  curl -fsS "http://127.0.0.1:${candidate_port}${route}" >/dev/null
done

admin_status="$(curl --retry 4 --retry-delay 1 --retry-connrefused --max-time 60 -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${candidate_port}/admin/catalog")"
[[ "$admin_status" =~ ^30[2378]$ ]]

backup="$shared/backups/20261009-before-home-ux-${source_short}"
[[ ! -e "$backup" ]] || { echo "Preview backup path already exists."; exit 1; }
mkdir -p "$backup"
printf '%s\n' "$active" > "$backup/active-release.txt"
pm2 prettylist > "$backup/pm2-prettylist.json"
crontab -l > "$backup/root.crontab"
cp -p "$shared/new.env" "$backup/new.env"

[[ ! -e "${active_link}.next" && ! -L "${active_link}.next" ]] || { echo "Stale activation link exists."; exit 1; }
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
public_category="$(mktemp)"
public_product="$(mktemp)"
curl -fsS -D "$public_headers" "https://new.7tool.ru/?release=${source_short}" -o "$public_home"
curl -fsS "https://new.7tool.ru/robots.txt" -o "$public_robots"
curl -fsS "https://new.7tool.ru/sitemap.xml" -o "$public_sitemap"
curl -fsS "https://new.7tool.ru/c/stanki-sverlilnye?view=grid&release=${source_short}" -o "$public_category"
curl -fsS "https://new.7tool.ru/p/sverla-koronchatye-lzhs?release=${source_short}" -o "$public_product"
grep -qi '^x-robots-tag: noindex, nofollow, noarchive' "$public_headers"
grep -q '<meta name="robots" content="noindex, nofollow, nocache"' "$public_home"
grep -q '^Disallow: /' "$public_robots"
! grep -q '<url>' "$public_sitemap"
! grep -q 'mc.yandex.ru/metrika' "$public_home"
grep -q 'Начните с производственной задачи' "$public_home"
grep -q 'Выбрать исполнение' "$public_category"
grep -q 'Получить КП' "$public_product"
rm -f "$public_home" "$public_headers" "$public_robots" "$public_sitemap" "$public_category" "$public_product"

for route in /catalog /company /contacts /c/koronchatye-sverla /compare; do
  curl -fsS "https://new.7tool.ru${route}" >/dev/null
done

production_pid_after="$(pm2 pid 7tool-prod)"
[[ "$production_pid_after" == "$production_pid_before" ]]
[[ "$(readlink -f /var/www/7tool-production-current)" == "$production_active" ]]
curl -fsS https://7tool.ru/ >/dev/null
crontab -l | cmp -s - "$backup/root.crontab"

pm2 delete "$candidate_name" >/dev/null 2>&1 || true
pm2 save
switched="0"
trap - ERR INT TERM
cleanup

printf 'OK release=%s source=%s preview_pid=%s production_pid=%s utc=%s\n' \
  "$app" "$source_sha" "$(pm2 pid 7tool-storefront-new)" "$production_pid_after" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$status_file"
echo "PREVIEW_ACTIVE=$(readlink -f "$active_link")"
echo "PREVIEW_PID=$(pm2 pid 7tool-storefront-new)"
echo "PRODUCTION_PID=$production_pid_after"
echo "INDEXING=disabled"
df -h /var/www | tail -1
echo "HOME_UX_PREVIEW_OK"
