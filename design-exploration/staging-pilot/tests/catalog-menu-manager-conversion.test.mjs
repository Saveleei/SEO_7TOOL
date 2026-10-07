import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildContactClickDetail } from "../app/data/contactAnalytics.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("catalog navigation keeps category discovery visual and adds contextual manager help", async () => {
  const [menu, header, css] = await Promise.all([
    read("../app/ui/HeaderCatalogMenu.tsx"),
    read("../app/ui/PilotHeader.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(menu, /className="header-catalog-explorer"/u);
  assert.match(menu, /className="header-catalog-manager"/u);
  assert.match(menu, /Помощь с подбором/u);
  assert.match(menu, /УПД и закрывающими документами/u);
  assert.match(menu, /mailto:\$\{siteContact\.email\}/u);
  assert.match(menu, /siteContact\.photo/u);
  assert.match(menu, /siteContact\.phoneHref/u);
  assert.match(menu, /header-catalog-mobile-contact/u);
  assert.doesNotMatch(menu, /header-catalog-service-links/u);
  assert.match(header, /<HeaderContactMenu placement="desktop_header"/u);
  assert.match(header, /<HeaderContactMenu compact placement="mobile_manager_bubble"/u);
  assert.match(css, /\.header-catalog-body \{[\s\S]*?grid-template-columns:minmax\(0,1fr\) 286px;/u);
  assert.match(css, /\.header-catalog-section>nav>a \{[\s\S]*?min-height:58px;[\s\S]*?grid-template-columns:56px minmax\(0,1fr\) 14px;/u);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*?\.header-catalog-mobile-contact \{[\s\S]*?grid-template-columns:1fr 1fr;/u);
});

test("manager messenger analytics keep placement context without personal data", () => {
  const detail = buildContactClickDetail({
    href:"https://t.me/saveleei",
    pathname:"/c/stanki-sverlilnye",
    context:{ placement:"desktop_header", category:"stanki-sverlilnye" },
  });

  assert.deepEqual(detail, {
    event:"click_messenger",
    channel:"telegram",
    page_type:"category",
    category:"stanki-sverlilnye",
    placement:"desktop_header",
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
