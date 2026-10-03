# Homepage production-task screen — 2026-10-03

- Agent: Codex
- Branch: `codex/home-task-screen-20261003`
- Base: `eae7d88`
- Status: implementation and automated verification complete; not deployed

## Goal

Fix the homepage production-task navigation shown in the user screenshot: prevent text/media overlap, restore complete series counts, remove accidental empty card areas, and improve desktop/mobile scanning without weakening direct category paths or the task-selection conversion route. Also preserve full product-execution names, surface the popular 35 mm drilling diameter, replace the requested homepage shortcut and keep first-page pagination centered.

## Scope

- `design-exploration/staging-pilot/app/ui/HomepageTaskPaths.tsx`
- `design-exploration/staging-pilot/app/page.tsx`
- `design-exploration/staging-pilot/app/catalog/category/[slug]/page.tsx`
- `design-exploration/staging-pilot/app/globals.css`
- focused regression tests for layout/readability, numeric promoted filters, variants and pagination

## Acceptance

- Every subcategory row reserves independent space for the image, title/count and arrow; no overlap or clipped first characters.
- Cards with three, four, five or six categories remain balanced without large blank panels.
- Category names remain at least 15 px on desktop and mobile; secondary counts remain at least 12 px.
- Direct category links and `Подобрать по задаче` remain visible and usable.
- Desktop/tablet/mobile grids do not overflow horizontally; mobile remains compact and expandable.
- Non-size execution names wrap in full instead of being ellipsized; on mobile they use a single readable column.
- `35 мм` is promoted in the decision filter for drilling-machine pages when that value exists in the feed.
- Homepage quick links use `Корончатые сверла` instead of `Компрессоры`.
- Page numbers occupy the center grid column even when the first page has no previous-page link.
- Focused tests, full tests, ESLint and production build pass before handoff.

## Verification

- Latest focused regression suite: 24/24 passed (the earlier broader focused run also passed 34/34).
- Full `npm test`: 343/343 passed.
- ESLint for changed TypeScript/TSX files: passed.
- Full `npm run lint`: passed.
- Production `npm run build`: passed, including generated catalog presentation and Vinext routes.
- `git diff --check`: passed; Git only reported the repository's existing LF/CRLF normalization warnings.
- Browser-driven visual QA could not start because the bundled browser runtime failed before connection with `failed to write kernel assets` / Windows path-not-found. No unsupported standalone browser automation was substituted. Responsive CSS contracts and regression tests cover desktop/tablet/mobile behavior; a final manual visual smoke check is still recommended before deployment.

## Safety

- `new.7tool.ru`, `test.7tool.ru` and production `7tool.ru` are unchanged until a separate explicit deployment request.
- No feed, DNS, cron, credentials or external form submission.

## Commit

Implementation commit: `6c89dfd`.
