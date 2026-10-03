# Dynamic product comparison — 2026-10-04

- Agent: Codex
- Branch: `codex/dynamic-comparison-20261004`
- Base: `e3f3f7c`
- Status: complete; not deployed

## Goal

Replace the static comparison demonstration with a buyer-driven comparison of 2–4 feed-backed products. Persist the selection across catalog and product pages, preserve exact product/variant context, and keep the request-cart flow independent.

## Acceptance

- Comparison contains only products explicitly selected by the buyer.
- Selection persists locally between pages without personal data.
- A clear tray exposes count, remove/clear controls and a link to the comparison page.
- Comparison page handles empty, one-item and 2–4-item states.
- Prices, availability, media and specifications come from the current catalog source of truth.
- Mobile remains readable and does not cover the request-cart controls.
- No deployment, feed publication or external form submission.

## Commit

`7df6b0d` — `feat: add feed-backed persistent comparison`

## Implemented

- One persistent comparison state for category cards, desktop/mobile product tables and the selected product-page execution.
- Maximum four products; choosing another execution of the same product replaces the old execution instead of duplicating the series.
- Local storage contains only bounded catalog identity/display fields and no customer contacts.
- `/api/compare` resolves the saved identifiers against the current feed with `no-store`, including current price, availability, shipping promise, image and technical specifications.
- `/compare` now has explicit empty, one-product, loading, error and 2–4-product states. The technical table repeats the price and next action after the specifications.
- Exact executions can be added to the existing quote draft; product series lead back to execution choice. The specialist action uses the protected contact dialog.
- Persistent desktop/mobile tray, accessible controls, horizontal mobile table and privacy-safe comparison analytics were added.

## Verification

- Focused comparison/category/variant tests: `41/41` passed.
- Full ESLint: passed.
- Full test suite: `353/353` passed.
- Vinext production build: passed; `/api/compare` was included in the route manifest.
- Local HTTP smoke on `127.0.0.1:3250`: `/compare` returned `200`; `/api/compare` returned `200` and two current exact variants (`A9982`, `A10651`) with prices, shipping states and six specifications each.
- Final targeted comparison tests after exact-variant preservation: `6/6` passed.
- Browser runtime could not initialize in this Codex session (`failed to write kernel assets`), so no screenshot was captured. Responsive behavior is covered by the source regression tests; a manual visual pass remains recommended before deployment.

## Known boundaries

- No deploy, feed publication, external form submission or production change was performed.
- A product series is compared at series level until the buyer has narrowed it to one exact execution; current-feed data always wins over the local display snapshot.
