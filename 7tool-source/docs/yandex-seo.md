# Yandex SEO — Webmaster, Wordstat and Metrica

PHASE 17 adds one evidence pipeline for three distinct Yandex signals without mixing their meaning:

- Wordstat discovers demand;
- Yandex Webmaster discovers search performance of existing URLs;
- Yandex Metrica supplies aggregate post-click organic behavior.

No OAuth request is executed by the implementation, no token is accepted in an import file, and no opportunity creates or publishes a page.

## Official source contracts

### Yandex Webmaster

The standard popular-query endpoint provides query indicators and pagination but not the required exact URL grain. It returns up to the TOP-3000 queries and at most 500 rows per page, with `TOTAL_SHOWS`, `TOTAL_CLICKS`, `AVG_SHOW_POSITION` and `AVG_CLICK_POSITION`: [popular search queries API](https://yandex.com/dev/webmaster/doc/en/reference/host-search-queries-popular).

PHASE 17 therefore requires the official enhanced URL-query export. Yandex documents its columns as date, host, URL, query, region, clicks, impressions and position: [enhanced URL query export](https://yandex.com/dev/webmaster/doc/ru/reference/enhanced-export). CTR is stored from a supplied percent/ratio only when it matches clicks divided by impressions; otherwise it is calculated. Position is nullable because Yandex may not determine it for a period.

The importer stores the exact normalized URL, route path, query/hash, region, device segment, impressions, clicks, CTR, position, facet marker and immutable source provenance. Tracking parameters are removed; credentials and non-7tool URLs are rejected.

### Wordstat

The official Wordstat API exposes `/v1/topRequests` as an authenticated POST and returns `phrase + count`; regions use IDs from the regions tree and devices can be segmented: [Wordstat API structure](https://yandex.com/support2/wordstat/en/content/api-structure).

Each import requires an explicit seed phrase, period, internal region key, official region IDs and device segment. The immutable demand observation is also mirrored into the existing `seo_keywords` semantic layer as `source_type=WORDSTAT`; category-bound rows can then enter conservative proposed clustering. Demand is never treated as evidence that a new URL is required.

### Yandex Metrica

PHASE 17 uses only aggregate Reports API output. Yandex documents JSON/CSV reports built from dimensions and metrics and supports an organic traffic filter: [Reports API](https://yandex.com/dev/metrika/en/stat/), [traffic-source IDs](https://yandex.com/dev/metrika/en/stat/localize). The relevant aggregate dimensions include landing URL and search phrase: [dimensions and metrics](https://yandex.com/dev/metrika/en/stat/attrandmetr/dim_all).

Stored metrics are daily landing URL, search engine, optional query, visits, users, pageviews and bounce rate. Official numeric `bounceRate` values are interpreted as percent by default; use `--bounce-rate-unit=RATIO` only for a reviewed normalized file. Raw Logs API rows, IP addresses, client/session IDs, cookies and user agents are not accepted or stored.

## Import workflow

All commands are dry-run by default and validate every row before opening SQLite. Their output contains counts and contract metadata, never query text or URLs.

Webmaster enhanced export:

```bash
npm run seo:yandex:import -- \
  --dataset=webmaster \
  --file=/absolute/webmaster-url-queries.csv \
  --start=2026-08-01 \
  --end=2026-08-20
```

Wordstat API response or reviewed CSV:

```bash
npm run seo:yandex:import -- \
  --dataset=wordstat \
  --file=/absolute/wordstat.json \
  --seed-phrase="магнитный станок" \
  --region-ids=213 \
  --region-key=RU-MOW \
  --device=ALL \
  --category=stanki-sverlilnye \
  --start=2026-08-01 \
  --end=2026-08-20
```

Metrica aggregate report:

```bash
npm run seo:yandex:import -- \
  --dataset=metrica \
  --file=/absolute/metrica-organic.json \
  --counter-id=109097461 \
  --start=2026-08-01 \
  --end=2026-08-20
```

After review, add `--db=/absolute/staged.db --apply`. `--no-semantic` disables the Wordstat mirror for a forensic import; it is not the normal demand-discovery path.

## Yandex Query Opportunity

```bash
npm run seo:yandex:opportunities -- \
  --db=/absolute/staged.db \
  --start=2026-08-01 \
  --end=2026-08-20 \
  --region-key=RU-MOW \
  --device=ALL \
  --min-wordstat-demand=100 \
  --min-webmaster-impressions=100
```

The read model emits exactly two review states:

- `WORDSTAT_DEMAND + DEMAND_REVIEW` — a demand signal without a qualifying Webmaster URL; it is not `CREATE`;
- `WEBMASTER_EXISTING_PERFORMANCE + UPDATE_EXISTING` — only an exact URL already registered as live and indexable.

Matching Wordstat demand and Yandex-specific aggregate Metrica visits are attached as context. Facet URLs, unregistered URLs, noindex/non-2xx URLs and stale duplicate imports are excluded from existing-page discovery. `--apply` saves an immutable `REVIEW_REQUIRED` evidence snapshot but changes no public page.

## Migration 014

- `yandex_import_runs` — immutable source/dataset/date/contract/checksum provenance;
- `yandex_webmaster_performance_daily` — exact daily URL-query-region-device performance;
- `yandex_wordstat_demand` — region/device-scoped phrase demand;
- `yandex_metrica_organic_daily` — privacy-minimal aggregate organic behavior;
- `yandex_query_opportunity_snapshots` — review-only demand/update evidence.

The migration has query-driven indexes for source periods, existing URL performance, regional demand, landing behavior and review queues. It remains backup-gated through `scripts/migrate-seo.mjs`.

## Production gates

1. Approve read-only OAuth scopes and owners for Webmaster, Wordstat and Metrica.
2. Confirm the exact 7tool Webmaster host and Metrica counter.
3. Approve query retention, regional taxonomy and access roles.
4. Export a small date range and reconcile totals with each Yandex interface.
5. Verify completeness/limits before accepting a run as `COMPLETE`.
6. Apply migration 014 only to a restored staging copy with a separate verified backup.
7. Calibrate demand/impression thresholds by region and device.
8. Human-review every opportunity before updating content or proposing a distinct URL.

# STOP / HUMAN REVIEW REQUIRED
