# Task-first navigation and size picker — 2026-10-01

- Agent: Codex
- Branch: `codex/task-first-size-picker-20261001`
- Base: `7fa4e40`
- Status: complete; not deployed

## Goal

Make the homepage production-task entry visually explicit on desktop and compact on mobile: task headings remain textual while concrete subcategories receive representative product images. Replace long inline variant lists with one accessible size picker: modal on desktop and full-screen sheet on mobile, preserving availability, price, exact variant and quote actions.

## Implemented scope

- `design-exploration/staging-pilot/app/ui/HomepageTaskPaths.tsx`
- `design-exploration/staging-pilot/app/ui/HeaderCatalogMenu.tsx`
- `design-exploration/staging-pilot/app/ui/VariantPickerDialog.tsx`
- `design-exploration/staging-pilot/app/ui/FeedProductPurchase.tsx`
- `design-exploration/staging-pilot/app/ui/FeedProductCard.tsx`
- `design-exploration/staging-pilot/app/ui/FeedProductTable.tsx`
- `design-exploration/staging-pilot/app/ui/TrustSection.tsx`
- `design-exploration/staging-pilot/app/catalog/category/[slug]/page.tsx`
- `design-exploration/staging-pilot/app/compare/page.tsx`
- `design-exploration/staging-pilot/app/globals.css`
- focused regression tests for task navigation, exact variant selection and the comparison decision row

## Result

- Homepage and header catalog keep production-direction titles textual and show representative uncropped product media on concrete subcategories.
- Mobile task navigation uses one-open accordions; mobile category entry cards render as one readable row per choice without page overflow.
- Dense inline variant rows were replaced with one shared accessible picker: centered modal on desktop and full-screen surface on mobile, with search, all/in-stock states, exact price, SKU, product deep link and quote action.
- Product, card and table flows pass the exact feed variant, media, shipping promise and canonical href into the quote draft.
- The trust journey is vertical on mobile; three photo stories are shown first and three more are progressively disclosed.
- Comparison keeps a compact price near each model name, removes price from the technical body, and repeats the commercial decision after all characteristics with an emphasized VAT-inclusive price and `Выбрать модель` action.

## Acceptance criteria

- Desktop task cards expose concrete subcategories with non-cropped images.
- Mobile task navigation is compact and understandable without a long open grid.
- Product and category variant selection does not render dozens of rows in page flow by default.
- All variants remain discoverable in an accessible picker; stock, price and exact quote actions remain visible.
- Keyboard, focus restoration, close controls and responsive layouts are verified.

## Checks

- `pnpm run lint` — passed.
- Focused regression set — 54/54 passed.
- `pnpm test` — 336/336 passed.
- `pnpm run build` — passed; Vinext production build completed.
- Browser QA at 1440×900 and 390×844:
  - comparison header price and bottom commercial row visible; all three actions are 42 px high;
  - mobile comparison uses a contained 848 px horizontal table inside a 375 px viewport; the page itself has no horizontal overflow;
  - mobile category entry cards are one column, 84 px high and report no text overflow;
  - mobile trust process is one-column and the first three photo cards stack without page overflow;
  - shared size picker remains a searchable full-screen mobile surface.
- Non-blocking runtime observation: Vinext emits repeated `RSC prefetch setup error: TypeError: f is not a function` messages from its generated `link` chunk. Rendering, direct navigation, regression tests and the production build complete successfully; this belongs in a separate Vinext/runtime investigation.
- No deployment, feed publication, DNS, credentials or live service changes were made.

## Commit

`1f3e3e4` — `feat: simplify task and variant selection`
