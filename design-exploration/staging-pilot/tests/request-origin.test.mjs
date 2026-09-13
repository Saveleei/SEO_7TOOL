import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { POST as signIn } from "../app/api/manager-auth/session/route.ts";
import { isSameOriginRequest } from "../app/data/requestOrigin.ts";

test("same-origin validation accepts the effective HTTPS proxy origin", () => {
  const request = proxyRequest("https://test.7tool.ru");
  assert.equal(isSameOriginRequest(request, { requireOrigin:true }), true);
  assert.equal(isSameOriginRequest(proxyRequest("https://attacker.example"), { requireOrigin:true }), false);
  assert.equal(isSameOriginRequest(proxyRequest("not-an-origin"), { requireOrigin:true }), false);
  assert.equal(isSameOriginRequest(new Request("http://127.0.0.1:3000/api/test"), { requireOrigin:true }), false);
  assert.equal(isSameOriginRequest(new Request("http://127.0.0.1:3000/api/test")), true);
});

test("manager sign-in works behind the trusted test HTTPS proxy and keeps cross-origin blocked", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-proxy-session-"));
  const previousMode = process.env.QUOTE_TEST_MODE;
  const previousDataDir = process.env.QUOTE_TEST_DATA_DIR;
  const previousHosts = process.env.MANAGER_AUTH_TEST_HOSTS;
  try {
    process.env.QUOTE_TEST_MODE = "1";
    process.env.QUOTE_TEST_DATA_DIR = dataDir;
    process.env.MANAGER_AUTH_TEST_HOSTS = "test.7tool.ru";

    const accepted = await signIn(proxyRequest("https://test.7tool.ru"));
    assert.equal(accepted.status, 200);
    assert.match(accepted.headers.get("set-cookie") ?? "", /7tool_manager_session=/u);
    assert.match(accepted.headers.get("set-cookie") ?? "", /Secure/u);

    const blocked = await signIn(proxyRequest("https://attacker.example"));
    assert.equal(blocked.status, 403);
  } finally {
    restoreEnv("QUOTE_TEST_MODE", previousMode);
    restoreEnv("QUOTE_TEST_DATA_DIR", previousDataDir);
    restoreEnv("MANAGER_AUTH_TEST_HOSTS", previousHosts);
    await rm(dataDir, { recursive:true, force:true });
  }
});

function proxyRequest(origin) {
  return new Request("http://test.7tool.ru/api/manager-auth/session", {
    method:"POST",
    headers:{ host:"test.7tool.ru", origin, "x-forwarded-proto":"https", "x-forwarded-host":"attacker.example" },
  });
}

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
