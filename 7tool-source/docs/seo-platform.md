# 7TOOL SEO & Content Intelligence Platform

Статус: architecture baseline plus research/import/decision/content/media/product-enrichment/tool/internal-linking/lead-generation/structured-data/search-platform/analytics intelligence and bounded pilot layers through PHASE 19. Production migrations, external analytics access and real publication remain human-gated.

## Goal

Платформа связывает проверенные данные о товаре, пользовательский спрос, проблемы, лучший тип страницы, экспертный контент, изображения, инструменты подбора и измеримый коммерческий результат.

```text
Sources → Raw observations → Verified facts → Intent → Opportunity
→ Best existing/new page → Quality & rights gates → Human approval
→ Publish → Next-question navigation → Intent CTA → attributed lead
→ Evidence-matched structured data
→ Search/business performance → Refresh/merge/prune
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
- A content CTA must promise a specific next result; lead attribution never treats a persistent client ID as a session.
- Structured data may describe only visible content and complete verified facts; missing policy/video data means no corresponding node.
- Google Quick Wins update only an existing live indexable URL at positions 6–20; they never create a page.
- Catalog query facets default to `NON_INDEXABLE_FACET`; a separate SEO landing requires human review.
- Wordstat is demand discovery; Yandex Webmaster is existing-performance discovery. Neither source creates a page.
- Analytics stores aggregate behavior and verified business outcomes; pageviews are not a Business KPI and raw visitor records do not enter the intelligence database.

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
| Internal linking layer | reviewed next-question journeys backed by normalized relations | keyword-overlap inference, self-publication, stale links |
| Lead generation layer | intent forms, normalized CTA keys, immutable attribution snapshots | generic phone capture, forged article context, session/client conflation |
| Structured data layer | script-safe Product/Offer/Brand/Breadcrumb/Article/Organization projections | invented MPN, policy, condition, video, rating or review data |
| Google SEO layer | immutable GSC observations, existing-page Quick Wins, CWV RUM, facet policy and image discovery | OAuth credentials, automatic publication or arbitrary facet indexation |
| Yandex SEO layer | immutable Webmaster URL-query performance, Wordstat demand, aggregate Metrica behavior and review-only opportunities | token storage, raw visit PII or automatic page creation |
| Analytics Intelligence layer | 13 canonical goals, aggregate page metrics, verified CRM outcomes, KPI/ROI snapshots | raw visits, PII-bearing CRM rows, pageview vanity KPI or content decisions |
| Pilot layer | fixed five-category scope, 500/category cap, Top 20, 25 review work items and comparable KPI snapshots | automatic content generation, publication or Phase 20 scaling |
| Performance layer | query/page/search/business outcomes | credentials in frontend |

## Current integration points

- `scripts/refresh-feed.mts`: future source/import-run boundary.
- `src/lib/db.ts`: replace ad-hoc growth with versioned migration runner before new tables.
- `src/lib/products-db.ts`: commerce read model; PHASE 11 adds a separate verified enrichment projection without changing commerce rows.
- `src/app/sitemap.ts`: consumes approved content and current `PUBLISHED + INDEX` tools, never raw opportunities.
- category/product metadata and JSON-LD: consume verified facts and canonical registry.
- `src/lib/landing-selection.ts`: seed for universal intent/cannibalization decision engine.
- `src/lib/leads.ts`: add content/opportunity attribution without changing notification semantics.
- `src/lib/analytics.ts`: canonical privacy-safe content/tool/lead/contact goals with reliable Metrica delivery.
- `src/lib/analytics-intelligence.mjs`: aggregate imports and reproducible Business KPI/Content ROI snapshots.
- `src/lib/pilot-program.mjs`: bounded Phase 19 selection, work-item review and category/pilot KPI snapshots.
- `src/lib/google-seo.mjs`: exact-grain GSC imports, update-only Quick Wins, CWV classification and reviewed facet policy.
- `src/lib/yandex-seo.mjs`: separate Webmaster/Wordstat/Metrica grains and demand-vs-existing opportunity discovery.
- admin routes: future `SEO Intelligence` module, protected by roles and workflow permissions.

## Current approval gates

PHASE 3–19 artifacts are implemented on isolated feature branches, but remain non-production. Before applying them to a live database or using external data:

1. approve the model in [data-architecture.md](./data-architecture.md);
2. resolve Git baseline and feature branch;
3. confirm authoritative product store;
4. provide/verify production backup and recovery process;
5. approve migration runner design;
6. confirm supplier feed and image contractual rights;
7. record legal/robots/access approval for each review and SERP source before import;
8. obtain current comparable Google+Yandex evidence for priority clusters;
9. approve and calibrate the opportunity score model and business inputs.
10. approve GSC property access, export completeness, query retention and Quick Win impression threshold.
11. approve Yandex OAuth owners/scopes, Webmaster host, Metrica counter, regional taxonomy and Yandex query retention.
12. approve Phase 18 goal IDs, bot/attribution rules, PII-free CRM outcomes and revenue/margin reconciliation.
13. approve the exact five-category pilot scope, all 100 Top opportunities, all 25 work items and comparable Google/Yandex/ROI periods before any pilot publication.

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
- [Internal Linking Engine](./internal-linking.md)
- [Lead Generation](./lead-generation.md)
- [Structured Data](./structured-data.md)
- [Google SEO](./google-seo.md)
- [Yandex SEO](./yandex-seo.md)
- [Analytics Intelligence](./analytics-intelligence.md)
- [Phase 19 bounded pilot](./pilot-program.md)

# STOP / HUMAN REVIEW REQUIRED
