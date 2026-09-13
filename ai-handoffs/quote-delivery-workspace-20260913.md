# Quote delivery workspace — handoff

## Scope

- Branch: `codex/quote-delivery-workspace`
- Base: `9b33bcf` (`codex/quote-delivery-outbox`)
- Application: `design-exploration/staging-pilot`
- Status: complete
- Feature commit: `c454c36` (`feat: add administrator quote delivery workspace`)

## Goal

Give the administrator one protected workspace for all commercial-proposal packages currently recorded in the internal outbox. The page must support fast search and channel filtering, show an honest held/not-sent state, and provide direct access to the request, quote preview, and PDF without enabling any external transport.

## Acceptance criteria

- The workspace is visible only to a user with `delivery:prepare` permission.
- Summary counts and rows are derived on the server from the append-only outbox and immutable quote/request records.
- Search covers request number, quote number, company, and canonical recipient.
- Filters are URL-backed, bounded, and preserve a useful empty state.
- Each row exposes request, channel, recipient, quote revision, amount, queue time, actor, preview, and PDF.
- Staff navigation exposes the queue only to an administrator.
- No email, Telegram, MAX, CRM, or production action is performed.
- Targeted tests, full lint/tests/build, and local HTTP smoke pass.

## Owned files

- `design-exploration/staging-pilot/app/data/quoteDeliveryStore.ts`
- `design-exploration/staging-pilot/app/test/delivery/page.tsx`
- `design-exploration/staging-pilot/app/ui/PilotHeader.tsx`
- `design-exploration/staging-pilot/app/globals.css`
- `design-exploration/staging-pilot/tests/quote-delivery-workspace.test.mjs`

## Safety boundary

- Local prototype only; no deployment, live migration, credentials, DNS, or Beget changes.
- The queue remains a filesystem-backed prototype. Production migration to D1/R2 and a separately controlled delivery worker remains out of scope.
- No test message or lead may leave the local environment.

## Verification

- Targeted delivery workspace and outbox tests: `7/7` passed.
- Full test suite: `83/83` passed.
- Full ESLint: passed.
- Production build: passed; `/test/delivery` is present as a protected dynamic route.
- Final HTTP smoke:
  - anonymous `/test/delivery`: `307` to staff access;
  - authenticated journal: `200`;
  - email filter: `200`;
  - deliberately empty MAX/search result: `200`;
  - linked quote workspace: `200`.
- Local preview: `http://127.0.0.1:3179/test/delivery`
- Preview data contains one synthetic held package. No form, message, email, Telegram, MAX, CRM, or production action was sent.

## Review notes

- Confirm that the administrator can identify a package without opening it and that recipient data remains confined to the protected page.
- Confirm that the compact staff header is preferable to the public catalog/search header inside the manager workspace.
- Before production, move the structured queue to D1 and document bytes to R2, then add an independently permissioned delivery worker, retry/dead-letter policy, provider event reconciliation, and operational alerts.
