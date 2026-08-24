import Database from "better-sqlite3";
import path from "node:path";
import {
  evaluatePilotKpis,
  evaluatePilotPlan,
  getPilotStatus,
  materializePilotKpis,
  materializePilotPlan,
  reviewPilotContentWorkItem,
  reviewPilotProgram,
} from "../src/lib/pilot-program.mjs";

const command = process.argv[2];
const apply = process.argv.includes("--apply");
const value = (name) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const dbPath = path.resolve(value("db") || process.env.SQLITE_PATH || "data.db");
const pilotId = value("pilot-id") || "phase19-pilot";

function usage() {
  return [
    "Usage: node scripts/pilot-program.mjs <command> [options]",
    "Commands:",
    "  plan --created-by=<actor> [--pilot-id=phase19-pilot] [--apply]",
    "  review-item --item-id=<id> --decision=APPROVE|REJECT --reviewed-by=<actor> --apply",
    "  review-program --decision=APPROVE|REJECT --reviewed-by=<actor> [--selection-run-id=<id>] --apply",
    "  kpi --start=YYYY-MM-DD --end=YYYY-MM-DD --gsc-property=<uri> --yandex-host=<host> [--apply]",
    "  status [--pilot-id=phase19-pilot]",
    "Dry-run is the default for plan and kpi. No command creates or publishes content.",
  ].join("\n");
}

if (!new Set(["plan", "review-item", "review-program", "kpi", "status"]).has(command)) {
  throw new Error(usage());
}
if (new Set(["review-item", "review-program"]).has(command) && !apply) {
  throw new Error(`Review commands require --apply\n${usage()}`);
}

const database = new Database(dbPath, { readonly: !apply, fileMustExist: true });
database.pragma("foreign_keys = ON");
if (apply) database.pragma("busy_timeout = 5000");

try {
  if (command === "plan") {
    const input = { pilotId, createdBy: value("created-by") };
    const result = apply ? materializePilotPlan(database, input) : evaluatePilotPlan(database, input);
    console.log(JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      pilotId: result.pilot.id,
      ready: result.ready,
      limits: {
        categories: result.pilot.categoryLimit,
        candidatesPerCategory: result.pilot.candidateLimitPerCategory,
        topPerCategory: result.pilot.topLimitPerCategory,
        contentItemsPerCategory: result.pilot.contentItemsPerCategory,
      },
      categories: result.categories.map((category) => ({
        slug: category.slug,
        sourceOpportunities: category.sourceOpportunityCount,
        selectedCandidates: category.candidates.length,
        selectedTop: category.topOpportunities.length,
        plannedContent: category.workItems.map((item) => ({
          slot: item.ordinal, type: item.slotType, opportunityId: item.opportunityId, topRank: item.topRank,
        })),
      })),
      blockers: result.blockers,
      selectionRunId: result.selectionRunId,
      duplicate: result.duplicate ?? false,
      savedCandidates: result.savedCandidates ?? 0,
      savedWorkItems: result.savedWorkItems ?? 0,
      status: "REVIEW_REQUIRED",
    }, null, 2));
  }

  if (command === "review-item") {
    const result = reviewPilotContentWorkItem(database, {
      itemId: value("item-id"), decision: value("decision"), reviewedBy: value("reviewed-by"),
    });
    console.log(JSON.stringify(result, null, 2));
  }

  if (command === "review-program") {
    const result = reviewPilotProgram(database, {
      pilotId, selectionRunId: value("selection-run-id"),
      decision: value("decision"), reviewedBy: value("reviewed-by"),
    });
    console.log(JSON.stringify(result, null, 2));
  }

  if (command === "kpi") {
    const input = {
      pilotId,
      selectionRunId: value("selection-run-id"),
      periodStart: value("start"),
      periodEnd: value("end"),
      gscPropertyUri: value("gsc-property"),
      yandexHostId: value("yandex-host"),
    };
    const result = apply ? materializePilotKpis(database, input) : evaluatePilotKpis(database, input);
    console.log(JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      pilotId: result.pilotId,
      selectionRunId: result.selectionRunId,
      periodStart: result.periodStart,
      periodEnd: result.periodEnd,
      sourceRuns: result.sourceRuns,
      scopes: result.scopes.map((scope) => ({
        scopeType: scope.scopeType,
        categorySlug: scope.categorySlug,
        indexation: `${scope.indexedUrlCount}/${scope.trackedUrlCount}`,
        impressions: scope.impressions,
        queries: scope.queryCount,
        clicks: scope.clicks,
        ctr: scope.ctr,
        position: scope.averagePosition,
        productClicks: scope.productClicks,
        leadRate: scope.leadRate,
        organicLeads: scope.organicLeads,
        revenueMinor: scope.revenueMinor,
      })),
      savedSnapshots: result.savedSnapshots ?? 0,
      status: "REVIEW_REQUIRED",
    }, null, 2));
  }

  if (command === "status") {
    console.log(JSON.stringify(getPilotStatus(database, { pilotId }), null, 2));
  }
} finally {
  database.close();
}
