# Grainger-inspired catalogue refinement — 2026-10-08

## Ownership

- Agent: Codex
- Branch: `codex/grainger-catalog-refinement-20261008`
- Worktree: `.codex-tmp/grainger-catalog-refinement-20261008`
- Base commit: `acb5cf8968ea72e827791cd548c374d84615354d`
- Deployment scope: `new.7tool.ru` only, with indexing disabled; production is out of scope.

## Goal

Adapt the useful catalogue patterns from Grainger Canada to the smaller 7TOOL B2B assortment without copying its branding or Canadian buying assumptions. The result must be clearer, more visual, less verbose and appropriate for Russian company procurement.

## Reference findings

- Grainger keeps one dominant product search and one direct catalogue entrance in the header.
- Category pages lead with the category name, one concise description and a visual subcategory grid with large product imagery and counts.
- Products follow the visual subcategories immediately; filters stay in a stable left rail and results controls stay compact.
- Product cards prioritise image, product identity, article/model, availability, price and the primary purchase action.
- Assistance is persistent but secondary: a compact agent control stays at the page edge instead of competing with catalogue navigation.
- Service and corporate links are not mixed into the category-choice grid.

## Russian B2B adaptation

- Preserve quote-request terminology instead of a retail cart-first model.
- Keep VAT, invoice, UPD and closing-document facts visible.
- Keep honest availability language and exact-variant selection.
- Retain manager-assisted technical selection for complex equipment.

## Acceptance criteria

- Desktop catalogue menu shows all six directions and 24 categories with materially larger uncropped category images and readable counts.
- The menu no longer has the generic service-link footer; it has one restrained manager-help panel with phone, email and task-selection access.
- Homepage commercial proof explicitly mentions UPD and closing documents.
- The trust section shows six real photographs as the dominant content, with only a short heading and short factual captions; repeated descriptions, proof lists, outcomes and per-card links are removed from the visible layout.
- Category pages use a visual category/family navigation deck inspired by Grainger and place products directly after it.
- No invented stock, price, delivery or document claim is introduced.
- Layout is verified at 1440, 1024, 768, 390 and 320 px with no horizontal overflow.
- Relevant tests, full test suite, lint and production build pass before a preview candidate is prepared.

## Implemented candidate

- Desktop catalogue menu now uses larger uncropped category media and one right-side manager-help rail; the repeated service-link footer was removed.
- Tablet/mobile catalogue disclosure keeps direct phone and email access without reproducing the desktop rail.
- Category visual taxonomy now follows Grainger's flat four-column image cells on desktop: white canvas, vertical dividers, centred label and a real feed-backed series count.
- Product grid now uses four flat columns on desktop and a genuinely different two-column mobile view. The first help block starts after a complete product row instead of leaving a blank fourth cell.
- Product grid retains only one primary commercial action. The repeated quick-request button, archetype badge and verbose availability detail are suppressed in that view; VAT, price, current availability statement, comparison and the full product link remain.
- Dense table rows were reduced from roughly 219 px to roughly 141 px at 1440 px while preserving decision parameters, price, availability, comparison and variant selection.
- List/grid controls now use compact icon-and-label links with a clear active underline, following the Grainger pattern without importing retail cart assumptions.
- Trust presentation is photo-first: six real images with short captions, followed by compact verification/document facts.
- Homepage and catalogue support copy now names invoice with VAT, UPD and closing documents.

## Verification

- Full Node test suite: passed (414 tests).
- Targeted Grainger/readability/catalogue tests: 30/30 passed.
- ESLint: 0 errors; one pre-existing `@next/next/no-img-element` warning in `app/ui/YandexMetrika.tsx`.
- Vinext production build: passed.
- Browser QA:
  - 1440 px: four visual category cells; four product tiles per row; no horizontal overflow.
  - 1440 px dense list: first product row ~141 px; no horizontal overflow.
  - 390 px grid: two product tiles per row, one 44 px primary action, no repeated quick action, no horizontal overflow.
  - 320 px grid: two 136 px tiles, 44 px action target, no horizontal overflow.

## Release state

- No public host was changed.
- Candidate is ready for commit and `new.7tool.ru` preview cutover with indexing disabled.
- Obtain action-time user confirmation immediately before changing the preview host.
