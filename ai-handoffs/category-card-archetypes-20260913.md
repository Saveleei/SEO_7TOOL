# Category card archetypes — 2026-09-13

- Agent: Codex
- Branch: `codex/category-card-archetypes`
- Base commit: `65cba0c`
- Status: implementation complete; staging release pending
- Goal: audit the category-to-product decision path and introduce feed-grounded product-card archetypes for machines, tooling, consumables, fixtures and complex equipment without inventing availability, prices or specifications.
- Owned files: category/product-card presentation modules, category expert metadata, related styles/tests, and this handoff.
- Completion criteria: every published category maps to an explicit card archetype; cards expose the smallest decision-driving specification set, explain selected-filter matches, preserve exact variant actions, remain readable on desktop/mobile, and pass category regression, lint, build and read-only release smoke checks.

## Checks

- Published category coverage: 24/24 categories map to one of six explicit industrial buying archetypes.
- Feed audit: verified category-by-category facet order, variant density, missing images, missing key specifications and request-only prices. Sparse-data cards now show category-specific clarification prompts rather than an empty specification column.
- Targeted category/card tests: 25/25 passed.
- Full regression: 104/104 passed.
- ESLint: passed without warnings.
- Production build: passed (`468` client modules, `481` RSC modules).
- Local production-server matrix: 24/24 category routes returned `200`; archetype labels/actions, selected-filter explanations, exact single-variant actions, project-equipment action and sparse-data fallback were present.
- In-app visual control is unavailable on this Windows host (`failed to write kernel assets`, OS error 3); validation used production rendering, HTTP content checks and responsive CSS assertions. No standalone browser automation was substituted.
- No external customer messages or test leads were sent.

## Commit

Pending.
