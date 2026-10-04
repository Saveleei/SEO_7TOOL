# 7TOOL isolated production candidate — 2026-10-04

## Outcome

An indexable production-configured storefront candidate was built from commit `e242642` and started on VPS `159.194.235.32` as a separate loopback-only process. Public traffic was not switched. Nginx, DNS, the current production process, `new.7tool.ru`, secrets and scheduled feeds were not changed.

## Immutable candidate

- Source branch: `codex/baymard-responsive-ux-20261004`.
- Source commit: `e242642` (`fix: bind production runtime to loopback`).
- Release: `/var/www/7tool-release-20261004-production-candidate-e242642`.
- Application cwd: `/var/www/7tool-release-20261004-production-candidate-e242642/design-exploration/staging-pilot`.
- Shared data: `/var/www/7tool-production-candidate-shared-e242642`.
- Environment file: `/var/www/7tool-production-candidate-shared-e242642/candidate.env`, mode `0600`.
- PM2 process: `7tool-prod-candidate-e242642`, id `34`.
- Bind: `127.0.0.1:3244`; the port did not answer from the public Internet.
- The process is intentionally absent from the saved PM2 startup dump until cutover is approved.

## Runtime configuration

- `NEXT_PUBLIC_SITE_URL=https://7tool.ru`.
- `HOST=127.0.0.1` and `PORT=3244`.
- `SEO_INDEXING_ENABLED=1`.
- `QUOTE_WORKSPACE_ENABLED=1`.
- `QUOTE_TEST_MODE=0`.
- `QUOTE_INTAKE_DELIVERY_ENABLED=0` and no delivery endpoint, so the candidate cannot forward a request externally during acceptance.
- Yandex Metrica id `109097461`; the source-side fail-closed privacy gate is enabled.
- Quote data and catalog paths are isolated from both the current production and `new` contours.

## Catalog snapshot

- Source: the verified active `new` catalog generation.
- Product/meta SHA-256: `67c1dd90f641066028e75f1cecbf504a8dff18463a65b0d5d83cffd0edd4f3e9`.
- Base feed completion: `2026-10-04T00:45:14.755Z`.
- Stalex refresh: `2026-10-04T00:45:17.375Z`.
- Candidate product and metadata files have matching SHA-256.
- Search for `Stalex` returned a feed-backed product with price, positive stock and the next-working-day shipping promise.

The candidate currently uses a frozen verified snapshot. A production-owned nightly base + Stalex refresh must be installed and dry-run before traffic cutover; no scheduler was added in this step.

## Verification

- Production configuration preflight: `18/18` checks passed.
- Candidate Vinext production build: passed; 24 catalog categories generated.
- Focused production-readiness tests: `8/8` passed.
- Changed-file ESLint: passed.
- Full suite: `360/360` passed.
- Candidate PM2 state at final check: `online`, `0` restarts, `0` unstable restarts.
- Loopback routes returned `200`: homepage, catalog, drilling and annular-cutter categories, drilling task, representative product, exact search, Stalex search, company, contacts, ordering, payment, delivery, warranty, comparison, `robots.txt` and `sitemap.xml`.
- Anonymous `/test/requests` returned `307` as expected.
- Metrica script and id were present in the production candidate response.
- Candidate quote storage contained no `requests.jsonl` or request-intake outbox files. No form or lead was submitted.
- Existing `7tool-prod` remained online with `6` historical restarts, `0` unstable restarts and returned HTTP `200`.
- Existing `7tool-storefront-new` remained online with `13` historical restarts, `0` unstable restarts and returned HTTP `200`.
- Final disk state: approximately `2.0 GiB` free (`95%` used).

## Safety and cleanup

- No nginx reload, DNS change, public route change, PM2 save, production restart or credential change was performed.
- The failed flat-layout candidate was verified by its exact absolute path and removed; it contained no unique data.
- Local transfer archives under the task worktree were removed after upload. These temporary artifacts are not recoverable and contained no unique source or business data.
- The current immutable candidate and its isolated shared data were retained.

