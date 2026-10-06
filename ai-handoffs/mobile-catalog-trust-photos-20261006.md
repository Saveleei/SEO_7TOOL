# Mobile catalogue trust photos — 2026-10-06

## Ownership

- Agent: Codex
- Branch: `codex/mobile-catalog-trust-photos-20261006`
- Base: `7dbcbfc`
- Worktree: `.codex-tmp/mobile-catalog-trust-photos-20261006`

## Goal

Correct the trust-block photo presentation on the mobile catalogue, make product/category/subcategory social previews current and resilient, remove the empty wait state from the category variant picker, and restore reliable quote-request attachment delivery without changing public page URLs, catalogue data, saved settings, or credentials.

## Initial acceptance

- Reproduce the published defect at 320 and 390 px.
- Preserve the complete important content of each trust photo instead of accidental cropping or distortion.
- Keep the block readable, stable, and free of horizontal overflow at 320, 390, 768, and 1440 px.
- Add a focused regression contract, run the relevant tests and production build, then publish only after candidate validation and rollback preparation.
- Give every page-specific social card a content-derived cache revision, deduplicate source-image fetches, and keep a small bounded source cache.
- Show the initial variant choices immediately, prefetch the full list on intent, and reduce the API payload.
- Forward a saved requisites/specification file as multipart data and keep delivery retries idempotent.

## Status

- Production evidence captured: mobile trust photos are forced into a 128 px column; one of three concurrent social-card requests returned 502; production RSS reached about 887 MB; variant API measured 0.30–0.78 s for a 45.9 KB response while the dialog hid its already available initial choices.
- Mobile trust photos now preserve their complete 16:9 content and stack above their copy at narrow widths; 320/390/768/1440 px QA reports no horizontal overflow.
- Variant choices render immediately, the full matrix is prefetched on user intent, and the API emits a slimmer cacheable payload.
- Social metadata URLs now carry a content-derived revision; source images are single-flight cached with a bounded 32-entry cache and immutable revisioned responses.
- Root cause of missing requisites delivery identified: the worker generated an invalid Unicode regular expression by escaping hyphens in an already validated request ID. The validator is fixed and a multipart attachment regression test passes.
- The pending production request ending `AF55E6` was delivered idempotently; one attachment is stored and both email and MAX notification channels are `sent` after one notification attempt.
- Candidate and production publication remain.
