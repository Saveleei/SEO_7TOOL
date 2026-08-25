import type Database from "better-sqlite3";
import { db } from "./db";

export const SEO_INTELLIGENCE_SECTIONS = [
  ["dashboard", "Dashboard"],
  ["products", "Products"],
  ["supplier-feed", "Supplier Feed"],
  ["keywords", "Keywords"],
  ["clusters", "Clusters"],
  ["pain-points", "Pain Points"],
  ["review-insights", "Review Insights"],
  ["competitors", "Competitors"],
  ["opportunities", "Opportunities"],
  ["articles", "Articles"],
  ["comparisons", "Comparisons"],
  ["calculators", "Calculators"],
  ["media", "Media"],
  ["internal-links", "Internal Links"],
  ["leads", "Leads"],
  ["performance", "Performance"],
  ["publishing-queue", "Publishing Queue"],
  ["errors", "Errors"],
] as const;

type RankedItem = { label: string; value: number; detail?: string };
type QueueCount = { status: string; count: number };

export type SeoDashboardData = {
  schemaReady: boolean;
  period: { start: string; end: string } | null;
  metrics: {
    organicClicks: number;
    impressions: number;
    averagePosition: number | null;
    indexedPages: number;
    organicLeads: number;
    revenueMinor: number;
  };
  signals: {
    quickWins: number;
    cannibalization: number;
    indexationIssues: number;
    contentDecay: number;
  };
  counts: Record<string, number>;
  topCategories: RankedItem[];
  topArticles: RankedItem[];
  topProducts: RankedItem[];
  publishingQueue: QueueCount[];
  errors: RankedItem[];
};