## Remaining release gates

1. Rebuild the isolated server candidate from at least commit `a3ec641`; the retained `e242642` runtime predates the corrected allowlisted production admin session.
2. Install the already validated production-owned nightly base + Stalex feed pipeline against the final production shared root and closed environment during an explicitly authorized cutover. The code and a current-data isolated dry-run passed on 2026-10-05; no production scheduler was added.
3. Obtain explicit authorization for nginx cutover. Until then, `7tool.ru` must remain on the current process.

## Completed after candidate creation

- Multi-width visual acceptance completed at 360, 390, 768, 1366 and 1920 CSS px.
- Commit `a3ec641` removes the accidental dependency between local administrator sessions and `QUOTE_TEST_MODE`. Access remains restricted by the exact configured host, same-origin verification, rate limiting, PBKDF2 credentials and a signed HttpOnly/SameSite session; a foreign host is rejected.
- Focused access/release tests: `17/17`; full suite: `363/363`; changed-file ESLint and Vinext production build passed.
- A local production-mode runtime completed `62/62` read-only release checks through the real login endpoint. All nine staff workspaces returned `200` after authentication; anonymous requests still redirected. No request, setting, asset or delivery record was created.
- Browser inspection confirmed all nine staff routes have an H1, no error alert and no page-level horizontal overflow at desktop width. The mobile request journal also has no page-level overflow; its workspace navigation remains an intentional internal horizontal rail.
- The smoke matrix now includes `/test/catalog-parameters` and `/test/catalog-media` so every administrator destination in the header is checked.
- Temporary local credentials and the isolated smoke data directory were removed after the run. No live password or session token was read or exposed.
- The retained VPS candidate was not modified or restarted; this follow-up changed source and local test artifacts only.

## Rollback

No traffic points to the candidate, so the current rollback is simply to stop and delete only `7tool-prod-candidate-e242642`; the active production process and nginx configuration require no change. Do not remove the release or shared paths until the candidate is either accepted or explicitly abandoned.

## Frozen successor candidate — 2026-10-05

- Exact application source commit: `115d6e286532` (`ops: preserve lead bridge during cutover`).
- Local immutable Git archive: `C:\Users\user\Documents\ChatGPT\7TOOL\.release-artifacts\7tool-production-candidate-115d6e286532.tar.gz`.
- Archive size: `11 355 025` bytes (`10.83 MiB`); SHA-256: `5fb3a8b276bb5b7dca1ad9194dc6787e6dcf48e1dce0dd8c5c1715575eccadc4`.
- The archive contains `333` tracked application files. It contains no actual `.env`, private key, database, JSONL request/outbox file, credential file, runtime data or `node_modules`; `.env.example` and the quote API source routes are intentional source files.
- Production-critical regression: `25/25` passed, including production config, local administrator session, release smoke matrix, technical SEO and privacy-safe analytics.
- Exact Vinext build passed after regenerating the 24-category presentation. Generated build files did not change tracked source.
- Read-only capacity check: `1.8 GiB` free disk, `1.57 GiB` available RAM and `1.8 GiB` swap free. The retained `e242642` release is about `122 MiB`; its isolated shared data is about `65 MiB`. A successor release fits without deleting current production or rollback artifacts.
- `7tool-prod-candidate-e242642` and `7tool-prod` remained online with zero unstable restarts. No archive was uploaded, no new PM2 process was started, and nginx, DNS, cron, production data and secrets were not changed.

- Read-only inspection found that the active production nginx block has no dedicated `/api/lead` exception: both `/_next/static/` and `/` currently point to `127.0.0.1:3108`. Commit `115d6e2` adds a reviewed cutover template and regression test that keep exact `/api/lead` on `3108` while moving only the storefront/static routes to `3244`; focused readiness is now `7/7` and changed-file ESLint passed.

This closes the immutable-package, capacity and route-split preparation gate. The next action is an explicitly controlled replacement of only the loopback candidate with `115d6e286532`, followed by authenticated `62/62` smoke. Public cutover remains a separate authorization boundary.
