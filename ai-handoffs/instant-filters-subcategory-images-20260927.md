# Instant filters and subcategory imagery — 2026-09-27

## Ownership

- Agent: Codex
- Branch: `codex/instant-filters-subcategory-images`
- Base: `e628f7b`
- Implementation commit: `698eb19`

## Goal

Remove avoidable filter confirmation clicks and make catalog imagery explain concrete subcategories instead of ambiguously representing whole production directions.

## Scope

- Automatic application of category filters with desktop/mobile-appropriate behavior
- Stable URL state, result feedback and accessible loading status
- Feed-grounded imagery attached to concrete subcategory links
- Catalog direction-card hierarchy and responsive layout
- Focused regressions, browser QA, full tests and build

## Implemented

- Category checkboxes and selects update the result set automatically after a short 120 ms grouping delay.
- Search and numeric range inputs wait 520 ms after typing stops, avoiding a request for every keystroke.
- Sorting also applies immediately; the redundant `Применить` button was removed.
- The URL remains the source of truth for every selection, so links, refresh and browser history keep the chosen filters.
- Desktop navigation keeps the current scroll position and provides an accessible live update status.
- On mobile the filter disclosure remains open while choices update; a sticky `К товарам · N` button closes it and moves to the results without applying anything a second time.
- Direction-level product photos were removed from the catalog overview because one product cannot explain a whole direction.
- All 24 canonical subcategories now use their own feed-backed representative image, fully contained instead of cropped.
- The catalog container now overrides the framework's 1536 px cap and uses the intended 1840 px frame on ultrawide screens.

## Verification

- Focused filter, image and readability regressions: `15/15` passed.
- ESLint on all changed source and tests: passed.
- Full test suite: passed after the new status copy was aligned with the shared 12 px minimum type scale.
- Catalog presentation generation: passed, 24 categories.
- Production build: passed.
- `git diff --check`: passed; only repository LF/CRLF notices were reported.
- Browser QA passed at 1920×1080, 3440×1440 and 390×844.
- Desktop interaction: one brand, multiple brands, a typed numeric range and sort selection all changed URL and results without confirmation buttons.
- Mobile interaction: the panel stayed open after filtering; `К товарам · 337` closed it and aligned the results at the top of the viewport.
- Catalog image geometry was checked in-browser: image boxes clip safely and every image uses `object-fit: contain`.

## Known environment note

- The local `vinext dev` Workers runtime hit a host access violation. Production build and `vinext start` succeeded and were used for browser QA; this did not affect application checks.

## Status

Implementation complete and ready for review. Not deployed.
