import fs from "node:fs";
import path from "node:path";
import { validateEditorialDraft } from "../src/lib/editorial-draft.mjs";

const inputArg = process.argv.find((argument) => argument.startsWith("--input="));
if (!inputArg) throw new Error("Usage: node scripts/validate-editorial-draft.mjs --input=/absolute/or/relative/draft.json");

const inputPath = path.resolve(inputArg.slice("--input=".length));
if (!fs.existsSync(inputPath)) throw new Error(`Editorial draft does not exist: ${inputPath}`);
const draft = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const report = validateEditorialDraft(draft);
console.log(JSON.stringify(report, null, 2));

