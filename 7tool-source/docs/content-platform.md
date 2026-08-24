# PHASE 9 — Content Platform / «База знаний 7TOOL»

Статус: implemented as a brief-first, evidence-first editorial platform with public read-only routes. Production migration, real article creation and publication were not performed.

## Outcome

PHASE 9 добавляет полный контур между reviewed `CREATE` opportunity и публичной статьёй:

```text
REVIEWED CREATE opportunity
  → article candidate (NOINDEX)
  → semantic review
  → immutable ArticleBrief version
  → human brief approval
  → immutable content revision
  → prohibited-content scan
  → fact review → SEO review → expert review → final review
  → PUBLISHED + INDEX + site_urls registration
```

Оценка opportunity сама не создаёт статью. Создание candidate вызывается отдельно и допускается только для `status=REVIEWED`, `decision=CREATE`, LOW cannibalization opportunity. `CALCULATOR` и `TABLE` теперь передаются отдельному human-gated контуру PHASE 12, а `VIDEO` остаётся отложенным до профильной фазы; Article workflow их по-прежнему не публикует.

Никакие demo-статьи, вымышленные авторы, эксперты, тесты, характеристики или источники не добавлены.

## Public routes

- `/articles` — «База знаний 7TOOL»;
- `/articles/[slug]` — опубликованный материал, в том числе будущие `/articles/magnitnye-sverlilnye-stanki` и `/articles/koronchatye-sverla`;
- navigation links in the existing header and footer;
- sitemap entries only for `PUBLISHED + INDEX + human_reviewed` content.

Пока нет опубликованных статей, `/articles` показывает честное пустое состояние и получает `noindex`. Detail route отдаёт 404 для любого draft/ready/noindex/invalid content. Если migration 007 ещё не применена, public read layer также безопасно возвращает пустой список, а не падает на отсутствующих SEO-таблицах.

Публичный renderer принимает только структурированный `ARTICLE_BLOCKS_V1` и создаёт React elements. Raw HTML не публикуется и `dangerouslySetInnerHTML` не используется. «Короткий ответ» всегда стоит перед подробными разделами и содержит 2–5 предложений.

## Migration 007

`scripts/migrations/007_content_platform.sql` adds:

- `content_assets` — current Article projection and all master-prompt fields;
- `article_briefs`, `article_brief_items` — versioned brief plus normalized multi-value requirements;
- `content_revisions` — immutable `ARTICLE_BLOCKS_V1` revisions;
- `content_secondary_keywords`, `content_products`, `content_related`;
- `content_sources`, `content_faq`, `content_internal_links`;
- `content_approvals`, `workflow_events`, `content_quality_checks`.

Arrays from the logical Article model are not packed into a mutable article JSON: keywords, products, relations, sources, FAQ and links use join tables. `content` is resolved from `current_revision_id`. Since PHASE 10, `images[]` is a rights-verified read projection from `content_media`, `media_assets` and immutable variants; it remains empty when migration 008 is absent or no published placement is eligible.

Since PHASE 13, `content_products`, `content_related` and the reviewed category also serve as normalized proof for separately versioned semantic link sets. These facts do not publish links by themselves: an editor must approve and publish the next-question journey. If the relation or target changes, the public semantic block disappears immediately. The article renderer suppresses legacy product/related links that are already present in the published semantic block.

Since PHASE 14, the public article resolves a task-specific lead profile from the reviewed `lead_form_type`, intent class and category. Unknown explicit profile values are rejected during revision save. The form records the article/cluster/intent context server-side and uses a normalized CTA key; it does not trust client-supplied article attribution.

Append-only triggers prevent update/delete of content revisions, approvals, workflow events and quality checks. Brief content and brief items are immutable; correction requires a new brief version. The migration ends with `PRAGMA optimize`.

Indexes are tied to actual access patterns:

- `idx_content_assets_public` — published article listing ordered by publication date;
- `idx_content_assets_workflow` — editorial queues by status/type/update time;
- `idx_content_assets_category` — category collections;
- revision, brief, evidence, approval, workflow and reverse-product lookups.

`EXPLAIN QUERY PLAN` tests confirm the public and workflow indexes are selected.

## Article model

The master-prompt Article shape maps as follows:

| Logical field | Storage/read projection |
|---|---|
| id, slug, status, title, h1 | `content_assets` |
| meta_title, meta_description, excerpt | `content_assets` |
| content | current immutable `content_revisions.content_body` |
| category | `content_assets.category_slug` |
| primary_keyword | id + reviewed query snapshot in `content_assets` |
| secondary_keywords[] | `content_secondary_keywords` → `seo_keywords` |
| intent, cluster_id | reviewed semantic foreign keys |
| author, expert_reviewer | human-supplied names; no generated profiles |
| updated_at, published_at, canonical, index_status | `content_assets` + `site_urls` |
| four scores | `content_assets`, human-set before READY |
| target_products[] | `content_products` with real non-draft products |
| related_articles[] | `content_related`, published targets only |
| images[] | PHASE 10 public projection: published placement + processed asset + active rights + ready variants |
| sources[] | `content_sources`, public only after human verification |
| faq[] | revision body + current `content_faq` projection |
| lead_form_type | `content_assets` |
| generated_by_ai, human_reviewed | explicit boolean gates |

## ArticleBrief gate

`createArticleBrief` is allowed only after the article enters `SEMANTIC_REVIEW` and both its intent and cluster have status `REVIEWED`.

Required single-value fields:

- user intent;
- problem;
- audience;
- short answer with 2–5 sentences;
- calculator requirement, including an explicit «не требуется» reason;
- CTA.

