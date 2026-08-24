# PHASE 8 — Content Opportunity Engine

Статус: implemented as a deterministic proposal and review layer. Content assets, articles, routes and publication were not created.

## Purpose

Engine объединяет evidence PHASE 3–7 и выдаёт одно из четырёх решений:

`CREATE`, `UPDATE`, `MERGE`, `REJECT`.

```text
semantic cluster + reviewed SERP + review pains + commerce state
  + reviewed business input + approved score model
  → scored proposal
  → CREATE / UPDATE / MERGE / REJECT
  → human review
```

`CREATE` означает только «кандидат на будущую страницу». PHASE 8 не создаёт URL или контент.

## Migration 006

`scripts/migrations/006_content_opportunity_engine.sql` adds:

- `score_models` — immutable versioned weights and thresholds;
- `opportunity_business_inputs` — reviewed business priority and margin inputs with history;
- `content_opportunities` — current proposal per search intent;
- `opportunity_pain_points` — current selected research pains;
- `opportunity_evaluations` — append-only scoring history;
- `opportunity_evaluation_pain_points` — exact pain evidence used by each historical evaluation.

Миграция additive, checksum-controlled и запускается существующим backup-gated runner. В production она не применялась.

## Required evidence

Evaluation блокируется, если отсутствует хотя бы один обязательный слой:

- active intent with exactly one semantic cluster;
- approved immutable score model;
- current human-reviewed business input;
- human-reviewed Google+Yandex SERP assessment;
- SERP snapshots не старше model threshold, default 30 days;
- source keyword for primary query/demand;
- commerce tables for current product relevance and availability.

Marketplace pain points optional и включаются только явным списком с relevance 0–100. Их отсутствие даёт `painPointStrength=0`, но не придумывает пользовательскую проблему.

## Opportunity fields and sources

| Component | Source |
|---|---|
| topic, category, cluster, intent | `search_intents`, `keyword_clusters` |
| primary keyword, Wordstat demand | `seo_keywords` + `sources=WORDSTAT` |
| Google demand signal | imported `GSC` keyword observation when available |
| SERP/page type, content gap, differentiation | reviewed `serp_assessments` |
| pain strength | selected `pain_points`, mentions, priority and relevance |
| business priority, margin score | reviewed `opportunity_business_inputs` |
| product relevance/availability | current non-draft products and available inventory |
| competition | versioned heuristic from commercial and marketplace SERP density |
| cannibalization | indexable existing URL mappings and keyword risk |
| duplicate risk | similarity to another active opportunity in the same category |

Missing Google/GSC demand remains `NULL`; it is not fabricated from Wordstat.

## Configurable score model

Default version: `7tool-opportunity-v1`.

Factors:

`searchDemand`, `intentValue`, `businessPriority`, `productRelevance`, `contentGap`, `painPointStrength`, `productAvailability`, `marginBusiness`, `differentiation`, `competitionEase`.

Score uses a weighted geometric mean so a weak mandatory dimension materially lowers the result:

```text
BaseScore = weighted_geometric_mean(max(Factor, FactorFloor))

OpportunityScore = BaseScore
  - CannibalizationPenalty[risk]
  - DuplicatePenalty[risk]
```

Factor weights, risk penalties, intent values, demand/product normalization targets, similarity thresholds, freshness and decision thresholds are configurable. Every configuration has immutable `version` and checksum; changing values requires a new version and human approval. Only one model can be `APPROVED`.

Default thresholds:

| Gate | Value |
|---|---:|
| CREATE | 60 |
| UPDATE | 40 |
| MERGE | 35 |
| minimum differentiation | 10 |
| SERP age | 30 days |
| duplicate HIGH similarity | 0.80 |

These defaults are an auditable baseline, not a claim that the weights are already commercially calibrated.

## Decision rules

Hard gates have priority over numeric score:

