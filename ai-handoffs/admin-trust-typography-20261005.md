# Admin, trust photos, and typography — 2026-10-05

## Goal

Restore a clear owner path into the production manager workspace, make homepage trust photography safely self-service, and improve the storefront type scale without changing catalog URLs, SEO ownership, credentials, or live services.

## Scope

- Diagnose `/test/access` and `/test/settings/trust` on `7tool.ru`.
- Improve the manager entry and trust-photo workflow where the current UI is unclear.
- Review and refine typography at mobile, standard desktop, and ultrawide widths.
- Add focused regression coverage and run the relevant build checks.

## Safety

- Branch: `codex/admin-trust-typography-20261005`.
- Base: `8662837` (the currently documented SEO release lineage).
- No production deployment, credential change, data migration, or Beget mutation without explicit user approval.
- Preserve all unrelated worktrees and user changes.

## Findings

- `https://7tool.ru/test/access` is live and returns 200; protected settings correctly redirect there.
- The expected owner-friendly `https://7tool.ru/admin` address returns 404 on the current release. This is the primary discoverability failure.
- The trust editor already uploads guarded JPG/PNG/WebP assets and requires an explicit save, but its production copy and typography are prototype-oriented and too small.
- The public CSS names Inter without loading it. Windows therefore falls back to Arial, weakening the intended hierarchy and making UI copy look dated.

## Status

- Implemented stable `/admin` and `/admin/trust` entry routes.
- Improved the owner login and trust-photo publish flow.
- Added a no-download, Cyrillic-complete modern system typography stack plus large-desktop and admin readability corrections.
- Focused owner-flow, trust-content, authentication, readability, and visual-content tests pass.
- Full suite passes: 393/393 tests.
- Full ESLint passes with the one pre-existing `YandexMetrika.tsx` `<img>` warning and no errors.
- Vinext production build passes and includes `/admin` plus `/admin/trust`.
- No production changes made.

## Production intake observation

- Legacy `/api/lead` notification transport is online. SMTP and MAX credentials are configured and the minute worker is present.
- Aggregated SQLite state at audit time: 91 stored legacy leads; 83 marked emailed; 28 marked sent to MAX. The most recent successful email and MAX sends were 2026-10-05 11:44 MSK. Historical MAX failures (21) have no attempts after 2026-09-08; no email failure or pending rows were present.
- The new storefront bridge is configured with `QUOTE_WORKSPACE_ENABLED=1`, `QUOTE_INTAKE_DELIVERY_ENABLED=1`, and the fixed endpoint `https://7tool.ru/api/lead`, but the production crontab does not run `scripts/process-quote-intake-outbox.mjs`.
- One new-storefront quote request created at 2026-10-05 23:30 MSK remains `pending`; no delivery journal exists. It has not reached legacy email or MAX.
- This audit did not run the bridge, change cron, replay the request, or expose any contacts or credentials. Enabling the bridge and replaying the pending request requires explicit authorization because it sends external notifications.
