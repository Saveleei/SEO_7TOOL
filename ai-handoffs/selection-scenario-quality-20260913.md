# Selection scenario quality — 2026-09-13

- Agent: Codex
- Branch: `codex/selection-scenario-quality`
- Base commit: `de28081`
- Status: implementation complete; test-host rollout pending
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

## Commit

Pending final implementation SHA and isolated test-host rollout record.
