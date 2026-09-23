# Test gateway returnTo query — handoff

- Agent: Codex
- Branch: `codex/test-gateway-return-to-query`
- Base: `245b3e8` (deployed application head `7603c36`)
- Goal: preserve the complete requested test-domain path, including query parameters, across the HTML login redirect without creating an open redirect.
- Ownership: `design-exploration/staging-pilot/deploy/test.7tool.ru.nginx.conf.example`, focused gateway tests, and the isolated `test.7tool.ru` Nginx server block after backup and validation.
- Safety: production `7tool.ru`, DNS, credentials, feeds, customer data, forms, and external delivery remain unchanged.

## Completion criteria

- Anonymous product URLs keep the selected `variant` inside the local `returnTo` value.
- Multiple query parameters are preserved and URL-encoded safely.
- The application continues to accept only same-origin local return paths.
- Nginx configuration backup exists; `nginx -t` passes before reload; rollback is available.
- Login page, authenticated return flow, application release, PM2 process, production domain, and error logs remain healthy.

## Status

Implementation complete and verified locally. Test-only deployment pending.

## Implementation

- Added an internal application redirect endpoint that accepts the original request only from the isolated preview gateway, validates it with the existing local-path allowlist, and URL-encodes the complete destination.
- Replaced the lossy direct Nginx redirect with an internal `/__7tool_preview_login` proxy. The original `$request_uri` is passed in a header, so `variant`, filters and other query parameters remain one encoded `returnTo` value.
- External URLs, protocol-relative URLs and recursive `/test/access` destinations still fall back to `/`.
- The redirect endpoint is unavailable outside `QUOTE_TEST_MODE` and the exact configured test hostname.
- Added regression coverage for the Nginx wiring, complete multi-parameter return paths, open-redirect rejection, recursive redirects and production-host denial.

## Verification

- Focused gateway/auth tests: 14/14 passed.
- Full suite: 241/241 passed.
- Full ESLint: passed.
- Production build: passed and emitted `/api/manager-auth/redirect`.
- No Nginx, PM2, production, credentials, feed, customer data or external channels changed during local verification.

## Commits

Pending.
