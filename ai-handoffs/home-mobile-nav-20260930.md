# 7TOOL homepage and mobile navigation — 2026-09-30

- Agent: Codex
- Branch: `codex/home-mobile-nav-20260930`
- Worktree: `.codex-tmp/home-mobile-nav-20260930`
- Base commit: `728402c`

## Goal

Make the new 7TOOL storefront feel more visual and commercially alive on desktop and mobile, while preserving the existing catalogue, request and product-selection logic.

## Scope

- Desktop and mobile homepage first screen and catalogue entry points.
- Fixed mobile header and B2B-oriented bottom navigation.
- Full-screen accessible mobile catalogue/navigation surface.
- Responsive typography, spacing, imagery and fixed-control collision handling.
- Regression coverage for navigation and homepage contracts.

## Safety constraints

- Do not change `7tool.ru` production, DNS, cron, feeds or secrets.
- Do not submit external forms or leads.
- Deploy only to `new.7tool.ru` after all checks pass; the user has explicitly approved changes to the new version only.
- Preserve unrelated user changes and existing catalogue/request behavior.

## Acceptance criteria

- The desktop homepage communicates the assortment visually within the first screen and has a coherent grid.
- At 360, 390 and 430 px the first screen is readable and shows a clear next action without horizontal overflow.
- Mobile navigation is fixed, includes Home, Catalogue, Quote and Manager, and does not duplicate or overlap existing fixed controls.
- The mobile catalogue menu is a scrollable full-screen surface with contact and service links, focus management and Escape close.
- Existing homepage editor data and category image sources remain supported.
- Targeted tests, lint, full test suite and build pass.

## Files changed

- `design-exploration/staging-pilot/app/page.tsx`
  - visual category preview in the mobile first screen;
  - direct evidence link using the same administrator-managed warehouse photographs as the trust section.
- `design-exploration/staging-pilot/app/ui/MobileBottomNavigation.tsx`
  - fixed B2B mobile navigation: Home, Catalogue, Quote and Manager.
- `design-exploration/staging-pilot/app/ui/HeaderCatalogMenu.tsx`
  - full-screen mobile catalogue, mobile search, contacts, service links, Escape handling, focus trap and focus restoration.
- `design-exploration/staging-pilot/app/ui/PilotHeader.tsx`
  - shared mobile navigation integration without changing the desktop manager contact surface.
- `design-exploration/staging-pilot/app/ui/RequestCart.tsx`
  - compact quote-request trigger suitable for the bottom navigation.
- `design-exploration/staging-pilot/app/globals.css`
  - desktop homepage balance, photographic trust layout, fixed mobile controls and 360–430 px responsive rules.
- `design-exploration/staging-pilot/tests/home-mobile-navigation.test.mjs`
  - regression contracts for mobile navigation, accessible catalogue and editable trust evidence.

The existing `/test/settings/trust` workspace remains the source of truth for the trust-section eyebrow, heading, introduction, card texts, outcomes, alt text and uploaded/replaced photographs. The existing `/test/settings/homepage` workspace remains the source of truth for homepage merchandising copy and category media.

## Verification

- Targeted homepage/navigation/request tests: 35 passed.
- Full ESLint: passed.
- Full test suite: 330 passed, 0 failed.
- Production Vinext build: passed; `/test/settings/trust` and `/test/settings/homepage` are present in the generated route table.
- Browser QA against the production build:
  - desktop 1440 × 900: no horizontal overflow, hero/catalogue balance and desktop manager surface verified;
  - mobile 360, 390 and 430 px: no horizontal overflow;
  - full-screen catalogue locks the background, exposes phone/email and service links, and closes accessibly;
  - fixed bottom navigation and the manager contact panel are readable and non-overlapping;
  - real warehouse, picking and dispatch photographs render in the homepage trust journey.
- No forms were submitted and no external leads were sent.
- No production, DNS, feed, cron or secret changes were made.
- Disk recovery: only rebuildable `dist/.next` outputs in three old isolated worktrees were removed; no source or user data was deleted.

## Commit

`ab810a6` — `feat: strengthen homepage trust and mobile navigation`
