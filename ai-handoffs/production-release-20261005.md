# Production release — 2026-10-05

- Agent: Codex
- Branch: `codex/production-release-20261005`
- Base: `f4cf5d93fd714a5cba2b18be20c2d1d1cad5ca0a`
- Application: `design-exploration/staging-pilot/`

## Goal

Promote the already accepted responsive storefront candidate to `7tool.ru` with an atomic nginx cutover, keep the legacy `/api/lead` bridge on port `3108`, preserve rollback, and verify the public production funnel.

## Scope

- Re-run the production-critical regression, full tests, lint and build from the frozen source.
- Reconfirm the loopback candidate on port `3244` and its production configuration without exposing secrets.
- Back up and update only the active `7tool.ru` nginx server configuration.
- Route exact `/api/lead` to legacy port `3108`; route storefront and static traffic to candidate port `3244`.
- Validate and reload nginx, then run read-only public production acceptance.
- Keep the legacy process and release available for immediate nginx-only rollback.
- Install or confirm the production-owned nightly feed pipeline only when its target paths and dry-run are verified.

## Acceptance criteria

- Production-critical tests, full tests, ESLint and production build pass.
- Candidate has zero unstable restarts and key loopback routes pass.
- `nginx -t` passes before and after the cutover.
- Homepage, catalog, category, product, search, comparison, public information, robots and sitemap routes pass on `https://7tool.ru`.
- Production is indexable and Yandex Metrica is present only through the privacy-safe integration.
- Exact `/api/lead` remains on the legacy service during the observation period.
- No external form or lead is submitted during verification.
- Rollback file, old process and old release remain intact.

## Current state

- Legacy production: `7tool-prod`, port `3108`, `/var/www/7tool-current`.
- Accepted candidate: `7tool-prod-candidate-f4cf5d93fd71`, port `3244`, zero restarts at preflight.
- Preview: `7tool-storefront-new`, port `3243`.
- Production cutover is explicitly authorized by the user in the source Codex task.

## Verification and release record

### Local gates

- Browser QA found a repeatable Vinext `beta.3` App Router prefetch exception caused by broken shim chunk exports. Ordinary document navigation still worked, but every link scheduled a rejected prefetch.
- Upgraded only the affected runtime pair: `vinext` `1.0.0-beta.3` → `1.0.0-beta.7` and `@vitejs/plugin-rsc` `0.5.26` → `0.5.34`. `pnpm peers check` reports no issues.
- Added a production-readiness assertion that pins the compatible pair and prevents a silent downgrade.
- Production-critical regression: `18/18` passed before and after the runtime update; the final focused production test is `7/7`.
- Full suite on the final dependency set: `364/364` passed.
- ESLint: `0` errors, one intentional existing warning for the Yandex Metrica noscript pixel.
- Vinext production build: passed; 24 catalog categories generated and all routes emitted.
- Browser QA on the rebuilt local production server: homepage, category, product and exact-model search passed with no console errors, no broken images and no page-level horizontal overflow at desktop or 390 px mobile width.

### Server cutover and production acceptance

To be completed after the final commit is deployed to a fresh loopback candidate and public traffic is switched.
