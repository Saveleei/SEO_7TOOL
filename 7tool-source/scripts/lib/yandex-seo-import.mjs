const ALIASES = new Map([
  ["date", "date"], ["дата", "date"], ["ym:s:date", "date"],
  ["url", "page"], ["page", "page"], ["страница", "page"], ["адрес страницы", "page"],
  ["start url", "page"], ["landing page", "page"], ["ym:s:starturl", "page"],
  ["query", "query"], ["phrase", "query"], ["keyword", "query"], ["запрос", "query"], ["фраза", "query"],
  ["search phrase", "query"], ["ym:s:lastsignsearchphrase", "query"],
  ["query id", "queryId"], ["query_id", "queryId"], ["id запроса", "queryId"],
  ["queryid", "queryId"],
  ["region", "region"], ["region id", "region"], ["region_id", "region"], ["регион", "region"],
  ["device", "device"], ["устройство", "device"],
  ["impressions", "impressions"], ["shows", "impressions"], ["показы", "impressions"],
  ["clicks", "clicks"], ["клики", "clicks"], ["ctr", "ctr"],
  ["position", "position"], ["average position", "position"], ["позиция", "position"],
  ["count", "demandCount"], ["frequency", "demandCount"], ["частотность", "demandCount"],
  ["demandcount", "demandCount"],
  ["category", "categorySlug"], ["category_slug", "categorySlug"], ["категория", "categorySlug"],
  ["categoryslug", "categorySlug"],
  ["source keyword id", "sourceKeywordId"], ["source_keyword_id", "sourceKeywordId"],
  ["sourcekeywordid", "sourceKeywordId"],
  ["search engine", "searchEngine"], ["поисковая система", "searchEngine"],
  ["searchengine", "searchEngine"],
  ["ym:s:lastsignsearchengineroot", "searchEngine"],
  ["visits", "visits"], ["sessions", "visits"], ["визиты", "visits"], ["ym:s:visits", "visits"],
  ["users", "users"], ["посетители", "users"], ["ym:s:users", "users"],
  ["pageviews", "pageviews"], ["page views", "pageviews"], ["просмотры", "pageviews"], ["ym:s:pageviews", "pageviews"],
  ["bounce rate", "bounceRate"], ["bounce_rate", "bounceRate"], ["отказы", "bounceRate"], ["ym:s:bouncerate", "bounceRate"],
  ["bouncerate", "bounceRate"], ["starturl", "page"], ["pageviews", "pageviews"],
]);

function header(value) {
  const normalized = String(value ?? "").replace(/^\uFEFF/, "").normalize("NFKC")
    .trim().toLocaleLowerCase("ru").replace(/_/g, " ").replace(/\s+/g, " ");
  return ALIASES.get(normalized) ?? normalized;
}

function delimiterFor(text) {
  const line = String(text).split(/\r?\n/, 1)[0] ?? "";
  if (line.includes("\t")) return "\t";
  return line.split(";").length > line.split(",").length ? ";" : ",";
}

function parseCsv(text) {
  const delimiter = delimiterFor(text);
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === delimiter) { row.push(field); field = ""; }
    else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (quoted) throw new Error("Yandex CSV contains an unterminated quoted field");
  row.push(field.replace(/\r$/, ""));
  if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length < 2) throw new Error("Yandex CSV must contain a header and at least one row");
  const headers = rows[0].map(header);
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((name, index) => [name, values[index]])));
}

function objectRows(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.rows)) return parsed.rows;
  return null;
}

function valueOfDimension(value) {
  if (value && typeof value === "object") return value.name ?? value.id ?? "";
  return value;
}

function reportsApiRows(parsed) {
  if (!Array.isArray(parsed?.data) || !Array.isArray(parsed?.query?.dimensions) || !Array.isArray(parsed?.query?.metrics)) return null;
  return parsed.data.map((item) => {
    const dimensions = Object.fromEntries(parsed.query.dimensions.map((name, index) => [header(name), valueOfDimension(item.dimensions?.[index])]));
    const metrics = Object.fromEntries(parsed.query.metrics.map((name, index) => [header(name), item.metrics?.[index]]));
    return { ...dimensions, ...metrics };
  });
}

function ensure(rows, required, dataset) {
  if (!rows.length) throw new Error(`${dataset} import must contain at least one row`);
  rows.forEach((row, index) => {
    const missing = required.filter((name) => row[name] === undefined || row[name] === null || String(row[name]).trim() === "");
    if (missing.length) throw new Error(`${dataset} row ${index + 1} is missing: ${missing.join(", ")}`);
  });
  return rows;
}

function normalizeObjects(rows) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([name, value]) => [header(name), value])));
}

function parseJson(source, dataset) {
  const parsed = JSON.parse(source);
  if (dataset === "wordstat" && Array.isArray(parsed?.topRequests)) {
    return parsed.topRequests.map((row) => ({ query: row.phrase, demandCount: row.count, sourceKeywordId: row.id }));
  }
  if (dataset === "metrica") {
    const reportRows = reportsApiRows(parsed);
    if (reportRows) return reportRows;
  }
  const rows = objectRows(parsed);
  if (!rows) throw new Error(`Unsupported ${dataset} JSON structure`);
  return normalizeObjects(rows);
}

export function parseYandexSeoImport(text, datasetValue, format = "auto") {
  const source = String(text ?? "").replace(/^\uFEFF/, "").trim();
  if (!source) throw new Error("Yandex import file is empty");
  const dataset = String(datasetValue ?? "").toLocaleLowerCase("en");
  if (!new Set(["webmaster", "wordstat", "metrica"]).has(dataset)) throw new Error("dataset must be webmaster, wordstat or metrica");
  const normalizedFormat = String(format).toLocaleLowerCase("en");
  if (!new Set(["auto", "json", "csv"]).has(normalizedFormat)) throw new Error("format must be auto, json or csv");
  const selected = normalizedFormat === "auto" ? (/^[\[{]/.test(source) ? "json" : "csv") : normalizedFormat;
  const rows = selected === "json" ? parseJson(source, dataset) : parseCsv(source);
  const required = dataset === "webmaster"
    ? ["date", "page", "query", "region", "clicks", "impressions"]
    : dataset === "wordstat" ? ["query", "demandCount"]
      : ["date", "page", "searchEngine", "visits", "users", "pageviews", "bounceRate"];
  return { dataset, format: selected, rows: ensure(rows, required, dataset) };
}
