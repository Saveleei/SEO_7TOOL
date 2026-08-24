function parseCsvRows(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === "," || char === ";" || char === "\t") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

function key(value) {
  return String(value ?? "").trim().toLocaleLowerCase("ru").replace(/\s+/g, "_");
}

function numeric(value, label) {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  const parsed = Number(String(value).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid ${label}: ${value}`);
  return Math.round(parsed);
}

function normalizedRecord(record) {
  const get = (...aliases) => {
    for (const alias of aliases) if (record[alias] !== undefined) return record[alias];
    return undefined;
  };
  const query = String(get("query", "phrase", "фраза", "запрос", "keyword") ?? "").trim();
  if (!query || query.length > 500) throw new Error("Every keyword row needs query with length 1..500");
  return {
    query,
    frequency: numeric(get("frequency", "частотность", "shows", "показы"), "frequency"),
    exactFrequency: numeric(get("exact_frequency", "точная_частотность", "exact"), "exact frequency"),
    existingUrl: get("existing_url", "url", "страница") || undefined,
    categorySlug: get("category", "category_slug", "категория") || undefined,
    sourceKeywordId: get("source_keyword_id", "id") || undefined,
  };
}

export function parseKeywordImport(text, format = "auto") {
  const trimmed = String(text ?? "").replace(/^\uFEFF/, "").trim();
  const resolved = format === "auto" ? (trimmed.startsWith("[") || trimmed.startsWith("{") ? "json" : "csv") : format;
  if (resolved === "json") {
    const parsed = JSON.parse(trimmed);
    const list = Array.isArray(parsed) ? parsed : parsed.rows;
    if (!Array.isArray(list)) throw new Error("JSON import must be an array or { rows: [] }");
    return list.map((item) => normalizedRecord(Object.fromEntries(Object.entries(item).map(([k, v]) => [key(k), v]))));
  }
  const rows = parseCsvRows(trimmed);
  if (rows.length < 2) return [];
  const headers = rows[0].map(key);
  return rows.slice(1).map((cells) => normalizedRecord(Object.fromEntries(headers.map((header, index) => [header, cells[index]]))));
}
