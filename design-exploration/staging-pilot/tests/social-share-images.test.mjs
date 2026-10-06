import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createPublicMetadata, DEFAULT_SOCIAL_IMAGE } from "../app/data/seo.ts";
import {
  resolveSocialCardContent,
  resolveSocialCardRoute,
  SOCIAL_CARD_CONTENT_TYPE,
  SOCIAL_CARD_HEIGHT,
  SOCIAL_CARD_WIDTH,
  socialCardMetadataImage,
} from "../app/data/socialCards.ts";

test("default share image is a versioned 1200x630 first-party asset", () => {
  const metadata = createPublicMetadata({ title:"7TOOL", description:"Промышленное оборудование", path:"/" });
  const [image] = metadata.openGraph.images;
  assert.equal(image.url, "https://7tool.ru/social/7tool-share-warehouse-v1.png");
  assert.equal(image.width, 1200);
  assert.equal(image.height, 630);
  assert.equal(image.type, "image/png");
  assert.equal(metadata.twitter.images[0].url, image.url);
  assert.equal(metadata.twitter.images[0].alt, DEFAULT_SOCIAL_IMAGE.alt);
});

test("page-specific card metadata is absolute, dimensioned, typed, and unambiguous", () => {
  const pageImage = socialCardMetadataImage("category", "Сверлильные станки", "stanki-sverlilnye");
  const metadata = createPublicMetadata({ title:"Сверлильные станки", description:"Подбор", path:"/c/stanki-sverlilnye", image:pageImage });
  assert.match(pageImage.url, /^\/social-card\/v-[a-z0-9]+\/category\/stanki-sverlilnye\.png$/u);
  assert.deepEqual(metadata.openGraph.images[0], {
    ...pageImage,
    url:`https://7tool.ru${pageImage.url}`,
  });
  assert.equal(metadata.openGraph.images.length, 1);
  assert.deepEqual(metadata.twitter.images, [{ url:metadata.openGraph.images[0].url, alt:"Сверлильные станки" }]);
});

test("unrelated catalog pages resolve distinct, relevant photography", () => {
  const examples = [
    ["category", "kromkorezy-po-listu.png"],
    ["subcategory", "kromkorezy-po-listu", "elektricheskie.png"],
    ["product", "faskosnimatel-nko-b-22-zero.png"],
    ["category", "kompressory.png"],
    ["subcategory", "kompressory", "bezmaslyanye.png"],
    ["category", "svarochnye-roboty.png"],
  ];
  const cards = examples.map((segments) => resolveSocialCardContent(segments));
  assert.ok(cards.every(Boolean));
  const drillingImage = resolveSocialCardContent(["category", "stanki-sverlilnye.png"])?.image;
  assert.ok(cards.every((card) => card.image && card.image !== drillingImage));
  assert.equal(new Set([cards[0].image, cards[3].image, cards[5].image]).size, 3);
  assert.match(cards[0].title, /Кромкорезы/u);
  assert.match(cards[1].title, /Электрические кромкорезы/u);
  assert.match(cards[2].title, /NKO B-22 ZERO/u);
  assert.match(cards[3].title, /компрессоры/iu);
  assert.match(cards[4].title, /Безмасляные компрессоры/u);
  assert.match(cards[5].title, /Сварочные роботы/u);
});

