import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("stable admin entry points lead to the protected owner workspace", async () => {
  const [adminEntry, trustEntry] = await Promise.all([
    read("../app/admin/page.tsx"),
    read("../app/admin/trust/page.tsx"),
  ]);
  assert.match(adminEntry, /redirect\("\/test\/settings\/homepage"\)/u);
  assert.match(trustEntry, /redirect\("\/test\/settings\/trust"\)/u);
  assert.match(`${adminEntry}\n${trustEntry}`, /robots:\{ index:false, follow:false, nocache:true \}/u);
});

test("trust photo editor explains the complete publish flow", async () => {
  const form = await read("../app/ui/TrustContentSettingsForm.tsx");
  assert.match(form, /лучше 1600×900/u);
  assert.match(form, /Фото показывается целиком, без обрезки/u);
  assert.match(form, /Опубликовать изменения на сайте/u);
  assert.match(form, /Изменения опубликованы на сайте/u);
  assert.doesNotMatch(form, /локальном прототипе/u);
});

test("typography uses a modern Cyrillic system stack and readable admin sizes", async () => {
  const styles = await read("../app/globals.css");
  const pass = styles.slice(styles.lastIndexOf("/* Typography design pass"));
  assert.match(pass, /--font-interface:"Segoe UI Variable Text","Segoe UI",Roboto/u);
  assert.match(pass, /body \{[\s\S]*font-family:var\(--font-interface\)/u);
  assert.match(pass, /\.manager-access-permissions span \{ font-size:var\(--type-secondary\)/u);
  assert.match(pass, /\.trust-photo-upload \{ min-height:var\(--control-min-height\); font-size:var\(--type-control\)/u);
  assert.match(pass, /@media \(min-width:1680px\)[\s\S]*\.homepage-task-path__copy h3 \{ font-size:22px/u);
});
