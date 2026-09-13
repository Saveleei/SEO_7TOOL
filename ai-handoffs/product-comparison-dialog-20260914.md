# Product comparison dialog — 2026-09-14

- Agent: Codex
- Branch: `codex/product-comparison-dialog`
- Base commit: `6735adf8adc98b59240f8fb8b63bd5a42057690f`
- Status: complete locally; not deployed

## Goal

Turn the product buy-box action “Сравнить похожие модели” into an accessible, feed-grounded comparison workflow that keeps the selected variant in context, compares only relevant alternatives, supports adding an exact alternative variant to the quote draft, and falls back to manager selection when trustworthy comparisons are unavailable.

## Owned files

- `design-exploration/staging-pilot/app/data/productRecommendations.mjs`
- `design-exploration/staging-pilot/app/data/feedCatalog.ts`
- `design-exploration/staging-pilot/app/data/variantPresentation.ts`
- `design-exploration/staging-pilot/app/product/[slug]/page.tsx`
- `design-exploration/staging-pilot/app/ui/FeedProductPurchase.tsx`
- `design-exploration/staging-pilot/app/ui/ProductComparisonDialog.tsx`
- `design-exploration/staging-pilot/app/ui/ProductRecommendationSystem.tsx`
- `design-exploration/staging-pilot/app/globals.css`
- `design-exploration/staging-pilot/tests/product-recommendations.test.mjs`
- `ai-handoffs/product-comparison-dialog-20260914.md`

## Completion criteria

- Buy-box comparison opens a modal rather than merely jumping down the page.
- Current and alternative exact variants show decision-ready differences from the feed.
- Alternative can be opened or added to the quote draft without losing the current selection.
- Focus, Escape, close and mobile overflow behavior are covered.
- Comparison events contain product/variant/placement context and no contact data.
- Narrow tests, lint, full tests, build and browser/HTTP checks pass.

## Verification

- Feed-backed fixture review:
  - `LZHS-013` compares with three exact Ø13 alternatives and exposes working length, cutting material and coating differences.
  - `STEYR-35` leads with `Корончатое сверление до Ø35 мм`; `Спиральное сверление до Ø13 мм` is explicitly secondary.
- Narrow regression: 22/22 passed (`product-recommendations`, `variant-presentation`).
- Full ESLint: passed with no errors or warnings.
- Full test suite: 146/146 passed.
- Production build: passed.
- Loopback release smoke at `http://127.0.0.1:3184`: 46/46 checks passed; no customer form or external delivery action was invoked.
- Desktop browser acceptance:
  - buy-box action opens one labelled modal;
  - current execution remains first;
  - comparison contains four technical rows plus price/availability and actions;
  - adding one alternative updates only that exact variant and the quote count;
  - closing restores body scroll and focus to the originating button.
- Mobile browser acceptance at 390 × 844:
  - bottom-sheet panel remains inside the viewport;
  - footer action remains visible;
  - the 840 px comparison table scrolls inside its 358 px viewport without clipping the page;
  - Escape closes the dialog and restores focus.
- Magnetic-drill browser acceptance confirmed the corrected labels in the buy box, full specification and recommendation cards.

## Known limitation

- Vinext beta still logs the previously documented `RSC prefetch setup error` for some `next/link` chunks. Direct navigation, comparison actions, tests, smoke and build pass; this branch does not change the Vinext runtime.
- The change is available only in the local isolated worktree. `test.7tool.ru`, production, DNS, credentials and external delivery were not changed.

## Local preview

- `http://127.0.0.1:3184/product/sverla-koronchatye-lzhs?variant=A9021`
- `http://127.0.0.1:3184/product/magnitnyy-sverlilnyy-stanok-lenz-steyr-35`

## Commit

- `26a1f5de4c0ad05f319b21590b8908e6e35083f2` — `feat: add product comparison dialog`
