# Technical SEO baseline — 2026-09-27

## Ownership

- Agent: Codex
- Branch: `codex/technical-seo-baseline`
- Base: `c9a31b5`

## Goal

Implement the pre-launch technical SEO baseline for the staging-pilot storefront: safe indexation, canonical URLs, route-specific metadata, robots and sitemap coverage, and evidence-based structured data.

## Scope

- Public Next.js routes under `design-exploration/staging-pilot/app/`
- SEO helpers, metadata, robots, sitemap and JSON-LD
- Regression tests and rendered-output verification

## Guardrails

- The test host must remain non-indexable.
- Filter/search/compare/request/manager URLs must not become indexable landing pages.
- Product price, stock and shipping structured data may only use feed-backed facts.
- No deployment, feed publication, Beget/DNS change or external submission.

## Completion criteria

- Focused SEO tests, full test suite, lint and production build pass.
- Public HTML has correct canonical/robots metadata and valid JSON-LD on representative routes.
- Commit SHA and verification results are recorded here.

## Implemented

- Indexing is opt-in through `SEO_INDEXING_ENABLED=1`; the safe default remains closed.
- `X-Robots-Tag: noindex, nofollow, noarchive` is forced for every host except exact `7tool.ru` / `www.7tool.ru`, even if the flag is enabled. `test.7tool.ru` therefore remains closed.
- Production metadata replaces prototype wording on the home page, catalog, six information pages, task pages, category pages and product pages.
- Self-referencing canonical URLs are emitted for clean public pages. Category filters and product variant query URLs are `noindex` and point to the clean canonical page.
- `/search` and `/compare` remain `noindex`; `/test/*` has a nested noindex layout.
- `robots.txt` and `sitemap.xml` are generated from the current published catalog only when indexing is enabled. The sitemap contains 4,321 unique canonical URLs and excludes test, API, search, compare, query and legacy routes.
- Legacy drilling and STEYR URLs use permanent `308` redirects to their canonical replacements.
- Missing dynamic categories, tasks and products now return a real 404 via `notFound()`.
- JSON-LD covers Organization, WebSite, BreadcrumbList and Product. Product Offer/InStock is emitted only when exact positive price and the centralized fresh availability promise are both confirmed.

## Verification

- Focused SEO tests: `6/6` passed.
- Full test suite: `297/297` passed.
- Full ESLint: passed.
- Production build: passed (`vinext build`, 24 catalog categories generated).
- Rendered checks with `SEO_INDEXING_ENABLED=1`:
  - clean category: `index, follow` plus canonical clean URL;
  - filtered category: `noindex, nofollow, nocache` plus the same clean canonical;
  - product page: Product and BreadcrumbList JSON-LD; unconfirmed/stale stock produced no Offer;
  - test/localhost response: forced `X-Robots-Tag` noindex;
  - exact production host response: no forced noindex header;
  - legacy catalog URL: `308 Permanent Redirect`.
- Browser QA: desktop home and product plus 390 px category view; no horizontal overflow at the mobile breakpoint.
- Known unchanged baseline: Vinext beta still logs its previously documented RSC prefetch setup error. Full document navigation remains enabled and the error is unrelated to this branch.

## Commit

- Implementation commit: `0ce160b`
