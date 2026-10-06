import assert from "node:assert/strict";
import test from "node:test";
import {
  leadAttachmentDownloadLinks,
  verifyLeadAttachmentSignature,
} from "../src/lib/lead-attachment-link.mjs";

const secret = "test-only-signing-secret-with-more-than-32-characters";
const nowMs = Date.UTC(2026, 9, 7, 10, 0, 0);
const file = {
  kind: "requisites",
  path: "/private/requisites-123.pdf",
  originalName: "Реквизиты ООО Инструмент.pdf",
  size: 120,
  scanStatus: "quarantined",
};

test("notifications receive one expiring direct-download link per attachment", () => {
  const links = leadAttachmentDownloadLinks({ uploadedFiles: [file] }, 42, {
    secret,
    nowMs,
    siteUrl: "https://7tool.ru",
    ttlSeconds: 3600,
  });
  assert.equal(links.length, 1);
  const url = new URL(links[0].url);
  assert.equal(url.origin, "https://7tool.ru");
  assert.equal(url.pathname, "/api/lead");
  assert.equal(url.searchParams.get("file"), "42.0");
  assert.equal(url.searchParams.get("e"), String(Math.floor(nowMs / 1000) + 3600));
  assert.match(url.searchParams.get("s"), /^[A-Za-z0-9_-]{43}$/u);
  assert.equal(links[0].name, file.originalName);
  assert.equal(links[0].kind, "requisites");
});

test("a valid attachment signature is bound to lead, index, file and expiry", () => {
  const [link] = leadAttachmentDownloadLinks({ uploadedFiles: [file] }, 42, { secret, nowMs, ttlSeconds: 3600 });
  const url = new URL(link.url);
  const input = {
    leadId: 42,
    fileIndex: 0,
    expiresAt: Number(url.searchParams.get("e")),
    signature: url.searchParams.get("s"),
    file,
    secret,
    nowMs: nowMs + 1000,
  };
  assert.equal(verifyLeadAttachmentSignature(input), true);
  assert.equal(verifyLeadAttachmentSignature({ ...input, leadId: 43 }), false);
  assert.equal(verifyLeadAttachmentSignature({ ...input, fileIndex: 1 }), false);
  assert.equal(verifyLeadAttachmentSignature({ ...input, file: { ...file, path: "/private/replaced.pdf" } }), false);
  assert.equal(verifyLeadAttachmentSignature({ ...input, nowMs: nowMs + 3_600_000 }), false);
});

test("attachment links fail closed without a strong dedicated secret", () => {
  assert.deepEqual(leadAttachmentDownloadLinks({ uploadedFiles: [file] }, 42, { secret: "short", nowMs }), []);
  assert.deepEqual(leadAttachmentDownloadLinks({ uploadedFiles: [] }, 42, { secret, nowMs }), []);
  assert.deepEqual(leadAttachmentDownloadLinks({ uploadedFiles: [file] }, 0, { secret, nowMs }), []);
});
