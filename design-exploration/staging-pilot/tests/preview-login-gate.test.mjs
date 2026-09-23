import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("test-domain gateway uses the signed application session instead of browser Basic Auth", async () => {
  const config = await readFile(new URL("../deploy/test.7tool.ru.nginx.conf.example", import.meta.url), "utf8");
  assert.match(config, /auth_request \/__7tool_preview_auth;/u);
  assert.match(config, /proxy_pass http:\/\/127\.0\.0\.1:3000\/api\/manager-auth\/check;/u);
  assert.match(config, /location = \/__7tool_preview_login/u);
  assert.match(config, /proxy_pass http:\/\/127\.0\.0\.1:3000\/api\/manager-auth\/redirect;/u);
  assert.match(config, /proxy_set_header X-7Tool-Return-To \$request_uri;/u);
  assert.match(config, /location = \/test\/access/u);
  assert.match(config, /location = \/api\/manager-auth\/session/u);
  assert.match(config, /limit_except POST DELETE/u);
  assert.match(config, /error_page 401 = \/__7tool_preview_login;/u);
  assert.doesNotMatch(config, /return 302 \/test\/access\?returnTo=\$(?:request_)?uri;/u);
  assert.doesNotMatch(config, /auth_basic/u);
});

test("test process accepts login secrets only from its runtime environment", async () => {
  const ecosystem = await readFile(new URL("../ecosystem.test.config.cjs", import.meta.url), "utf8");
  assert.match(ecosystem, /MANAGER_AUTH_LOCAL_USERNAME: process\.env\.MANAGER_AUTH_LOCAL_USERNAME/u);
  assert.match(ecosystem, /MANAGER_AUTH_LOCAL_PASSWORD_HASH: process\.env\.MANAGER_AUTH_LOCAL_PASSWORD_HASH/u);
  assert.doesNotMatch(ecosystem, /MANAGER_AUTH_LOCAL_PASSWORD_HASH:\s*["'][^"']{20,}["']/u);
});
