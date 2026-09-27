# Visual content and trust pass — 2026-09-27

## Outcome

- Added feed-grounded product imagery to all six direction cards on `/catalog`.
- Reused the editable homepage assortment media as the single source of truth for catalog direction images.
- Added one shared, evidence-led trust section to the catalog; its copy and photos are controlled by `/test/settings/trust` and also remain in use on the homepage.
- Added a compact pre-invoice assurance line to catalog product cards without increasing card density materially.
- Exposed all six general-catalog direction images in `/test/settings/homepage`, including upload, fit, focal position and ordering controls.
- Kept links, product counts and feed facts system-controlled so editorial changes cannot break catalog navigation or invent availability.
- Updated the default trust copy to match the existing real photos and avoid unsupported warehouse or delivery claims.
- Fixed mobile category-count wrapping discovered during browser QA.

## Verification

- Full project test suite: passed before the final copy-only polish.
- Focused regression suite: 17 passed, 0 failed.
- ESLint: 0 errors (the standalone CSS path is ignored by the existing ESLint configuration).
- Production build: passed.
- Browser QA: desktop and 390×844 mobile catalog, category product card, homepage/catalog content editor and shared trust editor.

## Safety

- No production or test-domain deployment was performed.
- No external forms or lead routes were submitted.
- Local preview uses isolated `.local-data` and test mode.

## Git

- Branch: `codex/visual-content-pass`
- Base: `5e5236d`
