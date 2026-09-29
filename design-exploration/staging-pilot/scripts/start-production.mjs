import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { validateProductionConfig } from "./validate-production-config.mjs";

const readiness = validateProductionConfig();
if (!readiness.ok) {
  console.error("Production start blocked by preflight:");
  for (const error of readiness.errors) console.error(`- ${error}`);
  process.exit(1);
}

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(appDir, "node_modules", "vinext", "dist", "cli.js");
const child = spawn(process.execPath, [cli, "start"], { cwd:appDir, env:process.env, stdio:"inherit" });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error("Vinext production process could not start:", error.message);
  process.exit(1);
});
