# new.7tool.ru preview deployment — 2026-09-29

## User authorization

The user explicitly authorized deployment to `new.7tool.ru` while requiring the active `7tool.ru` storefront to remain unchanged.

## Isolated runtime

- Release: `/var/www/7tool-release-20260929-new-preview-49ee8f8-feed8413cf1`.
- Stable pointer: `/var/www/7tool-new-current`.
- Shared root: `/var/www/7tool-new-shared`.
- PM2 process: `7tool-storefront-new`.
- Loopback port: `3243`.
- Application PID at verification: `112568`; restart count: `0`.
- PM2 state was saved for reboot recovery.

## Catalog and request safety

- Initial catalog is the reviewed production candidate with SHA-256 `8413cf1ca18a4af0423ff731914e43bac434b71d872a02bdaed348f91387a057`.
- Catalog and quote paths are separate from production and test mutable data.
- Only catalog-media editorial settings/assets were copied from test; test requests, attachments and manager session key were not copied.
- `QUOTE_TEST_MODE=1`, external delivery is disabled and the storefront is `noindex`.
- New credentials and environment are stored root-only under `/var/www/7tool-new-shared`; values are not committed.

## Acceptance

- Vinext build completed successfully.
- Loopback release smoke: `58/58` passed.
- Public catalog, tasks, all 24 categories, product pages, search and comparison returned `200`.
- Anonymous staff routes redirected; all seven staff workspaces opened after local admin sign-in.
- The smoke created no request or outbox files.
- Nginx HTTP vhost for `new.7tool.ru` is enabled and proxies only to `127.0.0.1:3243`.
- Host-header check through Nginx returned `200` with `X-Robots-Tag: noindex, nofollow, noarchive`.

## Active production invariants

- `7tool-prod` stayed on PID `100870`, restart count `3`, and the previous immutable release.
- `https://7tool.ru/` remained HTTP `200`.
- Production DNS, certificate, process, feed cron and application data were not changed.

## Remaining external gate

- `new.7tool.ru` has no DNS record yet; Beget is authoritative for `7tool.ru`.
- Add only `A new.7tool.ru -> 159.194.235.32` in Beget DNS.
- After propagation, issue a certificate dedicated to `new.7tool.ru`, enable HTTPS redirect, run external desktop/mobile smoke and then record the final deployment state.
- The Browser plugin could not connect because its local kernel assets were unavailable; no Beget API credentials were stored on the VPS, so DNS was not changed programmatically.
