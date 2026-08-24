# 7TOOL SEO & Content Intelligence Platform

Статус: architecture baseline plus research/import/decision/content/media/product-enrichment/tool layers through PHASE 12. Production migrations and real publication remain human-gated.

## Goal

Платформа связывает проверенные данные о товаре, пользовательский спрос, проблемы, лучший тип страницы, экспертный контент, изображения, инструменты подбора и измеримый коммерческий результат.

```text
Sources → Raw observations → Verified facts → Intent → Opportunity
→ Best existing/new page → Quality & rights gates → Human approval
→ Publish → Search performance → Leads/quotes/orders → Refresh/merge/prune
```

## Non-negotiable rules

- One search intent → one best page.
- Keyword не равен URL.
- Missing technical data → `FACT_REQUIRED`, никогда generation.
- Missing verified calculator rule or selector capability → no result, never a fallback estimate.
- AI draft не может publish itself.
- `RESEARCH_ONLY` media никогда не публикуется.
- Existing page improvement precedes new URL when intent is already covered.
- HIGH cannibalization or any hard fail blocks publication.

## System boundaries

| Domain | Owns | Does not own |
|---|---|---|
| Commerce core | products, variants, price, stock, SKU, categories | keywords/content workflow |
| Source layer | imports, observations, provenance | public claims |
| Fact layer | verified assertions, compatibility, applications | raw external text |
| Semantic layer | keywords, clusters, intents, URL mapping | publication |
| Opportunity layer | decision, page type, score, gap | automatic URL creation |
| Content layer | briefs, revisions, approvals | unverified facts |
| Media layer | rights, provenance, variants, placement | competitor image publication |
| Product enrichment layer | evidence-bound product-page sections and versions | commerce fields, supplier copy, unsupported advice |
| Tool layer | reviewed formulas, verified selectors, compatibility tables | guessed coefficients, unverified product matches |
| Performance layer | query/page/search/business outcomes | credentials in frontend |

## Current integration points

- `scripts/refresh-feed.mts`: future source/import-run boundary.
- `src/lib/db.ts`: replace ad-hoc growth with versioned migration runner before new tables.
- `src/lib/products-db.ts`: commerce read model; PHASE 11 adds a separate verified enrichment projection without changing commerce rows.
- `src/app/sitemap.ts`: consumes approved content and current `PUBLISHED + INDEX` tools, never raw opportunities.
- category/product metadata and JSON-LD: consume verified facts and canonical registry.
- `src/lib/landing-selection.ts`: seed for universal intent/cannibalization decision engine.
- `src/lib/leads.ts`: add content/opportunity attribution without changing notification semantics.
- `src/lib/analytics.ts`: future content/tool events and performance correlation.
- admin routes: future `SEO Intelligence` module, protected by roles and workflow permissions.

## Current approval gates

PHASE 3–12 artifacts are implemented on isolated feature branches, but remain non-production. Before applying them to a live database or using external data:

1. approve the model in [data-architecture.md](./data-architecture.md);
2. resolve Git baseline and feature branch;
3. confirm authoritative product store;
4. provide/verify production backup and recovery process;
5. approve migration runner design;
6. confirm supplier feed and image contractual rights;
7. record legal/robots/access approval for each review and SERP source before import;
8. obtain current comparable Google+Yandex evidence for priority clusters;
9. approve and calibrate the opportunity score model and business inputs.

## Documentation index

- [Platform audit](./seo-platform-audit.md)
- [Technical SEO audit](./technical-seo-audit.md)
- [Data architecture](./data-architecture.md)
- [Supplier Feed Intelligence](./supplier-feed-intelligence.md)
- [Product Knowledge Graph](./product-knowledge-graph.md)
- [Semantic Intelligence](./semantic-intelligence.md)
- [Yandex Wordstat Integration](./wordstat-integration.md)
- [Marketplace Review Intelligence](./marketplace-review-intelligence.md)
- [SERP & Competitor Intelligence](./serp-competitor-intelligence.md)
- [Content Opportunity Engine](./content-opportunity-engine.md)
- [Content Platform / База знаний](./content-platform.md)
- [Image Intelligence](./image-intelligence.md)
- [Product Enrichment Engine](./product-enrichment.md)
- [Calculators, Selectors & Compatibility Tables](./calculators-tools.md)

# STOP / HUMAN REVIEW REQUIRED
