import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/supplier-images/stalex/route.ts";
import {
  applySupplierImageProxy,
  getStalexImageUpstreamUrl,
  sanitizeStalexImagePath,
  toSupplierImageProxyUrl,
} from "../app/data/supplierImageProxy.mjs";

const sourceImage = "https://stalex.ru/upload/catalog_files/item/photo.jpg";

test("Stalex images are rewritten to a fixed-host proxy without changing other suppliers", () => {
  assert.equal(toSupplierImageProxyUrl(sourceImage), "/api/supplier-images/stalex?path=%2Fupload%2Fcatalog_files%2Fitem%2Fphoto.jpg");
  assert.equal(toSupplierImageProxyUrl("https://s3.export.k2tool.ru/item.jpg"), "https://s3.export.k2tool.ru/item.jpg");
  assert.equal(getStalexImageUpstreamUrl("/upload/catalog_files/item/photo.jpg"), sourceImage);
  assert.equal(sanitizeStalexImagePath("/upload/../secret.jpg"), null);
  assert.equal(sanitizeStalexImagePath("https://attacker.example/photo.jpg"), null);
  assert.equal(sanitizeStalexImagePath("/upload/catalog_files/item/file.svg"), null);

  const snapshot = applySupplierImageProxy({ categories:[], products:[
    { sourceSupplier:"stalex", images:[sourceImage], variants:[{ images:[sourceImage] }] },
    { sourceSupplier:"other", images:[sourceImage], variants:[] },
  ] });
  assert.match(snapshot.products[0].images[0], /^\/api\/supplier-images\/stalex\?/u);
  assert.match(snapshot.products[0].variants[0].images[0], /^\/api\/supplier-images\/stalex\?/u);
  assert.equal(snapshot.products[1].images[0], sourceImage);
});

test("Stalex image route validates path, media type and cache headers", async () => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
        status:200,
        headers:{ "content-type":"image/jpeg", "content-length":"4" },
      });
    };
    const valid = await GET(new Request("http://local.test/api/supplier-images/stalex?path=%2Fupload%2Fcatalog_files%2Fitem%2Fphoto.jpg"));
    assert.equal(valid.status, 200);
    assert.equal(valid.headers.get("content-type"), "image/jpeg");
    assert.match(valid.headers.get("cache-control"), /max-age=86400/u);
    assert.equal(valid.headers.get("x-content-type-options"), "nosniff");
    assert.deepEqual(calls, [sourceImage]);

    const external = await GET(new Request("http://local.test/api/supplier-images/stalex?path=https%3A%2F%2Fattacker.example%2Fphoto.jpg"));
    assert.equal(external.status, 400);
    assert.equal(calls.length, 1);

    globalThis.fetch = async () => new Response("html", { status:200, headers:{ "content-type":"text/html" } });
    const wrongType = await GET(new Request("http://local.test/api/supplier-images/stalex?path=%2Fupload%2Fcatalog_files%2Fitem%2Fphoto.jpg"));
    assert.equal(wrongType.status, 502);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
