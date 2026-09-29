# Production rollback passport — 2026-09-29

## Identity

- Rollback ID: `prod-before-redesign-20260929-029d3f3`.
- Previous storefront commit: `029d3f3`.
- Previous immutable application: `/var/www/7tool-release-20260911-trust-performance-029d3f3/7tool-source`.
- Rollback package: `/var/www/7tool-rollbacks/prod-before-redesign-20260929-029d3f3`.
- Stable rollback pointer: `/var/www/7tool-rollback-current`.
- Self-contained runtime mirror: `/var/www/7tool-rollback-current/runtime`.
- PM2 process: `7tool-prod`; loopback port: `3108`.
- Candidate references: storefront `5a05181`, production feed pipeline `0820ad2`.

## Package contents

- Consistent online SQLite backup created through the SQLite backup API.
- Shared and release catalog snapshots plus feed state.
- Root-only copy of the production environment; never print or attach it to a ticket.
- Nginx and root crontab snapshots.
- PM2 description and the exact previous `/var/www/7tool-current` target.
- Hardlink runtime mirror with `node_modules` and the actual `.next-direct` build, so automated cleanup of the original release cannot remove the rollback files.
- Source archive without `node_modules`, `.next`, `.env*` or live database files.
- Product uploads archive and SHA-256 inventory.

## Code rollback procedure

Run only during an approved production rollback. This restores application code and process configuration, but deliberately keeps all new leads and customer data.

```sh
set -eu
rollback=/var/www/7tool-rollback-current
old_target="$rollback/runtime"
test "$(cat "$rollback/meta/release-commit.txt")" = 029d3f3
test -s "$old_target/.next-direct/BUILD_ID"

cd "$rollback"
sha256sum -c checksums.sha256

temporary=/var/www/.7tool-current.rollback-029d3f3
test ! -e "$temporary"
ln -s "$old_target" "$temporary"
mv -Tf "$temporary" /var/www/7tool-current

set -a
. /var/www/7tool-shared/.env.production
set +a
PM2_APP_NAME=7tool-prod PORT=3108 NEXT_DIST_DIR=.next-direct pm2 startOrReload "$old_target/ecosystem.config.cjs" --only 7tool-prod --update-env

curl -fsS http://127.0.0.1:3108/ >/dev/null
curl -fsS https://7tool.ru/ >/dev/null
pm2 save
```

If Nginx or cron were changed during cutover, compare them with the package snapshots and restore them separately only after reviewing the diff. Always run `nginx -t` before an Nginx reload.

## Data safety

Do **not** restore the saved database during an ordinary code rollback: it would erase leads and administrative changes created after cutover. The database copy is disaster-recovery evidence only. A database restore requires a separate incident decision, export of all newer leads and a maintenance window.

Keep the previous release and this package for at least 30 days after the new production launch. Do not include either path in automated release cleanup during that period.

## Verification

- SQLite `integrity_check`: `ok` at package creation.
- Runtime mirror build ID: `ytH1aalsJ7EitWyLMKgF4`; critical runtime hashes are stored in `runtime-critical.sha256`.
- All package SHA-256 checks and all seven critical runtime checks passed after final assembly.
- Saved Nginx and root crontab hashes matched the live configuration at final verification.
- Rollback PM2 configuration was parsed with `PM2_APP_NAME=7tool-prod`, `PORT=3108` and `NEXT_DIST_DIR=.next-direct` without starting it.
- Production remained on the original release, PM2 stayed online with restart counter `3`, and both loopback and public health returned HTTP `200`.
- The hardlink mirror reports 2.4 GiB apparent size but reused the immutable release blocks; approximately 93 MiB of additional filesystem space was consumed for the mirror metadata and non-hardlinked entries. About 6.7 GiB remained free.
- Production was not restarted or switched while the package was created and verified.
