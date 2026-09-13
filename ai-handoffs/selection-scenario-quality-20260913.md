# Selection scenario quality — 2026-09-13

- Agent: Codex
- Branch: `codex/selection-scenario-quality`
- Base commit: `de28081`
- Status: complete; deployed only to the isolated `test.7tool.ru` storefront
- Goal: validate every published storefront category against feed-grounded industrial buying scenarios and improve the guided-selection response for broad, exact, and zero-result states.
- Owned files: feed-backed category selection/query helpers, category result-state UI, scenario-quality regression tests, and this handoff.
- Completion criteria: every published category has executable feed-grounded scenario coverage; invalid or non-discriminating scenarios are surfaced; zero-result guidance preserves user intent and offers safe relaxation or an engineer callback; exact and broad result states have clear next actions; no specifications or availability are invented; full checks and isolated test-host smoke pass.

## Checks

- Feed-grounded scenario matrix: 200 low/middle/high parameter scenarios across all 24 published categories; every scenario returns at least one technically compatible product family.
- Every structured category has at least one guided scenario that materially narrows the assortment; the sparse machine-tooling category remains an intentional engineer handoff.
- Every filterable category recovers from an impossible value by removing one named condition while retaining the rest when that produces results.
- Pipe working diameter is recovered as one grouped customer condition, removing both lower- and upper-bound query keys together.
- Exact, shortlist, broad, and zero-result guidance is implemented; the zero state embeds a phone-first test form with the selected technical context and no customer data in the context string.
- Changed-file and full ESLint: pass.
- Full regression: 126/126 pass.
- Production build: pass.
- Local release smoke: 44/44 checks pass on `http://127.0.0.1:3199`; no customer or delivery forms submitted.
- Rendered HTML checks pass for exact-result, broad-result, zero-result recovery, and engineer-handoff states.
- Server ESLint, full regression (126/126), and production build: pass.
- Pre-switch and post-switch server release smoke: 44/44 checks pass; no customer, quote, or delivery writes.
- Server-rendered content checks pass for exact, broad, zero-result recovery, grouped pipe-range recovery, and engineer-handoff states.
- External HTTPS gate: `test.7tool.ru` returns the expected `401` Basic Auth challenge; `7tool.ru` remains `200`.
- Runtime: `7tool-storefront-test` is online with zero restarts; production remains online and was not restarted or reconfigured.
- Server capacity: 8.8 GB available before the release copy and 7.9 GB after deployment on `/var/www`.

## Commit

- `d1868b3` — feed-grounded scenario matrix, result-state guidance, one-condition recovery, and phone-first engineer handoff.

## Server isolation and rollback

- Active test release: `/var/www/7tool-release-20260913-scenario-quality-d1868b3`
- Preserved rollback release: `/var/www/7tool-release-20260913-selector-fit-6754db4`
- Test process: `7tool-storefront-test`, port 3000.
- External delivery remains disabled by `QUOTE_TEST_MODE=1`.
- Production, Nginx, DNS, Basic Auth, credentials, and persistent request storage were not changed.
- The upload archive and temporary candidate process were removed after verification.
