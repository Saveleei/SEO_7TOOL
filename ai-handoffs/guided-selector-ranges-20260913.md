# Guided selector ranges — 2026-09-13

- Agent: Codex
- Branch: `codex/guided-selector-ranges`
- Base commit: `72660ce`
- Status: complete; deployed only to the isolated `test.7tool.ru` storefront
- Goal: audit every published category selector and ensure its choices cover the actual feed range instead of static low-end thresholds, with a verified correction for pipe bevelers.
- Owned files: category guided-selection configuration and rendering, feed-backed selector helpers, related category styles/tests, and this handoff.
- Completion criteria: all 24 published categories are audited; numeric selector choices are derived from actual category facet values and include representative low/middle/high values; selected choices map to working filters; no values or guarantees are invented; narrow and full checks pass; only the isolated test storefront may be updated.

## Checks

- Catalog audit: all 24 published categories; 22 generic selectors, 2 special selectors, 38 numeric assistant facets, and 1 intentional manual selector with insufficient structured feed data.
- Pipe beveler assistant: choices span the feed at 15, 52, 107, 250, 600 and 2300 mm; the exact-size path remains available in the full filter.
- Drilling assistant: removed the static 16–63 mm list; choices now come from the current feed and span 8–200 mm while retaining a selected feed value.
- Burr assistant: all three available shank values remain exposed; its task/material/shape logic does not truncate a diameter list.
- Targeted regression: 31/31 passed.
- Full ESLint: passed.
- Full test suite: 113/113 passed.
- Production build: passed.
- Read-only local release smoke: 44/44 routes passed.
- Rendered HTML verification: pipe assistant contains the 15–2300 range and 2300 choice; drilling assistant contains the 8–200 range and 200 mm choice; both link to the exact full filter.
- Production was not changed and no forms or external messages were sent.
- Server ESLint, full regression (113/113) and production build: passed.
- Server read-only release smoke: 44/44 routes passed; no customer, quote or delivery write was made.
- Server content checks: pipe selector contains its 2300 mm choice; drilling selector contains its 200 mm maximum; both retain the path to the full filter.
- External HTTPS gate: `test.7tool.ru` returns the expected `401` Basic Auth challenge; `7tool.ru` remains `200`.
- Runtime: `7tool-storefront-test` is online with zero restarts from the new release; `7tool-prod` remains online at its pre-existing release and was not restarted or reconfigured.
- Post-release capacity: 9.6 GB available on `/var/www`.

## Commit

- `ec07d8c` — feed-derived range sampling for generic and drilling guided selectors.

## Server isolation and rollback

- Active test release: `/var/www/7tool-release-20260913-guided-selectors-ec07d8c`
- Preserved rollback release: `/var/www/7tool-release-20260913-numeric-filters-2d34385`
- Test process: `7tool-storefront-test`, port 3000.
- External delivery remains disabled by `QUOTE_TEST_MODE=1`.
- Production, Nginx, DNS, Basic Auth and persistent request storage were not changed.
