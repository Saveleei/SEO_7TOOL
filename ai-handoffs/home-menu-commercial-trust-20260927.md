# Home menu and commercial trust — 2026-09-27

## Ownership

- Agent: Codex
- Branch: `codex/home-menu-commercial-trust`
- Base: `1598f66`
- Initial implementation commit: `cd096bc`
- Warehouse proof and company-page commit: `a4abce2`

## Goal

Improve the desktop catalog menu and homepage hierarchy, especially ultrawide readability, and make the commercial trust conditions explicit: delivery across Russia, deferred payment, VAT invoice and warranty.

## Scope

- Header mega-menu readability and viewport safety
- Homepage/header scale on large desktop screens
- Commercial trust strip directly below the hero
- Desktop and mobile regressions and browser QA
- Real warehouse, picking and dispatch evidence shared across homepage, catalog and company page

## Implemented

- Added a linked four-condition commercial strip immediately below the hero: delivery across Russia, deferred payment for organizations after approval, VAT invoice and warranty.
- Kept the deferred-payment wording conditional so the storefront does not promise credit terms without approval.
- Expanded the homepage and storefront header to a bounded 1560 px canvas on ultrawide screens.
- Removed ambiguous product thumbnails from the six top-level mega-menu directions.
- Increased category-link type and row height in the mega-menu, and added a viewport-bounded desktop scroll region with sticky header/footer.
- Forced all six quick-category images in the homepage hero to `contain` with protected inner spacing and no hover zoom.
- Updated the homepage editor and preview to explain and enforce uncropped category imagery.
- Renamed the first-screen navigation block to `Ключевые разделы каталога`, including a safe migration for the legacy default heading.
- Reused the owner-provided warehouse assets for three evidence stages: request check, order picking and dispatch.
- Kept the evidence block after task navigation on the homepage and after category navigation in the catalog, so photos support trust without competing with product discovery.
- Added the same administrator-controlled photos and copy as a larger operational gallery on `/company`.
- Extended the trust editor so one update controls homepage, catalog and company-page evidence.
- Changed the mobile first-screen category tiles to one readable column with uncropped 104 px media frames; long category names no longer collide with images.

## Verification

- Focused homepage/menu/trust/readability tests: 15/15 passed before the final copy tightening; final focused rerun: 9/9 passed.
- ESLint on changed TypeScript and test files: passed.
- Full test suite after warehouse integration: 291/291 passed.
- Focused final regression: 25/25 passed; ESLint on changed files passed.
- Production build: passed after final changes.
- Browser QA for this increment passed at 1440×1000 and 390×844 on the homepage, catalog evidence and company gallery.
- Ultrawide header and hero canvas measured 1560 px with no horizontal overflow.
- All six hero images reported `object-fit: contain` and remained inside their media frames on desktop and mobile.
- The desktop mega-menu contains 24 category links, no direction thumbnails, 14 px link text, 36 px rows, and scrolls safely on a 720 px-high viewport.
- Mobile commercial cards render as an aligned 2×2 grid without horizontal overflow.
- New owner-provided photos retain their subject on desktop and mobile, and anchor links account for the sticky header.
- Local production preview for this increment: `http://127.0.0.1:3244/`.

## Status

Implementation complete and ready for review. Not deployed.
