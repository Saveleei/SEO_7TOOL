# Admin, trust photos, and typography — 2026-10-05

## Goal

Restore a clear owner path into the production manager workspace, make homepage trust photography safely self-service, and improve the storefront type scale without changing catalog URLs, SEO ownership, credentials, or live services.

## Scope

- Diagnose `/test/access` and `/test/settings/trust` on `7tool.ru`.
- Improve the manager entry and trust-photo workflow where the current UI is unclear.
- Review and refine typography at mobile, standard desktop, and ultrawide widths.
- Add focused regression coverage and run the relevant build checks.

## Safety

- Branch: `codex/admin-trust-typography-20261005`.
- Base: `8662837` (the currently documented SEO release lineage).
- Production deployment, password reset, intake delivery, and the one pending-request replay were performed only after the user's explicit approval on 2026-10-06.
- Preserve all unrelated worktrees and user changes.

## Findings

- `https://7tool.ru/test/access` is live and returns 200; protected settings correctly redirect there.
- Before this release, the expected owner-friendly `https://7tool.ru/admin` address returned 404. The published release now redirects it to the protected homepage settings entry.
- The trust editor already uploads guarded JPG/PNG/WebP assets and requires an explicit save, but its production copy and typography are prototype-oriented and too small.
- The public CSS names Inter without loading it. Windows therefore falls back to Arial, weakening the intended hierarchy and making UI copy look dated.

## Status

- Implemented stable `/admin` and `/admin/trust` entry routes.
- Improved the owner login and trust-photo publish flow.
- Added a no-download, Cyrillic-complete modern system typography stack plus large-desktop and admin readability corrections.
- Focused owner-flow, trust-content, authentication, readability, and visual-content tests pass.
- Full suite passes: 393/393 tests.
- Full ESLint passes with the one pre-existing `YandexMetrika.tsx` `<img>` warning and no errors.
- Vinext production build passes and includes `/admin` plus `/admin/trust`.
- Published as `/var/www/7tool-release-20261006-admin-trust-typography-df1929d`; `7tool-prod` is online on port 3260 with zero restarts.
- Public acceptance passed for the homepage, drilling-machine category, contacts, robots, the 6.06 MB Yandex feed, `/admin`, and `/admin/trust`.
- The reset owner password was verified through public HTTPS: login, homepage settings, and trust settings all returned 200.
- The compiled public CSS contains the new `Segoe UI Variable Text` system stack.

## Production intake observation

- Legacy `/api/lead` notification transport is online. SMTP and MAX credentials are configured and the minute worker is present.
- Aggregated SQLite state at audit time: 91 stored legacy leads; 83 marked emailed; 28 marked sent to MAX. The most recent successful email and MAX sends were 2026-10-05 11:44 MSK. Historical MAX failures (21) have no attempts after 2026-09-08; no email failure or pending rows were present.
- The new storefront bridge remains fixed to `https://7tool.ru/api/lead` and now runs every minute under `/var/lock/7tool-intake-bridge.lock` through `/var/www/7tool-production-current`.
- The request created at 2026-10-05 23:30 MSK was delivered once (`HTTP 200`, attempt 1, `duplicate=false`). Its email and MAX outbox rows both reached `sent` on attempt 1 with no error.
- The legacy notification cron had become ineffective after the storefront cutover because it called the no-longer-public `/api/cron/notifications` route on `https://7tool.ru`. It now calls the legacy service on `http://127.0.0.1:3108`; a live run processed and sent both notification channels.

## Production rollback and backups

- Previous storefront release: `/var/www/7tool-release-20261005-seo-keywords-85bc358/design-exploration/staging-pilot`.
- Backup set: `/var/www/7tool-production-shared/backups/20261006-admin-trust-df1929d` (storefront env, PM2 dump, root crontab, and quote-data archive).
- The new release reuses `node_modules` through a symlink to the previous storefront release to avoid exhausting the 97%-full server disk. Do not remove the previous release until dependencies are moved to shared storage or installed independently in the new release.
- Stable worker symlink: `/var/www/7tool-production-current` -> `/var/www/7tool-release-20261006-admin-trust-typography-df1929d`.
