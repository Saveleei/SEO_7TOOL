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

Implementation and local acceptance complete; production remains unchanged pending explicit publication approval.

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

## Remaining gate

- Create and smoke-test an isolated server candidate, then publish only after the owner explicitly approves the production switch.
