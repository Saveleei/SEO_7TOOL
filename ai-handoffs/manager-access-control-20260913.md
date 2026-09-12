# Manager access control - handoff

- Agent: Codex
- Branch: `codex/manager-access-control`
- Base: `4b2b363`
- Status: complete

## Goal

Protect the local manager workspace with server-side authentication and role-based authorization. The administrator must be allowed to perform every staff action, while manager and approver roles receive only the minimum relevant capabilities.

## Owned scope

- `design-exploration/staging-pilot/app/data/managerAccess*`
- `design-exploration/staging-pilot/app/api/manager-auth/`
- staff-only quote request and quote settings API routes
- `design-exploration/staging-pilot/app/test/`
- manager header/session UI and related styles
- focused authorization tests
- this handoff

## Acceptance criteria

- Anonymous users cannot read staff pages, settings, PDFs, uploaded stamps or mutate staff workflow APIs.
- Local demo sign-in works only in explicit quote test mode on a loopback host and creates an HttpOnly same-site cookie.
- Hosted identity is read only from platform-authenticated headers and mapped through explicit server-side email allowlists.
- The administrator has every declared capability, including settings, request workflow, quote editing, approval, PDF access and delivery preparation.
- Approval actor identity is taken from the authenticated server context, not trusted from the browser payload.
- Public catalog and customer quote-request submission remain available.
- No production deployment, credential change or external delivery occurs.
- Focused tests, full lint, full tests and production build pass.

## Checks

- Focused authorization, manager workflow, quote settings, quote builder, approval and PDF tests: 30/30 passed.
- Full ESLint: passed.
- Full test suite: 76/76 passed.
- Production build: passed; `/test/access` and `/api/manager-auth/session` are present alongside all protected staff routes.
- Local smoke checks on `http://127.0.0.1:3177`: anonymous settings page redirects to `/test/access`; anonymous settings API returns 401; signed-in administrator opens settings and request journal with HTTP 200.
- Public customer quote-request API remains outside staff authorization.
- No external delivery, deployment, production service, credential or live data was changed.

## Known production prerequisites

- The loopback sign-in is deliberately limited to explicit local test mode. Hosted access must use platform-authenticated headers and the three explicit email allowlists documented in `.env.example`.
- Before a public production rollout, move quote records and session/audit state from the local prototype filesystem to managed persistence and apply the hosting platform access policy.

## Local preview

- `http://127.0.0.1:3177/test/settings/quote`
- Use **Войти как администратор**; the server redirects back to the requested staff page.

## Commit

Implementation commit pending.
