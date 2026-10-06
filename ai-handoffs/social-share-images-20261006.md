# Social share images — 2026-10-06

## Ownership

- Agent: Codex
- Branch: `codex/social-share-images-20261006`
- Base: `47d6bec` (the production admin/typography release lineage)
- Worktree: `.codex-tmp/social-share-images-20261006`

## Goal

Restore high-quality social previews for the production storefront using page-specific images: branded fallback for the homepage and generic pages, representative category/subcategory photography, and the primary product image for product links.

## Scope

- Audit live Open Graph and Twitter/X metadata and image responses.
- Implement a single deterministic metadata/image-selection policy in `design-exploration/staging-pilot`.
- Add exact image dimensions, MIME types, accessible alt text, canonical URLs, and regression tests.
- Validate representative homepage, category, subcategory, and product pages with focused tests, lint, and a production build.
- Apply the owner-approved Inter Variable typography across the storefront and protected owner workspace.
- Replace placeholder branding with the approved FINAL 3.0 v2 favicon, app icons, header/footer logos, and social-card logo.

## Safety

- Preserve the dirty root worktree and all unrelated branches/worktrees.
- Reuse first-party catalog and warehouse media; do not hotlink supplier images in social metadata.
- Production deployment was performed only after the owner explicitly requested publication on `7tool.ru`.

## Acceptance

- Every indexable public page has an absolute `og:image` and `twitter:image` with a safe fallback.
- Category and subcategory pages prefer their own first-party hero/category image.
- Product pages prefer their own primary product image.
- Images resolve with HTTP 200, an image content type, and social-compatible dimensions/aspect ratio.
- No catalog URLs, canonicals, redirects, or product/category data are changed.

## Implemented

- Added stable first-party 1200×630 social-card routes for categories, subcategories, and products.
- Added structured Open Graph image metadata: absolute URL, type, width, height, and alt text, with the versioned warehouse card as fallback.
- Added the correct catalog/category/product photography to generated cards; remote supplier images are fetched only by the server from an allowlisted HTTPS path and converted into the first-party PNG response.
- Embedded static Inter 4.1 fonts in the image renderer so Russian text renders correctly; added self-hosted Inter Variable WOFF2 for the website with `font-display: swap` and system fallbacks.
- Applied Inter variables to former hardcoded Arial/Inter declarations across the public interface and owner workspace.
- Integrated approved FINAL 3.0 v2 assets from the owner-supplied brand kit: SVG and ICO favicons, 16/32 PNG icons, Apple Touch icon, Android 192/512 icons, web manifest, and exact vector header/footer/social logos.
- Replaced the old unrelated blue placeholder favicon.
- Added a final responsive readability pass for the catalogue hero and 320 px text wrapping.
- Removed the duplicate fixed manager bubble at widths up to 1180 px. The same contact menu remains available in the mobile bottom navigation or tablet header, while product titles and comparison/purchase controls are no longer covered.

## Verification

- Full local test suite: 399/399 passed.
- Final focused readability/social/storefront suite: 15/15 passed locally and 15/15 on the server.
- Full ESLint: 0 errors; one pre-existing `YandexMetrika.tsx` `<img>` warning.
- Local and server production builds passed after catalog generators: 24 categories and 125 legacy-compatible subcategory landings.
- Local production HTTP checks confirmed image/png cards, 1200×630 dimensions, long-lived cache headers, structured metadata, manifest and complete favicon link set.
- Visual QA confirmed correct Russian text, exact official logo, category/subcategory/product photography, and Inter on the storefront.
- Responsive browser matrix covered homepage, catalogue, category, subcategory, product and staff access at 320, 360, 390, 768, 1024, 1440 and 1920 px (42 combinations). Every case loaded Inter and a valid viewport, and page-level horizontal overflow was zero.
- A real 320 px long-heading overflow and the mobile/tablet manager-overlay collisions found during QA were fixed and rechecked on the published site. The final 768 px product screenshot has no overlapping manager control.
- Supplier CDN images flagged during the short browser wait were checked separately: the sampled URLs returned HTTP 200, but several 2–4 MB PNGs took 10–20+ seconds. This is an upstream image-weight/latency issue, not a broken URL or layout collision.

## Production state

- Published commit: `09de62c` (`fix: prevent tablet manager overlay`).
- Active immutable release: `/var/www/7tool-release-20261006-social-share-09de62c`.
- Archive SHA-256: `e7abf6fea8f8d148c2f4438dce644470bc588bcd1b88705d788c549585ea153a`.
- Active symlink: `/var/www/7tool-production-current` → the release above.
- PM2: `7tool-prod` online from the correct release path, zero restarts; production preflight passed 18/18.
- Production anonymous smoke: 52/52 checks (43 public routes returned 200; 9 protected workspaces redirected anonymous access to `/test/access`). No authenticated smoke was attempted because plaintext administrator credentials were deliberately not extracted or printed.
- Public acceptance: homepage, category, subcategory and product returned 200; Inter WOFF2, favicon, manifest, sitemap and Yandex feed returned 200; `/api/lead` GET returned the expected 405, leaving the existing lead bridge untouched.
- Category, subcategory and product social-card endpoints returned first-party `image/png` responses; their 1200×630 contract is covered by the renderer tests.
- No new bytes were appended to the shared production error log during the final 52-route smoke and asset checks.
- PM2 state was saved after removing the candidate process.
- Current rollback release: `/var/www/7tool-release-20261006-social-share-219ffe4`.
- Pre-switch backups: `/var/www/7tool-production-shared/backups/20261006-mobile-overlay-219ffe4` and `/var/www/7tool-production-shared/backups/20261006-tablet-overlay-09de62c`.
- The unused failed intermediate release `7tool-release-20261006-social-share-d42bfdf` was verified as unreferenced and removed; the rollback and dependency releases were preserved.
- Canonical URLs, redirects, feed data, stored requests and credentials were not changed.
