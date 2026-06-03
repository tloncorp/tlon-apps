#!/usr/bin/env node

/**
 * Build script for all platforms.
 * Run locally to build for current platform only.
 * CI runs this on each platform's runner, or cross-compiles with --target.
 *
 * Usage:
 *   node scripts/build-all.js                    # Build for current platform
 *   node scripts/build-all.js --target linux-x64 # Cross-compile for linux-x64
 */
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Read version from package.json
const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
const version = pkg.version;

// Parse --target argument
const targetArg = process.argv.find((arg) => arg.startsWith('--target='));
const target = targetArg
  ? targetArg.split('=')[1]
  : `${process.platform}-${process.arch}`;

// Map our target names to bun's target names
const bunTargets = {
  'darwin-arm64': 'bun-darwin-arm64',
  'darwin-x64': 'bun-darwin-x64',
  'linux-x64': 'bun-linux-x64',
  'linux-arm64': 'bun-linux-arm64',
};

const bunTarget = bunTargets[target];
if (!bunTarget) {
  console.error(`Unknown target: ${target}`);
  console.error(`Supported targets: ${Object.keys(bunTargets).join(', ')}`);
  process.exit(1);
}

console.log(
  `Building tlon v${version} for ${target} (bun target: ${bunTarget})...`
);

// Build the binary
const distDir = join(rootDir, 'dist');
mkdirSync(distDir, { recursive: true });

const binaryName = target.startsWith('win') ? 'tlon.exe' : 'tlon';
const binaryPath = join(distDir, binaryName);

execSync(
  `bun build scripts/main.ts --compile --target=${bunTarget} --outfile ${binaryPath} --define __VERSION__='"${version}"'`,
  {
    cwd: rootDir,
    stdio: 'inherit',
  }
);

// Copy to the appropriate npm package directory
const npmDir = join(rootDir, 'npm', target);
mkdirSync(npmDir, { recursive: true });
cpSync(binaryPath, join(npmDir, binaryName));

console.log(`Built and copied to npm/${target}/${binaryName}`);
