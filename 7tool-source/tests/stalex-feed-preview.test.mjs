import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStalexPreview,
  findSupplierContactLeaks,
  parseCommerceGroups,
  sanitizeStalexDescription,
} from "../scripts/lib/stalex-feed-preview.mjs";

const policy = {
  publicationEnabled: false,
  commercialGate: {
    warrantyOverrideMonths: 12,
    warrantyOverrideSource: "owner-confirmed-test",
    requiredConfirmations: ["vat", "content-rights", "dispatch-sla"],
  },
  topGroups: {
    "Сверлильные станки по металлу": {
      decision: "existing-category",
      targetSlug: "stanki-sverlilnye",
      rollout: "P0",
    },
    РАСПРОДАЖА: { decision: "attribute-only", rollout: "metadata" },
  },
};

const catalogXml = `<?xml version="1.0" encoding="utf-8"?>
<КоммерческаяИнформация>
  <Классификатор>
    <Свойства>
      <Свойство><Ид>449</Ид><Наименование>Гарантия</Наименование><ВариантыЗначений>
        <Вариант><Ид>w12</Ид><Значение>12 месяцев</Значение></Вариант>
      </ВариантыЗначений></Свойство>
    </Свойства>
    <Группы>
      <Группа><Ид>1</Ид><Наименование>Сверлильные станки по металлу</Наименование><Группы>
        <Группа><Ид>101</Ид><Наименование>Радиально-сверлильные станки</Наименование></Группа>
      </Группы></Группа>
      <Группа><Ид>2</Ид><Наименование>РАСПРОДАЖА</Наименование></Группа>
    </Группы>
  </Классификатор>
  <ПакетПредложений><Предложения><Предложение>
    <Ид>product-1</Ид><Наименование>Радиально-сверлильный станок STALEX</Наименование>
    <Группы><Ид>101</Ид><Ид>2</Ид></Группы><Картинка>catalog_files/product-1.jpg</Картинка>
    <ЗначенияСвойств>
      <ЗначенияСвойства><Ид>CML2_ACTIVE</Ид><Значение>true</Значение></ЗначенияСвойства>
      <ЗначенияСвойства><Ид>CML2_DETAIL_TEXT</Ид><Значение>&lt;p&gt;Станок для обработки отверстий в крупных деталях.&lt;/p&gt;</Значение></ЗначенияСвойства>
      <ЗначенияСвойства><Ид>449</Ид><Значение>w12</Значение></ЗначенияСвойства>
    </ЗначенияСвойств>
  </Предложение></Предложения></ПакетПредложений>
</КоммерческаяИнформация>`;

const modificationsXml = `<?xml version="1.0" encoding="utf-8"?>
<КоммерческаяИнформация><Классификатор><Свойства>
  <Свойство><Ид>184</Ид><Наименование>Цена в Рублях</Наименование></Свойство>
</Свойства></Классификатор><ПакетПредложений><Предложения><Предложение>
  <Ид>variant-1</Ид><Наименование>STALEX RD</Наименование><Группы></Группы><Картинка></Картинка>
  <ЗначенияСвойств>
    <ЗначенияСвойства><Ид>CML2_ACTIVE</Ид><Значение>true</Значение></ЗначенияСвойства>
    <ЗначенияСвойства><Ид>CML2_LINK</Ид><Значение>product-1</Значение></ЗначенияСвойства>
    <ЗначенияСвойства><Ид>22</Ид><Значение>SKU-1</Значение></ЗначенияСвойства>
    <ЗначенияСвойства><Ид>13</Ид><Значение>f098c6a4e2a55abe1d1e19e26c21de84</Значение></ЗначенияСвойства>
    <ЗначенияСвойства><Ид>171</Ид><Значение>2</Значение></ЗначенияСвойства>
    <ЗначенияСвойства><Ид>184</Ид><Значение>294500</Значение></ЗначенияСвойства>
    <ЗначенияСвойства><Ид>200</Ид><Значение>310000</Значение></ЗначенияСвойства>
  </ЗначенияСвойств>
  <Цены><Цена><ЦенаЗаЕдиницу>2804.76</ЦенаЗаЕдиницу><Валюта>CUN</Валюта></Цена></Цены>
  <Количество>2</Количество>
</Предложение></Предложения></ПакетПредложений></КоммерческаяИнформация>`;

