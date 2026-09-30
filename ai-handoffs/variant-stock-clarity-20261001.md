# Variant stock clarity and mobile actions

- Agent: Codex
- Branch: `codex/variant-stock-clarity-20261001`
- Base commit: `28de9db`
- Scope: `design-exploration/staging-pilot/` product variant selector, category expanded variants, mobile purchase actions, responsive styles, and focused regression tests.
- Goal: expose every product size immediately, distinguish confirmed in-stock variants from order/unknown variants without false promises, make category size choices scannable, and prevent mobile action labels from clipping.
- Completion criteria: truthful availability state derived from existing feed data; desktop/mobile browser QA; targeted tests, full tests, lint, and production build pass; commit and handoff SHA recorded.
- Constraints: do not change production, `new.7tool.ru`, DNS, feeds, cron, credentials, or send external forms without a separate explicit deployment authorization.
- Status: complete; commit SHA to be recorded after commit.

## Implemented

- Product pages expose the complete size matrix immediately. Size is the primary label, supplier article remains secondary, and a compact search remains available for long ranges.
- Confirmed positive feed stock is marked with a green border and dot. Unknown/order states use a neutral dashed treatment and do not receive a false stock promise.
- Category card and table variants now lead with buyer-facing size or the category decision value. Exact-position actions use the shorter readable label `Добавить в КП` on desktop and mobile.
- Mobile action controls wrap safely and preserve a 44–48 px target instead of clipping the label.
- Homepage task cards now expose direct links to the nearest product categories on desktop, while retaining a compact hierarchy on mobile.
- Trust photography uses six distinct existing photographs: warehouse overview, separated storage, pallet storage, employee picking, loading into a transport-company vehicle, and tooling storage. Captions are kept on a separate readable surface instead of over the photograph.
- Catalog/menu and task imagery retains the whole equipment silhouette through `object-fit: contain` and stable frames.

## Verification

- Focused regression suite: 36/36 passed.
- Full test suite: 335/335 passed.
- ESLint for all changed source and test files: passed.
- Full project ESLint: passed.
- Vinext production build: passed; 24 catalog categories generated.
- Local server HTML smoke: homepage and product page returned content; 49 size states rendered; full-range copy present; obsolete `Добавить позицию` label absent.
- Desktop visual QA completed for homepage, expanded catalog menu and direct task/category navigation. Browser inspection confirmed complete, uncropped catalog media and distinct trust photographs. Responsive behavior is additionally covered by focused CSS/contract tests.

## Safety

- No deployment, DNS, feed, cron, credential, production, `test.7tool.ru`, or `new.7tool.ru` change was made.
- No form or external delivery was triggered.
