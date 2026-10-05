# SEO meta keywords ownership

- Agent: Codex
- Branch: `codex/seo-meta-keywords-20261005`
- Base commit: `9731545`
- Scope: `design-exploration/staging-pilot/` metadata generation for indexable commercial pages and focused SEO regression tests.
- Goal: add a controlled `meta keywords` signal for Yandex without keyword stuffing, query-string leakage, duplicate phrases, or parent/child category cannibalization.
- Completion criteria: category, subcategory, brand, product, homepage, and catalog metadata use bounded page-specific keyword sets; non-indexable URL states expose no keywords; parent drilling-machine keywords exclude intents owned by dedicated subcategories; focused tests, full tests, lint, and production build pass.
- Constraints: do not deploy, publish feeds, run production migrations, change credentials, or modify live Beget services without separate explicit approval.
- Status: complete; verified release candidate, not deployed.
- Commit: `e9e405b` (`feat: add controlled SEO keyword ownership`).

## Ownership rules

- A parent category owns generic product-class and commercial intent.
- A dedicated subcategory owns its narrower type, feature, series, or use-case intent.
- A product page owns the exact product title, brand/model combination, and exact SKU.
- A brand page owns brand-commercial combinations, not generic category phrases by themselves.
- Keywords are sourced only from trusted catalog or curated application data. Search parameters and visitor input are never used.
- Normalization removes duplicates and unsafe separators; the final list is capped to prevent stuffing.

## Safety

- Production is not changed by this branch.
- Existing canonical, robots, sitemap, redirects, and advertising/feed URLs remain unchanged.

## Implemented

- Added one centralized keyword normalizer with a six-phrase and 420-character ceiling, case/`ё` deduplication, separator/control-character cleanup, and trusted-data-only inputs.
- Added curated parent-category cores for all 24 published product categories.
- Added page-specific builders for subcategories, brands, products, and production-task pages.
- Added explicit broad clusters to the homepage and main catalog.
- Suppressed keywords whenever the page-level metadata state is `noindex`.
- Connected the builders to the category, legacy subcategory, brand, product, and task templates without changing their public URLs, canonical rules, redirects, or sitemap membership.

## Verification

- Focused SEO and keyword tests: 17/17 passed.
- Full regression suite: 390/390 passed.
- Dedicated SEO check: 38/38 passed; legacy coverage reported zero product, category, subcategory, brand, collision, and unknown-route gaps.
- Full ESLint: zero errors; one pre-existing `YandexMetrika.tsx` `no-img-element` warning remains outside this scope.
- Vinext production build: passed; 24 catalog categories and 125 legacy-compatible subcategory landings generated.
- Local production HTML smoke with indexing enabled:
  - `/c/stanki-sverlilnye`: `200`, `index, follow`, exact six-phrase generic cluster.
  - `/c/stanki-sverlilnye/magnitnye`: `200`, `index, follow`, magnetic-only narrow cluster.
  - `/c/stanki-sverlilnye?sort=price-asc`: `200`, `noindex, follow, nocache`, no keywords tag.
  - `/p/magnitnyy-sverlilnyy-stanok-lenz-steyr-35`: `200`, exact product/brand/model cluster.

## Release note

- No production, Beget, feed, DNS, credential, or advertising setting was changed.
- Deployment requires a separate explicit approval after review of this verified commit.
