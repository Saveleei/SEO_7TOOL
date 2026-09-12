# Quote approval workflow — handoff

- Agent: Codex
- Branch: `codex/quote-approval-workflow`
- Base: `d6fc6e5`
- Status: complete

## Goal

Add a safe local approval workflow after quote preparation: preflight verification, append-only stage history tied to an immutable quote revision, version-specific print preview, and preparation of an email/MAX/Telegram delivery package without external sending.

## Owned scope

- `design-exploration/staging-pilot/app/data/`
- `design-exploration/staging-pilot/app/api/quote-requests/`
- `design-exploration/staging-pilot/app/test/requests/`
- `design-exploration/staging-pilot/app/ui/`
- `design-exploration/staging-pilot/app/globals.css`
- `design-exploration/staging-pilot/tests/`
- this handoff file

## Acceptance criteria

- Workflow is append-only and tied to one exact quote revision plus a server-calculated content fingerprint.
- A quote cannot be submitted for approval until all preflight checks are explicitly confirmed.
- Only a submitted revision can be approved; only an approved revision can be prepared for delivery.
- Preparing delivery records the selected channel and recipient snapshot but sends nothing externally.
- Preview can render an explicit historical revision, not only the latest draft.
- Desktop and mobile flows are readable and keyboard-accessible.
- Tests, lint, build, and local browser QA pass.
- No production, deployment, external send, credentials, or live services are touched.

## Checks

- Targeted approval + quote tests: 11/11 passed.
- Full test suite: 61/61 passed.
- Full ESLint: passed.
- Production build: passed; `/api/quote-requests/:id/quote-approval` included.
- Browser QA: complete local flow on desktop and 390 × 844 mobile viewport; fixed revision preview checked at normal desktop viewport.
- Local QA request: `7T-20260912-6714C3` (synthetic contacts only).
- No external email, Telegram, MAX or CRM calls were made.

## Implementation notes

- Approval events are appended to `quote-approval-events.jsonl`; idempotency keys are stored only as SHA-256 hashes.
- Every event snapshots the request ID, quote ID, exact revision and server-calculated quote fingerprint.
- Workflow: preflight submitted → approved or changes requested → delivery prepared.
- Delivery preparation stores only the intended channel, recipient, subject and future PDF file name. It does not create or send a PDF.
- The print view accepts an explicit `revision` query and shows the workflow status plus the content fingerprint.
- Production still requires authentication/RBAC, persistent database/object storage and a transactional outbox before any real customer delivery is enabled.

## Commit

- Feature: `d0f52b6` (`feat: add quote approval workflow`)
- Handoff update: included in the branch tip.

## Local preview

- Quote workspace: `http://127.0.0.1:3174/test/requests/7T-20260912-6714C3/quote#quote-approval`
- Fixed approved preview: `http://127.0.0.1:3174/test/requests/7T-20260912-6714C3/quote?mode=preview&revision=1`
