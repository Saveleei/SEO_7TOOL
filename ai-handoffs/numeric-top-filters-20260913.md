# Numeric top filters — 2026-09-13

- Agent: Codex
- Branch: `codex/numeric-top-filters`
- Base commit: `0f85850`
- Status: complete; deployed only to the isolated `test.7tool.ru` storefront
- Goal: prevent promoted category filters from hiding the real numeric range, with a verified fix for pipe bevelers where values above 80 mm exist in the feed.
- Owned files: feed facet ordering/presentation, promoted filter controls, related category styles/tests, and this handoff.
- Completion criteria: numeric facet options are ordered by their actual measurements rather than popularity; the promoted row preserves minimum, representative and maximum values; hidden options remain discoverable through the full filter; desktop/mobile rows wrap without clipping; feed values are never invented; full checks and isolated staging smoke pass.

## Checks

- Targeted regression: 24/24 passed.
- Full ESLint: passed.
- Full test suite: 109/109 passed.
- Production build: passed.
- Read-only local release smoke: 44/44 routes passed.
- Feed verification for `kromkorezy-dlya-trub`: maximum diameter range is 15–2300 mm; exact `2300` filter returns SDD-2300.
- Browser-control connection was unavailable in the current session; local rendered HTML and responsive CSS assertions passed without submitting any forms.
- Server ESLint, full regression (109/109) and production build: passed.
- Server read-only release smoke: 44/44 routes passed; no customer, quote or delivery write was made.
- Server content checks: the full numeric range is present and exact `f_spec1=2300` returns SDD-2300.
- External HTTPS gate: `test.7tool.ru` returns the expected `401` Basic Auth challenge; `7tool.ru` remains `200`.
- Runtime: `7tool-storefront-test` is online with zero restarts from the new release; `7tool-prod` remains online at its pre-existing release and was not restarted or reconfigured.
- Post-release capacity: 11 GB available on `/var/www`.
- Production was not changed and no external customer messages or test leads were sent.

## Commit

- `2d34385` — complete numeric facet ranges, representative promoted values and wrapping filter layout.

## Server isolation and rollback

- Active test release: `/var/www/7tool-release-20260913-numeric-filters-2d34385`
- Preserved rollback release: `/var/www/7tool-release-20260913-card-archetypes-a57c7c8`
- Test process: `7tool-storefront-test`, port 3000.
- External delivery remains disabled by `QUOTE_TEST_MODE=1`.
- Production, Nginx, DNS, Basic Auth and persistent request storage were not changed.
