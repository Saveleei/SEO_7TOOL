# Product inline variants and uncropped task media — 2026-10-01

- Agent: Codex
- Branch: `codex/product-inline-media-fit-20261001`
- Base: `30fc7a0`
- Status: implementation verified locally; deployment to `new.7tool.ru` pending

## Goal

Keep the previous inline all-sizes presentation on the product page, retain the compact variant dialog only in catalog listings, and make homepage task-category media fully visible without cropping on desktop and mobile.

## Safety

- `7tool.ru` production remains unchanged.
- Deployment target, after all checks, is only `new.7tool.ru` as explicitly requested.
- No feed, DNS, cron, credential or production data changes.

## Checks

- Focused regression: 41/41 passed.
- Full regression: 336/336 passed.
- ESLint for every changed source and test file: passed.
- Vinext production build: passed; all five build stages completed and 24 catalog categories were regenerated.
- Local production-server read-only checks: homepage `200`, product page `200`, product page contains the inline `Показаны все 49 размеров` state, and `/api/catalog-product-variants` returns all 49 LZHS variants in natural size order from `Ø12 × 30 мм` through `Ø60 × 30 мм`.
- The Codex in-app browser runtime was unavailable with `failed to write kernel assets`; no unsupported browser automation was substituted. Layout invariants are covered by focused CSS/component regression and live verification remains a deployment gate.

## Implemented

- All six homepage production-task cards use stable equal-height desktop rows and fixed-height headers, so different category counts and wrapped titles no longer move the card edges or actions.
- Subcategory images are strictly contained inside an inset media frame; supplier cutouts cannot be clipped by Next `fill` geometry.
- The product page retains the accepted inline searchable all-size matrix with truthful confirmed/unconfirmed availability states.
- Category card and table dialogs load the full feed-backed variant set through the existing read-only API before exposing the size matrix; a 49-size group no longer stops at the initial 12 items.
- Loading, API failure fallback, keyboard dialog behavior, exact variant/price/SKU and quote actions remain explicit.

## Commit

Pending final commit and isolated `new.7tool.ru` release record.
