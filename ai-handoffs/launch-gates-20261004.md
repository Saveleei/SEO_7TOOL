# 7TOOL launch gates — 2026-10-04

## Decision

The responsive release on `new.7tool.ru` has passed the functional, lead-delivery, feed and privacy-safe event gates. It is not yet authorized for production cutover. The remaining release blocker is human visual acceptance on real desktop and mobile widths; the in-app browser runtime failed before opening a page (`kernel assets`, `os error 3`).

Production `7tool.ru`, DNS, credentials and secrets were not changed.

## Current immutable points

- New release: `/var/www/7tool-release-20261004-baymard-responsive-bd4632d/design-exploration/staging-pilot`.
- New pointer: `/var/www/7tool-new-current`.
- New rollback: `/var/www/7tool-release-20261004-dynamic-comparison-7df6b0d/design-exploration/staging-pilot`.
- New process: `7tool-storefront-new`, port `3243`, PM2 id `27`, online, zero unstable restarts.
- Current production release/pointer: `/var/www/7tool-release-20260911-trust-performance-029d3f3/7tool-source` via `/var/www/7tool-current`.
- Current production process: `7tool-prod`, port `3108`, PM2 id `1`, online, zero unstable restarts.
- Free disk at the gate: approximately `2.2 GiB`; do not create another full release before measuring its projected size and pruning only explicitly superseded preview artifacts.

## Controlled lead gate

- Exactly one request was saved on `new`: `7T-20261004-39957B`.
- It was marked `ТЕСТ ЗАПУСКА — НЕ КЛИЕНТ` and used the 7TOOL contact details, not an invented customer.
- The request entered `queued-production-outbox`.
- The minute worker delivered it once on its first attempt and received target request `7T-20261004-ECB9E2` with HTTP `200`.
- The privacy-safe receipt contains request ids, status, attempt count and HTTP status only.
- The first malformed CLI attempt was rejected before persistence because its item JSON did not validate; it did not create a request.

## Nightly feed gate

- Schedule: every day at `00:45 UTC` (`03:45 Europe/Moscow`).
- Runtime: `/var/www/7tool-new-feed-runtime-current/7tool-source`.
- Latest completed cycle: `2026-10-04T00:45:37.129Z`, exit code `0`, status `complete`.
- Base feed: `18,998` offers, `4,337` catalog products, `18,464` variants.
- Merged catalog SHA-256 recorded by the runtime: `67c1dd90f641066028e75f1cecbf504a8dff18463a65b0d5d83cffd0edd4f3e9`.
- Active generation: `/var/www/7tool-new-shared/catalog-releases/20261004004514-67c1dd90f641`.
- Stalex guard-selected `21` positions, including `15` with confirmed positive stock. The public search returned feed-backed Stalex products with price/photo/warranty and the correct next-working-day shipping promise.
- A single connection refusal immediately after PM2 reload was the first attempt in the scripted 12-attempt health loop. A later retry succeeded and the cycle recorded `complete`; the live process remained online.

## Analytics gate

- `46/46` focused analytics, contact, comparison, product and variant tests passed.
- Allowlisted events include phone, email, Telegram/MAX, filters, product/variant selection, compare, quote and one-click flows.
- Event context is limited to placement, page type, product/variant/category and bounded counters. Phone, email, names, free text and search text are stripped.
- The new application currently writes the safe events to `window.dataLayer` but does not load an analytics collector.
- The existing production site publicly uses Yandex Metrica counter `109097461` with ecommerce `dataLayer`. Carry this counter into the production candidate through an explicit environment/config integration; do not enable it on the noindex preview unless preview traffic is intentionally filtered.

## Visual acceptance checklist

Check `https://new.7tool.ru/` at `360`, `390`, `768`, `1366` and `1920` CSS pixels:

1. Header/menu open and closed, search, manager bubble and its close control.
2. Homepage hero, key catalog entries, production-task groups and all six trust photos.
3. Drilling-machine and annular-cutter category: task shortcuts, filter drawer, applied filters, product table/cards and pagination.
4. LZHS product: full size matrix, available/unconfirmed states, price/action row, sticky mobile action and manager contacts.
5. Comparison: product headers, feature rows and repeated commercial action at the bottom.
6. No overlap, clipped copy, horizontal page scroll, cropped evidence photos or inaccessible touch targets.

## Safe production cutover map (not executed)

Do not point `7tool.ru` directly at port `3243`: that process is built for `new.7tool.ru`, has `QUOTE_TEST_MODE=1`, `SEO_INDEXING_ENABLED=0` and preview-specific data paths.

1. Freeze the accepted Git SHA and catalog generation. Record the existing production process PID/restart count and copy the active nginx config to a timestamped rollback file.
2. Build a separate immutable production candidate from the accepted source with `NEXT_PUBLIC_SITE_URL=https://7tool.ru`, `SEO_INDEXING_ENABLED=1`, `QUOTE_WORKSPACE_ENABLED=1`, `QUOTE_TEST_MODE=0` and a durable production quote directory. Keep secrets outside the release.
3. Load the existing Yandex Metrica id `109097461` only in the production build. Confirm that the privacy-safe `dataLayer` contract remains unchanged.
4. Start the candidate as a separate PM2 app on an unused loopback port (planned `3244`). Do not stop `7tool-prod` on `3108`.
5. Run loopback checks for homepage, search, representative categories/products, variants, comparison, robots/sitemap, same-origin request validation and the active catalog SHA. Do not submit another external request unless separately authorized.
6. Preserve `location /api/lead` on the legacy upstream `127.0.0.1:3108` during the first cutover. The new request outbox currently posts to `https://7tool.ru/api/lead`; routing the endpoint into the new app would break the bridge or recurse. Route the remaining storefront traffic to the production candidate.
7. Validate nginx configuration, reload nginx, and check public HTTP/security/SEO headers plus the top conversion routes. Keep both PM2 processes alive for the observation window.
8. Rollback is nginx-only: restore the saved config or return the storefront upstream to `127.0.0.1:3108`, validate and reload. No database rollback is required because the old process and release remain intact.
9. Retire the legacy process only after the lead adapter no longer depends on its `/api/lead` route and after a separately approved retention period.

## Go / no-go

- Functional routes/data: **GO**.
- One controlled request and delivery: **GO**.
- Nightly base + Stalex refresh: **GO**.
- Privacy-safe event contract: **GO**.
- External analytics collector in the production candidate: **PENDING**.
- Human multi-width visual acceptance: **PENDING / release blocker**.
- Production cutover: **NOT AUTHORIZED and not executed**.
