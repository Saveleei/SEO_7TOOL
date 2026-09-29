# Production cutover readiness — 2026-09-29

## Scope and safety boundary

- Read-only audit of the active VPS and public/test endpoints.
- No production or test process restart, Nginx/DNS change, feed publication, cron change, credential change or customer-form submission.
- The active production storefront remains the previous immutable release.

## Verified active state

- Production process: `7tool-prod`, PID `100870`, restart count `3`, status `online`.
- Production cwd: `/var/www/7tool-release-20260911-trust-performance-029d3f3/7tool-source`.
- Production public endpoint: HTTP `200`.
- Test process: `7tool-storefront-test`, PID `94885`, restart count `0`, status `online`.
- Test access endpoint: HTTP `302` to the application login gate.
- Nginx loopback upstreams remain `127.0.0.1:3000` and `127.0.0.1:3108`.
- Free VPS disk at the audit: about `6.3 GiB`.

## Prepared release and rollback

- Final validated storefront candidate is present at `/var/www/7tool-release-20260929-production-candidate-74c1128-feed8413cf1`.
- Rollback pointer resolves to `/var/www/7tool-rollbacks/prod-before-redesign-20260929-029d3f3`.
- Rollback package already contains the previous runtime, consistent SQLite backup, environment snapshot, Nginx/crontab snapshots and checksum inventory.
- Catalog candidate SHA-256 remains `8413cf1ca18a4af0423ff731914e43bac434b71d872a02bdaed348f91387a057`.

## Existing shared production state

- Legacy shared root `/var/www/7tool-shared` exists and contains the active SQLite database, uploads, private specifications, backups, Stalex state and protected environment.
- Existing production environment has configured SQLite, public upload, backup, SMTP, lead and MAX settings. Secret values were not displayed.
- The new Vinext storefront must not silently reuse its release directory for mutable requests or editor assets. It needs a dedicated persistent `QUOTE_DATA_DIR` with backup.
- The new catalog paths and private request-storage paths are not yet installed in the protected production environment.

## Missing activation prerequisites

- `/var/www/7tool-production-shared` is not present.
- `/var/www/7tool-production-shared/catalog-current` is not present.
- A separate production quote workspace is not present.
- `/var/www/7tool-production-feed-runtime-current` is not present.
- No `production-feed-refresh` cron entry is installed.
- A permanent production manager-auth PBKDF2 secret has not been installed for the Vinext storefront.
- The existing legacy hourly/nightly refresh and queue cron jobs remain active and unchanged.

## P0 fixed before cutover

- Implementation commit: `49ee8f8` (`fix: align production storefront process name`).
- Branch: `codex/production-process-alignment-20260929`.
- The Vinext PM2 config now honours `PM2_APP_NAME`; production is explicitly configured as `7tool-prod`.
- This matches the exact process name accepted by the production feed runner, so a successful atomic nightly publication reloads the process that serves the live storefront.
- The cutover runbook now requires the same process name in both storefront and feed environments.

## Verification

- Focused production/release tests: `9/9` passed.
- Full storefront test suite: `314/314` passed.
- ESLint on changed executable/test files: passed.
- Vinext production build: passed all `5/5` stages.
- No generated catalog artifact content changed during the build.

## Gate decision

- **GO** for the code candidate, feed pipeline, rollback package and controlled cutover preparation.
- **NO-GO** for switching production traffic until the user explicitly authorizes live Beget changes.
- The approved cutover must create the production-owned catalog and quote storage, install a root-only environment and manager secret, publish the reviewed catalog generation, start the candidate on loopback, run read-only smoke, then switch the production process/upstream with immediate rollback available.
