# Homepage content editor — 2026-09-15

## Ownership

- Owner: Codex `/root`
- Branch: `codex/homepage-editor`
- Base: `34d7325` from `codex/trust-dashboard`
- Application: `design-exploration/staging-pilot`

## Goal

Let an administrator safely edit the homepage hero, assortment map and primary catalog-section presentation, including uploading and replacing imagery, while enforcing stable responsive image frames and preserving factual feed-backed navigation and counts.

## Implemented scope

- Added a server-side homepage content source of truth with safe checked-in defaults and atomic local persistence.
- Added administrator-only, same-origin, rate-limited settings and image-upload APIs.
- Added `/test/settings/homepage` and the `Главная` administrator navigation item.
- The dashboard edits the hero, assortment-map headings, primary-category headings and task-selection headings.
- Each of six assortment directions and six primary catalog sections supports title, alt text, uploaded photo, contain/cover fit, five focal positions and up/down ordering.
- Catalog URLs and feed-backed counts remain fixed and cannot be broken by editorial changes.
- Uploaded PNG/JPEG/WebP assets are content-addressed, signature-checked, limited to 2 MB and fall back to the catalog image when missing.
- The public homepage now reads the saved settings and applies responsive fit/position attributes.
- Replaced the irregular primary-category mosaic with six equal cards: 216 px desktop, 190 px tablet and 142 px mobile.
- Normalized assortment-map cards to 120 px desktop and 132 px mobile with bounded title lines.
- Added a mobile-first editor flow with a sticky save action before the form and the detailed preview after the editable fields.

## Safety boundaries

- Category destinations and feed-backed product counts remain code/data controlled; the editor cannot create broken arbitrary catalog URLs.
- Uploaded PNG/JPEG/WebP files are signature-checked, bounded and served through content-addressed identifiers.
- Reuse existing administrator authorization, rate limiting and local persistence conventions.
- Do not deploy, submit forms, send leads or change live services.

All safety boundaries were preserved.

## Verification

- Implementation commit: `609c355` (`feat: add editable homepage content`).
- Focused homepage regressions: 10/10 passed.
- Full lint: passed.
- Full test suite: 187/187 passed.
- Production build: passed; homepage settings and asset routes are present in the output.
- Release smoke: 58/58 checks passed on `http://127.0.0.1:3213`.
- Browser QA completed for desktop and 390 × 844 mobile homepage and dashboard.
- Browser interaction verified that `contain`/`cover` updates the live preview and up/down controls change and restore ordering.
- Measured layout: all six primary tiles are exactly 216 px desktop / 142 px mobile; all six assortment cards are exactly 120 px desktop / 132 px mobile; no horizontal overflow.

No file was uploaded through the browser, no public form was submitted and no external delivery was triggered. Upload content/signature/fallback behavior is covered by automated tests.

## Local preview

- Storefront: `http://127.0.0.1:3213/`
- Homepage dashboard: `http://127.0.0.1:3213/test/settings/homepage`
- Trust dashboard: `http://127.0.0.1:3213/test/settings/trust`

## Operational note

The current VPS/test architecture stores homepage JSON and uploaded images under the existing local `work/quote-requests` data root. Before a future stateless hosting migration, move these settings and assets to durable database/object storage with backups.

## Status

Complete. Not deployed.
