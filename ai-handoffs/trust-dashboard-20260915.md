# Trust content dashboard — 2026-09-15

## Ownership

- Owner: Codex `/root`
- Branch: `codex/trust-dashboard`
- Base: `401a3ac` from `codex/trust-content-pages`
- Application: `design-exploration/staging-pilot`

## Goal

Strengthen the storefront trust section and add an administrator-only dashboard for editing its factual copy and uploading replacement photos without changing source code.

## Implemented scope

- Rebuilt the homepage trust section around a three-step procurement process and three evidence-oriented cards with explicit buyer outcomes.
- Added a typed content model with factual checked-in defaults and safe fallback behavior.
- Added atomic server-side persistence, optimistic revision checks and bounded content-addressed PNG/JPEG/WebP assets (maximum 2 MB).
- Added same-origin, rate-limited administrator settings/upload APIs and a read-only immutable asset endpoint for the public storefront.
- Added `/test/settings/trust`: edit copy and alt text, upload or restore photos, preview changes, save a revision and reset to defaults.
- Added the trust-content workspace to the existing administrator navigation and access-control regression matrix.
- Improved category templates with a live result summary and direct product-list anchor immediately after the promoted filters.
- On mobile, dense promoted filters now use readable horizontal chip rows instead of consuming most of the first viewport.

## Safety boundaries

- Reuse the existing administrator authorization and local persistence conventions.
- Do not expose the dashboard or write APIs to public visitors.
- Validate text lengths, revisions, MIME signatures and upload size server-side.
- Do not invent reviews, certifications, warehouses, customer counts or other trust claims.
- Do not deploy, send forms or modify production services.

## Acceptance criteria

- Public trust blocks read their text and photos from one server-side source of truth with safe defaults.
- An administrator can edit the section and three cards, upload/replace photos, preview changes and restore defaults.
- Concurrent edits are revision-protected and every write is same-origin and authenticated.
- Broken or missing saved data fails back to the checked-in default content.

All acceptance criteria are met in the local test implementation.

## Verification

- Implementation commit: `3289459` (`feat: add editable trust dashboard`).
- Focused regressions: 20/20 passed (`category-contact-flow` and `trust-content-settings`).
- Full lint: passed.
- Full test suite: 182/182 passed.
- Production build: passed.
- Release smoke matrix: 56/56 checks passed, including public routes, anonymous redirects and authenticated administrator workspaces.
- Desktop and mobile browser QA completed for the homepage, burr category, pipe-beveler category and trust dashboard.
- Verified that a promoted pipe-diameter filter updates the URL, result count and product guidance.
- Verified protected dashboard redirect, local administrator sign-in and a same-content save producing revision 1.

No public form was submitted and no external delivery was triggered.

## Local preview

- Storefront: `http://127.0.0.1:3210/`
- Category: `http://127.0.0.1:3210/catalog/category/borfrezy#products`
- Trust dashboard: `http://127.0.0.1:3210/test/settings/trust`

## Operational note

The current application architecture persists settings and uploaded images under the existing local `work/quote-requests` data root. This is suitable for the current VPS/test setup. A future migration to stateless hosting must move this content and its backup policy to durable object/database storage before production.

## Status

Complete. Not deployed.
