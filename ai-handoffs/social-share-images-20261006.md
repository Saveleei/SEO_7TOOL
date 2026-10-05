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
- Do not deploy or change production services without a separate explicit production approval.

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

## Verification

- Full test suite passed (dot reporter; no failed tests).
- Focused typography/social/SEO suite: 19/19 passed before the final CSS unification; final typography/social suite: 9/9 passed.
- Full ESLint: 0 errors; one pre-existing `YandexMetrika.tsx` `<img>` warning.
- Production build passed after catalog generators: 24 categories and 125 legacy-compatible subcategory landings.
- Local production HTTP checks confirmed image/png cards, 1200×630 dimensions, long-lived cache headers, structured metadata, manifest and complete favicon link set.
- Visual QA confirmed correct Russian text, exact official logo, category/subcategory/product photography, and Inter on the storefront.

## Production state

- Not deployed. Publishing requires the owner's separate explicit `публикуй` approval.
