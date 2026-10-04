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

## New preview deployment

- The previously granted authorization for the isolated preview was used; only `new.7tool.ru` was updated.
- Active immutable release: `/var/www/7tool-release-20261004-baymard-responsive-bd4632d/design-exploration/staging-pilot`.
- Atomic pointer: `/var/www/7tool-new-current`.
- Preserved rollback: `/var/www/7tool-release-20261004-dynamic-comparison-7df6b0d/design-exploration/staging-pilot`.
- The delta archive contained the three changed interface files and two regression-test files. Its local and remote SHA-256 was `0428432e4d54120f470dc724576d6200ffbd9f5b70007d2a0554f2cbbba8b13f`.
- The candidate used the current catalog generation `/var/www/7tool-new-shared/catalog-releases/20261004004514-67c1dd90f641`; product/meta SHA consistency was verified before build.
- Server gate: `6/6` focused tests passed, changed-file ESLint passed, catalog presentation generated 24 categories and the Vinext production build passed.
- The candidate was accepted separately on loopback port `3267`; homepage, drilling category, exact annular-cutter product, comparison page and variants API passed before cutover.
- Public homepage, drilling category, product, comparison page, variants API and `robots.txt` returned `200` after cutover.
- `7tool-storefront-new` is online on PID `307764` with one deliberate release restart and no restart loop observed during final verification.
- Indexing protection remains active: `X-Robots-Tag: noindex, nofollow, noarchive` and `robots.txt` contains `Disallow: /`.
- Production `7tool.ru` stayed online on unchanged PID `260197` and returned `200`; it was not restarted or modified.
- No forms were submitted. Feeds, cron, DNS, credentials, secrets and production services were not changed.
- Approximately `2.2 GiB` remained free after retaining the active release and rollback.
- Because the in-app browser runtime still failed before selection (`failed to write kernel assets: ... os error 3`), final human visual acceptance at 360/390/768/1366/1920 px remains advisable on `https://new.7tool.ru/`.

## Post-deploy P0 funnel check

- Read-only HTTP checks returned `200` for homepage, search, drilling category, filtered annular-cutter category, exact product, comparison, ordering, delivery, payment, warranty, contacts and company pages.
- Search for `STEYR-35` returned five products; the first result was the correct LENZ STEYR-35 product with an exact variant link.
- Feed-backed comparison resolved exact variants `A9982` and `A10651`, current prices and shipping states with no missing selections.
- The LZHS product variants API returned all 49 executions.
- No form was submitted and no external lead was created.
- The browser connection failed again before page selection, so this check confirms functional routing/data only and does not replace real-device visual acceptance.

## Launch-gate continuation

- See `ai-handoffs/launch-gates-20261004.md` for the controlled request result, nightly base + Stalex feed evidence, privacy-safe analytics checks and the exact blue/green cutover/rollback map.
- Production remains unchanged. Human multi-width visual acceptance remains a release blocker; analytics deployment and environment configuration remain part of the future production-candidate build.
- Production analytics source is now prepared in commit `43903c8`: the existing counter `109097461` is fail-closed outside the indexable non-test contour, and only sanitized allowlisted conversion events are sent as goals. It has not been deployed.
