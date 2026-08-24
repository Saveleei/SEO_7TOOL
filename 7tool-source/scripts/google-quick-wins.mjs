import Database from "better-sqlite3";
import path from "node:path";
import { evaluateGoogleQuickWins, materializeGoogleQuickWins } from "../src/lib/google-seo.mjs";

const value = (name) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = process.argv.includes("--apply");
const input = {
  propertyUri: value("property") || "sc-domain:7tool.ru",
  periodStart: value("start"),
  periodEnd: value("end"),
  minImpressions: value("min-impressions"),
};
const dbPath = path.resolve(value("db") || process.env.SQLITE_PATH || "data.db");
const database = new Database(dbPath, { readonly: !apply, fileMustExist: true });
database.pragma("foreign_keys = ON");
try {
  const result = apply ? materializeGoogleQuickWins(database, input) : { items: evaluateGoogleQuickWins(database, input), saved: 0 };
  const totals = result.items.reduce((aggregate, item) => ({
    impressions: aggregate.impressions + item.impressions,
    clicks: aggregate.clicks + item.clicks,
  }), { impressions: 0, clicks: 0 });
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    status: "HIGH_PRIORITY_UPDATE",
    decision: "UPDATE",
    candidates: result.items.length,
    saved: result.saved,
    totals,
    note: "Existing live indexable URLs only; no page creation.",
  }, null, 2));
} finally {
  database.close();
}
