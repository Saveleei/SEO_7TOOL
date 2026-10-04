# Baymard responsive UX pass — 2026-10-04

- Agent: Codex
- Branch: `codex/baymard-responsive-ux-20261004`
- Base: `4d98da9`
- Status: implementation and local verification complete; not deployed

## Goal

Audit and improve the published preview storefront for desktop and mobile usability, readability and conversion. Apply relevant Baymard product-list, filtering, navigation and mobile-overview findings to the 7TOOL B2B industrial-equipment funnel without copying consumer-retail patterns that conflict with quote-led purchasing.

## Scope

- Homepage first screen and task/category entry.
- Catalog navigation and category product lists.
- Mobile and desktop filters, applied-filter visibility and result controls.
- Product-page hierarchy, variant selection, comparison and conversion actions.
- Typography, spacing, responsive composition, touch targets and focus states.
- Regression coverage for the resulting interaction rules.

## Guardrails

- Preserve the current feed-backed catalog, availability and pricing sources of truth.
- Preserve the quote-request and manager-contact business model.
- Do not submit forms or external leads.
- Do not deploy, change DNS, feeds, cron, credentials, secrets or production services without separate approval.

## Acceptance

- Critical desktop and mobile paths remain understandable without horizontal clipping, overlapping controls or hidden decision information.
- Desktop filters can update efficiently while mobile filters preserve overview and require a deliberate results action.
- Product listings expose the category-specific attributes buyers need before opening a product.
- Primary and secondary actions have a consistent hierarchy and accessible touch/focus treatment.
- Targeted tests, ESLint, full tests and production build pass, with unrelated baseline failures recorded separately.

## Implemented

- Increased the desktop reading scale and retained compact density only for secondary metadata.
- Added consistent keyboard focus treatment and larger mobile touch targets.
- Kept desktop category filters instant, but changed mobile filtering to a deliberate `Показать результаты` action so every tap does not rebuild the list or move the viewport.
- Made the mobile filter drawer a full-screen decision surface with a sticky result action.
- Improved product-list result controls, product-card actions and responsive text wrapping.
- Kept the desktop catalog overview expanded, while mobile task groups start collapsed and reveal one group at a time.
- Reordered the homepage task cards so the buyer first reads the concrete production task (`Сверление и резьба`), then its explanatory context.
- Preserved a visible 2 × 2 overview of the four B2B trust conditions on mobile instead of hiding them in a carousel.
- Added reduced-motion handling and regression tests for the responsive interaction contract.

## Files

- `design-exploration/staging-pilot/app/globals.css`
- `design-exploration/staging-pilot/app/ui/AutoApplyFilters.tsx`
- `design-exploration/staging-pilot/app/ui/HomepageTaskPaths.tsx`
- `design-exploration/staging-pilot/tests/instant-filter-ux.test.mjs`
- `design-exploration/staging-pilot/tests/baymard-responsive-ux.test.mjs`

## Verification

- Targeted responsive/filter tests: 18 passed, 0 failed.
- Full test suite: 357 passed, 0 failed.
- ESLint: passed.
- Production build: passed; all application routes generated successfully.
- Local production HTTP smoke test: `/`, drilling-machine category, annular-cutter product and `/compare` returned HTTP 200.
- `git diff --check`: passed.
- Browser-driven multi-width visual QA could not be completed because the in-app browser runtime failed to create its kernel assets (`os error 3`). This is the remaining manual release gate; no standalone browser automation was substituted.

## Release note

No deployment, feed publication, live form submission, DNS change or production-service change was performed. Publish to `new.7tool.ru` only after explicit approval and a visual check at 360/390/768/1366/1920 px.
