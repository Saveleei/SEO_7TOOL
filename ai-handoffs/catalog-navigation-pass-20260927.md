# Catalog navigation pass — 2026-09-27

## Ownership

- Agent: Codex
- Branch: `codex/catalog-navigation-pass`
- Base commit: `0480fa6`

## Goal

Separate canonical product navigation from task-based selection, simplify the desktop mega menu, make mobile navigation compact and non-obscuring, move catalog choices into the first viewport, improve wide-screen use, and normalize catalog quantity wording without changing feed facts.

## Planned scope

- `design-exploration/staging-pilot/app/ui/PilotHeader.tsx`
- `design-exploration/staging-pilot/app/catalog/page.tsx`
- `design-exploration/staging-pilot/app/globals.css`
- focused regression tests for catalog navigation

## Acceptance

- Desktop mega menu has one canonical destination per category and no duplicated direction action.
- Catalog routes visibly mark the catalog as the current scope.
- Mobile menu exposes six top-level groups first, expands one group at a time, locks background scroll, and does not collide with the mobile request dock.
- Catalog categories begin in the first viewport and use three columns on wide screens, two on standard desktop, one on mobile.
- Counts use one accurate term for grouped catalog entities.
- Desktop/mobile browser QA, focused tests, full lint/test/build pass.

## Status

Implemented and verified locally. Not deployed.

## Delivered

- Added a canonical catalog projection: all 24 published categories remain discoverable, but no category is duplicated between catalog directions. Task-based pages still retain intentional cross-listing.
- Rebuilt the desktop mega menu around catalog sections and direct category links; removed the repeated “all categories” action and added one representative image per direction.
- Rebuilt mobile navigation as six collapsed directions with one accordion open at a time, an explicit close state, background locking/inert content, and no collision with the fixed request dock.
- Marked catalog scope in the header and retained search, task selection, company, contacts, and request-cart actions.
- Reworked `/catalog` into a compact first screen with direct category/task/TZ paths; category cards enter the first mobile viewport.
- Added three-column wide-screen, two-column desktop, and one-column mobile layouts; odd category rows span cleanly without placeholder cells.
- Removed the decorative “Товар из раздела” badge and normalized feed group counts to the accurate buyer-facing term “товарные серии”.
- Preserved editable direction photography from the existing administrator settings.

## Verification

- Focused navigation/content regression tests: 16 passed.
- Full test suite: passed.
- ESLint for changed files: passed.
- Full ESLint: passed.
- Production build: passed (`24 categories` projection generated).
- Browser QA: desktop 1265 px, wide desktop 1680 px, mobile 390 × 844 px.
- Browser interactions checked: open/close, backdrop, Escape, one mobile accordion at a time, inert background, hidden mobile dock, direct category links.

## Preview

- Local: `http://localhost:3231/catalog`
- Server uses Next.js webpack dev mode because Turbopack rejects the shared dependency junction on Windows; the production Vinext build itself passed.

## Commit

- Pending final SHA.
