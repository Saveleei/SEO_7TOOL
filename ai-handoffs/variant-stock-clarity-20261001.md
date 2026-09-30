# Variant stock clarity and mobile actions

- Agent: Codex
- Branch: `codex/variant-stock-clarity-20261001`
- Base commit: `28de9db`
- Scope: `design-exploration/staging-pilot/` product variant selector, category expanded variants, mobile purchase actions, responsive styles, and focused regression tests.
- Goal: expose every product size immediately, distinguish confirmed in-stock variants from order/unknown variants without false promises, make category size choices scannable, and prevent mobile action labels from clipping.
- Completion criteria: truthful availability state derived from existing feed data; desktop/mobile browser QA; targeted tests, full tests, lint, and production build pass; commit and handoff SHA recorded.
- Constraints: do not change production, `new.7tool.ru`, DNS, feeds, cron, credentials, or send external forms without a separate explicit deployment authorization.
- Status: complete.
- Commit: `9e19b1a` (`feat: clarify catalog sizes and trust imagery`).

## Implemented

- Product pages expose the complete size matrix immediately. Size is the primary label, supplier article remains secondary, and a compact search remains available for long ranges.
- Confirmed positive feed stock is marked with a green border and dot. Unknown/order states use a neutral dashed treatment and do not receive a false stock promise.
- Category card and table variants now lead with buyer-facing size or the category decision value. Exact-position actions use the shorter readable label `Добавить в КП` on desktop and mobile.
- Mobile action controls wrap safely and preserve a 44–48 px target instead of clipping the label.
- Homepage task cards now expose direct links to the nearest product categories on desktop, while retaining a compact hierarchy on mobile.
- Trust photography uses six distinct existing photographs: warehouse overview, separated storage, pallet storage, employee picking, loading into a transport-company vehicle, and tooling storage. Captions are kept on a separate readable surface instead of over the photograph.
- Catalog/menu and task imagery retains the whole equipment silhouette through `object-fit: contain` and stable frames.

## Verification

- Focused regression suite: 36/36 passed.
- Full test suite: 335/335 passed.
- ESLint for all changed source and test files: passed.
- Full project ESLint: passed.
- Vinext production build: passed; 24 catalog categories generated.
- Local server HTML smoke: homepage and product page returned content; 49 size states rendered; full-range copy present; obsolete `Добавить позицию` label absent.
- Desktop visual QA completed for homepage, expanded catalog menu and direct task/category navigation. Browser inspection confirmed complete, uncropped catalog media and distinct trust photographs. Responsive behavior is additionally covered by focused CSS/contract tests.

## Safety

- The user subsequently authorized deployment of this exact verified version to `new.7tool.ru`.
- No DNS, feed, cron, credential, production, `test.7tool.ru`, or `7tool.ru` change was made.
- No form or external delivery was triggered.

## New storefront release

- Published branch head `02bb46c`; implementation remains `9e19b1a`.
- Immutable application: `/var/www/7tool-release-20261001-variant-stock-02bb46c-r2/design-exploration/staging-pilot`.
- Stable pointer: `/var/www/7tool-new-current`.
- Retained rollback: `/var/www/7tool-release-20260930-catalog-trust-11a9217/design-exploration/staging-pilot`.
- Release archive SHA-256: `994b52f908fd011f999eac3d577f8cd383dcb329d265c9ddd3a0b3f60238eebc`.
- Server gate: full ESLint passed; 335/335 tests passed; feed-backed presentation regeneration and Vinext production build passed; a separate port-3259 candidate passed 50 read-only public/anonymous-access checks and the exact 49-size product assertion before cutover.
- The stored automation credential no longer matches the current manager password hash, so the authenticated portion of the route smoke was not bypassed or weakened. Administrator access remains covered by the full regression suite; the live check verified all anonymous staff redirects. No credential was changed.
- `7tool-storefront-new` is online with one deliberate release restart (`3` total historical restarts, `0` unstable restarts) and remained stable for nine minutes after cutover.
- `new.7tool.ru` returns `200`, keeps duplicate `X-Robots-Tag: noindex, nofollow, noarchive`, and `robots.txt` disallows crawling.
- Desktop browser QA at 1440×900: no horizontal overflow; six production-task cards expose 25 direct category links; six distinct trust photographs load at their real dimensions.
- Mobile browser QA at 390×844: no horizontal overflow; all 49 size tiles render, with 27 feed-confirmed available variants and 22 neutral unconfirmed variants; visible `Добавить в КП` controls have 46–49 px targets and no text overflow.
- Quick-order dialog opened on the live product page with required phone and default consent, then closed without submission.
- The existing Vinext `Premature close` static-stream warning was reproduced by aborted browser/curl asset reads; the process remained online without an unstable restart.
- Production `7tool-prod` remains online on `/var/www/7tool-release-20260911-trust-performance-029d3f3/7tool-source`, with its pre-existing restart count `4`; `https://7tool.ru/` returns `200`.
- Approximately `4.4 GiB` remained free after deployment.
