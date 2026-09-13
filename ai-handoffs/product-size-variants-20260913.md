# Product size variants — 2026-09-13

- Agent: Codex
- Branch: `codex/product-size-variants`
- Base commit: `61945d3`
- Status: complete and released to the isolated test host
- Goal: make product execution selection understandable to an industrial buyer by leading with feed-backed dimensions and decision parameters instead of article codes, while keeping the exact SKU available for identification and quote requests.
- Scope: product-page variant presentation, related/compatible product presentation where necessary, responsive styling, regression tests, and this handoff.
- Safety: use only supplier-feed facts; do not infer dimensions, compatibility, stock, price, or delivery promises; do not submit forms or change production.
- Completion criteria: annular-cutter variants show diameter/working depth/shank or the best available decision parameters as the primary label; SKU is secondary; duplicates remain distinguishable; desktop and mobile layouts stay readable; related products explain the practical relationship; focused tests, full lint/test/build, and browser or rendered-page checks pass.

## Checks

- Supplier snapshot confirmed that `sverla-koronchatye-lzhs` contains 49 variants; the previous product page exposed only the first 12 in feed/article order.
- LZHS choices now render working size as the primary label (`Ø13 × 30 мм`), compatibility context (`Weldon 19 + Nitto · HSS-XE`) as secondary information, and SKU only in the selected-position reference and accessible label.
- Size-led variants are naturally sorted by diameter and working length. LZHS resolves from Ø12 through Ø60 instead of the previous sparse feed order.
- The first product response keeps only 12 choices; the full list is fetched on demand from a read-only, validated and cached endpoint. LZHS initial HTML is about 66 KB and its 49-choice response is about 32 KB. The largest 493-variant series remains off the initial rendering path.
- Long lists include search by size or article, incremental reveal, loading/error/empty states, and a clear selected-size summary.
- Compatible accessory cards now lead with working size and compatibility context; the supplier article is a secondary reference.
- Focused product/variant tests: 12/12 passed.
- Local full suite: 136/136 passed; full ESLint passed; `vinext build` passed.
- Local release smoke: 46/46 read-only checks passed.
- Server full suite: 136/136 passed; full ESLint passed; `vinext build` passed.
- Candidate smoke on port 3199: 46/46 passed; LZHS page 200, variant endpoint 200, all 49 variants in natural order.
- Active test smoke on port 3000: 46/46 passed; LZHS page 200, size copy present, endpoint returns Ø12 through Ø60.
- PM2: `7tool-storefront-test` online with 0 restarts from the new release. `7tool-prod` remains online on the unchanged production release.
- Capacity after release: 5.0 GB disk available and about 2.1 GiB memory available.
- External HTTPS: protected test product returns the expected 401 without Basic Auth; production home returns 200.
- No forms, customer leads, quote delivery, production process, DNS, credentials, or live integrations were changed or exercised.

## Commit

- Implementation: `2362e29` (`feat: lead product variants with working size`)
- Test release: `/var/www/7tool-release-20260913-product-size-variants-2362e29`
- Rollback release: `/var/www/7tool-release-20260913-proxy-origin-44e1962`
