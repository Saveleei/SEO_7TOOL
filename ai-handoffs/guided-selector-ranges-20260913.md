# Guided selector ranges — 2026-09-13

- Agent: Codex
- Branch: `codex/guided-selector-ranges`
- Base commit: `72660ce`
- Status: implemented and locally verified
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

## Commit

Pending commit and isolated test-host rollout.
