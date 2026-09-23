# Catalog media manager — handoff

- Agent: Codex
- Branch: `codex/catalog-media-manager`
- Base: `42e2c1e`
- Goal: add an authenticated product-media workspace for prioritizing missing images, uploading validated local media, previewing it, and publishing or rolling it back without modifying the supplier feed.
- Ownership: product media store/API/admin UI and focused tests introduced by this branch.
- Completion criteria: feed media keeps priority; drafts stay private; published media requires an exact product identity; upload and state changes are audited; targeted tests, lint, full tests, build, and desktop/mobile browser QA pass.
- Production impact: none; no deployment, feed publication, external messages, credentials, or live services are changed.

## Status

Completed locally. Nothing was deployed.

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

## Known limits / next work

- No product photos were fetched automatically. The administrator must verify provenance and upload each exact image.
- The 54 in-stock/source-ready items remain the next content batch; suggested order is Totem, Heden, ONIX, Kasker/Beveltools/MRCM, then the residual brands.
- No deployment to `test.7tool.ru`, feed mutation, credential change, or external message was performed.
