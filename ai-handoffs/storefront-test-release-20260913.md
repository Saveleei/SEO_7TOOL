# Storefront test release — 2026-09-13

- Agent: Codex
- Branch: `codex/storefront-test-release`
- Base commit: `27e6e80`
- Scope: isolated release of `design-exploration/staging-pilot` to `test.7tool.ru`; no production switch, feed publication, production database migration, DNS change, or external lead delivery.
- Completion criteria: explicit staging-host admin access remains deny-by-default, full local validation passes, the candidate runs as a separate PM2 process on port 3000, authenticated test-domain smoke passes, and rollback remains the stopped test process/release only.
- Files owned: staging-pilot manager access configuration/tests, the test-only PM2 configuration, this handoff, and the new test-only server release directory.

## Status

Complete. The accepted storefront concept is running behind the existing Basic Auth gate at `https://test.7tool.ru/`. Production remains on its separate port and process.

## Checks

- Targeted manager access tests: 6/6 passed.
- Full test suite: 91/91 passed.
- ESLint: passed.
- Production build: passed.
- Local production-server smoke: 44/44 passed on port 3190.
- Server install from `pnpm-lock.yaml`: passed.
- Server ESLint: passed.
- Server full test suite: 91/91 passed.
- Server production build: passed.
- Server loopback smoke: 44/44 passed on port 3000, including test administrator sign-in; no customer/quote/delivery POST was made.
- External HTTPS gate: `test.7tool.ru` returns the expected `401` Basic Auth challenge before credentials; `7tool.ru` remains `200`.
- Runtime: `7tool-storefront-test` online with zero restarts; `7tool-prod` remains online and was not restarted or reconfigured.
- Post-release capacity: 15 GB disk available, 1.6 GiB memory available, 2.0 GiB swap available, low load average.

## Commit

- `e0b1f09` — explicit, deny-by-default staging-host administrator session.
- `a83c01d` — reproducible isolated PM2 configuration for the test process.

## Server isolation and rollback

- Release directory: `/var/www/7tool-release-20260913-storefront-e0b1f09`
- Persistent test-only data: `/var/www/7tool-test-shared/quote-requests`
- Test process: `7tool-storefront-test`, port 3000
- Production process: `7tool-prod`, separate port 3108
- External delivery remains disabled by `QUOTE_TEST_MODE=1`.
- Rollback requires only stopping `7tool-storefront-test`; no production symlink, cron, DNS, database or Nginx configuration was changed.
