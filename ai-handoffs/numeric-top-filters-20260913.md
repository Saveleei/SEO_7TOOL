# Numeric top filters — 2026-09-13

- Agent: Codex
- Branch: `codex/numeric-top-filters`
- Base commit: `0f85850`
- Status: implemented and locally verified
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
- Production was not changed.

## Commit

Pending commit and isolated test-host rollout.
