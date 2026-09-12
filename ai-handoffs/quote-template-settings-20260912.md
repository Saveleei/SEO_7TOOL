# Quote template settings - handoff

- Agent: Codex
- Branch: `codex/quote-template-settings`
- Base: `4789abb`
- Status: complete

## Goal

Add a local, server-validated administrative workspace for seller requisites, authorised quote senders, default commercial terms and the reusable stamp/signature asset. New quote drafts must snapshot those settings so historical revisions do not change retroactively.

## Owned scope

- `design-exploration/staging-pilot/app/data/quote*`
- `design-exploration/staging-pilot/app/api/quote-settings/`
- `design-exploration/staging-pilot/app/test/settings/`
- `design-exploration/staging-pilot/app/test/requests/[id]/quote/`
- `design-exploration/staging-pilot/app/ui/`
- `design-exploration/staging-pilot/app/globals.css`
- `design-exploration/staging-pilot/tests/`
- this handoff

## Acceptance criteria

- Settings are available only in explicit local test mode and persist server-side, not in browser storage.
- Requisites, senders and template defaults are strictly validated and saved atomically.
- Stamp/signature uploads are bounded and signature-checked; no SVG or document uploads.
- A new quote snapshots the current settings, while saved historical revisions remain unchanged.
- Existing per-quote edits and request-specific stamp replacement keep working.
- Responsive settings and quote layouts are covered structurally; the local route and API are smoke-checked without submitting external forms.
- Narrow tests, full ESLint, full test suite and production build pass.
- No production, deployment, credentials, external messages or live services are touched.

## Checks

- Changed-file ESLint: passed.
- Focused quote settings, builder, approval and PDF tests: 21/21 passed.
- Full ESLint: passed.
- Full test suite: 71/71 passed.
- Production build: passed; `/test/settings/quote` and all three `/api/quote-settings` routes are present.
- Local smoke check: `/test/settings/quote` returned HTTP 200; `/api/quote-settings` returned the expected default server settings.
- PDF QA: default and complete-bank-details variants render as two A4 pages; both pages were visually inspected at 150 DPI, with no clipping or overlaps. The final PDF has no JavaScript and is not encrypted.
- No external delivery call, production service, deployment, credentials or live data were changed.

## Local preview

- Settings: `http://127.0.0.1:3176/test/settings/quote`
- Final sample PDF: `design-exploration/staging-pilot/output/pdf/7TOOL-KP-template-settings-r1.pdf`

## Commit

Implementation commit pending.
