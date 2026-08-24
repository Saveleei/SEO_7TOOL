# PHASE 7 — SERP & Competitor Intelligence

Статус: implemented as a research-only evidence and assessment layer. Live SERP capture, production migration, URL creation and content generation were not performed.

## Purpose and hard boundary

PHASE 7 отвечает на два вопроса до ContentOpportunity:

1. какой тип страницы действительно доминирует в актуальной выдаче Google и Yandex;
2. какую дополнительную ценность 7TOOL может дать сверх текущего Top‑10/Top‑20.

```text
approved SERP source
  → comparable Google + Yandex snapshots
  → result/page classification
  → competitor gap observations
  → dominant SERP type + differentiation proposal
  → human review
  → search_intents.dominant_serp_type
```

Ни один шаг не создаёт статью, URL, redirect, canonical или `ContentOpportunity`.

## Current acquisition policy

Допустимые способы получения данных:

- `OFFICIAL_API`;
- `AUTHORIZED_EXPORT`;
- `MANUAL_RESEARCH`.

Каждый provider/engine регистрируется динамически в `serp_source_candidates`. Importer требует предварительный статус `APPROVED`, reviewer id, `terms_status=ALLOWED`, допустимый robots status и совпадающий acquisition method.

Изменение acquisition method, terms или robots policy автоматически сбрасывает прежний approval и требует повторной проверки.

HTML scraper, обход CAPTCHA/anti-bot, browser automation поисковой выдачи и хранение полного HTML в PHASE 7 отсутствуют.

Актуальные ограничения официальных каналов на 24 августа 2026 года:

