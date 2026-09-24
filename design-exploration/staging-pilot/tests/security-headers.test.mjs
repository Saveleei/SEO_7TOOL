import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { applySecurityResponseHeaders, SECURITY_RESPONSE_HEADERS } from "../app/data/securityHeaders.mjs";
import { config, proxy } from "../proxy.ts";

test("one response policy matches the hardened production baseline", () => {
  assert.deepEqual(SECURITY_RESPONSE_HEADERS, {
    "Permissions-Policy":"camera=(), microphone=(), geolocation=()",
    "Referrer-Policy":"strict-origin-when-cross-origin",
    "X-Content-Type-Options":"nosniff",
    "X-Frame-Options":"SAMEORIGIN",
  });

  const headers = applySecurityResponseHeaders(new Headers({ "X-Content-Type-Options":"unsafe" }));
  for (const [name, value] of Object.entries(SECURITY_RESPONSE_HEADERS)) {
    assert.equal(headers.get(name), value);
  }
});

test("Next 16 proxy applies security headers to pages and APIs", () => {
  const response = proxy();
  for (const [name, value] of Object.entries(SECURITY_RESPONSE_HEADERS)) {
    assert.equal(response.headers.get(name), value);
  }
  assert.deepEqual(config.matcher, ["/((?!_next/static|_next/image|favicon.ico).*)"]);
});

test("download routes keep their stricter content policies behind the shared proxy", async () => {
  const sources = await Promise.all([
    readFile(new URL("../app/api/quote-requests/[id]/attachment/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/quote-requests/[id]/quote-pdf/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/catalog-media/assets/[assetId]/route.ts", import.meta.url), "utf8"),
  ]);
  assert.ok(sources.every((source) => /X-Content-Type-Options/u.test(source)));
  assert.match(sources[2], /Content-Security-Policy/u);
});
