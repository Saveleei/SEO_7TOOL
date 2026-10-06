# Quote attachment direct download — 2026-10-07

## Scope

- Replace the notification link to the authenticated staff workspace with a signed, expiring direct-download link for every uploaded requisites/specification file.
- Keep private storage private: no file-system path is exposed and every URL is bound to the lead, file index, file identity and expiry.
- Render clickable direct links in both email and MAX notifications.

## Safety design

- Dedicated `LEAD_ATTACHMENT_LINK_SECRET` of at least 32 characters.
- Default lifetime: 7 days; configurable up to 30 days.
- Constant-time HMAC-SHA256 verification.
- Download responses are attachments with `no-store`, `nosniff`, `no-referrer` and `noindex` headers.
- Invalid, expired or modified links fail with the same 404 response.
- Downloads use signed query parameters on the already-routed exact `/api/lead` endpoint, so the production Nginx split continues to send both submission POSTs and attachment GETs to the legacy lead service without a configuration change.

## Status

- Implementation and local acceptance complete.
- Production deployment is not authorized in this task yet.

## Verification

- Focused attachment and lead tests: 13/13 passed.
- ESLint for all changed source and tests: passed.
- Next.js production build: passed; only the three pre-existing repository warnings remain.
- HTTP integration against the production build and an isolated test database:
  - a valid signed URL returned `200`, `Content-Disposition: attachment`, the exact filename, `no-store`, `nosniff` and `noindex`;
  - a changed file identity and a missing signature both returned `404`.
- Full repository suite: 188/191 passed. The three failures are pre-existing on base commit `e47eeb7` and were reproduced unchanged there: one absent reviewed magnetic-drill SEO profile and two stale editorial approval checksums.

## Production prerequisite

- Generate and store a dedicated `LEAD_ATTACHMENT_LINK_SECRET` with at least 32 random characters in the legacy lead-service environment before restart.
- No database migration and no Nginx change are required.
