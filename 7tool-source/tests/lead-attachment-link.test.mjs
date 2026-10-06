import assert from "node:assert/strict";
import test from "node:test";
import { leadAttachmentWorkspaceUrl } from "../src/lib/lead-attachment-link.mjs";

test("attached quote documents link to the protected staff request page", () => {
  const url = leadAttachmentWorkspaceUrl({
    extra:{ newRequestId:"7T-20261006-AF55E6" },
    uploadedFiles:[{ kind:"requisites", path:"/private/file.pdf", originalName:"requisites.pdf", size:120, scanStatus:"quarantined" }],
  });
  assert.equal(url, "https://7tool.ru/test/requests/7T-20261006-AF55E6");
});

test("attachment links fail closed without an exact bridged request identity", () => {
  assert.equal(leadAttachmentWorkspaceUrl({ extra:{ newRequestId:"7T-20261006-AF55E6" }, uploadedFiles:[] }), null);
  assert.equal(leadAttachmentWorkspaceUrl({ extra:{ newRequestId:"../../private" }, uploadedFiles:[{}] }), null);
  assert.equal(leadAttachmentWorkspaceUrl({ extra:{ newRequestId:"7T-20261006-AF55E6" } }), null);
});
