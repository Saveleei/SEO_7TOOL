import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildContactClickDetail } from "../app/data/contactAnalytics.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("catalog navigation keeps products first and adds a factual manager route below them", async () => {
  const [menu, contactMenu, css] = await Promise.all([
    read("../app/ui/HeaderCatalogMenu.tsx"),
    read("../app/ui/HeaderContactMenu.tsx"),
    read("../app/globals.css"),
  ]);

  const categories = menu.indexOf('className="header-catalog-explorer"');
  const manager = menu.indexOf('className="header-catalog-manager"');
  assert.ok(categories >= 0 && manager > categories, "manager help must follow the category navigation");
  assert.match(menu, /data-contact-placement="catalog_menu_manager"/u);
  assert.match(menu, /siteContact\.photo/u);
  assert.match(menu, /siteContact\.phoneHref/u);
  assert.match(menu, /siteContact\.telegramUrl/u);
  assert.match(menu, /siteContact\.maxUrl/u);
  assert.match(menu, /Передать задачу или ТЗ/u);
  assert.match(menu, /Модель знать не обязательно/u);
  assert.doesNotMatch(menu, /header-catalog-mobile-contact/u);
  assert.match(contactMenu, /export function TelegramIcon/u);
  assert.match(contactMenu, /export function MaxIcon/u);
  assert.match(css, /\.header-catalog-manager \{[\s\S]*?grid-template-columns/u);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*?\.header-catalog-manager \{ grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/u);
});

test("manager messenger analytics keep placement context without personal data", () => {
  const detail = buildContactClickDetail({
    href:"https://t.me/saveleei",
    pathname:"/c/stanki-sverlilnye",
    context:{ placement:"catalog_menu_manager", category:"stanki-sverlilnye" },
  });

  assert.deepEqual(detail, {
    event:"click_messenger",
    channel:"telegram",
    page_type:"category",
    category:"stanki-sverlilnye",
    placement:"catalog_menu_manager",
  });
  assert.doesNotMatch(JSON.stringify(detail), /saveleei|962|info@/u);
});

test("footer no longer advertises a static comparison as a user comparison", async () => {
  const footer = await read("../app/ui/PilotFooter.tsx");
  assert.doesNotMatch(footer, /href="\/compare"/u);
  assert.doesNotMatch(footer, />Сравнение</u);
});

test("mobile first screen prioritizes conversion actions and trust photos keep the complete frame", async () => {
  const [page, css] = await Promise.all([read("../app/page.tsx"), read("../app/globals.css")]);
  const actions = page.indexOf('className="hero-primary-actions"');
  const preview = page.indexOf('className="hero-mobile-catalog-preview"');
  assert.ok(actions >= 0 && preview > actions, "primary actions must precede the mobile catalog preview");
  assert.match(css, /\.hero-evidence-link \{ grid-template-columns:132px minmax\(0,1fr\); \}/u);
  assert.match(css, /\.assurance-grid \.assurance-photo-card>\.assurance-photo-card__media>img,[\s\S]*?object-fit:contain!important/u);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*?\.assurance-grid \.assurance-photo-card,[\s\S]*?grid-template-columns:1fr/u);
});
