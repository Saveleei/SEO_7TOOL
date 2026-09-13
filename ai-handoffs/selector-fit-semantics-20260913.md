# Selector fit semantics — 2026-09-13

- Agent: Codex
- Branch: `codex/selector-fit-semantics`
- Base commit: `c103b9e`
- Status: implementation complete; test-host rollout pending
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

## Commit

Pending final implementation SHA and isolated test-host rollout record.
