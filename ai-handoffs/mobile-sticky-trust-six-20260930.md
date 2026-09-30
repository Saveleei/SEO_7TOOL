# Mobile sticky search and six-photo trust block

- Owner: Codex
- Branch: `codex/mobile-sticky-trust-six-20260930`
- Base commit: `46d8b2dd108c96756f2f04447eeecbe52b39fc5b`
- Scope: `design-exploration/staging-pilot/` only, plus this handoff.
- Goal: keep the mobile logo/search/catalog header visible while scrolling, verify desktop/mobile navigation, and expand the editable homepage trust evidence to six real photographs without lengthening the mobile page excessively.
- Acceptance: six configurable photo stories in a 3×2 desktop grid and touch-friendly mobile rail; legacy three-card settings migrate without losing saved content; header/search remain usable at 360, 390, 430 and desktop widths; targeted tests, lint, full tests and build pass.
- Safety: do not change production `7tool.ru`, DNS, feeds, cron, or submit external leads. Any preview deployment is limited to `new.7tool.ru` after local verification.

## Files

- `app/ui/HeaderContactMenu.tsx`, `app/globals.css`: explicit open/close state, manager photo inside the popup, close controls in the popup and pill, outside-click/Escape handling, sticky mobile header, full-screen mobile catalog fix.
- `app/ui/HeaderCatalogMenu.tsx`: one feed-backed representative image for each top-level direction on desktop and mobile; subcategory links stay text-first to avoid visual overload.
- `app/data/trustContentModel.ts`, `trustContentStore.ts`, `trustContentValidation.mjs`, `app/ui/TrustSection.tsx`, `app/page.tsx`: six editable factual photo stories, legacy three-card migration, desktop 3×2 grid and mobile snap rail.
- `public/warehouse/01.webp`, `02.webp`, `04.webp`, `06.webp`, `07.webp`, `08.webp`: real warehouse, picking, dispatch and tooling photographs already supplied for 7TOOL.
- Regression expectations updated in `tests/home-mobile-navigation.test.mjs`, `tests/home-menu-commercial-trust.test.mjs`, `tests/homepage-launch-pass.test.mjs`, `tests/trust-content-settings.test.mjs`, `tests/visual-content-pass.test.mjs`.

## Checks

- Targeted regression tests: 19/19 pass, then 18/18 pass after updating legacy expectations.
- Full suite: 332/332 pass (`node --test tests/*.test.mjs`).
- ESLint: pass with no diagnostics.
- Vinext production build: pass, all five build stages complete.
- Browser QA: desktop 1440×1000 and mobile 360×800, 390×844, 430×900; no horizontal overflow; sticky logo/search/catalog header remains at the top after scroll; manager popup opens with photo and closes from the pill, in-panel X, outside click and Escape; mobile catalog covers the viewport and expands its subcategories; six-photo trust grid/rail is readable.
- Browser QA found and fixed a real mobile defect: `backdrop-filter` on the sticky header made the fixed catalog drawer inherit the 64 px header containing block. The mobile header is now opaque without that filter, so the catalog drawer uses the full viewport.

## Commit

Implementation commit: `713cb28` (`feat: improve mobile navigation and trust evidence`). Isolated `new.7tool.ru` deployment record will be appended after remote verification. Production `7tool.ru`, DNS, feeds and cron remain untouched.
