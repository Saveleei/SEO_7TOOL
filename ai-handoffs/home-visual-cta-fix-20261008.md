# Home visual and CTA correction — 2026-10-09

- Agent: Codex
- Branch: `codex/home-visual-cta-fix-20261008`
- Goal: remove duplicated buying actions, make the homepage entry visual and explicit, shorten the category-to-product path, and keep product decisions readable on desktop and mobile.
- Scope: homepage production-task layout, category display modes and cards, category navigation, product commercial hierarchy, responsive comparison/request states, and focused regression tests.
- Ready when: focused and full checks pass, 1440/1024/390/320 layouts are verified, and the noindex preview is published to `new.7tool.ru`.
- Production: out of scope; `7tool.ru` must not be changed.

## Verification

- Focused deployment suite on the server candidate: 45 passed.
- Full repository suite: 419 passed.
- ESLint: 0 errors, one pre-existing `YandexMetrika.tsx` image warning.
- Production build: passed.
- Browser QA: 20 page/viewport states at 1440, 1024, 768, 390 and 320 px; no horizontal overflow, large production-task media preserved, category cards remain readable, and comparison/request actions are not clipped.
- Preview indexing contract: public `X-Robots-Tag: noindex, nofollow, noarchive`, matching robots meta, `Disallow: /`, and an empty public sitemap verified after deployment.
- Preview deployment: `new.7tool.ru` points to `/var/www/7tool-release-20261009-home-ux-e80faf1/design-exploration/staging-pilot`, source SHA `e80faf18efd144c434f8ff470d6979e15579c497`, preview PID `40661`, HTTP 200.
- Published behavior: exact `В запрос` CTA is absent; category pages expose `Выбрать исполнение`; category and product pages expose the single primary `Получить КП` action.
- Production isolation: `7tool-prod` stayed on PID `24021`, `/var/www/7tool-production-current` stayed on `/var/www/7tool-release-20261007-catalog-menu-7e9f523`, and `https://7tool.ru/` returned HTTP 200.
- Deployment method: hard-link clone of the active preview plus a small reviewed Git delta, fresh generated catalog data, fresh Vinext build, candidate-port smoke tests, then atomic preview symlink switch with rollback protection.
- Server capacity: 968 MB free on `/dev/vda1` after deployment (98% used). This remains an operational constraint and should be handled separately before accumulating more releases.
- Access cleanup: both one-time SSH keys were removed from both server authorization files; rejection was verified; local private/public keys and upload copies were deleted.

## Commit

- CTA cleanup: `d1d0aa0`
- Catalog modes and cards: `1668764`
- Homepage visual first screen: `2f0ef7b`
- Shorter category path: `5b8314b`
- Product commercial decision hierarchy: `41e58ee`
- Responsive polish: `e80faf1`
