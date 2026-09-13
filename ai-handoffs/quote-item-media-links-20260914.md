# Quote item media and product links — 2026-09-14

## Goal

Fix the category/table → quote-draft path so an exact selected variant keeps its supplier image and a working link back to that exact product variant.

## Scope

- Add variant image and canonical product-variant href to the feed card model.
- Pass that complete context from desktop table, mobile table, and card-view add-to-quote actions.
- Make both quote-item image and title open the exact product variant.
- Keep restored local drafts bounded to safe local product URLs and supported image URLs.
- Add regressions for source data, rendering, and sanitization.

## Constraints

- Worktree: `C:/Users/user/Documents/ChatGPT/7TOOL/.codex-tmp/quote-item-media-links-20260914`
- Branch: `codex/quote-item-media-links`
- Base: `ec77fe63ddfce9fe8c34c8590b157cbf2c8b35dc`
- No production/test deployment and no external form submissions.

## Verification

- Implementation commit: `407a50b` (`fix: preserve quote item media and links`).
- Exact LZTS-021 selection now carries supplier image `qC8qy2gUbYAimUunWKdy.png` and `/product/sverla-koronchatye-lzts?variant=A12935#variants` into the quote draft.
- The quote title and image are internal product anchors; the title has an explicit accessible label and visible link treatment.
- Restored drafts reject external/protocol-relative product links, insecure remote images, and unsupported URL parameters.
- Narrow tests: 8/8 passed.
- Full tests: 148/148 passed.
- Project lint (`eslint . --ignore-pattern dist --ignore-pattern .next`): passed.
- Production build: passed.
- Read-only release smoke: 46/46 routes/access checks passed.
- Browser acceptance on desktop and 390 × 844 mobile: image rendered, exact href present, and category → quote → selected product transition succeeded. No form was submitted.
- Tooling note: a diagnostic raw `eslint .` run accidentally included generated `dist/` and exhausted the Node heap; the repository's configured lint command, which excludes generated output, passed.

## Preview

- Local only: `http://127.0.0.1:3185/`
- Server started with `QUOTE_TEST_MODE=1`; external delivery remains disabled.
