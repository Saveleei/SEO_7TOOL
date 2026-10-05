# SEO meta keywords ownership

- Agent: Codex
- Branch: `codex/seo-meta-keywords-20261005`
- Base commit: `9731545`
- Scope: `design-exploration/staging-pilot/` metadata generation for indexable commercial pages and focused SEO regression tests.
- Goal: add a controlled `meta keywords` signal for Yandex without keyword stuffing, query-string leakage, duplicate phrases, or parent/child category cannibalization.
- Completion criteria: category, subcategory, brand, product, homepage, and catalog metadata use bounded page-specific keyword sets; non-indexable URL states expose no keywords; parent drilling-machine keywords exclude intents owned by dedicated subcategories; focused tests, full tests, lint, and production build pass.
- Constraints: do not publish feeds, run production migrations, change credentials, DNS, advertising settings, or unrelated Beget services. Production deployment was performed only after the user's explicit approval on 2026-10-05.
- Status: complete and deployed to `7tool.ru`.
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

- Explicit user authorization: `Публикуй SEO keywords на 7tool.ru`.
- Deployed source commit: `85bc358` (implementation `e9e405b`).
- Active immutable release: `/var/www/7tool-release-20261005-seo-keywords-85bc358/design-exploration/staging-pilot`.
- Preserved rollback: `/var/www/7tool-release-20261005-postlaunch-seo-7a24266/design-exploration/staging-pilot`.
- Release archives were verified before extraction:
  - storefront archive SHA-256: `2b4ffbe00ce6e773fde24714c74f7771bef550c817aa8e6ffb0669a2d714a992`;
  - supporting `7tool-source` archive SHA-256: `540d7e6f2e777f35e709824f6dcff90ab4ccc7be40bfe2a2f7b7f5d76337faf2`.
- Server gates: production preflight `18/18`, focused SEO tests `17/17`, clean full suite `390/390`, ESLint zero errors with one pre-existing Yandex Metrika warning, Vinext production build passed against the active production catalog.
- One initial full-suite invocation incorrectly inherited production catalog/settings paths and exposed expected frozen-fixture count drift; no traffic had been switched. The suite was rerun in its required clean test environment and passed `390/390` before cutover.
- The candidate on `127.0.0.1:3261` passed read-only checks for homepage, catalog, drilling category, magnetic subcategory, exact product, comparison, robots, sitemap, Yandex feed, exact metadata ownership, noindex suppression, and anonymous staff redirect.
- Rollback-safe PM2 cutover succeeded on the existing port `3260`; `7tool-prod` points to the new immutable release with zero restarts. Nginx remained unchanged: storefront/static traffic stays on `3260`, and the exact legacy `/api/lead` adapter remains on `3108`.
- Public HTTPS smoke repeated the same route and exact-metadata assertions successfully. The filtered drilling URL remains `noindex, follow, nocache` and contains no keywords tag.
- No feed publication, DNS, Nginx, credential, cron, migration, advertising, Yandex Direct, or customer-form change was made. No external lead was submitted.

## Known independent follow-up

- A continuity spot check found that `/product/lenz-steyr-35` is intercepted by the pre-existing generic `/product/* → /p/*` proxy rule and therefore ends at the non-existent `/p/lenz-steyr-35` instead of the intended exact product slug. The relevant proxy and legacy route are byte-for-byte unchanged between the rollback commit `7a24266` and this release, so the keywords deployment did not introduce it. `/catalog/sverlenie` still resolves through its redirect to `200`. Fix the product alias as a separate reviewed SEO-continuity change.
