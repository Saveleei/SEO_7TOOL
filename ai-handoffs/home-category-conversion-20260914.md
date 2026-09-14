# Homepage and category conversion system — 2026-09-14

## Ownership

- Owner: Codex `/root`
- Branch: `codex/home-category-conversion`
- Base: `7406d17` (the release documented for `test.7tool.ru`)
- Application: `design-exploration/staging-pilot`

## Goal

Turn the current storefront homepage and category entry points into one coherent B2B discovery system for a focused industrial assortment: the buyer can either find a known model/product or describe a production task, see relevant categories/subcategories immediately, and reach an exact product or an engineer-assisted request without unnecessary backtracking.

## Scope

- Homepage information hierarchy, hero, search/task paths, category/subcategory discovery, trust and contact hierarchy.
- Shared category navigation and representative category templates using only feed-backed products, parameters, ranges and brands.
- Desktop and mobile readability, accessibility, performance and privacy-safe interaction analytics.
- Focused regression coverage and local browser acceptance.

## Safety boundaries

- Preserve the deployed availability/freshness rules, quote workflow, real contacts and existing architecture.
- Do not invent stock, warehouses, delivery terms, brands, models, specifications or proof.
- Do not send forms, email, MAX or CRM events during validation.
- Do not change production, DNS, credentials, cron or the live feed.
- Do not deploy `test.7tool.ru` without a separate explicit approval after local acceptance.

## Acceptance criteria

- The first viewport communicates the complete 7TOOL offer rather than one equipment type and exposes two clear buyer paths: known item search/catalog and task-based engineering selection.
- Phone and email remain visible and usable without competing with the primary discovery action.
- Published product categories and meaningful subcategories are discoverable from feed-backed structures; a buyer does not need SKU knowledge.
- Category templates prioritize the actual industrial decision parameters, preserve exact variant actions and show guided selection only where it reduces uncertainty.
- Desktop and 390 px mobile layouts have no clipped controls, horizontal overflow or unreadable text.
- Focused tests, full tests, lint and production build pass; browser QA submits no form.

## Status

Implementation complete; kept local pending user acceptance and a separate deployment approval.

- Implementation commit: `a84bf03` (`feat: unify homepage and category discovery`).
- Assortment-clarity follow-up: `49e5001` (`feat: show assortment map in homepage hero`).
- Direct-product-path follow-up: `ec83578` (`feat: shorten homepage path to products`).

## Implemented

- Rebuilt the homepage first viewport around two low-friction B2B paths: search for a known product/model and selection by production task.
- Kept direct phone and email in the hero while avoiding competition with the main discovery actions; the existing privacy-safe contact analytics receives the homepage placement context.
- Replaced the stale manually priced homepage selection with a feed-backed category system: all published categories, representative product imagery and current product-group counts are derived from the same catalog source.
- Made the catalog direction pages expose their nested subcategories directly instead of turning a whole content block into one ambiguous link.
- Added feed-backed counts and representative images to task pages.
- Added sibling category navigation above the listing so a buyer can move between related subcategories without returning to the parent category.
- Added responsive layouts for the new homepage, catalog, task and category-navigation components, including horizontally scrollable related-category controls on narrow screens.
- Added regression coverage for published-category completeness, the two homepage discovery paths, real contacts, stale-link removal and category-navigation placement.
- Replaced the abstract hero backdrop and process-heavy card with a feed-backed 2×3 assortment map covering all six production directions. Each tile uses a real representative product image and links to its task catalog.
- Rewrote the hero heading and lead so the buyer immediately sees the metalworking specialization and representative range before interacting with search or selection.
- Removed the duplicate hero search field while preserving the prominent header search, reducing the first viewport to two explicit actions: open the catalog or select by task.
- Added a curated feed-backed shortlist with one real product per production direction, exact product links, key decision specifications, current safe price/availability presentation and a direct quote action only for exact single-variant products.
- Kept multi-variant groups honest: their primary action opens the complete execution selector rather than adding an ambiguous SKU to the quote request.
- Removed inflated supplier-row counts from homepage category cards; the interface now states only stable category structure and leaves live assortment detail to the category pages.

## Verification

- Latest focused homepage/category tests: 5 passed, 0 failed.
- Full test suite: 173 passed, 0 failed.
- Full ESLint run: passed.
- Production build: passed.
- Release-candidate smoke against `http://127.0.0.1:3205`: 48 checks passed; all public routes returned 200 and protected manager routes preserved authentication redirects.
- Direct route check: homepage, catalog, drilling task, burr category and compressor category returned 200.
- Visual browser check: 1440×1000 desktop and 390×844 mobile; the compact hero, assortment map and new product shortlist remained readable, product images loaded, controls did not overlap and mobile product cards preserved specifications, price and the primary action.
- No form was submitted and no email, MAX or CRM event was sent.

## Local acceptance URLs

- `http://127.0.0.1:3205/`
- `http://127.0.0.1:3205/catalog`
- `http://127.0.0.1:3205/catalog/task/drilling`
- `http://127.0.0.1:3205/catalog/category/borfrezy`

## Release note

This branch has not been deployed. `test.7tool.ru` remains on the previously verified release until the new homepage/category concept is accepted and deployment is explicitly approved.
