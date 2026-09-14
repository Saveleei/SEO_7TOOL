# Shipping reliability and admin controls — 2026-09-14

## Scope

- Branch: `codex/shipping-reliability-admin`
- Base: `1f75eba`
- Application: `design-exploration/staging-pilot`
- Goal: fail-safe freshness protection for shipping promises plus an administrator-controlled cutoff, work calendar and emergency switch.

## Safety boundaries

- No production or test deployment in this task without a new explicit approval.
- No external form submission, email, MAX or CRM delivery.
- Existing catalog and quote data remain intact.

## Discovery

- The storefront snapshot `7tool-source/src/lib/products.json` has no embedded feed completion timestamp.
- Its latest Git change is `f93d23f` from 2026-08-26, so the current snapshot cannot safely support a same-day shipping promise.
- The source feed refresh already writes `completedAt` to a separate operational state file, but that timestamp is not coupled to the JSON snapshot consumed by this storefront.

## Implementation

- Added a feed-snapshot sidecar (`catalog-snapshot-meta.json`) that is published atomically only after a successful catalog refresh. The storefront no longer treats an unversioned or old snapshot as current stock.
- Centralized the availability/shipping matrix for the selected execution:
  - exact `available && quantity > 0` plus a fresh snapshot, enabled promise, working day and time before the cutoff -> `В наличии · Отгрузка сегодня`;
  - the same confirmed stock after the cutoff, on a weekend or configured holiday -> the next working day with a concrete date;
  - missing, stale, future-dated or corrupt freshness data, disabled promise and all non-confirmed stock states -> `Наличие и срок уточняем` without an invented warehouse promise.
- Propagated the same server result into catalog cards, search, product variants, product buy box, quote/cart copy and stock filtering. The `В наличии` filter is disabled when freshness cannot be proved, preventing an apparently empty or misleading catalog.
- Added persistent administrator settings with atomic writes and optimistic revisions:
  - emergency on/off switch;
  - Moscow cutoff hour;
  - maximum feed age;
  - working weekdays;
  - holiday exclusions;
  - read-only live freshness diagnostic.
- Added the protected administrator page `/test/settings/shipping` and API `/api/shipping-settings`; both use the existing role/capability, same-origin, size and rate-limit controls.
- Extended environment templates and the isolated test process configuration. A supplier-specific promise is intentionally not inferred from `brand`; future multi-supplier control requires a real `supplier_id` in the feed.
- Fixed the mobile staff-navigation alignment discovered during the responsive browser pass.
- Added regression coverage for cutoff boundaries, Moscow time, weekends, holidays, fresh/stale/missing/future timestamps, emergency shutdown, corrupt settings, persisted administrator changes and protected API access.

## Verification

- Focused shipping/settings tests: **15/15 passed**.
- Full application tests: **168/168 passed**.
- Full ESLint: **passed**.
- Production build (`vinext build`): **passed**; the new API and administrator route are included.
- Release-candidate smoke test: **48/48 passed**, including anonymous redirect and authenticated local access to the new settings page. The smoke suite performs no customer, quote or delivery writes.
- Browser verification:
  - desktop administrator page, including local save/restore of the emergency switch;
  - 390 x 844 mobile administrator page and corrected navigation overflow;
  - stale/unknown snapshot product and category: no same-day promise and no misleading in-stock filter;
  - explicitly fresh local snapshot: same-day promise before the cutoff and fresh-stock filter are restored.
- `git diff --check`: passed (only repository line-ending notices).
- No external customer form, email, MAX or CRM send was performed.

## Local preview

- Safe fail-closed release candidate: `http://127.0.0.1:3197/`
- Shipping administration: `http://127.0.0.1:3197/test/settings/shipping`
- Category state: `http://127.0.0.1:3197/catalog/category/borfrezy`

The checked-in snapshot deliberately has `status: unknown` and no completion timestamp. Therefore this preview correctly shows `Наличие и срок уточняем`. A successful feed refresh publishes the matching completion timestamp and automatically enables the configured shipping matrix.

## Commit

- Implementation: `8b5e943` (`feat: guard shipping promises with feed freshness`)
