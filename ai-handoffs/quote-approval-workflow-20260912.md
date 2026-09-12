# Quote approval workflow — handoff

- Agent: Codex
- Branch: `codex/quote-approval-workflow`
- Base: `d6fc6e5`
- Status: in progress

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

Pending.

## Commit

Pending.
