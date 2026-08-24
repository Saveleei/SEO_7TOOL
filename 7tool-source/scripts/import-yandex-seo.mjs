import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseYandexSeoImport } from "./lib/yandex-seo-import.mjs";
import {
  importYandexMetrica,
  importYandexWebmaster,
  importYandexWordstat,
  validateYandexMetricaImport,
  validateYandexWebmasterImport,
  validateYandexWordstatImport,
} from "../src/lib/yandex-seo.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const value = (name) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = process.argv.includes("--apply");
const dataset = (value("dataset") || "").toLocaleLowerCase("en");
const fileArg = value("file");
if (!fileArg) throw new Error("--file=<Yandex csv|json> is required");
const filePath = path.resolve(fileArg);
const source = fs.readFileSync(filePath);
const parsed = parseYandexSeoImport(source.toString("utf8"), dataset, value("format") || "auto");
const common = {
  periodStart: value("start"),
  periodEnd: value("end"),
  acquisitionMethod: value("acquisition") || "OFFICIAL_EXPORT",
  sourceRef: value("source-ref") || path.basename(filePath),
  sourceSha256: createHash("sha256").update(source).digest("hex"),
  rows: parsed.rows,
};

const definitions = {
  webmaster: {
    validate: validateYandexWebmasterImport,
    import: importYandexWebmaster,
    input: { ...common, subjectRef: value("subject") || "https://7tool.ru/", device: value("device") || "UNKNOWN" },
  },
  wordstat: {
    validate: validateYandexWordstatImport,
    import: importYandexWordstat,
    input: {
      ...common,
      subjectRef: value("subject") || "wordstat:7tool.ru",
      seedPhrase: value("seed-phrase"),
      regionIds: value("region-ids") || "",
      regionKey: value("region-key") || "RU",
      device: value("device") || "ALL",
      categorySlug: value("category") || undefined,
      semanticSourceId: value("semantic-source-id") || undefined,
      mirrorSemantic: !process.argv.includes("--no-semantic"),
    },
  },
  metrica: {
    validate: validateYandexMetricaImport,
    import: importYandexMetrica,
    input: {
      ...common,
      counterId: value("counter-id") || process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || "109097461",
      bounceRateUnit: value("bounce-rate-unit") || "PERCENT",
    },
  },
};
const definition = definitions[dataset];
if (!definition) throw new Error("--dataset=webmaster|wordstat|metrica is required");
const validated = definition.validate(definition.input);
const summary = {
  mode: apply ? "apply" : "dry-run",
  dataset: validated.datasetType,
  sourceSystem: validated.sourceSystem,
  periodStart: validated.periodStart,
  periodEnd: validated.periodEnd,
  acquisitionMethod: validated.acquisitionMethod,
  rows: validated.rows.length,
  dimensions: validated.dimensions,
  metrics: validated.metrics,
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
  const result = definition.import(database, definition.input);
  console.log(JSON.stringify({
    ...summary,
    importedRows: result.importedRows,
    duplicate: result.duplicate,
    runId: result.run.id,
    semanticImportRunId: result.semantic?.runId ?? result.run.semantic_import_run_id ?? null,
    clusters: result.clusters ?? [],
  }, null, 2));
} finally {
  database.close();
}
