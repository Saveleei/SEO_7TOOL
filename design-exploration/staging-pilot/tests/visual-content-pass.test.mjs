import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DEFAULT_TRUST_CONTENT_SETTINGS } from "../app/data/trustContentModel.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("catalog subcategories use their own feed-grounded imagery without inventing stock claims", async () => {
  const [catalog, css] = await Promise.all([read("../app/catalog/page.tsx"), read("../app/globals.css")]);
  assert.match(catalog, /subcategory\.image &&/u);
  assert.match(catalog, /className="catalog-subcategory-media"/u);
  assert.match(catalog, /src=\{subcategory\.image\}/u);
  assert.doesNotMatch(catalog, /directionMedia|catalog-direction-media|homepageAssetUrl/u);
  assert.match(catalog, /const taskHref = `\/catalog\/task\/\$\{group\.slug\}`/u);
  assert.match(catalog, /className="catalog-direction-overview" href=\{taskHref\}/u);
  assert.match(catalog, /Подобрать по задаче →/u);
  assert.match(catalog, /group\.subcategories\.length <= 3/u);
  assert.doesNotMatch(catalog, /Товар из раздела/u);
  assert.match(css, /\.catalog-subcategory-media img \{[^}]*object-fit:contain/u);
  assert.match(css, /\.catalog-direction--compact>nav \{ grid-template-columns:1fr; \}/u);
  assert.match(css, /\.catalog-direction>nav \{ flex:1; grid-auto-rows:1fr; \}/u);
  assert.match(css, /\.catalog-overview-page \.container \{ max-width:none; \}/u);
  assert.match(css, /@media \(min-width:1800px\)[\s\S]*\.catalog-overview-page \.container \{ width:min\(1840px/u);
  assert.doesNotMatch(catalog, /наш склад|собственный склад|всегда в наличии/iu);
});

test("catalog evidence and product cards explain the verifiable buying process", async () => {
  const [catalog, card] = await Promise.all([read("../app/catalog/page.tsx"), read("../app/ui/FeedProductCard.tsx")]);
  assert.match(catalog, /getTrustContentSettings/u);
  assert.match(catalog, /trustContent\.cards\.map/u);
  assert.match(catalog, /trustCardImageUrl\(card\)/u);
  assert.match(card, /feed-product-assurance/u);
  assert.match(card, /Проверим до оплаты/u);
  assert.match(card, /Точное исполнение · комплектность и документы · остаток и дата отгрузки/u);
});

test("administrator editors control homepage merchandising photos and shared trust blocks", async () => {
  const [homepageEditor, homepageSettings, trustSettings] = await Promise.all([
    read("../app/ui/HomepageContentSettingsForm.tsx"),
    read("../app/test/settings/homepage/page.tsx"),
    read("../app/test/settings/trust/page.tsx"),
  ]);
  assert.match(homepageEditor, /collection="assortmentItems"/u);
  assert.match(homepageEditor, /Фотографии направлений общего каталога/u);
  assert.match(homepageSettings, /Открыть каталог/u);
  assert.match(trustSettings, /Одни настройки используются на главной, в каталоге и на странице компании/u);
  assert.match(trustSettings, /\/catalog#catalog-evidence-title/u);
  assert.match(trustSettings, /\/company#company-operations-title/u);
});

test("homepage trust copy matches the real photos and stays evidence-led", () => {
  assert.equal(DEFAULT_TRUST_CONTENT_SETTINGS.cards.length, 6);
  assert.equal(DEFAULT_TRUST_CONTENT_SETTINGS.cards[3].title, "Сверяем состав заказа");
  assert.equal(DEFAULT_TRUST_CONTENT_SETTINGS.cards[4].title, "Готовим груз к отправке");
  assert.match(DEFAULT_TRUST_CONTENT_SETTINGS.sectionIntro, /коммерческом предложении/u);
  assert.doesNotMatch(JSON.stringify(DEFAULT_TRUST_CONTENT_SETTINGS), /собственный склад|всегда в наличии|официальный дилер/iu);
});

test("real warehouse evidence is shared across homepage, catalog and company page", async () => {
  const [model, homepage, catalog, company, editor] = await Promise.all([
    read("../app/data/trustContentModel.ts"),
    read("../app/page.tsx"),
    read("../app/catalog/page.tsx"),
    read("../app/company/page.tsx"),
    read("../app/ui/TrustContentSettingsForm.tsx"),
  ]);
  for (const image of ["01", "02", "04", "06", "07", "08"]) assert.match(model, new RegExp(`/warehouse/${image}\\.webp`, "u"));
  assert.match(homepage, /<TrustSection content=\{trustContent\}/u);
  assert.match(catalog, /trustContent\.cards\.map/u);
  assert.match(company, /company-operations-section/u);
  assert.match(company, /trustContent\.cards\.map/u);
  assert.match(editor, /на главной, в общем каталоге и на странице компании/u);
});
