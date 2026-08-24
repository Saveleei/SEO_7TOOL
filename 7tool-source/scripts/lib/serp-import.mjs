function parseDelimited(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ";" || char === "\t") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

function key(value) {
  return String(value ?? "").trim().toLocaleLowerCase("ru").replace(/\s+/g, "_");
}

function keyed(record) {
  return Object.fromEntries(Object.entries(record).map(([name, value]) => [key(name), value]));
}

function get(record, ...aliases) {
  for (const alias of aliases) if (record[alias] !== undefined && record[alias] !== "") return record[alias];
  return undefined;
}

function normalizeResult(record, index) {
  const position = Number(get(record, "position", "rank", "позиция") ?? index + 1);
  const url = String(get(record, "url", "link", "ссылка") ?? "").trim();
  if (!url) throw new Error(`SERP result ${index + 1} requires url/link`);
  return {
    position,
    url,
    title: get(record, "title", "name", "заголовок"),
    pageType: get(record, "page_type", "pagetype", "тип_страницы"),
    siteClass: get(record, "site_class", "siteclass", "класс_сайта"),
    mimeType: get(record, "mime_type", "mime", "тип_файла"),
    hasTable: get(record, "has_table", "таблица"),
    hasCalculator: get(record, "has_calculator", "калькулятор"),
    hasVideo: get(record, "has_video", "видео"),
    hasFaq: get(record, "has_faq", "faq"),
  };
}

function normalizeInsight(record) {
  const insightType = String(get(record, "insight_type", "insighttype", "type", "тип") ?? "").trim();
  const summary = String(get(record, "summary", "observation", "наблюдение") ?? "").trim();
  if (!insightType || !summary) throw new Error("Each competitor insight requires insight_type and summary");
  return {
    insightType,
    summary,
    severity: get(record, "severity", "важность"),
    evidenceUrl: get(record, "evidence_url", "evidenceurl", "источник"),
    resultPosition: get(record, "result_position", "resultposition", "позиция_результата"),
  };
}

export function parseSerpImport(text, defaults = {}) {
  const trimmed = String(text ?? "").replace(/^\uFEFF/, "").trim();
  if (!trimmed) throw new Error("SERP import is empty");
  const looksJson = trimmed.startsWith("[") || trimmed.startsWith("{");
  if (looksJson) {
    const parsed = JSON.parse(trimmed);
    const envelope = Array.isArray(parsed) ? { results: parsed } : parsed;
    const rawResults = envelope.results ?? envelope.items;
    if (!Array.isArray(rawResults)) throw new Error("JSON SERP import must be an array or contain results/items");
    return {
      engine: envelope.engine ?? defaults.engine,
      query: envelope.query ?? envelope.searchTerms ?? defaults.query,
      region: envelope.region ?? defaults.region,
      language: envelope.language ?? defaults.language,
      device: envelope.device ?? defaults.device,
      capturedAt: envelope.capturedAt ?? envelope.captured_at ?? defaults.capturedAt,
      topN: envelope.topN ?? envelope.top_n ?? defaults.topN,
      results: rawResults.map((record, index) => normalizeResult(keyed(record), index)),
      insights: (envelope.insights ?? []).map((record) => normalizeInsight(keyed(record))),
    };
  }
  const matrix = parseDelimited(trimmed);
  if (matrix.length < 2) throw new Error("Delimited SERP import requires a header and at least one result");
  const headers = matrix[0].map(key);
  return {
    ...defaults,
    results: matrix.slice(1).map((cells, index) => normalizeResult(Object.fromEntries(headers.map((header, column) => [header, cells[column]])), index)),
    insights: [],
  };
}
