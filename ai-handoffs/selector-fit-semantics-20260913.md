# Selector fit semantics — 2026-09-13

- Agent: Codex
- Branch: `codex/selector-fit-semantics`
- Base commit: `c103b9e`
- Status: complete; deployed only to the isolated `test.7tool.ru` storefront
- Goal: make guided category selection apply technical intent correctly: exact compatibility, minimum required capacity, or containment inside a supported working range.
- Owned files: category selection rules/URL state, feed facet matching and match explanations, guided selector rendering, related tests/styles, and this handoff.
- Completion criteria: every published category/facet used by a selector has an explicit safe match mode; pipe diameter validates min/max containment; capacity facets use at-least matching; exact-fit facets stay exact; malformed dimensional choices are excluded from compact selectors without removing them from source data; result cards explain the fit; all values remain feed-grounded; full checks and isolated test-host smoke pass.

## Checks

- Explicit selector semantics cover all generic guided-category facets: `exact`, `minimum`, or `range`.
- Pipe-beveler diameter selection applies both `max >= requested` and `min <= requested` to the same feed variant.
- Compact numeric choices omit malformed tolerance/code fragments while the full source-backed filter remains unchanged.
- Product-card match reasons and selection context explain exact, lower-bound, and upper-bound interpretation.
- Changed-file ESLint: pass.
- Full `npm run lint` equivalent: pass.
- Full tests: 120/120 pass.
- Production build: pass.
- Local release smoke: 44/44 checks pass on `http://127.0.0.1:3197`; no customer or delivery forms submitted.
- Local content checks pass for pipe range (`600 mm`) and compressor minimum-capacity (`1210`) routes.
- Server ESLint, full regression (120/120), and production build: pass.
- Pre-switch and post-switch server release smoke: 44/44 checks pass; no customer, quote, or delivery writes.
- Server content checks pass for the pipe containment route and compressor minimum-capacity route.
- External HTTPS gate: `test.7tool.ru` returns the expected `401` Basic Auth challenge; `7tool.ru` remains `200`.
- Runtime: `7tool-storefront-test` is online with zero restarts from the new release; production remains online and was not restarted or reconfigured.
- Post-release capacity: 9.7 GB before deployment and 9.7 GB available on `/var/www` after the release copy/build.

## Commit

- `6754db4` — explicit exact/minimum/range selector semantics, variant-level pipe containment, clean compact choices, and fit explanations.

## Server isolation and rollback

- Active test release: `/var/www/7tool-release-20260913-selector-fit-6754db4`
- Preserved rollback release: `/var/www/7tool-release-20260913-guided-selectors-ec07d8c`
- Test process: `7tool-storefront-test`, port 3000.
- External delivery remains disabled by `QUOTE_TEST_MODE=1`.
- Production, Nginx, DNS, Basic Auth, credentials, and persistent request storage were not changed.
- The upload archive and temporary candidate process were removed after verification.
