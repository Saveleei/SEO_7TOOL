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
  assert.match(page, /Запросить КП по ТЗ или списку позиций/u);
  assert.match(page, /hero-mobile-trust-points/u);
  assert.match(analytics, /new Set\(\["open_catalog", "choose_task", "upload_specification"\]\)/u);
  assert.match(analytics, /event:"homepage_action", page_type:"homepage", placement:"hero", action/u);
  assert.doesNotMatch(analytics, /email|phone|query|searchParams|textContent/iu);
  const firstScreen = css.slice(css.lastIndexOf("/* Mobile homepage first-screen refinement"));
  assert.match(firstScreen, /\.homepage-main \.hero-primary-actions \{ grid-template-columns:minmax\(0,1\.08fr\) minmax\(0,\.92fr\);/u);
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
  assert.match(css, /Grainger visual-entry completion[\s\S]*?max-width:100%;[\s\S]*?overflow-wrap:anywhere;/u);
});

test("homepage production tasks expose large image-led category paths", async () => {
  const [paths, css] = await Promise.all([
    read("../app/ui/HomepageTaskPaths.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(paths, /homepage-task-path__subcategories/u);
  assert.match(paths, /group\.subcategories\.slice\(0, 3\)/u);
  assert.match(paths, /category\.href/u);
  assert.match(paths, /homepage-task-path__action/u);
  assert.doesNotMatch(paths, /homepage-task-path__more/u);
  assert.match(paths, /formatCategoryCount\(group\.subcategories\.length\)/u);
  assert.match(paths, /HomepageCategoryMedia/u);
  assert.match(paths, /homepage-task-path__subcategory-media/u);
  assert.match(paths, /category\.image \?\? group\.image/u);
  assert.doesNotMatch(paths, /group\.representativeImage/u);
  assert.match(css, /\.homepage-task-paths \{ align-items:stretch; \}/u);
  const completion = css.slice(css.lastIndexOf("/* Grainger visual-entry completion"));
  assert.match(completion, /\.production-task-section \.homepage-task-path__header \{[\s\S]*?min-height:78px;/u);
  assert.match(completion, /\.production-task-section \.homepage-task-path__subcategories \{ grid-template-columns:1fr; \}/u);
  assert.match(completion, /\.production-task-section \.homepage-task-path__subcategories>a \{[\s\S]*?min-height:112px;[\s\S]*?grid-template-columns:96px minmax\(0,1fr\) 15px;/u);
  assert.match(completion, /\.production-task-section \.homepage-task-path__subcategory-media \{ width:96px; height:96px; \}/u);
  assert.match(css, /\.homepage-task-path\[data-expanded="true"\] \.homepage-task-path__subcategories/u);
});

test("homepage hero avoids repeating categories already visible in the visual catalog", async () => {
  const page = await read("../app/page.tsx");
  assert.doesNotMatch(page, /className="hero-category-shortcuts"/u);
  assert.match(page, /<HomepageCategoryTiles categories=\{homepageKeyCategories\} compact \/>/u);
});

test("trust section exposes photo-first verifiable evidence instead of unsupported claims", async () => {
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
  assert.match(section, /6 реальных фотографий/u);
  assert.match(section, /assurance-photo-card/u);
  assert.match(section, /assurance-photo-card__media/u);
  assert.doesNotMatch(section, /card\.text|presentation\.proofs|card\.outcome/u);
  assert.match(section, /УПД и закрывающие документы/u);
  assert.match(section, /href="\/company"/u);
  assert.match(css, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/u);
  assert.match(css, /\.assurance-summary \{[\s\S]*?grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\) auto;/u);
  assert.doesNotMatch(section, /assurance-mobile-toggle/u);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*?\.assurance-grid \{[\s\S]*?display:flex;[\s\S]*?overflow-x:auto;/u);
});
