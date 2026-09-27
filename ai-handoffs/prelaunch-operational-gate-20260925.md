# Prelaunch operational gate — 2026-09-25

- Owner: Codex
- Branch: `codex/prelaunch-operational-gate`
- Base commit: `db4346397b66c27bec5bd22b76f9ff592b27b944`
- Scope: diagnose missing storefront availability and implement a safe nightly supplier-feed refresh contract without changing production services, credentials, DNS or live cron during development.
- Expected files: feed refresh/scheduler scripts, shipping freshness settings, focused regression tests, operational documentation.
- Success criteria:
  - a successful feed import atomically publishes catalog data and completion metadata;
  - a failed or overlapping import preserves the last known good snapshot and exits non-zero;
  - a nightly cadence remains fresh through the next scheduled run but fails closed after a missed run;
  - product and category cards show availability only for confirmed positive stock from a fresh snapshot;
  - narrow tests, lint, full tests and production build pass;
  - no production deployment, cron mutation or external test lead is performed as part of this branch.

## Verification

### Diagnosis

- Live crontab already contains the intended schedule: hourly refresh at minute 15 and the full nightly rebuild at `03:15` Moscow time.
- The active production refresh and rebuild scripts fail immediately with `set: Illegal option -` because the deployed shell files contain CRLF line endings.
- The active production release predates snapshot metadata publication. `/var/www/7tool-shared/catalog-snapshot-meta.json` is absent, and the storefront release contains `status: "unknown"`; therefore the fail-closed availability policy correctly renders “Наличие и срок уточняем”.
- Production, crontab, PM2, credentials, shared catalog data and the supplier feed were inspected read-only and were not modified.

### Implementation

- Added repository-wide LF enforcement for shell files and a regression that rejects CR bytes.
- Added bounded feed download retries and a size limit. A failed remote download now exits non-zero and preserves the last known good publication; stale local fallback is emergency-only via `FEED_ALLOW_LOCAL_FALLBACK=1`.
- Added SHA-256 identity to snapshot metadata and an atomic finalizer that publishes `products.json` before matching metadata.
- Both hourly and nightly jobs now run the finalizer after all catalog-mutating generators. Nightly therefore publishes freshness metadata before build/reload.
- Storefront runtime can consume a shared metadata path and compares its loaded catalog SHA-256 with the published snapshot. Mismatch fails closed until the process reloads the matching catalog.
- Documented the `03:15` nightly schedule, hourly freshness cadence, PM2 reload contract and post-run control points.
- The isolated real-feed gate found a new supplier category `11`. Its two published TVN-63/TVN-114 models match the existing portable pipe beveler/facer family, so the feed category is mapped to `kromkorezy-dlya-trub` instead of the split-frame `truborezy` family.

### Checks

- Focused feed, shipping and runtime tests: `34/34` passed.
- Shell syntax: `hourly-refresh.sh`, `nightly-rebuild.sh`, `process-production-queues.sh` passed `sh -n`; all three are LF-only.
- Storefront full tests: `279/279` passed.
- Storefront full ESLint: passed with no findings.
- Storefront production build: passed (`vinext build`).
- Legacy full tests: `157/160` passed. The three unrelated baseline failures are the pre-existing reviewed magnetic-drill SEO profile and two editorial approval checksum mismatches; no feed/availability test failed.
- Legacy full ESLint: 0 errors, 3 pre-existing warnings (`no-img-element`, `beforeInteractive`, unused callback index).
- Legacy production build: passed (`next build`, 149 static pages generated).
- `git diff --check`: passed.

### Activation boundary

- This branch does not change live cron or production. The existing schedule can stay unchanged after a production release because it already calls the canonical scripts.
- Activation requires a controlled release of these scripts and runtime files, then one successful refresh, verification of the shared catalog/metadata SHA pair, and PM2 reload. Do not manually forge `completedAt`.
- A test-only runner now requires separate work and publish directories and reloads only the configured test PM2 process. The intended test cadence is `03:25` Moscow, after the existing production rebuild window, with a dedicated lock.
- The first isolated supplier-feed run failed closed on the new category `11`; no catalog was published and no PM2 or cron state changed. The mapping was then added and covered by a focused regression.
- After the workstation reboot, the SSH key was no longer present in the local agent. Upload of the corrected release was rejected with public-key authentication before any server mutation. Browser verification confirmed that the current test stand is still on the old fail-closed snapshot and displays “Наличие и срок уточняем”.

