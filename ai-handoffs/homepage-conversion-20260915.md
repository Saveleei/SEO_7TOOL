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

Complete and deployed only to the isolated `test.7tool.ru` storefront.

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

## Test deployment — 2026-09-21

- Explicit user approval received to publish only to `test.7tool.ru`.
- Deployed branch head: `78b0087`; specification-upload implementation: `28a2215`.
- Active release: `/var/www/7tool-release-20260921-spec-upload-78b0087`.
- Preserved rollback release: `/var/www/7tool-release-20260915-homepage-editor-a0c662b`.
- Persistent data remains `/var/www/7tool-test-shared/quote-requests`; pre-release backup: `/var/www/7tool-test-shared/backups/quote-requests-before-78b0087-20260921.tar.gz`.
- The dependency lock matched the active test release exactly, so the existing immutable `node_modules` tree was reused.
- The first candidate archive intentionally contained only the storefront, which exposed the missing sibling feed snapshot during server tests. The candidate was not activated. The exact catalog snapshot and metadata were copied from the active release after SHA-256 equality with the checked-in files was confirmed; the repeated server suite then passed 195/195.
- Server verification: 195/195 tests, full ESLint and production build passed. The protected attachment route is present in the build.
- Candidate smoke on port 3199 and post-switch smoke on port 3000 both passed 58/58 checks. The matrix performs no customer/quote/delivery write actions.
- `7tool-storefront-test` runs from the new release with zero restarts. The temporary candidate process and upload archive were removed; the PM2 process list was saved.
- External HTTPS gate returns the expected `401` Basic Auth challenge; `https://7tool.ru/` remains `200`.
- In-app visual access was blocked by stale Basic Auth credentials (`ERR_INVALID_AUTH_CREDENTIALS`); the deployed artifact passed the complete loopback public/staff route matrix instead.
- External email, MAX and CRM delivery remains disabled. No customer request or external message was sent.
- Post-release disk capacity: approximately 2.1 GB free. Production, DNS, Nginx, credentials, feeds and migrations were not changed.
