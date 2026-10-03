# Product inline variants and uncropped task media — 2026-10-01

- Agent: Codex
- Branch: `codex/product-inline-media-fit-20261001`
- Base: `30fc7a0`
- Status: implemented, verified and released only to `new.7tool.ru`

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
- The same focused regression was repeated inside the immutable server release against the current shared feed: 41/41 passed.
- The full server suite against the newer 2026-10-03 shared catalog completed 320/336. The 16 failures are recorded as catalog/feed baseline drift: fixed historical counts and stock assignments changed after the local 336/336 run (for example category totals, brushless drill/tapping-manipulator counts, pipe-beveler facet values, and verified-media stock identities). The changed homepage and variant tests all pass and no unrelated feed assertions were rewritten for this UX release.

## Implemented

- All six homepage production-task cards use stable equal-height desktop rows and fixed-height headers, so different category counts and wrapped titles no longer move the card edges or actions.
- Subcategory images are strictly contained inside an inset media frame; supplier cutouts cannot be clipped by Next `fill` geometry.
- The product page retains the accepted inline searchable all-size matrix with truthful confirmed/unconfirmed availability states.
- Category card and table dialogs load the full feed-backed variant set through the existing read-only API before exposing the size matrix; a 49-size group no longer stops at the initial 12 items.
- Loading, API failure fallback, keyboard dialog behavior, exact variant/price/SKU and quote actions remain explicit.

## Commit

- Implementation: `5f1b49f` (`fix: stabilize task cards and size matrices`).

## Release

- Target: `https://new.7tool.ru/` only.
- Immutable release: `/var/www/7tool-release-20261003-inline-media-5f1b49f-r2/design-exploration/staging-pilot`.
- Stable pointer: `/var/www/7tool-new-current`.
- Rollback release: `/var/www/7tool-release-20261001-variant-stock-02bb46c-r2/design-exploration/staging-pilot`.
- Package SHA-256: `7185D16A6AB7F1DCA508C77302B30AF857F0F0E9E729311EC5455D75B5A0BE8D`.
- Shared catalog SHA-256 used by the build: `336d8a5a2bc3c9f42d2c4d8b8de7e19712248a3221173c9502665622bbed5ec4`.
- Candidate smoke passed before the atomic pointer switch. An initial activation attempt intentionally rolled back because a `curl | grep` check returned curl code 23 after the match closed the pipe; the check was changed to download-then-grep and the second candidate/cutover run passed.
- Final live verification after the stability wait: homepage `200`; `X-Robots-Tag` contains `noindex`; `robots.txt` disallows crawling; the product page renders all 49 sizes; the variants API returns 49 entries from `Ø12 × 30 мм` to `Ø60 × 30 мм`.
- `7tool-storefront-new`: online, PID `278823`, restart counter `9`, unstable restarts `0`.
- Production was not deployed or restarted: `7tool-prod` remained online at PID `260197`, restart counter `6`, unstable restarts `0`, cwd `/var/www/7tool-release-20260911-trust-performance-029d3f3/7tool-source`; `https://7tool.ru/` returned `200`.
- Disk after release: 2.7 GiB free on `/var/www` (`93%` used).
- No forms were submitted and no feed, cron, DNS, credentials or production data were changed.