function hasTable(database: Database.Database, name: string) {
  return Boolean(database.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?").get(name));
}

function hasColumn(database: Database.Database, table: string, column: string) {
  return hasTable(database, table)
    && (database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some((item) => item.name === column);
}

function count(database: Database.Database, table: string, where = "1 = 1") {
  if (!hasTable(database, table)) return 0;
  return (database.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`).get() as { count: number }).count;
}

function latestRefreshRun(database: Database.Database) {
  if (!hasTable(database, "content_refresh_runs")) return null;
  return database.prepare(`
    SELECT * FROM content_refresh_runs ORDER BY evaluated_at DESC, id DESC LIMIT 1
  `).get() as { id: string; period_start: string; period_end: string } | undefined ?? null;
}

function refreshMetrics(database: Database.Database, runId: string) {
  return database.prepare(`
    SELECT COALESCE(SUM(clicks), 0) AS clicks,
      COALESCE(SUM(impressions), 0) AS impressions,
      COALESCE(SUM(organic_leads), 0) AS organic_leads,
      CASE WHEN SUM(impressions) > 0
        THEN SUM(COALESCE(average_position, 0) * impressions) / SUM(impressions)
        ELSE NULL END AS average_position
    FROM content_refresh_assessments WHERE run_id = ?
  `).get(runId) as { clicks: number; impressions: number; organic_leads: number; average_position: number | null };
}

function latestGoogleMetrics(database: Database.Database) {
  if (!hasTable(database, "gsc_import_runs") || !hasTable(database, "gsc_search_performance_daily")) {
    return { clicks: 0, impressions: 0, average_position: null, period_start: null, period_end: null };
  }
  const run = database.prepare(`
    SELECT * FROM gsc_import_runs WHERE status = 'COMPLETE' AND search_type = 'WEB'
    ORDER BY period_end DESC, imported_at DESC, id DESC LIMIT 1
  `).get() as { id: string; period_start: string; period_end: string } | undefined;
  if (!run) return { clicks: 0, impressions: 0, average_position: null, period_start: null, period_end: null };
  const metrics = database.prepare(`
    SELECT COALESCE(SUM(clicks), 0) AS clicks,
      COALESCE(SUM(impressions), 0) AS impressions,
      CASE WHEN SUM(impressions) > 0
        THEN SUM(average_position * impressions) / SUM(impressions)
        ELSE NULL END AS average_position
    FROM gsc_search_performance_daily WHERE run_id = ? AND is_facet = 0
  `).get(run.id) as { clicks: number; impressions: number; average_position: number | null };
  return { ...metrics, period_start: run.period_start, period_end: run.period_end };
}

function latestBusinessMetrics(database: Database.Database, period?: { start: string; end: string }) {
  if (!hasTable(database, "analytics_business_kpi_snapshots")) return { organicLeads: 0, revenueMinor: 0 };
  const row = period
    ? database.prepare(`
        SELECT qualified_leads, revenue_minor FROM analytics_business_kpi_snapshots
        WHERE period_start = ? AND period_end = ?
        ORDER BY evaluated_at DESC, id DESC LIMIT 1
      `).get(period.start, period.end) as { qualified_leads: number; revenue_minor: number } | undefined
    : database.prepare(`
        SELECT qualified_leads, revenue_minor FROM analytics_business_kpi_snapshots
        ORDER BY period_end DESC, evaluated_at DESC, id DESC LIMIT 1
      `).get() as { qualified_leads: number; revenue_minor: number } | undefined;
  return { organicLeads: row?.qualified_leads ?? 0, revenueMinor: row?.revenue_minor ?? 0 };
}

function topRefreshArticles(database: Database.Database, runId: string): RankedItem[] {
  return (database.prepare(`
    SELECT asset.title AS label, assessment.clicks AS value,
      assessment.page_path AS detail
    FROM content_refresh_assessments assessment
    JOIN content_assets asset ON asset.id = assessment.content_id
    WHERE assessment.run_id = ?
    ORDER BY assessment.clicks DESC, assessment.impressions DESC, asset.title
    LIMIT 5
  `).all(runId) as Array<{ label: string; value: number; detail: string }>);
}

function topRefreshCategories(database: Database.Database, runId: string): RankedItem[] {
  return (database.prepare(`
    SELECT asset.category_slug AS label, SUM(assessment.clicks) AS value,
      printf('%d показов', CAST(SUM(assessment.impressions) AS INTEGER)) AS detail
    FROM content_refresh_assessments assessment
    JOIN content_assets asset ON asset.id = assessment.content_id
    WHERE assessment.run_id = ?
    GROUP BY asset.category_slug
    ORDER BY value DESC, label LIMIT 5
  `).all(runId) as Array<{ label: string; value: number; detail: string }>);
}

function topProducts(database: Database.Database): RankedItem[] {
  if (!hasTable(database, "gsc_import_runs") || !hasTable(database, "gsc_search_performance_daily")) return [];
  const run = database.prepare(`
    SELECT id FROM gsc_import_runs WHERE status = 'COMPLETE' AND search_type = 'WEB'
    ORDER BY period_end DESC, imported_at DESC, id DESC LIMIT 1
  `).get() as { id: string } | undefined;
  if (!run) return [];
  return database.prepare(`
    SELECT page_path AS label, SUM(clicks) AS value,
      printf('%d показов', CAST(SUM(impressions) AS INTEGER)) AS detail
    FROM gsc_search_performance_daily
    WHERE run_id = ? AND is_facet = 0 AND route_path LIKE '/p/%'
    GROUP BY page_path ORDER BY value DESC, SUM(impressions) DESC, page_path LIMIT 5
  `).all(run.id) as RankedItem[];
}

function queueCounts(database: Database.Database): QueueCount[] {
  if (!hasTable(database, "content_publish_queue")) return [];
  return database.prepare(`
    SELECT status, COUNT(*) AS count FROM content_publish_queue
    GROUP BY status ORDER BY status
  `).all() as QueueCount[];
}

function supplierFeedRuns(database: Database.Database) {
  if (!hasTable(database, "import_runs") || !hasTable(database, "sources")) return 0;
  return (database.prepare(`
    SELECT COUNT(*) AS count FROM import_runs run
    JOIN sources source ON source.id = run.source_id
    WHERE source.source_type = 'SUPPLIER_FEED'
  `).get() as { count: number }).count;
}

export function getSeoDashboardData(): SeoDashboardData {
  const database = db();
  const refreshRun = latestRefreshRun(database);
  const refresh = refreshRun && hasTable(database, "content_refresh_assessments")
    ? refreshMetrics(database, refreshRun.id)
    : null;
  const google = refresh ? null : latestGoogleMetrics(database);
  const business = latestBusinessMetrics(database, refreshRun
    ? { start: refreshRun.period_start, end: refreshRun.period_end }
    : undefined);
  const indexedPages = hasTable(database, "site_urls")
    ? count(database, "site_urls", "index_status = 'INDEX' AND http_status BETWEEN 200 AND 299")
    : 0;
  const indexationIssues = hasTable(database, "site_urls")
    ? count(database, "site_urls", "index_status != 'INDEX' OR http_status IS NULL OR http_status < 200 OR http_status >= 400")
    : 0;
  const quickWins = hasTable(database, "google_quick_wins") ? count(database, "google_quick_wins") : 0;
  const cannibalization = refreshRun && hasTable(database, "content_refresh_assessments")
    ? (database.prepare(`
        SELECT COUNT(*) AS count FROM content_refresh_assessments
        WHERE run_id = ? AND cannibalization_risk = 'HIGH'
      `).get(refreshRun.id) as { count: number }).count
    : 0;
  const contentDecay = refreshRun && hasTable(database, "content_refresh_assessments")
    ? (database.prepare(`
        SELECT COUNT(*) AS count FROM content_refresh_assessments
        WHERE run_id = ? AND pruning_eligible = 1
      `).get(refreshRun.id) as { count: number }).count
    : 0;
  const duplicateErrors = refreshRun && hasTable(database, "content_refresh_assessments")
    ? (database.prepare(`
        SELECT COUNT(*) AS count FROM content_refresh_assessments
        WHERE run_id = ? AND duplicate_risk = 'HIGH'
      `).get(refreshRun.id) as { count: number }).count
    : 0;
  const blockedQueue = hasTable(database, "content_publish_queue")
    ? count(database, "content_publish_queue", "status = 'BLOCKED'") : 0;
  const staleLinks = hasTable(database, "semantic_link_sets")
    ? count(database, "semantic_link_sets", "status = 'STALE'") : 0;
  const poorVitals = hasTable(database, "core_web_vital_samples")
    ? count(database, "core_web_vital_samples", "rating = 'POOR'") : 0;

  const counts: Record<string, number> = {
    products: count(database, "products", hasColumn(database, "products", "draft") ? "draft = 0" : "1 = 1"),
    "supplier-feed": supplierFeedRuns(database),
    keywords: count(database, "seo_keywords"),
    clusters: count(database, "keyword_clusters"),
    "pain-points": count(database, "pain_points"),
    "review-insights": count(database, "review_insights"),
    competitors: count(database, "serp_snapshots"),
    opportunities: count(database, "content_opportunities"),
    articles: count(database, "content_assets"),
    comparisons: hasTable(database, "content_assets") ? count(database, "content_assets", "content_type = 'COMPARISON'") : 0,
    calculators: count(database, "interactive_tool_sets"),
    media: count(database, "media_assets"),
    "internal-links": count(database, "semantic_link_items"),
    leads: count(database, "leads"),
    performance: refreshRun && hasTable(database, "content_refresh_assessments")
      ? (database.prepare("SELECT COUNT(*) AS count FROM content_refresh_assessments WHERE run_id = ?").get(refreshRun.id) as { count: number }).count
      : 0,
    "publishing-queue": count(database, "content_publish_queue"),
    errors: indexationIssues + cannibalization + duplicateErrors + blockedQueue + staleLinks + poorVitals,
  };

  return {
    schemaReady: Boolean(refreshRun),
    period: refreshRun
      ? { start: refreshRun.period_start, end: refreshRun.period_end }
      : google?.period_start && google.period_end ? { start: google.period_start, end: google.period_end } : null,
    metrics: {
      organicClicks: refresh?.clicks ?? google?.clicks ?? 0,
      impressions: refresh?.impressions ?? google?.impressions ?? 0,
      averagePosition: refresh?.average_position ?? google?.average_position ?? null,
      indexedPages,
      organicLeads: refresh?.organic_leads ?? business.organicLeads,
      revenueMinor: business.revenueMinor,
    },
    signals: { quickWins, cannibalization, indexationIssues, contentDecay },
    counts,
    topCategories: refreshRun ? topRefreshCategories(database, refreshRun.id) : [],
    topArticles: refreshRun ? topRefreshArticles(database, refreshRun.id) : [],
    topProducts: topProducts(database),
    publishingQueue: queueCounts(database),
    errors: [
      { label: "Indexation issues", value: indexationIssues },
      { label: "High cannibalization", value: cannibalization },
      { label: "Semantic duplicates", value: duplicateErrors },
      { label: "Blocked publishing", value: blockedQueue },
      { label: "Stale internal links", value: staleLinks },
      { label: "Poor Core Web Vitals", value: poorVitals },
    ].filter((item) => item.value > 0),
  };
}
