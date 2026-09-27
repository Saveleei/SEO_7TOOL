import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DEFAULT_TRUST_CONTENT_SETTINGS } from "../app/data/trustContentModel.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("catalog directions use feed-grounded product imagery without inventing stock claims", async () => {
  const [catalog, css] = await Promise.all([read("../app/catalog/page.tsx"), read("../app/globals.css")]);
  assert.match(catalog, /group\.representativeImage \?\? group\.image/u);
  assert.match(catalog, /directionMedia\.get\(group\.slug\)/u);
  assert.match(catalog, /homepageAssetUrl\(media\.imageAssetId\)/u);
  assert.match(catalog, /className="catalog-direction-media"/u);
  assert.doesNotMatch(catalog, /Товар из раздела/u);
  assert.match(css, /\.catalog-direction-media/u);
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

test("administrator editors control catalog direction photos and shared trust blocks", async () => {
  const [homepageEditor, homepageSettings, trustSettings] = await Promise.all([
    read("../app/ui/HomepageContentSettingsForm.tsx"),
    read("../app/test/settings/homepage/page.tsx"),
    read("../app/test/settings/trust/page.tsx"),
  ]);
  assert.match(homepageEditor, /collection="assortmentItems"/u);
  assert.match(homepageEditor, /Фотографии направлений общего каталога/u);
  assert.match(homepageSettings, /Открыть каталог/u);
  assert.match(trustSettings, /Одни настройки используются на главной и в каталоге/u);
  assert.match(trustSettings, /\/catalog#catalog-evidence-title/u);
});

test("homepage trust copy matches the real photos and stays evidence-led", () => {
  assert.equal(DEFAULT_TRUST_CONTENT_SETTINGS.cards[1].title, "Состав позиции и документы");
  assert.equal(DEFAULT_TRUST_CONTENT_SETTINGS.cards[2].title, "Подтверждённые условия поставки");
  assert.match(DEFAULT_TRUST_CONTENT_SETTINGS.sectionIntro, /коммерческом предложении/u);
  assert.doesNotMatch(JSON.stringify(DEFAULT_TRUST_CONTENT_SETTINGS), /собственный склад|всегда в наличии|официальный дилер/iu);
});
