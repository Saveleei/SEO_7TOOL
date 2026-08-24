# PHASE 6 — Marketplace Review Intelligence

Статус: implemented as a research-only extraction and aggregation layer. Скрейпинг, публикация контента и production migration не выполнялись.

## Purpose and boundary

Платформа преобразует законно полученный review export в короткие структурированные инсайты и агрегированные pain points.

```text
source candidate
  → terms / robots / access review
  → official API, authorized export or manual research
  → in-memory text normalization
  → ReviewInsight (RESEARCH_ONLY)
  → negative pain aggregation
  → human review
```

Полный текст отзыва не является сущностью платформы и не сохраняется. Основная рабочая единица — `ReviewInsight`.

## Migration 004

`scripts/migrations/004_review_intelligence.sql` adds:

- `review_source_candidates` — динамический реестр найденных площадок и результатов legal/robots review;
- `review_insights` — короткие извлечённые сигналы с provenance;
- `pain_points` — агрегаты проблем по категории и типу товара;
- `pain_point_sources` — нормализованные source/platform counts без JSON-массива.

Миграция additive, checksum-controlled и запускается существующим backup-gated runner. В production она не применялась.

## Dynamic source discovery

Ozon, Wildberries, Яндекс Маркет, ВсеИнструменты, Кувалда и профильные сайты рассматриваются только как начальные классы research-кандидатов. Ни одна площадка не зашита в extractor или схему навсегда.

Новый кандидат добавляется через CLI или `registerReviewSourceCandidate`. URL нормализуется до origin; URL с credentials и протоколы кроме HTTP(S) запрещены.

Dry run:

```bash
npm run seo:reviews:source -- --platform="Example Market" --base-url=https://market.example/catalog --discovery-source=manual
```

Запись в подготовленную non-production DB требует `--apply`. По умолчанию это создаёт только статус `DISCOVERED`. После фактической проверки реальный reviewer отдельно фиксирует approval:

```bash
npm run seo:reviews:source -- --platform="Example Market" --base-url=https://market.example --discovery-source=contract --access-method=AUTHORIZED_EXPORT --terms-status=ALLOWED --robots-status=NOT_APPLICABLE --approve --reviewed-by=legal-reviewer --apply
```

Статус `APPROVED` требует reviewer id, `terms_status=ALLOWED`, допустимый robots status и разрешённый access method. Само значение `--terms-status=ALLOWED` в import-команде approval не заменяет: importer дополнительно проверяет одобренную запись source registry.

## Acquisition policy

Importer допускает только:

- `OFFICIAL_API`;
- `AUTHORIZED_EXPORT`;
- `MANUAL_RESEARCH`.

Импорт запрещён, пока terms status не равен `ALLOWED` и не существует соответствующего human-approved source candidate. Скрейпер, обход авторизации, антибот-защиты или robots policy в PHASE 6 не реализованы.

## Extracted insight types

Поддерживаются все категории PHASE 6:

`PROBLEM`, `BENEFIT`, `QUESTION`, `USE_CASE`, `FAILURE`, `USER_ERROR`, `EXPECTATION`, `COMPATIBILITY_ISSUE`, `FEATURE_REQUEST`, `COMPARISON`, `SLANG`, `MATERIAL`, `APPLICATION`, `DIMENSION`, `ACCESSORY`, `INSTALLATION_ISSUE`.

Текущий extractor — детерминированный baseline `7tool-review-rules-v1`, а не ML-классификатор. Его совпадения являются research signals и требуют проверки перед использованием в briefs.

## Rating policy

| Rating | Permitted use |
|---|---|
| 1–3 | failures, problems, compatibility/installation issues and other pain point signals |
| 4–5 | benefits, real use cases, successful applications, terminology and material context |
| missing | discovery of both classes, without automatic pain aggregation |

Только problem rules из отзывов 1–3 увеличивают `pain_points.mentions`. Положительный отзыв не создаёт pain point, даже если содержит совпавшие общие категории.

## Storage and rights

Importer хранит:

- platform/source id and source URL;
- product/category reference;
- insight type and normalized short insight;
- rating bucket and timestamp;
- checksum and aggregate counts;
- evidence snippet до 240 символов, только для внутренней проверки.

Он не хранит исходный review body. Все записи получают `rights_status=RESEARCH_ONLY`; они не являются publishable copy. Marketplace images не загружаются и не публикуются — это отдельный rights-gated scope PHASE 10.

## Idempotent import

Поддерживаются JSON и semicolon/tab-delimited authorized exports. Обязательные поля строки: `text`, `source_url`, `category_slug`; также поддерживаются rating, source product reference, 7TOOL product id и product type.

Dry run по умолчанию выводит только количество строк и распределение типов, без текстов и snippets:

```bash
npm run seo:reviews:import -- --file=/absolute/reviews.csv --platform="Example Market" --access-method=AUTHORIZED_EXPORT --terms-status=ALLOWED
```

Применение к уже мигрированной non-production DB:

```bash
npm run seo:reviews:import -- --file=/absolute/reviews.csv --platform="Example Market" --base-url=https://market.example --access-method=AUTHORIZED_EXPORT --terms-status=ALLOWED --apply
```

Checksum на source/review/insight делает повторный импорт идемпотентным: существующий insight и его pain mention повторно не начисляются.

## Pain point model

Агрегат включает category, product type, stable problem key, normalized problem, mentions, distinct sources count, severity, commercial relevance, keyword match placeholder, suggested content type, priority and workflow status.

PHASE 6 не создаёт статьи или URL. Связь с keyword demand и решение `UPDATE / CREATE / MERGE / REJECT` относятся к следующим фазам.

## Verification

Tests cover:

- Cyrillic-safe failure matching;
- separation of negative pain and positive use cases;
- all specialized terminology/material/dimension/accessory signals;
- source URL safety and approval hard gates;
- JSON/delimited validation;
- research-only snippet limit;
- idempotent insight and pain aggregation;
- backup-gated migrations 001–004.

## Deferred

- source-specific official API adapters and contractual exports;
- evaluated Russian review classification model;
- keyword matching and cross-source confidence calibration;
- moderator/admin UI;
- content opportunity generation;
- any image workflow or public reuse of marketplace materials.

# STOP / HUMAN REVIEW REQUIRED