1. SERP `REJECT` or insufficient differentiation → `REJECT`.
2. Mixed/inconclusive reviewed SERP → `REJECT` for opportunity creation.
3. No available product support → `REJECT`.
4. HIGH duplicate with an existing opportunity and sufficient score → `MERGE` into it; otherwise `REJECT`.
5. More than one relevant indexable URL → `MERGE` proposal.
6. Exactly one relevant URL → `UPDATE`, if the update threshold is met.
7. No relevant URL, LOW cannibalization, no HIGH duplicate and CREATE threshold met → `CREATE`.
8. Otherwise → `REJECT`.

SQL constraints additionally forbid `CREATE` when product availability/differentiation is zero, cannibalization is not LOW, or duplicate risk is HIGH.

This enforces the platform rule: improve or merge an existing page before proposing a new URL.

## Supported content types

`PILLAR_GUIDE`, `HOW_TO`, `TROUBLESHOOTING`, `COMPARISON`, `TABLE`, `CALCULATOR`, `COMPATIBILITY`, `CASE_STUDY`, `TEST`, `REFERENCE`, `CATEGORY_ENRICHMENT`, `PRODUCT_ENRICHMENT`, `FAQ`, `VIDEO`, `SEO_LANDING`.

Page type is a recommendation only. `ARTICLE_CANDIDATE` from PHASE 7 is resolved through the reviewed intent class; it never triggers automatic article generation.

## Idempotency and audit

Evaluation checksum includes:

- exact model and business-input checksums;
- reviewed SERP assessment checksum;
- primary keyword and demand inputs;
- product/inventory state;
- selected pain points;
- existing URL set and duplicate target;
- factor breakdown, penalties and decision.

The same current evidence does not create a second evaluation. Changed evidence updates the current opportunity, resets it to `PROPOSED`, clears previous reviewer fields and appends a new historical evaluation. Если state позднее вернулся к прежнему checksum, это новая history event: projection снова меняется, а возврат не скрывается как старый duplicate.

Replacing the approved score model or active business input makes an unreviewed proposal stale. It must be reevaluated before human approval.

## Human review

`reviewContentOpportunity` accepts only `APPROVE` or `REJECT` with a real reviewer id. Approval sets proposal status to `REVIEWED`; it does not create a page, brief or publish queue item.

Review is blocked if model, business input, SERP assessment or SERP freshness changed after evaluation.

## CLI workflow

Model dry run:

```bash
npm run seo:opportunities:model -- --version=7tool-opportunity-v1
```

Create and approve a model in a migrated non-production DB:

```bash
npm run seo:opportunities:model -- --file=/absolute/model.json --approve --reviewed-by=strategy-reviewer --apply
```

Register reviewed business input:

```bash
npm run seo:opportunities:business -- --category=stanki-sverlilnye --cluster-id=CLUSTER_ID --business-priority=85 --margin-business-score=70 --source-ref=planning-sheet:2026-q3 --reviewed-by=commercial-reviewer --apply
```

Read-only opportunity preview:

```bash
npm run seo:opportunities:evaluate -- --intent-id=INTENT_ID --pain-points=PAIN_ID:90
```

Adding `--apply` persists only a `PROPOSED` opportunity and evaluation history.

## Verification

Tests cover:

- configurable immutable model versions and one approved model;
- reviewed business-input replacement and stale-proposal blocking;
- demand/product/pain/SERP evidence aggregation;
- all four decisions: CREATE, UPDATE, MERGE, REJECT;
- no-differentiation hard rejection;
- duplicate-intent merge instead of a second page;
- evaluation idempotency and history;
- reviewer-only approval;
- absence of content/page creation;
- backup-gated migrations 001–006.

## Deferred

- commercial calibration of weights against leads/orders/revenue;
- admin UI for model, business input and review workflows;
- content brief/article generation — PHASE 9;
- URL creation, routing, indexation and publication;
- scheduled reevaluation when SERP, inventory or business inputs change.

# STOP / HUMAN REVIEW REQUIRED
