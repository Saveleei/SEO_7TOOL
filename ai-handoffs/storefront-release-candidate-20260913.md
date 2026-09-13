# Storefront release candidate — handoff

## Scope

- Branch: `codex/storefront-release-candidate`
- Base: `1fe9a96` (`codex/quote-delivery-workspace`)
- Application: `design-exploration/staging-pilot`
- Status: complete
- Implementation commit: `4899d2f` (`test: add storefront release candidate smoke`)

## Goal

Freeze one coherent local release candidate that contains the accepted customer storefront and the complete local quote workflow. Prove the critical path from public discovery to protected administration with a repeatable loopback-only smoke check. Do not add speculative product features or touch production.

## Included accepted surfaces

- Homepage, production-task navigation, catalog and subcategories.
- Feed-backed filters, card/table views and guided selection.
- Search, exact product variant, comparison and accessories.
- Quote request drawer, local validated request storage and manager workspace.
- Quote builder, technical presentation, VAT 22%, PDF revisions and approval.
- Role-based staff access, delivery package, internal held outbox and administrator journal.

All named implementation branch tips from `codex/storefront-concept-v2` through `codex/quote-delivery-workspace` were verified as ancestors of base commit `1fe9a96`; no cherry-pick or conflict resolution is required.

## Acceptance criteria

- One dedicated integration branch remains clean and buildable.
- A reusable smoke script refuses non-loopback origins.
- Public homepage, catalog, representative categories, search, product and comparison routes return non-error responses.
- Staff routes redirect anonymous visitors and load after local administrator sign-in.
- No form is submitted and no external delivery endpoint is called by the smoke check.
- Existing narrow/full tests, lint and production build pass.
- The exact local preview URL and verification results are recorded here.

## Owned files

- `design-exploration/staging-pilot/scripts/smoke-release-candidate.mjs`
- `design-exploration/staging-pilot/tests/storefront-release-candidate.test.mjs`
- `design-exploration/staging-pilot/package.json`
- `ai-handoffs/storefront-release-candidate-20260913.md`

## Safety boundary

- Local loopback only. The smoke script must reject production, LAN and arbitrary HTTP origins.
- No production deployment, Beget/DNS change, credential change, migration, feed publication or external test lead.
- No write action except local administrator sign-in; customer and delivery forms remain untouched.

## Verification

- Targeted release-candidate tests: 3/3 passed.
- ESLint for changed JavaScript files: passed.
- Full ESLint: passed.
- Full test suite: 86/86 passed.
- Production build: passed.
- Loopback release smoke at `http://127.0.0.1:3180`: 15/15 checks passed.
  - Eight representative public routes returned HTTP 200.
  - Three protected staff routes redirected anonymous visitors to `/test/access`.
  - Local administrator sign-in succeeded; all three protected staff routes then returned HTTP 200.
- No customer form, quote write API, delivery write API or external transport was called.

## Local preview

- Storefront: `http://127.0.0.1:3180/`
- Staff access: `http://127.0.0.1:3180/test/access`
- The preview uses `QUOTE_TEST_MODE=1` and local ignored test data only.
