function parseDelimited(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
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

function normalizeRecord(record, defaults) {
  const get = (...aliases) => {
    for (const alias of aliases) if (record[alias] !== undefined && record[alias] !== "") return record[alias];
    return undefined;
  };
  const text = String(get("text", "review", "отзыв", "текст") ?? "").trim();
  const sourceUrl = String(get("source_url", "url", "ссылка") ?? defaults.sourceUrl ?? "").trim();
  const categorySlug = String(get("category_slug", "category", "категория") ?? defaults.categorySlug ?? "").trim();
  if (!text || !sourceUrl || !categorySlug) throw new Error("Each review row requires text, source_url and category_slug");
  const ratingRaw = get("rating", "stars", "оценка", "рейтинг");
  const rating = ratingRaw === undefined ? undefined : Number(ratingRaw);
  return {
    text, sourceUrl, categorySlug, rating,
    sourceProductRef: get("source_product_ref", "source_product", "товар_источника") || undefined,
    productId: get("product_id", "товар_7tool") || undefined,
    productType: get("product_type", "тип_товара") || undefined,
  };
}

export function parseReviewImport(text, { format = "auto", categorySlug, sourceUrl } = {}) {
  const trimmed = String(text ?? "").replace(/^\uFEFF/, "").trim();
  const resolved = format === "auto" ? (trimmed.startsWith("[") || trimmed.startsWith("{") ? "json" : "delimited") : format;
  const defaults = { categorySlug, sourceUrl };
  if (resolved === "json") {
    const parsed = JSON.parse(trimmed);
    const rows = Array.isArray(parsed) ? parsed : parsed.rows;
    if (!Array.isArray(rows)) throw new Error("JSON review import must be an array or { rows: [] }");
    return rows.map((record) => normalizeRecord(Object.fromEntries(Object.entries(record).map(([k, v]) => [key(k), v])), defaults));
  }
  const matrix = parseDelimited(trimmed);
  if (matrix.length < 2) return [];
  const headers = matrix[0].map(key);
  return matrix.slice(1).map((cells) => normalizeRecord(Object.fromEntries(headers.map((header, index) => [header, cells[index]])), defaults));
}
