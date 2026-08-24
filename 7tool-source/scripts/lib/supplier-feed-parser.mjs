export function decodeSupplierXml(value = "") {
  let out = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  for (let i = 0; i < 2; i++) {
    out = out
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  }
  return out.trim();
}

function attributes(value) {
  const result = {};
  for (const match of value.matchAll(/([\w:-]+)="([^"]*)"/g)) result[match[1]] = decodeSupplierXml(match[2]);
  return result;
}

function tag(body, name) {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i").exec(body);
  return match ? decodeSupplierXml(match[1]) : undefined;
}

function integer(value) {
  if (!value) return undefined;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

export function cleanSupplierParamName(name) {
  const original = (name ?? "").trim();
  const cleaned = original.replace(/^(?:k2[\s_.:/-]*)+/i, "").trim();
  return cleaned || original;
}

export function parseSupplierFeed(xml) {
  const offers = [];
  for (const match of xml.matchAll(/<offer\s+([^>]*?)>([\s\S]*?)<\/offer>/g)) {
    const attr = attributes(match[1]);
    const body = match[2];
    if (!attr.id) continue;
    const params = [];
    for (const paramMatch of body.matchAll(/<param\s+([^>]*?)>([\s\S]*?)<\/param>/g)) {
      const paramAttr = attributes(paramMatch[1]);
      const value = decodeSupplierXml(paramMatch[2]);
      if (!paramAttr.name || !value) continue;
      params.push({ name: cleanSupplierParamName(paramAttr.name), value, ...(paramAttr.unit ? { unit: paramAttr.unit } : {}) });
    }
    const pictures = [];
    for (const pictureMatch of body.matchAll(/<picture(?:\s[^>]*)?>([\s\S]*?)<\/picture>/g)) {
      const src = decodeSupplierXml(pictureMatch[1]);
      if (/^https?:\/\//i.test(src) && !pictures.includes(src)) pictures.push(src);
      if (pictures.length >= 6) break;
    }
    const accessories = Array.from(body.matchAll(/<accessory(?:\s[^>]*)?>([\s\S]*?)<\/accessory>/g))
      .map((item) => decodeSupplierXml(item[1])).filter(Boolean);
    offers.push({
      id: attr.id, group: attr.group === "true", groupId: tag(body, "groupId"),
      status: tag(body, "status"), name: tag(body, "name") ?? "",
      categoryId: tag(body, "categoryId"), sku: tag(body, "vendorCode") ?? "",
      vendor: tag(body, "vendor"), description: tag(body, "description"),
      barcode: tag(body, "barcode"), price: integer(tag(body, "price")),
      oldPrice: integer(tag(body, "oldprice")), quantity: integer(tag(body, "quantity")),
      available: attr.available !== "false", params, pictures, accessories,
    });
  }
  return offers;
}
