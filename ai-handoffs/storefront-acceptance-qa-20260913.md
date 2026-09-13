# Storefront acceptance QA — handoff

## Scope

- Owner: Codex
- Branch: `codex/storefront-acceptance-qa`
- Base: `dac2ea0` (`codex/storefront-release-candidate`)
- Application: `design-exploration/staging-pilot`
- Status: in progress

## Goal

Perform a release-focused acceptance pass over the accepted 7TOOL storefront and local quote administration workflow. Verify the shortest customer path, staff access path, feed-backed product data, responsive rules and accessibility. Fix only confirmed P0/P1 defects and add bounded regression coverage.

## Acceptance criteria

- Customer discovery path remains coherent from home to task/category, filters, exact product and quote drawer.
- Anonymous staff routes remain protected; local administrator routes remain usable.
- Representative feed-backed categories expose usable product identity, decision attributes, image, price and honest availability states without invented claims.
- Key layouts have explicit desktop and narrow-screen behavior without hidden primary controls or horizontal clipping.
- Critical interactive elements are keyboard-addressable and carry useful accessible names.
- No customer form, external message, production delivery endpoint or production infrastructure is touched.
- Narrow tests, full lint, full tests, production build and loopback smoke pass.

## Owned files

- `design-exploration/staging-pilot/app/data/contactAnalytics.mjs`
- `design-exploration/staging-pilot/app/data/contactConfig.ts`
- `design-exploration/staging-pilot/app/data/feedCatalog.ts`
- `design-exploration/staging-pilot/app/globals.css`
- `design-exploration/staging-pilot/app/layout.tsx`
- `design-exploration/staging-pilot/app/product/[slug]/page.tsx`
- `design-exploration/staging-pilot/app/ui/ContactAnalytics.tsx`
- `design-exploration/staging-pilot/app/ui/ContactRequestDialog.tsx`
- `design-exploration/staging-pilot/app/ui/FeedProductCard.tsx`
- `design-exploration/staging-pilot/app/ui/FeedProductPurchase.tsx`
- `design-exploration/staging-pilot/app/ui/FeedProductTable.tsx`
- `design-exploration/staging-pilot/app/ui/HeaderContactMenu.tsx`
- `design-exploration/staging-pilot/app/ui/ManagerContactCard.tsx`
- `design-exploration/staging-pilot/app/ui/PilotHeader.tsx`
- `design-exploration/staging-pilot/app/ui/RequestCart.tsx`
- `design-exploration/staging-pilot/scripts/smoke-release-candidate.mjs`
- `design-exploration/staging-pilot/tests/product-recommendations.test.mjs`
- `design-exploration/staging-pilot/tests/storefront-acceptance.test.mjs`
- `design-exploration/staging-pilot/tests/storefront-release-candidate.test.mjs`

## Confirmed findings and changes

- P0 — products without an image were removed from category results, and a direct product route could throw HTTP 500 because optional `variant.images` was indexed unsafely. The feed contains 658 product groups without a product-level image. They now remain discoverable, render the existing honest placeholder and open successfully.
- P1 — 252 variants have no SKU in the current snapshot. Product, card, table and quote-request surfaces now show an explicit feed-data fallback instead of a blank article.
- P1 — the global header/mobile navigation did not expose the four approved contact channels together. One reusable menu now exposes phone, email, Telegram and MAX without shifting the page layout.
- P1 — contact click analytics existed only in one manager card. A global allowlisted listener now covers all phone/email/Telegram/MAX links and emits placement, page type, product/variant/category context when available, without contact values or user-entered data.
- P1 — both customer dialogs could let keyboard focus escape, and the quote drawer did not restore the originating control. Focus is now contained while open, restored on close and moved to a usable confirmation action after success.

## Feed audit snapshot

- 24 published categories; none empty.
- 4,283 product groups and 18,352 variants.
- 658 product groups without a product-level image; handled with a visible placeholder.
- 915 product groups without a usable description; existing factual fallback remains in place.
- 5,355 variants without a positive price; existing `Цена по запросу` fallback remains in place.
- 4,139 variants have `available=true` and a positive quantity. The UI keeps the qualified supplier-data wording and does not invent same-day shipment.

## Safety boundary

- Local loopback preview only.
- No production deployment, Beget/DNS change, credentials, migration or feed publication.
- No external form submission, email, Telegram, MAX or CRM delivery.

## Verification

- Targeted regression tests: 14/14 passed.
- Full ESLint: passed.
- Full test suite: 90/90 passed.
- Production build: passed.
- Loopback smoke at `http://127.0.0.1:3181`: 44/44 checks passed.
  - All 24 published categories and all six production-task routes returned HTTP 200.
  - Representative normal, missing-image and missing-SKU product routes returned HTTP 200.
  - Anonymous staff routes redirected to access; local administrator access returned HTTP 200.
- Four content assertions for the contact menu, category count and incomplete-data fallbacks passed.
- No customer form or external delivery channel was called.

Interactive desktop/mobile browser control could not start because the local browser-control runtime failed while creating its kernel assets. No unsupported browser substitute was used. Static responsive/accessibility review, production rendering and loopback HTTP verification were completed; visual interaction should be repeated when that runtime is available.

## Local preview

- `http://127.0.0.1:3181/`
