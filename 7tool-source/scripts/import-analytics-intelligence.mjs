import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseAnalyticsIntelligenceImport } from "./lib/analytics-intelligence-import.mjs";
import {
  buildMetricaAnalyticsReportRequests,
  importAnalyticsBusinessOutcomes,
  importAnalyticsPageMetrics,
  validateAnalyticsBusinessOutcomeImport,
  validateAnalyticsPageMetricsImport,
} from "../src/lib/analytics-intelligence.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const value = (name) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = process.argv.includes("--apply");
const dataset = (value("dataset") || "").toLocaleLowerCase("en");
const fileArg = value("file");
if (!fileArg) throw new Error("--file=<analytics csv|json> is required");
const filePath = path.resolve(fileArg);
const sourceBuffers = [fs.readFileSync(filePath)];
let goalMapBuffer;
let metricMap = {};
if (dataset === "page-metrics" && value("goal-map")) {
  goalMapBuffer = fs.readFileSync(path.resolve(value("goal-map")));
  const goalMap = JSON.parse(goalMapBuffer.toString("utf8"));
  const contracts = buildMetricaAnalyticsReportRequests({
    counterId: value("counter-id") || process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || "109097461",
    periodStart: value("start"), periodEnd: value("end"), goalIds: goalMap,
    organicProductViewGoalId: value("organic-product-view-goal-id"),
  });
  metricMap = contracts.events.metricMap;
  const organicFile = value("organic-product-views-file");
  if (!organicFile) throw new Error("Official page metrics import requires --organic-product-views-file=<json|csv>");
  sourceBuffers.push(fs.readFileSync(path.resolve(organicFile)));
  const eventRows = parseAnalyticsIntelligenceImport(sourceBuffers[0].toString("utf8"), dataset, { format: value("format") || "auto", metricMap }).rows;
  const organicRows = parseAnalyticsIntelligenceImport(sourceBuffers[1].toString("utf8"), dataset, { format: value("format") || "auto", metricMap: contracts.organicProductViews.metricMap }).rows;
  metricMap = { rows: [...eventRows, ...organicRows] };
}
const parsed = Array.isArray(metricMap.rows)
  ? { rows: metricMap.rows }
  : parseAnalyticsIntelligenceImport(sourceBuffers[0].toString("utf8"), dataset, { format: value("format") || "auto", metricMap });
const sourceHasher = createHash("sha256");
for (const buffer of goalMapBuffer ? [...sourceBuffers, goalMapBuffer] : sourceBuffers) sourceHasher.update(`${buffer.length}:`).update(buffer);
const sourceSha256 = sourceHasher.digest("hex");
const common = {
  periodStart: value("start"), periodEnd: value("end"),
  sourceRef: value("source-ref") || (sourceBuffers.length > 1 ? `${path.basename(filePath)}+organic` : path.basename(filePath)),
  sourceSha256, rows: parsed.rows,
};
const definitions = {
  "page-metrics": {
    validate: validateAnalyticsPageMetricsImport,
    import: importAnalyticsPageMetrics,
    input: {
      ...common,
      counterId: value("counter-id") || process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || "109097461",
      acquisitionMethod: value("acquisition") || (value("goal-map") ? "YANDEX_METRIKA_REPORTS_API" : "OFFICIAL_EXPORT"),
    },
  },
  "business-outcomes": {
    validate: validateAnalyticsBusinessOutcomeImport,
    import: importAnalyticsBusinessOutcomes,
    input: {
      ...common,
      subjectRef: value("subject") || "crm:7tool",
      acquisitionMethod: "CRM_EXPORT",
      moneyUnit: value("money-unit") || "RUB",
    },
  },
};
const definition = definitions[dataset];
if (!definition) throw new Error("--dataset=page-metrics|business-outcomes is required");
const validated = definition.validate(definition.input);
const summary = {
  mode: apply ? "apply" : "dry-run", dataset: validated.datasetType,
  sourceSystem: validated.sourceSystem, periodStart: validated.periodStart,
  periodEnd: validated.periodEnd, rows: validated.rows.length,
  dimensions: validated.dimensions, metrics: validated.metrics,
};
if (!apply) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}
const dbPath = path.resolve(value("db") || process.env.SQLITE_PATH || path.join(root, "data.db"));
const database = new Database(dbPath, { fileMustExist: true });
database.pragma("foreign_keys = ON");
try {
  const result = definition.import(database, definition.input);
  console.log(JSON.stringify({ ...summary, importedRows: result.importedRows, duplicate: result.duplicate, runId: result.run.id }, null, 2));
} finally { database.close(); }
