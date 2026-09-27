# Home menu and commercial trust — 2026-09-27

## Ownership

- Agent: Codex
- Branch: `codex/home-menu-commercial-trust`
- Base: `1598f66`
- Implementation commit: `cd096bc`

## Goal

Improve the desktop catalog menu and homepage hierarchy, especially ultrawide readability, and make the commercial trust conditions explicit: delivery across Russia, deferred payment, VAT invoice and warranty.

## Scope

- Header mega-menu readability and viewport safety
- Homepage/header scale on large desktop screens
- Commercial trust strip directly below the hero
- Desktop and mobile regressions and browser QA

## Implemented

- Added a linked four-condition commercial strip immediately below the hero: delivery across Russia, deferred payment for organizations after approval, VAT invoice and warranty.
- Kept the deferred-payment wording conditional so the storefront does not promise credit terms without approval.
- Expanded the homepage and storefront header to a bounded 1560 px canvas on ultrawide screens.
- Removed ambiguous product thumbnails from the six top-level mega-menu directions.
- Increased category-link type and row height in the mega-menu, and added a viewport-bounded desktop scroll region with sticky header/footer.
- Forced all six quick-category images in the homepage hero to `contain` with protected inner spacing and no hover zoom.
- Updated the homepage editor and preview to explain and enforce uncropped category imagery.

## Verification

- Focused homepage/menu/trust/readability tests: 15/15 passed before the final copy tightening; final focused rerun: 9/9 passed.
- ESLint on changed TypeScript and test files: passed.
- Full test suite: 290/290 passed.
- Production build: passed after final changes.
- Browser QA passed at 3440×1440, 1280×720 and 390×844.
- Ultrawide header and hero canvas measured 1560 px with no horizontal overflow.
- All six hero images reported `object-fit: contain` and remained inside their media frames on desktop and mobile.
- The desktop mega-menu contains 24 category links, no direction thumbnails, 14 px link text, 36 px rows, and scrolls safely on a 720 px-high viewport.
- Mobile commercial cards render as an aligned 2×2 grid without horizontal overflow.

## Status

Implementation complete and ready for review. Not deployed.
