# Yandex production feed and catalog admin — 2026-10-06

- Agent: Codex
- Branch: `codex/yandex-feed-admin-20261006`
- Base: `721a099` (published social-share cache release)
- Application: `design-exploration/staging-pilot`

## Goal

Create a production-catalog-backed Yandex advertising feed with a fail-closed parity audit and a protected owner-facing `/admin/catalog` workspace that exposes catalog freshness, price, stock, images, parameters, and the existing audited override workflows.

## Owned scope

- Yandex feed generation, routes, validation scripts, and focused regression coverage.
- Protected `/admin/catalog` information architecture and its catalog operations UI.
- Staff navigation and only the styles/tests required by these features.
- This handoff file.

## Safety constraints

- The supplier/production catalog remains the source of truth; do not rewrite imported feed files.
- Manual edits must use existing versioned override stores and retain rollback/audit behavior.
- Do not guess legal seller data or publish unverified legal claims.
- Do not switch Yandex Direct or the live production feed until the preview passes the exact production-data audit.
- Preserve legacy URLs, click parameters, requests, credentials, and unrelated dirty worktrees.

## Completion criteria

- Preview YML is generated from the active catalog and passes offer identity, URL, price, availability, currency, category, image, vendor, SKU, XML, and duplicate checks.
- `/admin/catalog` is administrator-protected and gives a clear path to catalog quality, parameter, and media operations while showing current price/stock/freshness evidence.
- Focused tests, full tests, ESLint, production build, candidate smoke, and responsive browser acceptance pass.
- Any production publication has an explicit rollback and leaves the site, leads, cron, and catalog pipeline healthy.

## Status

Published to production.

## Verified candidate

- Generated from the active 2026-10-06 catalog snapshot used by the candidate: 24 categories and 4,070 eligible offers.
- Exact parity audit: 0 missing, duplicate, blocked, stale-price, stale-stock, URL, image, vendor, SKU, currency, or category mismatches.
- Full test suite: 404/404 passing.
- ESLint: 0 errors (one existing `next/no-img-element` advisory for the Yandex Metrika noscript pixel).
- Vinext production build: passed.
- Loopback release smoke: 64/64 checks passing, including anonymous protection and authenticated access to `/admin/catalog`.
- Responsive browser acceptance: SKU search, exact price/stock display, mobile layout, and no mobile horizontal overflow verified.

## Production state

- Published code commit: `f5d090b`.
- Active immutable release: `/var/www/7tool-release-20261006-yandex-feed-admin-f5d090b`.
- Active symlink: `/var/www/7tool-production-current` points to the release above.
- PM2: `7tool-prod` is online from the exact new release path on port 3260; saved process state updated.
- Current production catalog at publication: 4,337 product groups, 18,464 variants, 53 quality-blocked products.
- Public YML audit: 4,092/4,092 advertisable variants present across 24 categories; zero critical mismatches and zero warnings.
- Public acceptance: homepage, category, product and feed return 200; `/admin/catalog` redirects anonymous visitors and opens after administrator authentication.
- The administrator password hash was corrected to the owner-provided password after a live login check detected the stale hash; the previous protected environment file is preserved as `storefront.env.before-yandex-feed-admin-f5d090b`.
- Rollback release: `/var/www/7tool-release-20261006-social-share-cache-721a099`.
- Rollback pointer: `/var/www/7tool-production-shared/backups/20261006-before-yandex-feed-admin-f5d090b`.
- Server headroom after cleanup: 14 GB free disk, 2.1 GB available memory; the temporary candidate process and upload archive were removed.
