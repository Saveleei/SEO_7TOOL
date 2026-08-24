import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashId } from "@/lib/live-hash";

// Live-данные цен/наличия для витрины: читаются из data.db на каждый запрос
// (WAL → сразу видны коммиты крона refresh-feed.mts), поэтому свежие цены
// появляются без пересборки сайта.
//
// Приватность (ответ ходит по незашифрованному HTTP): id товаров/вариантов
// заменены на хеш (см. live-hash.ts) — и в запросе (?p=/?v=), и в ключах ответа.
// Наличие отдаём булевым (inStock), точные остатки наружу не уходят.
export const dynamic = "force-dynamic";

type LiveVariant = { price?: number; oldPrice?: number; available: boolean; inStock: boolean };
type LiveProduct = { inStock: boolean; priceFrom?: number; priceTo?: number; discountPct?: number };

type PRow = { id: string; stock: number; price_from: number | null; price_to: number | null; discount_pct: number | null };
type VRow = { id: string; price: number | null; old_price: number | null; quantity: number | null; available: number };

const vOut = (r: VRow): LiveVariant => ({
  price: r.price ?? undefined,
  oldPrice: r.old_price ?? undefined,
  available: !!r.available,
  inStock: (r.quantity ?? 0) > 0,
});

// Обратные карты hash → реальный id (id стабильны, меняются только при импорте новых товаров).
let pidByHash: Map<string, string> | null = null;
let vidByHash: Map<string, string> | null = null;

function buildMaps(d: ReturnType<typeof db>) {
  pidByHash = new Map();
  vidByHash = new Map();
  for (const r of d.prepare<unknown[], { id: string }>("SELECT id FROM products").all()) pidByHash.set(hashId(r.id), r.id);
  for (const r of d.prepare<unknown[], { id: string }>("SELECT id FROM variants").all()) vidByHash.set(hashId(r.id), r.id);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const pHashes = (sp.get("p") || "").split(",").filter(Boolean);
  const vHashes = (sp.get("v") || "").split(",").filter(Boolean);
  const d = db();

  if (!pidByHash || !vidByHash) buildMaps(d);
  // если какой-то хеш не нашёлся — возможно, появились новые товары: перестроить и повторить
  if (pHashes.some((h) => !pidByHash!.has(h)) || vHashes.some((h) => !vidByHash!.has(h))) buildMaps(d);

  const pids = pHashes.map((h) => pidByHash!.get(h)).filter((x): x is string => !!x);
  const vids = vHashes.map((h) => vidByHash!.get(h)).filter((x): x is string => !!x);

  const products: Record<string, LiveProduct> = {};
  const variants: Record<string, LiveVariant> = {};

  if (pids.length) {
    const ph = pids.map(() => "?").join(",");
    for (const r of d.prepare<unknown[], PRow>(
      `SELECT id, stock, price_from, price_to, discount_pct FROM products WHERE id IN (${ph})`,
    ).all(...pids)) {
      products[hashId(r.id)] = {
        inStock: r.stock > 0,
        priceFrom: r.price_from ?? undefined,
        priceTo: r.price_to ?? undefined,
        discountPct: r.discount_pct ?? undefined,
      };
    }
    for (const r of d.prepare<unknown[], VRow>(
      `SELECT id, price, old_price, quantity, available FROM variants WHERE product_id IN (${ph})`,
    ).all(...pids)) {
      variants[hashId(r.id)] = vOut(r);
    }
  }

  if (vids.length) {
    const ph = vids.map(() => "?").join(",");
    for (const r of d.prepare<unknown[], VRow>(
      `SELECT id, price, old_price, quantity, available FROM variants WHERE id IN (${ph})`,
    ).all(...vids)) {
      variants[hashId(r.id)] = vOut(r);
    }
  }

  return NextResponse.json({ products, variants }, { headers: { "cache-control": "no-store" } });
}
