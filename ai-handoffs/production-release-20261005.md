# Production release — 2026-10-05

- Agent: Codex
- Branch: `codex/production-release-20261005`
- Base: `f4cf5d93fd714a5cba2b18be20c2d1d1cad5ca0a`
- Application: `design-exploration/staging-pilot/`

## Goal

Promote the already accepted responsive storefront candidate to `7tool.ru` with an atomic nginx cutover, keep the legacy `/api/lead` bridge on port `3108`, preserve rollback, and verify the public production funnel.

## Scope

- Re-run the production-critical regression, full tests, lint and build from the frozen source.
- Reconfirm the loopback candidate on port `3244`, then promote the same immutable build to the stable production process on port `3260` without exposing secrets.
- Back up and update only the active `7tool.ru` nginx server configuration.
- Route exact `/api/lead` to legacy port `3108`; route storefront and static traffic to the stable production process on port `3260`.
- Validate and reload nginx, then run read-only public production acceptance.
- Keep the legacy application on port `3108`, its immutable release and a pre-cutover PM2 dump available for immediate nginx-only rollback.
- Install or confirm the production-owned nightly feed pipeline only when its target paths and dry-run are verified.

## Acceptance criteria

- Production-critical tests, full tests, ESLint and production build pass.
- Candidate has zero unstable restarts and key loopback routes pass.
- `nginx -t` passes before and after the cutover.
- Homepage, catalog, category, product, search, comparison, public information, robots and sitemap routes pass on `https://7tool.ru`.
- Production is indexable and Yandex Metrica is present only through the privacy-safe integration.
- Exact `/api/lead` remains on the legacy service.
- No external form or lead is submitted during verification.
- Rollback file, the legacy runtime on `3108`, the old release and the pre-cutover PM2 dump remain intact.

## Current state

- Production storefront: `7tool-prod`, port `3260`, release `/var/www/7tool-release-20261005-production-release-11b3134/design-exploration/staging-pilot`, zero restarts at acceptance.
- Legacy lead bridge and rollback storefront: `7tool-legacy-lead`, port `3108`, release `/var/www/7tool-release-20260911-trust-performance-029d3f3/7tool-source`, zero restarts at acceptance.
- Preview: `7tool-storefront-new`, port `3243`; unchanged by the cutover.
- Test storefront: `7tool-storefront-test`; unchanged by the cutover.
- Production cutover was explicitly authorized by the user in the source Codex task.

## Verification and release record

### Local gates

- Browser QA found a repeatable Vinext `beta.3` App Router prefetch exception caused by broken shim chunk exports. Ordinary document navigation still worked, but every link scheduled a rejected prefetch.
- Upgraded only the affected runtime pair: `vinext` `1.0.0-beta.3` → `1.0.0-beta.7` and `@vitejs/plugin-rsc` `0.5.26` → `0.5.34`. `pnpm peers check` reports no issues.
- Added a production-readiness assertion that pins the compatible pair and prevents a silent downgrade.
- Production-critical regression: `18/18` passed before and after the runtime update; the final focused production test is `7/7`.
- Full suite on the final dependency set: `364/364` passed.
- ESLint: `0` errors, one intentional existing warning for the Yandex Metrica noscript pixel.
- Vinext production build: passed; 24 catalog categories generated and all routes emitted.
- Browser QA on the rebuilt local production server: homepage, category, product and exact-model search passed with no console errors, no broken images and no page-level horizontal overflow at desktop or 390 px mobile width.

### Server cutover and production acceptance

