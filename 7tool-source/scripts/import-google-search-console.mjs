import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseGscImport } from "./lib/gsc-import.mjs";
import { importGoogleSearchConsole, validateGoogleSearchConsoleImport } from "../src/lib/google-seo.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const value = (name) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = process.argv.includes("--apply");
const fileArg = value("file");
if (!fileArg) throw new Error("--file=<GSC csv|json> is required");
const filePath = path.resolve(fileArg);
const source = fs.readFileSync(filePath);
const parsed = parseGscImport(source.toString("utf8"), value("format") || "auto");
const input = {
  propertyUri: value("property") || "sc-domain:7tool.ru",
  periodStart: value("start"),
  periodEnd: value("end"),
  searchType: value("search-type") || "web",
  dimensions: parsed.dimensions,
  acquisitionMethod: (value("acquisition") || "SEARCH_CONSOLE_EXPORT").toLocaleUpperCase("en"),
  sourceRef: value("source-ref") || path.basename(filePath),
  sourceSha256: createHash("sha256").update(source).digest("hex"),
  rows: parsed.rows,
};
const validated = validateGoogleSearchConsoleImport(input);

const summary = {
  mode: apply ? "apply" : "dry-run",
  format: parsed.format,
  rows: validated.rows.length,
  dimensions: validated.dimensions,
  periodStart: validated.periodStart,
  periodEnd: validated.periodEnd,
  searchType: validated.searchType,
  acquisitionMethod: validated.acquisitionMethod,
};
if (!apply) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

const dbPath = path.resolve(value("db") || process.env.SQLITE_PATH || path.join(root, "data.db"));
const database = new Database(dbPath, { fileMustExist: true });
database.pragma("foreign_keys = ON");
database.pragma("busy_timeout = 5000");
try {
  const result = importGoogleSearchConsole(database, input);
  console.log(JSON.stringify({ ...summary, importedRows: result.importedRows, duplicate: result.duplicate, runId: result.run.id }, null, 2));
} finally {
  database.close();
}
