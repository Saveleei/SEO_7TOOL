# Category responsive UX deployment — 2026-09-30

- Agent: Codex
- Branch: `codex/category-responsive-ux-20260930`
- Deployed branch HEAD: `6fa98cc`
- Implementation commit: `5feea57`
- Scope: isolated `new.7tool.ru` storefront only.
- Production rule: `7tool.ru`, its process, DNS, catalog pointer and application data were not changed.

## Release

- Active application: `/var/www/7tool-release-20260930-category-ux-6fa98cc/design-exploration/staging-pilot`.
- Stable pointer: `/var/www/7tool-new-current`.
- Previous rollback release retained: `/var/www/7tool-release-20260929-new-leads-ab96205/design-exploration/staging-pilot`.
- PM2 process: `7tool-storefront-new`, PID `133830`, restart count `0` after the cutover.
- Existing shared root, nightly feed runtime, request data and root-only environment were reused without modification.
- PM2 state was saved for reboot recovery.

## Pre-cutover verification

- Server-side Vinext build passed all five stages.
- Candidate ran separately on loopback port `3247`.
- Candidate home and drilling category returned `200`.
- Release smoke passed **58/58** checks: public routes, anonymous staff redirects, local administrator sign-in and all seven protected staff workspaces.
- No customer form or external delivery action was executed by the smoke.

## External acceptance

- `https://new.7tool.ru/` and the drilling category returned `200`.
- Mobile `390×844` category:
  - 12 product cards rendered;
  - no horizontal overflow;
  - first product starts at approximately 1844 px;
  - fixed `Запрос КП` and the manager avatar do not overlap;
  - manager panel exposes the canonical phone, email, Telegram and MAX with messenger marks.
- Mobile product page:
  - persistent manager control stays above the product buybar;
  - quick order is present;
  - the dialog opens as `Заказать в один шаг`;
  - phone is required and consent is checked by default;
  - the dialog was closed without submission.
- Desktop `1440×900` category is aligned, overflow-free and hides mobile-only controls.
- Public response keeps `X-Robots-Tag: noindex, nofollow, noarchive`; page metadata also remains noindex.

## Operational invariants

- `7tool-storefront-new` remained online after several minutes with `0` restarts.
- `7tool-prod` kept PID `100870`, restart count `3`, and returned `200` throughout the deployment.
- New storefront catalog metadata remains `complete`, completed at `2026-09-30T00:45:14.340Z`.
- `catalogSha256` in metadata matches the active `products.json`: `0656e1c3457d070ca9e068251300796889bb9265c66f9be8bed3bb4ed7e5e736`.
- Approximately `5.1 GiB` remained free after the release.
- Temporary local and remote tar archives were removed; both immutable releases remain available.

## Rollback

Atomically point `/var/www/7tool-new-current` back to the retained previous release and recreate only `7tool-storefront-new` from the unchanged `/var/www/7tool-new-shared/new.env`. Do not change `7tool-prod`, DNS, Nginx, production data or production catalog pointers.