- Deployed commit: `11b3134d3c524c1355701a8c6bbc05a64093ed7e`.
- Release archive SHA-256: `d9630fa56a9b421c36a47df335d47a83750a677c1ecb4211f346027531f3e2ba`; the uploaded archive was removed after extraction and verification, while the immutable release directory and local archive remain.
- Server install used the frozen lockfile. `pnpm peers check`, ESLint, the isolated full suite (`364/364`), the focused production suite (`7/7`) and the Vinext production build passed on the VPS. ESLint retained the single intentional Yandex Metrica noscript warning and no errors.
- A first server test invocation inherited production data paths and was stopped when data-dependent fixture assertions diverged. Its only production-side write was moved, without deletion, to `/var/www/7tool-production-shared/backups/test-isolation-20261005/catalog-parameter-overrides.test-created.json`; the published catalog was not modified by that test invocation.
- The initial production preflight correctly blocked the stale 2026-10-04 catalog. The immutable production feed runtime completed an online dry-run, then atomically published generation `/var/www/7tool-production-shared/catalog-releases/20261005121112-7547eb194c73` with catalog SHA-256 `7547eb194c73699a1b11bacecb90a5e1f45ee336f6bd023057bede40546d3e85` and `completedAt` `2026-10-05T12:11:12.558Z`.
- Production preflight passed all `18/18` checks after publication, and the release was rebuilt against the fresh catalog.
- Shared quote data was backed up to `/var/www/7tool-production-shared/backups/quote-data-before-release-11b3134-20261005T1218Z.tar.gz` before the candidate started.
- Loopback acceptance on `3244`: `43/43` public routes returned `200`, `9/9` protected routes redirected anonymous users to `/test/access`, invalid authentication returned `401`, `/api/lead` remained excluded from the candidate, and the process had zero restarts and no current error log entries.
- Browser QA on the server candidate and public production confirmed the homepage, a real client-side category transition and the STEYR-35 product page with no console errors, broken images or page-level horizontal overflow. The mobile product page retained its fixed availability, price and “Добавить в КП” bar.
- Nginx was backed up before switching. Primary rollback config: `/etc/nginx/backups/7tool.ru/7tool.ru.before-11b3134.20261005T135526Z`; the previous `sites-available` copy is `/etc/nginx/sites-available/7tool.ru.before-11b3134.20261005T135526Z`. `nginx -t` passed before every reload. The remaining TLS protocol-option warnings predate this release; there are no conflicting `7tool.ru` server blocks.
- Final routing: exact `/api/lead` → `127.0.0.1:3108`; `/_next/static/` and `/` → `127.0.0.1:3260`.
- Final public acceptance: `43/43` public routes returned `200`, `9/9` protected routes redirected correctly, `/api/lead` GET returned the expected `405`, canonical is `https://7tool.ru/`, Yandex Metrica is present, robots references the production sitemap, and the sitemap contains no preview/test hosts. No customer form or lead was submitted.
- Public and direct-loopback homepage bodies matched byte-for-byte after the final upstream switch. Both production processes were online with zero restarts. The only new production error-log entries were two Vinext `Premature close` static-stream messages caused by browser QA navigating away while lazy assets were still loading; browser checks still reported zero broken images, and an exact status-field audit of the recent Nginx access window contained no `5xx` responses.
- Stable PM2 state was saved. The pre-cutover dump remains at `/root/.pm2/dump.pm2.before-production-release-11b3134`.
- The production feed schedule was installed for `04:35 UTC` daily with an independent lock, `PM2_APP_NAME=7tool-prod` and health check `http://127.0.0.1:3260/`. The previous root crontab is backed up at `/var/www/7tool-production-shared/backups/root-crontab-before-11b3134.txt`.
- The superseded non-public `f4cf5d93fd71` candidate directory and temporary cutover processes were removed after verification; both are reproducible from Git/PM2 records. Package caches and uploaded staging files were removed, increasing free disk space from about `1.2 GiB` to `1.9 GiB` (`96%` used). Disk capacity remains the principal operational follow-up.

### Rollback

The legacy application is still serving on port `3108`, so storefront rollback is Nginx-only: restore `/etc/nginx/backups/7tool.ru/7tool.ru.before-11b3134.20261005T135526Z` to both active `7tool.ru` config paths, run `nginx -t`, then reload Nginx. Keep the new request data and catalog generations; do not delete or rewind them during rollback.