test("Stalex groups preserve the current task/category hierarchy", () => {
  const groups = parseCommerceGroups(catalogXml);
  assert.deepEqual(groups.map(({ id, name, parentId }) => ({ id, name, parentId })), [
    { id: "101", name: "Радиально-сверлильные станки", parentId: "1" },
    { id: "1", name: "Сверлильные станки по металлу", parentId: null },
    { id: "2", name: "РАСПРОДАЖА", parentId: null },
  ]);
});

test("preview uses the explicit ruble price and never promises same-day dispatch", () => {
  const report = buildStalexPreview({ catalogXml, modificationsXml, policy });
  assert.equal(report.mode, "preview-only");
  assert.equal(report.publicationEnabled, false);
  assert.equal(report.summary.storefrontPublishable, 0);
  assert.equal(report.summary.dataPilotReady, 1);
  const record = report.samples.ready[0];
  assert.equal(record.priceRub, 294500);
  assert.equal(record.oldPriceRub, 310000);
  assert.equal(record.category.chosen.targetSlug, "stanki-sverlilnye");
  assert.equal(record.availability.code, "supplier-stock-confirm");
  assert.equal(record.availability.canPromiseToday, false);
  assert.match(record.availability.label, /дату отгрузки подтвердим/u);
  assert.ok(record.issues.some((current) => current.code === "NON_RUB_BASE_PRICE"));
  assert.equal(record.warranty, "12 месяцев");
  assert.equal(report.commercialGate.warrantyConflict, false);
  assert.deepEqual(report.commercialGate.effectiveWarrantyValues, { "12 месяцев": 1 });
});

test("owner-confirmed 12 month warranty overrides missing or conflicting supplier values", () => {
  const withoutWarranty = catalogXml
    .replace("<ЗначенияСвойства><Ид>449</Ид><Значение>w12</Значение></ЗначенияСвойства>", "")
    .replace("<Вариант><Ид>w12</Ид><Значение>12 месяцев</Значение></Вариант>", "");
  const report = buildStalexPreview({ catalogXml: withoutWarranty, modificationsXml, policy });
  const record = report.samples.ready[0];
  assert.equal(record.warranty, "12 месяцев");
  assert.equal(record.sourceWarranty, null);
  assert.equal(record.warrantyOverrideApplied, true);
  assert.ok(record.issues.some((current) => current.code === "SOURCE_WARRANTY_OVERRIDDEN"));
  assert.ok(!record.issues.some((current) => current.code === "WARRANTY_UNRESOLVED"));
});

test("supplier contacts and self-promotional copy are removed before any future use", () => {
  const raw = "ООО «СТМ» предлагает купить оборудование. Уточнить информацию можно по телефону +7 (800) 700-02-91. Техническая часть станка выполнена из стали. serv@stm-ru.ru https://stalex.ru/catalog/test";
  assert.ok(findSupplierContactLeaks(raw).length >= 3);
  const sanitized = sanitizeStalexDescription(raw);
  assert.doesNotMatch(sanitized, /СТМ|предлагает купить|800|@|stalex\.ru/iu);
  assert.match(sanitized, /Техническая часть станка выполнена из стали/u);
});

test("text availability without positive numeric stock remains a lead-time request", () => {
  const noQuantity = modificationsXml.replace("<Количество>2</Количество>", "<Количество>0</Количество>");
  const report = buildStalexPreview({ catalogXml, modificationsXml: noQuantity, policy });
  const record = report.samples.blocked[0] || report.samples.ready[0];
  assert.equal(record.availability.code, "lead-time-request");
  assert.equal(record.availability.canPromiseToday, false);
  assert.ok(record.issues.some((current) => current.code === "STOCK_SIGNAL_CONFLICT"));
});

test("publication cannot be enabled through a preview policy", () => {
  assert.throws(
    () => buildStalexPreview({ catalogXml, modificationsXml, policy: { ...policy, publicationEnabled: true } }),
    /explicitly disable publication/u,
  );
});
