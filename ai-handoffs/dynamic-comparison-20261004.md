# Dynamic product comparison — 2026-10-04

- Agent: Codex
- Branch: `codex/dynamic-comparison-20261004`
- Base: `e3f3f7c`
- Status: complete; deployed to `new.7tool.ru`

## Goal

Replace the static comparison demonstration with a buyer-driven comparison of 2–4 feed-backed products. Persist the selection across catalog and product pages, preserve exact product/variant context, and keep the request-cart flow independent.

## Acceptance

- Comparison contains only products explicitly selected by the buyer.
- Selection persists locally between pages without personal data.
- A clear tray exposes count, remove/clear controls and a link to the comparison page.
- Comparison page handles empty, one-item and 2–4-item states.
- Prices, availability, media and specifications come from the current catalog source of truth.
- Mobile remains readable and does not cover the request-cart controls.
- Deployment is isolated to `new.7tool.ru`; no feed publication or external form submission.

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
- Browser runtime could not initialize in this Codex session (`failed to write kernel assets`), so no screenshot was captured. Responsive behavior is covered by the source regression tests; a manual visual pass remains recommended before any promotion beyond the preview domain.

## New preview deployment

- Published only to `new.7tool.ru` from code commit `7df6b0d`.
- Active release: `/var/www/7tool-release-20261004-dynamic-comparison-7df6b0d/design-exploration/staging-pilot`.
- Atomic pointer: `/var/www/7tool-new-current`.
- Preserved rollback: `/var/www/7tool-release-20261003-catalog-readability-33cb790/design-exploration/staging-pilot`.
- Candidate acceptance on `127.0.0.1:3265`: `/`, `/catalog`, drilling category, exact annular-cutter product, `/compare` and `/api/compare` all returned `200`; both exact variants `A9982` and `A10651` resolved from the current feed.
- Server regression gate: 59 relevant tests passed. Three assertions in `tests/numeric-facet-range.test.mjs` failed identically on the already-active release because the current nightly feed no longer contains the hard-coded pipe-beveler values `80` and `2300`; this is a confirmed pre-existing data-dependent baseline, not a candidate regression.
- Server catalog presentation generation completed for 24 categories and the Vinext production build passed with `/api/compare` in the route manifest.
- Public acceptance: homepage, catalog, drilling category, exact product, comparison page and robots endpoint returned `200`; the public comparison API resolved both control variants.
- Search isolation remains active: `X-Robots-Tag: noindex, nofollow, noarchive`; `robots.txt` disallows crawling.
- `7tool-storefront-new` remained online with zero unstable restarts after cutover. The temporary candidate process and transfer archive were removed and the PM2 state was saved.
- Production `7tool.ru` stayed online at PID `260197`, restart count `6`, and returned `200`; it was not restarted or modified.
- No forms were submitted. Feeds, cron, DNS, credentials and secrets were not changed.

## Known boundaries

- No feed publication, external form submission or production change was performed.
- A product series is compared at series level until the buyer has narrowed it to one exact execution; current-feed data always wins over the local display snapshot.
