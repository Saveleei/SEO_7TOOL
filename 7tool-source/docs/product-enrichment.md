# PHASE 11 — Product Enrichment Engine

Статус: implemented as an additive, evidence-driven product-page layer. Migration 009 was tested only on isolated SQLite copies; production data and existing product records were not changed.

## Purpose and boundary

The engine enriches a product page only when the knowledge graph contains enough current, publishable evidence. It does not rewrite supplier descriptions, commerce fields, product metadata or `products` rows. Until a human publishes an enrichment set, the page behaves exactly as before.

The public product page keeps the supplier description and specification table. Once verified enrichment is published, the older generic `seoText` block is hidden to avoid presenting unverified generated prose beside the evidence-backed sections.

## Evidence contract

Every generated item must be traceable to a current `VERIFIED` assertion with a reviewer and at least one non-conflicting fact from an active `PUBLISHABLE_FACTS` source. Expired assertions, inactive sources, missing evidence and `RESEARCH_ONLY` or `CONTRACT_REQUIRED` rights are hard exclusions.

The engine emits only sections supported by an explicit fact or relation:

| Product-page section | Required evidence |
|---|---|
| Для каких задач подходит | `product_applications.SUPPORTED` / `SUPPORTS` |
| Для каких задач не подходит | `NOT_RECOMMENDED` / `NOT_RECOMMENDED_FOR` |
| Основные преимущества | explicit `BETTER_FOR`; never inferred from a numeric specification |
| Что важно перед покупкой | verified product feature, expressed as an attributed declared value |
| Совместимая оснастка | verified `USES_ACCESSORY`, `COMPATIBLE_WITH`, `REQUIRES` or compatibility projection |
| Аналоги | explicit verified `ALTERNATIVE_TO` relation |
| Чем отличается от других моделей | an explicit alternative plus the same verified feature for both products with different values |
| Частые вопросы | deterministic templates backed by verified applications, features or compatibility |
| Полезные статьи | human-reviewed, indexed, `PUBLISHED` content explicitly linked through `content_products` |
| Подбор оборудования | link to the existing category selection form when that form has configured fields |

Empty sections are omitted. The absence of a section means there is not enough verified evidence; it is not an implicit negative conclusion.

## Safe language

Templates state only what the evidence says. For a verified `35 mm` maximum-diameter fact, the acceptable pattern is:

> Заявленная характеристика «Максимальный диаметр» — 35 mm согласно проверенному источнику.

The safety scanner blocks HTML, unsupported suitability/limitation claims, advantages without `BETTER_FOR`, one-sided comparisons, unqualified specification language and promotional absolutes such as «идеален», «лучший», «гарантированно» or «в любых условиях».

Stored items are immutable. Before approval, publication and every public read, the engine recomputes the evidence fingerprint and item checksums. A changed product identity, assertion, relation, fact, source status or source rights makes the stored set ineligible immediately. The deterministic stale scan records the lifecycle transition and audit event.

## Workflow

Migration `009_product_enrichment.sql` adds versioned sets, immutable items, human reviews and append-only audit events. The lifecycle is:

```text
VERIFIED evidence → DRAFT → human APPROVED → human PUBLISHED
                                       ↘ human REJECTED
PUBLISHED + evidence change → hidden from public read → STALE
new PUBLISHED version → previous version SUPERSEDED
```

AI-assisted and system actors may create a draft. Only a `HUMAN` actor can approve, publish or reject it. A human or deterministic `SYSTEM` actor may run the stale scan. Mutating CLI commands require both an input file and explicit `--apply`; migrations are never applied by the CLI.

Example reviewed JSON inputs:

```json
{ "productId": "product-id", "actorType": "AI_ASSISTED", "actorId": "content-engine" }
```

```json
{ "setId": "product-enrichment-...", "actorType": "HUMAN", "actorId": "editor-id", "notes": "Facts and wording checked" }
```

Commands against an already migrated, explicitly selected database:

```powershell
npm run seo:product-enrichment -- draft --input=reviewed-draft.json --db=isolated.db --apply
npm run seo:product-enrichment -- approve --input=reviewed-approval.json --db=isolated.db --apply
npm run seo:product-enrichment -- publish --input=reviewed-approval.json --db=isolated.db --apply
npm run seo:product-enrichment -- stale --input=stale-scan.json --db=isolated.db --apply
npm run seo:product-enrichment -- list --db=isolated.db
```

## Public integration

`src/app/p/[slug]/page.tsx` requests the curated projection by product id. `ProductEnrichment.tsx` renders plain React text rather than stored HTML, links explicit related products and articles, and replaces the generic FAQ only when a fact-backed FAQ exists. No product core field is overwritten.

## Verification

`tests/product-enrichment.test.mjs` covers:

- all available Phase 11 sections and the neutral `35 mm` wording;
- AI draft versus human-only approval/publication;
- immutable content, reviews and foreign-key integrity;
- immediate public suppression and deterministic `STALE` after a source-rights change;
- rejection of invented promotional language and products without facts;
- SQLite index selection and full migration rollback.

The content-platform and image-intelligence rollback tests include migration 009 in reverse order.

## Deferred / human-gated

- applying migration 009 to a restored production backup and then production;
- creating real enrichment sets or changing real source-rights policies;
- admin review/approval UI, roles and bulk queues;
- real assertion, relation, article and selection-form coverage audit;
- structured FAQ data and metadata changes;
- editorial calibration of labels/templates with product experts.

# STOP / HUMAN REVIEW REQUIRED