- [Yandex Search API](https://yandex.cloud/ru/services/search-api) предоставляет официальный облачный поисковый интерфейс; новые интеграции должны использовать v2, а не снятый с поддержки v1;
- [Google Custom Search JSON API](https://developers.google.com/custom-search/v1/overview) закрыт для новых клиентов, а существующие клиенты должны перейти на альтернативу до 1 января 2027 года.

Поэтому core importer provider-neutral и не зависит от одного исчезающего Google API. Прямые API adapters требуют отдельного credential/security review.

## Migration 005

`scripts/migrations/005_serp_competitor_intelligence.sql` adds:

- `serp_source_candidates` — dynamic provider/access/legal registry;
- `serp_snapshots` — query/engine/region/device/time evidence tied to semantic cluster and intent;
- `serp_results` — normalized Top‑1…20 URL metadata and page classification;
- `serp_competitor_insights` — short internal observations about coverage and gaps;
- `serp_assessments` — dominant type, content gap and differentiation proposal;
- `serp_assessment_snapshots` — exact evidence set used by an assessment.

Миграция additive, checksum-controlled и использует существующий backup-gated runner. В production она не применялась.

## SERP result classification

Supported page types:

`PRODUCT`, `CATEGORY`, `ARTICLE`, `FORUM`, `VIDEO`, `TABLE`, `CALCULATOR`, `MARKETPLACE`, `MANUFACTURER`, `ECOMMERCE`, `PDF_MANUAL`, `OTHER`.

Supported site classes:

`OWNED`, `COMPETITOR`, `MARKETPLACE`, `MANUFACTURER`, `FORUM`, `VIDEO_PLATFORM`, `OTHER`.

Классификация explicit-first: тип, предоставленный проверенным export/researcher, имеет приоритет. Детерминированные URL/title/MIME rules `7tool-serp-rules-v1` используются только как baseline для незаполненных значений.

Список конкурентов не зашит в код. K2Tool, ВсеИнструменты, Кувалда, marketplaces, производители и профильные магазины возникают как домены текущих snapshots и агрегируются через `listCompetitorDomainCoverage`.

## Storage and copyright boundary

Хранятся только:

- query context, engine, region, device and capture timestamp;
- target URL/domain, position, page/site class;
- короткий title до 300 символов;
- feature flags: table/calculator/video/FAQ;
- короткое самостоятельное research summary до 500 символов;
- checksum, provenance and `RESEARCH_ONLY` rights status.

Search snippets, body text, page HTML, competitor images and copied tables не сохраняются. Dry-run CLI не выводит URL, title, insight summary или evidence text.

## Competitor content gaps

Manual/authorized research может фиксировать:

`COVERED_TOPIC`, `MISSING_TOPIC`, `MISSING_QUESTION`, `MISSING_COMPARISON`, `WEAK_EXPLANATION`, `MISSING_TABLE`, `OUTDATED_INFORMATION`, `UX_WEAKNESS`.

Это короткие observations, а не копии страниц. `content_gap_score` объединяет severity и ширину подтверждённых gap types; он не является самостоятельным разрешением на создание контента.

## Dominant SERP type

Assessment требует одновременно:

- ровно один active Google snapshot;
- ровно один active Yandex snapshot;
- одинаковые cluster, intent, query, region, language and device;
- snapshot age не старше 30 дней по умолчанию;
- минимум один результат каждого engine.

Каждый engine получает равный вес независимо от количества результатов. Тип считается dominant при weighted share не менее 40% и отсутствии практически равного второго типа; иначе результат `MIXED`.

Initial page-type mapping:

| Dominant type | Proposal only |
|---|---|
| `PRODUCT` | `PRODUCT_ENRICHMENT` |
| `CATEGORY`, `MARKETPLACE`, `ECOMMERCE` | `CATEGORY_ENRICHMENT` |
| `ARTICLE` | `ARTICLE_CANDIDATE` |
| `CALCULATOR` | `CALCULATOR` |
| `VIDEO` | `VIDEO` |
| `TABLE` | `TABLE_REFERENCE` |
| mixed/forum/manufacturer/manual/other | `HUMAN_REVIEW` |

Даже `ARTICLE_CANDIDATE` не создаёт статью автоматически.

## DifferentiationScore

Version `7tool-differentiation-v1` uses configurable, allowlisted signals:

- better table;
- compatibility data;
- own supplier data;
- clearer explanation;
- calculator;
- better comparison;
- FAQ from review research;
- product selection;
- verified specifications;
- licensed photography;
- expert commentary.

Score хранит model version, selected signals, effective weights and earned/total weight. Неизвестные signals/weights отклоняются. Если подтверждённая дополнительная ценность отсутствует, proposal получает `REJECT`, даже при заметном спросе.

Одинаковый набор snapshots, signals и weights имеет стабильный checksum и не создаёт повторный assessment.

## Human review

`createSerpAssessment` сохраняет только `PROPOSED` assessment. `search_intents.dominant_serp_type` меняется только через `reviewSerpAssessment` с реальным reviewer и решением `APPROVE`.

`REJECT` сохраняет audit trail, но не меняет intent. Reviewed assessment всё ещё является входом PHASE 8, а не приказом создать страницу.

## CLI workflow

Source discovery dry run:

```bash
npm run seo:serp:source -- --provider="Approved Provider" --engine=YANDEX --base-url=https://provider.example --discovery-source=contract
```

После фактической terms/access проверки:

```bash
npm run seo:serp:source -- --provider="Approved Provider" --engine=YANDEX --base-url=https://provider.example --discovery-source=contract --acquisition-method=AUTHORIZED_EXPORT --terms-status=ALLOWED --robots-status=NOT_APPLICABLE --approve --reviewed-by=legal-reviewer --apply
```

Snapshot import dry run:

```bash
npm run seo:serp:import -- --file=/absolute/serp.json --source-candidate-id=SOURCE_ID --cluster-id=CLUSTER_ID --intent-id=INTENT_ID --acquisition-method=AUTHORIZED_EXPORT
```

Добавление `--apply` разрешено только для уже мигрированной non-production DB. JSON поддерживает `results/items` и optional `insights`; semicolon/tab files поддерживают result rows. Повторный snapshot с тем же provenance/checksum не дублируется.

## Verification

Tests cover:

- explicit and heuristic page classification;
- credential/tracking URL safety;
- source approval hard gate;
- idempotent snapshot import;
- copyright-safe parser behavior;
- current comparable Google/Yandex requirement;
- equal-engine dominant type calculation;
- gap and differentiation scoring;
- reviewer-only intent update;
- absence of automatic `content_opportunities` creation;
- backup-gated migrations 001–005.

## Deferred

- production credentials and direct Yandex Search API v2 adapter;
- approved Google full-web data provider selection;
- live Top‑10/Top‑20 snapshots for imported priority clusters;
- mobile/desktop split evaluation and scheduled refresh;
- content opportunity scoring and CREATE/UPDATE/MERGE/REJECT decision — PHASE 8;
- competitor page crawling, copied content or media reuse — not authorized.

# STOP / HUMAN REVIEW REQUIRED
