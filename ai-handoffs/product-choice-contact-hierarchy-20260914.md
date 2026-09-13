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
- Forms were not submitted. No deployment, feed publication, credential, DNS, or live-service changes were performed.

## Local preview

- `http://127.0.0.1:3187/product/sverla-koronchatye-lzhs?variant=A9021#variants`

## Commit

- `03d6dde` — `feat: clarify product size choices and contacts`
