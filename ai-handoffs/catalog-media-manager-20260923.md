# Catalog media manager — handoff

- Agent: Codex
- Branch: `codex/catalog-media-manager`
- Base: `42e2c1e`
- Goal: add an authenticated product-media workspace for prioritizing missing images, uploading validated local media, previewing it, and publishing or rolling it back without modifying the supplier feed.
- Ownership: product media store/API/admin UI and focused tests introduced by this branch.
- Completion criteria: feed media keeps priority; drafts stay private; published media requires an exact product identity; upload and state changes are audited; targeted tests, lint, full tests, build, and desktop/mobile browser QA pass.
- Production impact: none. The implementation was published only to the isolated `test.7tool.ru` process; production, DNS, Nginx, feeds, credentials, and external delivery were not changed.

## Status

Completed and published to the isolated test domain.

## Implementation

- Added `/test/catalog-media` to the authenticated administrator workspace and its header navigation.
- The default queue contains the 54 in-stock products that have no feed image but do have enough identity to verify an exact source. Search and filters cover all 637 remaining products without feed media, identity-first cases, drafts, published records, and disabled records.
- Upload accepts only signature-checked PNG/JPEG/WebP files up to 5 MB and requires a public HTTP(S) source page. Assets are content-addressed by SHA-256.
- A new upload is a private draft. Publishing, disabling, enabling, discarding a draft, and restoring a prior version use optimistic revision checks and append an administrator audit event.
- Exact product id, slug, brand, SKU, and full title are snapshotted. Publication is rejected after identity drift. The runtime overlay also fails closed on a mismatch or missing file.
- Feed and statically verified media always win. Manual media is used only when neither the product nor its variants have an image.
- Published media is consumed by catalog cards/table rows, search, request context, recommendations, and the product gallery. Draft assets require administrator access.
- The catalog-quality report drops the `missing_image` issue immediately after publication and restores it after disabling the manual image.
- Added desktop and compact responsive layouts, an in-place catalog-card preview, provenance field, version selector, audit details, and explicit state labels.

## Verification

- Focused media/search/quality tests: 13/13 passed.
- New media-manager regression tests: 4/4 passed.
- Full ESLint: passed with no warnings.
- Full test suite: 237/237 passed after the final integration fix.
- Production build: passed; all three new API routes and `/test/catalog-media` were emitted.
- Browser QA against the production build:
  - local administrator sign-in and protected navigation passed;
  - the live queue showed 54 in-stock/source-ready products and 637 products without feed media;
  - draft upload state, preview, publication, audit log, disable action, and safe fallback were exercised without external calls;
  - after publication the same asset appeared in the product page, exact category result, and exact search result;
  - the quality queue no longer returned that product while published;
  - responsive breakpoints and compact single-column controls are regression-covered; no forms or leads were submitted.

## Commits

- Implementation: `b2ca31b` (`feat: add catalog product media manager`).
- Documentation: recorded in the following commit.

## Local preview

- Administrator workspace: `http://127.0.0.1:3238/test/catalog-media`
- The preview data was cleaned after QA; it opens with the original 54-item priority queue and no fake published media.

## Test deployment — 2026-09-23

- Published branch head `d821533` (implementation `b2ca31b`) only to `test.7tool.ru`.
- Active release: `/var/www/7tool-release-20260923-catalog-media-d821533`.
- Rollback preserved: `/var/www/7tool-release-20260923-category-decisions-ca75bfd`.
- The new head is a direct descendant of the previously active `ca75bfd`; no later staging work was overwritten.
- Release archive SHA-256: `51b6f41c02b0e86fbdda60e02d46456d10161774d734d6c6e1654d69af132504`. The dependency lock matched the active release exactly, so the existing immutable dependency tree was reused by hard link.
- Persistent test data was backed up before the switch to `/var/www/7tool-test-shared/backups/quote-requests-before-d821533-20260923.tar.gz`. The application continues to use `/var/www/7tool-test-shared/quote-requests`.
- Server verification passed: 237/237 tests, full ESLint, and production build. The new `/test/catalog-media` route and all three media API routes were present in the server build.
- A separate candidate on `127.0.0.1:3199` passed 51 read-only route checks covering public pages, every published category, protected workspace redirects, and the new catalog-media workspace. No customer form, quote, delivery, email, MAX, CRM, or other external write was invoked.
- The rollback-safe switch succeeded. `7tool-storefront-test` is online with zero restarts and its cwd/script path point to the new release. The PM2 error-log size remained unchanged during the switch (`2931 -> 2931` bytes).
- External HTTPS verification: anonymous `/` redirects to the HTML access page, `/test/access` returns 200, `/test/catalog-media` remains protected, and production `https://7tool.ru/` continues to return 200.
- Temporary candidate, upload archive, helper scripts, and verification logs were removed. About 7.2 GB remained free after deployment.

## Known limits / next work

- No product photos were fetched automatically. The administrator must verify provenance and upload each exact image.
- The 54 in-stock/source-ready items remain the next content batch; suggested order is Totem, Heden, ONIX, Kasker/Beveltools/MRCM, then the residual brands.
- No production deployment, feed mutation, credential change, or external message was performed.
