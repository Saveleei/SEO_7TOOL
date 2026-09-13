import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("card view requires an exact variant before adding to the quote request", async () => {
  const source = await readFile(new URL("../app/ui/FeedProductCard.tsx", import.meta.url), "utf8");
  assert.match(source, /product\.selectedVariantCount === 1 \? product\.variants\[0\]/u);
  assert.match(source, /archetype\.multipleAction/u);
  assert.match(source, /id:`variant:\$\{variant\.id\}`/u);
  assert.match(source, /id:`variant:\$\{directVariant\.id\}`/u);
  assert.doesNotMatch(source, /AddRequestButton item=\{\{ id:product\.id/u);
});