### Test activation — 2026-09-25

- With explicit user approval, the VPS root password was reset and `Amicable Izolda` was rebooted. Production recovered with HTTP 200. A dedicated SSH public key was added through the Beget file manager; no mailbox or stored browser password was read.
- Deployed test release: `/var/www/7tool-release-20260925-feed-freshness-bcf52a0`; `/var/www/7tool-test-current` points to this release. Production process `7tool-prod` was not restarted and retained PID `1065` throughout the test cutover.
- The first full-app candidate exposed an auth-gateway incompatibility (public test returned 500 because `/api/manager-auth/check` was absent). It was rejected and rolled back before final activation. The final active process uses the current Vinext storefront plus its dedicated `ecosystem.test.config.cjs`; public test returns 302 to `/test/access`, the access page returns 200, and production returns 200.
- One isolated real-feed refresh completed: 18,997 offers represented, 4,336 catalog products, 18,463 variants, 4,197 variants with confirmed positive stock, zero unsupported categories. Published catalog SHA-256: `84ebc929db17db7913e70e0f608e5d95078492aca57f8b45d66fb79a11ff94e4`.
- Browser QA through an SSH tunnel confirmed fresh-stock filtering and after-cutoff wording: “Есть исполнения в наличии · Отгрузка в следующий рабочий день”, with the next planned date. Magnetic-drill cards separately label core-drill and twist-drill diameters.
- Test cron is isolated from production and scheduled at `00:25` server UTC, equal to `03:25 Europe/Moscow`; backups: `/var/www/7tool-test-shared/backups/crontab-before-test-feed-20260925T1727Z.txt` and `/var/www/7tool-test-shared/backups/crontab-before-test-rebuild-20260925T1750Z.txt`. The runner now optionally rebuilds the Vinext storefront after atomic publication because its catalog presentation is generated at build time.
- The exact installed cron command completed end to end at `2026-09-25T18:02:03.716Z`: database backup, download, import, atomic publication, Vinext rebuild and reload of `7tool-storefront-test`. Final control returned test root `302` to `/test/access`, access page `200`, production `200`; `7tool-prod` and `7tool-storefront-test` were both online.
- Test access was restored after the release exposed that the local username had previously existed only in the PM2 process environment. `MANAGER_AUTH_LOCAL_USERNAME=7tool-admin` and a newly generated PBKDF2 hash are now persisted in the protected shared env; backup: `/var/www/7tool-test-shared/backups/env-before-test-login-reset-20260925`. A real sign-in request returned `200`; the plaintext password is intentionally not recorded here.
- Post-deploy capacity: 4.6 GB free of 38 GB (88% used). Enough for the activated release, but old immutable releases should be pruned under a separate reviewed cleanup before several more deployments.

### Automatic cron acceptance — 2026-09-26/27

- The first two unattended `03:25 Europe/Moscow` runs completed successfully on 26 and 27 September. The latest snapshot completed at `2026-09-27T00:25:14.393Z`; import, atomic publication, Vinext build and PM2 reload all completed without a logged error.
- On 26 September the published file SHA-256 exactly matched metadata (`84ebc929db17db7913e70e0f608e5d95078492aca57f8b45d66fb79a11ff94e4`), all 18,997 feed offers were represented and unsupported categories remained zero. The 27 September run published a new matching identity (`eb9308752a22d689d0941ca3b9fbe5f126a603c31f8cf436c22875c7b5ae0079`).
- Acceptance exposed a policy mismatch: the isolated test feed runs daily, while both its process config and runtime validator capped freshness at 180/1440 minutes. Availability therefore disappeared after three hours even after a successful cron. Test configuration, validation, promise normalization and the administrator form now allow exactly 26 hours (`1560` minutes): enough to bridge the next run plus a two-hour grace, while a missed run still fails closed.
- Regression matrix: focused shipping/auth tests `19/19`, complete storefront tests `280/280`, changed-file ESLint passed, and a clean Vinext production build passed. Browser QA after test-only activation found 12/12 visible drilling-machine cards with confirmed stock and next-working-day shipment wording; zero cards fell back to “Наличие и срок уточняем”.
- Test-only rollback copies: `/var/www/7tool-test-shared/backups/ecosystem.test.config.before-freshness-20260927.cjs` and `/var/www/7tool-test-shared/backups/freshness-runtime-before-68a624b`. Production was not rebuilt or restarted.
- Final control: public test root `302` to authenticated access, access page `200`, production `200`; both PM2 processes online. Disk now has 4.5 GB free of 38 GB (89% used), so reviewed release cleanup remains the next operational prerequisite.

