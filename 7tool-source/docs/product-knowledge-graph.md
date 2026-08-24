# PHASE 4 — Product Knowledge Graph

Статус: implemented as a verified-only data layer; production migration and public UI require human review.

## Goal

Product Knowledge Graph связывает товары, варианты, характеристики, применения, проблемы и совместимость только через доказанные assertions.

```text
source_facts (what a source said)
  → fact_assertions (what 7TOOL may claim)
  → fact_evidence (why)
  → verified projections
     ├─ product_features
     ├─ product_applications
     ├─ product_problems
     ├─ knowledge_relations
     └─ product_compatibility
```

Наличие записи в supplier feed не означает автоматическую публикацию утверждения.

## Migration 002

`scripts/migrations/002_product_knowledge_graph.sql` adds:

- `fact_assertions`;
- `fact_evidence`;
- `product_features`;
- `product_applications`;
- `problems`;
- `product_problems`;
- `knowledge_relations`;
- `product_compatibility`.

Migration additive, checksum-controlled и применяется только через существующий backup-gated runner. Локальная/production `data.db` автоматически не меняется.

## Fact lifecycle

| Status | Meaning | Public use |
|---|---|---|
| `FACT_REQUIRED` | значение отсутствует или ещё не найдено | forbidden |
| `SOURCED` | значение связано с источником, но не проверено | forbidden |
| `VERIFIED` | значение проверено реальным reviewer и разрешённым evidence | allowed |
| `SUPERSEDED` | заменено более новым assertion | forbidden |
| `REJECTED` | конфликтное/ошибочное утверждение | forbidden |

`VERIFIED` требует:

1. typed value;
2. reviewer id;
3. минимум один existing source fact;
4. evidence для того же subject;
5. source `rights_policy=PUBLISHABLE_FACTS`;
6. evidence status не `REJECTED`.

Это hard gate, а не quality score.

## Supported relations

Initial allowlist:

`USES`, `COMPATIBLE_WITH`, `REQUIRES`, `ALTERNATIVE_TO`, `BETTER_FOR`, `NOT_RECOMMENDED_FOR`, `SUPPORTS`, `DRILLS`, `CUTS`, `BEVELS`, `THREADS`, `MOUNTS_ON`, `HAS_SHANK`, `HAS_DIAMETER`, `HAS_DEPTH`, `USES_ACCESSORY`.

Произвольный predicate не записывается. Self-relations запрещены. Relation обязана совпадать по subject и predicate с её verified assertion.

## Compatibility rules

Compatibility хранится как отдельная indexed projection, потому что это один из главных ecommerce/use-case запросов.

- pair нормализуется по product id, чтобы A↔B не дублировалась как B↔A;
- product A и B должны различаться;
- statuses: `COMPATIBLE`, `INCOMPATIBLE`, `CONDITIONAL`, `UNKNOWN`;
- `UNKNOWN` нельзя пометить verified;
- verified compatibility требует `COMPATIBLE_WITH` assertion;
- public read возвращает только строки, где и projection, и assertion остаются VERIFIED.

`CONDITIONAL` должна сопровождаться notes/conditions и evidence. Публикация UI для неё отложена до утверждения формата условий.

## Data API

`src/lib/knowledge-graph.mjs` предоставляет:

- `createFactAssertion`;
- `addKnowledgeRelation`;
- `listVerifiedRelations`;
- `addVerifiedProductFeature`;
- `addVerifiedProductApplication`;
- `setVerifiedCompatibility`;
- `listVerifiedCompatibility`.

Public-read functions не возвращают SOURCED/FACT_REQUIRED/SUPERSEDED/REJECTED records.

## Product features

Feature projection копирует typed value и unit только из verified assertion. Она не должна дублировать operational price, stock или availability. Optional variant scope поддержан через `variant_id`.

Examples:

- `HAS_SHANK → Weldon 19`;
- `HAS_DIAMETER → 35 mm`;
- `HAS_DEPTH → 50 mm`.

## Applications and limitations

Suitability mapping:

- `SUPPORTED` requires predicate `SUPPORTS`;
- `BETTER_FOR` requires `BETTER_FOR`;
- `NOT_RECOMMENDED` requires `NOT_RECOMMENDED_FOR`;
- `UNKNOWN` не публикуется.

Это предотвращает генерацию формулировок «идеально подходит» из одной характеристики.

## Problems

`problems` задаёт нормализованный словарь; `product_problems` связывает problem с product или category через `AFFECTED_BY`, `SOLVES`, `MAY_CAUSE`, `NOT_RECOMMENDED_FOR`. В PHASE 4 создана schema, но автоматическое заполнение отсутствует. Источники review/pain появятся только в PHASE 6.

## Conflict policy

При расхождении источников:

1. не переписывать существующий assertion;
2. создать competing SOURCED assertion;
3. добавить CONFLICTING evidence;
4. отправить reviewer;
5. новый VERIFIED assertion может supersede старый;
6. связанные public projections должны быть пересчитаны/закрыты транзакционно.

Automatic conflict resolver не реализован намеренно.

## Security and rights

Supplier source из PHASE 3 создаётся с `CONTRACT_REQUIRED`. Поэтому факты из него пока нельзя promote в VERIFIED. После юридического подтверждения администратор данных должен отдельным audited действием изменить policy на `PUBLISHABLE_FACTS`. Image rights управляются отдельно и не следуют автоматически из права использовать textual facts.

## Testing

`tests/product-knowledge-graph.test.mjs` проверяет:

- migration 001+002 на isolated SQLite с backup gate;
- verified-only graph reads;
- блокировку SOURCED relation;
- evidence/subject matching;
- rights policy hard gate;
- self/UNKNOWN compatibility rejection;
- normalized pairs;
- feature/application projection из verified assertions.

## Deferred

- production migration;
- admin reviewer UI and audit actors;
- automatic assertion proposals from supplier facts;
- conflict review queue;
- compatibility/product UI and structured data;
- generated compatibility pages;
- review-derived product problems;
- content generation.

## Human review checklist

1. Утвердить enum predicates и compatibility types.
2. Назначить реальных fact reviewers.
3. Подтвердить supplier facts rights отдельно от image rights.
4. Утвердить policy для CONDITIONAL compatibility.
5. Проверить migration 002 на restored production backup.
6. Определить audit trail для изменения source rights policy.

# STOP / HUMAN REVIEW REQUIRED
