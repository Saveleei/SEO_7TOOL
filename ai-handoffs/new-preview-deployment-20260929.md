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

## Public hostname and HTTPS completed

- Beget DNS now contains exactly one `A` record for `new.7tool.ru` pointing to `159.194.235.32`.
- The root `7tool.ru` zone still contains exactly one `A` record pointing to the same existing production server address.
- Authoritative Beget DNS and independent Google and Cloudflare resolvers returned only `159.194.235.32` for `new.7tool.ru`.
- A dedicated Let's Encrypt certificate was issued for `new.7tool.ru`; it expires on `2026-12-28` and Certbot installed automatic renewal.
- Plain HTTP redirects to HTTPS. Public HTTPS returned `200`, valid TLS and `X-Robots-Tag: noindex, nofollow, noarchive`.

## Final external acceptance

- Desktop and `390 x 844` mobile checks passed for the home page.
- Catalog navigation opened `/catalog`; the drilling category displayed product series, availability and `Быстрый заказ` actions.
- The LENZ STEYR-35 product page displayed availability, quote action, quick order and manager contacts.
- Forms were not submitted during acceptance.
- `7tool-storefront-new` remained `online` on PID `112568` with restart count `0`.
- `7tool-prod` remained `online` on PID `100870` with restart count `3`; `https://7tool.ru/` continued to return `200`.
- Nginx configuration validation passed. Approximately `6.1 GiB` remained free on the root filesystem.

## Public preview

- URL: `https://new.7tool.ru/`
- Release commit: `49ee8f8`
- Release path: `/var/www/7tool-release-20260929-new-preview-49ee8f8-feed8413cf1`
- Rollback remains the existing production runtime; no production symlink, process or application data was changed.
