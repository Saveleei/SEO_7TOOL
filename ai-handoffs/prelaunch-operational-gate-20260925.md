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

## Commit

- Implementation: `2d88191` (`fix: restore reliable feed freshness`).
- Test-only isolated refresh: `1778eff` (`feat: isolate nightly storefront feed refresh`).
- Supplier category mapping: `bcf52a0` (`fix: map supplier pipe beveler category`).
- Prepared release archive: `prelaunch-operational-gate-bcf52a0.tar.gz`, SHA-256 `EB748FA8301AD1B69DC1B1A8F8CF48AEBE14B8723F5E92635B90C65308BEBE5F`.
