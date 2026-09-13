# Quote delivery outbox — handoff

## Scope

- Branch: `codex/quote-delivery-outbox`
- Base: `153699f` (`codex/manager-access-control`)
- Application: `design-exploration/staging-pilot`
- Status: in progress

## Goal

Add an admin-only internal delivery package and append-only outbox for an approved commercial proposal. The browser must never choose the canonical recipient, document revision, subject, or PDF identity. This stage records a reviewed package in a durable local `held` state and performs no external email, Telegram, MAX, or CRM call.

## Acceptance criteria

- A package can be created only for a `ready` quote revision whose approval state is `delivery_prepared`.
- Channel, recipient, subject, PDF filename, revision, and fingerprint are derived on the server from the stored approval and quote records.
- Admin confirms the recipient, PDF preview, and authority before recording the package.
- The endpoint enforces manager authorization, same-origin requests, body limits, rate limiting, validation, and idempotency.
- One held record exists per request/revision/approved fingerprint even if a different idempotency key is retried.
- Stored state is explicitly `held`; transport is disabled and no external delivery is claimed.
- The quote workspace shows the exact package, status, and audit identity without exposing hidden secrets.
- Narrow tests, lint, full tests, build, and local HTTP smoke pass.

## Owned files

- `design-exploration/staging-pilot/app/data/quoteDeliveryStore.ts`
- `design-exploration/staging-pilot/app/api/quote-requests/[id]/delivery/route.ts`
- `design-exploration/staging-pilot/app/ui/DeliveryOutboxPanel.tsx`
- `design-exploration/staging-pilot/app/test/requests/[id]/quote/page.tsx`
- `design-exploration/staging-pilot/app/globals.css`
- `design-exploration/staging-pilot/tests/quote-delivery-outbox.test.mjs`

## Safety boundary

- No deployment, production migration, DNS, Beget, credentials, or live data changes.
- No test leads or messages are sent outside the local prototype.
- Local filesystem persistence is retained for this isolated prototype. Production requires a durable database/outbox worker, provider credentials, retry/dead-letter policy, and observability before transport can be enabled.

## Verification

Pending.
