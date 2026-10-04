# Baymard responsive UX pass — 2026-10-04

- Agent: Codex
- Branch: `codex/baymard-responsive-ux-20261004`
- Base: `4d98da9`
- Status: implementation verified and deployed only to `new.7tool.ru`

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
- Corrected the tablet homepage hero at 761–960 px: the heading keeps coherent line breaks, the oversized desktop catalog card is replaced by a compact three-entry overview, and duplicated shortcuts/contacts are removed.
- Preserved the full mobile category task prompt instead of truncating the decisive instruction with an ellipsis.

## Files

- `design-exploration/staging-pilot/app/globals.css`
- `design-exploration/staging-pilot/app/ui/AutoApplyFilters.tsx`
- `design-exploration/staging-pilot/app/ui/HomepageTaskPaths.tsx`
- `design-exploration/staging-pilot/tests/instant-filter-ux.test.mjs`
- `design-exploration/staging-pilot/tests/baymard-responsive-ux.test.mjs`

## Verification

- Targeted tablet/mobile responsive tests: 11 passed, 0 failed after the final correction.
- Full test suite: 362 passed, 0 failed.
- ESLint: passed.
- Production build: passed; all application routes generated successfully.
- Local production HTTP smoke test: `/`, drilling-machine category, annular-cutter product and `/compare` returned HTTP 200.
- `git diff --check`: passed.
- Browser-driven visual QA completed at 360, 390, 768, 1366 and 1920 CSS px. Homepage, catalog menu, categories, mobile filter drawer, LZHS product/size matrix and comparison were checked without page-level horizontal overflow, clipped decision copy or inaccessible controls.
- Both mobile filter outcomes were exercised: `К товарам` closes the drawer and scrolls to the list; `Показать результаты` closes it, restores scrolling and persists the selected filter in the shareable URL.

## New preview deployment

- The previously granted authorization for the isolated preview was used; only `new.7tool.ru` was updated.
- Active immutable release: `/var/www/7tool-release-20261004-tablet-mobile-daeb930/design-exploration/staging-pilot`.
- Atomic pointer: `/var/www/7tool-new-current`.
- Preserved rollback: `/var/www/7tool-release-20261004-baymard-responsive-bd4632d/design-exploration/staging-pilot`.
- Final interface correction commit: `daeb930`.
- The candidate used the current catalog generation `/var/www/7tool-new-shared/catalog-releases/20261004004514-67c1dd90f641`; product/meta SHA consistency was verified before build.
- Server gate: `6/6` focused tests passed, changed-file ESLint passed, catalog presentation generated 24 categories and the Vinext production build passed.
- The candidate was accepted separately on loopback port `3267`; homepage, drilling category, exact annular-cutter product, comparison page and variants API passed before cutover.
- Public homepage, drilling category, product, comparison page, variants API and `robots.txt` returned `200` after cutover.
- `7tool-storefront-new` is online with one deliberate final-release restart and no restart loop observed during final verification.
- Indexing protection remains active: `X-Robots-Tag: noindex, nofollow, noarchive` and `robots.txt` contains `Disallow: /`.
- Production `7tool.ru` stayed online on unchanged PID `260197` and returned `200`; it was not restarted or modified.
- No forms were submitted. Feeds, cron, DNS, credentials, secrets and production services were not changed.
- Approximately `1.8 GiB` remained free after retaining the active release and rollback.
- Responsive visual acceptance is complete. The next independent launch gate is authenticated staff-workspace smoke; production remains unchanged.

## Post-deploy P0 funnel check

- Read-only HTTP checks returned `200` for homepage, search, drilling category, filtered annular-cutter category, exact product, comparison, ordering, delivery, payment, warranty, contacts and company pages.
- Search for `STEYR-35` returned five products; the first result was the correct LENZ STEYR-35 product with an exact variant link.
- Feed-backed comparison resolved exact variants `A9982` and `A10651`, current prices and shipping states with no missing selections.
- The LZHS product variants API returned all 49 executions.
- No form was submitted and no external lead was created.
- The earlier browser-runtime issue was subsequently cleared and the multi-width visual checks above now replace that pending manual gate.

## Launch-gate continuation

- See `ai-handoffs/launch-gates-20261004.md` for the controlled request result, nightly base + Stalex feed evidence, privacy-safe analytics checks and the exact blue/green cutover/rollback map.
- Production remains unchanged. Multi-width visual acceptance is closed; authenticated staff-workspace smoke is the next gate.
- Production analytics source was prepared in commit `43903c8`: the existing counter `109097461` is fail-closed outside the indexable non-test contour, and only sanitized allowlisted conversion events are sent as goals. It is now present only in the loopback production candidate documented in `ai-handoffs/production-candidate-20261004.md`; public `new.7tool.ru` and `7tool.ru` were not changed.
