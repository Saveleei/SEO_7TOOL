# Quote product presentation — handoff

- Agent: Codex
- Branch: `codex/quote-product-presentation`
- Base: `8fa26e0`
- Status: in progress

## Goal

Improve the local commercial quote builder without touching production: add a feed-backed photo and category-aware key specifications for the exact selected variant, plus configurable sender fields and an optional approved stamp/signature image.

## Owned scope

- `design-exploration/staging-pilot/app/data/`
- `design-exploration/staging-pilot/app/test/requests/`
- `design-exploration/staging-pilot/app/api/quote-requests/`
- `design-exploration/staging-pilot/app/globals.css`
- `design-exploration/staging-pilot/tests/`
- this handoff file

## Acceptance criteria

- Product photo and specifications are derived server-side from the exact feed variant; client input cannot substitute them.
- The quote shows a compact set of decision-critical specifications and a readable technical appendix without invented values.
- Sender name, role, phone, and email are configurable and snapshotted per quote revision.
- Stamp/signature upload is optional, local-only, restricted to safe raster formats and a small file size, and can be excluded from the document.
- Desktop and mobile quote/editor layouts remain readable; print styling remains usable.
- Relevant tests, full test suite, lint, and build pass or unrelated baseline failures are recorded.
- No external form submission, deployment, production service, DNS, secret, or live feed publication is performed.

## Checks

Pending.

## Known limitations

Pending implementation review.

## Commit

Pending.
