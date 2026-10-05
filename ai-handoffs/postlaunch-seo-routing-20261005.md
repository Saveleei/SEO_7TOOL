# Post-launch SEO routing and advertising continuity

- Owner: Codex
- Branch: `codex/postlaunch-seo-routing-20261005`
- Base: `codex/production-release-20261005` at `d75de1b`
- Scope: live SEO verification, legacy URL continuity, redirect/query preservation, canonical/sitemap/robots consistency, and Yandex Direct landing attribution safety.
- Expected files: routing and URL helpers, SEO checks/tests, and SEO/Yandex handoff documentation only where live evidence shows a gap.
- Done when: representative and inventory-based checks show direct permanent redirects or retained canonical pages, ad click parameters survive redirects and attribution capture, sitemap URLs are indexable canonical 200s, and relevant tests/build pass.
- Production safety: no Beget, DNS, credentials, feeds, campaigns, or production deployment changes without a separate explicit deployment action.
- Reviewer focus: redirect status and chain length, route relevance, query preservation, accidental indexing/noindex changes, sitemap/canonical agreement, and attribution regressions.

## Work log

- 2026-10-05: created isolated worktree from the published production release branch and started live verification.
- 2026-10-05: production audit found 4,384 sitemap URLs versus 18,544 before cutover; only `/` overlaps the frozen legacy sitemap. Missing inventory: 18,307 `/p`, 144 `/c`, 87 `/brand`, five static/legal URLs.
- 2026-10-05: verified HTTP/www canonicalization, current robots, missing image sitemap and advertising feed, representative old-route 404s, and a `/product` redirect that drops query parameters.
- 2026-10-05: merged the existing full SEO/legacy continuity work, preserving the released Vinext dependency versions.
- 2026-10-05: added persisted first-touch/last-non-direct attribution to every lead form and propagated UTM/`yclid`/Metrika ClientID through validation, storage and the production lead bridge.
- 2026-10-05: replaced generated robots metadata with an explicit route containing Yandex `Clean-param` and added a guarded loopback bridge for the existing Yandex advertising feed.
- 2026-10-05: focused advertising, quote, production and SEO tests passed 44/44; final full suite passed 381/381; full ESLint passed with zero errors and one existing Metrika noscript warning; Vinext production build passed.
- 2026-10-05: local production smoke returned `200` for representative `/p`, `/c`, `/brand`, preserved `yclid` and UTM through a one-hop `308`, and produced a canonical sitemap with 19,334 URLs and 18,323 image entries. Feed route correctly failed closed with `503` while the legacy upstream was absent locally.
- 2026-10-05: privacy and consent pages remain accessible but are noindex/outside sitemap until owner verification.
- 2026-10-05: release candidate committed on `codex/postlaunch-seo-routing-20261005`; production remains unchanged pending an authenticated deployment and post-deploy verification.

## Release constraints

- No production deployment was attempted. Current SSH authentication to `root@159.194.235.32` is unavailable in this task.
- The advertising feed bridge depends on the legacy service continuing to listen on `127.0.0.1:3108`; verify the upstream and public feed before/after deploy.
- Final legal entity/NAP and privacy/consent wording remain owner-verification gates and must not be guessed.
