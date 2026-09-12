import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { normalizeCatalogQuery, rankCatalogItems } from "../app/data/catalogSearchEngine.mjs";

test("catalog search normalizes Russian spelling and technical separators", () => {
  assert.equal(normalizeCatalogQuery("  СВЁРЛО Ø35×30  "), "сверло ø35x30");
  assert.equal(normalizeCatalogQuery("характеристика хвостовика"), "характеристика хвостовика");
});

test("an exact model or SKU outranks a broad category match", () => {
  const items = [
    { title:"Магнитные сверлильные станки", searchText:"станок сверление магнитный" },
    { title:"Магнитный сверлильный станок LENZ STEYR-35", searchText:"LENZ STEYR-35 станок сверление", identifiers:["STEYR-35"], available:true },
  ];
  assert.equal(rankCatalogItems(items, "steyr-35", 5)[0].title, items[1].title);
});

test("production-task phrases match by meaningful word stems", () => {
  const items = [
    { title:"Обработка кромки", searchText:"снять фаску обработать кромку лист труба" },
    { title:"Сверление", searchText:"сверлить отверстие резьба" },
  ];
  assert.equal(rankCatalogItems(items, "снять фаску с трубы", 2)[0].title, "Обработка кромки");
});

test("short and unrelated queries do not invent catalog results", () => {
  const items = [{ title:"Борфрезы", searchText:"обработка металла кромка" }];
  assert.deepEqual(rankCatalogItems(items, "x", 5), []);
  assert.deepEqual(rankCatalogItems(items, "неизвестный лабораторный запрос", 5), []);
});

test("search UI uses one feed-backed endpoint and preserves zero-result intent", async () => {
  const smartSearch = await readFile(new URL("../app/ui/SmartSearch.tsx", import.meta.url), "utf8");
  const apiRoute = await readFile(new URL("../app/api/catalog-search/route.ts", import.meta.url), "utf8");
  const searchPage = await readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8");
  const workbench = await readFile(new URL("../app/ui/ProcurementWorkbench.tsx", import.meta.url), "utf8");
  const homePage = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(smartSearch, /fetch\(`\/api\/catalog-search\?q=/u);
  assert.match(smartSearch, /role="combobox"/u);
  assert.match(smartSearch, /role="listbox"/u);
  assert.match(smartSearch, /ArrowDown/u);
  assert.match(smartSearch, /Точного совпадения в каталоге нет/u);
  assert.match(smartSearch, /\?task=\$\{encodeURIComponent\(normalized\)\}#quick-order/u);
  assert.doesNotMatch(smartSearch, /mailto:/u);
  assert.match(smartSearch, /event, page_type:"search"/u);
  assert.match(smartSearch, /query_length:normalized\.length/u);
  assert.doesNotMatch(smartSearch, /trackSearch\([^\n]+query:/u);
  assert.match(apiRoute, /searchCatalog\(query\)/u);
  assert.match(searchPage, /product\.requestItem \? <AddRequestButton/u);
  assert.match(searchPage, /Выбрать исполнение/u);
  assert.match(homePage, /rawSearchParams\.task/u);
  assert.match(homePage, /<ProcurementWorkbench initialTask=\{initialTask\}/u);
  assert.match(workbench, /initialTask\?\.trim\(\)\.slice\(0, 500\)/u);
});
