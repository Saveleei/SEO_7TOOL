# Product recommendation system — 2026-09-13

- Agent: Codex
- Branch: `codex/product-recommendation-system`
- Base commit: `ce5f195bb5ed7487538a058154322c95d6ac7350`
- Worktree: `.codex-tmp/product-recommendation-system-sparse-20260913`
- Status: complete on protected test host

## Goal

Replace generic product-page cross-sell with a feed-grounded B2B recommendation system that clearly separates confirmed compatibility, products needed for the job, and technically meaningful alternatives.

## Scope

- Extend product recommendation logic using only explicit feed characteristics and category expert profiles.
- Render buyer-readable recommendation cards on the dynamic product page.
- Provide an honest manager-assisted kit CTA where compatibility cannot be confirmed from feed data.
- Add regression tests for matching, exclusions, reasons, and product-page integration.
- Validate locally, then update only `test.7tool.ru` after a release-candidate smoke test.

## Constraints

- Do not change production, DNS, credentials, or live Beget services.
- Do not send forms or leads outside the test environment.
- Do not infer compatibility without explicit feed evidence.
- Preserve the selected product variant as the source of truth across page sections.

## Acceptance criteria

- Recommendations are split into compatible items, work essentials, and alternatives.
- Each item explains why it is shown in buyer language and cites the matching feed parameters.
- Random same-category products and duplicate variants are excluded.
- Categories with insufficient evidence show a manager-assisted kit path rather than invented compatibility.
- Narrow tests, full tests, lint, build, route smoke, and protected-host checks pass.

## Result

- Implementation commit: `11d11a2259552a72046541f1342e8704a5bb3eca`
- Test release: `/var/www/7tool-release-20260914-product-recommendations-11d11a2`
- Test URL: `https://test.7tool.ru/product/sverla-koronchatye-lzhs`
- Rollback release: `/var/www/7tool-release-20260913-product-variant-sync-f507ba8`

## Implemented

- Added one reusable product recommendation system with three explicit stages: parameter-backed compatibility, full-kit engineering handoff, and technically comparable alternatives.
- Added inverse compatibility from an exact annular-cutter variant to magnetic drilling machines using both shank/spindle and diameter-range evidence.
- Kept magnetic-drill-to-cutter selection on confirmed positive stock and made it depend on the currently selected machine variant.
- Added category-specific comparison matrices across the structured feed. Generic alternatives require at least two exact facts; critical dimensions such as cutter diameter, tap thread, blade diameter/bore, and diamond-core diameter/shank cannot be relaxed.
- Recommendation cards lead with buyer-readable model or size, keep the supplier article secondary, show the exact matched facts and differences, and deep-link to the exact variant.
- Categories without sufficient compatibility evidence render a local manager-assisted verification path rather than random cross-sell.
- Added bounded in-memory caches so repeated recommendation renders do not rescan the feed.
- Added responsive desktop/tablet/mobile styling with readable type and restrained dark/rust actions.

## Verification

- Narrow recommendation and variant tests: `20/20` passed.
- Full local tests: `144/144` passed.
- Full local ESLint: passed.
- Local production build: passed.
- Local release smoke: `46/46` passed.
- Server tests: `144/144` passed.
- Server ESLint: passed.
- Server production build: passed.
- Isolated candidate smoke on port 3199: `46/46` passed.
- Product recommendation HTML assertions: `10/10` passed for LZHS, STEYR-35, and the no-evidence compressor fallback.
- Post-switch smoke on port 3000: `46/46` passed.
- Test PM2 process: online, zero restarts.
- External protected-host check: `401` without Basic Auth, as expected.
- Production check: `200`; production remains on `/var/www/7tool-release-20260911-trust-performance-029d3f3/7tool-source`.
- Server capacity after release: `3.3G` free; no production services changed.

## Visual QA note

The in-app browser runtime failed before connecting with `failed to write kernel assets` in the local Codex environment. The release was therefore validated through production rendering, route smoke, exact HTML assertions, responsive CSS rules, and build checks; no form was submitted.
