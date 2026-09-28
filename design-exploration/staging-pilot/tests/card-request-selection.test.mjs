import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getFeedProductVariantById, toFeedProductCardModel } from "../app/data/feedCatalog.ts";

test("feed card model preserves exact variant image and canonical href", () => {
  const result = getFeedProductVariantById("A12935");
  assert.ok(result, "expected the LZTS-021 feed variant");
  const card = toFeedProductCardModel(result.product);
  const variant = card.variants.find((item) => item.id === result.variant.id);
  assert.ok(variant?.image?.startsWith("https://s3.export.k2tool.ru/"));
  assert.equal(variant?.href, `/product/${result.product.slug}?variant=A12935#variants`);
});

test("card view requires an exact variant before adding to the quote request", async () => {
  const source = await readFile(new URL("../app/ui/FeedProductCard.tsx", import.meta.url), "utf8");
  assert.match(source, /product\.selectedVariantCount === 1 \? product\.variants\[0\]/u);
  assert.match(source, /archetype\.multipleAction/u);
  assert.match(source, /id:`variant:\$\{variant\.id\}`/u);
  assert.match(source, /id:`variant:\$\{directVariant\.id\}`/u);
  assert.match(source, /image:variant\.image, href:variant\.href/u);
  assert.match(source, /image:directVariant\.image, href:directVariant\.href/u);
  assert.doesNotMatch(source, /AddRequestButton item=\{\{ id:product\.id/u);
});

test("table view carries exact variant media and links into the quote request", async () => {
  const source = await readFile(new URL("../app/ui/FeedProductTable.tsx", import.meta.url), "utf8");
  assert.ok((source.match(/image:variant\.image, href:variant\.href/gu)?.length ?? 0) >= 2);
  assert.ok((source.match(/image:directVariant\.image, href:directVariant\.href/gu)?.length ?? 0) >= 2);
  assert.match(source, /<QuickOrderDialog[\s\S]*id:`variant:\$\{directVariant\.id\}`/u);
  assert.match(source, /<QuickOrderDialog[\s\S]*id:`variant:\$\{variant\.id\}`/u);
});
