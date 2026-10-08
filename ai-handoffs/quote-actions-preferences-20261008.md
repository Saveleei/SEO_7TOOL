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
- No customer form was submitted, no external test lead was sent, and no staging or production deployment was performed.
- Implementation commit: `afd5244`.
- Reviewer focus: exercise a confirmed-in-stock exact variant to visually review the optional short-form attachment disclosure against live catalog data; automated coverage passes.
