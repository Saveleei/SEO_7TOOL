import { GSC_DIMENSIONS } from "../../src/lib/google-seo.mjs";

const HEADER_ALIASES = new Map([
  ["date", "date"], ["дата", "date"],
  ["page", "page"], ["url", "page"], ["страница", "page"],
  ["query", "query"], ["queries", "query"], ["запрос", "query"], ["запросы", "query"],
  ["country", "country"], ["страна", "country"],
  ["device", "device"], ["устройство", "device"],
  ["clicks", "clicks"], ["клики", "clicks"],
  ["impressions", "impressions"], ["показы", "impressions"],
  ["ctr", "ctr"],
  ["position", "position"], ["позиция", "position"], ["average position", "position"],
]);

function normalizedHeader(value) {
  return String(value ?? "").replace(/^\uFEFF/, "").normalize("NFKC").trim().toLocaleLowerCase("ru");
}

function parseCsvRows(text) {
  const headerLine = String(text).split(/\r?\n/, 1)[0] ?? "";
  const delimiter = headerLine.includes("\t") ? "\t"
    : (headerLine.split(";").length > headerLine.split(",").length ? ";" : ",");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (quoted) throw new Error("GSC CSV contains an unterminated quoted field");
  row.push(field.replace(/\r$/, ""));
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function jsonRows(parsed) {
  const rows = Array.isArray(parsed) ? parsed : parsed?.rows ?? parsed?.data?.rows;
  if (!Array.isArray(rows)) throw new Error("GSC JSON must contain a rows array");
  return rows.map((row) => {
    if (Array.isArray(row?.keys)) return row;
    return {
      keys: GSC_DIMENSIONS.map((dimension) => row?.[dimension]),
      clicks: row?.clicks,
      impressions: row?.impressions,
      ctr: row?.ctr,
      position: row?.position,
    };
  });
}

function csvRows(text) {
  const table = parseCsvRows(text);
  if (table.length < 2) throw new Error("GSC CSV must contain a header and at least one data row");
  const headers = table[0].map((header) => HEADER_ALIASES.get(normalizedHeader(header)) ?? normalizedHeader(header));
  const required = [...GSC_DIMENSIONS, "clicks", "impressions", "ctr", "position"];
  const missing = required.filter((name) => !headers.includes(name));
  if (missing.length) throw new Error(`GSC CSV is missing columns: ${missing.join(", ")}`);
  return table.slice(1).map((values) => {
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    return {
      keys: GSC_DIMENSIONS.map((dimension) => row[dimension]),
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    };
  });
}

export function parseGscImport(text, format = "auto") {
  const source = String(text ?? "").trim();
  if (!source) throw new Error("GSC import file is empty");
  const normalizedFormat = String(format).toLocaleLowerCase("en");
  if (!new Set(["auto", "json", "csv"]).has(normalizedFormat)) throw new Error("GSC import format must be auto, json or csv");
  const selected = normalizedFormat === "auto" ? (/^[\[{]/.test(source) ? "json" : "csv") : normalizedFormat;
  const rows = selected === "json" ? jsonRows(JSON.parse(source)) : csvRows(source);
  if (!rows.length) throw new Error("GSC import must contain at least one row");
  return { format: selected, dimensions: [...GSC_DIMENSIONS], rows };
}
