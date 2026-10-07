# New refinement preview — 2026-10-07

- Agent: Codex
- Branch: `codex/catalog-menu-all-categories-20261007`
- Application source commit: `7e9f523`
- Target: `new.7tool.ru` only
- Production rule: do not change or restart `7tool.ru`, `7tool-prod`, production data, DNS, feeds, cron or credentials.

## Purpose

Continue UX and conversion refinements in the current branch while using `new.7tool.ru` as the review contour. The public production site stays unchanged until a later explicit production publication decision.

## Indexing guard

The preview must remain unavailable to search indexing at every release:

1. `SEO_INDEXING_ENABLED=0` and `QUOTE_TEST_MODE=1` in the preview process.
2. HTML metadata contains `noindex, nofollow`.
3. Every storefront response contains `X-Robots-Tag: noindex, nofollow, noarchive`.
4. `robots.txt` contains `Disallow: /`.
5. `sitemap.xml` has no URL entries.
6. Yandex Metrica is absent from the preview HTML.

## Deployment design

- Immutable candidate: `/var/www/7tool-release-20261007-new-refinement-7e9f523/design-exploration/staging-pilot`.
- Candidate process: `7tool-new-refinement-candidate` on loopback port `3267`.
- Stable preview pointer: `/var/www/7tool-new-current`.
- Preview process: `7tool-storefront-new` on loopback port `3243`.
- Expected rollback point: `/var/www/7tool-release-20261004-tablet-mobile-daeb930/design-exploration/staging-pilot`.
- Candidate source is copied server-side from the immutable active production release; its application tree is identical to branch application commit `7e9f523` (`git diff 7e9f523..HEAD -- design-exploration/staging-pilot` is empty).
- Production pointer and process are checked but never changed.

## Acceptance

- Local focused SEO tests, full test suite, lint and production build pass.
- Candidate returns `200` for the main conversion routes and redirects anonymous admin access.
- All six indexing guards pass on the loopback candidate.
- Activation is atomic and rollback-safe.
- After activation, the same indexing guards pass on public `new.7tool.ru` and production stays online with the same PID.

## Result

- Focused SEO, analytics, menu and public-URL tests: `22/22` passed.
- Full test suite: `411/411` passed.
- ESLint: passed.
- Vinext production build: passed and generated all 24 category presentations plus 125 legacy-compatible subcategory landings.
- Deployment scripts pass Bash syntax validation and `git diff --check`.
- The live pre-deployment contour is already protected by the noindex header, HTML robots metadata, `Disallow: /`, an empty sitemap and absent Yandex Metrica.
- Pending loopback candidate verification and explicit action-time activation confirmation.
