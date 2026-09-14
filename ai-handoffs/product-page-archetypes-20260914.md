# Product page archetypes — 2026-09-14

## Agent and branch

- Agent: Codex
- Branch: `codex/product-page-archetypes`
- Base: `49896300739ee462fcd0658e21308a77d5dcb3d9`
- Worktree: `C:/Users/user/Documents/ChatGPT/7TOOL/.codex-tmp/product-page-archetypes-20260914`

## Goal

Turn the existing product page into feed-backed buying experiences appropriate to four B2B scenarios: equipment, dimensional tooling/consumables, compatible accessories, and project/configurable equipment. Start with magnetic drilling machines, annular cutters, pipe/sheet bevelers, and rotary burrs.

## Scope and readiness criteria

- Reuse the existing category expert profiles, card archetypes, variant presentation, comparison, recommendations, quote cart, and manager contact architecture.
- Show the decision-driving facts and actions in an order appropriate to the product scenario; do not invent specifications, stock, warehouses, delivery dates, or compatibility.
- Keep exact variant selection, product media/link context, privacy-safe analytics, and quote flow intact.
- Add focused regression coverage for archetype classification and presentation contracts.
- Run focused tests, full ESLint, full test suite, production build, release smoke, and desktop/mobile browser acceptance without submitting any form.

## File ownership

- `design-exploration/staging-pilot/app/data/productPageArchetypes.*`
- Product-page presentation components and their scoped CSS/tests only.
- This handoff document.

## Status

- Implemented and verified locally. Not deployed.

## Implemented

- Added one product-page source of truth covering six feed-backed buying scenarios: industrial equipment, mobile processing equipment, dimensional tooling, compatible accessories, process consumables, and project systems.
- Mapped every published category through the existing category-card archetype instead of maintaining a second independent category list.
- Added a compact pre-purchase path built from the real category expert profile. It explains the three decision inputs before the buyer selects quantity or opens a quote.
- Changed buy-box copy by scenario: exact type size for tooling, model for mobile equipment, equipment for machines, accessory execution, pack, or project configuration.
- Carried the scenario through decision headings, engineer handoff, supply copy, recommendation stages, comparison-dialog language, jump navigation, and the final quote summary.
- Preserved exact variant media, SKU, deep link, price, availability state, privacy-safe event context, quote cart, and no-external-send test behaviour.
- Increased the new decision-path copy to a readable 12 px minimum and kept 42–48 px interactive targets on mobile.

## Verification

- Focused product-page, recommendation, variant, and acceptance tests: 31 passed after implementation; final focused pair: 15 passed.
- Full regression suite: 153 passed, 0 failed.
- Full ESLint: passed.
- Production build: passed after the final typography adjustment.
- Release-candidate smoke: 46 checks passed on `http://127.0.0.1:3189`; no form, quote submission, approval, or delivery action was invoked.
- Desktop browser matrix at 1280 x 900: annular cutter, magnetic drill, pipe beveler, and laser project system resolve to the correct scenario and have no horizontal overflow.
- Mobile browser check at 390 x 844: no horizontal overflow; scenario copy resolves to 12 px; primary actions remain 48 px high.
- Interactive buyer path: changed LZHS from variant `A9021` to `A9982`, opened a three-candidate size-specific comparison, added the exact variant, and confirmed that the quote drawer contains the LZHS-012 image plus two active deep links to `/product/sverla-koronchatye-lzhs?variant=A9982#variants`.
- Consent remained checked by default. The form was not submitted and no external message was sent.

## Local preview

- `http://127.0.0.1:3189/product/sverla-koronchatye-lzhs?variant=A9982`

## Known limitations

- Cross-category automatic compatibility remains intentionally limited to relationships supported by the existing feed rules. Other categories use the manager handoff rather than invented accessories.
- The work is local only; `test.7tool.ru`, production, DNS, credentials, feeds, and server services were not changed.

## Commit

- `a2dd8dc` — `feat: tailor product pages to buying scenarios`
