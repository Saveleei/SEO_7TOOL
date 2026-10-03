# Catalog menu manager conversion — 2026-10-04

- Agent: Codex
- Branch: `codex/menu-manager-conversion-20261004`
- Base: `5554c03`
- Status: implemented and verified locally; not deployed

## Goal

Add a compact, trustworthy manager-conversion path to the catalog menu without displacing product navigation. Desktop receives a dedicated manager rail below the category tree; mobile receives the same contact path after the category tree. Phone, Telegram, MAX and specification handoff remain accessible, privacy-safe and based only on the existing contact configuration.

Review the homepage first screen on desktop and mobile and make only high-confidence readability/conversion corrections. Remove the misleading footer link to the static prototype comparison page while preserving the real selection-driven comparisons inside categories and product cards.

## Scope

- `design-exploration/staging-pilot/app/ui/HeaderCatalogMenu.tsx`
- `design-exploration/staging-pilot/app/ui/HeaderContactMenu.tsx`
- `design-exploration/staging-pilot/app/ui/PilotFooter.tsx`
- `design-exploration/staging-pilot/app/globals.css`
- `design-exploration/staging-pilot/app/page.tsx`
- `design-exploration/staging-pilot/tests/catalog-menu-manager-conversion.test.mjs`
- focused regression tests for catalog-menu conversion, contact analytics and responsive hero/menu layout

## Implemented

- Added a secondary manager conversion rail after the category navigation with the configured manager photo, persistent green “На связи” state, phone, official Telegram/MAX marks and the existing local task/specification flow.
- Removed the duplicated mobile phone/email strip so categories stay first and the manager route appears once in a clearer hierarchy.
- Removed the footer link to `/compare`; that route still contains a static demonstration dataset and must not be presented as a saved customer comparison.
- Moved the mobile hero catalog preview below the three conversion paths so catalog/task/specification actions remain above it.
- Widened the hero evidence photo track so “Реальные склад…” cannot overlap the third thumbnail.
- Changed trust photography to show the complete 16:9 frame with `object-fit: contain`; mobile evidence cards are stacked rather than slicing photos into a narrow vertical strip.

## Verification

- Focused tests: `11/11` passed initially; storefront regression after copy correction: `10/10` passed.
- Full test suite: `347/347` passed.
- ESLint changed files: passed.
- Full ESLint: passed.
- Vinext production build: passed; 24 catalog categories generated.
- Local HTTP smoke: `/` and `/catalog/category/stanki-sverlilnye` returned `200`; manager CTA and six-photo evidence were present; footer comparison link was absent.
- Browser-driven screenshots were not available because the in-app browser runtime failed to initialize (`failed to write kernel assets: path not found`). No standalone browser automation was substituted. Responsive behavior was verified by source/CSS contracts, regression tests, build output, HTTP output and the user-provided screenshots.

## Baymard/B2B rationale

- Product categories remain the primary menu content; manager/help and informational links are visually separated after them.
- The homepage continues to expose both catalog breadth and task-led browsing, while the mobile first screen prioritizes direct actions.
- The static comparison link is withheld until comparison can be populated from buyer-selected, feed-backed products.

## Acceptance

- Categories remain first and visually dominant on desktop and mobile.
- Manager card uses the configured name, photo, phone, Telegram and MAX URLs without invented contacts or response promises.
- Contact anchors inherit `data-contact-placement="catalog_menu_manager"` and are captured by the existing privacy-safe analytics delegate.
- The specification CTA opens the existing local lead flow; it does not send anything by itself.
- Desktop layout does not squeeze category names below readable widths; tablet falls back to two category columns; mobile keeps a single expandable category stack and places manager help after it.
- The footer no longer links unsuspecting users to the hard-coded prototype comparison page.
- Focused tests, full tests, ESLint and production build pass before handoff.

## Safety

- `new.7tool.ru`, `test.7tool.ru` and production `7tool.ru` are unchanged until a separate explicit deployment request.
- No feed, DNS, cron, credentials or external form submission.

## Commit

Implementation commit: `14bd98a` (`feat: improve catalog menu conversion`).