### Isolated business acceptance — 2026-09-27

- The production build completed the full loopback-only B2B path: exact product → idempotent customer request → local administrator session → assignment/status → ready quote → submission/approval → three-page PDF with one exact-product image → delivery preparation → held outbox.
- Result: synthetic request `7T-20260927-FBED6B`, quote `КП-20260927-FBED6B`, PDF 173,878 bytes, 19 checked actions, slowest response 5,629 ms. Outbox status remained `held`, transport remained `disabled-test-contour`, external delivery was false, and the temporary request directory was removed after verification.
- No public form, mailbox, messenger, CRM endpoint or real recipient was used. The test exercised only a temporary loopback server and synthetic `.example` contact data.

### Desktop/mobile UX acceptance — 2026-09-27

- Desktop and mobile browser checks covered the homepage, catalog, a filterable burr category, search for `STEYR-35`, the exact STEYR-35 product page, the request-for-quote drawer and comparison. Homepage, catalog, category, search, product and quote drawer had no document-level horizontal overflow, empty links or clipped primary actions. Confirmed availability/shipping, exact product links, product image, manager contacts and preselected consent were visible; no form was submitted.
- The only launch-relevant defect found was the standalone comparison page: legacy table copy reached 6–10 px, and mobile users were not told that the table scrolls horizontally. Commit `52cf628` moves comparison copy onto the shared 12–15 px readability scale, adds an explicit mobile scroll hint, a focusable scroll region and an accessible table caption.
- Verification: focused readability tests `3/3`, changed-file ESLint, complete storefront tests `280/280`, local Vinext production build and server-side Vinext production build passed. The isolated server candidate returned `200` for homepage, catalog, in-stock category, search, exact product and comparison; its comparison HTML contained the new scroll guidance. Customer write actions and external channels were not called.
- Test-only release: `/var/www/7tool-release-20260927-ux-compare-52cf628`; rollback remains `/var/www/7tool-release-20260925-feed-freshness-bcf52a0`. Request-data backup: `/var/www/7tool-test-shared/backups/quote-requests-before-ux-compare-52cf628-20260927.tar.gz`. Archive SHA-256: `4ca6055a670d49d2ef9b071cc9718543fd3cd1423c7d8b63b633ee028ff3c0b3`.
- The first PM2 reload attempt did not become ready inside the deliberately short 25-second gate and rolled back automatically. Recreating only `7tool-storefront-test` from the new immutable release succeeded; six live loopback routes returned `200`. Active test PID: `37600`, restart count `0`; production stayed online on PID `1065` and returned `200`.
- Public controls: test root `302` to `/test/access`, access page `200`, production `200`; post-release free space is 4.3 GB of 38 GB. The in-app browser policy blocked reopening the authenticated public test origin after the switch, so the post-release gate used the exact server build plus live loopback/public HTTP checks rather than a second screenshot pass.

## Commit

- Implementation: `2d88191` (`fix: restore reliable feed freshness`).
- Test-only isolated refresh: `1778eff` (`feat: isolate nightly storefront feed refresh`).
- Supplier category mapping: `bcf52a0` (`fix: map supplier pipe beveler category`).
- Test storefront rebuild: `55ee372` (`fix: rebuild test storefront after feed refresh`).
- Test daily freshness config: `5565e77` (`fix: align test feed freshness with nightly schedule`).
- Runtime freshness validation: `68a624b` (`fix: permit nightly feed freshness grace`).
- Comparison readability and mobile scroll affordance: `52cf628` (`fix: keep comparison readable on narrow screens`).
- Prepared release archive: `prelaunch-operational-gate-bcf52a0.tar.gz`, SHA-256 `EB748FA8301AD1B69DC1B1A8F8CF48AEBE14B8723F5E92635B90C65308BEBE5F`.
- UX acceptance release archive: `prelaunch-operational-gate-52cf628.tar.gz`, SHA-256 `4CA6055A670D49D2EF9B071CC9718543FD3CD1423C7D8B63B633EE028FF3C0B3`.
