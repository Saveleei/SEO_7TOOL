const ALIASES = new Map([
  ["date", "date"], ["дата", "date"], ["ym:s:date", "date"], ["ym:ep:date", "date"],
  ["page", "page"], ["url", "page"], ["page path", "page"], ["страница", "page"],
  ["start url", "page"], ["ym:s:starturl", "page"], ["event url", "page"], ["ym:ep:eventurl", "page"],
  ["page type", "pageType"], ["page_type", "pageType"], ["тип страницы", "pageType"],
  ["metric", "metricName"], ["metric name", "metricName"], ["metric_name", "metricName"], ["метрика", "metricName"],
  ["value", "metricValue"], ["count", "metricValue"], ["metric value", "metricValue"], ["metric_value", "metricValue"], ["значение", "metricValue"],
  ["external outcome id", "externalOutcomeId"], ["external_outcome_id", "externalOutcomeId"], ["outcome id", "externalOutcomeId"],
  ["lead id", "leadId"], ["lead_id", "leadId"], ["local lead id", "leadId"],
  ["lead request id", "leadRequestId"], ["lead_request_id", "leadRequestId"], ["request id", "leadRequestId"], ["request_id", "leadRequestId"],
  ["outcome type", "outcomeType"], ["outcome_type", "outcomeType"], ["type", "outcomeType"], ["тип результата", "outcomeType"],
  ["occurred at", "occurredAt"], ["occurred_at", "occurredAt"], ["outcome date", "occurredAt"],
  ["revenue", "revenue"], ["выручка", "revenue"],
  ["gross margin", "grossMargin"], ["gross_margin", "grossMargin"], ["margin", "grossMargin"], ["валовая прибыль", "grossMargin"],
]);

function normalizedHeader(value) {
  return String(value ?? "").replace(/^\uFEFF/, "").normalize("NFKC")
    .trim().toLocaleLowerCase("ru").replace(/_/g, " ").replace(/\s+/g, " ");
}

function header(value) {
  const normalized = normalizedHeader(value);
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
  if (quoted) throw new Error("Analytics CSV contains an unterminated quoted field");
  row.push(field.replace(/\r$/, ""));
  if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length < 1) throw new Error("Analytics CSV must contain a header");
  const headers = rows[0].map(header);
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((name, index) => [name, values[index]])));
}

function dimensionValue(value) {
  if (value && typeof value === "object") return value.name ?? value.id ?? "";
  return value;
}

function normalizeMetricMap(metricMap = {}) {
  return Object.fromEntries(Object.entries(metricMap).map(([name, metric]) => [normalizedHeader(name), metric]));
}

function expandPageRows(rows, metricMap = {}) {
  const mapping = normalizeMetricMap(metricMap);
  return rows.flatMap((row) => {
    if (row.metricName !== undefined) return [row];
    return Object.entries(row).flatMap(([name, value]) => {
      const metricName = mapping[normalizedHeader(name)];
      return metricName ? [{ date: row.date, page: row.page, pageType: row.pageType, metricName, metricValue: value }] : [];
    });
  });
}

function reportRows(parsed, metricMap) {
  if (!Array.isArray(parsed?.data) || !Array.isArray(parsed?.query?.dimensions) || !Array.isArray(parsed?.query?.metrics)) return null;
  const mapping = normalizeMetricMap(metricMap);
  const unknown = parsed.query.metrics.filter((metric) => !mapping[normalizedHeader(metric)]);
  if (unknown.length) throw new Error(`Metrica report contains unmapped metrics: ${unknown.join(", ")}`);
  return parsed.data.flatMap((item) => {
    const dimensions = Object.fromEntries(parsed.query.dimensions.map((name, index) => [header(name), dimensionValue(item.dimensions?.[index])]));
    return parsed.query.metrics.map((metric, index) => ({
      date: dimensions.date,
      page: dimensions.page,
      metricName: mapping[normalizedHeader(metric)],
      metricValue: item.metrics?.[index],
    }));
  });
}

function objectRows(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.rows)) return parsed.rows;
  return null;
}

function normalizeObjects(rows) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([name, value]) => [header(name), value])));
}

function ensure(rows, required, dataset) {
  if (!rows.length) throw new Error(`${dataset} import must contain at least one row`);
  rows.forEach((row, index) => {
    const missing = required.filter((name) => row[name] === undefined || row[name] === null || String(row[name]).trim() === "");
    if (missing.length) throw new Error(`${dataset} row ${index + 1} is missing: ${missing.join(", ")}`);
  });
  return rows;
}

export function parseAnalyticsIntelligenceImport(text, datasetValue, { format = "auto", metricMap = {} } = {}) {
  const source = String(text ?? "").replace(/^\uFEFF/, "").trim();
  if (!source) throw new Error("Analytics import file is empty");
  const dataset = String(datasetValue ?? "").toLocaleLowerCase("en");
  if (!new Set(["page-metrics", "business-outcomes"]).has(dataset)) throw new Error("dataset must be page-metrics or business-outcomes");
  const normalizedFormat = String(format).toLocaleLowerCase("en");
  if (!new Set(["auto", "json", "csv"]).has(normalizedFormat)) throw new Error("format must be auto, json or csv");
  const selected = normalizedFormat === "auto" ? (/^[\[{]/.test(source) ? "json" : "csv") : normalizedFormat;
  let rows;
  if (selected === "json") {
    const parsed = JSON.parse(source);
    const report = dataset === "page-metrics" ? reportRows(parsed, metricMap) : null;
    rows = report ?? normalizeObjects(objectRows(parsed) ?? []);
  } else rows = parseCsv(source);
  if (dataset === "page-metrics") {
    rows = expandPageRows(rows, metricMap);
    return { dataset, format: selected, rows: ensure(rows, ["date", "page", "metricName", "metricValue"], dataset) };
  }
  return { dataset, format: selected, rows: rows.length ? ensure(rows, ["externalOutcomeId", "outcomeType", "occurredAt"], dataset) : [] };
}
