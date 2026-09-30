# Variant media and conversion funnel — 2026-09-30

- Agent: Codex
- Branch: `codex/variant-media-funnel-20260930`
- Base commit: `962c743`
- Scope: `design-exploration/staging-pilot/` product variant presentation, privacy-safe funnel analytics, regression tests, and responsive acceptance for seven priority categories.
- Goal: show variant imagery only when it is exact and visually distinct, keep the selected variant synchronized with the main gallery, and make the category → filter → product → КП/quick-order funnel measurable without contact data.
- Safety: no changes to `7tool.ru`; no external test form submissions; any deployment is restricted to `new.7tool.ru` after local build and smoke gates pass.

## Acceptance

- Repeated identical feed images do not create dozens of duplicate thumbnails.
- A variant with an exact distinct image shows a stable thumbnail and selecting it updates product media and commercial context together.
- Missing or uncertain variant images fall back honestly to the product image.
- Funnel events cover category entry, filter use, product open, quote add/open, quick-order open and successful request, with allowlisted product/category context only.
- Mobile checks cover drilling machines, annular cutters, pipe bevelers, burrs, welding carriages, tapping manipulators and compressors.
- Relevant tests, full lint, full test suite, build, browser QA and any `new.7tool.ru` deployment result are recorded below.

## Changed files

- `app/data/variantPresentation.ts`, `app/ui/FeedProductPurchase.tsx`, `app/ui/FeedProductGallery.tsx`, `app/product/[slug]/page.tsx`: exact variant media is shown only when the supplier image is distinct; repeated fallback images remain text-led and honest.
- `app/ui/ProductComparisonDialog.tsx`, `app/globals.css`: comparison keeps table semantics, equal columns and a non-wrapping tabular price; grid layout moved inside the cell so the price cannot change column geometry.
- `app/ui/HeaderContactMenu.tsx`, `app/globals.css`: permanent green manager availability marker on desktop/mobile and a clean vector MAX mark instead of the placeholder.
- `app/data/conversionAnalytics.mjs`, `app/ui/ConversionAnalytics.tsx`, filter/cart entry points: privacy-safe funnel events with strict event/field allowlists and no contact data.
- `tests/conversion-analytics.test.mjs`, `tests/variant-presentation.test.mjs`, `tests/storefront-acceptance.test.mjs`: regression coverage for media, analytics, comparison price stability, manager bubble and messenger marks.

## Verification

- Targeted regression: 23/23 passed.
- Full suite: 327/327 passed (`node --test --test-force-exit 'tests/*.test.mjs'`).
- ESLint of changed files: passed.
- Vinext production build: passed; 24 category presentations regenerated without content diff.
- Desktop browser: exact distinct image changes together with variant, price and specs; duplicate image sets stay text-only; comparison rendered four equal 249 px commercial columns, `white-space: nowrap` prices and no table overflow.
- Mobile browser 390×844: no horizontal overflow; two-column variant selector; 56 px manager control stays above the sticky purchase bar.
- Seven priority category pages checked at mobile width: drilling machines, annular cutters, pipe bevelers, burrs, welding carriages, tapping manipulators and compressors.
- No forms were submitted and no external delivery was triggered.
- Published only to `new.7tool.ru`: release `/var/www/7tool-release-20260930-variant-media-01dd28e/design-exploration/staging-pilot`; `7tool-storefront-new` online with PID `141740`, zero restarts.
- Live desktop comparison: four equal 249 px price columns, fixed table layout, non-wrapping prices and zero overflow. Live mobile: four equal 174 px columns inside the intended horizontal comparison scroller, zero page overflow.
- `new.7tool.ru/test/access` returns 200 with `X-Robots-Tag: noindex, nofollow, noarchive`; `7tool.ru` remained online with unchanged PID `100870` and restart count `3`.
- Rollback target remains `/var/www/7tool-release-20260930-category-ux-6fa98cc/design-exploration/staging-pilot`.

## Commit

- Implementation: `01dd28e` (`fix: stabilize comparison and variant buying flow`).
