# Quote product presentation — handoff

- Agent: Codex
- Branch: `codex/quote-product-presentation`
- Base: `8fa26e0`
- Status: complete

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

- Targeted `tests/quote-builder.test.mjs`: 6/6 passed.
- Full `node --test tests/*.test.mjs`: 56/56 passed.
- Full ESLint: passed with zero errors and zero warnings.
- `vinext build`: passed; both quote asset API routes and the quote route were emitted.
- Browser desktop QA: editor and print preview verified at 1280 px class viewport.
- Browser mobile QA: editor and preview verified at 390 px; product specifications wrap, totals remain inside the viewport, and actions remain reachable.
- No forms or messages were sent outside the local test contour.
- Local preview: `http://127.0.0.1:3172/test/requests/7T-20260912-A551F5/quote?mode=preview`

## Known limitations

- The stamp/signature image is a user-supplied facsimile. The UI requires an approved company file, but production still needs authentication, roles, and an organizational approval policy.
- Assets are stored in the local test data directory. Production needs durable private object storage, authorization on reads, retention rules, and audit logging.
- Product presentation is snapshotted as feed data in each saved revision; the image URL still points to the feed source rather than an immutable internal media copy.
- PDF remains browser print/save rather than a server-generated immutable signed PDF.
- Legal seller requisites remain intentionally absent until approved production data is supplied.

## Commit

- Feature commit: `222646f`
- Documentation: this handoff is committed at branch HEAD after the feature commit.
