# Analytics Intelligence — events, Business KPI and Content ROI

PHASE 18 turns already-attributed site behavior into reviewable commercial evidence. It does not store raw browser events, visitor identifiers or pageviews as a business KPI.

## Canonical event contract

The browser sends these exact Yandex Metrica JavaScript-event goal targets:

- `ARTICLE_VIEW`, `ARTICLE_50_SCROLL`, `ARTICLE_90_SCROLL`;
- `PRODUCT_CLICK_FROM_ARTICLE`, `CATEGORY_CLICK_FROM_ARTICLE`;
- `CALCULATOR_START`, `CALCULATOR_COMPLETE`;
- `SELECTOR_START`, `SELECTOR_COMPLETE`;
- `LEAD_FORM_OPEN`, `LEAD_FORM_SUCCESS`;
- `PHONE_CLICK`, `EMAIL_CLICK`.

Yandex documents `ym(counter, "reachGoal", target, params)` for a configured JavaScript-event goal and requires distinct IDs for distinct events: [reachGoal](https://yandex.com/support/metrica/en/objects/reachgoal). PHASE 18 keeps the target names stable while the numeric goal IDs remain deployment configuration in Metrica.

Event parameters pass through the existing non-personal allowlist only: page/content/tool/category/product/form/placement identifiers. Names, phone numbers, email addresses, companies, messages, cookies, client/session IDs, IP addresses and user agents are not event parameters.

Article view and scroll milestones are one-time per browser session. Tool start/complete goals are one-time per tool session. `LEAD_FORM_SUCCESS` is emitted only after the API confirms that the lead was persisted. Existing legacy goals remain available and dispatch their Phase 18 canonical counterpart.

## Aggregate Reports API contract

The Reports API groups data with dimensions and calculates numeric metrics; it can return JSON or CSV without exposing raw visits: [Reports API](https://yandex.com/dev/metrika/en/stat/). Goal reach totals use `ym:ev:goal<goal_id>reaches`, while event dimensions expose event date and the URL where the goal fired: [goal metrics](https://yandex.com/dev/metrika/en/stat/metrics/expenses_visits/conversions), [event dimensions](https://yandex.com/dev/metrika/en/stat/attrandmetr/dim_all).

`buildMetricaAnalyticsReportRequests` creates two credential-free request contracts:

1. all 13 canonical goals by `event date + event URL`, excluding detected robots;
2. the existing product-view goal filtered to organic traffic, producing `ORGANIC_PRODUCT_VIEWS`.

Create a local reviewed JSON goal map whose keys are the 13 canonical event names and whose values are their distinct numeric Metrica goal IDs. Tokens never belong in that file.

Import the two official aggregate reports together:

```bash
npm run analytics:intelligence:import -- \
  --dataset=page-metrics \
  --file=/absolute/metrica-phase18-events.json \
  --organic-product-views-file=/absolute/metrica-organic-product-views.json \
  --goal-map=/absolute/metrica-goal-ids.json \
  --organic-product-view-goal-id=123456789 \
  --counter-id=109097461 \
  --start=2026-08-01 \
  --end=2026-08-20
```

Dry-run is the default. Add `--db=/absolute/staged.db --apply` only after reconciling totals in the Metrica interface. A normalized long CSV with `date,page,metric_name,metric_value` is also accepted, but it must contain all 13 events plus `ORGANIC_PRODUCT_VIEWS`; zero values are valid and preserve completeness.

## Business outcomes

Qualified leads, quotes and orders are imported from a reviewed CRM export. Each row contains only:

```text
external_outcome_id, lead_request_id OR lead_id, outcome_type,
occurred_at, revenue, gross_margin
```

`QUALIFIED_LEAD` and `QUOTE` carry no money. `ORDER` requires revenue and gross margin in RUB; values are stored as integer kopecks. Each outcome must resolve to exactly one existing local lead, which supplies the immutable page attribution. PII columns cause the import to fail.

An empty reviewed CRM snapshot is valid and records truthful zero outcomes for the period; use a header-only CSV or `{ "rows": [] }`, never a fabricated sentinel outcome.

```bash
npm run analytics:intelligence:import -- \
  --dataset=business-outcomes \
  --file=/absolute/crm-outcomes.csv \
  --subject=crm:7tool \
  --money-unit=RUB \
  --start=2026-08-01 \
  --end=2026-08-20
```

## Business KPI and Content ROI

After both imports and the PHASE 17 aggregate organic-landing import cover the same period:

```bash
npm run analytics:intelligence:materialize -- \
  --db=/absolute/staged.db \
  --counter-id=109097461 \
  --crm-subject=crm:7tool \
  --start=2026-08-01 \
  --end=2026-08-20
```

Business KPI stores exactly the decision metrics from the master model:

- Organic Product Views;
- Qualified Leads;
- Quotes;
- Orders;
- Revenue;
- Gross Margin.

Content ROI stores for every evidenced page:

- Organic Sessions;
- Product Clicks;
- Leads;
- Quotes;
- Orders;
- Revenue;
- Margin.

Qualified Leads are retained as an additional diagnostic page field. Pageviews are intentionally absent. Dry-run returns aggregate totals only. `--apply` writes immutable `REVIEW_REQUIRED` snapshots with the exact Metrica, Yandex-organic and CRM run IDs; it changes no content or public page.

## Migration 015

- `analytics_import_runs` — immutable source/period/contract/checksum provenance;
- `analytics_page_metrics_daily` — daily aggregate page metrics, never raw visits;
- `analytics_business_outcomes` — lead-resolved verified business facts;
- `analytics_business_kpi_snapshots` — decision KPI evidence;
- `content_roi_snapshots` — per-page ROI evidence.

Indexes follow the actual latest-run, KPI, outcome and page-history queries and are verified with `EXPLAIN QUERY PLAN`.

## Production gates

1. Create and verify all 13 JavaScript-event goals plus the existing product-view goal in counter `109097461`.
2. Approve goal owners, naming freeze, bot filter, attribution window and reporting timezone.
3. Approve the CRM outcome vocabulary and confirm that `ORDER` revenue/margin are final recognized RUB values.
4. Approve a PII-free CRM export and deterministic mapping to local lead/request IDs.
5. Reconcile a small period independently in Metrica and CRM, including zero-event pages.
6. Apply migration 015 only to a restored staging copy with a separate verified backup.
7. Review KPI/ROI snapshots before using them for content investment decisions.

# STOP / HUMAN REVIEW REQUIRED
