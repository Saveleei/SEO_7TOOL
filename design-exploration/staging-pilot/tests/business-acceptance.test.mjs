import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { BUSINESS_ACCEPTANCE_ACTIONS, isolatedAcceptanceBaseUrl } from "../scripts/run-business-acceptance.mjs";

test("business acceptance is restricted to a dedicated loopback port", () => {
  assert.equal(isolatedAcceptanceBaseUrl("3242").origin, "http://127.0.0.1:3242");
  for (const value of ["3000", "80", "0", "65536", "not-a-port"]) {
    assert.throws(() => isolatedAcceptanceBaseUrl(value), /ACCEPTANCE_PORT/u);
  }
});

test("business acceptance covers the customer, manager, quote, PDF and held-outbox path", () => {
  assert.deepEqual(BUSINESS_ACCEPTANCE_ACTIONS, [
    "product",
    "request",
    "request_duplicate",
    "manager_login",
    "request_assignment",
    "request_status",
    "quote_ready",
    "quote_submitted",
    "quote_approved",
    "quote_pdf",
    "delivery_prepared",
    "outbox_held",
    "manager_pages",
    "attachment",
  ]);
});

test("runner uses temporary storage and contains no live host or delivery transport", async () => {
  const source = await readFile(new URL("../scripts/run-business-acceptance.mjs", import.meta.url), "utf8");
  assert.match(source, /mkdtemp\(path\.join\(os\.tmpdir\(\), "7tool-acceptance-"\)\)/u);
  assert.match(source, /rm\(dataDir, \{ recursive:true, force:true \}\)/u);
  assert.match(source, /deliveryEnabled, false/u);
  assert.match(source, /transport, "disabled-test-contour"/u);
  assert.match(source, /pdfImageCount >= 1/u);
  assert.match(source, /getPageCount\(\) >= 2/u);
  assert.doesNotMatch(source, /https:\/\/test\.7tool\.ru|https:\/\/7tool\.ru|sendMail\(|smtpTransport|api\.telegram|api\.max|crm\./iu);
});
