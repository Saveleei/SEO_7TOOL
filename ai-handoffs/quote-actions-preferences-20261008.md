# Quote actions and catalog preference

- Agent: Codex
- Branch: `codex/quote-actions-preferences-20261008`
- Base: `2c01e16`
- Application: `design-exploration/staging-pilot`

## Goal

Complete the agreed B2B buying flow for the staging storefront: clear variant-first actions, a compact quick-request form, an adaptive add-to-quote confirmation, and remembered catalog presentation preferences without changing the approved mobile two-column default.

## File ownership

- Quote cart and add confirmation UI.
- Quick request UI, validation, and request intake contract.
- Category view switch and its preference persistence.
- Related CSS and automated tests.

## Acceptance criteria

- Multi-variant product series require a variant/type-size choice before a request can be sent.
- An exact item exposes `Получить КП`, `В запрос`, and `Быстрый запрос` with a consistent hierarchy.
- Adding an item opens a useful desktop dialog or mobile bottom sheet with continue/open-request actions.
- Every customer request requires only a phone number among contact fields. Name, email, company, city, comment, and requisites remain optional; the legally required consent checkbox is unchanged.
- Explicit list/grid choices are remembered separately for desktop and mobile while fresh sessions keep the category/device defaults.
- Request persistence and configured delivery handoff are covered by automated tests; no external test lead is sent.
- Relevant tests, full test suite, lint, build, and visual checks at 1440/390/320 px pass.

## Completion record

- Implemented one CTA hierarchy across category cards, tables, the variant picker, and the product buy box: `Получить КП`, `В запрос`, and `Быстрый запрос` only when the buyer has selected an exact eligible execution.
- Added an adaptive add-to-quote confirmation with item identity, price, quantity, request totals, `Продолжить выбор`, and `Открыть запрос КП`.
- Raised the request drawer and confirmation above the full-screen variant picker after responsive browser QA exposed the stacking collision.
- Added optional name, email, company, city, comment, INN, and requisites attachment fields while keeping phone as the only mandatory contact field.
- Forwarded the optional contact name through the durable request store and the configured production intake bridge.
- Added separate remembered desktop/mobile catalog view preferences; the fresh mobile default remains a two-column grid and the fresh desktop default remains the category-recommended table/grid view.
- Automated checks: 415 tests passed; lint passed with one existing `YandexMetrika.tsx` image warning; production build passed.
- Visual QA passed at 1440, 390, and 320 px with no horizontal overflow. Confirmed the two-column mobile grid, mobile bottom-sheet confirmation, visible quote drawer, and phone-only contact requirement.
- Before publication approval, no customer form was submitted, no external test lead was sent, and no deployment was performed.
- Implementation commit: `afd5244`.
- Reviewer focus: exercise a confirmed-in-stock exact variant to visually review the optional short-form attachment disclosure against live catalog data; automated coverage passes.

## Preview deployment record

- Published to `https://new.7tool.ru/` on 2026-10-08; production `https://7tool.ru/` was not targeted by the preview deployment scripts.
- Active preview release: `/var/www/7tool-release-20261008-quote-actions-d51aba5/design-exploration/staging-pilot`.
- Source revision: `d51aba53d890374426c0f43e94c0242d7307863a`.
- Rollback source: `/var/www/7tool-new-shared/backups/20261008-before-quote-actions-d51aba5/active-release.txt`.
- Candidate verification on port `3273`: 78 focused tests passed, Vinext production build passed, noindex/robots/sitemap checks passed, primary routes returned successfully, and `/admin/catalog` returned the expected `307` authentication redirect.
- Public verification after the atomic switch: homepage/category/product routes returned `200`; `X-Robots-Tag: noindex, nofollow, noarchive`, `robots.txt` disallow, empty sitemap, and absence of Yandex Metrika were retained.
- Browser verification confirmed the exact-variant actions `Получить КП`, `В запрос`, and `Быстрый запрос`. The short form requires phone plus consent; name, email, company, comment, INN, and requisites attachment remain optional. No form was submitted.
- Preview PM2 process `7tool-storefront-new` was online with zero restarts after activation. Production returned `200`; an independent production rollout already running on the host changed its own PM2 instance after the preview activation window and was not modified or rolled back by this task.
- Server disk after activation: approximately `2.4 GB` free (`94%` used). Keep the immutable rollback release, but schedule storage cleanup or capacity growth before the next build-heavy deployment.
- The temporary deployment SSH key was removed from both server authorization files and from the local worktree after verification.
- Deployment scripts: `ai-handoffs/prepare-quote-actions-preview-20261008.sh` and `ai-handoffs/activate-quote-actions-preview-20261008.sh`.
