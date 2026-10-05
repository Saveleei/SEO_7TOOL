import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/manager-auth/redirect/route.ts";

test("preview login redirect preserves and encodes the complete local request", async () => {
  const previousMode = process.env.QUOTE_TEST_MODE;
  const previousHosts = process.env.MANAGER_AUTH_TEST_HOSTS;
  try {
    process.env.QUOTE_TEST_MODE = "1";
    process.env.MANAGER_AUTH_TEST_HOSTS = "test.7tool.ru";
    const response = await GET(request("/p/sverla-koronchatye-lzhs?variant=A9021&view=table#variants"));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "/test/access?returnTo=%2Fp%2Fsverla-koronchatye-lzhs%3Fvariant%3DA9021%26view%3Dtable%23variants");
    assert.equal(response.headers.get("cache-control"), "no-store");
  } finally {
    restoreEnv("QUOTE_TEST_MODE", previousMode);
    restoreEnv("MANAGER_AUTH_TEST_HOSTS", previousHosts);
  }
});

test("preview login redirect rejects external and recursive destinations", async () => {
  const previousMode = process.env.QUOTE_TEST_MODE;
  const previousHosts = process.env.MANAGER_AUTH_TEST_HOSTS;
  try {
    process.env.QUOTE_TEST_MODE = "1";
    process.env.MANAGER_AUTH_TEST_HOSTS = "test.7tool.ru";
    assert.equal((await GET(request("https://attacker.example/steal"))).headers.get("location"), "/test/access?returnTo=%2F");
    assert.equal((await GET(request("/test/access?returnTo=%2Fcatalog"))).headers.get("location"), "/test/access?returnTo=%2F");
  } finally {
    restoreEnv("QUOTE_TEST_MODE", previousMode);
    restoreEnv("MANAGER_AUTH_TEST_HOSTS", previousHosts);
  }
});

test("preview login redirect is unavailable outside the isolated test host", async () => {
  const previousMode = process.env.QUOTE_TEST_MODE;
  const previousHosts = process.env.MANAGER_AUTH_TEST_HOSTS;
  try {
    process.env.QUOTE_TEST_MODE = "1";
    process.env.MANAGER_AUTH_TEST_HOSTS = "test.7tool.ru";
    assert.equal((await GET(request("/catalog", "7tool.ru"))).status, 404);
    process.env.QUOTE_TEST_MODE = "0";
    assert.equal((await GET(request("/catalog"))).status, 404);
  } finally {
    restoreEnv("QUOTE_TEST_MODE", previousMode);
    restoreEnv("MANAGER_AUTH_TEST_HOSTS", previousHosts);
  }
});

function request(returnTo, host = "test.7tool.ru") {
  return new Request("https://test.7tool.ru/api/manager-auth/redirect", {
    headers:{ host, "x-forwarded-host":host, "x-7tool-return-to":returnTo },
  });
}

function restoreEnv(key, value) {
  if (value === undefined) delete process.env[key]; else process.env[key] = value;
}
