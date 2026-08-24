import Database from "better-sqlite3";
import path from "node:path";
import { discoverYandexQueryOpportunities, materializeYandexQueryOpportunities } from "../src/lib/yandex-seo.mjs";

const value = (name) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = process.argv.includes("--apply");
const input = {
  periodStart: value("start"),
  periodEnd: value("end"),
  minWordstatDemand: value("min-wordstat-demand"),
  minWebmasterImpressions: value("min-webmaster-impressions"),
  regionKey: value("region-key") || "RU",
  wordstatDevice: value("device") || "ALL",
  categorySlug: value("category") || undefined,
  wordstatSubjectRef: value("wordstat-subject") || "wordstat:7tool.ru",
  metricaCounterId: value("counter-id") || process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || "109097461",
};
const dbPath = path.resolve(value("db") || process.env.SQLITE_PATH || "data.db");
const database = new Database(dbPath, { readonly: !apply, fileMustExist: true });
database.pragma("foreign_keys = ON");
try {
  const result = apply
    ? materializeYandexQueryOpportunities(database, input)
    : { items: discoverYandexQueryOpportunities(database, input), saved: 0 };
  const byBasis = result.items.reduce((counts, item) => {
    counts[item.discoveryBasis] = (counts[item.discoveryBasis] || 0) + 1;
    return counts;
  }, {});
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    status: "REVIEW_REQUIRED",
    candidates: result.items.length,
    saved: result.saved,
    byBasis,
    note: "Wordstat discovers demand; Webmaster discovers performance of existing URLs. No page is created.",
  }, null, 2));
} finally {
  database.close();
}
