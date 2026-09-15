# Homepage conversion repair — 2026-09-15

## Ownership

- Owner: Codex `/root`
- Branch: `codex/homepage-conversion`
- Base: `097634e` from `codex/homepage-editor`
- Application: `design-exploration/staging-pilot`

## Goal

Repair homepage navigation and readability, replace the ambiguous assortment-map experience with a clearer feed-backed catalog entry, and turn the production-task prototype into an honest, complete lead path with contacts, consent, durable test-mode storage and an explicit confirmation state.

## Safety boundaries

- Keep category destinations and product claims feed-backed.
- Preserve the existing homepage editor and stable responsive media frames.
- Do not send external messages or test leads; test-mode submissions remain local.
- Do not deploy without a separate explicit approval after local acceptance.
- Do not change production, DNS, Nginx, credentials or feeds.

## Status

Complete locally; not deployed.

## Result

- Internal catalog and task links use the reliable document-navigation fallback by default. The previously dead homepage task card now opens its real task route.
- The abstract assortment map was removed from the public homepage. The first screen now contains six feed-backed product sections with images, counts and direct category destinations; production-task navigation follows below it.
- Homepage typography was raised on catalog tiles, navigation, trust cards, footer and the selection workbench. Primary actions use the restrained dark action color.
- The selection workbench is now an explicit two-step journey: preliminary direction, clear “not sent yet” state, phone-first contact step, consent, loading/error/success states and a real request number.
- Selection requests are durably stored through the existing same-origin, rate-limited test API without requiring an invented email address. The manager journal distinguishes selection requests from quote requests and handles a missing email safely.
- The broken trust link `/documents` now points to the existing `/warranty` route.
- Workbench tabs expose proper tab semantics and focus moves to the phone input when the contact step opens.

## Verification

- Focused regression suite: 27/27 passed.
- Full `pnpm test`: 191/191 passed.
- `pnpm run lint`: passed.
- `pnpm run build`: passed.
- Browser desktop check at `http://127.0.0.1:3214/`: passed.
- Browser task-card transition to `/catalog/task/drilling`: passed.
- Local form submission: request `7T-20260915-FA9A2E` was created and reached the protected manager sign-in route; the temporary request data was then removed.
- All internal homepage destinations returned HTTP 200, including `/warranty`.
- Responsive CSS retains one-column workbench/contact layouts and two-column compact category tiles at the mobile breakpoint; relevant responsive regressions are covered by the suite.

## Commit

Implementation commit: `a01c1c5` (`feat: repair homepage conversion journey`).
