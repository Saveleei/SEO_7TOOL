# Desktop KP counter readability

- Agent: Codex
- Branch: `codex/kp-counter-desktop-20261007`
- Base: `6a431ed6b26a86fb80a137559efd33a638ad6fd6`
- Goal: make the desktop header quote-request count easier to read and expose the configured email directly on wide desktop and inside the mobile catalog menu.
- Files owned: `design-exploration/staging-pilot/app/globals.css`, `design-exploration/staging-pilot/app/ui/PilotHeader.tsx`, `design-exploration/staging-pilot/app/ui/HeaderCatalogMenu.tsx`, `design-exploration/staging-pilot/tests/readability-contract.test.mjs`, this handoff.
- Acceptance: desktop badge is at least 22×22 px, uses 12 px tabular numerals, expands for multi-digit counts, header action stays 44 px high, wide desktop shows the configured email, compact desktop/mobile keep email in an existing menu, and the mobile action bar remains unchanged.
- Checks:
  - focused Node tests: 13/13 passed;
  - ESLint: 0 errors, one pre-existing `YandexMetrika.tsx` image warning;
  - production `vinext build`: passed;
  - desktop visual QA at 1536 px: email fits without collision; KP badge verified with counts 1 and 2;
  - mobile visual QA at 390 px: six direction accordions remain readable, email is a full-width menu action, no horizontal overflow.
- Commit: pending.
- Reviewer focus: desktop header alignment at zero, one-digit and multi-digit counts; verify mobile action bar is unchanged.
