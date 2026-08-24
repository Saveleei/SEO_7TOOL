# PHASE 5 — Semantic Intelligence

Статус: implemented as import/normalization/proposal layer. Ни один keyword/cluster/intent не создаёт публичный URL автоматически.

## Pipeline

```text
Wordstat/manual/search performance export
  → validated import_run
  → normalize query
  → heuristic intent proposal
  → conservative category-scoped clustering
  → map existing URLs
  → detect overlap/cannibalization
  → human review
  → one preferred URL per reviewed intent
```

## Migration 003

`scripts/migrations/003_semantic_intelligence.sql` adds:

- `site_urls` — canonical registry of existing/relevant URLs;
- `seo_keywords` — normalized demand observations;
- `keyword_clusters` — versioned conservative clusters;
- `search_intents` — proposed/reviewed intent records;
- `intent_url_mappings` — PRIMARY/CANDIDATE/OVERLAP mappings.

Production migration was not applied.

## Query normalization

`normalizeKeyword`:

- Unicode NFKC;
- Russian lowercase;
- `ё → е`;
- punctuation → spaces;
- repeated whitespace collapsed;
- Cyrillic, Latin letters and digits preserved.

Raw `query` remains stored for language/voice analysis; `normalized_query` is used for deduplication.

Unique grain: `(normalized_query, source_id, region, language)`. The same normalized query from Wordstat and Webmaster remains two source observations.

## Intent classification

Rules propose:

`PRODUCT`, `COMMERCIAL`, `SELECTION`, `COMPARISON`, `SPECIFICATION`, `MATERIAL`, `APPLICATION`, `PROBLEM`, `COMPATIBILITY`, `HOW_TO`, `INFORMATIONAL`, `UNKNOWN`.

Classification is deterministic and versioned as `7tool-ru-rules-v1`. It stores confidence but does not approve intent. Rule order matters; for example comparison has priority over the `Weldon` compatibility token in `Weldon 19 или Weldon 32`.

Limitations:

- no morphological/embedding model yet;
- ambiguous multi-intent queries need reviewer;
- SERP intent is not inferred from wording alone;
- dominant SERP type remains empty until a current Google+Yandex PHASE 7 assessment is human-reviewed.

## Conservative clustering

Current model: token Jaccard, version `7tool-token-jaccard-v1`, default threshold `0.72`.

Hard rules:

- only within one category and source batch scope;
- never merge different proposed intent classes;
- exact normalized duplicates merge;
- similarity below threshold remains separate;
- clustering creates PROPOSED cluster/intent only;
- maximum intended batch is approximately 500 opportunities per category, so pairwise comparison is acceptable for pilot.

This intentionally prefers under-clustering over destructive merging. Human review may MERGE/REJECT later.

## Existing URL registry

`site_urls` normalizes paths and stores page type, entity, index status, HTTP status, canonical target and crawl metadata. Tracking-only parameters are removed; functional parameters remain distinguishable.

Before assigning preferred URL:

- URL must exist in registry;
- index status must be `INDEX`;
- HTTP status must be 200 or not yet measured;
- reviewer id is mandatory.

Database partial unique index allows only one APPROVED PRIMARY mapping per intent. Re-review to a different primary therefore requires explicit retirement/rejection of the old mapping; it cannot silently replace it.

## Cannibalization detection

Current detector reports a cluster when imported keywords in it point to more than one distinct indexable existing URL. It returns cluster, URL count and paths for review.

It does not automatically redirect, canonicalize, merge or noindex pages. Those decisions require crawl/SERP/performance evidence.

## Import API

`importKeywordBatch` creates/updates:

- source registry;
- import run with checksum;
- normalized keyword records;
- optional existing URL mappings.

Reimport updates demand and `last_seen_at` without duplicating the same source/region/language query.

Supported source types in this phase: `WORDSTAT`, `GSC`, `YANDEX_WEBMASTER`, `INTERNAL_SEARCH`, `MANUAL`. API credentials are not accepted by the importer.

## Human workflow

1. Import demand data.
2. Review normalization and rejected rows.
3. Generate conservative clusters.
4. Check existing URL overlaps.
5. Review current Google+Yandex evidence through [SERP & Competitor Intelligence](./serp-competitor-intelligence.md).
6. Approve/MERGE/REJECT intent.
7. Assign one best existing URL or leave unassigned for opportunity scoring.

No `CREATE PAGE` action exists in PHASE 5.

## Tests

Tests cover:

- Russian normalization;
- intent rule priority and Cyrillic boundaries;
- cross-intent merge prohibition;
- conservative similarity clustering;
- Wordstat-style CSV/JSON validation;
- source/import idempotency;
- URL registry and one-primary constraint;
- cannibalization candidates;
- backup-gated migrations 001–003.

## Deferred

- direct Wordstat API client and OAuth operation;
- GSC/Webmaster API ingestion;
- internal site-search export integration;
- embeddings/morphology and cluster evaluation dataset;
- direct approved SERP API adapters and scheduled refresh;
- OpportunityScore;
- page creation and publishing.

# STOP / HUMAN REVIEW REQUIRED
