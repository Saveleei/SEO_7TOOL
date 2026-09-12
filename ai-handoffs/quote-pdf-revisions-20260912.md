# Quote PDF and revisions - handoff

- Agent: Codex
- Branch: `codex/quote-pdf-revisions`
- Base: `17cdece`
- Status: implemented and verified

## Goal

Generate a real server-side PDF for one exact approved quote revision and expose a revision register in the local manager workspace. Keep all delivery disabled.

## Owned scope

- `design-exploration/staging-pilot/app/data/quote*`
- `design-exploration/staging-pilot/app/api/quote-requests/`
- `design-exploration/staging-pilot/app/test/requests/`
- `design-exploration/staging-pilot/app/ui/`
- `design-exploration/staging-pilot/app/globals.css`
- `design-exploration/staging-pilot/tests/`
- `design-exploration/staging-pilot/package.json`
- `design-exploration/staging-pilot/pnpm-lock.yaml`
- this handoff

## Acceptance criteria

- The PDF endpoint accepts an explicit positive revision and never silently substitutes the latest quote.
- Only approved or delivery-prepared ready revisions can be downloaded.
- PDF content includes product photo where safely available, exact feed specs, price, VAT, commercial terms, sender, buyer, approval status and quote fingerprint.
- The generated response is a real PDF with safe headers and a stable revision-specific filename.
- The manager request page lists all saved revisions, status, amount and direct preview/PDF actions.
- Tests cover authorization gates, historical revision integrity, headers, Cyrillic content and no external delivery.
- Rendered PDF pages are visually inspected; desktop/mobile manager UI is checked in the browser.
- No production, deployment, credentials, external messages or live services are touched.

## Implementation

- Added an append-only revision listing from the quote draft store and surfaced it in the manager request card.
- Added `GET /api/quote-requests/:id/quote-pdf?revision=N`; the route requires test mode, an explicit positive revision, a ready quote and an approval stage of `approved` or `delivery_prepared`.
- Added a server-side A4 PDF generator with embedded Ubuntu fonts, 7TOOL vector logo, safe local/allowlisted product images, commercial totals and 22% VAT snapshot, parties, terms, signature area, approval actor/time, full SHA-256 fingerprint and technical appendix.
- Added revision-specific preview and PDF actions in the manager workspace and approval panel. No delivery code was added.
- Added safe response headers (`private, no-store`, `nosniff`, stable ASCII/UTF-8 filenames, revision and fingerprint headers).
- Added Ubuntu font files with their license. Generated customer PDFs remain under ignored `output/pdf/` and are not committed as source.

## Checks

- `node --test tests/quote-pdf.test.mjs`: 4/4 passed.
- Full ESLint: passed with no findings.
- `node --test tests/*.test.mjs`: 65/65 passed.
- `pnpm run build`: passed; the PDF API route is present in the production bundle.
- Generated sample response: HTTP 200, `application/pdf`, 171,319 bytes, explicit revision 1, matching fingerprint header.
- Poppler inspection: PDF 1.7, A4, 2 pages, no JavaScript, forms, encryption or suspect objects.
- Visual inspection of both rendered pages: logo, product photo, Cyrillic, price, VAT, approval details, technical table and footer render without clipping or missing glyphs.
- Text-layer extraction with `pdfplumber`: Cyrillic and commercial data are selectable/searchable; SHA-256 and page numbering are present.
- Browser QA: desktop 1440x1000 and mobile 390x844. Revision row, preview/PDF actions and approval panel remain readable; mobile body has no horizontal overflow.

## Local preview

- Manager revision register: `http://127.0.0.1:3175/test/requests/7T-20260912-6714C3#quote-revisions`
- Approved quote workspace: `http://127.0.0.1:3175/test/requests/7T-20260912-6714C3/quote`
- Sample PDF: `design-exploration/staging-pilot/output/pdf/7TOOL-KP-20260912-6714C3-r1.pdf`

## Known limitation

- Vinext beta logs its existing RSC prefetch setup error for `Link` chunks in the browser console. The page, direct navigation and PDF download still work; this change does not modify Vinext internals.
- Before production, replace the local JSON/test-mode stores with authenticated RBAC, a transactional database, durable object storage and the approved outbox/delivery integrations.
- Server PDF embeds stamp/signature assets only when they are PNG or JPEG; WebP remains accepted by the existing UI but is safely omitted from PDF until a trusted server-side conversion is added.

## Commit

- Feature commit: `66ce05c` (`feat: generate revision-specific quote PDFs`).
