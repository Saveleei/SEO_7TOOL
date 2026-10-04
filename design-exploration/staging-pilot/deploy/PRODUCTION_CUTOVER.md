# 7TOOL Vinext production cutover

This runbook prepares the approved Vinext storefront for `7tool.ru`. It does not authorize a deployment by itself.

## Release gates

Do not switch traffic until all gates are green:

1. The scheduled test feed refresh has completed successfully without a manual run.
2. The production-owned feed pipeline has completed an isolated dry-run from its immutable runtime.
3. `catalog-current/products.json` and `catalog-current/catalog-snapshot-meta.json` resolve through one atomic symlink, have the same SHA-256 and a fresh `completedAt`.
4. Full tests, lint, production build, business acceptance and the loopback release smoke pass from the immutable release.
5. The shared request directory exists, is writable by the application user and has a verified backup.
6. The administrator can sign in on the exact production host and anonymous visitors cannot open staff routes.
7. Rollback points to the current production release and has been checked without modifying it.

## Required runtime configuration

Keep the values in the protected server environment. Never commit credentials.

```text
NODE_ENV=production
PORT=<candidate port>
HOST=127.0.0.1
PM2_APP_NAME=7tool-prod
QUOTE_WORKSPACE_ENABLED=1
QUOTE_TEST_MODE=0
QUOTE_DATA_DIR=<absolute shared request directory>
SEO_INDEXING_ENABLED=1
YANDEX_METRIKA_ID=109097461
MANAGER_AUTH_LOCAL_HOSTS=7tool.ru,www.7tool.ru
MANAGER_AUTH_TEST_HOSTS=
MANAGER_AUTH_LOCAL_USERNAME=<server secret>
MANAGER_AUTH_LOCAL_PASSWORD_HASH=<PBKDF2 server secret>
SHIPPING_TIME_ZONE=Europe/Moscow
SHIPPING_CUTOFF_HOUR=18
SHIPPING_WORKING_DAYS=1,2,3,4,5
SHIPPING_FEED_MAX_AGE_MINUTES=1560
CATALOG_FEED_PATH=<absolute published catalog path>
CATALOG_SNAPSHOT_META_PATH=<absolute published metadata path>
```

Both catalog paths must point through `/var/www/7tool-production-shared/catalog-current`. Never point production at `/var/www/7tool-test-*`. The feed runner is dry-run by default; publication requires `PRODUCTION_FEED_MODE=publish`, a reviewed Stalex `productIds` baseline and the exact production PM2 process `7tool-prod`.

The production scheduler should invoke the stable `/var/www/7tool-production-feed-runtime-current/7tool-source/scripts/production-feed-refresh.sh` once per night after copying the reviewed runtime into an immutable directory. `PM2_APP_NAME` must stay `7tool-prod` in both the storefront and feed environments so the atomic catalog publication reloads the process that actually serves production. Do not schedule the active storefront release itself: feed behavior must not change when the UI release changes.

Run `npm run validate:production` before the process starts. The preflight blocks a non-loopback runtime bind, test mode, disabled lead capture or shipping promises, a missing production analytics counter, non-production administrator hosts, missing or unwritable storage, stale catalog metadata and checksum divergence. The counter is rendered only when `SEO_INDEXING_ENABLED=1` and `QUOTE_TEST_MODE=0`, so it must remain absent from the noindex preview.

## Lead handling at first launch

The customer request is appended and synced to disk before a success number is returned. Production also creates one privacy-safe record in `request-intake-outbox.jsonl` for email, MAX and CRM routing. The record is held with `deliveryEnabled=false` until each external adapter is configured and independently tested.

Until external notification adapters are approved, an assigned employee must monitor the protected request journal. Do not present automatic email/MAX/CRM delivery as active.

## Candidate sequence

1. Create an immutable release directory from the approved commit.
2. Reuse only a lockfile-matching dependency tree or install dependencies in the candidate.
3. Point the candidate at the shared catalog and request directories through the protected environment.
4. Run production preflight, tests and build.
5. Start `ecosystem.production.config.cjs` on a loopback candidate port, without changing Nginx.
6. Run the release smoke against that loopback origin. It must perform no customer-form, quote or delivery write.
7. Check representative pages, Stalex media, availability, search, category filters, product variants and staff sign-in.
8. Record PID, start time, restart count, RSS and error-log timestamp.

## Traffic switch

Switch only the production upstream to the verified candidate. Do not change DNS, certificates, feed cron or the test host in the same operation.

Immediately verify:

- `/`, `/catalog`, a task route, three priority categories and two product pages return 200;
- `robots.txt`, `sitemap.xml`, canonical URLs and `X-Robots-Tag` match the production host;
- anonymous staff routes require authentication;
- a deliberately authorized control request is saved once and receives a request number;
- production feed and test feed remain unchanged;
- PM2 stays online with no restart loop.

## Observation and rollback

Observe for at least 60 minutes. Track 5xx responses, request latency, RSS, restart count, form errors, catalog freshness and new request records.

Rollback immediately if any of these occurs:

- customer forms cannot save or return duplicate request numbers incorrectly;
- catalog checksum/freshness fails or confirmed availability disappears broadly;
- repeated process restarts, RSS above the configured limit or sustained 5xx responses;
- staff authentication exposes a protected route or blocks every administrator;
- canonical/robots settings expose the wrong host.

Rollback changes only the production upstream/process pointer to the recorded previous immutable release. Keep the new request data and feed snapshots; never delete them during rollback.
