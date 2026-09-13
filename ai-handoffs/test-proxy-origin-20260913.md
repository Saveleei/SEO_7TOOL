# Test proxy origin — 2026-09-13

- Agent: Codex
- Branch: `codex/test-proxy-origin`
- Base commit: `a39ec13`
- Status: complete and released to the isolated test host
- Goal: make the protected test-host administrator session and same-origin staff actions work correctly behind the existing HTTPS reverse proxy without weakening CSRF protection.
- Evidence: Nginx accepted Basic Auth and served `/test/access`, but every browser POST to `/api/manager-auth/session` returned 403 because the application compared the external HTTPS Origin with its internal HTTP request origin.
- Owned files: shared request-origin validation, manager session route, affected same-origin API routes, focused regression/release tests, and this handoff.
- Completion criteria: external `https://test.7tool.ru` proxy headers are accepted only when Origin matches the effective protocol and host; cross-origin and malformed inputs remain rejected; local loopback tests keep working; protected page opens after the administrator button; full checks and isolated test-host smoke pass; production remains untouched.

## Checks

- Root cause confirmed in the test Nginx access log: authenticated browser traffic reached `/test/access`, while `POST /api/manager-auth/session` returned 403 because external `Origin: https://test.7tool.ru` was compared with the internal HTTP request origin.
- Shared origin validation now accepts only the internal origin or the effective `X-Forwarded-Proto` + `Host` origin. It intentionally ignores `X-Forwarded-Host`, rejects malformed/cross-origin input, and requires an Origin for administrator sign-in and sign-out.
- The same proxy-aware check is reused by quote settings, stamp, request workflow, draft, approval, assets, events, and delivery actions so the administrator does not fail after login.
- The administrator session cookie derives `Secure` from the effective external HTTPS request.
- Local full suite: 131/131 tests passed; full ESLint passed; `vinext build` passed.
- Server release: 131/131 tests passed; full ESLint passed; `vinext build` passed.
- Candidate smoke on port 3198: 46/46 read-only checks passed.
- Active test smoke on port 3000: 46/46 read-only checks passed.
- Active proxy simulation: login 200, Secure cookie present, `/test/catalog-quality` 200 with an administrator session, malicious Origin 403.
- External HTTPS: unauthenticated `https://test.7tool.ru/test/catalog-quality` returns the expected Basic Auth 401; `https://7tool.ru/` returns 200.
- PM2: `7tool-storefront-test` online with 0 restarts from the new release; `7tool-prod` remains online on `/var/www/7tool-release-20260911-trust-performance-029d3f3/7tool-source`.
- Capacity after release: 5.9 GB disk available; about 2.0 GiB memory available.
- No customer forms, quote delivery, production service, DNS, credentials, or live integrations were changed or exercised.

## Commit

- Implementation: `44e1962` (`fix: support secure manager access behind proxy`)
- Test release: `/var/www/7tool-release-20260913-proxy-origin-44e1962`
- Rollback release: `/var/www/7tool-release-20260913-catalog-quality-e87c27c`
