# SEO Cannibalization Report

## Current controls

- One clean canonical per category/subcategory/product variant/brand; filter, sort and query-based legacy variant states are noindex.
- Known legacy routes permanently redirect to current owners.
- Sitemap contains only clean route owners and excludes blocked products.
- Internal search, compare, request, API and test routes are absent from sitemap.

## Risks

| Cluster | Potential competitors | Risk | Ownership decision |
|---|---|---|---|
| magnetic drilling machines | category, drilling task, future guide | high | category owns transactional; task owns application; guide owns selection education |
| annular cutters | category/family filters/future HSS-TCT guide | high | category owns buy intent; family filter noindex until curated; guide owns comparison |
| beveling machines / pipe cutters | category vs task pages | medium | category owns product class; task owns operation/problem |
| brand terms | product listings vs future brand hub | medium | brand hub owns generic brand; product owns model |
| exact variants | exact `/p/[variant-slug]` vs legacy `?variant=` | controlled | stable legacy variant slug owns exact model intent; query state noindex/canonicalized |

## Required landing registry

Before any new SEO landing, record: intent owner, primary concept, route, parent category, overlap review, minimum assortment, unique blocks, status (draft/approved/indexable), reviewer and review date. Reject a landing if its SERP intent and inventory are indistinguishable from an existing owner. Existing 125 subcategories and 87 brands are bounded data-backed owners, not arbitrary filter combinations; bulk landing generation remains disabled.
