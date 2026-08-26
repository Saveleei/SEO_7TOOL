import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { validateEditorialDraft } from "../src/lib/editorial-draft.mjs";

const draftPath = path.resolve(import.meta.dirname, "../editorial-drafts/kak-vybrat-koronchatoe-sverlo/draft.json");
const editorialRoot = path.dirname(draftPath);
const manifestPath = path.join(editorialRoot, "media-manifest.json");
const approvalPath = path.join(editorialRoot, "approval.json");

function sha256(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

test("first Wordstat editorial draft is structured, sourced and publication-blocked", () => {
  const draft = JSON.parse(fs.readFileSync(draftPath, "utf8"));
  const report = validateEditorialDraft(draft);
  assert.equal(report.ok, true);
  assert.equal(report.status, "AWAITING_HUMAN_BRIEF_REVIEW");
  assert.equal(report.canonical, "/articles/kak-vybrat-koronchatoe-sverlo");
  assert.equal(report.categorySlug, "koronchatye-sverla");
  assert.equal(report.editorialIdentity.author, "Редакция 7TOOL");
  assert.equal(report.editorialIdentity.expertReviewer, "Евгений Савельев");
  assert.equal(report.editorialIdentity.expertReviewStatus, "PENDING_CONTENT_APPROVAL");
  assert.ok(report.sourceCount >= 4);
  assert.ok(report.sectionCount >= 7);
  assert.ok(report.faqCount >= 4);
  assert.ok(report.wordCount >= 900);
  assert.equal(report.warnings.length, 0);
});

test("publication approval is human, checksum-bound and includes reviewed article media", () => {
  const draft = JSON.parse(fs.readFileSync(draftPath, "utf8"));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const approval = JSON.parse(fs.readFileSync(approvalPath, "utf8"));
  assert.equal(approval.schemaVersion, "EDITORIAL_APPROVAL_V1");
  assert.equal(approval.status, "APPROVED_FOR_PUBLICATION");
  assert.equal(approval.indexStatus, "INDEX");
  assert.equal(approval.actorType, "HUMAN");
  assert.equal(approval.approvedBy, draft.editorialIdentity.expertReviewer);
  assert.equal(approval.draftSha256, sha256(draftPath));
  assert.equal(approval.mediaManifestSha256, sha256(manifestPath));
  assert.ok(manifest.images.filter((image) => image.sourceType === "FIRST_PARTY_7TOOL").length >= 5);
  assert.ok(manifest.images.filter((image) => image.sourceType === "SUPPLIER_FEED").length >= 3);
  assert.ok(draft.brief.internalLinks.includes("/c/koronchatye-sverla"));
  assert.ok(draft.brief.internalLinks.includes("/c/stanki-sverlilnye/magnitnye"));
  assert.doesNotMatch(JSON.stringify({ draft, manifest }), /Фото: 7TOOL/u);
  for (const image of manifest.images) {
    const localFile = path.resolve(import.meta.dirname, `../public${image.file}`);
    assert.ok(fs.existsSync(localFile), `Missing approved article image: ${image.file}`);
  }
});
