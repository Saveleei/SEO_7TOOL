# Content Refresh, Pruning and Authorship

PHASE 21 continuously evaluates published reviewed articles against immutable Google, Yandex and Content ROI evidence. It creates review records only. It never edits titles, expands text, merges pages, changes indexation, redirects or deletes content automatically.

## Update engine

Every run compares one current period with an earlier non-overlapping period covered by complete Google Search Console and Yandex Webmaster imports.

- impression-weighted position 6–20 plus the reviewed high-impression threshold becomes `UPDATE_PRIORITY_HIGH`;
- CTR below a supplied, source-referenced expected CTR curve recommends `IMPROVE_TITLE_DESCRIPTION`;
- growth of the observed query set recommends `EXPAND_CONTENT`;
- both signals recommend `COMPREHENSIVE_UPDATE`.

The expected CTR curve is mandatory run evidence. The engine does not invent a benchmark.

## Pruning

A page becomes a pruning candidate only when the evaluated period is at least the configured minimum and all four signals are verified zero:

- Google plus Yandex impressions and clicks;
- inbound reviewed links;
- organic leads in the exact-period Content ROI snapshot.

The engine still recommends `UPDATE`, never automatic removal. A real reviewer chooses `KEEP`, `UPDATE`, `MERGE`, `REDIRECT`, `NOINDEX` or `DELETE`. `DELETE` requires zero-signal evidence and a longer rationale; `MERGE` and `REDIRECT` require a different live indexable target. The review does not execute the decision.

## Duplicate and cannibalization gates

The deterministic duplicate detector compares current content with articles, products, categories, subcategories/facets, brands and reviewed landing content. It uses local word and character n-gram cosine similarity; nothing is sent to an external embedding service. Exact revision fingerprints remain a hard match.

The publication-time checker also evaluates approved intent mappings, same-cluster content and current opportunity risks across products, categories, articles, filters, brand pages and landing pages:

- `LOW` — no collision evidence;
- `MEDIUM` — overlap requires editorial attention;
- `HIGH` — publication is blocked;
- a semantic duplicate returns `MERGE_REQUIRED`.

## Real expert profiles

An expert is registered only through human-reviewed identity evidence. The immutable profile contains a real name, local rights-documented photo, specialization, experience, category scope and brand scope. A review is bound to the exact content revision. After the first active profile exists, new publication requires an approved matching expert review for the current category and revision.

Identity evidence and photo-rights references remain server-side. Public articles receive only the name, photo, specialization, experience, review statement, scopes and published-article count.

## CLI

```bash
npm run seo:refresh -- assess --db=/absolute/staged.db --input=/absolute/refresh-evidence.json
npm run seo:refresh -- materialize --db=/absolute/staged.db --input=/absolute/refresh-evidence.json --apply
npm run seo:refresh -- collision --db=/absolute/staged.db --content-id=<id>
npm run seo:refresh -- review --db=/absolute/staged.db --assessment-id=<id> --decision=UPDATE --rationale="<human rationale>" --reviewed-by=<human> --apply
npm run seo:refresh -- register-expert --db=/absolute/staged.db --input=/absolute/verified-expert.json --apply
npm run seo:refresh -- expert-review --db=/absolute/staged.db --input=/absolute/expert-review.json --apply
npm run seo:refresh -- status --db=/absolute/staged.db
```

Use a restored staging database and separate verified backup before migration 018. The migration is reversible; run/assessment/review and expert evidence is append-only.

## SEO Intelligence

`/admin/seo` is admin-authenticated and server-rendered. It shows aggregate clicks, impressions, average position, indexed pages, organic leads, revenue, top categories/articles/products, quick wins, cannibalization, indexation issues, content decay, publishing queue and errors. It never returns passwords, OAuth tokens, API secrets or user-level analytics.

## External research policy

- use official APIs or reviewed official exports where available;
- respect robots, rate limits, terms, copyright and authentication;
- do not build aggressive scrapers;
- competitor and review research may yield topics, aggregate pain points and verified facts, never copied or lightly rewritten articles;
- do not publish third-party photographs automatically, remove watermarks or represent third-party imagery as owned.

# STOP / HUMAN REVIEW REQUIRED
