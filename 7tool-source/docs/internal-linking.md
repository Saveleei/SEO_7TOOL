# PHASE 13 — Internal Linking Engine

Статус: implemented as a human-published, evidence-bound semantic navigation layer. Migration 011 and workflows were verified only on isolated SQLite databases; production migrations and real link sets were not created.

## Principle

The engine does not create links from keyword overlap. Every transition answers one editorial question: **«Какой следующий логичный вопрос пользователя?»**

```text
Current public page
  → normalized relation/proof
  → neutral next user question
  → deterministic anchor and current public target
  → human approval
  → human publication
```

A link is hidden immediately when the source, target or proof is no longer current. A deterministic scan then records the published set as `STALE`.

## Relation and proof contract

| Relation | Required proof |
|---|---|
| ARTICLE → CATEGORY | the article's reviewed `category_slug`; category must be public and contain a public product |
| ARTICLE → PRODUCT | current `content_products` row and public product |
| ARTICLE → ARTICLE | current `content_related` row and public non-guide/non-comparison target |
| PRODUCT → ARTICLE | reverse `content_products` row and public article |
| PRODUCT → COMPATIBILITY | the public compatibility table currently contains the product in a verified row |
| CATEGORY → GUIDE | public `GUIDE` in the same category |
| CALCULATOR → PRODUCT | product exists in the current verified selector dataset; an out-of-dataset exception is HUMAN-only and requires a recorded review basis |
| COMPARISON → PRODUCT | current `content_products` row and public comparison/product pair |

Anchors are generated from the relation and current target title; arbitrary anchor text is not accepted. A reviewer can supply a concise `nextQuestion`, or use the deterministic relation-specific default. Every question must end with `?`.

## Safety and lifecycle

`semantic_link_sets` is immutable in content and versioned per source. The lifecycle is:

```text
DRAFT → human APPROVED → human PUBLISHED
    ↘ human REJECTED
PUBLISHED + changed evidence → hidden immediately → STALE
new PUBLISHED version → old version SUPERSEDED
```

AI-assisted and system actors may create drafts. Approval and publication require a `HUMAN` actor. Items, reviews and audit events are append-only. The scanner rejects:

- markup or external URLs in anchors/questions;
- promotional or lead-capture copy;
- malformed next questions or anchors;
- self-links;
- duplicate relation/target pairs;
- sets with more than eight transitions.

The public read path recomputes source, target, proof, anchor, question and evidence fingerprint. Database status alone is never enough to expose a set.

## Public integration

`SemanticNextSteps` renders only a current `PUBLISHED` set under the heading «Следующий логичный вопрос» on:

- `/articles/[slug]` for ARTICLE and COMPARISON sources;
- `/p/[slug]` for PRODUCT sources;
- `/c/[slug]` for CATEGORY sources;
- `/tools/[slug]` for non-compatibility CALCULATOR sources.

On article pages, URLs present in the semantic block are removed from the legacy “Товары по теме” and “Материалы по теме” lists to avoid duplicate page links. Compatibility tables remain targets rather than calculator sources.

## Migration 011

`scripts/migrations/011_semantic_internal_linking.sql` adds:

- `semantic_link_sets` — versioned source projection and publication lifecycle;
- `semantic_link_items` — normalized relation, target, question, anchor and evidence snapshot;
- `semantic_link_reviews` — append-only human review decisions;
- `semantic_link_audit_events` — append-only actor/action history;
- partial public uniqueness and public/queue/history/target indexes;
- immutability and parent-contract triggers.

The migration is registered by the existing checksum/backup-gated runner but was not applied to production.

## CLI

The CLI does not apply migrations. `discover` and `list` are read-only; every mutation requires an input file and explicit `--apply`.

```powershell
npm run seo:links -- discover --input=source.json --db=isolated.db
npm run seo:links -- draft --input=reviewed-links.json --db=isolated.db --apply
npm run seo:links -- approve --input=human-review.json --db=isolated.db --apply
npm run seo:links -- publish --input=human-review.json --db=isolated.db --apply
npm run seo:links -- stale --input=stale-scan.json --db=isolated.db --apply
npm run seo:links -- list --db=isolated.db
```

`discover` returns candidates from normalized relations only; it does not create a draft or infer relationships from titles, keywords or free-form copy.

## Verification

`tests/semantic-linking.test.mjs` covers all eight relation types, candidate discovery, HUMAN-only approval, immutable items, immediate suppression after evidence change, deterministic stale marking, safety hard fails, index selection and clean migration rollback. Full project regression, TypeScript validation, numbered migration dry-run and an isolated production build are required before handoff.

## Human-gated next steps

- apply migration 011 first to a restored production backup, then only after explicit approval to production;
- review actual candidate sequences and next questions per source page;
- publish link sets with real editor identities;
- add administrative queue UI and role mapping;
- measure link clicks and downstream outcomes in PHASE 18.

# STOP / HUMAN REVIEW REQUIRED