Normalized brief items cover key questions, sourced verified facts, real target products, supplier-image requirements, diagrams, tables, FAQ insights, competitor gaps, internal links and evidence requirements.

Supplier images in a brief are research requirements only. PHASE 10 requires a human-reviewed selection (or reviewed no-match), verified rights and a locally processed media record before publication.

An AI-assisted actor may prepare a brief. Only `actorType=HUMAN` may approve it. Content revisions cannot be saved before current brief approval.

## Workflow and hard gates

Statuses exactly match the master prompt:

`DISCOVERED → SEMANTIC_REVIEW → BRIEF_READY → BRIEF_APPROVED → CONTENT_DRAFT → FACT_CHECK → SEO_REVIEW → EXPERT_REVIEW → READY → PUBLISHED`

Maintenance states: `UPDATE_REQUIRED`, `MERGE_REQUIRED`, `ARCHIVED`.

Special operations own the transitions to `BRIEF_READY`, `BRIEF_APPROVED` and `CONTENT_DRAFT`; generic transition calls cannot skip their data gates. `CONTENT_DRAFT → PUBLISHED` is invalid for every actor. Publication and review transitions require a human actor.

Before `READY`, the current revision must have:

- no prohibited-content hard fail;
- an approved current brief;
- at least one real, non-draft target product;
- every claim source individually human-verified and backed by an active `PUBLISHABLE_FACTS` source when a source record is attached;
- FACT, SEO and EXPERT approvals tied to the current revision;
- real author and expert reviewer values;
- all four scores supplied by the human review operation.

The publication transaction additionally verifies:

- quality score ≥85;
- evidence score ≥80;
- differentiation score ≥60;
- current opportunity is still `REVIEWED + CREATE`;
- exact opportunity evidence checksum has not changed;
- cannibalization is LOW and duplicate risk is not HIGH;
- canonical route is not owned by another entity;
- final human approval.

Only then does it register `/articles/{slug}` in `site_urls`, set HTTP 200/index state and move the asset to `PUBLISHED`. A changed opportunity forces reevaluation rather than silently publishing against stale evidence.

## Content standard and prohibited AI content

`validateArticleContent` requires a short answer, unique section headings, typed paragraph/note/list/table blocks, optional FAQ and allowlisted internal paths. Every technical claim may carry one or more `sourceRefs`; unknown references are rejected against the approved brief evidence.

`scanProhibitedAiContent` automatically reports:

- «В современном мире» and «Ни для кого не секрет»;
- empty/generic introductions;
- repeated meaningful sentences;
- filler-based artificial length;
- obvious low-value statements;
- unsupported expertise claims;
- unsupported test results;
- numeric technical specifications without `sourceRef`;
- keyword stuffing;
- an identical active article template.

Hard issues block `CONTENT_DRAFT → FACT_CHECK`. Missing limitations and error/check sections are warnings that remain visible to reviewers. Automated checks do not claim to replace fact, SEO or expert review.

`RESEARCH_ONLY`, inactive, rejected/superseded source facts and non-`VERIFIED` assertions cannot be approved as article evidence even by a human workflow actor.

## CLI

The CLI never applies migrations and never selects a reviewer implicitly:

```bash
npm run seo:content -- create-candidate --input=/absolute/candidate.json --db=/absolute/staged.db --apply
npm run seo:content -- create-brief --input=/absolute/brief.json --db=/absolute/staged.db --apply
npm run seo:content -- approve-brief --input=/absolute/approval.json --db=/absolute/staged.db --apply
npm run seo:content -- save-revision --input=/absolute/revision.json --db=/absolute/staged.db --apply
npm run seo:content -- review-source --input=/absolute/source-review.json --db=/absolute/staged.db --apply
npm run seo:content -- transition --input=/absolute/transition.json --db=/absolute/staged.db --apply
npm run seo:content -- list --input=/absolute/filter.json --db=/absolute/staged.db
```

Every mutating input includes explicit `actorType` and `actorId`. Human-only operations reject `SYSTEM`, `IMPORT` and `AI_ASSISTED` actors.

Migration remains backup-gated through the existing runner:

```bash
npm run db:migrate:seo
npm run db:migrate:seo -- --apply --backup=/absolute/verified-backup.db
```

The second command is an operational example only. PHASE 9 did not run it against production.

## Verification

Automated tests cover:

- candidate creation only from a reviewed CREATE opportunity;
- no URL/content creation during opportunity evaluation;
- semantic and ArticleBrief prerequisites;
- AI-assisted brief/revision creation with human-only approval;
- all prohibited-content categories and hard-fail blocking;
- immutable revisions and append-only approvals/events/checks;
- individual source verification and real target-product requirement;
- sequential FACT/SEO/EXPERT/FINAL approvals;
- rejection of AI publication and skipped statuses;
- stale-opportunity/cannibalization/score publication gates;
- atomic route registration at publication;
- public/workflow SQLite query plans;
- graceful public behavior before migration or publication.

Full project regression, TypeScript check, numbered migration dry-run and Next production build are required before handoff.

## Deferred

- production migration and any real editorial records;
- admin editorial UI and role mapping to production identities;
- calibration of evidence/differentiation score thresholds from pilot outcomes;
- production Image Intelligence migration, real supplier rights approvals and media ingestion;
- Article/FAQ structured data — PHASE 15;
- article-depth and attributed lead-outcome analysis — PHASE 18;
- real PHASE 13 semantic link sets and production migration 011;
- content refresh automation — PHASE 21;
- deployment/hosting and publication of production content.

# STOP / HUMAN REVIEW REQUIRED
