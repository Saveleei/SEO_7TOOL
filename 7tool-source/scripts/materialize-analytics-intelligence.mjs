import Database from "better-sqlite3";
import path from "node:path";
import { evaluateAnalyticsIntelligence, materializeAnalyticsIntelligence } from "../src/lib/analytics-intelligence.mjs";

const value = (name) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = process.argv.includes("--apply");
const input = {
  periodStart: value("start"), periodEnd: value("end"),
  counterId: value("counter-id") || process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || "109097461",
  crmSubjectRef: value("crm-subject") || "crm:7tool",
};
const dbPath = path.resolve(value("db") || process.env.SQLITE_PATH || "data.db");
const database = new Database(dbPath, { readonly: !apply, fileMustExist: true });
database.pragma("foreign_keys = ON");
try {
  const result = apply ? materializeAnalyticsIntelligence(database, input) : evaluateAnalyticsIntelligence(database, input);
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run", status: "REVIEW_REQUIRED",
    periodStart: result.kpi.periodStart, periodEnd: result.kpi.periodEnd,
    businessKpi: {
      organicProductViews: result.kpi.organicProductViews,
      qualifiedLeads: result.kpi.qualifiedLeads,
      quotes: result.kpi.quotes,
      orders: result.kpi.orders,
      revenueMinor: result.kpi.revenueMinor,
      grossMarginMinor: result.kpi.grossMarginMinor,
      currency: result.kpi.currency,
    },
    contentPages: result.roi.length,
    savedKpi: result.savedKpi ?? 0,
    savedRoi: result.savedRoi ?? 0,
  }, null, 2));
} finally { database.close(); }
