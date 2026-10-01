import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DEFAULT_TRUST_CONTENT_SETTINGS, TRUST_CARD_PRESENTATION } from "../app/data/trustContentModel.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("homepage hero keeps three distinct launch paths readable on mobile", async () => {
  const [page, analytics, css] = await Promise.all([
    read("../app/page.tsx"),
    read("../app/ui/HomepageAnalytics.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(page, /data-home-action="open_catalog"/u);
  assert.match(page, /data-home-action="choose_task"/u);
  assert.match(page, /data-home-action="upload_specification"/u);
  assert.match(page, /\?request=spec#quick-order/u);
  assert.match(page, /Передать файл без письма/u);
  assert.match(analytics, /new Set\(\["open_catalog", "choose_task", "upload_specification"\]\)/u);
  assert.match(analytics, /event:"homepage_action", page_type:"homepage", placement:"hero", action/u);
  assert.doesNotMatch(analytics, /email|phone|query|searchParams|textContent/iu);
  assert.match(css, /@media \(max-width:520px\)[\s\S]*?\.hero-primary-actions \{ grid-template-columns:1fr; \}/u);
  assert.match(css, /\.hero-primary-actions \.button \{ white-space:normal; text-align:center; \}/u);
});

test("homepage category media replaces failed supplier images without layout shift", async () => {
  const [tiles, media, css] = await Promise.all([
    read("../app/ui/HomepageCategoryTiles.tsx"),
    read("../app/ui/HomepageCategoryMedia.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(tiles, /<HomepageCategoryMedia src=\{category\.image\}/u);
  assert.match(media, /useState\(false\)/u);
  assert.match(media, /onError=\{\(\) => setFailed\(true\)\}/u);
  assert.match(media, /homepage-category-tile-placeholder/u);
  assert.match(media, /раздел каталога/u);
  assert.match(css, /\.homepage-category-tile-placeholder \{[\s\S]*?width:100%;[\s\S]*?height:100%;/u);
});

test("homepage production tasks expose direct category paths without cropping equipment imagery", async () => {
  const [paths, css] = await Promise.all([
    read("../app/ui/HomepageTaskPaths.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(paths, /homepage-task-path__subcategories/u);
  assert.match(paths, /group\.subcategories\.slice\(0, 4\)/u);
  assert.match(paths, /category\.href/u);
  assert.match(paths, /homepage-task-path__action/u);
  assert.match(paths, /HomepageCategoryMedia src=\{category\.image\}/u);
  assert.doesNotMatch(paths, /group\.representativeImage|group\.image/u);
  assert.match(css, /\.homepage-task-path__subcategory-media img[^}]*object-fit:contain/u);
  assert.match(css, /\.homepage-task-path__subcategories \{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/u);
  assert.match(css, /\.homepage-task-path\[data-expanded="true"\] \.homepage-task-path__subcategories/u);
});

test("trust section exposes verifiable evidence instead of unsupported claims", async () => {
  const [section, css] = await Promise.all([
    read("../app/ui/TrustSection.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(DEFAULT_TRUST_CONTENT_SETTINGS.sectionTitle, /до оплаты/u);
  assert.match(DEFAULT_TRUST_CONTENT_SETTINGS.sectionIntro, /коммерческом предложении/u);
  assert.doesNotMatch(JSON.stringify(DEFAULT_TRUST_CONTENT_SETTINGS), /официальный дилер|всегда в наличии|лет на рынке/iu);
  for (const presentation of Object.values(TRUST_CARD_PRESENTATION)) {
    assert.equal(presentation.proofs.length, 2);
    assert.match(presentation.href, /^\/(company|warranty|delivery|ordering|catalog)$/u);
  }
  assert.equal(DEFAULT_TRUST_CONTENT_SETTINGS.cards.length, 6);
  assert.match(section, /6 реальных фотосюжетов/u);
  assert.match(section, /assurance-photo-card/u);
  assert.match(section, /assurance-photo-card__media/u);
  assert.match(section, /presentation\.proofs\.map/u);
  for (const href of ["/company", "/warranty", "/delivery", "/ordering"]) assert.match(section, new RegExp(`href="${href}"`, "u"));
  assert.match(css, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/u);
  assert.match(css, /\.assurance-evidence-links/u);
  assert.match(section, /assurance-mobile-toggle/u);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*?\.assurance-grid \{ width:100%; max-width:none; display:grid; grid-template-columns:1fr/u);
});
