# Home visual and CTA correction — 2026-10-08

- Agent: Codex
- Branch: `codex/home-visual-cta-fix-20261008`
- Goal: remove the duplicated `В запрос` action and restore a large, image-led production-task entry on the homepage.
- Scope: homepage production-task component/styles, feed product purchase actions, focused regression tests.
- Ready when: focused and full checks pass, 1440/1024/390/320 layouts are verified, and the noindex preview is published to `new.7tool.ru`.
- Production: out of scope; `7tool.ru` must not be changed.

## Verification

- Focused regression suite: 58 passed.
- Full repository suite: passed before the final CSS-only consolidation; focused suite rerun afterward.
- ESLint: 0 errors, one pre-existing `YandexMetrika.tsx` image warning.
- Production build: passed.
- Browser QA: 1440, 1024, 390 and 320 px; no horizontal overflow; no exact `В запрос` CTA remains on the feed category route.
- Preview indexing contract: to be checked again after deployment.

## Commit

Implementation: `a1597b7`
