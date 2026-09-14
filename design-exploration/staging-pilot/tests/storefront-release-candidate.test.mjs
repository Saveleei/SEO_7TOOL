import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertLoopbackBaseUrl, PROTECTED_RELEASE_ROUTES, PUBLIC_RELEASE_ROUTES } from "../scripts/smoke-release-candidate.mjs";

test("release smoke accepts only a bare loopback origin", () => {
  assert.equal(assertLoopbackBaseUrl("http://127.0.0.1:3180").origin, "http://127.0.0.1:3180");
  assert.equal(assertLoopbackBaseUrl("http://localhost:3180").hostname, "localhost");
  assert.equal(assertLoopbackBaseUrl("http://[::1]:3180").port, "3180");
  assert.throws(() => assertLoopbackBaseUrl("https://7tool.ru"), /loopback/u);
  assert.throws(() => assertLoopbackBaseUrl("http://192.168.1.50:3180"), /loopback/u);
  assert.throws(() => assertLoopbackBaseUrl("http://127.0.0.1:3180/test/requests"), /only a loopback origin/u);
  assert.throws(() => assertLoopbackBaseUrl("http://admin:secret@127.0.0.1:3180"), /only a loopback origin/u);
});

test("release matrix covers the accepted customer path and every staff workspace", () => {
  assert.ok(PUBLIC_RELEASE_ROUTES.length >= 37);
  assert.equal(new Set(PUBLIC_RELEASE_ROUTES).size, PUBLIC_RELEASE_ROUTES.length);
  for (const route of ["/", "/catalog", "/catalog/task/drilling", "/catalog/category/borfrezy", "/catalog/category/stanki-sverlilnye", "/product/magnitnyy-sverlilnyy-stanok-lenz-steyr-35", "/search?q=STEYR-35", "/compare"]) {
    assert.ok(PUBLIC_RELEASE_ROUTES.includes(route), `${route} is absent from the release matrix`);
  }
  assert.deepEqual(PROTECTED_RELEASE_ROUTES, ["/test/requests", "/test/catalog-quality", "/test/delivery", "/test/settings/shipping", "/test/settings/quote", "/test/settings/homepage", "/test/settings/trust"]);
});

test("smoke performs no customer, quote or delivery write action", async () => {
  const script = await readFile(new URL("../scripts/smoke-release-candidate.mjs", import.meta.url), "utf8");
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(packageJson.scripts["smoke:release"], "node scripts/smoke-release-candidate.mjs");
  assert.match(script, /\/api\/manager-auth\/session/u);
  assert.doesNotMatch(script, /\/api\/quote-requests|\/quote-approval|\/quote-draft/u);
  assert.equal((script.match(/method:\s*"POST"/gu) || []).length, 1);
  assert.doesNotMatch(script, /sendMail|smtp|telegram\.org|api\.max|crm\./iu);
});
