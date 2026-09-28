import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateTestFeedRuntime, writeTestFeedRefreshStatus } from "../scripts/lib/test-feed-runtime-guard.mjs";

async function createRuntime(root, dependency, scripts = []) {
  await mkdir(path.join(root, "node_modules", dependency), { recursive:true });
  await writeFile(path.join(root, "package.json"), JSON.stringify({ name:path.basename(root), type:"module" }), "utf8");
  await writeFile(path.join(root, "node_modules", dependency, "package.json"), JSON.stringify({ name:dependency, main:"index.js" }), "utf8");
  await writeFile(path.join(root, "node_modules", dependency, "index.js"), "export default {};\n", "utf8");
  for (const relativePath of scripts) {
    const target = path.join(root, relativePath);
    await mkdir(path.dirname(target), { recursive:true });
    await writeFile(target, "// fixture\n", "utf8");
  }
}

test("runtime guard resolves database and Vinext dependencies before refresh", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "test-feed-runtime-"));
  const appDir = path.join(directory, "app");
  const buildDir = path.join(directory, "storefront");
  try {
    await createRuntime(appDir, "better-sqlite3", [
      "scripts/backup-data.mjs",
      "scripts/refresh-feed.mts",
      "scripts/finalize-catalog-snapshot.mjs",
      "scripts/test-feed-runtime-guard.mjs",
    ]);
    await createRuntime(buildDir, "vinext");
    const result = validateTestFeedRuntime({ appDir, storefrontBuildDir:buildDir });
    assert.match(result.databaseModule, /better-sqlite3[\\/]index\.js$/u);
    assert.match(result.vinextModule, /vinext[\\/]index\.js$/u);

    await rm(path.join(appDir, "node_modules", "better-sqlite3"), { recursive:true, force:true });
    assert.throws(() => validateTestFeedRuntime({ appDir, storefrontBuildDir:buildDir }), /better-sqlite3 недоступна/u);
  } finally {
    await rm(directory, { recursive:true, force:true });
  }
});

test("refresh status is atomic and complete only for a matching catalog SHA", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "test-feed-status-"));
  const statusPath = path.join(directory, "refresh-status.json");
  const catalogPath = path.join(directory, "products.json");
  const metadataPath = path.join(directory, "catalog-snapshot-meta.json");
  const catalogSource = `${JSON.stringify({ products:[{ id:"p-1" }] }, null, 2)}\n`;
  const catalogSha256 = createHash("sha256").update(catalogSource).digest("hex");
  try {
    await writeFile(catalogPath, catalogSource, "utf8");
    await writeFile(metadataPath, JSON.stringify({ status:"complete", completedAt:"2026-09-28T00:25:10.000Z", catalogSha256 }), "utf8");
    const running = writeTestFeedRefreshStatus({ statusPath, status:"running", stage:"preflight", now:new Date("2026-09-28T00:25:00.000Z") });
    const complete = writeTestFeedRefreshStatus({
      statusPath,
      status:"complete",
      stage:"complete",
      catalogPath,
      metadataPath,
      now:new Date("2026-09-28T00:26:00.000Z"),
    });
    assert.equal(complete.startedAt, running.startedAt);
    assert.equal(complete.catalogSha256, catalogSha256);
    assert.equal(complete.catalogCompletedAt, "2026-09-28T00:25:10.000Z");
    assert.deepEqual(JSON.parse(await readFile(statusPath, "utf8")), complete);

    await writeFile(metadataPath, JSON.stringify({ status:"complete", completedAt:"2026-09-28T00:25:10.000Z", catalogSha256:"wrong" }), "utf8");
    assert.throws(() => writeTestFeedRefreshStatus({ statusPath, status:"complete", stage:"complete", catalogPath, metadataPath }), /SHA-256/u);
  } finally {
    await rm(directory, { recursive:true, force:true });
  }
});
