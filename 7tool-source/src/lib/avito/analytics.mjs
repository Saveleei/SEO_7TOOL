function number(value) {
  const parsed = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseCsv(source, delimiter = ",") {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map((value) => value.trim());
  return rows.filter((values) => values.some((value) => value.trim())).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

export function normalizeAnalyticsRow(row) {
  return {
    adId: String(row.ad_id ?? row.adId ?? "").trim(),
    sku: String(row.sku ?? "").trim(),
    category: String(row.category ?? "").trim(),
    city: String(row.city ?? "Москва").trim(),
    impressions: number(row.impressions),
    views: number(row.views),
    contacts: number(row.contacts),
    qualifiedLeads: number(row.qualified_leads ?? row.qualifiedLeads),
    proposals: number(row.proposals),
    orders: number(row.orders),
    revenue: number(row.revenue),
    grossProfit: number(row.gross_profit ?? row.grossProfit),
    placementCost: number(row.placement_cost ?? row.placementCost),
    promotionCost: number(row.promotion_cost ?? row.promotionCost),
    lossReason: String(row.loss_reason ?? row.lossReason ?? "").trim(),
  };
}

function ratio(top, bottom) {
  return bottom > 0 ? Number((top / bottom).toFixed(4)) : null;
}

export function calculateListingMetrics(input) {
  const row = normalizeAnalyticsRow(input);
  const totalCost = row.placementCost + row.promotionCost;
  const profitAfterAvito = row.grossProfit - totalCost;
  return {
    ...row,
    viewRate: ratio(row.views, row.impressions),
    contactConversion: ratio(row.contacts, row.views),
    qualifiedRate: ratio(row.qualifiedLeads, row.contacts),
    proposalToOrder: ratio(row.orders, row.proposals),
    costPerContact: ratio(totalCost, row.contacts),
    costPerQualifiedLead: ratio(totalCost, row.qualifiedLeads),
    profitAfterAvito,
    roi: ratio(profitAfterAvito, totalCost),
  };
}

export function buildAnalyticsReport(rows) {
  const items = rows.map(calculateListingMetrics);
  const totals = items.reduce((result, item) => {
    for (const key of ["impressions", "views", "contacts", "qualifiedLeads", "proposals", "orders", "revenue", "grossProfit", "placementCost", "promotionCost"]) {
      result[key] += item[key];
    }
    return result;
  }, { impressions: 0, views: 0, contacts: 0, qualifiedLeads: 0, proposals: 0, orders: 0, revenue: 0, grossProfit: 0, placementCost: 0, promotionCost: 0 });
  return { generatedAt: new Date().toISOString(), totals: calculateListingMetrics(totals), items };
}