test("fingerprinted route validates the content revision and keeps legacy paths available", () => {
  const image = socialCardMetadataImage("product", "Фаскосниматель NKO B-22 ZERO", "faskosnimatel-nko-b-22-zero");
  const segments = image.url.replace(/^\/social-card\//u, "").split("/");
  const current = resolveSocialCardRoute(segments);
  assert.equal(current?.isCurrentVersion, true);
  assert.match(current?.content.title ?? "", /NKO B-22 ZERO/u);

  const stale = resolveSocialCardRoute(["v-deadbeef", "product", "faskosnimatel-nko-b-22-zero.png"]);
  assert.equal(stale?.isCurrentVersion, false);
  assert.notEqual(stale?.revision, "deadbeef");

  const legacy = resolveSocialCardRoute(["product", "faskosnimatel-nko-b-22-zero.png"]);
  assert.equal(legacy?.requestedRevision, undefined);
  assert.equal(legacy?.isCurrentVersion, false);
});

test("category, subcategory, and product cards resolve their own catalog photography", () => {
  const category = resolveSocialCardContent(["category", "stanki-sverlilnye.png"]);
  assert.equal(category?.kind, "category");
  assert.match(category?.title ?? "", /Сверлильные станки/u);
  assert.match(category?.image ?? "", /^https:\/\/s3\.export\.k2tool\.ru\//u);

  const subcategory = resolveSocialCardContent(["subcategory", "stanki-sverlilnye", "magnitnye.png"]);
  assert.equal(subcategory?.kind, "subcategory");
  assert.match(subcategory?.title ?? "", /Магнитные сверлильные станки/u);
  assert.match(subcategory?.image ?? "", /^https:\/\/s3\.export\.k2tool\.ru\//u);

  const product = resolveSocialCardContent(["product", "manipulyator-sverlilno-rezbonareznoy-dtm-10.png"]);
  assert.equal(product?.kind, "product");
  assert.match(product?.title ?? "", /DTM-10/u);
  assert.match(product?.image ?? "", /^https:\/\/s3\.export\.k2tool\.ru\//u);
  assert.match(product?.imageAlt ?? "", /фото товара/u);
});

test("social card contract rejects unsafe or unknown paths", () => {
  assert.equal(resolveSocialCardContent(["product", "..%2Fsecret.png"]), null);
  assert.equal(resolveSocialCardContent(["subcategory", "stanki-sverlilnye.png"]), null);
  assert.equal(resolveSocialCardContent(["unknown", "stanki-sverlilnye.png"]), null);
  assert.equal(resolveSocialCardContent(["category", "ne-sushchestvuet.png"]), null);
});

test("renderer declares the shared social size and long-lived cache policy", async () => {
  assert.equal(SOCIAL_CARD_WIDTH, 1200);
  assert.equal(SOCIAL_CARD_HEIGHT, 630);
  assert.equal(SOCIAL_CARD_CONTENT_TYPE, "image/png");
  const source = await readFile(new URL("../app/social-card/[...segments]/route.tsx", import.meta.url), "utf8");
  assert.match(source, /max-age=31536000, s-maxage=31536000, immutable/u);
  assert.match(source, /max-age=300, s-maxage=3600, stale-while-revalidate=86400/u);
  assert.match(source, /status:307/u);
  assert.match(source, /SEO_SITE_ORIGIN/u);
  assert.doesNotMatch(source, /request\.url/u);
  assert.match(source, /X-Content-Type-Options/u);
  assert.match(source, /s3\.export\.k2tool\.ru/u);
  assert.match(source, /objectFit:"contain"/u);
  assert.match(source, /site\/why-stock\.webp/u);
  assert.match(source, /Inter-Regular\.ttf/u);
  assert.match(source, /Inter-Black\.ttf/u);
  assert.match(source, /fontFamily:"Inter"/u);
  assert.match(source, /const interFonts = Promise\.all\(\[/u);
  assert.match(source, /\r?\n      fonts,\r?\n/u);
  assert.match(source, /brand\/7tool-inverse\.svg/u);
  assert.match(source, /data:image\/svg\+xml;base64/u);
  assert.match(source, /imageDataCache/u);
  assert.match(source, /MAX_CACHED_SOURCE_IMAGES = 32/u);
});

test("root metadata publishes the complete brand icon set", async () => {
  const [layout, manifest] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/site.webmanifest", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /manifest: "\/site\.webmanifest"/u);
  assert.match(layout, /favicon\.ico/u);
  assert.match(layout, /favicon\.svg/u);
  assert.match(layout, /apple-touch-icon\.png/u);
  assert.deepEqual(JSON.parse(manifest).icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
});
