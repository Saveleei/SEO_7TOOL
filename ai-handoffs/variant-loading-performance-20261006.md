# Product variant loading performance — 2026-10-06

- Agent: Codex
- Branch: `codex/variant-loading-performance-20261006`
- Base: `f5ec2c0` (published Yandex feed/admin lineage)
- Application: `design-exploration/staging-pilot`

## Goal

Reduce the time from opening the product-variant chooser to seeing actionable price and stock data. Preserve exact variant identity, prices, availability, canonical links, quote actions, and search behavior.

## Owned scope

- The public variant API and its response/cache contract.
- The customer-facing variant chooser and only the styles/helpers needed for progressive loading.
- Focused performance and regression tests.
- This handoff file.

## Safety constraints

- The active supplier catalog remains the only source of prices and stock.
- Never return stale data across a catalog snapshot change.
- Search must cover the complete variant matrix, not only the first page.
- Do not change product/category URLs, lead delivery, credentials, feeds, or unrelated worktrees.
- No production publication without explicit owner approval.

## Completion criteria

- The initial chooser response is bounded and materially smaller than the current full-matrix response.
- The first useful variants render immediately; the remainder loads progressively or on demand.
- Exact SKU search remains complete and every quote/product action retains the exact selected variant.
- Focused tests, full tests, lint, production build, release smoke, and responsive browser acceptance pass.

## Status

Published to production after explicit owner approval.

- Implementation commit: `fbb9f32`.

## Result

- The variant API now returns 24 choices by default and hard-limits any single response to 60 choices instead of serializing the complete matrix.
- A per-process product index caches natural ordering, choice labels, duplicate-label context and search text; price, shipping promise, specs, image and canonical link are materialized only for the requested page.
- Search by size, title or SKU and the confirmed-stock filter run against the complete product matrix on the server, including variants that have not been displayed yet.
- Category cards keep their first 12 embedded variants actionable immediately. The dialog loads the first API page in the background, then exposes deliberate “Показать ещё” steps.
- API URLs contain the exact catalog SHA prefix and runtime-override revision, so browser/shared cache keys change when the catalog snapshot or published parameter overrides change.
- Exact selected SKU, price, shipping state, product link and quote payload remain unchanged.

## Evidence

- Previous live response for the largest measured product (493 variants): 471,232 bytes, `Server-Timing` 1,573.1 ms, loopback total 1.633 s.
- New local release response for the same product (24 variants): 23,104 bytes, cold total 0.250 s — about 20× smaller and 6.5× faster in the measured run.
- API regression covers three-page traversal, an SKU located on the final page, full-matrix search, limit clamping, invalid input, and a bounded response for the 493-variant fixture.
- Focused variant suite: 18/18 passed.
- Full suite: 404/404 passed.
- ESLint: 0 errors; one pre-existing `next/no-img-element` advisory in the Yandex Metrika noscript fallback.
- Vinext production build: passed.
- Desktop browser: 12 embedded choices available before the API page completed; then 26 unique choices shown, progressive steps reached 48/49 and 49/49; `LZHS-060` search returned the one exact result and preserved that SKU after selection.
- Mobile browser at 390×844: full-height dialog, fixed actionable footer, zero horizontal overflow in the document, dialog and results region; no console errors or warnings.

## Isolated server candidate

- Candidate release: `/var/www/7tool-release-20261006-variant-performance-fbb9f32`.
- Uploaded archive SHA-256: `b7cb7a57cb98d8a3e814840827b0582af62c24e48957e956dd55a66fe35e823a`.
- Production preflight: 18/18 checks passed against the current production-owned catalog and persistent directories.
- Server-focused variant suite: 18/18 passed; focused ESLint passed; Vinext production build passed.
- Loopback release smoke: 64/64 public, anonymous-protection, sign-in and authenticated staff-route checks passed using one-time candidate-only credentials. The first completely cold traversal exceeded the existing 15-second per-route smoke timeout; after warm-up the complete matrix passed, so any production switch must keep the current pre-warm gate.
- Server response for the 493-variant product: 23,104 bytes; cold `Server-Timing` 397.6 ms and total 0.464 s; warm `Server-Timing` 53.8 ms and total 0.064 s.
- Exact final-page SKU search returned only `LZHS-060` with the correct title, price, image, link and shipping state.
- The temporary candidate process was stopped after acceptance. No PM2 process, Nginx route, symlink, feed, request data, credential or cron entry was changed.
- Production remained `200`, `7tool-prod` remained online at PID `29075`, restart count `1`, unstable restarts `0`, and `/var/www/7tool-production-current` remained on `f5d090b`.

## Production publication

- Published implementation commit: `fbb9f32`.
- Active immutable release and symlink target: `/var/www/7tool-release-20261006-variant-performance-fbb9f32`.
- PM2 `7tool-prod`: online at PID `35024`, restart count `0`, unstable restarts `0`, exact release cwd/script path confirmed; saved PM2 state updated.
- Previous production release retained for rollback: `/var/www/7tool-release-20261006-yandex-feed-admin-f5d090b`.
- Rollback and quote-data backup: `/var/www/7tool-production-shared/backups/20261006T140710Z-before-variant-performance-fbb9f32`; archive SHA-256 `c7ce3a3195dbb415be502df37694ac9a6ab64cd7c51de8149759a82d3618c2c2` verified after the switch.
- Stored request workspace remained present with the same 22 files; no request database, attachment, credential, catalog snapshot, feed scheduler, Nginx route or cron entry was rewritten.
- Public acceptance returned `200` for homepage, catalog, priority categories, product page, robots, sitemap and Yandex feed; anonymous `/admin/catalog` still returned `307`; `/api/lead` GET still returned the expected `405` bridge response.
- Public variant API returns 24 of 493 rows with `nextOffset=24` and 23,104-byte payload; full search returns the single exact `LZHS-060` row.
- Live browser acceptance: progressive list `26/49`, exact final-page SKU search `1/1`, selected article preserved, zero desktop/mobile dialog overflow at 390×844 and no browser console errors.
- Yandex feed remained at 4,092 offers, SHA-256 `68ddd05d71549d3224dc46fb6a0dc006b20cd4987be8d7e45f3dc96252a68f89`.
- Two `Premature close` diagnostics were produced by aborted acceptance-browser static streams; the referenced JS chunk (162,726 bytes) and manager photo (112,832 bytes) subsequently downloaded completely with HTTP `200`.
- Temporary candidate port `3264` was stopped after publication; disk headroom remained 14 GB.
