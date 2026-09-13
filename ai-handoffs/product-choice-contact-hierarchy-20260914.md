# Product choice and manager hierarchy — 2026-09-14

## Agent and branch

- Agent: Codex
- Branch: `codex/product-choice-contact-hierarchy`
- Base: `66fad2ff67588da527faf3c2e9d979f010325086`
- Worktree: `C:/Users/user/Documents/ChatGPT/7TOOL/.codex-tmp/product-choice-contact-hierarchy-20260914`

## Goal

Improve the product buy-box hierarchy so buyers immediately understand that other sizes exist, can reveal the complete feed-backed range, and can read/contact the assigned manager without competing with the primary quote CTA.

## Scope

- Make total, visible, and remaining variant counts explicit near the selector.
- Strengthen the all-sizes action and its desktop/mobile behaviour without changing selection truth.
- Increase manager identity/contact legibility moderately.
- Replace temporary Telegram/MAX letter circles with compact official brand marks from first-party sources while retaining accessible text labels.
- Preserve privacy-safe analytics, exact links, and existing layout architecture.

## Implemented

- The collapsed selector states `12 из 49`, exposes a stronger neutral `Все 49 размеров` action above the options, and repeats the discovery path after the initial twelve as `Есть ещё 37 размеров`.
- Expanding the selector continues to fetch the complete feed-backed group, reveals search, renders 36 choices initially, and offers the remaining 13 through the existing progressive action.
- Open/close events carry only allowlisted product and variant context; no contact or customer data is included.
- Product-page manager typography and touch targets were enlarged without changing compact cards elsewhere.
- Telegram uses the official paper-plane SVG geometry and `#229ED9`; MAX uses the official mark geometry and brand gradient colours. Both remain inline SVGs to avoid external requests and layout shift. First-party references: `https://telegram.org/img/t_logo.svg`, `https://go.max.ru/brandbook`.

## Verification

- Focused tests: `tests/variant-presentation.test.mjs` and `tests/storefront-acceptance.test.mjs` — 16 passed.
- Full regression: 149 passed, 0 failed.
- Full ESLint: passed.
- Production build: passed.
- Release smoke: 46 checks passed on loopback port 3187.
- Browser acceptance: desktop 1280 px and mobile 390 × 844 px; no horizontal overflow; both all-size entry points are visible, expansion exposes search and 36 + 13 progressive choices, manager heading resolves to 19 px on desktop / 18 px mobile, direct contact values to 12 px, both official marks render at 31 px.
- Server release copy: 149 tests passed, full ESLint passed, and production build passed.
- Candidate and final active-process smoke: 46/46 checks passed on ports 3199 and 3000; no customer, quote, or delivery write action was invoked.
- Active PM2 cwd was verified as `/var/www/7tool-release-20260914-product-hierarchy-5dc1d22/design-exploration/staging-pilot`; the temporary candidate was removed and the PM2 list was saved.
- External HTTPS gate remains `401` without Basic Auth. Production `https://7tool.ru/` remains `200` and its process was not restarted or reconfigured.
- Post-release capacity: 3.0 GB free on `/var/www`.
- Forms were not submitted. No feed publication, credential, DNS, production process, or external-delivery change was performed.

## Local preview

- `http://127.0.0.1:3187/product/sverla-koronchatye-lzhs?variant=A9021#variants`

## Test release

- URL: `https://test.7tool.ru/product/sverla-koronchatye-lzhs?variant=A9021#variants`
- Active release: `/var/www/7tool-release-20260914-product-hierarchy-5dc1d22`
- Preserved rollback: `/var/www/7tool-release-20260914-product-recommendations-11d11a2`
- The deployed commit is descended from `66fad2f`, so the earlier quote-item media/link fixes are included.

## Commit

- `6ccbe05` — `feat: clarify product size choices and contacts`
