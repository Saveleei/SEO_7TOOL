# Google SEO — GSC, Quick Wins, Images, CWV and Facets

PHASE 16 adds a local, evidence-based Google SEO layer. It does not connect an OAuth account, call Google, apply migration 013 to production or publish a new SEO landing automatically.

## Google Search Console contract

The importer accepts Search Analytics API JSON or a comprehensive CSV/export with the exact daily dimensions:

- `date`, `page`, `query`, `country`, `device`;
- `clicks`, `impressions`, `ctr`, `position`;
- explicit property, date range, search type, acquisition method, source reference and source SHA-256.

The grain is one daily `page + query + country + device + search_type` observation. Both exact normalized URL path (including non-tracking parameters) and route path are stored. Tracking parameters are removed. Query text is retained because it is a required analysis dimension; imports therefore require an approved retention/access policy.

Only `7tool.ru` properties and pages are accepted. Credentials in property/source URLs are rejected or removed from persisted provenance. Import rows and runs are append-only and content-checksummed. A newer import supersedes an older observation only at read time; source history remains immutable.

Google documents the Search Analytics dimensions and metrics in the [Search Analytics query reference](https://developers.google.com/webmaster-tools/v1/searchanalytics/query). The API returns top rows and can expose up to 50,000 rows per day/search type, so complete acquisitions must paginate and retain provenance as described in [Getting all your Search Analytics data](https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data).

Dry run is the default:

```bash
npm run seo:google:import -- --file=/absolute/gsc-export.csv --start=2026-08-01 --end=2026-08-20
```

Apply only to a separately migrated staging database:

```bash
npm run seo:google:import -- --file=/absolute/gsc-export.csv --start=2026-08-01 --end=2026-08-20 --db=/absolute/staged.db --apply
```

The CLI logs counts and acquisition metadata, never queries or page URLs.

## Google Quick Wins

`evaluateGoogleQuickWins` considers only current `WEB` evidence joined to an existing live `INDEX` URL. A candidate must have:

- impression-weighted average position from 6 through 20 inclusive;
- impressions at or above an explicit `--min-impressions` threshold;
- a non-facet exact page URL registered in `site_urls`.

Every result is fixed to `HIGH_PRIORITY_UPDATE` and decision `UPDATE`. There is no `CREATE` state and no route-creation path. Facet URLs, unregistered URLs, non-2xx/noindex URLs, low-impression pages and positions outside 6–20 are excluded.

```bash
npm run seo:google:quick-wins -- --start=2026-08-01 --end=2026-08-20 --min-impressions=500 --db=/absolute/staged.db
npm run seo:google:quick-wins -- --start=2026-08-01 --end=2026-08-20 --min-impressions=500 --db=/absolute/staged.db --apply
```

Output is aggregate-only. An update remains an editorial task and does not change public content.

## Google Images

The public article renderer already supplies contextual human-reviewed ALT, surrounding text, stable width/height, responsive `<picture>` sources, AVIF/WebP and lazy loading outside the hero. PHASE 16 adds:

- descriptive transliterated article-media filenames while preserving immutable storage keys and legacy media URLs;
- an image sitemap at `/image-sitemap.xml`, referenced by `robots.txt`;
- sitemap inclusion only for published, indexable, human-reviewed articles and publication-eligible local media;
- responsive AVIF/WebP product images through Next Image;
- eager/high-priority loading for the home hero and the primary product image, never lazy loading those critical LCP candidates.

This follows Google’s guidance on descriptive filenames/ALT, relevant surrounding text, responsive sources and image sitemaps in [Google Images SEO best practices](https://developers.google.com/search/docs/appearance/google-images). External product-photo rights are not inferred from their presence in a feed; the image sitemap is limited to media that passed the existing rights projection.

## Core Web Vitals

The root layout reports only `LCP`, `INP` and `CLS` through the same-origin `/api/analytics/web-vitals` endpoint. The endpoint enforces a 4 KB payload, global rate limit, strict metric/path validation and stores no IP, user agent, cookie, client ID or session ID. If migration 013 is not applied, collection degrades to a no-op rather than breaking a page.

Ratings follow Google’s current “good” thresholds at the 75th percentile: LCP at most 2.5 s, INP at most 200 ms and CLS at most 0.1. The implementation also tracks the documented poor boundaries (over 4 s, 500 ms and 0.25) and calculates p75 summaries. See [Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals).

## Faceted navigation

Every query-string catalog filter defaults to `NON_INDEXABLE_FACET`. Category/subcategory metadata retains `noindex, follow` and canonicalizes a filtered combination to the unfiltered route. Quick-chip links have `rel=nofollow` and an explicit classification marker.

Migration 013 provides a reviewed registry with exactly two outcomes:

- `NON_INDEXABLE_FACET` — the default, with no landing URL;
- `INDEXABLE_SEO_LANDING` — only a separate existing live/indexable URL, distinct from the query combination, approved by a named human with rationale.

This avoids exposing combinatorial crawl spaces, consistent with Google’s [faceted navigation guidance](https://developers.google.com/crawling/docs/faceted-navigation). A policy record cannot make an arbitrary query combination indexable.

## Migration 013

- `gsc_import_runs` — immutable acquisition provenance;
- `gsc_search_performance_daily` — immutable exact-URL daily query metrics;
- `google_quick_wins` — immutable evidence snapshots for existing-page updates;
- `core_web_vital_samples` — privacy-minimal RUM observations;
- `facet_indexing_policies` — human-reviewed active/superseded classifications.

Migration application remains backup-gated through `scripts/migrate-seo.mjs`. Tests cover parsing, validation, idempotency, exact URL grain, 6–20 boundaries, update-only behavior, CWV p75, facet review gates, image filenames/sitemap, indexes and rollback.

## Production gates

1. Approve GSC account/property access, export completeness and query retention.
2. Create and verify a separate SQLite backup.
3. Apply migration 013 to staging through the guarded runner.
4. Import a reviewed export and reconcile totals with the GSC UI/API.
5. Calibrate the high-impression threshold by property/date range.
6. Review field CWV volume/retention and reverse-proxy limits.
7. Keep the image sitemap and responsive image responses under production monitoring. Initial validation on 25 August 2026 passed: `/image-sitemap.xml` returned `200`, both sitemap declarations were present in `robots.txt`, and the enhanced live audit reported `P0 = 0`, `P1 = 0`.
8. Audit candidate facets; create a distinct SEO landing only after demand, intent, inventory and content review.

# STOP / HUMAN REVIEW REQUIRED
