#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, ".publish");

const copyEntries = ["dist", "openclaw.plugin.json", "README.md"];
const publishOnlyScripts = new Set(["prepublishOnly", "prepare:publish", "pack:publish", "publish:clean"]);

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const entry of copyEntries) {
  const from = join(root, entry);
  if (!existsSync(from)) {
    throw new Error(`Missing required publish entry: ${entry}`);
  }
  cpSync(from, join(outDir, entry), { recursive: true });
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

delete pkg.devDependencies;
delete pkg.packageManager;

if (pkg.scripts && typeof pkg.scripts === "object") {
  pkg.scripts = Object.fromEntries(
    Object.entries(pkg.scripts).filter(([name]) => publishOnlyScripts.has(name)),
  );
  if (Object.keys(pkg.scripts).length === 0) {
    delete pkg.scripts;
  }
}

writeFileSync(join(outDir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`Prepared publish package in ${outDir}`);
