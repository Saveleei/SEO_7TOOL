#!/usr/bin/env sh
set -eu

APP_DIR=${APP_DIR:-/var/www/7tool-current}
SHARED_ENV=${SHARED_ENV:-/var/www/7tool-shared/.env.production}
PM2_APP_NAME=${PM2_APP_NAME:-7tool-prod}

set -a
. "$SHARED_ENV"
set +a

cd "$APP_DIR"
npm run db:backup
node scripts/refresh-feed.mts
npm run data:check
npm run ads:feed
node scripts/generate-product-seo.mjs --if-configured --best-effort --limit "${SEO_AI_NIGHTLY_LIMIT:-100}"
node scripts/generate-programmatic-seo.mjs
cp src/lib/products.json /var/www/7tool-shared/products.json
npm run build
pm2 reload "$PM2_APP_NAME" --update-env
pm2 save
