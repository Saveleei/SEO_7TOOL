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

## Specification upload follow-up — 2026-09-21

### Result

- The “Передать ТЗ” tab now accepts PDF, DOCX, XLSX, JPG/JPEG and PNG directly, with a 10 MB limit and signature checks instead of routing the customer through email.
- A specification is stored with the local request before confirmation and receives the same request number as the contact data. It is kept distinct from billing requisites.
- The protected manager detail identifies the attachment as a technical specification and exposes an authenticated, no-store download route with a safe filename.
- The header action “Выбрать по задаче” is a native cross-document anchor and reliably opens `/#production-categories` from `/catalog`.
- Mobile workbench tabs now fit the viewport without horizontal page overflow or clipped labels.

### Verification

- Focused specification/access/homepage suite: 19/19 passed before the final mobile CSS regression was added.
- Mobile CSS regression: 3/3 passed.
- Full `pnpm test`: 195/195 passed.
- `pnpm run lint`: passed.
- `pnpm run build`: passed; route `/api/quote-requests/:id/attachment` is present.
- Browser desktop and 390×844 mobile checks: passed; no document-level horizontal overflow after the mobile correction.
- Local end-to-end request `7T-20260921-CBEF3D` confirmed upload, durable request creation, protected manager display and download link. Temporary fixture and request records were removed after verification.
- External email, MAX and CRM delivery remained disabled; no external test lead was sent.

### Commit

Follow-up implementation commit: `28a2215` (`feat: attach specifications to selection requests`).
