#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Map of platform+arch to package name
const PLATFORMS = {
  "darwin-arm64": "@tloncorp/tlon-skill-darwin-arm64",
  "darwin-x64": "@tloncorp/tlon-skill-darwin-x64",
  "linux-x64": "@tloncorp/tlon-skill-linux-x64",
  "linux-arm64": "@tloncorp/tlon-skill-linux-arm64",
};

function getBinaryPath() {
  const platform = process.platform;
  const arch = process.arch;
  const key = `${platform}-${arch}`;

  // Check for local binary (dev mode)
  const localBinary = join(__dirname, "tlon");
  if (existsSync(localBinary)) {
    return localBinary;
  }

  const packageName = PLATFORMS[key];
  if (!packageName) {
    console.error(`Unsupported platform: ${platform}-${arch}`);
    console.error(`Supported platforms: ${Object.keys(PLATFORMS).join(", ")}`);
    process.exit(1);
  }

  // Try multiple resolution strategies
  const searchPaths = [
    // Strategy 1: resolve via require (works when installed normally)
    () => {
      try {
        const packagePath = require.resolve(`${packageName}/package.json`);
        return join(dirname(packagePath), "tlon");
      } catch {
        return null;
      }
    },
    // Strategy 2: sibling in node_modules (when installed as dep of another package)
    () => {
      const sibling = join(__dirname, "..", "..", packageName, "tlon");
      return existsSync(sibling) ? sibling : null;
    },
    // Strategy 3: up one more level (nested node_modules)
    () => {
      const nested = join(__dirname, "..", "..", "..", packageName, "tlon");
      return existsSync(nested) ? nested : null;
    },
  ];

  for (const search of searchPaths) {
    const path = search();
    if (path && existsSync(path)) {
      // Ensure binary is executable
      try {
        chmodSync(path, 0o755);
      } catch {
        // Ignore chmod errors (might be read-only filesystem)
      }
      return path;
    }
  }

  console.error(`Failed to find binary for ${platform}-${arch}`);
  console.error(`Package ${packageName} may not be installed.`);
  console.error(`\nTried searching in:`);
  console.error(`  - require.resolve('${packageName}/package.json')`);
  console.error(`  - ${join(__dirname, "..", "..", packageName, "tlon")}`);
  console.error(`\nTry: npm install ${packageName}`);
  process.exit(1);
}

const binaryPath = getBinaryPath();
const args = process.argv.slice(2);

const result = spawnSync(binaryPath, args, {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(`Failed to run binary: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
