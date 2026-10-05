import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { siteCompany, siteContact } from "../app/data/contactConfig.ts";

const routes = ["company", "contacts", "ordering", "payment", "delivery", "warranty"];

test("public information routes provide one factual procurement layer", async () => {
  const sources = await Promise.all(routes.map(async (route) => [route, await readFile(new URL(`../app/${route}/page.tsx`, import.meta.url), "utf8")]));
  for (const [route, source] of sources) {
    assert.match(source, new RegExp(`currentPath="/${route}"`, "u"));
    assert.match(source, /PublicInfoPage/u);
    assert.doesNotMatch(source, /собственн(?:ый|ые) склад|сервисн(?:ый|ые) центр|лет на рынке|тысяч наименований|скидк[аи]/iu);
  }
  assert.match(sources.find(([route]) => route === "payment")[1], /getQuoteTemplateSettings/u);
  assert.match(sources.find(([route]) => route === "delivery")[1], /getShippingSettings/u);
  assert.match(sources.find(([route]) => route === "contacts")[1], /Банковские реквизиты передаются в выставленном счёте/u);
  assert.match(sources.find(([route]) => route === "company")[1], /public-hero-catalog/u);
  assert.match(sources.find(([route]) => route === "contacts")[1], /placement="contacts_hero"/u);
  assert.match(sources.find(([route]) => route === "ordering")[1], /public-flow-preview/u);
  assert.match(sources.find(([route]) => route === "payment")[1], /public-document-preview/u);
  assert.match(sources.find(([route]) => route === "delivery")[1], /public-delivery-preview/u);
  assert.match(sources.find(([route]) => route === "warranty")[1], /public-document-stack/u);
});

test("shared public navigation exposes every information route", async () => {
  const [layout, header, footer, smoke] = await Promise.all([
    readFile(new URL("../app/ui/PublicInfoPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/PilotHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/PilotFooter.tsx", import.meta.url), "utf8"),
    readFile(new URL("../scripts/smoke-release-candidate.mjs", import.meta.url), "utf8"),
  ]);
  for (const route of routes) {
    assert.match(layout, new RegExp(`href:"/${route}"`, "u"));
    assert.match(`${header}\n${footer}`, new RegExp(`href="/${route}"`, "u"));
    assert.match(smoke, new RegExp(`"/${route}"`, "u"));
  }
  assert.match(header, /header-info-link/u);
  assert.match(footer, /data-contact-placement="footer"/u);
});

test("public contacts use the canonical company and manager configuration", async () => {
  const [contacts, footer] = await Promise.all([
    readFile(new URL("../app/contacts/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/PilotFooter.tsx", import.meta.url), "utf8"),
  ]);
  assert.equal(siteCompany.legalName, "ООО «7TOOL»");
  assert.equal(siteCompany.address, "Москва, Рябиновая улица, 63, стр. 4");
  assert.equal(siteContact.email, "info@7tool.ru");
  assert.match(contacts, /siteContact\.phoneHref/u);
  assert.match(contacts, /siteContact\.telegramUrl/u);
  assert.match(contacts, /siteContact\.maxUrl/u);
  assert.match(footer, /siteContact\.phoneHref/u);
  assert.match(footer, /siteCompany\.legalName/u);
  assert.doesNotMatch(`${contacts}\n${footer}`, /checkingAccount|correspondentAccount|bankName|bik/u);
});

test("the global footer does not invent one warranty term for every product", async () => {
  const footer = await readFile(new URL("../app/ui/PilotFooter.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(footer, /гарантия\s+12\s+месяцев/iu);
  assert.match(footer, /гарантийные условия по выбранному товару/iu);
});
