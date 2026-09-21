import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("homepage selection journey is explicit, phone-first and backed by the request API", async () => {
  const workbench = await readFile(new URL("../app/ui/ProcurementWorkbench.tsx", import.meta.url), "utf8");
  assert.match(workbench, /Заявка ещё не отправлена/u);
  assert.match(workbench, /Передать задачу инженеру/u);
  assert.match(workbench, /name="phone"[^>]+required/u);
  assert.match(workbench, /name="consent"[^>]+defaultChecked[^>]+required/u);
  assert.match(workbench, /role="tab" aria-selected=/u);
  assert.match(workbench, /phoneInputRef\.current\?\.focus\(\)/u);
  assert.match(workbench, /formData\.set\("request_type", "selection"\)/u);
  assert.match(workbench, /fetch\("\/api\/quote-requests"/u);
  assert.match(workbench, /formData\.set\("specification_file"/u);
  assert.match(workbench, /PDF, DOCX, XLSX, JPG или PNG/u);
  assert.doesNotMatch(workbench, /Открыть почту для файла/u);
  assert.match(workbench, /Заявка № \{requestNumber\}/u);
  assert.match(workbench, /\/test\/requests\/\$\{encodeURIComponent\(requestNumber\)\}/u);
  assert.doesNotMatch(workbench, /Запрос понятен для предварительного подбора/u);
  assert.doesNotMatch(workbench, /ничего не отправляет/u);
});

test("the header task action is a native cross-document anchor", async () => {
  const header = await readFile(new URL("../app/ui/PilotHeader.tsx", import.meta.url), "utf8");
  assert.match(header, /<a className="header-quick" href="\/#production-categories">/u);
  assert.doesNotMatch(header, /<Link className="header-quick"/u);
});

test("homepage conversion surfaces use readable type and restrained actions", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /\.hero-lead \{ font-size:17px; line-height:1\.62/u);
  assert.match(styles, /\.workbench-panel textarea,\.workbench-panel input \{[^}]+font:500 16px/u);
  assert.match(styles, /\.workbench-primary \{[^}]+background:#242b27;[^}]+font-size:15px/u);
  assert.match(styles, /\.workbench-result p \{[^}]+font-size:14px; line-height:1\.5/u);
  assert.match(styles, /\.workbench-contact-form h4 \{[^}]+font-size:23px/u);
  assert.match(styles, /\.workbench-tabs \{ overflow:visible; grid-template-columns:repeat\(3,minmax\(0,1fr\)\); \}/u);
  assert.match(styles, /\.workbench-tabs button \{ min-width:0;[^}]+overflow-wrap:anywhere/u);
});
