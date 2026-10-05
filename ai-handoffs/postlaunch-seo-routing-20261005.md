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
- 2026-10-05: focused advertising, quote, production and SEO tests passed; the final release suite passed 382/382; full ESLint passed with zero errors and one existing Metrika noscript warning; Vinext production build passed.
- 2026-10-05: local production smoke returned `200` for representative `/p`, `/c`, `/brand`, preserved `yclid` and UTM through a one-hop `308`, and produced a canonical sitemap with 19,334 URLs and 18,323 image entries. Feed route correctly failed closed with `503` while the legacy upstream was absent locally.
- 2026-10-05: privacy and consent pages remain accessible but are noindex/outside sitemap until owner verification.
- 2026-10-05: the active production catalog exposed duplicate offer IDs between legacy standalone pages and newer grouped pages. Blocking every participant would have removed 69 historical URLs from the production sitemap. The final rule preserves every owner present in the frozen legacy sitemap, preserves one unambiguous standalone owner when no legacy owner exists, and quarantines only new/ambiguous duplicates. The real `G1031` title/spec conflict remains quarantined.
- 2026-10-05: deployed and publicly accepted commit `7a2426615256badd7d0b1be04b23d170165a286a` as the stable `7tool-prod` process on port `3260`.
- 2026-10-05: added a deterministic Yandex feed parity audit covering offer identity, canonical URL, price, availability, currency, category, image, name, vendor and SKU.
- 2026-10-05: audited the live 3,993-offer XML against the bundled storefront snapshot. The feed is dated `2026-09-11 07:15` and fails parity: 5 unknown offers, 50 price, 114 availability and 10 category mismatches; 3,988 recognized links are non-canonical `?variant=` URLs. Production was not changed.
- 2026-10-05: after the feed audit addition, the complete local suite passes 383/383 and the changed audit/test files pass ESLint with zero findings.

## Production release

- Release: `/var/www/7tool-release-20261005-postlaunch-seo-7a24266/design-exploration/staging-pilot`.
- Release archive: `7tool-postlaunch-seo-7a24266.tar.gz`, SHA-256 `881e0d28879b0df82e8cc5816923f5c66951f9835c200905ce5b2d591f55a7c4`. The uploaded server copy was removed after extraction; the local archive remains under `.release-artifacts/`.
- Commits: `5cfb796` (SEO continuity), `80dd25b` (public-only release smoke), `7a24266` (legacy SEO ownership for duplicate offers).
- Server gates on the exact final archive: tests 382/382, production preflight 18/18, ESLint 0 errors with the existing Metrika pixel warning, Vinext production build pass.
- Public sitemap: 19,330 canonical URLs and 18,341 image entries against the active production catalog. Every frozen legacy URL remains canonical/indexable except `/kontakty` (one-hop `308` to `/contacts`), the two unconfirmed legal pages, and five `G1031` URLs quarantined for a verified title/spec conflict.
- Public redirect acceptance: `/product/*` → `/p/*` and `/catalog/category/*` → `/c/*` are one-hop `308` redirects and preserve `yclid`, UTM and other query parameters.
- Public advertising feed: `200`, SHA-256 `a5dd01a41e9050c0a01f924333ffceae1d22678b63d39182c9b7dfed62b51ff2`, byte-identical to the legacy upstream on `127.0.0.1:3108`.
- HTTP and `www` canonicalize to `https://7tool.ru`; production Host has no noindex header; `new.7tool.ru` remains noindex. Exact `/api/lead` still reaches the legacy bridge and returns the expected `405` for GET.
- Stable `7tool-prod` and `7tool-legacy-lead` were online with zero restarts at acceptance. One `502` occurred during the few-second process replacement window; the post-start verification window contained zero 5xx responses. One aborted static stream logged `Premature close`; the referenced JPEG then downloaded completely and no new error was added.
- Quote-data backup: `/var/www/7tool-production-shared/backups/quote-data-before-seo-7a24266-20261005T185241Z.tar.gz`, SHA-256 `8029a2a688ed2751195c5eead7a33db6f210ce81d7d82d5e1c24fe2c568e35ee`.
- Pre-cutover PM2 dump: `/root/.pm2/dump.pm2.before-postlaunch-seo-7a24266`. Stable post-cutover PM2 state was saved.
- The failed/non-public `80dd25b` candidate and uploaded server archives were removed after acceptance; they remain reproducible from Git and the local archives. The previous production release `11b3134`, legacy release and nginx rollback configuration remain intact.

## Rollback

Nginx still targets port `3260`, so the narrow rollback is to delete only `7tool-prod`, source `/var/www/7tool-production-shared/storefront.env`, and start `ecosystem.production.config.cjs` from `/var/www/7tool-release-20261005-production-release-11b3134/design-exploration/staging-pilot` with `PORT=3260` and `PM2_APP_NAME=7tool-prod`. Verify loopback and public routes before `pm2 save`. Do not rewind quote data or the shared catalog.

## Remaining gates

- The advertising feed bridge depends on the legacy service continuing to listen on `127.0.0.1:3108`.
- Final legal entity/NAP and privacy/consent wording remain owner-verification gates and must not be guessed; those pages remain accessible but noindex/outside sitemap.
- Yandex Direct campaign final URLs were not edited in the advertising account. The site now accepts old and preview-style links safely, preserves click parameters, and exposes the stable feed URL; account-level destination cleanup remains a separate authenticated operation.
- The legacy advertising feed must not be replaced until the legal seller is confirmed and a preview generated from the active production catalog passes `feed:audit`; the current route remains fail-closed behind the legacy loopback bridge.
