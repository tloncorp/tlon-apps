#!/usr/bin/env node
import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compiledSchemaPath = path.join(repoRoot, "dist", "src", "config-schema.js");
const manifestPath = path.join(repoRoot, "openclaw.plugin.json");

try {
  await fs.access(compiledSchemaPath);
} catch {
  console.error(
    `generate-channel-configs: ${compiledSchemaPath} not found; run \`pnpm build\` (this script runs as postbuild).`,
  );
  process.exit(1);
}

const { tlonChannelConfigSchema } = await import(pathToFileURL(compiledSchemaPath).href);

if (!tlonChannelConfigSchema?.schema) {
  console.error(
    `generate-channel-configs: ${compiledSchemaPath} does not export \`tlonChannelConfigSchema\` with a \`schema\` property.`,
  );
  process.exit(1);
}

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

manifest.channelConfigs ??= {};
manifest.channelConfigs.tlon = {
  schema: tlonChannelConfigSchema.schema,
  ...(tlonChannelConfigSchema.uiHints ? { uiHints: tlonChannelConfigSchema.uiHints } : {}),
};

await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log("✓ regenerated channelConfigs.tlon in openclaw.plugin.json");
