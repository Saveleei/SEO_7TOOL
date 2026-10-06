# Social preview relevance — 2026-10-06

## Outcome

- Category, subcategory, and product metadata now exposes exactly one page-specific Open Graph image.
- Every generated card remains `1200×630` PNG.
- The cache revision moved from a query parameter to a fingerprinted path: `/social-card/v-<revision>/<kind>/...png`.
- The fingerprint includes the design version, route identity, rendered copy, source photo URL, and image alt text.
- Old unversioned card URLs remain available with short caching; stale fingerprinted URLs redirect to the current revision.
- Coverage verifies unrelated equipment pages never reuse the magnetic drilling-machine category photo.

## Verification

- Focused social-preview tests: 8/8 passed.
- Full storefront tests: 402/402 passed.
- ESLint on the changed files: passed.
- Vinext production build: passed.
- Local rendered HTML for a category, subcategory, and product contains one absolute fingerprinted `og:image` each.
- Production audit before the change confirmed that the renderer already selects correct photos for an NKO beveler category, subcategory, and product; the remaining defect is cache identity/ambiguity in social parsers.

## Release status

Committed locally but not published. Production SSH currently rejects every authorized key, and the server disk was previously observed full during the separate quote-attachment release attempt. Recover SSH access and exact-target disk cleanup before deploying either release.
