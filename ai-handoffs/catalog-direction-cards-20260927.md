# Catalog direction cards — 2026-09-27

## Ownership

- Agent: Codex
- Branch: `codex/catalog-direction-cards`
- Base: `24d06f5`

## Goal

Turn the six catalog directions from a schematic directory into a denser, more visual and more obvious buyer entry point without changing feed-backed category facts.

## Scope

- Catalog direction-card geometry and imagery
- Clear direction-level navigation and task-selection CTA
- Compact desktop hero spacing
- Desktop, ultrawide and mobile browser QA
- Focused regressions, full tests and build

## Implemented

- The direction heading, supporting image and name form one clear link to the corresponding task-led catalog page.
- The image role is no longer misleadingly tied to the first product category.
- Directions with three categories use three full-width rows instead of an empty fourth grid cell.
- Product imagery is larger and more legible; ultrawide screens use a wider but still centered catalog frame.
- The compact hero reduces empty vertical space before the catalog map.
- The footer action is now the unambiguous `Подобрать по задаче →`.
- Keyboard focus, hover feedback and mobile proportions were preserved and strengthened.

## Verification

- Focused regressions: `10/10` passed.
- ESLint on changed source and tests: passed.
- Full test suite: passed (exit code 0).
- Catalog presentation generation: passed, 24 categories.
- Production build: passed.
- `git diff --check`: passed; only the repository's existing LF/CRLF notices were reported.
- Browser QA passed at 1920×1080, 3440×1440 and 390×844.
- Browser interaction check confirmed the direction header opens `/catalog/task/drilling` rather than an in-page anchor.

## Status

Implementation complete and ready for review. Not deployed.

- Implementation commit: `e648b18`
