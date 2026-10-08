# Home visual and CTA correction — 2026-10-08

- Agent: Codex
- Branch: `codex/home-visual-cta-fix-20261008`
- Goal: remove the duplicated `В запрос` action and restore a large, image-led production-task entry on the homepage.
- Scope: homepage production-task component/styles, feed product purchase actions, focused regression tests.
- Ready when: focused and full checks pass, 1440/1024/390/320 layouts are verified, and the noindex preview is published to `new.7tool.ru`.
- Production: out of scope; `7tool.ru` must not be changed.

## Verification

- Focused deployment suite on the candidate: 81 passed.
- Full repository suite: 418 passed.
- ESLint: 0 errors, one pre-existing `YandexMetrika.tsx` image warning.
- Production build: passed.
- Browser QA: 1440, 1024, 768, 390 and 320 px; homepage and category layouts verified, large production-task media preserved, two-column mobile product cards readable, and no exact `В запрос` CTA remains on the feed category route.
- Preview indexing contract: public `X-Robots-Tag: noindex, nofollow, noarchive`, matching robots meta, `Disallow: /`, and an empty public sitemap verified after deployment.
- Preview deployment: `new.7tool.ru` points to `/var/www/7tool-release-20261008-home-visual-cta-99c0240/design-exploration/staging-pilot` and returned HTTP 200 after activation.
- Production isolation: activation verified the production PID was unchanged during the preview switch and `7tool.ru` returned HTTP 200. A separate concurrent production deployment changed production to `7tool-release-20261008-category-order-080b374` three minutes later; this preview task did not perform that change.
- Server cleanup: two confirmed stale `.staging` directories totalling 925 MB were removed; the third named staging directory was already absent. Final free space observed after concurrent server activity: 1.3 GB.
- Access cleanup: the one-time SSH key was removed from both server authorization files, rejection was verified, and its local private/public key files were deleted.

## Commit

Homepage/CTA implementation: `a1597b7`

Initial verification notes: `1bb57c6`

Catalog conversion cleanup: `99c0240`
