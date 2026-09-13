# Storefront test release — 2026-09-13

- Agent: Codex
- Branch: `codex/storefront-test-release`
- Base commit: `27e6e80`
- Scope: isolated release of `design-exploration/staging-pilot` to `test.7tool.ru`; no production switch, feed publication, production database migration, DNS change, or external lead delivery.
- Completion criteria: explicit staging-host admin access remains deny-by-default, full local validation passes, the candidate runs as a separate PM2 process on port 3000, authenticated test-domain smoke passes, and rollback remains the stopped test process/release only.
- Files owned: staging-pilot manager access configuration/tests, the test-only PM2 configuration, this handoff, and the new test-only server release directory.

## Status

Validated locally; staging deployment in progress.

## Checks

- Targeted manager access tests: 6/6 passed.
- Full test suite: 91/91 passed.
- ESLint: passed.
- Production build: passed.
- Local production-server smoke: 44/44 passed on port 3190.

## Commit

Pending deployment commit.
